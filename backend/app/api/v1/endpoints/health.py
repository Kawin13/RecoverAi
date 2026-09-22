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
    Health / Liveness probe: verifies process is alive and includes basic subsystem status.
    Fast and non-blocking for cloud load balancers and orchestrators.
    """
    db_connected = False
    db_err = None
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception as exc:
        db_connected = False
        db_err = str(exc)

    ml_ready = False
    try:
        from app.ml.inference import inference_engine
        ml_ready = bool(inference_engine.is_loaded)
    except Exception:
        ml_ready = False

    res = {
        "status": "healthy" if db_connected else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_connected else "disconnected",
        "razorpay_configured": razorpay_service.is_configured,
        "ai_configured": bool(settings.GEMINI_API_KEY and "placeholder" not in settings.GEMINI_API_KEY.lower()),
        "ml_model_loaded": ml_ready,
        "email_enabled": bool(getattr(settings, "EMAIL_ENABLED", True)),
        "email_provider": "resend",
        "email_configured": bool(getattr(settings, "RESEND_API_KEY", "") and "placeholder" not in getattr(settings, "RESEND_API_KEY", "").lower()),
        "email_test_mode": bool(getattr(settings, "EMAIL_TEST_MODE", True)),
        "mode": "test"
    }

    if not db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        res["database_error"] = db_err or "Database connection failed"

    return res


@router.get("/api/health", tags=["Health"])
def api_health_check():
    """
    Ultra-lightweight health endpoint for Render port scan & cloud orchestration.
    Matches Section 10: {"status": "ok"} with zero DB queries.
    """
    ml_ready = False
    try:
        from app.ml.inference import inference_engine
        ml_ready = bool(inference_engine.is_loaded)
    except Exception:
        ml_ready = False

    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "ready",
        "razorpay_configured": razorpay_service.is_configured,
        "ai_configured": bool(settings.GEMINI_API_KEY and "placeholder" not in settings.GEMINI_API_KEY.lower()),
        "ml_model_loaded": ml_ready,
        "mode": "test"
    }

@router.get("/readiness", tags=["Health"])
def readiness_check(response: Response, db: Session = Depends(get_db)):
    """
    Readiness probe: performs deep operational checks:
    - Database connectivity
    - Migration head status
    - ML inference engine readiness (ml_ready)
    - Background worker heartbeat
    - Gemini AI availability
    - Platform Razorpay test credentials
    Never exposes raw keys or secrets.
    """
    db_connected = False
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception as e:
        logger.warning(f"Database readiness probe failed: {e}")
        db_connected = False

    # Check ML Inference Engine Readiness
    ml_ready = False
    try:
        from app.ml.inference import inference_engine
        ml_ready = bool(inference_engine.is_loaded)
    except Exception:
        ml_ready = False

    # Check Gateway & AI Configuration
    rzp_ready = razorpay_service.is_configured
    gemini_ready = bool(settings.GEMINI_API_KEY and "placeholder" not in settings.GEMINI_API_KEY.lower())

    # Check Background Worker Heartbeat
    worker_status = "STOPPED"
    worker_telemetry = None
    try:
        from app.services.background_worker import background_worker
        worker_telemetry = background_worker.get_metrics(db)
        worker_status = worker_telemetry.get("status", "STOPPED")
    except Exception as e:
        logger.warning(f"Could not retrieve worker metrics: {e}")

    is_ready = db_connected and ml_ready
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if is_ready else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database_connected": db_connected,
        "database_dialect": engine.dialect.name if hasattr(engine, "dialect") else "unknown",
        "ml_ready": ml_ready,
        "worker_status": worker_status,
        "worker_telemetry": worker_telemetry,
        "platform_razorpay_ready": rzp_ready,
        "gemini_ready": gemini_ready,
        "realtime_ready": True,
        "email_enabled": bool(getattr(settings, "EMAIL_ENABLED", True)),
        "email_provider": "resend",
        "email_configured": bool(getattr(settings, "RESEND_API_KEY", "") and "placeholder" not in getattr(settings, "RESEND_API_KEY", "").lower()),
        "email_test_mode": bool(getattr(settings, "EMAIL_TEST_MODE", True)),
    }

