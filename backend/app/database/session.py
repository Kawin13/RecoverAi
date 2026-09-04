from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.logging import logger

db_url = settings.get_effective_database_url()

# Configure engine with SQLite compatibility if using sqlite
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(
        db_url,
        echo=False,
        connect_args=connect_args,
        pool_pre_ping=True
    )
    logger.info(f"Database engine initialized with target: {db_url.split('@')[-1] if '@' in db_url else db_url}")
except Exception as e:
    if str(settings.ENVIRONMENT).lower() == "production":
        logger.critical(f"FATAL: Failed to connect to production database ({e}). SQLite fallback is forbidden.")
        raise RuntimeError(
            f"FATAL: Failed to connect to production database ({e}). "
            f"SQLite fallback is strictly prohibited in production."
        )
    logger.warning(f"Failed to initialize primary database engine ({e}). Falling back to SQLite for development.")
    engine = create_engine(
        settings.SQLITE_FALLBACK_URL,
        echo=False,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
