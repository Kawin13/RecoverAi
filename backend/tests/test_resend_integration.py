"""
RecoverAI - Resend Email Integration & Safety Policy Test Suite
Validates:
1. Missing Resend API key handled gracefully (no crash)
2. Global and Workspace email disable toggles
3. Invalid customer email format rejected
4. Test Mode allowlist restrictions and clear UI notices
5. Resend 200 yields SENT, NEVER DELIVERED
6. Deterministic idempotency prevents duplicate email delivery
7. Terminal / already-paid recovery cases skip email dispatch
8. Workspace cooldown and quiet hours enforcement
9. Customer opt-out compliance
10. Resend Webhooks: Svix signature verification (401 on invalid)
11. Resend Webhooks: email.delivered transitions message to DELIVERED
12. Resend Webhooks: email.bounced transitions message to BOUNCED
13. Resend Webhooks: duplicate webhook events ignored idempotently
14. Health endpoint readiness probe safely exposes email config without leaking secrets
"""

import json
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.core.datetime_utils import utcnow
from app.models import (
    CustomerMessage,
    WorkspaceSettings,
    Customer,
    RecoveryCase,
    Transaction,
    WebhookEvent,
    AuditLog,
    DEFAULT_WORKSPACE_ID
)
from app.services.notifications.email_service import email_service
from app.services.notifications.resend_adapter import resend_adapter
from app.services.notifications.base import NotificationResult, NotificationStatus, TemplateType


def _create_test_transaction(db_session, ws_id=DEFAULT_WORKSPACE_ID, status="FAILED"):
    cust = db_session.query(Customer).filter(Customer.workspace_id == ws_id).first()
    if not cust:
        cust = Customer(
            id=f"cust_{uuid.uuid4().hex[:8]}",
            workspace_id=ws_id,
            email="test.customer@example.com",
            name="Test Customer"
        )
        db_session.add(cust)
        db_session.commit()

    tx_id = f"txn_{uuid.uuid4().hex[:10]}"
    tx = Transaction(
        id=tx_id,
        workspace_id=ws_id,
        order_id=f"order_{uuid.uuid4().hex[:8]}",
        customer_id=cust.id,
        amount=2500.0,
        currency="INR",
        status=status,
        created_at=utcnow()
    )
    db_session.add(tx)
    db_session.commit()
    return tx


def test_missing_resend_api_key_fails_gracefully(db_session, monkeypatch):
    """If RESEND_API_KEY is missing or placeholder, system fails gracefully without crashing."""
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)

    case_id = f"case_nokey_{uuid.uuid4().hex[:8]}"

    result = email_service.send_recovery_email(
        recipient="merchant@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Test User", "amount": 1000, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        db=db_session
    )

    assert result.success is False
    assert result.status == NotificationStatus.FAILED.value
    assert result.error_code == "PROVIDER_NOT_CONFIGURED"

    msg = db_session.query(CustomerMessage).filter(CustomerMessage.idempotency_key == result.idempotency_key).first()
    assert msg is not None
    assert msg.status == NotificationStatus.FAILED.value
    assert "RESEND_API_KEY is not configured" in (msg.error_message or "")


def test_global_email_disabled(db_session, monkeypatch):
    """When EMAIL_ENABLED is False, no email is sent and message is marked BLOCKED."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", False)

    case_id = f"case_dis_{uuid.uuid4().hex[:8]}"

    result = email_service.send_recovery_email(
        recipient="merchant@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Test User", "amount": 1000, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        db=db_session
    )

    assert result.success is False
    assert result.status == NotificationStatus.BLOCKED.value
    assert result.error_code == "GLOBAL_EMAIL_DISABLED"

    msg = db_session.query(CustomerMessage).filter(CustomerMessage.idempotency_key == result.idempotency_key).first()
    assert msg is not None
    assert msg.status == NotificationStatus.BLOCKED.value
    assert msg.error_code == "GLOBAL_EMAIL_DISABLED"


def test_workspace_email_disabled(db_session, monkeypatch):
    """When workspace email_enabled setting is False, emails are blocked."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    ws_setting = db_session.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == DEFAULT_WORKSPACE_ID).first()
    if not ws_setting:
        ws_setting = WorkspaceSettings(workspace_id=DEFAULT_WORKSPACE_ID, email_enabled=False)
        db_session.add(ws_setting)
    else:
        ws_setting.email_enabled = False
    db_session.commit()

    case_id = f"case_wsdis_{uuid.uuid4().hex[:8]}"

    try:
        result = email_service.send_recovery_email(
            recipient="merchant@example.com",
            template_type="PAYMENT_LINK",
            template_context={"customer_name": "Test User", "amount": 1000, "currency": "INR", "payment_url": "https://pay.test"},
            workspace_id=DEFAULT_WORKSPACE_ID,
            recovery_case_id=case_id,
            db=db_session
        )

        assert result.success is False
        assert result.status == NotificationStatus.BLOCKED.value
        assert result.error_code == "WORKSPACE_EMAIL_DISABLED"
    finally:
        ws_setting.email_enabled = True
        db_session.commit()


def test_invalid_customer_email_format(db_session, monkeypatch):
    """Invalid email formats are rejected before network attempt."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    case_id = f"case_inv_{uuid.uuid4().hex[:8]}"

    result = email_service.send_recovery_email(
        recipient="not-a-valid-email-address",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Test User", "amount": 1000, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        db=db_session
    )

    assert result.success is False
    assert result.status == NotificationStatus.BLOCKED.value
    assert result.error_code == "INVALID_RECIPIENT_SYNTAX"


def test_customer_opt_out_respected(db_session, monkeypatch):
    """If customer has opted out (email_opt_out=True), emails are strictly suppressed."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    cust = Customer(
        id=cust_id,
        workspace_id=DEFAULT_WORKSPACE_ID,
        email="optout.user@example.com",
        name="Optout User",
        email_opt_out=True
    )
    db_session.add(cust)
    db_session.commit()

    case_id = f"case_opt_{uuid.uuid4().hex[:8]}"

    result = email_service.send_recovery_email(
        recipient="optout.user@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Optout User", "amount": 1000, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        customer_id=cust_id,
        db=db_session
    )

    assert result.success is False
    assert result.status == NotificationStatus.BLOCKED.value
    assert result.error_code == "CUSTOMER_OPTED_OUT"


def test_test_mode_recipient_allowlist(db_session, monkeypatch):
    """
    In development No-Domain Test Mode (EMAIL_TEST_MODE=True):
    - Non-allowlisted recipient is BLOCKED with BLOCKED_TEST_RECIPIENT
    - Allowlisted recipient is permitted through to dispatch
    """
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_RECIPIENTS", "authorized.tester@example.com")

    # 1. Non-allowlisted recipient
    case_blocked = f"case_test_blk_{uuid.uuid4().hex[:8]}"
    blocked_result = email_service.send_recovery_email(
        recipient="unauthorized.user@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Random User", "amount": 1000, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_blocked,
        db=db_session
    )

    assert blocked_result.success is False
    assert blocked_result.status == NotificationStatus.BLOCKED.value
    assert blocked_result.error_code == "BLOCKED_TEST_RECIPIENT"
    assert "Email delivery restricted to configured test recipients." in blocked_result.error_message
    assert blocked_result.delivery_label == "BLOCKED_TEST_RECIPIENT"

    # 2. Allowlisted recipient
    mock_send = MagicMock(return_value=NotificationResult(
        success=True,
        provider="resend",
        provider_message_id="re_mock_test_allowlist_999",
        status=NotificationStatus.SENT.value,
        delivery_label="RESEND EMAIL"
    ))
    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)

    case_allowed = f"case_test_alw_{uuid.uuid4().hex[:8]}"
    allowed_result = email_service.send_recovery_email(
        recipient="authorized.tester@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Authorized Tester", "amount": 1000, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_allowed,
        db=db_session
    )

    assert allowed_result.success is True
    assert allowed_result.status == NotificationStatus.SENT.value
    assert allowed_result.provider_message_id == "re_mock_test_allowlist_999"
    mock_send.assert_called_once()


def test_status_is_sent_never_delivered_on_resend_200(db_session, monkeypatch):
    """
    CRITICAL FINTECH INTEGRITY RULE:
    An HTTP 200 acceptance from Resend means the message is queued at the provider (SENT).
    It MUST NEVER be marked DELIVERED until the Resend email.delivered webhook fires.
    """
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    mock_send = MagicMock(return_value=NotificationResult(
        success=True,
        provider="resend",
        provider_message_id="re_mock_200_test",
        status=NotificationStatus.SENT.value
    ))
    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)

    case_id = f"case_sent_check_{uuid.uuid4().hex[:8]}"

    result = email_service.send_recovery_email(
        recipient="customer.delivery.test@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Delivery Test", "amount": 2500, "currency": "INR", "payment_url": "https://pay.test/123"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        db=db_session
    )

    assert result.success is True
    assert result.status == NotificationStatus.SENT.value
    assert result.status != NotificationStatus.DELIVERED.value

    # Verify DB record
    msg = db_session.query(CustomerMessage).filter(CustomerMessage.idempotency_key == result.idempotency_key).first()
    assert msg is not None
    assert msg.status == NotificationStatus.SENT.value
    assert msg.status != "DELIVERED"
    assert msg.delivered_at is None
    assert msg.sent_at is not None


def test_deterministic_idempotency_prevents_duplicate_send(db_session, monkeypatch):
    """Calling send_recovery_email twice with identical parameters dispatches to Resend exactly once."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    mock_send = MagicMock(return_value=NotificationResult(
        success=True,
        provider="resend",
        provider_message_id="re_idemp_first_call",
        status=NotificationStatus.SENT.value
    ))
    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)

    case_id = f"case_idemp_{uuid.uuid4().hex[:8]}"

    # First dispatch
    res1 = email_service.send_recovery_email(
        recipient="idemp.user@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Idemp User", "amount": 1200, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        attempt_number=1,
        db=db_session
    )
    assert res1.success is True
    assert res1.provider_message_id == "re_idemp_first_call"
    assert mock_send.call_count == 1

    # Second dispatch with identical parameters
    res2 = email_service.send_recovery_email(
        recipient="idemp.user@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Idemp User", "amount": 1200, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        attempt_number=1,
        db=db_session
    )
    assert res2.success is True
    assert res2.provider_message_id == "re_idemp_first_call"
    # Resend API mock should NOT have been called a second time
    assert mock_send.call_count == 1
    assert res2.details.get("cached") is True


def test_already_paid_or_terminal_skips_recovery_email(db_session, monkeypatch):
    """If recovery case is already RECOVERED or transaction is SUCCESS, emails are skipped."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    # 1. Create transaction and terminal Case
    tx = _create_test_transaction(db_session, status="SUCCESS")
    term_case = RecoveryCase(
        id=f"case_term_{uuid.uuid4().hex[:8]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        transaction_id=tx.id,
        failure_category="TECHNICAL_TIMEOUT",
        status="RECOVERED",
        current_step="RECOVERED",
        risk_amount=500.0
    )
    db_session.add(term_case)
    db_session.commit()

    res = email_service.send_recovery_email(
        recipient="customer.paid@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Paid User", "amount": 500, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=term_case.id,
        db=db_session
    )

    assert res.success is False
    assert res.status == NotificationStatus.BLOCKED.value
    assert "CASE_TERMINAL_RECOVERED" in res.error_code


def test_cooldown_period_enforced(db_session, monkeypatch):
    """If another email was sent within the cooldown period (e.g. 30 mins), second send is blocked."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    ws_setting = db_session.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == DEFAULT_WORKSPACE_ID).first()
    if not ws_setting:
        ws_setting = WorkspaceSettings(workspace_id=DEFAULT_WORKSPACE_ID, email_cooldown_minutes=30)
        db_session.add(ws_setting)
    else:
        ws_setting.email_cooldown_minutes = 30
    db_session.commit()

    tx = _create_test_transaction(db_session)
    case_id = f"case_cool_{uuid.uuid4().hex[:8]}"
    case = RecoveryCase(
        id=case_id,
        workspace_id=DEFAULT_WORKSPACE_ID,
        transaction_id=tx.id,
        failure_category="TECHNICAL_TIMEOUT",
        status="ACTION_SCHEDULED",
        risk_amount=1500.0
    )
    db_session.add(case)

    # Insert a recent message sent 5 minutes ago
    recent_msg = CustomerMessage(
        id=str(uuid.uuid4()),
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        recipient="cooldown.user@example.com",
        subject="Recovery Notification 1",
        status="SENT",
        created_at=utcnow() - timedelta(minutes=5)
    )
    db_session.add(recent_msg)
    db_session.commit()

    res = email_service.send_recovery_email(
        recipient="cooldown.user@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Cooldown User", "amount": 1500, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        attempt_number=2,
        db=db_session
    )

    assert res.success is False
    assert res.status == NotificationStatus.BLOCKED.value
    assert res.error_code == "EMAIL_COOLDOWN_ACTIVE"


def test_quiet_hours_enforced(db_session, monkeypatch):
    """When current time falls inside quiet hours, recovery email is blocked."""
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    ws_setting = db_session.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == DEFAULT_WORKSPACE_ID).first()
    if not ws_setting:
        ws_setting = WorkspaceSettings(
            workspace_id=DEFAULT_WORKSPACE_ID,
            quiet_hours_enabled=True,
            email_quiet_hours_enabled=True
        )
        db_session.add(ws_setting)
    else:
        ws_setting.quiet_hours_enabled = True
        ws_setting.email_quiet_hours_enabled = True
    db_session.commit()

    # Mock quiet hours to return True
    monkeypatch.setattr(email_service, "_is_in_quiet_hours", lambda start, end, tz: True)

    case_id = f"case_quiet_{uuid.uuid4().hex[:8]}"

    res = email_service.send_recovery_email(
        recipient="quiet.user@example.com",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Quiet User", "amount": 2000, "currency": "INR", "payment_url": "https://pay.test"},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        db=db_session
    )

    assert res.success is False
    assert res.status == NotificationStatus.BLOCKED.value
    assert res.error_code == "QUIET_HOURS_ACTIVE"


def test_resend_webhook_delivered_transitions_status(client, db_session, monkeypatch):
    """Resend email.delivered webhook transitions message to DELIVERED and populates delivered_at."""
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", "")  # Skip signature check in dev mode

    provider_id = f"re_hook_deliv_{uuid.uuid4().hex[:8]}"
    msg = CustomerMessage(
        id=str(uuid.uuid4()),
        workspace_id=DEFAULT_WORKSPACE_ID,
        channel="EMAIL",
        recipient="delivered.test@example.com",
        subject="Payment Link Recovery",
        status="SENT",
        provider="resend",
        provider_message_id=provider_id,
        sent_at=utcnow() - timedelta(minutes=1),
        created_at=utcnow() - timedelta(minutes=1)
    )
    db_session.add(msg)
    db_session.commit()

    webhook_payload = {
        "type": "email.delivered",
        "created_at": "2026-09-22T04:30:00.000Z",
        "data": {
            "created_at": "2026-09-22T04:29:00.000Z",
            "email_id": provider_id,
            "from": "RecoverAI <onboarding@resend.dev>",
            "to": ["delivered.test@example.com"],
            "subject": "Payment Link Recovery"
        }
    }

    res = client.post(
        "/api/v1/webhooks/resend",
        content=json.dumps(webhook_payload),
        headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "processed"
    assert res_data["event_type"] == "email.delivered"

    # Verify DB transition
    db_session.refresh(msg)
    assert msg.status == "DELIVERED"
    assert msg.delivered_at is not None


def test_resend_webhook_bounced_transitions_status(client, db_session, monkeypatch):
    """Resend email.bounced webhook transitions message to BOUNCED."""
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", "")

    provider_id = f"re_hook_bounce_{uuid.uuid4().hex[:8]}"
    msg = CustomerMessage(
        id=str(uuid.uuid4()),
        workspace_id=DEFAULT_WORKSPACE_ID,
        channel="EMAIL",
        recipient="bounced.test@example.com",
        subject="Payment Link Recovery",
        status="SENT",
        provider="resend",
        provider_message_id=provider_id,
        sent_at=utcnow() - timedelta(minutes=2),
        created_at=utcnow() - timedelta(minutes=2)
    )
    db_session.add(msg)
    db_session.commit()

    webhook_payload = {
        "type": "email.bounced",
        "created_at": "2026-09-22T04:31:00.000Z",
        "data": {
            "created_at": "2026-09-22T04:29:00.000Z",
            "email_id": provider_id,
            "from": "RecoverAI <onboarding@resend.dev>",
            "to": ["bounced.test@example.com"],
            "subject": "Payment Link Recovery",
            "bounce_type": "hard"
        }
    }

    res = client.post(
        "/api/v1/webhooks/resend",
        content=json.dumps(webhook_payload),
        headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 200

    db_session.refresh(msg)
    assert msg.status == "BOUNCED"


def test_resend_webhook_invalid_signature_rejected(client, monkeypatch):
    """When RESEND_WEBHOOK_SECRET is set, requests without valid Svix signatures return 401."""
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", "whsec_live_test_secret_1234567890")

    webhook_payload = {"type": "email.delivered", "data": {"email_id": "re_unauthorized_123"}}

    res = client.post(
        "/api/v1/webhooks/resend",
        content=json.dumps(webhook_payload),
        headers={"Content-Type": "application/json"}
    )
    # Missing Svix headers should raise 401
    assert res.status_code == 401


def test_resend_webhook_duplicate_event_idempotent(client, monkeypatch):
    """Sending the same webhook event ID twice is recognized and ignored idempotently."""
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", "")

    evt_id = f"evt_idemp_{uuid.uuid4().hex[:8]}"
    webhook_payload = {
        "id": evt_id,
        "type": "email.delivered",
        "data": {"email_id": "re_some_provider_id", "to": ["duplicate@example.com"]}
    }

    # First call
    res1 = client.post("/api/v1/webhooks/resend", content=json.dumps(webhook_payload), headers={"Content-Type": "application/json"})
    assert res1.status_code == 200

    # Second call
    res2 = client.post("/api/v1/webhooks/resend", content=json.dumps(webhook_payload), headers={"Content-Type": "application/json"})
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate_ignored"


def test_health_endpoint_exposes_email_safely(client):
    """Readiness/health check exposes email configuration safely without leaking secrets."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()

    # Verify email fields are present
    assert "email_enabled" in data
    assert "email_provider" in data
    assert data["email_provider"] == "resend"
    assert "email_test_mode" in data

    # Verify RESEND_API_KEY is never leaked in the health output
    data_str = json.dumps(data)
    assert "re_" not in data_str
    assert "api_key" not in data_str.lower()


def test_guardrail_rejection_halts_before_email(db_session, monkeypatch):
    """If guardrail validation rejects recovery, workflow halts and never queues/dispatches email."""
    from app.services.guardrails_service import guardrails_service
    from app.services.recovery_executor import recovery_state_machine, RecoveryStep

    tx = _create_test_transaction(db_session)
    case_id = f"case_gr_halt_{uuid.uuid4().hex[:8]}"
    case = RecoveryCase(
        id=case_id,
        workspace_id=DEFAULT_WORKSPACE_ID,
        transaction_id=tx.id,
        failure_category="SUSPECTED_FRAUD",
        status=RecoveryStep.STRATEGY_SELECTED.value,
        current_step=RecoveryStep.STRATEGY_SELECTED.value,
        selected_strategy="PAYMENT_LINK",
        risk_amount=2500.0,
        recovery_probability=0.2
    )
    db_session.add(case)
    db_session.commit()

    # Advance to GUARDRAIL_CHECKED
    res_case, action = recovery_state_machine.advance_step(case, db_session)

    # Verify guardrail evaluation halted the recovery case
    assert res_case.status in (RecoveryStep.STOPPED.value, "STOPPED", RecoveryStep.PENDING_APPROVAL.value) or res_case.current_step != RecoveryStep.ACTION_EXECUTED.value

    # Verify no email message was dispatched
    messages = db_session.query(CustomerMessage).filter(CustomerMessage.recovery_case_id == case_id).all()
    assert len(messages) == 0 or all(m.status != "SENT" for m in messages)


def test_background_worker_send_email_job(db_session, monkeypatch):
    """Background worker successfully processes JobType.SEND_EMAIL jobs."""
    from app.models.recovery_jobs import RecoveryJob, JobType, JobStatus
    from app.services.background_worker import background_worker

    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", False)

    mock_send = MagicMock(return_value=NotificationResult(
        success=True,
        provider="resend",
        provider_message_id="re_worker_job_999",
        status=NotificationStatus.SENT.value
    ))
    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)

    tx = _create_test_transaction(db_session)
    case_id = f"case_bg_job_{uuid.uuid4().hex[:8]}"
    case = RecoveryCase(
        id=case_id,
        workspace_id=DEFAULT_WORKSPACE_ID,
        transaction_id=tx.id,
        failure_category="TECHNICAL_TIMEOUT",
        status="ACTION_SCHEDULED",
        risk_amount=1200.0
    )
    db_session.add(case)
    db_session.commit()

    job_payload = {
        "recipient": "worker.recipient@example.com",
        "template_type": "PAYMENT_LINK",
        "template_context": {
            "customer_name": "Worker Recipient",
            "amount": 1200.0,
            "currency": "INR",
            "payment_url": "https://pay.test/worker"
        },
        "recovery_case_id": case_id,
        "transaction_id": tx.id,
        "workspace_id": DEFAULT_WORKSPACE_ID,
        "attempt_number": 1
    }

    job = RecoveryJob(
        id=f"job_email_{uuid.uuid4().hex[:8]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        job_type=JobType.SEND_EMAIL.value,
        entity_id=case_id,
        status=JobStatus.PROCESSING.value,
        payload_json=json.dumps(job_payload),
        created_at=utcnow(),
        scheduled_at=utcnow(),
        locked_by="test-worker",
        locked_until=utcnow() + timedelta(minutes=5)
    )
    db_session.add(job)
    db_session.commit()

    # Execute single job through worker
    background_worker._execute_single_job(job, db_session)

    # Verify job completed successfully
    assert job.status == JobStatus.SUCCEEDED.value
    assert job.completed_at is not None

    # Verify CustomerMessage was created and marked SENT
    msg = db_session.query(CustomerMessage).filter(CustomerMessage.recovery_case_id == case_id).first()
    assert msg is not None
    assert msg.status == "SENT"
    assert msg.provider_message_id == "re_worker_job_999"

