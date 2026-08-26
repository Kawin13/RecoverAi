from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database.session import get_db
from app.models import Transaction, RecoveryCase, AgentDecision, AuditLog
from app.agents.decision_engine import decision_engine
from app.agents.evaluator import strategy_evaluator
from app.agents.diagnosis import diagnosis_engine
from app.schemas.recovery_decision import (
    RecoveryAnalysisResponse,
    StrategyComparisonItem,
    RecoveryAnalysisOverride
)

router = APIRouter()

@router.post("/analyze/{transaction_id}", response_model=RecoveryAnalysisResponse, summary="Analyze Transaction & Select Optimal Intervention")
def analyze_recovery_decision(
    transaction_id: str,
    override: Optional[RecoveryAnalysisOverride] = None,
    db: Session = Depends(get_db)
):
    """
    Executes full decision intelligence: Failure diagnosis, ML propensity estimation,
    ERV minor unit calculation, guardrail filtering, and factual evidence synthesis.
    Updates the transaction's recovery case and records an AgentDecision in the database.
    """
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    # Extract data from DB transaction or use dynamic defaults
    if tx:
        cust = tx.customer
        latest_attempt = tx.payment_attempts[0] if tx.payment_attempts else None
        tx_data = {
            "transaction_id": tx.id,
            "amount": tx.amount,
            "payment_method": tx.method,
            "failure_reason": latest_attempt.error_code if latest_attempt else (tx.recovery_case.failure_category if tx.recovery_case else "UPI_TIMEOUT"),
            "failure_category": latest_attempt.error_category if latest_attempt else "TECHNICAL_TIMEOUT",
            "attempt_count": len(tx.payment_attempts) if tx.payment_attempts else 1,
            "previous_successes": 15,
            "previous_failures": 1,
            "preferred_method": tx.method,
            "customer_value": cust.tier if cust else "GROWTH",
            "customer_tenure_days": 180
        }
    else:
        # Dynamic fallback data if simulated ID
        tx_data = {
            "transaction_id": transaction_id,
            "amount": 3500.0,
            "payment_method": "UPI",
            "failure_reason": "UPI_TIMEOUT",
            "failure_category": "TECHNICAL_TIMEOUT",
            "attempt_count": 1,
            "previous_successes": 12,
            "previous_failures": 2,
            "preferred_method": "UPI",
            "customer_value": "GROWTH",
            "customer_tenure_days": 150
        }

    # Apply overrides if provided
    if override:
        if override.amount is not None: tx_data["amount"] = override.amount
        if override.payment_method is not None: tx_data["payment_method"] = override.payment_method
        if override.failure_reason is not None: tx_data["failure_reason"] = override.failure_reason
        if override.attempt_count is not None: tx_data["attempt_count"] = override.attempt_count

    # Execute Decision Intelligence
    decision_result = decision_engine.decide(tx_data)
    decision_result["transaction_id"] = transaction_id

    # If transaction exists in DB, update RecoveryCase and add AgentDecision
    if tx and tx.recovery_case:
        rc = tx.recovery_case
        rc.selected_strategy = decision_result["selected_action"]
        rc.recovery_probability = decision_result["recovery_probability"]
        rc.expected_recovery_value = decision_result["expected_recovery_value"]
        
        # Save AgentDecision record
        new_dec = AgentDecision(
            id=f"dec_{int(hash(transaction_id) % 1000000)}",
            recovery_case_id=rc.id,
            model_name="XGBoost+ERV-Deterministic",
            input_features=str(tx_data),
            propensity_scores=str({e["action"]: e["probability"] for e in decision_result["strategies_comparison"]}),
            selected_action=decision_result["selected_action"],
            reasoning_summary="; ".join(decision_result["evidence"])
        )
        db.add(new_dec)
        db.commit()

    return decision_result

@router.get("/{id}/strategies", response_model=List[StrategyComparisonItem], summary="Get Strategy Evaluation Ranking for Case/Transaction")
def get_recovery_strategies(id: str, db: Session = Depends(get_db)):
    """
    Returns the real-time ranked comparison of all candidate recovery strategies for a transaction or case.
    """
    tx = db.query(Transaction).filter((Transaction.id == id) | (Transaction.order_id == id)).first()
    if not tx:
        # Check recovery case
        rc = db.query(RecoveryCase).filter(RecoveryCase.id == id).first()
        if rc:
            tx = rc.transaction

    if tx:
        latest_attempt = tx.payment_attempts[0] if tx.payment_attempts else None
        tx_data = {
            "amount": tx.amount,
            "payment_method": tx.method,
            "failure_reason": latest_attempt.error_code if latest_attempt else "UPI_TIMEOUT",
            "attempt_count": len(tx.payment_attempts) if tx.payment_attempts else 1,
            "customer_value": tx.customer.tier if tx.customer else "STANDARD"
        }
    else:
        tx_data = {
            "amount": 2500.0,
            "payment_method": "UPI",
            "failure_reason": "UPI_TIMEOUT",
            "attempt_count": 1,
            "customer_value": "GROWTH"
        }

    diagnosis = diagnosis_engine.diagnose(tx_data["failure_reason"], tx_data["payment_method"], tx_data["attempt_count"])
    evaluations = strategy_evaluator.evaluate_strategies(tx_data, diagnosis)
    return evaluations
