"""upgrade_profiles_uuid_and_constraints

Revision ID: b2e4f6a8c1d3
Revises: add934edfad6
Create Date: 2026-09-03 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2e4f6a8c1d3'
down_revision: Union[str, None] = 'add934edfad6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name if bind is not None else "postgresql"

    id_col = None
    existing_constraints = []
    existing_fks = []
    auth_tables = []

    if bind is not None:
        try:
            insp = sa.inspect(bind)
            curr_schema = None
            if dialect_name == "postgresql":
                curr_schema = bind.execute(sa.text("SELECT current_schema();")).scalar()
            columns = {c['name']: c for c in insp.get_columns('profiles', schema=curr_schema)}
            id_col = columns.get('id')
            existing_constraints = [c['name'] for c in insp.get_check_constraints('profiles', schema=curr_schema)]
            existing_fks = [fk['name'] for fk in insp.get_foreign_keys('profiles', schema=curr_schema)]
            auth_tables = insp.get_table_names(schema='auth')
        except Exception:
            pass

    if dialect_name == 'postgresql':
        # Drop RLS policies temporarily if they reference the column being altered
        op.execute('DROP POLICY IF EXISTS "Users can view own profile" ON profiles;')
        op.execute('DROP POLICY IF EXISTS "Users can update own profile display fields" ON profiles;')

        # If column is not already UUID, clean non-UUID test rows and convert
        if not id_col or not isinstance(id_col.get('type'), postgresql.UUID):
            # Reconcile mock/test rows that have non-UUID strings before casting
            op.execute("""
                DELETE FROM profiles 
                WHERE id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
            """)

            # If Supabase auth.users exists, ensure orphan profiles without corresponding auth.users are cleaned up
            if 'users' in auth_tables:
                op.execute("""
                    DELETE FROM profiles 
                    WHERE id::uuid NOT IN (SELECT id FROM auth.users);
                """)

            op.execute("ALTER TABLE profiles ALTER COLUMN id TYPE UUID USING id::uuid")

        # Ensure RLS is enabled
        op.execute("ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;")

        # Re-create RLS policies with native UUID comparison
        op.execute("""
            CREATE POLICY "Users can view own profile"
                ON profiles
                FOR SELECT
                TO authenticated
                USING (auth.uid() = id);
        """)
        op.execute("""
            CREATE POLICY "Users can update own profile display fields"
                ON profiles
                FOR UPDATE
                TO authenticated
                USING (auth.uid() = id)
                WITH CHECK (auth.uid() = id);
        """)

        # 2. Add role check constraint if not already present
        if 'role_check' not in existing_constraints:
            op.create_check_constraint(
                'role_check',
                'profiles',
                "role IN ('admin', 'operator')"
            )

        # 3. Add foreign key to auth.users(id) if auth schema exists
        if 'fk_profiles_auth_users' not in existing_fks:
            if 'users' in auth_tables:
                op.create_foreign_key(
                    'fk_profiles_auth_users',
                    'profiles',
                    'users',
                    ['id'],
                    ['id'],
                    referent_schema='auth',
                    ondelete='CASCADE'
                )

    elif dialect_name == 'sqlite':
        with op.batch_alter_table('profiles') as batch_op:
            if 'role_check' not in existing_constraints:
                batch_op.create_check_constraint(
                    'role_check',
                    "role IN ('admin', 'operator')"
                )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    dialect_name = bind.dialect.name

    if dialect_name == 'postgresql':
        op.execute('DROP POLICY IF EXISTS "Users can view own profile" ON profiles;')
        op.execute('DROP POLICY IF EXISTS "Users can update own profile display fields" ON profiles;')

        existing_fks = [fk['name'] for fk in insp.get_foreign_keys('profiles')]
        if 'fk_profiles_auth_users' in existing_fks:
            op.drop_constraint('fk_profiles_auth_users', 'profiles', type_='foreignkey')

        existing_constraints = [
            c['name'] for c in insp.get_check_constraints('profiles')
        ]
        if 'role_check' in existing_constraints:
            op.drop_constraint('role_check', 'profiles', type_='check')

        op.execute("ALTER TABLE profiles ALTER COLUMN id TYPE VARCHAR(64) USING id::text")

        op.execute("""
            CREATE POLICY "Users can view own profile"
                ON profiles
                FOR SELECT
                TO authenticated
                USING (auth.uid()::text = id::text);
        """)
        op.execute("""
            CREATE POLICY "Users can update own profile display fields"
                ON profiles
                FOR UPDATE
                TO authenticated
                USING (auth.uid()::text = id::text)
                WITH CHECK (auth.uid()::text = id::text);
        """)

    elif dialect_name == 'sqlite':
        existing_constraints = [
            c['name'] for c in insp.get_check_constraints('profiles')
        ]
        if 'role_check' in existing_constraints:
            with op.batch_alter_table('profiles') as batch_op:
                batch_op.drop_constraint('role_check', type_='check')
