from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from app.schemas.ml import PredictionRequest, PredictionResponse
from app.ml.inference import inference_engine
from app.core.auth import get_current_user

router = APIRouter()

@router.post("/predict", response_model=PredictionResponse, summary="Predict Recovery Propensity & Optimal Intervention")
def predict_recovery(
    payload: PredictionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Computes genuine XGBoost-powered Recovery Propensity P(recovery) and Action-Conditioned
    success probabilities for candidate interventions (RETRY_NOW, RETRY_LATER, UPI_SWITCH,
    PAYMENT_LINK, PERSONALIZED_REMINDER, HUMAN_ESCALATION, NO_ACTION) with Expected Recovery Value (ERV).
    """
    try:
        result = inference_engine.predict(payload.model_dump())
        return result
    except RuntimeError as e:
        if "ML model unavailable" in str(e):
            raise HTTPException(status_code=503, detail="ML model unavailable")
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@router.get("/model-info", summary="Retrieve ML Model Architecture & Test Metrics")
def get_model_info(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns production ML metadata, features, and hold-out test set performance metrics.
    """
    return inference_engine.get_metadata()
