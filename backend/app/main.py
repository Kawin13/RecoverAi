from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.session import engine, SessionLocal
from app.database.seed import seed_database
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.router import api_router

from app.core.config_validator import validate_startup_config

# Initialize structured logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup Configuration Validation (Fail-Safe)
    logger.info(f"Validating configuration for environment: {settings.ENVIRONMENT}...")
    validate_startup_config(settings)

    # 2. Verify database connectivity
    logger.info("Verifying database connectivity...")
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
        logger.info("Database connectivity established successfully.")
    except Exception as exc:
        if str(settings.ENVIRONMENT).lower() == "production":
            logger.critical(f"FATAL: Production database connectivity verification failed: {exc}")
            raise RuntimeError(f"FATAL: Production database connectivity verification failed: {exc}")
        logger.warning(f"Database connection notice on startup: {exc}")

    # Seed minimal baseline records if needed (DML only, no DDL modifications)
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        logger.error(f"Error while running database seed: {e}")
    finally:
        db.close()

    # 3. ML Model Startup Validation (Safe status logging & fail-closed production check)
    logger.info("Validating ML model runtime compatibility and artifact loading...")
    try:
        from app.ml.inference import inference_engine
        inference_engine.validate_startup()
    except Exception as exc:
        if str(settings.ENVIRONMENT).lower() == "production":
            logger.critical(f"FATAL: Production ML model startup validation failed: {exc}")
            raise RuntimeError(f"FATAL: Production ML model startup validation failed: {exc}")
        logger.warning(f"ML model startup validation notice: {exc}")
        
    logger.info(f"{settings.PROJECT_NAME} v{settings.VERSION} ready on {settings.ENVIRONMENT} mode.")
    yield
    # Shutdown
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Autonomous AI Revenue Recovery Agent for Digital Payments",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "details": exc.errors(),
            "path": request.url.path
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
# Canonical API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Backward-compatibility alias for legacy /api routes (omitted from schema to prevent duplicate route docs)
if settings.API_V1_STR != "/api":
    app.include_router(api_router, prefix="/api", include_in_schema=False)

# Direct Root Mounts for Webhooks & SSE Streaming
from app.api.v1.endpoints.webhooks import router as webhooks_root_router
from app.api.v1.endpoints.events import router as events_root_router

app.include_router(webhooks_root_router, prefix="/webhooks", tags=["Razorpay Webhook"])
app.include_router(events_root_router, prefix="/events", tags=["Real-Time Events & SSE"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
