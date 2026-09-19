"""
RecoverAI - Autonomous Background Worker & Durable Job Queue
Provides reliable server-side job processing, atomic PostgreSQL/SQLite claims,
bounded exponential backoff retries, crash recovery, and automated cart abandonment scanning.
Runs 24/7 server-side without requiring any active browser session.
"""

import asyncio
import json
import uuid
import traceback
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, text

from app.core.logging import logger
from app.core.datetime_utils import utcnow, diff_seconds
from app.core.events import event_broadcaster
from app.database.session import SessionLocal, engine
from app.models.recovery_jobs import RecoveryJob
from app.models.internal_events import InternalEvent
from app.models.recovery_cases import RecoveryCase
from app.models.checkout_sessions import CheckoutSession
from app.models.audit_logs import AuditLog
from app.services.recovery_executor import recovery_state_machine, RecoveryStep
from app.services.abandonment_service import abandonment_service
from app.services.razorpay_service import razorpay_service

class JobType(str, Enum):
    PROCESS_RECOVERY_CASE = "PROCESS_RECOVERY_CASE"
    SCAN_CART_ABANDONMENT = "SCAN_CART_ABANDONMENT"
    EXECUTE_DELAYED_RETRY = "EXECUTE_DELAYED_RETRY"
    RECONCILE_PAYMENT_LINK = "RECONCILE_PAYMENT_LINK"

class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    RETRY_SCHEDULED = "RETRY_SCHEDULED"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    CANCELLED = "CANCELLED"
    DEAD_LETTER = "DEAD_LETTER"

NON_RETRYABLE_KEYWORDS = [
    "opt_out",
    "opted_out",
    "dnd",
    "fraud",
    "risk_blocked",
    "terminal",
    "permanent_failure",
    "not found",
    "does not exist"
]

class BackgroundWorker:
    """
    Autonomous recovery worker that executes background jobs continuously.
    Maintains crash recovery via locked_until timeouts and atomic row claiming.
    """

    def __init__(self):
        self.worker_id = f"worker_{uuid.uuid4().hex[:8]}"
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.start_time: Optional[datetime] = None
        self.jobs_processed = 0
        self.jobs_succeeded = 0
        self.jobs_failed = 0
        self.last_cart_scan_at: Optional[datetime] = None
        self.cart_scan_interval_seconds = 10
        self.lock_duration_seconds = 120

    def start(self):
        """Starts the autonomous worker loop in the background asyncio event loop."""
        if self.is_running:
            logger.info(f"Worker {self.worker_id} is already running.")
            return

        self.is_running = True
        self.start_time = utcnow()
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"Autonomous Background Worker {self.worker_id} started successfully.")

    async def stop(self):
        """Stops the worker cleanly on server shutdown."""
        if not self.is_running:
            return

        logger.info(f"Shutting down Autonomous Background Worker {self.worker_id}...")
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info(f"Autonomous Background Worker {self.worker_id} stopped cleanly.")

    def enqueue_job(
        self,
        db: Session,
        job_type: str,
        entity_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        scheduled_at: Optional[datetime] = None,
        idempotency_key: Optional[str] = None,
        max_attempts: int = 3,
        backoff_seconds: int = 30,
        initial_backoff_seconds: Optional[int] = None
    ) -> RecoveryJob:
        """
        Atomically enqueues a durable job with deduplication via idempotency_key.
        """
        if initial_backoff_seconds is not None:
            backoff_seconds = initial_backoff_seconds

        now = utcnow()
        sched = scheduled_at or now

        # Deduplication check
        if idempotency_key:
            existing = db.query(RecoveryJob).filter(RecoveryJob.idempotency_key == idempotency_key).first()
            if existing:
                logger.info(f"Idempotent job hit: returning existing job {existing.id} ({job_type})")
                return existing

        # Enforce workspace_id requirement (Phase 21)
        if not workspace_id:
            logger.error(f"[Durable Job] Rejected enqueue for job {job_type}: missing workspace_id.")
            raise ValueError("workspace_id is required to enqueue a recovery job.")

        job = RecoveryJob(
            id=f"job_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace_id,
            job_type=job_type,
            entity_id=entity_id,
            payload_json=json.dumps(payload or {}),
            status=JobStatus.PENDING.value,
            scheduled_at=sched,
            attempt_count=0,
            max_attempts=max_attempts,
            backoff_seconds=backoff_seconds,
            idempotency_key=idempotency_key,
            created_at=now,
            updated_at=now
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        logger.info(f"Enqueued job {job.id} [Type: {job_type}, Entity: {entity_id}] scheduled for {sched.isoformat()}")
        return job

    def reclaim_stale_locks(self, db: Session) -> int:
        """
        Recovers jobs abandoned by worker crashes or timeouts.
        If locked_until has passed and status is PROCESSING, reclaims or dead-letters the job.
        """
        now = utcnow()
        stale_jobs = (
            db.query(RecoveryJob)
            .filter(
                RecoveryJob.status == JobStatus.PROCESSING.value,
                RecoveryJob.locked_until < now
            )
            .all()
        )

        for job in stale_jobs:
            if job.attempt_count >= job.max_attempts:
                job.status = JobStatus.DEAD_LETTER.value
                job.completed_at = now
                job.last_error = f"Worker crash timeout: exceeded max attempts ({job.max_attempts})."
                logger.error(f"Job {job.id} dead-lettered after crash timeout.")
            else:
                job.status = JobStatus.RETRY_SCHEDULED.value
                job.scheduled_at = now + timedelta(seconds=10)
                job.locked_by = None
                job.locked_until = None
                logger.warning(f"Reclaimed stale lock on job {job.id}. Rescheduled for retry.")

        if stale_jobs:
            db.commit()
        return len(stale_jobs)

    _reclaim_stale_locks = reclaim_stale_locks

    def claim_next_jobs(self, db: Session, batch_size: int = 5) -> List[RecoveryJob]:
        """
        Atomically claims ready jobs for this worker instance.
        Uses FOR UPDATE SKIP LOCKED on PostgreSQL, with defensive fallback for SQLite.
        """
        now = utcnow()
        self.reclaim_stale_locks(db)

        # Base query for runnable jobs
        query = (
            db.query(RecoveryJob)
            .filter(
                RecoveryJob.status.in_([JobStatus.PENDING.value, JobStatus.RETRY_SCHEDULED.value]),
                RecoveryJob.scheduled_at <= now,
                or_(RecoveryJob.locked_until == None, RecoveryJob.locked_until < now)
            )
            .order_by(RecoveryJob.scheduled_at.asc())
        )

        # Apply dialect-specific row locking
        dialect_name = engine.dialect.name.lower()
        if "postgres" in dialect_name:
            query = query.with_for_update(skip_locked=True)

        jobs = query.limit(batch_size).all()
        if not jobs:
            return []

        lock_expiry = now + timedelta(seconds=self.lock_duration_seconds)
        claimed_ids = []
        for job in jobs:
            job.status = JobStatus.PROCESSING.value
            job.locked_by = self.worker_id
            job.locked_until = lock_expiry
            job.started_at = now
            job.attempt_count += 1
            job.updated_at = now
            claimed_ids.append(job.id)

        db.commit()
        return jobs

    async def _run_loop(self):
        """Continuous execution loop of the autonomous worker."""
        while self.is_running:
            try:
                await self._tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unhandled error in worker loop: {e}", exc_info=True)

            try:
                await asyncio.sleep(1.5)
            except asyncio.CancelledError:
                break

    async def _tick(self):
        """Single tick iteration: checks scheduled periodic tasks and executes queued jobs."""
        now = utcnow()

        # 1. Periodic Cart Inactivity Scanner
        if (
            self.last_cart_scan_at is None
            or diff_seconds(now, self.last_cart_scan_at) >= self.cart_scan_interval_seconds
        ):
            self.last_cart_scan_at = now
            await asyncio.to_thread(self._run_cart_abandonment_scan)

        # 2. Claim and process ready jobs
        claimed_jobs = await asyncio.to_thread(self._claim_and_process_batch)
        if claimed_jobs:
            logger.debug(f"Worker {self.worker_id} processed {len(claimed_jobs)} jobs in current tick.")

    def _claim_and_process_batch(self) -> List[str]:
        """Claims a batch of jobs in a thread-safe database session and dispatches each."""
        db = SessionLocal()
        processed_ids = []
        try:
            jobs = self.claim_next_jobs(db, batch_size=5)
            for job in jobs:
                self._execute_single_job(job, db)
                processed_ids.append(job.id)
                self.jobs_processed += 1
        finally:
            db.close()
        return processed_ids

    def process_next_job(self, db: Session) -> bool:
        """Claims and executes a single ready job synchronously. Returns True if a job was processed."""
        jobs = self.claim_next_jobs(db, batch_size=1)
        if not jobs:
            return False
        self._execute_single_job(jobs[0], db)
        self.jobs_processed += 1
        return True

    _process_next_job = process_next_job

    def _dispatch_job(self, job: RecoveryJob, payload: Dict[str, Any], db: Session):
        """Dispatches job execution to the specific handler based on job_type."""
        now = utcnow()
        if job.job_type == JobType.PROCESS_RECOVERY_CASE.value:
            self._handle_process_recovery_case(job, payload, db)
        elif job.job_type == JobType.SCAN_CART_ABANDONMENT.value:
            self._handle_scan_cart_abandonment(job, payload, db)
        elif job.job_type == JobType.EXECUTE_DELAYED_RETRY.value:
            self._handle_delayed_retry(job, payload, db)
        elif job.job_type == JobType.RECONCILE_PAYMENT_LINK.value:
            self._handle_reconcile_payment_link(job, payload, db)
        else:
            logger.warning(f"Unknown job type '{job.job_type}' for job {job.id}. Marking FAILED.")
            job.status = JobStatus.FAILED.value
            job.completed_at = now
            job.last_error = f"Unknown job type: {job.job_type}"

    def _execute_single_job(self, job: RecoveryJob, db: Session):
        """Executes a single claimed job with bounded error handling and exponential backoff."""
        logger.info(f"Worker {self.worker_id} executing Job {job.id} [Type: {job.job_type}, Entity: {job.entity_id}]")
        now = utcnow()
        payload = json.loads(job.payload_json or "{}")

        try:
            self._dispatch_job(job, payload, db)
            db.commit()
            if job.status == JobStatus.SUCCEEDED.value:
                self.jobs_succeeded += 1

        except Exception as exc:
            db.rollback()
            err_msg = str(exc)
            logger.error(f"Execution failed on Job {job.id} ({job.job_type}): {err_msg}", exc_info=True)
            self.jobs_failed += 1

            # Refresh job row after rollback
            job = db.query(RecoveryJob).filter(RecoveryJob.id == job.id).first()
            if not job:
                return

            now = utcnow()
            is_non_retryable = any(k in err_msg.lower() for k in NON_RETRYABLE_KEYWORDS)

            if is_non_retryable or job.attempt_count >= job.max_attempts:
                job.status = JobStatus.DEAD_LETTER.value
                job.completed_at = now
                job.last_error = f"{'Non-retryable policy failure' if is_non_retryable else 'Max retry attempts exceeded'}: {err_msg}"
                job.locked_by = None
                job.locked_until = None

                # Record audit log for dead-lettered job
                db.add(
                    AuditLog(
                        id=f"aud_dl_{uuid.uuid4().hex[:8]}",
                        workspace_id=job.workspace_id,
                        recovery_case_id=job.entity_id if job.job_type == JobType.PROCESS_RECOVERY_CASE.value else None,
                        actor="AUTONOMOUS_WORKER",
                        action_type="JOB_DEAD_LETTERED",
                        target_resource=job.id,
                        details=f"Background job {job.id} permanently failed: {job.last_error}",
                        created_at=now
                    )
                )
            else:
                # Exponential backoff: min(300, backoff * 2^(attempts-1))
                backoff = min(300, job.backoff_seconds * (2 ** max(0, job.attempt_count - 1)))
                job.status = JobStatus.RETRY_SCHEDULED.value
                job.scheduled_at = now + timedelta(seconds=backoff)
                job.last_error = err_msg
                job.locked_by = None
                job.locked_until = None
                logger.info(f"Job {job.id} rescheduled for retry {job.attempt_count}/{job.max_attempts} in {backoff}s.")

            db.commit()

    def _handle_process_recovery_case(self, job: RecoveryJob, payload: Dict[str, Any], db: Session):
        """
        Executes the autonomous recovery pipeline on a case server-side:
        Ingestion -> Diagnosis -> ML scoring -> ERV optimization -> Guardrails -> Action Execution.
        Pauses safely at WAITING_FOR_APPROVAL if guardrail requires sign-off.
        """
        case_id = job.entity_id
        case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
        if not case:
            raise ValueError(f"Recovery case '{case_id}' does not exist.")

        # If case is already terminal, mark job complete
        if case.status in ("RECOVERED", "STOPPED", "FAILED", "ESCALATED"):
            job.status = JobStatus.SUCCEEDED.value
            job.completed_at = utcnow()
            return

        # Advance state machine continuously until customer wait, terminal state, or approval pause
        max_steps = 10
        steps = 0
        while steps < max_steps:
            steps += 1
            cur_step = case.current_step or case.status or RecoveryStep.DETECTED.value

            if cur_step in (
                RecoveryStep.WAITING_FOR_CUSTOMER.value,
                RecoveryStep.RECOVERED.value,
                RecoveryStep.STOPPED.value,
                RecoveryStep.FAILED.value,
                RecoveryStep.ESCALATED.value
            ):
                break

            case, step_info = recovery_state_machine.advance_step(case, db, is_live_demo=True)
            db.refresh(case)

            # Check if guardrail evaluation placed case into approval queue
            if case.status == RecoveryStep.PENDING_APPROVAL.value:
                job.status = JobStatus.WAITING_FOR_APPROVAL.value
                job.locked_by = None
                job.locked_until = None
                logger.info(f"Job {job.id} paused: Recovery case {case.id} requires human supervisor approval.")

                # Record internal event
                self._record_internal_event(
                    db=db,
                    event_type="GUARDRAIL_REQUIRED",
                    entity_type="recovery_case",
                    entity_id=case.id,
                    workspace_id=str(case.workspace_id),
                    payload={"case_id": case.id, "reason": case.failure_category, "risk_amount": case.risk_amount}
                )
                return

        # If case reached waiting or terminal, job has successfully finished its run
        job.status = JobStatus.SUCCEEDED.value
        job.completed_at = utcnow()
        job.locked_by = None
        job.locked_until = None

        # Emit persistent internal event & real-time telemetry
        self._record_internal_event(
            db=db,
            event_type="ACTION_EXECUTED" if case.status == RecoveryStep.WAITING_FOR_CUSTOMER.value else "RECOVERY_PROCESSED",
            entity_type="recovery_case",
            entity_id=case.id,
            workspace_id=str(case.workspace_id),
            payload={
                "case_id": case.id,
                "strategy": case.selected_strategy,
                "status": case.status,
                "risk_amount": case.risk_amount,
                "channel": case.channel
            }
        )

        event_broadcaster.broadcast_sync(
            "RECOVERY_CASE_UPDATED",
            {
                "case_id": case.id,
                "transaction_id": case.transaction_id,
                "status": case.status,
                "current_step": case.current_step,
                "strategy": case.selected_strategy,
                "risk_amount": case.risk_amount,
                "channel": case.channel,
                "workspace_id": str(case.workspace_id)
            },
            workspace_id=case.workspace_id
        )

        event_broadcaster.broadcast_sync(
            "RECOVERY_AGENT_TRANSITION",
            {
                "case_id": case.id,
                "transaction_id": case.transaction_id,
                "current_step": case.current_step,
                "strategy": case.selected_strategy,
                "status": case.status,
                "risk_amount": case.risk_amount,
                "workspace_id": str(case.workspace_id)
            },
            workspace_id=case.workspace_id
        )

        event_broadcaster.broadcast_sync(
            "DASHBOARD_REFRESH",
            {
                "case_id": case.id,
                "workspace_id": str(case.workspace_id)
            },
            workspace_id=case.workspace_id
        )

    def _handle_scan_cart_abandonment(self, job: RecoveryJob, payload: Dict[str, Any], db: Session):
        """Runs cart timeout scanner and creates recovery cases for inactive carts."""
        timeout_seconds = payload.get("timeout_seconds", 15)
        abandoned_sessions = abandonment_service.check_and_mark_abandoned(db, timeout_seconds=timeout_seconds)

        for s in abandoned_sessions:
            if s.recovery_case_id:
                # Enqueue background recovery for the newly created abandonment case
                self.enqueue_job(
                    db=db,
                    job_type=JobType.PROCESS_RECOVERY_CASE.value,
                    entity_id=s.recovery_case_id,
                    workspace_id=str(s.workspace_id if hasattr(s, "workspace_id") and s.workspace_id else "00000000-0000-0000-0000-000000000001"),
                    idempotency_key=f"abn_job_{s.id}"
                )

        job.status = JobStatus.SUCCEEDED.value
        job.completed_at = utcnow()
        job.locked_by = None
        job.locked_until = None

    def _handle_delayed_retry(self, job: RecoveryJob, payload: Dict[str, Any], db: Session):
        """Executes a scheduled retry when the optimal clearing window arrives."""
        case_id = job.entity_id
        case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
        if not case or case.status in ("RECOVERED", "STOPPED"):
            job.status = JobStatus.SUCCEEDED.value
            job.completed_at = utcnow()
            return

        # Advance case from WAITING_FOR_CUSTOMER to NEXT_STRATEGY or re-attempt
        case.status = RecoveryStep.NEXT_STRATEGY.value
        case.current_step = RecoveryStep.NEXT_STRATEGY.value
        case.attempt_count += 1
        db.commit()

        # Follow with standard pipeline processing
        self._handle_process_recovery_case(job, payload, db)

    def _handle_reconcile_payment_link(self, job: RecoveryJob, payload: Dict[str, Any], db: Session):
        """Actively checks status with Razorpay for an open payment link."""
        from app.services.recovery_executor import sync_case_payment_links
        case_id = job.entity_id
        case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
        if case:
            sync_case_payment_links(case, db)
        job.status = JobStatus.SUCCEEDED.value
        job.completed_at = utcnow()
        job.locked_by = None
        job.locked_until = None

    def _run_cart_abandonment_scan(self):
        """
        Thread worker runner to scan checkout sessions without blocking the event loop.
        Uses PostgreSQL advisory lock for leader safety across multi-instance worker replicas (Phase 23).
        """
        db = SessionLocal()
        dialect_name = engine.dialect.name.lower()
        has_lock = True
        advisory_lock_id = 894210

        if "postgres" in dialect_name:
            try:
                res = db.execute(text(f"SELECT pg_try_advisory_lock({advisory_lock_id});")).scalar()
                has_lock = bool(res)
            except Exception:
                has_lock = True

        if not has_lock:
            db.close()
            return

        try:
            abandoned = abandonment_service.check_and_mark_abandoned(db, timeout_seconds=self.cart_scan_interval_seconds)
            for s in abandoned:
                if s.recovery_case_id:
                    ws_id = str(s.workspace_id) if getattr(s, "workspace_id", None) else None
                    if not ws_id:
                        case = db.query(RecoveryCase).filter(RecoveryCase.id == s.recovery_case_id).first()
                        ws_id = str(case.workspace_id) if case else None
                    if ws_id:
                        self.enqueue_job(
                            db=db,
                            job_type=JobType.PROCESS_RECOVERY_CASE.value,
                            entity_id=s.recovery_case_id,
                            workspace_id=ws_id,
                            idempotency_key=f"auto_abn_{s.id}"
                        )
        except Exception as e:
            logger.warning(f"Notice during automated cart abandonment scan: {e}")
        finally:
            if "postgres" in dialect_name and has_lock:
                try:
                    db.execute(text(f"SELECT pg_advisory_unlock({advisory_lock_id});"))
                except Exception:
                    pass
            db.close()

    def _record_internal_event(
        self,
        db: Session,
        event_type: str,
        entity_type: str,
        entity_id: str,
        workspace_id: str,
        payload: Dict[str, Any]
    ) -> InternalEvent:
        """Helper to log an immutable event in internal_events table scoped to workspace."""
        if not workspace_id:
            logger.error(f"[Internal Event] Missing workspace_id for event {event_type}.")
            raise ValueError("workspace_id is required for internal event logging.")

        evt = InternalEvent(
            id=f"evt_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            idempotency_key=f"{event_type}_{entity_id}_{int(utcnow().timestamp())}",
            processing_status="PROCESSED",
            attempt_count=1,
            payload_json=json.dumps(payload),
            created_at=utcnow(),
            processed_at=utcnow()
        )
        db.add(evt)
        try:
            db.commit()
        except Exception:
            db.rollback()
        return evt

    def get_metrics(self, db: Session) -> Dict[str, Any]:
        """Provides safe operational metrics for /health endpoint."""
        now = utcnow()
        pending = db.query(RecoveryJob).filter(RecoveryJob.status == JobStatus.PENDING.value).count()
        processing = db.query(RecoveryJob).filter(RecoveryJob.status == JobStatus.PROCESSING.value).count()
        retry_sched = db.query(RecoveryJob).filter(RecoveryJob.status == JobStatus.RETRY_SCHEDULED.value).count()
        waiting_appr = db.query(RecoveryJob).filter(RecoveryJob.status == JobStatus.WAITING_FOR_APPROVAL.value).count()
        dead_letter = db.query(RecoveryJob).filter(RecoveryJob.status == JobStatus.DEAD_LETTER.value).count()
        succeeded = db.query(RecoveryJob).filter(RecoveryJob.status == JobStatus.SUCCEEDED.value).count()

        uptime = diff_seconds(now, self.start_time) if self.start_time else 0.0

        return {
            "worker_id": self.worker_id,
            "status": "RUNNING" if self.is_running else "STOPPED",
            "uptime_seconds": round(uptime, 1),
            "jobs_processed_session": self.jobs_processed,
            "jobs_succeeded_session": self.jobs_succeeded,
            "jobs_failed_session": self.jobs_failed,
            "queue_depth": {
                "pending": pending,
                "processing": processing,
                "retry_scheduled": retry_sched,
                "waiting_for_approval": waiting_appr,
                "dead_letter": dead_letter,
                "succeeded": succeeded
            }
        }

background_worker = BackgroundWorker()
