import logging
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.database.session import get_db

logger = logging.getLogger("recoverai")
router = APIRouter()

@router.get("/health", tags=["Health"])
def health_check(response: Response, db: Session = Depends(get_db)):
    """
    Actively checks service health and verifies live database connectivity.
    Gracefully degrades with status 'degraded' if database connection fails.
    """
    db_status = "connected"
    overall_status = "healthy"
    db_error = None

    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.warning(f"Database health check failed: {e}")
        db_status = "disconnected"
        overall_status = "degraded"
        db_error = "Database temporarily unavailable"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    res = {
        "status": overall_status,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status
    }
    if db_error:
        res["database_error"] = db_error

    return res
