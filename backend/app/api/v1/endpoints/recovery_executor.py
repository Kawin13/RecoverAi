import uuid
import time
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any, Optional

from app.database.session import get_db
from app.core.logging import logger
from app.core.events import event_broadcaster
from app.models import RecoveryCase, Transaction, PaymentLink
from app.services.recovery_executor import recovery_state_machine, RecoveryStep
from app.services.notification_service import notification_service
from app.services.razorpay_service import razorpay_service
from app.schemas.recovery_executor import (
    WorkflowCaseResponse,
    WorkflowListResponse,
    WorkflowStepRequest,
    WorkflowOutcomeRequest,
    PaymentLinkResponse
)

router = APIRouter()

def _serialize_case(case: RecoveryCase) -> Dict[str, Any]:
    tx = case.transaction
    cust = tx.customer if tx else None
    return {
        "id": case.id,
        "transaction_id": case.transaction_id,
        "order_id": tx.order_id if tx else None,
        "customer_name": cust.name if cust else "Valued Customer",
        "customer_tier": cust.tier if cust else "GROWTH",
        "customer_phone": cust.phone if cust else "+919876543210",
        "risk_amount": case.risk_amount,
        "failure_category": case.failure_category,
        "selected_strategy": case.selected_strategy or "PAYMENT_LINK",
        "current_step": case.current_step or case.status or "DETECTED",
        "status": case.status or "DETECTED",
        "attempt_count": case.attempt_count,
        "max_attempts": case.max_attempts,
        "channel": case.channel or "IN_APP",
        "expected_recovery_value": case.expected_recovery_value,
        "recovery_probability": case.recovery_probability,
        "scheduled_at": case.scheduled_at,
        "executed_at": case.executed_at,
        "execution_payload": case.execution_payload,
        "payment_links": [
            {
                "id": pl.id,
                "payment_link_id": pl.payment_link_id,
                "short_url": pl.short_url,
                "amount": pl.amount,
                "status": pl.status,
                "is_live_demo": pl.is_live_demo,
                "created_at": pl.created_at
            }
            for pl in (case.payment_links or [])
        ],
        "created_at": case.created_at,
        "updated_at": case.updated_at
    }

@router.get("/workflows", response_model=WorkflowListResponse, summary="List Active Recovery Agent Workflows")
def list_workflows(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Returns active recovery cases showing their state machine position,
    bounded attempt count, current strategy, and payment link associations.
    Uses eager joinedload to eliminate N+1 network roundtrips.
    """
    cases = (
        db.query(RecoveryCase)
        .options(
            joinedload(RecoveryCase.transaction).joinedload(Transaction.customer),
            joinedload(RecoveryCase.payment_links)
        )
        .order_by(RecoveryCase.created_at.desc())
        .limit(limit)
        .all()
    )
    serialized = [_serialize_case(c) for c in cases]
    active_count = sum(1 for c in cases if c.status not in ("RECOVERED", "STOPPED"))

    return {
        "total_cases": len(cases),
        "active_cases": active_count,
        "workflows": serialized
    }

@router.get("/workflows/{case_id}", response_model=WorkflowCaseResponse, summary="Get Single Recovery Workflow")
def get_workflow(
    case_id: str,
    db: Session = Depends(get_db)
):
    case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")
    return _serialize_case(case)

@router.post("/workflows/{case_id}/step", summary="Advance Recovery Workflow by One Step")
def advance_workflow_step(
    case_id: str,
    payload: WorkflowStepRequest = WorkflowStepRequest(),
    db: Session = Depends(get_db)
):
    """
    Advances a single case through the 10-state machine by exactly one bounded step.
    Produces an AuditLog row on every transition.
    """
    case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    updated_case, step_info = recovery_state_machine.advance_step(
        case=case,
        db=db,
        is_live_demo=payload.is_live_demo
    )
    return {
        "status": "success",
        "case": _serialize_case(updated_case),
        "step_result": step_info
    }

@router.post("/workflows/{case_id}/execute", summary="Execute Workflow Full Pipeline")
def execute_workflow(
    case_id: str,
    payload: WorkflowStepRequest = WorkflowStepRequest(),
    db: Session = Depends(get_db)
):
    """
    Runs autonomous pipeline through to WAITING_FOR_CUSTOMER or terminal state.
    Guarantees bounded attempts without infinite loops.
    """
    case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    steps_taken = recovery_state_machine.execute_full_pipeline(
        case=case,
        db=db,
        is_live_demo=payload.is_live_demo
    )
    db.refresh(case)
    return {
        "status": "success",
        "case": _serialize_case(case),
        "steps_taken": steps_taken
    }

@router.post("/workflows/{case_id}/payment-link", response_model=PaymentLinkResponse, summary="Generate Genuine Razorpay Test Payment Link")
def generate_payment_link(
    case_id: str,
    payload: WorkflowStepRequest = WorkflowStepRequest(),
    db: Session = Depends(get_db)
):
    """
    Creates a real Razorpay Test Payment Link (POST /v1/payment_links) for demo checkout.
    Persists to database with exact short_url and emits real-time event.
    """
    case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    tx = case.transaction
    cust = tx.customer if tx else None

    amount_paise = int(round(case.risk_amount * 100))
    unique_ref = f"rcov_{case.id}_{int(time.time())}_{uuid.uuid4().hex[:4]}"
    notes = {
        "recovery_case_id": case.id,
        "transaction_id": tx.id if tx else "",
        "environment": "test"
    }

    try:
        link_res = razorpay_service.create_payment_link(
            amount_paise=amount_paise,
            customer_name=cust.name if cust else "Valued Customer",
            customer_email=cust.email if cust else "customer@example.com",
            customer_contact=cust.phone if cust else "+919876543210",
            description=f"RecoverAI payment recovery for #{tx.order_id if tx else case.id}",
            notes=notes,
            reference_id=unique_ref,
            is_live_demo=payload.is_live_demo
        )
    except Exception as exc:
        logger.error(f"Failed to create Razorpay Payment Link for case {case_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Payment Link creation failed: {str(exc)}"
        )

    plink_record = PaymentLink(
        id=f"pl_{uuid.uuid4().hex[:10]}",
        payment_link_id=link_res["payment_link_id"],
        recovery_case_id=case.id,
        short_url=link_res["short_url"],
        amount=case.risk_amount,
        currency="INR",
        status=link_res.get("status", "created"),
        is_live_demo=link_res.get("is_live_demo", False)
    )
    db.add(plink_record)
    db.commit()
    db.refresh(plink_record)

    event_broadcaster.broadcast_sync("RECOVERY_QUEUE_UPDATED", {
        "case_id": case.id,
        "payment_link_id": plink_record.payment_link_id,
        "short_url": plink_record.short_url,
        "status": plink_record.status
    })

    return plink_record

@router.post("/workflows/{case_id}/simulate-outcome", summary="Simulate Customer Recovery or Timeout")
def simulate_outcome(
    case_id: str,
    payload: WorkflowOutcomeRequest,
    db: Session = Depends(get_db)
):
    """
    Simulates customer recovery ('RECOVERED') or timeout ('FAILED').
    Tests downstream state machine branches, attempt counting, and bounded halts.
    """
    case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    updated_case = recovery_state_machine.simulate_outcome(
        case=case,
        outcome=payload.outcome,
        db=db
    )
    return {
        "status": "success",
        "case": _serialize_case(updated_case)
    }

@router.get("/notifications", summary="Get Recent Notification Receipts")
def get_notifications(
    case_id: Optional[str] = None,
    limit: int = 20
):
    """Returns recent notification simulation receipts labeled with DEMO DELIVERY."""
    return notification_service.get_recent_notifications(case_id=case_id, limit=limit)
