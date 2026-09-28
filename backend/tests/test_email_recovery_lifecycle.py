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
import hmac
import hashlib
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


def test_recovery_payment_attempt_failure_increments_and_halts_at_max(client, db_session, monkeypatch):
    """
    Validates end-to-end attempt management:
    1. Initial failure creates RecoveryCase and executes Attempt 1 (attempt_count=1).
    2. Paying using Attempt 1 link fails -> escalates to Attempt 2 (attempt_count=2, NOT resetting to 1).
    3. Paying using Attempt 2 link fails -> escalates to Attempt 3 (attempt_count=3).
    4. Paying using Attempt 3 link fails -> stops at max attempts (3/3), transitions to STOPPED.
    """
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_RECIPIENTS", "kawindharma@gmail.com")

    sent_emails = []
    from app.services.notifications.resend_adapter import resend_adapter
    from app.services.razorpay_service import razorpay_service

    def mock_send(to, subject, html_content, text_content=None, **kwargs):
        sent_emails.append({"to": to, "subject": subject, "html": html_content})
        return NotificationResult(
            success=True,
            provider="resend",
            status=NotificationStatus.SENT.value,
            provider_message_id=f"re_mock_{uuid.uuid4().hex[:8]}",
            delivery_label="RESEND EMAIL"
        )

    def mock_create_payment_link(*args, **kwargs):
        notes = kwargs.get("notes") or {}
        att = notes.get("attempt", "1")
        return {
            "success": True,
            "payment_link_id": f"plink_mock_att{att}_{uuid.uuid4().hex[:6]}",
            "short_url": f"https://rzp.io/rzp/mock_att{att}_{uuid.uuid4().hex[:6]}",
            "amount": 1499.0,
            "status": "created",
            "reference_id": f"rcov_att{att}_{uuid.uuid4().hex[:6]}",
            "created_at": utcnow(),
            "is_live_demo": True
        }

    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)
    monkeypatch.setattr(razorpay_service, "create_payment_link", mock_create_payment_link)

    # 1. Create customer and initial transaction
    cust = Customer(
        id=f"cust_cycle_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        name="Lifecycle Tester",
        email="kawindharma@gmail.com"
    )
    db_session.add(cust)

    tx_init = Transaction(
        id=f"tx_init_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        order_id=f"order_init_{uuid.uuid4().hex[:6]}",
        customer_id=cust.id,
        amount=1499.0,
        currency="INR",
        method="Card",
        status="PENDING"
    )
    db_session.add(tx_init)
    db_session.commit()

    # Step 1: Initial payment fails
    res1 = client.post("/api/payments/fail", json={
        "transaction_id": tx_init.id,
        "order_id": tx_init.order_id,
        "error_code": "CARD_DECLINED",
        "error_description": "Card authorization declined by issuer bank",
        "error_category": "GATEWAY_ERROR"
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "recorded"
    assert data1["escalated_to_agent"] is True
    assert data1["attempt_count"] == 1
    case_id = data1["recovery_case_id"]

    case = db_session.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    assert case is not None
    assert case.attempt_count == 1
    assert case.current_step == "WAITING_FOR_CUSTOMER"

    # Verify Attempt 1 email was sent with Attempt 1 badge
    attempt1_emails = [e for e in sent_emails if "Attempt 1/3" in e["subject"]]
    assert len(attempt1_emails) >= 1

    # Step 2: Customer tries to pay using Attempt 1 link, but payment fails!
    # A new checkout order/transaction was created on the recovery checkout page
    tx_att1 = Transaction(
        id=f"tx_att1_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        order_id=f"order_att1_{uuid.uuid4().hex[:6]}",
        customer_id=cust.id,
        amount=1499.0,
        currency="INR",
        method="UPI",
        status="PENDING"
    )
    db_session.add(tx_att1)
    db_session.commit()

    res2 = client.post("/api/payments/fail", json={
        "transaction_id": tx_att1.id,
        "order_id": tx_att1.order_id,
        "error_code": "UPI_TIMEOUT",
        "error_description": "Customer UPI bank switch timed out",
        "error_category": "TECHNICAL_TIMEOUT",
        "recovery_case_id": case_id
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["recovery_case_id"] == case_id
    assert data2["attempt_count"] == 2
    assert data2["escalated_to_agent"] is True

    db_session.refresh(case)
    assert case.attempt_count == 2
    assert case.current_step == "WAITING_FOR_CUSTOMER"

    # Verify Attempt 2 email was sent with Attempt 2 badge (NOT Attempt 1!)
    attempt2_emails = [e for e in sent_emails if "Attempt 2/3" in e["subject"]]
    assert len(attempt2_emails) >= 1

    # Step 3: Customer tries to pay using Attempt 2 link, but payment fails again!
    tx_att2 = Transaction(
        id=f"tx_att2_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        order_id=f"order_att2_{uuid.uuid4().hex[:6]}",
        customer_id=cust.id,
        amount=1499.0,
        currency="INR",
        method="NetBanking",
        status="PENDING"
    )
    db_session.add(tx_att2)
    db_session.commit()

    res3 = client.post("/api/payments/fail", json={
        "transaction_id": tx_att2.id,
        "order_id": tx_att2.order_id,
        "error_code": "NETBANKING_TIMEOUT",
        "error_description": "Netbanking session expired",
        "error_category": "TECHNICAL_TIMEOUT",
        "recovery_case_id": case_id
    })
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["recovery_case_id"] == case_id
    assert data3["attempt_count"] == 3
    assert data3["escalated_to_agent"] is True

    db_session.refresh(case)
    assert case.attempt_count == 3
    assert case.current_step == "WAITING_FOR_CUSTOMER"

    # Verify Attempt 3 email was sent
    attempt3_emails = [e for e in sent_emails if "Attempt 3/3" in e["subject"]]
    assert len(attempt3_emails) >= 1

    # Step 4: Customer attempts payment on Attempt 3 and fails -> max attempts (3) hit!
    tx_att3 = Transaction(
        id=f"tx_att3_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        order_id=f"order_att3_{uuid.uuid4().hex[:6]}",
        customer_id=cust.id,
        amount=1499.0,
        currency="INR",
        method="Wallet",
        status="PENDING"
    )
    db_session.add(tx_att3)
    db_session.commit()

    res4 = client.post("/api/payments/fail", json={
        "transaction_id": tx_att3.id,
        "order_id": tx_att3.order_id,
        "error_code": "WALLET_DECLINE",
        "error_description": "Wallet balance insufficient",
        "error_category": "INSUFFICIENT_FUNDS",
        "recovery_case_id": case_id
    })
    assert res4.status_code == 200
    data4 = res4.json()
    assert data4["status"] == "stopped"
    assert data4["escalated_to_agent"] is False
    assert data4["attempt_count"] == 3
    assert data4["max_attempts"] == 3

    db_session.refresh(case)
    assert case.status in ("STOPPED", "ESCALATED")
    assert case.attempt_count == 3

    # Ensure no Attempt 4 email was sent
    attempt4_emails = [e for e in sent_emails if "Attempt 4" in e["subject"]]
    assert len(attempt4_emails) == 0


def test_webhook_payment_failed_escalates_recovery_attempt(client, db_session, monkeypatch):
    """
    Validates that a Razorpay webhook reporting payment.failed with notes.recovery_case_id:
    1. Correctly resolves the ongoing RecoveryCase
    2. Escalates attempt count from 1 to 2
    3. Dispatches Attempt 2 notification instead of resetting to Attempt 1
    """
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_RECIPIENTS", "kawindharma@gmail.com")

    sent_emails = []
    from app.services.notifications.resend_adapter import resend_adapter
    from app.services.razorpay_service import razorpay_service

    def mock_send(to, subject, html_content, text_content=None, **kwargs):
        sent_emails.append({"to": to, "subject": subject, "html": html_content})
        return NotificationResult(
            success=True,
            provider="resend",
            status=NotificationStatus.SENT.value,
            provider_message_id=f"re_mock_{uuid.uuid4().hex[:8]}",
            delivery_label="RESEND EMAIL"
        )

    def mock_create_payment_link(*args, **kwargs):
        notes = kwargs.get("notes") or {}
        att = notes.get("attempt", "1")
        return {
            "success": True,
            "payment_link_id": f"plink_wh_att{att}_{uuid.uuid4().hex[:6]}",
            "short_url": f"https://rzp.io/rzp/mock_wh_att{att}_{uuid.uuid4().hex[:6]}",
            "amount": 2500.0,
            "status": "created",
            "reference_id": f"rcov_wh_att{att}_{uuid.uuid4().hex[:6]}",
            "created_at": utcnow(),
            "is_live_demo": True
        }

    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)
    monkeypatch.setattr(razorpay_service, "create_payment_link", mock_create_payment_link)

    cust = Customer(
        id=f"cust_wh_cycle_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        name="Webhook Cycle Tester",
        email="kawindharma@gmail.com"
    )
    db_session.add(cust)

    tx = Transaction(
        id=f"tx_wh_cycle_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        order_id=f"order_wh_cycle_{uuid.uuid4().hex[:6]}",
        customer_id=cust.id,
        amount=2500.0,
        currency="INR",
        method="Card",
        status="FAILED"
    )
    db_session.add(tx)

    case = RecoveryCase(
        id=f"case_wh_cycle_{uuid.uuid4().hex[:6]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        transaction_id=tx.id,
        risk_amount=2500.0,
        failure_category="TECHNICAL_TIMEOUT",
        status="WAITING_FOR_CUSTOMER",
        current_step="WAITING_FOR_CUSTOMER",
        selected_strategy="PAYMENT_LINK",
        attempt_count=1,
        max_attempts=3
    )
    db_session.add(case)
    db_session.commit()

    # Webhook payment.failed payload referencing ongoing recovery_case_id
    wh_secret = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_placeholder"
    payload = {
        "id": f"evt_wh_fail_{uuid.uuid4().hex[:8]}",
        "event": "payment.failed",
        "created_at": 1700000000,
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_wh_att1_fail_{uuid.uuid4().hex[:6]}",
                    "order_id": f"order_rzp_{uuid.uuid4().hex[:6]}",
                    "amount": 250000,
                    "currency": "INR",
                    "status": "failed",
                    "method": "upi",
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_description": "Payment authorization timed out at UPI PSP",
                    "notes": {
                        "recovery_case_id": case.id,
                        "transaction_id": tx.id,
                        "attempt": "1"
                    }
                }
            }
        }
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = hmac.new(wh_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    res = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": sig
        }
    )
    assert res.status_code == 200
    assert res.json()["status"] == "processed"

    db_session.refresh(case)
    assert case.attempt_count == 2
    assert case.current_step == "WAITING_FOR_CUSTOMER"

    # Confirm Attempt 2 email was dispatched
    att2_emails = [e for e in sent_emails if "Attempt 2/3" in e["subject"]]
    assert len(att2_emails) >= 1


