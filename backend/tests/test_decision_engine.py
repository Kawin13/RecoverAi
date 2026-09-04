import pytest
from fastapi.testclient import TestClient
from app.agents.diagnosis import diagnosis_engine, FailureTaxonomy
from app.agents.evaluator import strategy_evaluator
from app.agents.decision_engine import decision_engine
from app.core.decision_config import decision_config, PAISE_PER_INR

def test_failure_diagnosis_taxonomy():
    d1 = diagnosis_engine.diagnose("UPI_TIMEOUT", "UPI", 1)
    assert d1["taxonomy"] == FailureTaxonomy.TEMPORARY.value
    assert d1["is_transient"] is True

    d2 = diagnosis_engine.diagnose("EXPIRED_CARD", "CARD", 1)
    assert d2["taxonomy"] == FailureTaxonomy.PAYMENT_METHOD_SPECIFIC.value
    assert d2["is_retryable_same_instrument"] is False

    d3 = diagnosis_engine.diagnose("OTP_FAILED", "CARD", 1)
    assert d3["taxonomy"] == FailureTaxonomy.CUSTOMER_ACTION_REQUIRED.value

    d4 = diagnosis_engine.diagnose("CHECKOUT_ABANDONED", "UPI", 1)
    assert d4["taxonomy"] == FailureTaxonomy.ABANDONMENT.value

    d5 = diagnosis_engine.diagnose("FRAUD_ALERT", "CARD", 1)
    assert d5["taxonomy"] == FailureTaxonomy.RISK_BLOCKED.value

def test_erv_mathematical_precision():
    tx_data = {
        "amount": 5000.0,
        "payment_method": "UPI",
        "failure_reason": "UPI_TIMEOUT",
        "attempt_count": 1,
        "customer_value": "GROWTH"
    }
    diagnosis = diagnosis_engine.diagnose("UPI_TIMEOUT", "UPI", 1)
    strategies = strategy_evaluator.evaluate_strategies(tx_data, diagnosis)

    assert len(strategies) == 7
    for s in strategies:
        # Check ERV paise consistency
        assert s["erv_paise"] == int(s["expected_recovery_value"] * PAISE_PER_INR)
        # Cost + friction must be deducted
        if s["action"] != "NO_ACTION" and s["probability"] > 0:
            expected_gross = s["probability"] * 5000.0
            expected_net = expected_gross - s["cost"] - s["friction_penalty"] - s["risk_penalty"]
            assert abs(s["expected_recovery_value"] - round(max(0.0, expected_net), 2)) <= 0.05

def test_guardrail_expired_card_retry_blocked():
    tx_data = {
        "amount": 3500.0,
        "payment_method": "CARD",
        "failure_reason": "EXPIRED_CARD",
        "attempt_count": 1,
        "customer_value": "STANDARD"
    }
    diagnosis = diagnosis_engine.diagnose("EXPIRED_CARD", "CARD", 1)
    strategies = strategy_evaluator.evaluate_strategies(tx_data, diagnosis)

    retry_now = next(s for s in strategies if s["action"] == "RETRY_NOW")
    retry_later = next(s for s in strategies if s["action"] == "RETRY_LATER")
    payment_link = next(s for s in strategies if s["action"] == "PAYMENT_LINK")

    assert retry_now["allowed"] is False
    assert "Guardrail" in retry_now["guardrail_reason"]
    assert retry_later["allowed"] is False
    # Payment link should remain allowed
    assert payment_link["allowed"] is True

def test_no_action_on_risk_blocked():
    decision = decision_engine.decide({
        "amount": 50000.0,
        "payment_method": "CARD",
        "failure_reason": "FRAUD_ALERT",
        "attempt_count": 1
    })

    assert decision["selected_action"] == "NO_ACTION"
    assert "NO_ACTION" in decision["evidence"][-1]

def test_decision_evidence_generation():
    decision = decision_engine.decide({
        "amount": 4500.0,
        "payment_method": "CARD",
        "failure_reason": "CARD_DECLINED",
        "attempt_count": 2,
        "previous_successes": 8,
        "previous_failures": 1,
        "preferred_method": "UPI",
        "customer_value": "GROWTH"
    })

    assert len(decision["evidence"]) >= 3
    # Check that factual evidence contains details
    evidence_str = " ".join(decision["evidence"])
    assert "attempt #2" in evidence_str
    assert "8/9" in evidence_str
    assert "Expected Recovery Value" in evidence_str

def test_recovery_analyze_endpoint(auth_client):
    response = auth_client.post("/api/recovery/analyze/tx_rec_98214")
    assert response.status_code == 200
    data = response.json()

    assert data["transaction_id"] == "tx_rec_98214"
    assert "selected_action" in data
    assert "expected_recovery_value" in data
    assert len(data["strategies_comparison"]) == 7
    assert len(data["evidence"]) >= 2
    assert "diagnosis" in data

def test_get_strategies_endpoint(auth_client):
    response = auth_client.get("/api/recovery/tx_rec_98214/strategies")
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) == 7
    # Check rank ordering
    ranks = [item["rank"] for item in data]
    assert ranks == list(range(1, 8))
