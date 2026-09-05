import uuid
import time
import pytest
from unittest.mock import patch, MagicMock
import httpx
from app.services.razorpay_service import RazorpayService, razorpay_service
from app.models import RecoveryCase, Transaction, PaymentLink, RecoveryOutcome, AuditLog
from app.services.recovery_executor import RecoveryStep
from app.core.config import settings

WEBHOOK_SECRET = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_placeholder"

def compute_webhook_signature(body_bytes: bytes, secret: str = WEBHOOK_SECRET) -> str:
    import hmac
    import hashlib
    return hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

def test_successful_razorpay_payment_link_parsing():
    """Validates successful Razorpay Payment Link API response parsing."""
    svc = RazorpayService(key_id="rzp_test_sample", key_secret="test_secret_sample")
    mock_resp_data = {
        "id": "plink_K8q2J9vLx0N1Op",
        "accept_partial": False,
        "amount": 250000,
        "amount_paid": 0,
        "currency": "INR",
        "description": "RecoverAI payment recovery",
        "short_url": "https://rzp.io/rzp/k8Q2j9V",
        "status": "created",
        "reference_id": "rcov_test_1234",
        "created_at": int(time.time()),
        "customer": {"name": "Aarav Gupta", "email": "aarav@example.com", "contact": "+919876543210"}
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_resp_data

    with patch("httpx.Client.post", return_value=mock_resp):
        res = svc.create_payment_link(
            amount_paise=250000,
            customer_name="Aarav Gupta",
            customer_email="aarav@example.com",
            customer_contact="+919876543210",
            reference_id="rcov_test_1234"
        )
        assert res["success"] is True
        assert res["payment_link_id"] == "plink_K8q2J9vLx0N1Op"
        assert res["short_url"] == "https://rzp.io/rzp/k8Q2j9V"
        assert res["amount"] == 2500.0
        assert res["status"] == "created"
        assert res["is_live_demo"] is True

def test_missing_short_url_rejected():
    """Fails if Razorpay response does not contain short_url."""
    svc = RazorpayService(key_id="rzp_test_sample", key_secret="test_secret_sample")
    mock_resp_data = {
        "id": "plink_missing_url_99",
        "status": "created",
        "amount": 50000
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_resp_data

    with patch("httpx.Client.post", return_value=mock_resp):
        with pytest.raises(RuntimeError) as exc_info:
            svc.create_payment_link(
                amount_paise=50000,
                customer_name="Test Customer",
                customer_email="test@example.com"
            )
        assert "Invalid response from Razorpay" in str(exc_info.value)

def test_invalid_short_url_rejected():
    """Fails if short_url does not begin with https://rzp.io/."""
    svc = RazorpayService(key_id="rzp_test_sample", key_secret="test_secret_sample")
    mock_resp_data = {
        "id": "plink_invalid_url_99",
        "short_url": "http://insecure-domain.com/pay/123",
        "status": "created",
        "amount": 50000
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_resp_data

    with patch("httpx.Client.post", return_value=mock_resp):
        with pytest.raises(RuntimeError) as exc_info:
            svc.create_payment_link(
                amount_paise=50000,
                customer_name="Test Customer",
                customer_email="test@example.com"
            )
        assert "Invalid response from Razorpay" in str(exc_info.value)

def test_razorpay_api_error_handling():
    """Ensures API errors produce safe exception messages without exposing credentials."""
    svc = RazorpayService(key_id="rzp_test_sample", key_secret="SUPER_SECRET_KEY_NEVER_PRINT")
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.json.return_value = {
        "error": {
            "code": "BAD_REQUEST_ERROR",
            "description": "Amount must be at least 100 paise."
        }
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        with pytest.raises(RuntimeError) as exc_info:
            svc.create_payment_link(
                amount_paise=50,
                customer_name="Test Customer",
                customer_email="test@example.com"
            )
        err_msg = str(exc_info.value)
        assert "Amount must be at least 100 paise" in err_msg
        assert "SUPER_SECRET_KEY_NEVER_PRINT" not in err_msg

def test_unique_reference_id_generation():
    """Ensures each generated link gets a distinct unique reference_id."""
    svc = RazorpayService(key_id="rzp_test_sample", key_secret="test_secret_sample")
    posted_payloads = []

    def mock_post(url, auth, json):
        posted_payloads.append(json)
        resp = MagicMock()
        resp.status_code = 200
        ref = json.get("reference_id")
        resp.json.return_value = {
            "id": f"plink_{uuid.uuid4().hex[:10]}",
            "short_url": f"https://rzp.io/rzp/{uuid.uuid4().hex[:6]}",
            "status": "created",
            "amount": json["amount"],
            "reference_id": ref
        }
        return resp

    with patch("httpx.Client.post", side_effect=mock_post):
        svc.create_payment_link(amount_paise=10000, customer_name="Customer 1", customer_email="c1@example.com")
        svc.create_payment_link(amount_paise=20000, customer_name="Customer 2", customer_email="c2@example.com")

        assert len(posted_payloads) == 2
        ref1 = posted_payloads[0]["reference_id"]
        ref2 = posted_payloads[1]["reference_id"]
        assert ref1 != ref2
        assert ref1.startswith("rcov_")
        assert ref2.startswith("rcov_")

def test_database_persistence_of_exact_short_url(auth_client, db_session):
    """Verifies that the endpoint persists the exact short_url without any modifications or fake paths."""
    order_res = auth_client.post("/api/payments/order", json={
        "product_id": "prod_pl_test",
        "product_name": "Test Recovery Item",
        "amount": 1200.0,
        "customer_name": "DB Tester",
        "customer_email": "dbtester@example.com"
    })
    tx_id = order_res.json()["transaction_id"]

    case = RecoveryCase(
        id=f"case_{uuid.uuid4().hex[:8]}",
        transaction_id=tx_id,
        risk_amount=1200.0,
        failure_category="AUTHENTICATION_FAILED",
        status=RecoveryStep.ACTION_SCHEDULED.value,
        current_step=RecoveryStep.ACTION_SCHEDULED.value,
        selected_strategy="PAYMENT_LINK"
    )
    db_session.add(case)
    db_session.commit()

    exact_rzp_url = "https://rzp.io/rzp/x9T1kLa"
    plink_id = "plink_ExactTest1001"

    from datetime import datetime
    mock_link_res = {
        "success": True,
        "payment_link_id": plink_id,
        "short_url": exact_rzp_url,
        "amount": 1200.0,
        "status": "created",
        "reference_id": "rcov_test_ref",
        "created_at": datetime.utcnow(),
        "is_live_demo": True,
        "raw_response": {"id": plink_id, "short_url": exact_rzp_url, "status": "created"}
    }

    with patch("app.api.v1.endpoints.recovery_executor.razorpay_service.create_payment_link", return_value=mock_link_res):
        res = auth_client.post(f"/api/recovery/workflows/{case.id}/payment-link", json={"is_live_demo": True})
        assert res.status_code == 200
        data = res.json()
        assert data["short_url"] == exact_rzp_url
        assert data["payment_link_id"] == plink_id

        # Verify DB record
        pl_db = db_session.query(PaymentLink).filter(PaymentLink.payment_link_id == plink_id).first()
        assert pl_db is not None
        assert pl_db.short_url == exact_rzp_url
        assert pl_db.recovery_case_id == case.id
        assert pl_db.is_live_demo is True

def test_no_locally_constructed_rzp_io_url():
    """Ensures fallback mode generates explicit local demo URLs instead of fake rzp.io short URLs."""
    svc = RazorpayService(key_id="", key_secret="")
    link = svc.create_payment_link(
        amount_paise=450000,
        customer_name="Local Tester",
        customer_email="local@example.com",
        is_live_demo=False
    )
    assert link["is_live_demo"] is False
    assert link["payment_link_id"].startswith("demo_plink_")
    assert not link["short_url"].startswith("https://rzp.io/")
    assert "localhost:3000/demo-checkout" in link["short_url"]

def test_webhook_payment_link_paid_lifecycle(client, db_session):
    """Verifies that Razorpay payment_link.paid webhook marks PaymentLink paid, RecoveryCase RECOVERED, and creates RecoveryOutcome."""
    order_res = client.post("/api/payments/order", json={
        "product_id": "prod_pl_wh",
        "product_name": "Webhook Test Item",
        "amount": 5400.0,
        "customer_name": "Webhook Shopper",
        "customer_email": "whshopper@example.com"
    })
    tx_id = order_res.json()["transaction_id"]

    case = RecoveryCase(
        id=f"case_{uuid.uuid4().hex[:8]}",
        transaction_id=tx_id,
        risk_amount=5400.0,
        failure_category="INSUFFICIENT_FUNDS",
        status="WAITING_FOR_CUSTOMER",
        current_step="WAITING_FOR_CUSTOMER",
        selected_strategy="PAYMENT_LINK"
    )
    db_session.add(case)
    db_session.commit()

    test_plink_id = f"plink_wh_{uuid.uuid4().hex[:8]}"
    pl_record = PaymentLink(
        id=f"pl_{uuid.uuid4().hex[:8]}",
        payment_link_id=test_plink_id,
        recovery_case_id=case.id,
        short_url=f"https://rzp.io/rzp/{uuid.uuid4().hex[:6]}",
        amount=5400.0,
        currency="INR",
        status="created",
        is_live_demo=True
    )
    db_session.add(pl_record)
    db_session.commit()

    import json
    webhook_payload = {
        "entity": "event",
        "account_id": "acc_demo_test",
        "event": "payment_link.paid",
        "contains": ["payment_link", "payment"],
        "payload": {
            "payment_link": {
                "entity": {
                    "id": test_plink_id,
                    "amount": 540000,
                    "amount_paid": 540000,
                    "status": "paid",
                    "notes": {
                        "recovery_case_id": case.id,
                        "transaction_id": tx_id
                    }
                }
            },
            "payment": {
                "entity": {
                    "id": "pay_test_link_capture_9988",
                    "amount": 540000,
                    "status": "captured",
                    "method": "upi",
                    "order_id": "order_plink_internal_123",
                    "notes": {
                        "recovery_case_id": case.id,
                        "transaction_id": tx_id
                    }
                }
            }
        }
    }

    raw_body = json.dumps(webhook_payload).encode("utf-8")
    sig = compute_webhook_signature(raw_body)

    res = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig}
    )
    assert res.status_code == 200

    # Verify updates in DB
    db_session.expire_all()
    updated_pl = db_session.query(PaymentLink).filter(PaymentLink.payment_link_id == test_plink_id).first()
    assert updated_pl.status == "paid"

    updated_case = db_session.query(RecoveryCase).filter(RecoveryCase.id == case.id).first()
    assert updated_case.status == "RECOVERED"
    assert updated_case.current_step == "RECOVERED"
    assert updated_case.recovered_at is not None

    outcome = db_session.query(RecoveryOutcome).filter(RecoveryOutcome.recovery_case_id == case.id).first()
    assert outcome is not None
    assert outcome.recovered_amount == 5400.0
    assert outcome.payment_method_used == "UPI"

    updated_tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert updated_tx.status == "SUCCESS"
    assert updated_tx.razorpay_payment_id == "pay_test_link_capture_9988"

    audit = db_session.query(AuditLog).filter(AuditLog.recovery_case_id == case.id).first()
    assert audit is not None
    assert audit.action_type == "PAYMENT_CAPTURED"


def test_sync_case_payment_reconciliation(auth_client, db_session):
    """Verifies that active Razorpay payment link sync reconciles paid links even without webhooks."""
    from unittest.mock import patch
    from app.services.recovery_executor import sync_case_payment_links

    order_res = auth_client.post("/api/payments/order", json={
        "product_id": "prod_pl_sync",
        "product_name": "Sync Test Item",
        "amount": 3500.0,
        "customer_name": "Sync Shopper",
        "customer_email": "syncshopper@example.com"
    })
    tx_id = order_res.json()["transaction_id"]
    case_id = f"case_sync_{uuid.uuid4().hex[:6]}"
    test_plink = f"plink_sync_{uuid.uuid4().hex[:6]}"

    case = RecoveryCase(
        id=case_id,
        transaction_id=tx_id,
        risk_amount=3500.0,
        failure_category="INSUFFICIENT_FUNDS",
        status="WAITING_FOR_CUSTOMER",
        current_step="WAITING_FOR_CUSTOMER",
        selected_strategy="PAYMENT_LINK"
    )
    db_session.add(case)

    pl_record = PaymentLink(
        id=f"pl_{uuid.uuid4().hex[:6]}",
        payment_link_id=test_plink,
        recovery_case_id=case_id,
        short_url=f"https://rzp.io/rzp/{uuid.uuid4().hex[:6]}",
        amount=3500.0,
        currency="INR",
        status="created",
        is_live_demo=True
    )
    db_session.add(pl_record)
    db_session.commit()

    mock_rzp_res = {
        "id": test_plink,
        "status": "paid",
        "amount": 350000,
        "amount_paid": 350000,
        "payments": [
            {
                "payment_id": "pay_mock_sync_123",
                "method": "card",
                "status": "captured",
                "amount": 350000
            }
        ]
    }

    with patch("app.services.recovery_executor.razorpay_service.fetch_payment_link", return_value=mock_rzp_res):
        sync_res = auth_client.post(f"/api/recovery/workflows/{case_id}/sync-payment")
        assert sync_res.status_code == 200
        data = sync_res.json()
        assert data["recovered"] is True
        assert data["case"]["status"] == "RECOVERED"
        assert data["case"]["current_step"] == "RECOVERED"

    db_session.expire_all()
    updated_pl = db_session.query(PaymentLink).filter(PaymentLink.payment_link_id == test_plink).first()
    assert updated_pl.status == "paid"

    updated_case = db_session.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    assert updated_case.status == "RECOVERED"

    updated_tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert updated_tx.status == "SUCCESS"
    assert updated_tx.razorpay_payment_id == "pay_mock_sync_123"
