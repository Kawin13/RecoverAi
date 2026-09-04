import logging
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.database.session import get_db, engine
from app.services.razorpay_service import razorpay_service

logger = logging.getLogger("recoverai")
router = APIRouter()


@router.get("/health", tags=["Health"])
def health_check(response: Response, db: Session = Depends(get_db)):
    """
    Actively checks service health, live database connectivity, gateway configuration,
    and ML inference engine readiness.
    Reports operational status without exposing sensitive keys or tokens.
    """
    db_status = "connected"
    overall_status = "healthy"
    db_error = None

    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.warning(f"Database health check probe failed: {e}")
        db_status = "disconnected"
        overall_status = "degraded"
        db_error = "Database temporarily unreachable"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    # Check ML Inference Engine Readiness (verifies all genuine XGBoost model artifacts)
    ml_loaded = False
    try:
        from app.ml.inference import inference_engine
        ml_loaded = bool(inference_engine.is_loaded)
    except Exception:
        ml_loaded = False

    # Check Gateway & AI Configuration flags (Safe Booleans only, never secrets)
    rzp_configured = razorpay_service.is_configured
    ai_configured = bool(settings.GEMINI_API_KEY and not "placeholder" in settings.GEMINI_API_KEY.lower())

    res = {
        "status": overall_status,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "database_type": engine.dialect.name if hasattr(engine, "dialect") else "unknown",
        "razorpay_configured": rzp_configured,
        "ai_configured": ai_configured,
        "ml_model_loaded": ml_loaded,
    }

    if db_error:
        res["database_error"] = db_error

    return res
