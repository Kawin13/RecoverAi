import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.core.config import settings

def run_live_migration():
    db_url = settings.DATABASE_URL
    print(f"Connecting to database: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        with open("app/database/migrations/rbac_profiles.sql", "r", encoding="utf-8") as f:
            sql = f.read()
        conn.execute(text(sql))
        conn.commit()
        print("Live database migration completed successfully!")

if __name__ == "__main__":
    run_live_migration()
