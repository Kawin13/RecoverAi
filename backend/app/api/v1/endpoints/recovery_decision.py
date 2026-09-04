from fastapi import APIRouter, HTTPException, Depends, Body, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database.session import get_db
from app.core.auth import get_current_user
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
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Executes full decision intelligence: Failure diagnosis, ML propensity estimation,
    ERV minor unit calculation, guardrail filtering, and factual evidence synthesis.
    Updates the transaction's recovery case and records an AgentDecision in the database.
    """
    ws_id = current_user.get("workspace_id")
    tx_query = db.query(Transaction).filter(Transaction.id == transaction_id)
    if ws_id is not None:
        tx_query = tx_query.filter(Transaction.workspace_id == ws_id)
    tx = tx_query.first()
    
    has_override = bool(
        override and any(
            getattr(override, field, None) is not None
            for field in ["amount", "payment_method", "failure_reason", "attempt_count"]
        )
    )

    if not tx and not transaction_id.startswith("sim_") and not has_override:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction '{transaction_id}' not found in current workspace."
        )

    # Extract data from DB transaction or use simulation parameters
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
        # Dynamic fallback data strictly for simulated IDs or overrides
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
            workspace_id=tx.workspace_id,
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
def get_recovery_strategies(
    id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns the real-time ranked comparison of all candidate recovery strategies for a transaction or case.
    """
    ws_id = current_user.get("workspace_id")
    tx_q = db.query(Transaction).filter((Transaction.id == id) | (Transaction.order_id == id))
    if ws_id is not None:
        tx_q = tx_q.filter(Transaction.workspace_id == ws_id)
    tx = tx_q.first()
    if not tx:
        # Check recovery case
        rc_q = db.query(RecoveryCase).filter(RecoveryCase.id == id)
        if ws_id is not None:
            rc_q = rc_q.filter(RecoveryCase.workspace_id == ws_id)
        rc = rc_q.first()
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
