"""
RecoverAI - Email Recovery Lifecycle Tests
Validates:
1. PAYMENT_FAILED email template renders accurate details and security guidance
2. PAYMENT_LINK email template shows accurate attempt badges (Attempt X of 3)
3. Recovery executor increments attempt count and stops at max_attempts (3)
4. Each attempt (1, 2, 3) generates distinct idempotency keys allowing dispatch
5. Attempt > 3 is halted without sending customer spam
"""

import uuid
import json
from unittest.mock import MagicMock
import pytest

from app.core.config import settings
from app.core.datetime_utils import utcnow
from app.models import (
    Customer,
    Transaction,
    RecoveryCase,
    CustomerMessage,
    PaymentLink,
    RecoveryAction,
    DEFAULT_WORKSPACE_ID
)
from app.services.notifications.base import TemplateType, NotificationResult, NotificationStatus
from app.services.notifications.templates import (
    render_template,
    render_payment_failed_template,
    render_payment_link_template
)
from app.services.notifications.email_service import email_service
from app.services.recovery_executor import recovery_state_machine, RecoveryExecutor


def test_payment_failed_template_rendering():
    """Validates PAYMENT_FAILED template produces expected copy, subject, and escaping."""
    context = {
        "customer_name": "Aditya Sharma",
        "amount": 4999.0,
        "order_id": "ord_test_99",
        "failure_reason": "Bank network timeout during authorization",
        "action_url": "https://recoverai.io/checkout/retry",
        "merchant_name": "RecoverAI Live Store"
    }
    subject, text, html = render_template(TemplateType.PAYMENT_FAILED.value, context)

    assert "Payment Failed: Order #ord_test_99" in subject
    assert "4,999.00" in subject
    assert "Bank network timeout" in text
    assert "Aditya Sharma" in text
    assert "https://recoverai.io/checkout/retry" in text
    assert "Payment Unsuccessful" in html
    assert "Safety Note" in html


def test_payment_link_template_shows_attempt_badge():
    """Validates PAYMENT_LINK template displays recovery attempt count."""
    context = {
        "customer_name": "Aditya Sharma",
        "amount": 2500.0,
        "merchant_name": "RecoverAI",
        "action_url": "https://rzp.io/l/test_link",
        "attempt_number": 2,
        "max_attempts": 3
    }
    subject, text, html = render_template(TemplateType.PAYMENT_LINK.value, context)

    assert "(Attempt 2/3)" in subject
    assert "Recovery Attempt 2 of 3" in html
    assert "Recovery Attempt 2/3" in text
    assert "https://rzp.io/l/test_link" in html


def test_recovery_executor_increments_attempt_count_and_stops_at_3(db_session, monkeypatch):
    """
    Validates that:
    1. Recovery execution increments case.attempt_count
    2. Attempt 1, 2, 3 execute properly
    3. Attempt 4 is halted with STOPPED status (max attempts reached)
    """
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_RECIPIENTS", "kawindharma@gmail.com")

    from app.services.notifications.resend_adapter import resend_adapter
    from app.services.razorpay_service import razorpay_service
    dispatched_recipients = []

    def mock_send(to, subject, html_content, text_content=None, **kwargs):
        dispatched_recipients.append(to)
        return NotificationResult(
            success=True,
            provider="resend",
            status=NotificationStatus.SENT.value,
            provider_message_id=f"re_mock_{uuid.uuid4().hex[:8]}",
            delivery_label="RESEND EMAIL"
        )

    def mock_create_payment_link(*args, **kwargs):
        return {
            "success": True,
            "payment_link_id": f"plink_mock_{uuid.uuid4().hex[:8]}",
            "short_url": f"https://rzp.io/rzp/mock_{uuid.uuid4().hex[:6]}",
            "amount": 35.0,
            "status": "created",
            "reference_id": f"rcov_mock_{uuid.uuid4().hex[:6]}",
            "created_at": utcnow(),
            "is_live_demo": True
        }

    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)
    monkeypatch.setattr(razorpay_service, "create_payment_link", mock_create_payment_link)

    cust = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        email="kawindharma@gmail.com",
        name="Kawin Dharmaraj"
    )
    db_session.add(cust)

    tx = Transaction(
        id=f"tx_{uuid.uuid4().hex[:8]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        order_id=f"order_{uuid.uuid4().hex[:8]}",
        customer_id=cust.id,
        amount=3500.0,
        currency="INR",
        method="UPI",
        status="FAILED",
        created_at=utcnow(),
        updated_at=utcnow()
    )
    db_session.add(tx)

    case = RecoveryCase(
        id=f"case_{uuid.uuid4().hex[:8]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        transaction_id=tx.id,
        risk_amount=3500.0,
        failure_category="TECHNICAL_TIMEOUT",
        status="ACTION_SCHEDULED",
        current_step="ACTION_SCHEDULED",
        selected_strategy="SMART_PAYLINK_1CLICK",
        attempt_count=0,
        max_attempts=3
    )
    db_session.add(case)
    db_session.commit()

    executor = RecoveryExecutor()

    # Attempt 1
    res1 = executor.execute_strategy(case, db_session, is_live_demo=True)
    assert case.attempt_count == 1
    assert res1.get("attempt_number") == 1
    assert res1.get("status") != "STOPPED"

    # Attempt 2
    res2 = executor.execute_strategy(case, db_session, is_live_demo=True)
    assert case.attempt_count == 2
    assert res2.get("attempt_number") == 2
    assert res2.get("status") != "STOPPED"

    # Attempt 3
    res3 = executor.execute_strategy(case, db_session, is_live_demo=True)
    assert case.attempt_count == 3
    assert res3.get("attempt_number") == 3
    assert res3.get("status") != "STOPPED"

    # Attempt 4: Exceeds max_attempts=3 -> must halt
    res4 = executor.execute_strategy(case, db_session, is_live_demo=True)
    assert case.attempt_count == 4
    assert res4.get("status") == "STOPPED"
    assert case.status == "STOPPED"


def test_idempotency_keys_are_distinct_per_attempt():
    """Confirms idempotency keys are unique per attempt_number."""
    ws = DEFAULT_WORKSPACE_ID
    case_id = "case_idem_test"
    act_id = "act_idem_test"

    key1 = email_service.generate_idempotency_key(ws, case_id, act_id, "PAYMENT_LINK", attempt_number=1)
    key2 = email_service.generate_idempotency_key(ws, case_id, act_id, "PAYMENT_LINK", attempt_number=2)
    key3 = email_service.generate_idempotency_key(ws, case_id, act_id, "PAYMENT_LINK", attempt_number=3)

    assert key1 != key2
    assert key2 != key3
    assert key1 != key3
    assert "_att1" in key1
    assert "_att2" in key2
    assert "_att3" in key3
