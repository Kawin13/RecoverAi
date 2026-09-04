"""
RecoverAI - Fintech Guardrails & Human Approval API Endpoints
Provides central policy inspection, human-in-the-loop approval actions, and 'Why Was This Stopped?' forensics.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any, Optional

from app.database.session import get_db
from app.models import RecoveryCase, Transaction, GuardrailEvent, AuditLog
from app.core.guardrail_policy import guardrail_policy
from app.services.guardrails_service import guardrails_service
from app.core.auth import get_current_user, require_admin
from app.schemas.guardrails import (
    GuardrailPoliciesResponse,
    HumanApprovalQueueItem,
    HumanApprovalActionRequest,
    WhyStoppedForensicResponse
)

router = APIRouter()


@router.get("/policies", response_model=GuardrailPoliciesResponse, summary="Get Central Guardrail Policies")
def get_policies(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Returns the central fintech guardrail policy rules, threshold values, descriptions, and statuses."""
    rules = guardrail_policy.get_rules()
    summary = guardrail_policy.get_summary()
    return {
        "policy_version": guardrail_policy.POLICY_VERSION,
        "summary": summary,
        "rules": [r.model_dump() for r in rules]
    }

@router.get("/approval-queue", response_model=List[HumanApprovalQueueItem], summary="Get Human Approval Queue")
def get_approval_queue(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns high-value or gated cases requiring human supervisor sign-off before intervention dispatch.
    A case enters and remains in this queue ONLY when an explicit guardrail sets requires_approval = True.
    Transactions below ₹10,000 without explicit approval triggers are automatically unblocked and cleared.
    """
    ws_id = current_user.get("workspace_id")
    query = (
        db.query(RecoveryCase)
        .options(
            joinedload(RecoveryCase.transaction).joinedload(Transaction.customer)
        )
        .filter(RecoveryCase.status.in_(["PENDING_APPROVAL", "IN_PROGRESS", "ATTEMPTING", "DETECTED", "ACTION_SCHEDULED", "MANUAL_ESCALATION", "POLICY_OVERRIDE"]))
    )
    if ws_id is not None:
        query = query.filter(RecoveryCase.workspace_id == ws_id)

    cases = query.order_by(RecoveryCase.created_at.desc()).all()

    items = []
    for c in cases:
        decision = guardrails_service.evaluate(c, db)
        if decision.requires_approval:
            # Sync database status if not already PENDING_APPROVAL
            if c.status != "PENDING_APPROVAL":
                c.status = "PENDING_APPROVAL"
                c.current_step = "PENDING_APPROVAL"
                db.add(c)
                db.commit()

            tx = c.transaction
            cust = tx.customer if tx else None
            items.append({
                "case_id": c.id,
                "transaction_id": c.transaction_id,
                "order_id": tx.order_id if tx else None,
                "customer_name": cust.name if cust else "Valued Customer",
                "customer_tier": cust.tier if cust else "GROWTH",
                "customer_phone": cust.phone if cust else "+919876543210",
                "amount": c.risk_amount,
                "currency": "INR",
                "failure_category": c.failure_category,
                "selected_strategy": c.selected_strategy or "PAYMENT_LINK",
                "channel": c.channel or "IN_APP",
                "expected_recovery_value": c.expected_recovery_value,
                "recovery_probability": c.recovery_probability,
                "reason_code": decision.reason_code,
                "human_readable_reason": f"Reason: {decision.reason_code} — {decision.human_readable_reason}",
                "created_at": c.created_at,
                "updated_at": c.updated_at
            })
        elif c.status == "PENDING_APPROVAL":
            # If all safety policies are cleared and requires_approval is false: remove from approval queue
            from datetime import datetime
            if decision.allowed:
                c.status = "ACTION_SCHEDULED"
                c.current_step = "ACTION_SCHEDULED"
            else:
                c.status = "STOPPED"
                c.current_step = "STOPPED"
            c.updated_at = datetime.utcnow()
            db.add(c)
            db.commit()

    return items

@router.post("/approval-queue/{case_id}/decision", summary="Submit Human Supervisor Decision (Admin Only)")
def submit_approval_decision(
    case_id: str,
    payload: HumanApprovalActionRequest,
    db: Session = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Processes human operator action (APPROVE, REJECT, NO_ACTION).
    Strictly restricted to Administrators with require_admin().
    Monetary amounts cannot be altered. Logs operator identity and audit details.
    """
    admin_ws = admin_user.get("workspace_id")
    query = db.query(RecoveryCase).filter(RecoveryCase.id == case_id)
    if admin_ws is not None:
        query = query.filter(RecoveryCase.workspace_id == admin_ws)
    case = query.first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    try:
        operator_display = payload.operator_name or admin_user.get("email") or "Administrator"
        res = guardrails_service.process_human_approval(
            case=case,
            decision=payload.decision,
            operator_name=operator_display,
            operator_notes=payload.operator_notes,
            db=db
        )
        return {"status": "success", "approval_record": res}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))


@router.get("/forensics/{case_id}", response_model=WhyStoppedForensicResponse, summary="'Why Was This Stopped?' Forensic Inspection")
def get_why_stopped_forensics(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Forensic deep-dive explaining why an autonomous recovery case was halted, blocked, or suppressed.
    Synthesizes guardrail rule breaches, fraud markers, opt-out status, and audit history.
    """
    ws_id = current_user.get("workspace_id")
    query = db.query(RecoveryCase).filter(RecoveryCase.id == case_id)
    if ws_id is not None:
        query = query.filter(RecoveryCase.workspace_id == ws_id)
    case = query.first()
    if not case:
        raise HTTPException(status_code=404, detail="Recovery case not found")

    decision = guardrails_service.evaluate(case, db)
    cust = case.transaction.customer if case.transaction else None

    # Check opt-out and fraud
    cust_notes = getattr(cust, "notes", "") or ""
    tier = getattr(cust, "tier", "") or ""
    is_opted_out = "OPT_OUT" in cust_notes.upper() or "DND" in cust_notes.upper() or "OPTED_OUT" in tier.upper() or "OPT_OUT" in case.failure_category.upper()
    is_fraud = case.failure_category in guardrail_policy.RISK_TAXONOMIES or "FRAUD" in case.failure_category.upper()

    # Load audit records
    audit_q = db.query(AuditLog).filter(AuditLog.recovery_case_id == case.id)
    if ws_id is not None:
        audit_q = audit_q.filter(AuditLog.workspace_id == ws_id)
    audits = audit_q.order_by(AuditLog.created_at.desc()).limit(10).all()

    audit_list = [
        {
            "id": a.id,
            "actor": a.actor,
            "action_type": a.action_type,
            "details": a.details,
            "timestamp": a.created_at.isoformat()
        }
        for a in audits
    ]

    return {
        "case_id": case.id,
        "transaction_id": case.transaction_id,
        "status": case.status,
        "current_step": case.current_step or case.status,
        "reason_code": decision.reason_code,
        "human_readable_reason": decision.human_readable_reason,
        "policy_version": guardrail_policy.POLICY_VERSION,
        "attempt_count": case.attempt_count,
        "max_attempts": case.max_attempts,
        "customer_opted_out": is_opted_out,
        "fraud_flag_detected": is_fraud,
        "failure_category": case.failure_category,
        "risk_amount": case.risk_amount,
        "rule_breached": decision.reason_code,
        "suggested_action": decision.suggested_action or "STOP",
        "evaluated_at": decision.evaluated_at,
        "audit_events": audit_list
    }

@router.get("/events", summary="Get Recent Guardrail Events")
def get_guardrail_events(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Returns recent guardrail breach events logged during decision evaluation."""
    ws_id = current_user.get("workspace_id")
    query = db.query(GuardrailEvent)
    if ws_id is not None:
        query = query.filter(GuardrailEvent.workspace_id == ws_id)
    events = query.order_by(GuardrailEvent.triggered_at.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "recovery_case_id": e.recovery_case_id,
            "rule_name": e.rule_name,
            "threshold_breached": e.threshold_breached,
            "action_taken": e.action_taken,
            "details": e.details,
            "triggered_at": e.triggered_at.isoformat()
        }
        for e in events
    ]
