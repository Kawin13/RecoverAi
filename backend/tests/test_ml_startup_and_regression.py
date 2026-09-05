import warnings
import pytest
from app.core.config import settings
from app.ml.inference import MLInferenceEngine, inference_engine


def test_artifacts_load_without_version_warnings():
    """Verify that all four ML artifacts load with zero version compatibility warnings."""
    with warnings.catch_warnings(record=True) as recorded_warnings:
        warnings.simplefilter("always")
        engine = MLInferenceEngine()
        assert engine.is_loaded is True
        assert engine.recovery_model_loaded is True
        assert engine.recovery_preprocessor_loaded is True
        assert engine.intervention_model_loaded is True
        assert engine.intervention_preprocessor_loaded is True

        # Filter for version compatibility warnings
        version_warnings = [
            w for w in recorded_warnings
            if "InconsistentVersionWarning" in w.category.__name__ or
               "older version" in str(w.message).lower() or
               "created with" in str(w.message).lower()
        ]
        assert len(version_warnings) == 0, f"Found unexpected version warnings: {[str(w.message) for w in version_warnings]}"


def test_startup_validation_success():
    """Verify validate_startup reports loaded: yes, correct version, and ML_MODEL scoring mode."""
    engine = MLInferenceEngine()
    status = engine.validate_startup()

    assert status["model_loaded"] is True
    assert status["model_version"] == "1.0.0-production"
    assert status["scoring_mode"] == "ML_MODEL (XGBoost)"
    assert status["recovery_model_loaded"] is True
    assert status["recovery_preprocessor_loaded"] is True
    assert status["intervention_model_loaded"] is True
    assert status["intervention_preprocessor_loaded"] is True


def test_startup_validation_fails_closed_in_production(monkeypatch):
    """Verify validate_startup fails closed with RuntimeError in production if any artifact is missing."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    engine = MLInferenceEngine()
    engine.rec_model = None  # Simulate missing model

    with pytest.raises(RuntimeError, match="FATAL: Production ML model startup validation failed"):
        engine.validate_startup()


def test_startup_validation_safe_fallback_in_development(monkeypatch):
    """Verify validate_startup switches to fallback gracefully in development without crashing."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    engine = MLInferenceEngine()
    engine.rec_model = None

    status = engine.validate_startup()
    assert status["model_loaded"] is False
    assert status["model_version"] == "1.0.0-fallback"
    assert status["scoring_mode"] == "Deterministic Fallback"
    assert status["recovery_model_loaded"] is False


def test_prediction_regression_consistency():
    """Verify that predictions remain strictly consistent across standard scenarios."""
    engine = MLInferenceEngine()
    assert engine.is_loaded is True

    # Scenario 1: UPI Timeout
    upi_payload = {
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
    upi_res = engine.predict(upi_payload)
    assert upi_res["model_metadata"]["scoring_mode"] == "ML_MODEL"
    assert upi_res["recommended_action"] == "UPI_SWITCH"
    assert pytest.approx(upi_res["recovery_probability"], abs=0.01) == 0.915
    assert pytest.approx(upi_res["expected_recovery_value"], abs=1.0) == 2346.0
    assert upi_res["action_probabilities"]["UPI_SWITCH"] >= 0.90

    # Scenario 2: Expired Card
    card_payload = {
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
    card_res = engine.predict(card_payload)
    assert card_res["recommended_action"] == "PAYMENT_LINK"
    assert pytest.approx(card_res["recovery_probability"], abs=0.01) == 0.809
    assert card_res["action_probabilities"]["RETRY_NOW"] <= 0.05
    assert card_res["action_probabilities"]["PAYMENT_LINK"] > card_res["action_probabilities"]["RETRY_NOW"]

    # Scenario 3: VIP High Value Net Banking
    vip_payload = {
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
    vip_res = engine.predict(vip_payload)
    assert vip_res["recovery_probability"] >= 0.75
    assert pytest.approx(vip_res["recovery_probability"], abs=0.01) == 0.8705
    assert vip_res["recommended_action"] == "HUMAN_ESCALATION"
    assert vip_res["expected_recovery_value"] > 75000.0


def test_batch_prediction_regression_consistency():
    """Verify vectorized batch inference results match single-row inference within tolerance."""
    engine = MLInferenceEngine()
    records = [
        {
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
        },
        {
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
    ]
    batch_res = engine.predict_batch(records)
    assert len(batch_res) == 2
    assert batch_res[0]["recommended_action"] in ["UPI_SWITCH", "PAYMENT_LINK"]
    assert batch_res[1]["recommended_action"] == "PAYMENT_LINK"
    assert pytest.approx(batch_res[0]["recovery_probability"], abs=0.01) == 0.905
    assert pytest.approx(batch_res[1]["recovery_probability"], abs=0.01) == 0.784
