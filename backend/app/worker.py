"""
RecoverAI - Standalone Dedicated Background Worker Process
Run with: python -m app.worker
Handles asynchronous recovery workflows, ML diagnosis, ERV optimization,
guardrail enforcement, and cart abandonment scanning 24/7 without requiring
any browser session or web request.
"""

import sys
import time
import signal
import asyncio
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.services.background_worker import background_worker
from app.database.session import engine

# Setup structured logging
setup_logging()

async def run_worker():
    logger.info(f"Starting RecoverAI Autonomous Dedicated Worker [{settings.ENVIRONMENT}]...")
    
    # 1. Verify database connection
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
        logger.info("Dedicated Worker: Database connectivity verified successfully.")
    except Exception as exc:
        logger.critical(f"Dedicated Worker: Database connectivity failed: {exc}")
        sys.exit(1)

    # 2. Start background worker loop
    background_worker.start()
    logger.info(f"Worker {background_worker.worker_id} active. Awaiting jobs...")

    stop_event = asyncio.Event()

    def handle_shutdown(sig, frame):
        logger.info(f"Received termination signal {sig}. Initiating graceful shutdown...")
        stop_event.set()

    # Register OS signals
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    # Keep alive until shutdown signal
    while not stop_event.is_set():
        await asyncio.sleep(1)

    logger.info("Stopping worker and finishing in-flight tasks...")
    await background_worker.stop()
    logger.info("RecoverAI Dedicated Background Worker exited cleanly.")

if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Worker process terminated.")
