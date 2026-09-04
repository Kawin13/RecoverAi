import os
import pytest
from app.core.config import settings
from app.ml.inference import MLInferenceEngine, inference_engine


def test_actual_model_type_identified_as_xgboost():
    """1. Actual model type is identified as XGBoost, with zero LightGBM confusion."""
    meta = inference_engine.get_metadata()
    assert meta["model_name"] == "XGBoost Gradient Boosted Decision Trees"
    assert "XGBoost" in meta["algorithm"]
    assert "LightGBM" not in meta["algorithm"]
    assert "lightgbm" not in str(meta).lower()


def test_model_artifacts_available_and_checksum_present():
    """2. All four required joblib artifacts and metadata exist with verifiable checksums."""
    artifacts_dir = inference_engine.artifacts_dir
    assert os.path.exists(os.path.join(artifacts_dir, "recovery_model.joblib"))
    assert os.path.exists(os.path.join(artifacts_dir, "recovery_preprocessor.joblib"))
    assert os.path.exists(os.path.join(artifacts_dir, "intervention_model.joblib"))
    assert os.path.exists(os.path.join(artifacts_dir, "intervention_preprocessor.joblib"))
    assert os.path.exists(os.path.join(artifacts_dir, "model_metadata.json"))

    assert inference_engine.is_loaded is True
    assert inference_engine.artifact_checksum is not None
    assert len(inference_engine.artifact_checksum) == 64  # Valid SHA-256 hex string


def test_model_loads_and_infers_in_production_configuration(monkeypatch):
    """3. Real model loads and infers cleanly in production configuration."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    engine = MLInferenceEngine()
    assert engine.is_loaded is True

    payload = {
        "amount": 3500.0,
        "payment_method": "UPI",
        "failure_reason": "UPI_TIMEOUT",
        "attempt_count": 1,
        "customer_value": "GROWTH"
    }
    result = engine.predict(payload)
    assert result["recovery_probability"] > 0
    assert result["model_metadata"]["scoring_mode"] == "ML_MODEL"
    assert result["model_metadata"]["loaded"] is True
    assert result["model_metadata"]["model_name"] == "XGBoost Gradient Boosted Decision Trees"


def test_production_fails_closed_when_model_unavailable(monkeypatch, auth_client):
    """4. Production environment fails closed with 'ML model unavailable' if artifacts are missing."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    
    # Simulate missing model artifacts in production
    engine = MLInferenceEngine()
    engine.rec_model = None
    engine.rec_preprocessor = None
    assert engine.is_loaded is False

    # Direct engine call raises RuntimeError
    with pytest.raises(RuntimeError, match="ML model unavailable"):
        engine.predict({"amount": 1000.0, "payment_method": "Card", "failure_reason": "TIMEOUT"})

    # API endpoint returns HTTP 503
    monkeypatch.setattr("app.api.v1.endpoints.ml.inference_engine", engine)
    res = auth_client.post("/api/ml/predict", json={
        "amount": 1000.0,
        "payment_method": "CARD",
        "failure_reason": "BANK_ERROR"
    })
    assert res.status_code == 503
    assert res.json()["detail"] == "ML model unavailable"


def test_fallback_correctly_labeled_and_no_misleading_names(monkeypatch):
    """5. Fallback scoring is explicitly labeled 'Deterministic Fallback' and never claims XGBoost."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    engine = MLInferenceEngine()
    engine.rec_model = None
    engine.rec_preprocessor = None
    engine.int_model = None
    engine.int_preprocessor = None
    assert engine.is_loaded is False

    meta = engine.get_metadata()
    assert meta["scoring_mode"] == "Deterministic Fallback"
    assert meta["model_name"] == "Deterministic Fallback Heuristic"
    assert meta["algorithm"] == "Rule-Based Deterministic Scoring"
    assert "XGBoost" not in meta["algorithm"]
    assert "LightGBM" not in meta["algorithm"]

    pred = engine.predict({"amount": 2500.0, "payment_method": "UPI", "failure_reason": "TIMEOUT"})
    assert pred["model_metadata"]["scoring_mode"] == "Deterministic Fallback"
    assert pred["model_metadata"]["model_name"] == "Deterministic Fallback Heuristic"
    assert pred["model_metadata"]["algorithm"] == "Rule-Based Deterministic Scoring"
    assert "XGBoost" not in pred["model_metadata"]["algorithm"]


def test_synthetic_data_disclosure():
    """6. Metadata contains explicit synthetic dataset disclosure without marketing claims."""
    meta = inference_engine.get_metadata()
    assert meta["dataset"]["type"] == "synthetic"
    disclosure = meta["dataset"]["disclosure"].lower()
    assert "synthetic" in disclosure
    assert "not trained on merchant-proven" in disclosure


def test_vip_model_and_fallback_meets_probability_threshold():
    """7. VIP high-value scenarios meet the >= 75% probability threshold in both ML and fallback."""
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

    # 1. ML Model Inference
    engine = MLInferenceEngine()
    pred_ml = engine.predict(payload)
    assert pred_ml["recovery_probability"] >= 0.75, (
        f"ML Model VIP recovery probability {pred_ml['recovery_probability']} is below 0.75"
    )

    # 2. Deterministic Fallback Inference
    engine.rec_model = None
    engine.rec_preprocessor = None
    pred_fb = engine.predict(payload)
    assert pred_fb["recovery_probability"] >= 0.75, (
        f"Fallback VIP recovery probability {pred_fb['recovery_probability']} is below 0.75"
    )


def test_insufficient_funds_payment_link_beats_retry_now():
    """8. In INSUFFICIENT_FUNDS, PAYMENT_LINK ERV decisively dominates RETRY_NOW ERV."""
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
    probs = pred["action_probabilities"]

    assert "PAYMENT_LINK" in ervs
    assert "RETRY_NOW" in ervs

    # Physical constraint: RETRY_NOW on depleted funds has negligible chance
    assert probs["RETRY_NOW"] <= 0.05
    # Alternate payment option has high recovery potential
    assert probs["PAYMENT_LINK"] >= 0.75

    # ERV of PAYMENT_LINK must beat RETRY_NOW
    assert ervs["PAYMENT_LINK"] > ervs["RETRY_NOW"]
    assert ervs["PAYMENT_LINK"] > (ervs["RETRY_NOW"] + 5000.0)


def test_health_endpoint_accurately_reports_ml_status(client, monkeypatch):
    """9. Health endpoint accurately reports true ML model readiness."""
    # When loaded
    res1 = client.get("/api/health")
    assert res1.status_code == 200
    assert res1.json()["ml_model_loaded"] is True

    # When unconfigured / missing
    monkeypatch.setattr(inference_engine, "rec_model", None)
    res2 = client.get("/api/health")
    assert res2.status_code == 200
    assert res2.json()["ml_model_loaded"] is False
