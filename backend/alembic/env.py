from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.config import settings
from app.database.base import Base
from app.models import (
    Customer,
    Transaction,
    PaymentAttempt,
    CheckoutSession,
    RecoveryCase,
    RecoveryAction,
    AgentDecision,
    AuditLog,
    GuardrailEvent,
    RecoveryOutcome,
    WebhookEvent,
    PaymentLink,
    Profile
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_url() -> str:
    url = config.get_main_option("sqlalchemy.url")
    if not url or "driver://user:pass" in url:
        url = settings.get_effective_database_url()
    return url

def include_object(object, name, type_, reflected, compare_to):
    if type_ == "foreign_key_constraint" and name == "fk_profiles_auth_users":
        return False
    return True

def run_migrations_offline() -> None:
    url = get_url()
    version_table_schema = config.get_main_option("version_table_schema")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        version_table_schema=version_table_schema,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    url = get_url()
    configuration["sqlalchemy.url"] = url
    version_table_schema = config.get_main_option("version_table_schema")

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            version_table_schema=version_table_schema,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
