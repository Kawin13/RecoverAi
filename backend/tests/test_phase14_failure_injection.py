import os
import json
import time
import uuid
import hmac
import hashlib
from unittest.mock import patch, MagicMock
import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.models import Transaction, Customer, PaymentAttempt, RecoveryCase, AuditLog, WebhookEvent
from app.services.razorpay_service import RazorpayService, razorpay_service
from app.agents.diagnosis import FailureDiagnosisEngine, FailureTaxonomy
from app.agents.gemini_agent import GeminiAgent
from app.ml.inference import MLInferenceEngine
from app.services.guardrails_service import guardrails_service
from app.core.guardrail_policy import GuardrailPolicy, guardrail_policy
from app.services.recovery_executor import recovery_state_machine, RecoveryStep

WEBHOOK_SECRET = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_placeholder"

def compute_sig(body_bytes: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

# =========================================================================
# 1. HEALTH ENDPOINT & DATABASE DISCONNECTION FAILURE INJECTION
# =========================================================================

def test_health_check_healthy(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "version" in data

def test_health_check_database_temporarily_unavailable_failure_injection(client):
    """
    FAILURE INJECTION: Database connection drops or fails.
    The health endpoint must gracefully report degraded status without crashing.
    """
    with patch("sqlalchemy.orm.Session.execute", side_effect=OperationalError("connection timed out", params=None, orig=Exception("DB Unreachable"))):
        res = client.get("/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "degraded"
        assert data["database"] == "disconnected"
        assert "database_error" in data

# =========================================================================
# 2. DATABASE PAGINATION, SEARCH, AND FILTERS
# =========================================================================

def test_transactions_pagination_and_boundaries(client):
    res1 = client.get("/api/transactions?page=1&limit=5")
    assert res1.status_code == 200
    data1 = res1.json()
    assert "items" in data1
    assert "total" in data1
    assert data1["page"] == 1
    assert data1["limit"] == 5
    assert len(data1["items"]) <= 5

    # Out of bounds page should gracefully return empty items list
    res_high = client.get("/api/transactions?page=9999&limit=20")
    assert res_high.status_code == 200
    data_high = res_high.json()
    assert data_high["items"] == []
    assert data_high["page"] == 9999

def test_transactions_filters_and_search(client):
    res_method = client.get("/api/transactions?method=UPI&limit=10")
    assert res_method.status_code == 200
    for item in res_method.json()["items"]:
        assert item["method"].upper() == "UPI"

    res_status = client.get("/api/transactions?status=FAILED&limit=10")
    assert res_status.status_code == 200
    for item in res_status.json()["items"]:
        assert item["status"].upper() == "FAILED"

# =========================================================================
# 3. ML PREDICTION & MISSING MODEL ARTIFACTS FAILURE INJECTION
# =========================================================================

def test_ml_prediction_with_standard_inference():
    engine = MLInferenceEngine()
    features = {
        "amount": 4500.0,
        "payment_method": "UPI",
        "bank": "HDFC Bank",
        "failure_reason": "UPI_TIMEOUT",
        "attempt_count": 1,
        "customer_value": "VIP"
    }
    pred = engine.predict(features)
    assert "recovery_probability" in pred
    assert 0.05 <= pred["recovery_probability"] <= 0.98
    assert "recommended_action" in pred
    assert "action_ervs" in pred

def test_ml_missing_model_artifacts_failure_injection():
    """
    FAILURE INJECTION: Model artifact files missing or unreadable.
    Engine must fall back seamlessly to calibrated baseline rules.
    """
    engine = MLInferenceEngine()
    engine.rec_model = None
    engine.int_model = None
    engine.rec_preprocessor = None
    engine.int_preprocessor = None

    features = {
        "amount": 2500.0,
        "payment_method": "Card",
        "failure_reason": "CARD_DECLINED",
        "attempt_count": 1,
        "customer_value": "STANDARD"
    }
    pred = engine.predict(features)
    assert "recovery_probability" in pred
    assert 0.05 <= pred["recovery_probability"] <= 0.98
    assert pred["recommended_action"] in engine.candidate_actions
    assert len(pred["action_ervs"]) > 0

# =========================================================================
# 4. ERV MINOR UNIT MATH & STRATEGY RANKING
# =========================================================================

def test_erv_calculation_and_candidate_ranking():
    engine = MLInferenceEngine()
    features = {
        "amount": 10000.0,
        "payment_method": "Card",
        "failure_reason": "INSUFFICIENT_FUNDS",
        "attempt_count": 1,
        "customer_value": "VIP"
    }
    pred = engine.predict(features)
    ervs = pred["action_ervs"]
    assert "PAYMENT_LINK" in ervs
    assert "RETRY_NOW" in ervs
    # In INSUFFICIENT_FUNDS, PAYMENT_LINK / UPI_SWITCH should beat RETRY_NOW
    assert ervs["PAYMENT_LINK"] > ervs["RETRY_NOW"]

# =========================================================================
# 5. GUARDRAIL DENIALS FAILURE INJECTION
# =========================================================================

def test_guardrail_denial_attempt_limit_exceeded(db_session):
    """
    FAILURE INJECTION: Recovery attempt exceeds maximum allowed attempts.
    Guardrail must block execution and mark case for escalation or stop.
    """
    cust = Customer(id="cust_g1", name="Guardrail Tester", email="g1@example.com", tier="STANDARD")
    db_session.add(cust)
    db_session.flush()

    tx = Transaction(id="tx_g1", order_id="ord_g1", customer_id="cust_g1", amount=1500.0, status="FAILED")
    db_session.add(tx)
    db_session.flush()

    # Case has already reached 3 attempts
    case = RecoveryCase(
        id="case_g1",
        transaction_id="tx_g1",
        risk_amount=1500.0,
        failure_category="CUSTOMER_ACTION_REQUIRED",
        attempt_count=3,
        max_attempts=3,
        status="IN_PROGRESS"
    )
    db_session.add(case)
    db_session.commit()

    decision = guardrails_service.evaluate(case, db_session)
    assert decision.allowed is False
    assert "attempt" in decision.human_readable_reason.lower()
    assert decision.suggested_action == "STOP"

def test_guardrail_denial_high_value_supervisor_routing(db_session):
    """
    FAILURE INJECTION: Transaction amount exceeds supervisor threshold (₹25,000).
    Requires human sign-off before autonomous execution.
    """
    cust = Customer(id="cust_g2", name="VIP High Roller", email="g2@example.com", tier="VIP")
    db_session.add(cust)
    db_session.flush()

    tx = Transaction(id="tx_g2", order_id="ord_g2", customer_id="cust_g2", amount=75000.0, status="FAILED")
    db_session.add(tx)
    db_session.flush()

    case = RecoveryCase(
        id="case_g2",
        transaction_id="tx_g2",
        risk_amount=75000.0,
        failure_category="CUSTOMER_ACTION_REQUIRED",
        attempt_count=1,
        max_attempts=3,
        status="PENDING_APPROVAL"
    )
    db_session.add(case)
    db_session.commit()

    decision = guardrails_service.evaluate(case, db_session)
    assert decision.requires_approval is True
    assert decision.reason_code == "HIGH_VALUE_TRANSACTION"
    assert decision.suggested_action == "HUMAN_APPROVAL"

# =========================================================================
# 6. RAZORPAY REQUEST FAILURE & SANDBOX FALLBACK
# =========================================================================

def test_razorpay_order_creation_request_fails_graceful_fallback():
    """
    FAILURE INJECTION: Razorpay Gateway API throws connection error or 500.
    RazorpayService must fall back to local sandbox order creation without crashing.
    """
    svc = RazorpayService(key_id="rzp_test_mock", key_secret="rzp_secret_mock")
    with patch("httpx.Client.post", side_effect=Exception("Gateway Connection Timeout")):
        order = svc.create_order(amount_paise=50000, currency="INR")
        assert order is not None
        assert order["id"].startswith("order_")
        assert order["amount"] == 50000
        assert order["status"] == "created"

def test_razorpay_payment_link_creation_failure_fallback():
    """
    FAILURE INJECTION: Razorpay Payment Link API throws error.
    Must raise error on live demo and generate sandbox demo link on local simulation mode.
    """
    svc = RazorpayService(key_id="rzp_test_mock", key_secret="rzp_secret_mock")
    with patch("httpx.Client.post", side_effect=Exception("Gateway Error 503")):
        with pytest.raises(RuntimeError) as exc_info:
            svc.create_payment_link(
                amount_paise=250000,
                customer_name="Aarav Gupta",
                customer_email="aarav@example.com",
                is_live_demo=True
            )
        assert "Gateway Error 503" in str(exc_info.value)

        # Fallback simulation
        link = svc.create_payment_link(
            amount_paise=250000,
            customer_name="Aarav Gupta",
            customer_email="aarav@example.com",
            is_live_demo=False
        )
        assert link is not None
        assert link["payment_link_id"].startswith("demo_plink_")
        assert "localhost:3000/demo-checkout" in link["short_url"]
        assert link["amount"] == 2500.0

# =========================================================================
# 7. PAYMENT VERIFICATION & FORGED SIGNATURE FAILURE INJECTION
# =========================================================================

def test_payment_verification_forged_signature_rejected(client, db_session):
    """
    FAILURE INJECTION: Tampered or forged payment signature.
    Verification must return 400 Bad Request and not mark transaction SUCCESS.
    """
    cust = Customer(id="cust_v1", name="Verify Tester", email="v1@example.com", tier="STANDARD")
    db_session.add(cust)
    db_session.flush()

    tx = Transaction(id="tx_v1", order_id="ord_v1", customer_id="cust_v1", amount=1200.0, status="PENDING")
    db_session.add(tx)
    db_session.commit()

    tampered_payload = {
        "razorpay_order_id": "ord_v1",
        "razorpay_payment_id": "pay_tampered_999",
        "razorpay_signature": "0000000000000000000000000000000000000000000000000000000000000000",
        "transaction_id": "tx_v1"
    }
    res = client.post("/api/payments/verify", json=tampered_payload)
    assert res.status_code == 400
    assert "signature" in res.json()["detail"].lower()

    # Transaction must remain in PENDING
    db_session.refresh(tx)
    assert tx.status == "PENDING"

# =========================================================================
# 8. WEBHOOK SIGNATURE & DUPLICATE IDEMPOTENCY
# =========================================================================

def test_webhook_invalid_signature_rejected(client):
    payload = {"id": "evt_fake", "event": "payment.failed", "payload": {}}
    raw_body = json.dumps(payload).encode("utf-8")
    res = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "invalid_hex"}
    )
    assert res.status_code == 400

def test_webhook_duplicate_event_handling(client, db_session):
    """
    FAILURE INJECTION: Duplicate delivery of the same webhook event.
    System must detect existing event ID and return duplicate_ignored.
    """
    cust = Customer(id="cust_dup", name="Dup Shopper", email="dup@example.com", tier="STANDARD")
    db_session.add(cust)
    db_session.flush()

    tx = Transaction(id="tx_dup", order_id="ord_dup", customer_id="cust_dup", amount=1999.0, status="PENDING")
    db_session.add(tx)
    db_session.commit()

    payload = {
        "id": "evt_dup_9999",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_dup_9999",
                    "order_id": "ord_dup",
                    "amount": 199900,
                    "status": "captured",
                    "method": "upi"
                }
            }
        }
    }
    raw = json.dumps(payload).encode("utf-8")
    sig = compute_sig(raw)

    # First attempt: processed
    res1 = client.post("/webhooks/razorpay", content=raw, headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig})
    assert res1.status_code == 200
    assert res1.json()["status"] == "processed"

    # Second attempt: duplicate_ignored
    res2 = client.post("/webhooks/razorpay", content=raw, headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig})
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate_ignored"

# =========================================================================
# 9. GEMINI UNAVAILABLE & RATE LIMIT (429) FAILURE INJECTION
# =========================================================================

def test_gemini_unavailable_or_rate_limit_failure_injection():
    """
    FAILURE INJECTION: Gemini API raises 429 ResourceExhausted or network error.
    GeminiAgent must catch and return high-fidelity deterministic fallback templates.
    """
    agent = GeminiAgent()
    agent._client = MagicMock()
    # Simulate Gemini 429 Rate Limit error
    agent._client.models.generate_content.side_effect = Exception("429 Resource exhausted: quota exceeded")

    tx_data = {
        "amount": 3499.0,
        "payment_method": "Card",
        "failure_reason": "CARD_DECLINED",
        "customer_name": "Rohan Sharma"
    }
    decision_data = {
        "selected_action": "PAYMENT_LINK",
        "recovery_probability": 0.82
    }

    # 1. Explanation fallback
    explanation = agent.explain_decision("rec_rate_test", tx_data, decision_data)
    assert explanation is not None
    assert "summary" in explanation
    assert "operator_notes" in explanation
    assert len(explanation["operator_notes"]) >= 2
    assert "deterministic" in explanation["source"].lower()

    # 2. Multi-lingual message fallback
    msg_hi = agent.generate_customer_message("rec_rate_test", tx_data, decision_data, language="HI")
    assert msg_hi is not None
    assert "headline" in msg_hi
    assert "message_body" in msg_hi
    assert msg_hi["language"] == "HI"

# =========================================================================
# 10. UNKNOWN FAILURE CODE FAILURE INJECTION
# =========================================================================

def test_unknown_failure_code_failure_injection():
    """
    FAILURE INJECTION: Unseen or obscure error code from bank or gateway.
    FailureDiagnosisEngine must classify as UNKNOWN without throwing exceptions.
    """
    diag = FailureDiagnosisEngine.diagnose("MYSTERY_BANK_ERROR_9999", payment_method="NetBanking", attempt_count=1)
    assert diag is not None
    assert diag["taxonomy"] == FailureTaxonomy.UNKNOWN.value
    assert "unspecified" in diag["description"].lower()
    assert diag["is_transient"] is False
    assert diag["attempt_number"] == 1

# =========================================================================
# 11. MISSING CUSTOMER PROVISIONING FAILURE INJECTION
# =========================================================================

def test_webhook_missing_customer_auto_provisions(client, db_session):
    """
    FAILURE INJECTION: Webhook arrives for an external payment failure where
    neither the customer nor transaction previously existed in RecoverAI DB.
    System must auto-provision Customer & Transaction so the revenue is not lost.
    """
    unique_ext_order = f"order_ext_{uuid.uuid4().hex[:8]}"
    unique_email = f"unknown_customer_{uuid.uuid4().hex[:6]}@example.com"

    payload = {
        "id": f"evt_ext_{uuid.uuid4().hex[:8]}",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_ext_{uuid.uuid4().hex[:8]}",
                    "order_id": unique_ext_order,
                    "amount": 799900,
                    "currency": "INR",
                    "method": "card",
                    "email": unique_email,
                    "contact": "+919811223344",
                    "error_code": "CARD_DECLINED",
                    "error_description": "Card blocked by issuer"
                }
            }
        }
    }
    raw = json.dumps(payload).encode("utf-8")
    sig = compute_sig(raw)

    res = client.post("/webhooks/razorpay", content=raw, headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig})
    assert res.status_code == 200

    # Verify customer and transaction were safely auto-provisioned
    cust = db_session.query(Customer).filter(Customer.email == unique_email).first()
    assert cust is not None

    tx = db_session.query(Transaction).filter(Transaction.order_id == unique_ext_order).first()
    assert tx is not None
    assert tx.status == "FAILED"
    assert tx.amount == 7999.0

# =========================================================================
# 12. RECOVERY STATE MACHINE TRANSITIONS
# =========================================================================

def test_recovery_state_machine_full_lifecycle(db_session):
    """
    Validates step-by-step state transitions:
    DETECTED -> DIAGNOSED -> STRATEGY_SELECTED -> GUARDRAIL_CHECKED -> EXECUTED -> RECOVERED
    """
    cust = Customer(id="cust_sm", name="StateMachine Tester", email="sm@example.com", tier="GROWTH")
    db_session.add(cust)
    db_session.flush()

    tx = Transaction(id="tx_sm", order_id="ord_sm", customer_id="cust_sm", amount=3500.0, status="FAILED")
    db_session.add(tx)
    db_session.flush()

    case = RecoveryCase(
        id="case_sm",
        transaction_id="tx_sm",
        risk_amount=3500.0,
        failure_category="CUSTOMER_ACTION_REQUIRED",
        current_step=RecoveryStep.DETECTED.value,
        status="DETECTED",
        attempt_count=1,
        max_attempts=3
    )
    db_session.add(case)
    db_session.commit()

    # Transition 1: ANALYZED
    case = recovery_state_machine.transition(case, RecoveryStep.ANALYZED.value, "Failure classified as UPI_TIMEOUT", db_session)
    assert case.current_step == RecoveryStep.ANALYZED.value

    # Transition 2: STRATEGY_SELECTED
    case = recovery_state_machine.transition(case, RecoveryStep.STRATEGY_SELECTED.value, "Strategy evaluated: UPI_SWITCH", db_session)
    assert case.current_step == RecoveryStep.STRATEGY_SELECTED.value

    # Transition 3: GUARDRAIL_CHECKED
    case = recovery_state_machine.transition(case, RecoveryStep.GUARDRAIL_CHECKED.value, "Guardrails cleared", db_session)
    assert case.current_step == RecoveryStep.GUARDRAIL_CHECKED.value

    # Transition 4: ACTION_EXECUTED
    case = recovery_state_machine.transition(case, RecoveryStep.ACTION_EXECUTED.value, "Paylink dispatched", db_session)
    assert case.current_step == RecoveryStep.ACTION_EXECUTED.value

    # Transition 5: RECOVERED
    case = recovery_state_machine.transition(case, RecoveryStep.RECOVERED.value, "Payment captured ₹3,500.00", db_session)
    assert case.current_step == RecoveryStep.RECOVERED.value
    assert case.status == "RECOVERED"
