import hmac
import hashlib
import pytest
from app.core.config import settings
from app.models import Transaction, PaymentAttempt, RecoveryCase, AuditLog

def test_get_payment_config(client):
    response = client.get("/api/payments/config")
    assert response.status_code == 200
    data = response.json()
    assert "key_id" in data
    assert data["is_test_mode"] is True
    assert "merchant_name" in data
    # Guarantee Key Secret is strictly never exposed
    assert "key_secret" not in data
    assert "RAZORPAY_KEY_SECRET" not in str(data)

def test_create_order_server_side(client, db_session):
    payload = {
        "product_id": "saas_premium",
        "product_name": "Premium SaaS Subscription",
        "amount": 4999.0,
        "currency": "INR",
        "customer_name": "Test Customer",
        "customer_email": "test.customer@example.com",
        "customer_phone": "+91 98765 43210"
    }

    response = client.post("/api/payments/order", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "order_id" in data
    assert data["order_id"].startswith("order_")
    assert "transaction_id" in data
    assert data["amount"] == 499900  # Amount in paise
    assert data["amount_in_rupees"] == 4999.0
    assert data["currency"] == "INR"
    assert "key_id" in data
    assert data["customer"]["name"] == "Test Customer"

    # Verify database persistence in PENDING state
    tx = db_session.query(Transaction).filter(Transaction.id == data["transaction_id"]).first()
    assert tx is not None
    assert tx.order_id == data["order_id"]
    assert tx.amount == 4999.0
    assert tx.status == "PENDING"

def test_verify_payment_signature_success(client, db_session, monkeypatch):
    # 1. Create initial order
    payload = {
        "product_id": "ecommerce_order",
        "product_name": "Ergonomic Mechanical Keyboard",
        "amount": 1499.0,
        "currency": "INR",
        "customer_name": "Siddharth Rao",
        "customer_email": "siddharth.rao@example.com"
    }
    order_res = client.post("/api/payments/order", json=payload)
    order_data = order_res.json()
    order_id = order_data["order_id"]
    tx_id = order_data["transaction_id"]

    # 2. Simulate genuine Razorpay payment response
    payment_id = "pay_test_genuine_12345"
    message = f"{order_id}|{payment_id}".encode("utf-8")
    secret = settings.RAZORPAY_KEY_SECRET.encode("utf-8")
    valid_signature = hmac.new(secret, message, hashlib.sha256).hexdigest()

    # Mock gateway returning captured payment details for this test payment
    from app.services.razorpay_service import razorpay_service
    def _mock_fetch(pid):
        return {
            "id": pid,
            "status": "captured",
            "order_id": order_id,
            "amount": 149900,
            "currency": "INR",
            "method": "card"
        }
    monkeypatch.setattr(razorpay_service, "fetch_payment_details", _mock_fetch)

    verify_payload = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": valid_signature,
        "transaction_id": tx_id
    }

    # 3. Call backend verification
    verify_res = client.post("/api/payments/verify", json=verify_payload)
    assert verify_res.status_code == 200
    vdata = verify_res.json()

    assert vdata["success"] is True
    assert vdata["signature_valid"] is True
    assert vdata["status"] == "SUCCESS"
    assert vdata["razorpay_payment_id"] == payment_id

    # 4. Verify database persistence
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "SUCCESS"
    assert tx.razorpay_payment_id == payment_id
    assert tx.razorpay_signature == valid_signature

    # Verify payment attempt and audit log
    attempts = db_session.query(PaymentAttempt).filter(PaymentAttempt.transaction_id == tx_id).all()
    assert len(attempts) >= 1
    assert attempts[-1].status == "SUCCESS"

    audit = db_session.query(AuditLog).filter(
        AuditLog.transaction_id == tx_id,
        AuditLog.action_type == "PAYMENT_VERIFIED"
    ).first()
    assert audit is not None

def test_verify_payment_signature_tampered(client, db_session):
    # 1. Create order
    payload = {
        "product_id": "membership_annual",
        "product_name": "Annual Enterprise Membership",
        "amount": 12499.0,
        "currency": "INR",
        "customer_name": "Fraud Alert Tester",
        "customer_email": "fraud.test@example.com"
    }
    order_res = client.post("/api/payments/order", json=payload)
    order_data = order_res.json()
    order_id = order_data["order_id"]
    tx_id = order_data["transaction_id"]

    # 2. Provide a fake/forged signature
    fake_signature = "bad_signature_000000000000000000000000000000000000000000000000000000"
    verify_payload = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_fake_9999",
        "razorpay_signature": fake_signature,
        "transaction_id": tx_id
    }

    # 3. Call backend verification - must be rejected
    verify_res = client.post("/api/payments/verify", json=verify_payload)
    assert verify_res.status_code == 400
    assert "signature verification failed" in verify_res.json()["detail"].lower()

    # 4. Verify transaction was NOT marked as success
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status != "SUCCESS"

def test_record_payment_failure_escalation(client, db_session):
    # 1. Create order
    payload = {
        "product_id": "saas_premium",
        "product_name": "Premium SaaS Subscription",
        "amount": 4999.0,
        "currency": "INR",
        "customer_name": "Payment Failure Tester",
        "customer_email": "fail.test@example.com"
    }
    order_res = client.post("/api/payments/order", json=payload)
    order_data = order_res.json()
    tx_id = order_data["transaction_id"]
    order_id = order_data["order_id"]

    # 2. Record failure
    fail_payload = {
        "transaction_id": tx_id,
        "order_id": order_id,
        "payment_id": "pay_test_failed_8888",
        "error_code": "BAD_REQUEST_ERROR",
        "error_description": "Bank servers unavailable or OTP timed out",
        "error_category": "GATEWAY_TIMEOUT"
    }

    fail_res = client.post("/api/payments/fail", json=fail_payload)
    assert fail_res.status_code == 200
    fdata = fail_res.json()
    assert fdata["status"] == "recorded"
    assert fdata["escalated_to_agent"] is True

    # 3. Verify Transaction & RecoveryCase in DB
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "FAILED"

    case = db_session.query(RecoveryCase).filter(RecoveryCase.transaction_id == tx_id).first()
    assert case is not None
    assert case.risk_amount == 4999.0
    assert case.failure_category == "GATEWAY_TIMEOUT"
    assert case.status == "PENDING_APPROVAL"
