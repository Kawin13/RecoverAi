import json
import uuid
import hmac
import hashlib
from datetime import datetime
import pytest
from app.core.config import settings
from app.models import Transaction, PaymentAttempt, RecoveryCase, AuditLog, WebhookEvent, Customer
from app.services.razorpay_service import razorpay_service


def compute_checkout_signature(order_id: str, payment_id: str, secret: str = None) -> str:
    key_secret = secret or settings.RAZORPAY_KEY_SECRET
    message = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(key_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def compute_webhook_signature(body_bytes: bytes, secret: str = None) -> str:
    wh_secret = secret or settings.RAZORPAY_WEBHOOK_SECRET
    return hmac.new(wh_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()


@pytest.fixture
def test_order_and_tx(db_session, monkeypatch):
    """Creates an authentic order & transaction fixture with mocked gateway responses."""
    # Ensure RazorpayService.create_order returns a predictable order
    test_order_id = f"order_{uuid.uuid4().hex[:14]}"
    def _mock_create_order(amount_paise, currency="INR", receipt=None, notes=None):
        return {
            "id": test_order_id,
            "entity": "order",
            "amount": amount_paise,
            "amount_paid": 0,
            "amount_due": amount_paise,
            "currency": currency,
            "receipt": receipt or "rcpt_test",
            "status": "created",
            "notes": notes or {}
        }
    monkeypatch.setattr(razorpay_service, "create_order", _mock_create_order)

    now = datetime.utcnow()
    customer = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        name="Security Tester",
        email=f"tester_{uuid.uuid4().hex[:6]}@example.com",
        phone="+919876543210",
        tier="ENTERPRISE",
        ltv=5000.0,
        created_at=now
    )
    db_session.add(customer)
    db_session.flush()

    tx = Transaction(
        id=f"tx_{uuid.uuid4().hex[:10]}",
        order_id=test_order_id,
        customer_id=customer.id,
        amount=5000.0,
        currency="INR",
        method="Card",
        status="PENDING",
        razorpay_order_id=test_order_id,
        created_at=now,
        updated_at=now
    )
    db_session.add(tx)
    db_session.commit()

    return {
        "order_id": test_order_id,
        "transaction_id": tx.id,
        "amount": 5000.0,
        "amount_paise": 500000,
        "currency": "INR"
    }


def test_order_creation_razorpay_api_unavailable_fails_closed(client, monkeypatch):
    """1. When Razorpay API order creation fails: returns HTTP 503 and does NOT generate a fake order."""
    def _failing_create_order(*args, **kwargs):
        raise RuntimeError("Payment service temporarily unavailable.")

    monkeypatch.setattr(razorpay_service, "create_order", _failing_create_order)

    payload = {
        "product_id": "item_123",
        "product_name": "Premium Cloud Service",
        "amount": 5000.0,
        "currency": "INR",
        "customer_name": "Unavailable Test",
        "customer_email": "unavail@example.com"
    }

    res = client.post("/api/payments/order", json=payload)
    assert res.status_code == 503
    assert res.json()["detail"] == "Payment service temporarily unavailable."


def test_payment_fetch_failure_fails_closed(client, test_order_and_tx, monkeypatch):
    """2. If fetching payment details from Razorpay fails: status must remain unverified and fail closed."""
    order_id = test_order_and_tx["order_id"]
    tx_id = test_order_and_tx["transaction_id"]
    payment_id = "pay_fetch_fail_12345"

    # Signature is mathematically correct
    valid_sig = compute_checkout_signature(order_id, payment_id)

    # But gateway fetch fails / returns unverified
    def _mock_fetch_failure(pid):
        return {
            "id": pid,
            "status": "unverified",
            "error": "Gateway communication timeout",
            "amount": 0,
            "currency": "INR"
        }
    monkeypatch.setattr(razorpay_service, "fetch_payment_details", _mock_fetch_failure)

    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": tx_id
    })

    assert res.status_code == 400
    assert "Only captured payments can be verified" in res.json()["detail"]


def test_failed_payment_status_fails_closed(client, test_order_and_tx, monkeypatch):
    """3. If gateway returns payment status as 'failed': fails closed."""
    order_id = test_order_and_tx["order_id"]
    tx_id = test_order_and_tx["transaction_id"]
    payment_id = "pay_failed_status_998"

    valid_sig = compute_checkout_signature(order_id, payment_id)

    def _mock_failed_fetch(pid):
        return {
            "id": pid,
            "status": "failed",
            "order_id": order_id,
            "amount": 500000,
            "currency": "INR"
        }
    monkeypatch.setattr(razorpay_service, "fetch_payment_details", _mock_failed_fetch)

    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": tx_id
    })

    assert res.status_code == 400
    assert "status is 'failed'" in res.json()["detail"]


def test_wrong_signature_fails_closed(client, test_order_and_tx, db_session):
    """4. If HMAC signature is invalid: returns HTTP 400 and transaction remains PENDING."""
    order_id = test_order_and_tx["order_id"]
    tx_id = test_order_and_tx["transaction_id"]
    payment_id = "pay_wrong_sig_001"
    forged_sig = "0" * 64

    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": forged_sig,
        "transaction_id": tx_id
    })

    assert res.status_code == 400
    assert "signature verification failed" in res.json()["detail"].lower()

    # Verify transaction in database remains PENDING
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "PENDING"


def test_wrong_order_id_fails_closed(client, test_order_and_tx):
    """5. If order_id does not match the transaction: returns HTTP 400 mismatch."""
    tx_id = test_order_and_tx["transaction_id"]
    wrong_order_id = "order_mismatched_9999"
    payment_id = "pay_test_001"

    valid_sig = compute_checkout_signature(wrong_order_id, payment_id)

    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": wrong_order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": tx_id
    })

    assert res.status_code == 400
    assert "mismatch" in res.json()["detail"].lower()


def test_wrong_transaction_id_fails_closed(client, test_order_and_tx):
    """6. If transaction_id does not match the order: returns HTTP 400 mismatch."""
    order_id = test_order_and_tx["order_id"]
    wrong_tx_id = "tx_forged_unrelated"
    payment_id = "pay_test_002"

    valid_sig = compute_checkout_signature(order_id, payment_id)

    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": wrong_tx_id
    })

    assert res.status_code in (400, 404)


def test_wrong_amount_fails_closed(client, test_order_and_tx, monkeypatch):
    """7. If gateway recorded amount does not match transaction amount: fails closed."""
    order_id = test_order_and_tx["order_id"]
    tx_id = test_order_and_tx["transaction_id"]
    payment_id = "pay_amount_fraud_001"

    valid_sig = compute_checkout_signature(order_id, payment_id)

    # Customer paid 100 paise (₹1.00) instead of expected ₹5000.00
    def _mock_underpaid(pid):
        return {
            "id": pid,
            "status": "captured",
            "order_id": order_id,
            "amount": 100,
            "currency": "INR"
        }
    monkeypatch.setattr(razorpay_service, "fetch_payment_details", _mock_underpaid)

    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": tx_id
    })

    assert res.status_code == 400
    assert "amount mismatch" in res.json()["detail"].lower()


def test_wrong_currency_fails_closed(client, test_order_and_tx, monkeypatch):
    """8. If gateway recorded currency does not match transaction currency: fails closed."""
    order_id = test_order_and_tx["order_id"]
    tx_id = test_order_and_tx["transaction_id"]
    payment_id = "pay_currency_fraud_001"

    valid_sig = compute_checkout_signature(order_id, payment_id)

    # Currency USD instead of expected INR
    def _mock_wrong_curr(pid):
        return {
            "id": pid,
            "status": "captured",
            "order_id": order_id,
            "amount": 500000,
            "currency": "USD"
        }
    monkeypatch.setattr(razorpay_service, "fetch_payment_details", _mock_wrong_curr)

    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": tx_id
    })

    assert res.status_code == 400
    assert "currency mismatch" in res.json()["detail"].lower()


def test_valid_captured_payment_succeeds_and_is_idempotent(client, test_order_and_tx, monkeypatch, db_session):
    """9. Valid captured payment passes all checks and is idempotent on repeat calls."""
    order_id = test_order_and_tx["order_id"]
    tx_id = test_order_and_tx["transaction_id"]
    payment_id = "pay_perfect_captured_007"

    valid_sig = compute_checkout_signature(order_id, payment_id)

    def _mock_success_fetch(pid):
        return {
            "id": pid,
            "status": "captured",
            "order_id": order_id,
            "amount": 500000,
            "currency": "INR",
            "method": "upi"
        }
    monkeypatch.setattr(razorpay_service, "fetch_payment_details", _mock_success_fetch)

    # First call: verifies and records
    res = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": tx_id
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "SUCCESS"

    # Verify in database
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "SUCCESS"
    assert tx.razorpay_payment_id == payment_id
    assert tx.method == "UPI"

    # Second call: idempotent repeat returns success without duplicate error
    res_repeat = client.post("/api/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_sig,
        "transaction_id": tx_id
    })
    assert res_repeat.status_code == 200
    assert res_repeat.json()["success"] is True


def test_webhook_hmac_invalid_signature_rejected(client):
    """10. Webhook with invalid HMAC signature is rejected with HTTP 400."""
    payload = {
        "id": "evt_fake_webhook_999",
        "event": "payment.captured",
        "payload": {}
    }
    raw_body = json.dumps(payload).encode("utf-8")

    res = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": "invalid_forged_hex"
        }
    )
    assert res.status_code == 400
    assert "Invalid X-Razorpay-Signature" in res.json()["detail"]


def test_webhook_idempotency_duplicate_ignored(client, test_order_and_tx):
    """11. Duplicate webhook deliveries are skipped idempotently."""
    order_id = test_order_and_tx["order_id"]
    event_id = f"evt_idempotent_{uuid.uuid4().hex[:12]}"
    payload = {
        "id": event_id,
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_wh_idem_001",
                    "order_id": order_id,
                    "amount": 500000,
                    "currency": "INR",
                    "status": "captured",
                    "method": "card"
                }
            }
        }
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = compute_webhook_signature(raw_body)

    headers = {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": sig
    }

    # First delivery: processed
    res1 = client.post("/webhooks/razorpay", content=raw_body, headers=headers)
    assert res1.status_code == 200
    assert res1.json()["status"] == "processed"

    # Second delivery: duplicate_ignored
    res2 = client.post("/webhooks/razorpay", content=raw_body, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate_ignored"


def test_webhook_out_of_order_preserves_terminal_success(client, test_order_and_tx, db_session):
    """12. Out-of-order late payment.failed does NOT regress a transaction in terminal SUCCESS state."""
    order_id = test_order_and_tx["order_id"]
    tx_id = test_order_and_tx["transaction_id"]

    # Mark transaction as already successfully completed
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    tx.status = "SUCCESS"
    db_session.commit()

    # Delayed payment.failed webhook arrives
    payload = {
        "id": f"evt_late_failure_{uuid.uuid4().hex[:10]}",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_late_fail_001",
                    "order_id": order_id,
                    "amount": 500000,
                    "currency": "INR",
                    "error_code": "GATEWAY_TIMEOUT",
                    "error_description": "Delayed error notice"
                }
            }
        }
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = compute_webhook_signature(raw_body)

    res = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": sig
        }
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored_out_of_order"

    # Verify transaction remains in SUCCESS state
    db_session.refresh(tx)
    assert tx.status == "SUCCESS"
