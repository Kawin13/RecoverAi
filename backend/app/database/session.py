from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.logging import logger

db_url = settings.get_effective_database_url()

# Configure engine with SQLite compatibility and cloud timeout safeguards
connect_args = {}
engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL timeout prevents indefinite network hangs on cloud cold boots
    connect_args = {"connect_timeout": 5}
    engine_kwargs.update({
        "pool_timeout": 5,
        "pool_recycle": 300
    })

try:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        **engine_kwargs
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
