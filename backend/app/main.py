from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.session import engine, SessionLocal
from app.database.base import Base
from app.database.seed import seed_database
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.router import api_router

# Initialize structured logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist and seed database
    logger.info("Initializing RecoverAI database schema and tables...")
    Base.metadata.create_all(bind=engine)

    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(64);"))
                conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(64);"))
                conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);"))
                conn.execute(text("ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(64);"))
                conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS current_step VARCHAR(64) DEFAULT 'DETECTED';"))
                conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;"))
                conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS channel VARCHAR(32) DEFAULT 'IN_APP';"))
                conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;"))
                conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;"))
                conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN IF NOT EXISTS execution_payload TEXT;"))
                conn.commit()
            elif dialect == "sqlite":
                res = conn.execute(text("PRAGMA table_info(transactions);")).fetchall()
                cols = [r[1] for r in res]
                if "razorpay_order_id" not in cols:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN razorpay_order_id VARCHAR(64);"))
                if "razorpay_payment_id" not in cols:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN razorpay_payment_id VARCHAR(64);"))
                if "razorpay_signature" not in cols:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN razorpay_signature VARCHAR(255);"))
                res_pa = conn.execute(text("PRAGMA table_info(payment_attempts);")).fetchall()
                cols_pa = [r[1] for r in res_pa]
                if "gateway_payment_id" not in cols_pa:
                    conn.execute(text("ALTER TABLE payment_attempts ADD COLUMN gateway_payment_id VARCHAR(64);"))
                res_rc = conn.execute(text("PRAGMA table_info(recovery_cases);")).fetchall()
                cols_rc = [r[1] for r in res_rc]
                if "current_step" not in cols_rc:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN current_step VARCHAR(64) DEFAULT 'DETECTED';"))
                if "max_attempts" not in cols_rc:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN max_attempts INTEGER DEFAULT 3;"))
                if "channel" not in cols_rc:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN channel VARCHAR(32) DEFAULT 'IN_APP';"))
                if "scheduled_at" not in cols_rc:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN scheduled_at TIMESTAMP;"))
                if "executed_at" not in cols_rc:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN executed_at TIMESTAMP;"))
                if "execution_payload" not in cols_rc:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN execution_payload TEXT;"))
                conn.commit()
    except Exception as exc:
        logger.warning(f"Schema auto-migration notice: {exc}")
    
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        logger.error(f"Error while running database seed: {e}")
    finally:
        db.close()
        
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
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api/v1")  # Alias for /api/v1

# Direct Root Mounts for Webhooks & SSE Streaming
from app.api.v1.endpoints.webhooks import router as webhooks_root_router
from app.api.v1.endpoints.events import router as events_root_router

app.include_router(webhooks_root_router, prefix="/webhooks", tags=["Razorpay Webhook"])
app.include_router(events_root_router, prefix="/events", tags=["Real-Time Events & SSE"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
