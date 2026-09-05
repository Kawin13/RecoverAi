import os
import tempfile
import pytest
from alembic.config import Config
from alembic import command
import sqlalchemy as sa
from sqlalchemy import create_engine, inspect, text


@pytest.fixture
def temp_alembic_db():
    """Creates a temporary sqlite database file for migration testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    
    db_url = f"sqlite:///{db_path}"
    
    # Locate alembic.ini and backend directory
    backend_dir = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
    
    alembic_cfg = Config(alembic_ini_path)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    
    yield db_url, alembic_cfg
    
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass


def test_fresh_database_upgrade_head(temp_alembic_db):
    """Verifies that running alembic upgrade head on a fresh DB creates the complete schema."""
    db_url, alembic_cfg = temp_alembic_db
    
    # Run full migration from 0 to head
    command.upgrade(alembic_cfg, "head")
    
    engine = create_engine(db_url)
    insp = inspect(engine)
    tables = insp.get_table_names()
    
    expected_tables = [
        "workspaces",
        "workspace_members",
        "customers",
        "transactions",
        "payment_attempts",
        "recovery_cases",
        "checkout_sessions",
        "recovery_actions",
        "agent_decisions",
        "audit_logs",
        "guardrail_events",
        "recovery_outcomes",
        "payment_links",
        "webhook_events",
        "profiles",
        "alembic_version"
    ]
    
    for table in expected_tables:
        assert table in tables, f"Expected table '{table}' not found in created schema: {tables}"
        
    # Check profiles columns
    profile_cols = {c["name"]: c for c in insp.get_columns("profiles")}
    assert "id" in profile_cols
    assert "role" in profile_cols
    assert "email" in profile_cols
    assert "full_name" in profile_cols
    
    # Check transactions columns
    tx_cols = {c["name"]: c for c in insp.get_columns("transactions")}
    assert "razorpay_order_id" in tx_cols
    assert "razorpay_payment_id" in tx_cols
    assert "razorpay_signature" in tx_cols
    
    # Check recovery_cases columns
    rc_cols = {c["name"]: c for c in insp.get_columns("recovery_cases")}
    assert "current_step" in rc_cols
    assert "max_attempts" in rc_cols
    assert "channel" in rc_cols
    assert "checkout_session_id" in rc_cols
    
    # Check checkout_sessions columns
    cs_cols = {c["name"]: c for c in insp.get_columns("checkout_sessions")}
    assert "cart_amount" in cs_cols
    assert "status" in cs_cols
    assert "is_demo_simulation" in cs_cols
    assert "recovery_case_id" in cs_cols


def test_existing_database_upgrade_preserves_data(temp_alembic_db):
    """
    Verifies that upgrading an existing database stamped at add934edfad6
    applies revision b2e4f6a8c1d3 and preserves all existing records without data loss.
    """
    db_url, alembic_cfg = temp_alembic_db
    engine = create_engine(db_url)
    
    # 1. Simulate initial schema stamped at add934edfad6
    command.upgrade(alembic_cfg, "add934edfad6")
    
    # Insert existing production-like rows
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO customers (id, name, email, tier, ltv)
            VALUES ('cust_101', 'Alice Test', 'alice@test.com', 'ENTERPRISE', 25000.0);
        """))
        conn.execute(text("""
            INSERT INTO transactions (id, order_id, customer_id, amount, status)
            VALUES ('tx_101', 'order_101', 'cust_101', 4999.0, 'FAILED');
        """))
        conn.execute(text("""
            INSERT INTO profiles (id, email, full_name, role)
            VALUES ('597289a7-e26e-415d-ab4d-fa587e32899a', 'test.ops@recoverai.io', 'Revenue Ops Admin', 'admin');
        """))
        conn.commit()
        
    # 2. Upgrade from add934edfad6 to head (b2e4f6a8c1d3)
    command.upgrade(alembic_cfg, "head")
    
    # 3. Verify all existing data is preserved intact
    with engine.connect() as conn:
        cust_row = conn.execute(text("SELECT name, email, tier FROM customers WHERE id = 'cust_101';")).fetchone()
        assert cust_row is not None
        assert cust_row[0] == "Alice Test"
        assert cust_row[1] == "alice@test.com"
        
        tx_row = conn.execute(text("SELECT amount, status FROM transactions WHERE id = 'tx_101';")).fetchone()
        assert tx_row is not None
        assert tx_row[0] == 4999.0
        
        prof_row = conn.execute(text("SELECT email, role FROM profiles WHERE id = '597289a7-e26e-415d-ab4d-fa587e32899a';")).fetchone()
        assert prof_row is not None
        assert prof_row[0] == "test.ops@recoverai.io"
        assert prof_row[1] == "admin"


def test_downgrade_and_reupgrade_cycle(temp_alembic_db):
    """Verifies that downgrade and upgrade cycles execute without syntax or dependency errors."""
    db_url, alembic_cfg = temp_alembic_db
    
    # Upgrade to head
    command.upgrade(alembic_cfg, "head")
    
    # Downgrade to add934edfad6
    command.downgrade(alembic_cfg, "add934edfad6")
    
    # Re-upgrade to head
    command.upgrade(alembic_cfg, "head")
    
    engine = create_engine(db_url)
    insp = inspect(engine)
    tables = insp.get_table_names()
    assert "profiles" in tables
    assert "transactions" in tables


def test_postgresql_transactional_dry_run_upgrade():
    """
    Validates that the migration path executes successfully on live PostgreSQL / Supabase,
    verifies UUID casting, constraints, and foreign keys, and rolls back safely.
    """
    from app.core.config import settings
    db_url = settings.get_effective_database_url()
    if not db_url.startswith("postgresql"):
        pytest.skip("Skipping PostgreSQL live check in SQLite-only environment")

    engine = create_engine(db_url)
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Clean non-UUID test rows
            conn.execute(text("""
                DELETE FROM public.profiles 
                WHERE id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
            """))

            # 2. Clean orphan profiles not in auth.users if auth schema exists
            insp = inspect(conn)
            if "users" in insp.get_table_names(schema="auth"):
                conn.execute(text("""
                    DELETE FROM public.profiles 
                    WHERE id::uuid NOT IN (SELECT id FROM auth.users);
                """))

            # 3. Drop existing RLS policies before altering column type
            conn.execute(text('DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;'))
            conn.execute(text('DROP POLICY IF EXISTS "Users can update own profile display fields" ON public.profiles;'))

            # 4. Alter id column to UUID
            conn.execute(text("ALTER TABLE public.profiles ALTER COLUMN id TYPE UUID USING id::uuid;"))

            # 5. Re-create RLS policies with native UUID comparison
            conn.execute(text("""
                CREATE POLICY "Users can view own profile"
                    ON public.profiles
                    FOR SELECT
                    TO authenticated
                    USING (auth.uid() = id);
            """))
            conn.execute(text("""
                CREATE POLICY "Users can update own profile display fields"
                    ON public.profiles
                    FOR UPDATE
                    TO authenticated
                    USING (auth.uid() = id)
                    WITH CHECK (auth.uid() = id);
            """))

            # 5. Role check constraint
            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'role_check'
                    ) THEN
                        ALTER TABLE public.profiles ADD CONSTRAINT role_check CHECK (role IN ('admin', 'operator'));
                    END IF;
                END $$;
            """))

            # 6. Verify FK to auth.users if present
            if "users" in insp.get_table_names(schema="auth"):
                conn.execute(text("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_auth_users'
                        ) THEN
                            ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_auth_users
                            FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
                        END IF;
                    END $$;
                """))

            # 7. Check profiles count
            genuine_profiles = conn.execute(text("SELECT id, email, role FROM public.profiles;")).fetchall()
            assert len(genuine_profiles) > 0, "Expected genuine profiles to be preserved"

        finally:
            trans.rollback()


def test_phase3_to_phase4_upgrade_preserves_existing_data(temp_alembic_db):
    """
    Verifies that upgrading an existing Phase 3 database (stamped at c4d8e2f1a9b3)
    to Phase 4 (revision d5e9f3a1b7c2) creates workspaces, backfills workspace_members,
    adds workspace_id to operational tables, and safely preserves existing operational data.
    """
    db_url, alembic_cfg = temp_alembic_db
    engine = create_engine(db_url)

    # 1. Upgrade to Phase 3
    command.upgrade(alembic_cfg, "c4d8e2f1a9b3")

    # 2. Insert existing pre-Phase 4 records
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO profiles (id, email, full_name, role)
            VALUES ('11111111-2222-3333-4444-555555555555', 'merchant@existing.com', 'Existing Merchant', 'admin');
        """))
        conn.execute(text("""
            INSERT INTO customers (id, name, email, tier, ltv)
            VALUES ('cust_legacy_01', 'Legacy Customer', 'shopper@legacy.io', 'GROWTH', 15000.0);
        """))
        conn.execute(text("""
            INSERT INTO transactions (id, order_id, customer_id, amount, status)
            VALUES ('tx_legacy_01', 'ord_legacy_01', 'cust_legacy_01', 7500.0, 'FAILED');
        """))
        conn.commit()

    # 3. Upgrade to Phase 4 (d5e9f3a1b7c2)
    command.upgrade(alembic_cfg, "d5e9f3a1b7c2")

    # 4. Verify Phase 4 schema and data preservation
    insp = inspect(engine)
    tables = insp.get_table_names()
    assert "workspaces" in tables
    assert "workspace_members" in tables

    with engine.connect() as conn:
        # Default workspace created
        default_ws = conn.execute(text("SELECT id, name FROM workspaces WHERE id = '00000000-0000-0000-0000-000000000001';")).fetchone()
        assert default_ws is not None
        assert "RecoverAI" in default_ws[1]

        # Profile backfilled into workspace_members
        member = conn.execute(text("""
            SELECT workspace_id, user_id, role 
            FROM workspace_members 
            WHERE user_id = '11111111-2222-3333-4444-555555555555';
        """)).fetchone()
        assert member is not None
        assert member[0] == "00000000-0000-0000-0000-000000000001"
        assert member[2] == "admin"

        # Operational transaction preserved and assigned to default workspace
        tx_row = conn.execute(text("""
            SELECT id, order_id, amount, status, workspace_id 
            FROM transactions 
            WHERE id = 'tx_legacy_01';
        """)).fetchone()
        assert tx_row is not None
        assert tx_row[0] == "tx_legacy_01"
        assert tx_row[1] == "ord_legacy_01"
        assert tx_row[2] == 7500.0
        assert tx_row[3] == "FAILED"
        assert tx_row[4] == "00000000-0000-0000-0000-000000000001"

