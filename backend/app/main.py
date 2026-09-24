import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.session import engine
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.router import api_router

from app.core.config_validator import validate_startup_config

# Initialize structured logging
setup_logging()
logger.info("BOOT 1: main module imported")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("BOOT 3: lifespan entered")

    # 1. Startup Configuration Validation (Fast, non-blocking check)
    logger.info(f"Validating configuration for environment: {settings.ENVIRONMENT}...")
    validate_startup_config(settings)
    logger.info("BOOT 4: configuration validated")

    # 2. Verify database connectivity (non-blocking for port binding)
    logger.info("Verifying database connectivity...")
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
        logger.info("Database connectivity established successfully.")
    except Exception as exc:
        logger.warning(f"Database connection notice on startup (readiness probe will reflect status): {exc}")
    logger.info("BOOT 5: database initialization complete")

    # 3. ML Model Background Initialization (Does not block Uvicorn port binding)
    try:
        from app.ml.inference import inference_engine
        asyncio.create_task(asyncio.to_thread(inference_engine.ensure_loaded))
        logger.info("ML model background loading task scheduled.")
    except Exception as exc:
        logger.warning(f"ML model background scheduling notice: {exc}")

    # 4. Background Worker (Embedded mode if RUN_BACKGROUND_WORKER=true and not testing)
    is_testing = bool(os.environ.get("PYTEST_CURRENT_TEST") or getattr(settings, "TESTING", False))
    is_prod = str(settings.ENVIRONMENT).lower() == "production"
    should_run_worker = bool(getattr(settings, "RUN_BACKGROUND_WORKER", not is_prod) and not is_testing)

    worker_task = None
    if should_run_worker:
        logger.info("Starting Autonomous Background Recovery Worker (embedded mode)...")
        from app.services.background_worker import background_worker
        worker_task = asyncio.create_task(background_worker._run_loop())
        logger.info("Autonomous Background Recovery Worker task created.")
    else:
        logger.info("Autonomous Background Recovery Worker disabled in web service process.")

    logger.info("BOOT 6: worker scheduling complete")
    logger.info("BOOT 7: startup ready")
    logger.info(f"{settings.PROJECT_NAME} v{settings.VERSION} ready on {settings.ENVIRONMENT} mode.")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")
    if worker_task:
        logger.info("Cancelling embedded background worker task...")
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
        logger.info("Embedded background worker stopped cleanly.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Autonomous AI Revenue Recovery Agent for Digital Payments",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)
logger.info("BOOT 2: FastAPI application created")

# CORS Configuration - Strictly rejects wildcard origin when allow_credentials=True
configured_origins = [orig.strip() for orig in (settings.CORS_ORIGINS or []) if orig.strip() and orig.strip() != "*"]
if settings.FRONTEND_PUBLIC_URL and settings.FRONTEND_PUBLIC_URL.strip() not in configured_origins:
    configured_origins.append(settings.FRONTEND_PUBLIC_URL.strip())
if "https://recover-ai-rho-steel.vercel.app" not in configured_origins:
    configured_origins.append("https://recover-ai-rho-steel.vercel.app")
if not configured_origins:
    configured_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://recover-ai-rho-steel.vercel.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_origin_regex=getattr(settings, "CORS_ORIGIN_REGEX", r"^https:\/\/.*\.vercel\.app$"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OWASP Enterprise Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), usb=()"
    if str(settings.ENVIRONMENT).lower() == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response

# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "details": exc.errors(),
            "body": getattr(exc, "body", None)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your request.",
            "path": request.url.path
        }
    )

# Include Routers
app.include_router(health_router)
app.include_router(health_router, prefix="/api", include_in_schema=False)
# Canonical API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Backward-compatibility alias for legacy /api routes (omitted from schema to prevent duplicate route docs)
if settings.API_V1_STR != "/api":
    app.include_router(api_router, prefix="/api", include_in_schema=False)

# Direct Root Mounts for Webhooks & SSE Streaming
from app.api.v1.endpoints.webhooks import router as webhooks_root_router
from app.api.v1.endpoints.resend_webhooks import router as resend_webhooks_root_router
from app.api.v1.endpoints.events import router as events_root_router

app.include_router(webhooks_root_router, prefix="/webhooks", tags=["Razorpay Webhook"])
app.include_router(resend_webhooks_root_router, prefix="/webhooks", tags=["Resend Email Webhook"])
app.include_router(events_root_router, prefix="/events", tags=["Real-Time Events & SSE"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
