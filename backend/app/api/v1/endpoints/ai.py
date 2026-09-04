from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.database.session import get_db
from app.core.auth import get_current_user
from app.models import RecoveryCase, Transaction
from app.agents.gemini_agent import gemini_agent
from app.agents.decision_engine import decision_engine
from app.schemas.ai import AIExplanationResponse, AIMessageRequest, AIMessageResponse

router = APIRouter()

@router.post("/explain/{recovery_id}", response_model=AIExplanationResponse, summary="Explain Autonomous Decision Rationale via LLM")
def explain_recovery_case(
    recovery_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates an executive decision rationale for merchant operators explaining why
    the specific recovery strategy was selected over other candidate actions.
    Uses Google Gemini with deterministic fallback templates.
    """
    # Lookup recovery case or transaction with workspace isolation
    ws_id = current_user.get("workspace_id")
    rc_query = db.query(RecoveryCase).filter(RecoveryCase.id == recovery_id)
    if ws_id is not None:
        rc_query = rc_query.filter(RecoveryCase.workspace_id == ws_id)
    rc = rc_query.first()

    tx = None
    if rc and rc.transaction:
        tx = rc.transaction
    else:
        tx_query = db.query(Transaction).filter(Transaction.id == recovery_id)
        if ws_id is not None:
            tx_query = tx_query.filter(Transaction.workspace_id == ws_id)
        tx = tx_query.first()

    if not tx and not recovery_id.startswith("sim_"):
        raise HTTPException(
            status_code=404,
            detail=f"Recovery case or transaction '{recovery_id}' not found in current workspace."
        )

    if tx:
        cust = tx.customer
        latest_attempt = tx.payment_attempts[0] if tx.payment_attempts else None
        reason = (
            latest_attempt.error_code 
            if (latest_attempt and latest_attempt.error_code) 
            else (tx.recovery_case.failure_category if (tx.recovery_case and tx.recovery_case.failure_category) else "UNKNOWN")
        )
        tx_data = {
            "order_id": tx.order_id,
            "amount": tx.amount,
            "payment_method": tx.method,
            "failure_reason": reason,
            "customer_name": cust.name if cust else "Valued Customer",
            "customer_value": cust.tier if cust else "STANDARD"
        }
    else:
        # Strictly for simulated runs
        tx_data = {
            "order_id": f"ORD-{recovery_id[-6:] if len(recovery_id)>=6 else '99821'}",
            "amount": 3500.0,
            "payment_method": "UPI",
            "failure_reason": "UNKNOWN",
            "customer_name": "Rohan Sharma",
            "customer_value": "GROWTH"
        }

    # Run deterministic decision to obtain factual baseline
    decision_result = decision_engine.decide(tx_data)

    explanation = gemini_agent.explain_decision(
        recovery_id=recovery_id,
        transaction_data=tx_data,
        decision_data=decision_result
    )

    return explanation

@router.post("/message/{recovery_id}", response_model=AIMessageResponse, summary="Generate Multi-Lingual Customer Recovery Message")
def generate_recovery_message(
    recovery_id: str,
    payload: Optional[AIMessageRequest] = None,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates a localized, frictionless customer payment recovery notification in
    English (EN), Hindi (HI), Hinglish (HINGLISH), or Tamil (TA).
    """
    lang = payload.language if payload else "EN"

    ws_id = current_user.get("workspace_id")
    rc_query = db.query(RecoveryCase).filter(RecoveryCase.id == recovery_id)
    if ws_id is not None:
        rc_query = rc_query.filter(RecoveryCase.workspace_id == ws_id)
    rc = rc_query.first()

    tx = None
    if rc and rc.transaction:
        tx = rc.transaction
    else:
        tx_query = db.query(Transaction).filter(Transaction.id == recovery_id)
        if ws_id is not None:
            tx_query = tx_query.filter(Transaction.workspace_id == ws_id)
        tx = tx_query.first()

    if not tx and not recovery_id.startswith("sim_"):
        raise HTTPException(
            status_code=404,
            detail=f"Recovery case or transaction '{recovery_id}' not found in current workspace."
        )

    if tx:
        cust = tx.customer
        latest_attempt = tx.payment_attempts[0] if tx.payment_attempts else None
        reason = (
            latest_attempt.error_code 
            if (latest_attempt and latest_attempt.error_code) 
            else (tx.recovery_case.failure_category if (tx.recovery_case and tx.recovery_case.failure_category) else "UNKNOWN")
        )
        tx_data = {
            "order_id": tx.order_id,
            "amount": tx.amount,
            "payment_method": tx.method,
            "failure_reason": reason,
            "customer_name": cust.name if cust else "Customer"
        }
    else:
        # Strictly for simulated runs
        tx_data = {
            "order_id": f"ORD-{recovery_id[-6:] if len(recovery_id)>=6 else '99821'}",
            "amount": 2500.0,
            "payment_method": "UPI",
            "failure_reason": "UNKNOWN",
            "customer_name": "Customer"
        }

    decision_result = decision_engine.decide(tx_data)

    message = gemini_agent.generate_customer_message(
        recovery_id=recovery_id,
        transaction_data=tx_data,
        decision_data=decision_result,
        language=lang
    )

    return message
