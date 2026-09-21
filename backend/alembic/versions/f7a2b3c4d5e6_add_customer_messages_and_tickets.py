"""add_customer_messages_and_tickets

Revision ID: f7a2b3c4d5e6
Revises: e6f1a2b3c4d5
Create Date: 2026-09-21 11:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f7a2b3c4d5e6'
down_revision: Union[str, None] = 'e6f1a2b3c4d5'
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

    # 1. Create customer_messages table
    if "customer_messages" not in existing_tables:
        op.create_table(
            "customer_messages",
            sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True, index=True),
            sa.Column("workspace_id", sa.Uuid(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("recovery_case_id", sa.String(length=64), sa.ForeignKey("recovery_cases.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("customer_id", sa.String(length=64), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("channel", sa.String(length=32), nullable=False, server_default="EMAIL"),
            sa.Column("recipient", sa.String(length=255), nullable=False, index=True),
            sa.Column("subject", sa.String(length=500), nullable=False),
            sa.Column("body_text", sa.Text(), nullable=True),
            sa.Column("provider_message_id", sa.String(length=128), nullable=True, index=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="QUEUED", index=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("delivered_at", sa.DateTime(), nullable=True),
            sa.Column("failed_at", sa.DateTime(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True)
        )

    # 2. Create consumed_stream_tickets table
    if "consumed_stream_tickets" not in existing_tables:
        op.create_table(
            "consumed_stream_tickets",
            sa.Column("ticket", sa.String(length=255), primary_key=True, index=True),
            sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False, index=True),
            sa.Column("user_id", sa.Uuid(as_uuid=False), nullable=False),
            sa.Column("consumed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("expires_at", sa.DateTime(), nullable=False, index=True)
        )

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind) if bind is not None else None
    dialect = bind.dialect.name if bind is not None else "sqlite"
    curr_schema = None

    existing_tables = insp.get_table_names(schema=curr_schema) if insp is not None else []

    if "consumed_stream_tickets" in existing_tables:
        op.drop_table("consumed_stream_tickets")

    if "customer_messages" in existing_tables:
        op.drop_table("customer_messages")
