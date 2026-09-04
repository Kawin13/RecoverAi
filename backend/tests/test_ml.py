import pytest
from fastapi.testclient import TestClient

def test_ml_model_info(auth_client):
    response = auth_client.get("/api/ml/model-info")
    assert response.status_code == 200
    data = response.json()
    assert "algorithm" in data
    assert "model_version" in data
    assert "metrics" in data

def test_ml_predict_upi_timeout(auth_client):
    payload = {
        "amount": 2500.0,
        "payment_method": "UPI",
        "failure_reason": "UPI_TIMEOUT",
        "failure_category": "TECHNICAL_TIMEOUT",
        "attempt_count": 1,
        "previous_successes": 15,
        "previous_failures": 1,
        "preferred_method": "UPI",
        "customer_value": "GROWTH",
        "bank": "State Bank of India"
    }
    response = auth_client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert 0.0 < data["recovery_probability"] <= 1.0
    assert "action_probabilities" in data
    assert "action_ervs" in data
    assert data["recommended_action"] in [
        "UPI_SWITCH", "PAYMENT_LINK", "RETRY_LATER", "RETRY_NOW",
        "PERSONALIZED_REMINDER", "HUMAN_ESCALATION"
    ]
    # For transient UPI timeout, UPI_SWITCH should be high
    assert data["action_probabilities"]["UPI_SWITCH"] > 0.60
    assert data["expected_recovery_value"] > 0

def test_ml_predict_expired_card(auth_client):
    payload = {
        "amount": 4200.0,
        "payment_method": "CARD",
        "failure_reason": "EXPIRED_CARD",
        "failure_category": "INVALID_INSTRUMENT",
        "attempt_count": 1,
        "previous_successes": 8,
        "previous_failures": 1,
        "preferred_method": "CARD",
        "customer_value": "STANDARD",
        "bank": "HDFC Bank"
    }
    response = auth_client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Immediate same-card retry must have very low probability
    assert data["action_probabilities"]["RETRY_NOW"] <= 0.10
    # Payment link for alternate payment / updated card should be much higher
    assert data["action_probabilities"]["PAYMENT_LINK"] > data["action_probabilities"]["RETRY_NOW"]

def test_ml_attempt_count_fatigue(auth_client):
    payload_attempt1 = {
        "amount": 5000.0,
        "payment_method": "UPI",
        "failure_reason": "INSUFFICIENT_FUNDS",
        "failure_category": "FINANCIAL_LIMIT",
        "attempt_count": 1,
        "previous_successes": 10,
        "previous_failures": 2,
        "customer_value": "STANDARD"
    }
    payload_attempt4 = {
        "amount": 5000.0,
        "payment_method": "UPI",
        "failure_reason": "INSUFFICIENT_FUNDS",
        "failure_category": "FINANCIAL_LIMIT",
        "attempt_count": 4,
        "previous_successes": 10,
        "previous_failures": 2,
        "customer_value": "STANDARD"
    }

    res1 = auth_client.post("/api/ml/predict", json=payload_attempt1)
    res4 = auth_client.post("/api/ml/predict", json=payload_attempt4)

    assert res1.status_code == 200
    assert res4.status_code == 200

    prob1 = res1.json()["recovery_probability"]
    prob4 = res4.json()["recovery_probability"]
    
    # Attempt 1 must have higher recovery propensity than attempt 4
    assert prob1 > prob4

def test_ml_vip_high_value(auth_client):
    payload = {
        "amount": 85000.0,
        "payment_method": "NET_BANKING",
        "failure_reason": "BANK_TIMEOUT",
        "failure_category": "TECHNICAL_TIMEOUT",
        "attempt_count": 1,
        "previous_successes": 45,
        "previous_failures": 2,
        "preferred_method": "NET_BANKING",
        "customer_value": "VIP",
        "bank": "ICICI Bank"
    }
    response = auth_client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["recovery_probability"] >= 0.75
    assert data["expected_recovery_value"] > 50000.0
    # Confidence interval bounds
    assert data["confidence_interval"]["lower_bound"] <= data["recovery_probability"]
    assert data["confidence_interval"]["upper_bound"] >= data["recovery_probability"]
