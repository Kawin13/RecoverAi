"""add_workspaces_and_tenant_isolation

Revision ID: d5e9f3a1b7c2
Revises: c4d8e2f1a9b3
Create Date: 2026-09-03 15:30:00.000000

"""
import uuid
from datetime import datetime
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd5e9f3a1b7c2'
down_revision: Union[str, None] = 'c4d8e2f1a9b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_WORKSPACE_NAME = "RecoverAI Demo Workspace"

OPERATIONAL_TABLES = [
    "customers",
    "transactions",
    "checkout_sessions",
    "recovery_cases",
    "recovery_actions",
    "agent_decisions",
    "audit_logs",
    "guardrail_events",
    "recovery_outcomes",
    "payment_links",
    "payment_attempts"
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

    # 1. Create workspaces table if not exists
    if "workspaces" not in existing_tables:
        op.create_table(
            "workspaces",
            sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True, index=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # 2. Insert canonical default demo workspace if not present
    if bind is not None:
        if dialect == "postgresql":
            ws_exists = bind.execute(
                sa.text("SELECT 1 FROM workspaces WHERE id = CAST(:wid AS UUID)"),
                {"wid": DEFAULT_WORKSPACE_ID}
            ).fetchone()
        else:
            ws_exists = bind.execute(
                sa.text("SELECT 1 FROM workspaces WHERE id = :wid"),
                {"wid": DEFAULT_WORKSPACE_ID}
            ).fetchone()

        if not ws_exists:
            bind.execute(
                sa.text("""
                    INSERT INTO workspaces (id, name, created_at, updated_at)
                    VALUES (:wid, :wname, :now, :now)
                """),
                {
                    "wid": DEFAULT_WORKSPACE_ID,
                    "wname": DEFAULT_WORKSPACE_NAME,
                    "now": datetime.utcnow()
                }
            )

    # 3. Create workspace_members table if not exists
    if "workspace_members" not in existing_tables:
        op.create_table(
            "workspace_members",
            sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True, index=True),
            sa.Column("workspace_id", sa.Uuid(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("user_id", sa.Uuid(as_uuid=False), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("role", sa.String(length=32), nullable=False, server_default="operator"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
            sa.CheckConstraint("role IN ('admin', 'operator')", name="workspace_member_role_check"),
        )

    # 4. Backfill all existing profiles into workspace_members
    if bind is not None and insp is not None and "profiles" in existing_tables:
        profiles = bind.execute(sa.text("SELECT id, role, created_at, updated_at FROM profiles")).fetchall()
        for p in profiles:
            pid = str(p[0])
            prole = str(p[1]) if p[1] in ("admin", "operator") else "operator"
            p_created = p[2] or datetime.utcnow()
            p_updated = p[3] or datetime.utcnow()

            if dialect == "postgresql":
                member_exists = bind.execute(
                    sa.text("SELECT 1 FROM workspace_members WHERE workspace_id = CAST(:wid AS UUID) AND user_id = CAST(:uid AS UUID)"),
                    {"wid": DEFAULT_WORKSPACE_ID, "uid": pid}
                ).fetchone()
            else:
                member_exists = bind.execute(
                    sa.text("SELECT 1 FROM workspace_members WHERE workspace_id = :wid AND user_id = :uid"),
                    {"wid": DEFAULT_WORKSPACE_ID, "uid": pid}
                ).fetchone()

            if not member_exists:
                bind.execute(
                    sa.text("""
                        INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
                        VALUES (:mid, :wid, :uid, :role, :created, :updated)
                    """),
                    {
                        "mid": str(uuid.uuid4()),
                        "wid": DEFAULT_WORKSPACE_ID,
                        "uid": pid,
                        "role": prole,
                        "created": p_created,
                        "updated": p_updated
                    }
                )

    # 5. Add workspace_id column, index, and FK to all operational tables
    for table_name in OPERATIONAL_TABLES:
        if insp is not None and table_name in existing_tables:
            cols = [c["name"] for c in insp.get_columns(table_name, schema=curr_schema)]
            if "workspace_id" not in cols:
                if dialect == "sqlite":
                    with op.batch_alter_table(table_name) as batch_op:
                        batch_op.add_column(
                            sa.Column("workspace_id", sa.Uuid(as_uuid=False), server_default=DEFAULT_WORKSPACE_ID, nullable=False)
                        )
                        batch_op.create_index(f"ix_{table_name}_workspace_id", ["workspace_id"])
                else:
                    op.add_column(
                        table_name,
                        sa.Column("workspace_id", sa.Uuid(as_uuid=False), server_default=DEFAULT_WORKSPACE_ID, nullable=False)
                    )
                    op.create_index(f"ix_{table_name}_workspace_id", table_name, ["workspace_id"])
                    op.create_foreign_key(
                        f"fk_{table_name}_workspace_id",
                        table_name,
                        "workspaces",
                        ["workspace_id"],
                        ["id"],
                        ondelete="CASCADE"
                    )

            # Backfill any nulls
            if bind is not None:
                bind.execute(
                    sa.text(f"UPDATE {table_name} SET workspace_id = :wid WHERE workspace_id IS NULL"),
                    {"wid": DEFAULT_WORKSPACE_ID}
                )


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

    for table_name in OPERATIONAL_TABLES:
        if table_name in existing_tables:
            cols = [c["name"] for c in insp.get_columns(table_name, schema=curr_schema)]
            indexes = [idx["name"] for idx in insp.get_indexes(table_name, schema=curr_schema)]
            if "workspace_id" in cols:
                if dialect == "sqlite":
                    with op.batch_alter_table(table_name) as batch_op:
                        if f"ix_{table_name}_workspace_id" in indexes:
                            batch_op.drop_index(f"ix_{table_name}_workspace_id")
                        batch_op.drop_column("workspace_id")
                else:
                    if f"ix_{table_name}_workspace_id" in indexes:
                        op.drop_index(f"ix_{table_name}_workspace_id", table_name=table_name)
                    op.drop_column(table_name, "workspace_id")

    if "workspace_members" in existing_tables:
        op.drop_table("workspace_members")

    if "workspaces" in existing_tables:
        op.drop_table("workspaces")
