import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from alembic.config import Config
from alembic import command
from app.core.config import settings

def run_live_migration():
    alembic_ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
    alembic_dir = os.path.join(os.path.dirname(__file__), "alembic")

    cfg = Config(alembic_ini_path)
    cfg.set_main_option("script_location", alembic_dir)

    db_url = settings.get_effective_database_url()
    print(f"Applying Alembic migrations to database: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    command.upgrade(cfg, "head")
    print("Alembic live database migration completed successfully to head!")

if __name__ == "__main__":
    run_live_migration()
