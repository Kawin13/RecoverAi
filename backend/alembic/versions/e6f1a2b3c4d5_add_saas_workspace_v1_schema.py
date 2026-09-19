"""add_saas_workspace_v1_schema

Revision ID: e6f1a2b3c4d5
Revises: d5e9f3a1b7c2
Create Date: 2026-09-19 15:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e6f1a2b3c4d5'
down_revision: Union[str, None] = 'd5e9f3a1b7c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind) if bind is not None else None
    dialect = bind.dialect.name if bind is not None else "sqlite"

    curr_schema = None
    if dialect == "postgresql" and bind is not None:
        try:
            curr_schema = bind.execute(sa.text("SELECT current_schema();")).scalar()
        except Exception:
            curr_schema = "public"

    existing_tables = insp.get_table_names(schema=curr_schema) if insp is not None else []

    # 1. Create workspace_settings table
    if "workspace_settings" not in existing_tables:
        op.create_table(
            "workspace_settings",
            sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True, index=True),
            sa.Column("workspace_id", sa.Uuid(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
            sa.Column("business_type", sa.String(length=64), nullable=False, server_default="SAAS"),
            sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Kolkata"),
            sa.Column("currency", sa.String(length=8), nullable=False, server_default="INR"),
            sa.Column("human_approval_threshold", sa.Float(), nullable=False, server_default="10000.0"),
            sa.Column("urgent_value_threshold", sa.Float(), nullable=False, server_default="25000.0"),
            sa.Column("max_recovery_attempts", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("cooldown_minutes", sa.Integer(), nullable=False, server_default="30"),
            sa.Column("quiet_hours_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("quiet_hours_start", sa.String(length=8), nullable=False, server_default="22:00"),
            sa.Column("quiet_hours_end", sa.String(length=8), nullable=False, server_default="08:00"),
            sa.Column("maximum_discount_percent", sa.Float(), nullable=False, server_default="15.0"),
            sa.Column("allowed_strategies", sa.JSON(), nullable=False, server_default='["SMART_PAYLINK_1CLICK", "UPI_INTENT_FALLBACK", "TIMED_SMART_RETRY", "WHATSAPP_CONCIERGE", "INCENTIVIZED_DUNNING"]'),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # 2. Create workspace_integrations table
    if "workspace_integrations" not in existing_tables:
        op.create_table(
            "workspace_integrations",
            sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True, index=True),
            sa.Column("workspace_id", sa.Uuid(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("provider", sa.String(length=32), nullable=False, server_default="razorpay"),
            sa.Column("mode", sa.String(length=16), nullable=False, server_default="test"),
            sa.Column("public_key_id", sa.String(length=255), nullable=True),
            sa.Column("encrypted_key_secret", sa.String(length=512), nullable=True),
            sa.Column("encrypted_webhook_secret", sa.String(length=512), nullable=True),
            sa.Column("webhook_endpoint_id", sa.String(length=64), nullable=False, unique=True, index=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="NOT_CONFIGURED"),
            sa.Column("last_verified_at", sa.DateTime(), nullable=True),
            sa.Column("last_webhook_at", sa.DateTime(), nullable=True),
            sa.Column("last_error", sa.String(length=512), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("workspace_id", "provider", name="uq_workspace_provider"),
            sa.CheckConstraint("mode = 'test'", name="check_integration_mode_test_only"),
            sa.CheckConstraint("provider IN ('razorpay')", name="check_integration_provider"),
        )

    # 3. Create workspace_invitations table
    if "workspace_invitations" not in existing_tables:
        op.create_table(
            "workspace_invitations",
            sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True, index=True),
            sa.Column("workspace_id", sa.Uuid(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("email", sa.String(length=255), nullable=False, index=True),
            sa.Column("role", sa.String(length=32), nullable=False, server_default="operator"),
            sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True, index=True),
            sa.Column("invited_by_user_id", sa.Uuid(as_uuid=False), sa.ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint("role IN ('admin', 'operator')", name="check_invitation_role"),
        )

    # 4. Add multi-merchant columns to webhook_events
    if "webhook_events" in existing_tables:
        cols = [c["name"] for c in insp.get_columns("webhook_events", schema=curr_schema)]
        if "workspace_id" not in cols:
            if dialect == "sqlite":
                with op.batch_alter_table("webhook_events") as batch_op:
                    batch_op.add_column(sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=True))
                    batch_op.add_column(sa.Column("integration_id", sa.Uuid(as_uuid=False), nullable=True))
                    batch_op.add_column(sa.Column("provider_event_id", sa.String(length=128), nullable=True))
                    batch_op.create_index("ix_webhook_events_workspace_id", ["workspace_id"])
                    batch_op.create_index("ix_webhook_events_provider_event_id", ["provider_event_id"])
            else:
                op.add_column("webhook_events", sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=True))
                op.add_column("webhook_events", sa.Column("integration_id", sa.Uuid(as_uuid=False), nullable=True))
                op.add_column("webhook_events", sa.Column("provider_event_id", sa.String(length=128), nullable=True))
                op.create_index("ix_webhook_events_workspace_id", "webhook_events", ["workspace_id"])
                op.create_index("ix_webhook_events_provider_event_id", "webhook_events", ["provider_event_id"])
                op.create_foreign_key("fk_webhook_events_workspace_id", "webhook_events", "workspaces", ["workspace_id"], ["id"], ondelete="CASCADE")
                op.create_foreign_key("fk_webhook_events_integration_id", "webhook_events", "workspace_integrations", ["integration_id"], ["id"], ondelete="SET NULL")

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind) if bind is not None else None
    dialect = bind.dialect.name if bind is not None else "sqlite"
    curr_schema = None

    existing_tables = insp.get_table_names(schema=curr_schema) if insp is not None else []

    if "webhook_events" in existing_tables:
        if dialect == "sqlite":
            with op.batch_alter_table("webhook_events") as batch_op:
                batch_op.drop_column("provider_event_id")
                batch_op.drop_column("integration_id")
                batch_op.drop_column("workspace_id")
        else:
            op.drop_column("webhook_events", "provider_event_id")
            op.drop_column("webhook_events", "integration_id")
            op.drop_column("webhook_events", "workspace_id")

    if "workspace_invitations" in existing_tables:
        op.drop_table("workspace_invitations")

    if "workspace_integrations" in existing_tables:
        op.drop_table("workspace_integrations")

    if "workspace_settings" in existing_tables:
        op.drop_table("workspace_settings")
