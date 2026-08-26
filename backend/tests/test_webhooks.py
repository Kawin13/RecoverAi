import json
import hmac
import hashlib
import pytest
from app.core.config import settings
from app.models import Transaction, PaymentAttempt, RecoveryCase, AuditLog, WebhookEvent

WEBHOOK_SECRET = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_placeholder"

def compute_webhook_signature(body_bytes: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

def test_webhook_valid_signature_payment_captured(client, db_session):
    # 1. Create order
    order_res = client.post("/api/payments/order", json={
        "product_id": "saas_premium",
        "product_name": "Premium SaaS Subscription",
        "amount": 4999.0,
        "currency": "INR",
        "customer_name": "Webhook Tester",
        "customer_email": "webhook.test@example.com"
    })
    order_data = order_res.json()
    order_id = order_data["order_id"]
    tx_id = order_data["transaction_id"]

    # 2. Build payment.captured webhook payload
    payload = {
        "id": "evt_capture_1001",
        "event": "payment.captured",
        "created_at": 1700000000,
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_wh_cap_9981",
                    "order_id": order_id,
                    "amount": 499900,
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi"
                }
            }
        }
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = compute_webhook_signature(raw_body)

    # 3. Post to /webhooks/razorpay
    res = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": sig
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "processed"
    assert data["event_id"] == "evt_capture_1001"

    # 4. Verify DB transaction updated to SUCCESS
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "SUCCESS"
    assert tx.razorpay_payment_id == "pay_wh_cap_9981"
    assert tx.method == "UPI"

    # Verify audit log & WebhookEvent
    wh_event = db_session.query(WebhookEvent).filter(WebhookEvent.id == "evt_capture_1001").first()
    assert wh_event is not None
    assert wh_event.status == "PROCESSED"

def test_webhook_invalid_signature_rejected(client):
    payload = {
        "id": "evt_fraud_9999",
        "event": "payment.captured",
        "payload": {}
    }
    raw_body = json.dumps(payload).encode("utf-8")

    res = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": "invalid_forged_signature_hex"
        }
    )
    assert res.status_code == 400
    assert "Invalid X-Razorpay-Signature" in res.json()["detail"]

def test_webhook_idempotency_duplicate_ignored(client, db_session):
    # 1. Create order
    order_res = client.post("/api/payments/order", json={
        "product_id": "ecommerce_order",
        "product_name": "Ergonomic Mechanical Keyboard",
        "amount": 1499.0,
        "currency": "INR",
        "customer_name": "Duplicate Tester",
        "customer_email": "dup.test@example.com"
    })
    order_id = order_res.json()["order_id"]

    payload = {
        "id": "evt_dup_2002",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_wh_dup_2002",
                    "order_id": order_id,
                    "amount": 149900,
                    "status": "captured",
                    "method": "card"
                }
            }
        }
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = compute_webhook_signature(raw_body)

    # First delivery
    res1 = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": sig})
    assert res1.status_code == 200
    assert res1.json()["status"] == "processed"

    # Second delivery (Duplicate)
    res2 = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": sig})
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate_ignored"

def test_webhook_out_of_order_protection(client, db_session):
    # 1. Create order
    order_res = client.post("/api/payments/order", json={
        "product_id": "membership_annual",
        "product_name": "Annual Enterprise Membership",
        "amount": 12499.0,
        "currency": "INR",
        "customer_name": "Out of Order Tester",
        "customer_email": "ooo.test@example.com"
    })
    order_id = order_res.json()["order_id"]
    tx_id = order_res.json()["transaction_id"]

    # 2. First complete payment successfully
    cap_payload = {
        "id": "evt_ooo_cap",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_ooo_cap",
                    "order_id": order_id,
                    "amount": 1249900,
                    "status": "captured",
                    "method": "netbanking"
                }
            }
        }
    }
    raw_cap = json.dumps(cap_payload).encode("utf-8")
    client.post("/webhooks/razorpay", content=raw_cap, headers={"X-Razorpay-Signature": compute_webhook_signature(raw_cap)})

    # Transaction is now SUCCESS
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "SUCCESS"

    # 3. Simulate delayed/late payment.failed event arriving afterwards
    delayed_fail_payload = {
        "id": "evt_ooo_delayed_fail",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_ooo_late_attempt",
                    "order_id": order_id,
                    "error_code": "LATE_TIMEOUT",
                    "error_description": "Network dropped earlier"
                }
            }
        }
    }
    raw_fail = json.dumps(delayed_fail_payload).encode("utf-8")
    fail_res = client.post("/webhooks/razorpay", content=raw_fail, headers={"X-Razorpay-Signature": compute_webhook_signature(raw_fail)})
    assert fail_res.status_code == 200
    assert fail_res.json()["status"] == "ignored_out_of_order"

    # 4. CRUCIAL: Transaction MUST remain SUCCESS! Not downgraded!
    db_session.refresh(tx)
    assert tx.status == "SUCCESS"

def test_webhook_payment_failed_escalation(client, db_session):
    order_res = client.post("/api/payments/order", json={
        "product_id": "saas_premium",
        "product_name": "Premium SaaS Subscription",
        "amount": 4999.0,
        "currency": "INR",
        "customer_name": "Failure Escalator",
        "customer_email": "escalate.test@example.com"
    })
    order_id = order_res.json()["order_id"]
    tx_id = order_res.json()["transaction_id"]

    fail_payload = {
        "id": "evt_fail_9009",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_failed_webhook_9009",
                    "order_id": order_id,
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_description": "Payment authorization declined by cardholder bank",
                    "error_reason": "GATEWAY_ERROR"
                }
            }
        }
    }
    raw_body = json.dumps(fail_payload).encode("utf-8")
    sig = compute_webhook_signature(raw_body)

    res = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": sig})
    assert res.status_code == 200

    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "FAILED"

    case = db_session.query(RecoveryCase).filter(RecoveryCase.transaction_id == tx_id).first()
    assert case is not None
    assert case.status == "PENDING_APPROVAL"
    assert case.risk_amount == 4999.0

def test_webhook_payment_authorized_transitional(client, db_session):
    order_res = client.post("/api/payments/order", json={
        "product_id": "subscription_pro",
        "product_name": "Pro Monthly Plan",
        "amount": 2999.0,
        "currency": "INR",
        "customer_name": "Auth Tester",
        "customer_email": "auth.test@example.com"
    })
    order_id = order_res.json()["order_id"]
    tx_id = order_res.json()["transaction_id"]

    auth_payload = {
        "id": "evt_auth_3003",
        "event": "payment.authorized",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_auth_3003",
                    "order_id": order_id,
                    "amount": 299900,
                    "status": "authorized",
                    "method": "card"
                }
            }
        }
    }
    raw_body = json.dumps(auth_payload).encode("utf-8")
    res = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": compute_webhook_signature(raw_body)})
    assert res.status_code == 200

    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "AUTHORIZED"
    # Must NOT mark as final SUCCESS until captured
    assert tx.status != "SUCCESS"

    attempt = db_session.query(PaymentAttempt).filter(PaymentAttempt.transaction_id == tx_id).first()
    assert attempt is not None
    assert attempt.status == "AUTHORIZED"

def test_webhook_order_paid_consistency(client, db_session):
    order_res = client.post("/api/payments/order", json={
        "product_id": "merch_hoodie",
        "product_name": "RecoverAI Tech Hoodie",
        "amount": 3499.0,
        "currency": "INR",
        "customer_name": "Order Paid Tester",
        "customer_email": "orderpaid@example.com"
    })
    order_id = order_res.json()["order_id"]
    tx_id = order_res.json()["transaction_id"]

    order_paid_payload = {
        "id": "evt_order_paid_4004",
        "event": "order.paid",
        "payload": {
            "order": {
                "entity": {
                    "id": order_id,
                    "amount": 349900,
                    "status": "paid"
                }
            },
            "payment": {
                "entity": {
                    "id": "pay_order_paid_4004",
                    "order_id": order_id,
                    "amount": 349900,
                    "status": "captured",
                    "method": "upi"
                }
            }
        }
    }
    raw_body = json.dumps(order_paid_payload).encode("utf-8")
    res = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": compute_webhook_signature(raw_body)})
    assert res.status_code == 200

    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "SUCCESS"
    assert tx.method == "UPI"

def test_webhook_unknown_event_handled_safely(client):
    unknown_payload = {
        "id": "evt_unknown_5005",
        "event": "settlement.processed",
        "payload": {
            "settlement": {
                "entity": {
                    "id": "setl_test_5005",
                    "amount": 1000000
                }
            }
        }
    }
    raw_body = json.dumps(unknown_payload).encode("utf-8")
    res = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": compute_webhook_signature(raw_body)})
    assert res.status_code == 200
    assert res.json()["status"] == "processed"
    assert res.json()["event_type"] == "settlement.processed"

def test_webhook_duplicate_recovery_prevention(client, db_session):
    order_res = client.post("/api/payments/order", json={
        "product_id": "saas_basic",
        "product_name": "Basic SaaS Subscription",
        "amount": 999.0,
        "currency": "INR",
        "customer_name": "No Duplicate Case Tester",
        "customer_email": "nodup@example.com"
    })
    order_id = order_res.json()["order_id"]
    tx_id = order_res.json()["transaction_id"]

    fail_payload = {
        "id": "evt_fail_nodup_6006",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_fail_nodup_6006",
                    "order_id": order_id,
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_description": "First failure"
                }
            }
        }
    }
    raw_body = json.dumps(fail_payload).encode("utf-8")
    sig = compute_webhook_signature(raw_body)

    # First send
    res1 = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": sig})
    assert res1.status_code == 200

    # Second send (Duplicate)
    res2 = client.post("/webhooks/razorpay", content=raw_body, headers={"X-Razorpay-Signature": sig})
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate_ignored"

    # Verify strictly ONLY ONE recovery case was created
    cases = db_session.query(RecoveryCase).filter(RecoveryCase.transaction_id == tx_id).all()
    assert len(cases) == 1

