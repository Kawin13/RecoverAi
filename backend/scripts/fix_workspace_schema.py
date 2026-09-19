import sys
from sqlalchemy import text
from app.database.session import SessionLocal

def main():
    db = SessionLocal()
    try:
        print("1. Checking workspaces table...")
        ws = db.execute(text("SELECT id, name FROM workspaces WHERE id = '00000000-0000-0000-0000-000000000001'")).fetchall()
        print("Demo workspace:", ws)

        print("2. Dropping empty legacy tables...")
        db.execute(text("DROP TABLE IF EXISTS workspace_integrations CASCADE;"))
        db.execute(text("DROP TABLE IF EXISTS workspace_settings CASCADE;"))
        db.execute(text("DROP TABLE IF EXISTS workspace_invitations CASCADE;"))
        db.commit()
        print("Dropped legacy tables.")

        print("3. Creating workspace_settings table...")
        db.execute(text("""
            CREATE TABLE workspace_settings (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
                business_type VARCHAR(64) NOT NULL DEFAULT 'SAAS',
                timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
                currency VARCHAR(8) NOT NULL DEFAULT 'INR',
                human_approval_threshold DOUBLE PRECISION NOT NULL DEFAULT 10000.0,
                urgent_value_threshold DOUBLE PRECISION NOT NULL DEFAULT 25000.0,
                max_recovery_attempts INTEGER NOT NULL DEFAULT 3,
                cooldown_minutes INTEGER NOT NULL DEFAULT 30,
                quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                quiet_hours_start VARCHAR(8) NOT NULL DEFAULT '22:00',
                quiet_hours_end VARCHAR(8) NOT NULL DEFAULT '08:00',
                maximum_discount_percent DOUBLE PRECISION NOT NULL DEFAULT 15.0,
                allowed_strategies JSON NOT NULL DEFAULT '["SMART_PAYLINK_1CLICK", "UPI_INTENT_FALLBACK", "TIMED_SMART_RETRY", "WHATSAPP_CONCIERGE", "INCENTIVIZED_DUNNING"]',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            CREATE INDEX idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);
        """))

        print("4. Creating workspace_integrations table...")
        db.execute(text("""
            CREATE TABLE workspace_integrations (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
                mode VARCHAR(16) NOT NULL DEFAULT 'test',
                public_key_id VARCHAR(255),
                encrypted_key_secret VARCHAR(512),
                encrypted_webhook_secret VARCHAR(512),
                webhook_endpoint_id VARCHAR(64) NOT NULL UNIQUE,
                status VARCHAR(32) NOT NULL DEFAULT 'NOT_CONFIGURED',
                last_verified_at TIMESTAMP WITH TIME ZONE,
                last_webhook_at TIMESTAMP WITH TIME ZONE,
                last_error VARCHAR(512),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_workspace_provider UNIQUE (workspace_id, provider),
                CONSTRAINT check_integration_mode_test_only CHECK (mode = 'test'),
                CONSTRAINT check_integration_provider CHECK (provider IN ('razorpay'))
            );
            CREATE INDEX idx_workspace_integrations_workspace_id ON workspace_integrations(workspace_id);
            CREATE INDEX idx_workspace_integrations_webhook_endpoint_id ON workspace_integrations(webhook_endpoint_id);
        """))

        print("5. Creating workspace_invitations table...")
        db.execute(text("""
            CREATE TABLE workspace_invitations (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'operator',
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                invited_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                accepted_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT check_invitation_role CHECK (role IN ('admin', 'operator'))
            );
            CREATE INDEX idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
            CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);
        """))

        print("6. Updating alembic_version to e6f1a2b3c4d5...")
        db.execute(text("UPDATE alembic_version SET version_num = 'e6f1a2b3c4d5';"))

        print("7. Seeding default settings and integration for demo workspace 00000000-0000-0000-0000-000000000001...")
        db.execute(text("""
            INSERT INTO workspace_settings (id, workspace_id, business_type, timezone, currency)
            VALUES ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'SAAS', 'Asia/Kolkata', 'INR')
            ON CONFLICT (workspace_id) DO NOTHING;
        """))
        db.execute(text("""
            INSERT INTO workspace_integrations (id, workspace_id, provider, mode, webhook_endpoint_id, status)
            VALUES ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'razorpay', 'test', 'wh_demo_default_endpoint', 'CONNECTED')
            ON CONFLICT (workspace_id, provider) DO NOTHING;
        """))

        db.commit()
        print("Schema successfully synchronized with models!")
    except Exception as e:
        db.rollback()
        print("Error synchronizing schema:", e)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
