"""add_composite_performance_indexes

Revision ID: h9c4d5e6f7a8
Revises: g8b3c4d5e6f7
Create Date: 2026-11-27 20:18:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'h9c4d5e6f7a8'
down_revision: Union[str, None] = 'g8b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    ("transactions", "ix_transactions_ws_created_at", ["workspace_id", "created_at"]),
    ("transactions", "ix_transactions_ws_status", ["workspace_id", "status"]),
    ("recovery_cases", "ix_recovery_cases_ws_created_at", ["workspace_id", "created_at"]),
    ("recovery_cases", "ix_recovery_cases_ws_status", ["workspace_id", "status"]),
    ("audit_logs", "ix_audit_logs_ws_created_at", ["workspace_id", "created_at"]),
]


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
    for table_name, index_name, cols in INDEXES:
        if table_name not in existing_tables:
            continue
        existing_indexes = {ix["name"] for ix in insp.get_indexes(table_name, schema=curr_schema)}
        if index_name not in existing_indexes:
            op.create_index(index_name, table_name, cols)


def downgrade() -> None:
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
    for table_name, index_name, _ in reversed(INDEXES):
        if table_name not in existing_tables:
            continue
        existing_indexes = {ix["name"] for ix in insp.get_indexes(table_name, schema=curr_schema)}
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name=table_name)
