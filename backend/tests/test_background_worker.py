import json
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session

from app.models.recovery_jobs import RecoveryJob
from app.models.internal_events import InternalEvent
from app.models import RecoveryCase, Transaction, Customer, CheckoutSession
from app.services.background_worker import background_worker, BackgroundWorker, JobStatus, JobType
from app.services.guardrails_service import guardrails_service
from app.services.abandonment_service import abandonment_service


@pytest.fixture(autouse=True)
def clean_recovery_jobs(db_session):
    db_session.query(RecoveryJob).delete()
    db_session.commit()
    yield
    db_session.query(RecoveryJob).delete()
    db_session.commit()


def _create_test_customer_and_tx(db: Session, amount: float = 2500.0):
    ws_id = "00000000-0000-0000-0000-000000000001"
    cust_id = f"cust_bw_{uuid.uuid4().hex[:8]}"
    cust = Customer(
        id=cust_id,
        workspace_id=ws_id,
        name="Worker Test User",
        email=f"bw_{uuid.uuid4().hex[:6]}@example.com",
        phone="+919876543210",
        tier="STANDARD"
    )
    db.add(cust)

    tx_id = f"tx_bw_{uuid.uuid4().hex[:8]}"
    tx = Transaction(
        id=tx_id,
        workspace_id=ws_id,
        customer_id=cust_id,
        order_id=f"order_tx_{uuid.uuid4().hex[:8]}",
        amount=amount,
        currency="INR",
        status="FAILED",
        method="Card"
    )
    db.add(tx)
    db.commit()
    db.refresh(cust)
    db.refresh(tx)
    return cust, tx


def test_enqueue_and_process_job_immediate(db_session):
    """Worker picks up an immediate job, claims lock, executes pipeline, and marks COMPLETED."""
    cust, tx = _create_test_customer_and_tx(db_session, amount=1800.0)

    # 1. Create a detected recovery case
    case_id = f"case_bw_{uuid.uuid4().hex[:8]}"
    case = RecoveryCase(
        id=case_id,
        workspace_id=tx.workspace_id,
        transaction_id=tx.id,
        risk_amount=tx.amount,
        failure_category="BANK_TIMEOUT",
        status="DETECTED",
        current_step="DETECTED",
        attempt_count=0,
        max_attempts=3
    )
    db_session.add(case)
    db_session.commit()

    # 2. Enqueue recovery job
    job = background_worker.enqueue_job(
        db=db_session,
        job_type=JobType.PROCESS_RECOVERY_CASE.value,
        entity_id=case.id,
        workspace_id=tx.workspace_id,
        payload={"case_id": case.id},
        idempotency_key=f"rec_case_{case.id}"
    )
    assert job.status == JobStatus.PENDING.value
    assert job.attempt_count == 0

    # 3. Process next job
    processed = background_worker._process_next_job(db_session)
    assert processed is True

    # 4. Verify job status is SUCCEEDED
    db_session.refresh(job)
    assert job.status == JobStatus.SUCCEEDED.value
    assert job.completed_at is not None

    # 5. Verify RecoveryCase transitioned through autonomous pipeline
    db_session.refresh(case)
    assert case.current_step in ("WAITING_FOR_CUSTOMER", "ACTION_EXECUTED", "RECOVERED")
    assert case.selected_strategy is not None

    # 6. Verify InternalEvent audit record exists
    internal_evt = db_session.query(InternalEvent).filter(
        InternalEvent.entity_id == case.id
    ).first()
    assert internal_evt is not None


def test_job_idempotency_prevents_duplicate_enqueue(db_session):
    """Enqueueing a job with an identical idempotency_key must return existing job and not create duplicate."""
    ws_id = "00000000-0000-0000-0000-000000000001"
    idem_key = f"idem_{uuid.uuid4().hex}"

    job1 = background_worker.enqueue_job(
        db=db_session,
        job_type=JobType.PROCESS_RECOVERY_CASE.value,
        entity_id="entity_test_1",
        workspace_id=ws_id,
        payload={"foo": "bar"},
        idempotency_key=idem_key
    )

    job2 = background_worker.enqueue_job(
        db=db_session,
        job_type=JobType.PROCESS_RECOVERY_CASE.value,
        entity_id="entity_test_1",
        workspace_id=ws_id,
        payload={"foo": "bar"},
        idempotency_key=idem_key
    )

    assert job1.id == job2.id

    # Verify only one row exists in DB
    count = db_session.query(RecoveryJob).filter(RecoveryJob.idempotency_key == idem_key).count()
    assert count == 1


def test_exponential_backoff_on_transient_failure(db_session, monkeypatch):
    """When a job handler encounters a transient failure, backoff exponentially."""
    ws_id = "00000000-0000-0000-0000-000000000001"
    job = background_worker.enqueue_job(
        db=db_session,
        job_type="UNKNOWN_TRANSIENT_TEST_TYPE",
        entity_id="fail_entity_1",
        workspace_id=ws_id,
        payload={},
        idempotency_key=f"fail_{uuid.uuid4().hex}",
        max_attempts=3,
        initial_backoff_seconds=10
    )

    # Monkeypatch a simulated transient failure in worker dispatcher
    def _mock_dispatch(job_inst, payload, db):
        raise ConnectionError("Temporary upstream network timeout")

    monkeypatch.setattr(background_worker, "_dispatch_job", _mock_dispatch)

    # Process job -> fails once
    background_worker._process_next_job(db_session)

    db_session.refresh(job)
    assert job.status in (JobStatus.PENDING.value, JobStatus.RETRY_SCHEDULED.value)
    assert job.attempt_count == 1
    assert "Temporary upstream network timeout" in (job.last_error or "")
    sched = job.scheduled_at if job.scheduled_at.tzinfo else job.scheduled_at.replace(tzinfo=timezone.utc)
    assert sched > datetime.now(timezone.utc) - timedelta(seconds=5)


def test_dead_letter_on_max_attempts(db_session, monkeypatch):
    """When a job reaches its max_attempts, transition to dead-letter (FAILED) status."""
    ws_id = "00000000-0000-0000-0000-000000000001"
    job = background_worker.enqueue_job(
        db=db_session,
        job_type="DEAD_LETTER_TEST",
        entity_id="dead_entity_1",
        workspace_id=ws_id,
        payload={},
        idempotency_key=f"dead_{uuid.uuid4().hex}",
        max_attempts=2,
        initial_backoff_seconds=1
    )
    # Set attempt_count to 1 already
    job.attempt_count = 1
    db_session.commit()

    def _mock_dispatch(job_inst, payload, db):
        raise RuntimeError("Terminal unrecoverable error")

    monkeypatch.setattr(background_worker, "_dispatch_job", _mock_dispatch)

    background_worker._process_next_job(db_session)

    db_session.refresh(job)
    assert job.status == JobStatus.DEAD_LETTER.value
    assert job.attempt_count == 2
    assert "Terminal unrecoverable error" in (job.last_error or "")


def test_stale_lock_reclamation(db_session):
    """Stale locked jobs past their locked_until window are reclaimed back to RETRY_SCHEDULED."""
    ws_id = "00000000-0000-0000-0000-000000000001"
    stale_job = RecoveryJob(
        id=f"job_stale_{uuid.uuid4().hex[:8]}",
        workspace_id=ws_id,
        job_type=JobType.PROCESS_RECOVERY_CASE.value,
        entity_id="stale_entity_1",
        payload_json=json.dumps({"test": True}),
        status=JobStatus.PROCESSING.value,
        locked_by="crashed_worker_instance",
        locked_until=datetime.now(timezone.utc) - timedelta(minutes=5),
        scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        attempt_count=1,
        max_attempts=3
    )
    db_session.add(stale_job)
    db_session.commit()

    reclaimed = background_worker._reclaim_stale_locks(db_session)
    assert reclaimed >= 1

    db_session.refresh(stale_job)
    assert stale_job.status in (JobStatus.RETRY_SCHEDULED.value, JobStatus.PENDING.value)
    assert stale_job.locked_by is None
    assert stale_job.locked_until is None


def test_cart_abandonment_scanner(db_session):
    """Scanner detects carts past inactivity threshold, marks ABANDONED, and enqueues recovery job."""
    cust, _ = _create_test_customer_and_tx(db_session, amount=4999.0)
    ws_id = cust.workspace_id
    sess_id = f"chk_bw_{uuid.uuid4().hex[:8]}"
    old_time = datetime.now(timezone.utc) - timedelta(seconds=60)

    checkout = CheckoutSession(
        id=sess_id,
        workspace_id=ws_id,
        customer_id=cust.id,
        order_id=f"order_chk_{uuid.uuid4().hex[:8]}",
        cart_amount=4999.0,
        status="STARTED",
        last_activity_at=old_time,
        started_at=old_time
    )
    db_session.add(checkout)
    db_session.commit()

    # Enqueue and process scan cart abandonment job
    scan_job = background_worker.enqueue_job(
        db=db_session,
        job_type=JobType.SCAN_CART_ABANDONMENT.value,
        entity_id="system_cron",
        workspace_id=ws_id,
        payload={"timeout_seconds": 15},
        idempotency_key=f"scan_{uuid.uuid4().hex}"
    )

    processed = background_worker._process_next_job(db_session)
    assert processed is True

    db_session.refresh(checkout)
    assert checkout.status == "ABANDONED"

    # Verify a PROCESS_RECOVERY_CASE job was enqueued for the abandoned cart
    recovery_job = db_session.query(RecoveryJob).filter(
        RecoveryJob.job_type == JobType.PROCESS_RECOVERY_CASE.value,
        RecoveryJob.entity_id == checkout.recovery_case_id
    ).first()
    assert recovery_job is not None


def test_supervisor_approval_unpauses_case_and_enqueues_job(db_session, monkeypatch):
    """When an approval guardrail is approved, case is unpaused and PROCESS_RECOVERY_CASE job enqueued."""
    from app.services.razorpay_service import razorpay_service
    monkeypatch.setattr(razorpay_service, "create_payment_link", lambda *args, **kwargs: {
        "success": True,
        "payment_link_id": f"plink_mock_{uuid.uuid4().hex[:8]}",
        "short_url": f"https://rzp.io/rzp/mock_{uuid.uuid4().hex[:6]}",
        "amount": 75.0,
        "status": "created",
        "reference_id": f"rcov_mock_{uuid.uuid4().hex[:6]}",
        "created_at": datetime.now(timezone.utc),
        "is_live_demo": True
    })

    cust, tx = _create_test_customer_and_tx(db_session, amount=7500.0)
    ws_id = tx.workspace_id

    case_id = f"case_appr_{uuid.uuid4().hex[:8]}"
    case = RecoveryCase(
        id=case_id,
        workspace_id=ws_id,
        transaction_id=tx.id,
        risk_amount=tx.amount,
        failure_category="GATEWAY_ERROR",
        selected_strategy="PAYMENT_LINK",
        status="WAITING_FOR_APPROVAL",
        current_step="GUARDRAIL_CHECKED",
        attempt_count=0,
        max_attempts=3
    )
    db_session.add(case)
    db_session.commit()

    # Approve the case via guardrails_service
    res = guardrails_service.process_human_approval(
        case=case,
        decision="APPROVE",
        operator_name="Supervisor Admin",
        operator_notes="Approved for high-value recovery execution",
        db=db_session
    )
    assert res.get("decision") == "APPROVE" or res.get("status") == "ACTION_SCHEDULED"

    db_session.refresh(case)
    assert case.status != "WAITING_FOR_APPROVAL"

    # Verify background job was enqueued and ready for worker
    job = db_session.query(RecoveryJob).filter(
        RecoveryJob.job_type == JobType.PROCESS_RECOVERY_CASE.value,
        RecoveryJob.entity_id == case.id
    ).first()
    assert job is not None

    # Process job via worker
    processed = background_worker.process_next_job(db_session)
    assert processed is True

    db_session.refresh(job)
    assert job.status == JobStatus.SUCCEEDED.value
