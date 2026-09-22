"""resend_email_integration

Revision ID: g8b3c4d5e6f7
Revises: f7a2b3c4d5e6
Create Date: 2026-09-22 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'g8b3c4d5e6f7'
down_revision: Union[str, None] = 'f7a2b3c4d5e6'
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

    # 1. Update customer_messages table
    if "customer_messages" in existing_tables:
        existing_cols = {col["name"] for col in insp.get_columns("customer_messages", schema=curr_schema)}

        if "transaction_id" not in existing_cols:
            op.add_column("customer_messages", sa.Column("transaction_id", sa.String(length=64), sa.ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True))
            op.create_index("ix_customer_messages_transaction_id", "customer_messages", ["transaction_id"])

        if "recovery_action_id" not in existing_cols:
            op.add_column("customer_messages", sa.Column("recovery_action_id", sa.String(length=64), sa.ForeignKey("recovery_actions.id", ondelete="SET NULL"), nullable=True))
            op.create_index("ix_customer_messages_recovery_action_id", "customer_messages", ["recovery_action_id"])

        if "recovery_job_id" not in existing_cols:
            op.add_column("customer_messages", sa.Column("recovery_job_id", sa.String(length=64), sa.ForeignKey("recovery_jobs.id", ondelete="SET NULL"), nullable=True))
            op.create_index("ix_customer_messages_recovery_job_id", "customer_messages", ["recovery_job_id"])

        if "template_type" not in existing_cols:
            op.add_column("customer_messages", sa.Column("template_type", sa.String(length=64), nullable=True))
            op.create_index("ix_customer_messages_template_type", "customer_messages", ["template_type"])

        if "message_text" not in existing_cols:
            op.add_column("customer_messages", sa.Column("message_text", sa.Text(), nullable=True))

        if "message_html" not in existing_cols:
            op.add_column("customer_messages", sa.Column("message_html", sa.Text(), nullable=True))

        if "provider" not in existing_cols:
            op.add_column("customer_messages", sa.Column("provider", sa.String(length=32), nullable=False, server_default="resend"))
            op.create_index("ix_customer_messages_provider", "customer_messages", ["provider"])

        if "idempotency_key" not in existing_cols:
            op.add_column("customer_messages", sa.Column("idempotency_key", sa.String(length=128), nullable=True))
            op.create_index("ix_customer_messages_idempotency_key", "customer_messages", ["idempotency_key"], unique=True)

        if "attempt_count" not in existing_cols:
            op.add_column("customer_messages", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"))

        if "scheduled_at" not in existing_cols:
            op.add_column("customer_messages", sa.Column("scheduled_at", sa.DateTime(), nullable=True))

        if "error_code" not in existing_cols:
            op.add_column("customer_messages", sa.Column("error_code", sa.String(length=64), nullable=True))

        if "error_message" not in existing_cols:
            op.add_column("customer_messages", sa.Column("error_message", sa.Text(), nullable=True))

        if "metadata_json" not in existing_cols:
            op.add_column("customer_messages", sa.Column("metadata_json", sa.Text(), nullable=True))

        # Composite indexes
        existing_indexes = {ix["name"] for ix in insp.get_indexes("customer_messages", schema=curr_schema)}
        if "ix_customer_messages_ws_status" not in existing_indexes:
            op.create_index("ix_customer_messages_ws_status", "customer_messages", ["workspace_id", "status"])
        if "ix_customer_messages_case" not in existing_indexes:
            op.create_index("ix_customer_messages_case", "customer_messages", ["workspace_id", "recovery_case_id"])

    # 2. Update workspace_settings table
    if "workspace_settings" in existing_tables:
        ws_cols = {col["name"] for col in insp.get_columns("workspace_settings", schema=curr_schema)}

        if "email_enabled" not in ws_cols:
            op.add_column("workspace_settings", sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")))

        if "max_emails_per_recovery" not in ws_cols:
            op.add_column("workspace_settings", sa.Column("max_emails_per_recovery", sa.Integer(), nullable=False, server_default="3"))

        if "email_cooldown_minutes" not in ws_cols:
            op.add_column("workspace_settings", sa.Column("email_cooldown_minutes", sa.Integer(), nullable=False, server_default="30"))

        if "email_quiet_hours_enabled" not in ws_cols:
            op.add_column("workspace_settings", sa.Column("email_quiet_hours_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")))

        if "email_quiet_hours_start" not in ws_cols:
            op.add_column("workspace_settings", sa.Column("email_quiet_hours_start", sa.String(length=8), nullable=False, server_default="22:00"))

        if "email_quiet_hours_end" not in ws_cols:
            op.add_column("workspace_settings", sa.Column("email_quiet_hours_end", sa.String(length=8), nullable=False, server_default="08:00"))

        if "recovery_success_email_enabled" not in ws_cols:
            op.add_column("workspace_settings", sa.Column("recovery_success_email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # 3. Update customers table
    if "customers" in existing_tables:
        cust_cols = {col["name"] for col in insp.get_columns("customers", schema=curr_schema)}
        if "email_opt_out" not in cust_cols:
            op.add_column("customers", sa.Column("email_opt_out", sa.Boolean(), nullable=False, server_default=sa.text("false")))

def downgrade() -> None:
    pass
