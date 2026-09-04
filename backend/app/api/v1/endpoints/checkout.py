"""
RecoverAI - Pre-Payment Checkout Session & Abandonment Recovery Endpoints
Provides checkout session tracking, abandonment timeout processing, and funnel metrics.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database.session import get_db
from app.core.auth import get_current_user
from app.models import CheckoutSession, Customer, RecoveryCase, Transaction
from app.services.abandonment_service import abandonment_service
from app.schemas.checkout_sessions import (
    CheckoutSessionCreate,
    CheckoutSessionTransition,
    CheckoutSessionResponse,
    AbandonmentFunnelResponse,
    AbandonmentCaseDetail
)

router = APIRouter()

@router.post("/sessions", response_model=CheckoutSessionResponse, summary="Start Checkout Session")
def create_checkout_session(
    payload: CheckoutSessionCreate,
    db: Session = Depends(get_db)
):
    """Creates a new tracked checkout session in the STARTED state."""
    session = abandonment_service.create_session(payload, db)
    cust = session.customer
    return {
        "id": session.id,
        "customer_id": session.customer_id,
        "order_id": session.order_id,
        "cart_amount": session.cart_amount,
        "status": session.status,
        "selected_method": session.selected_method,
        "payment_attempted": session.payment_attempted,
        "started_at": session.started_at,
        "last_activity_at": session.last_activity_at,
        "completed_at": session.completed_at,
        "abandoned_at": session.abandoned_at,
        "is_demo_simulation": session.is_demo_simulation,
        "recovery_case_id": session.recovery_case_id,
        "customer_name": cust.name if cust else "Shopper",
        "customer_email": cust.email if cust else "shopper@example.com",
        "customer_phone": cust.phone if cust else "+919876543210",
        "customer_tier": cust.tier if cust else "STANDARD"
    }

@router.get("/sessions", response_model=List[CheckoutSessionResponse], summary="List Checkout Sessions")
def list_checkout_sessions(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Lists recent checkout sessions with optional status filtering."""
    ws_id = current_user.get("workspace_id")
    query = db.query(CheckoutSession).options(joinedload(CheckoutSession.customer))
    if ws_id is not None:
        query = query.filter(CheckoutSession.workspace_id == ws_id)
    if status and status.upper() != "ALL":
        query = query.filter(CheckoutSession.status == status.upper())

    sessions = query.order_by(CheckoutSession.started_at.desc()).limit(limit).all()
    results = []
    for s in sessions:
        cust = s.customer
        results.append({
            "id": s.id,
            "customer_id": s.customer_id,
            "order_id": s.order_id,
            "cart_amount": s.cart_amount,
            "status": s.status,
            "selected_method": s.selected_method,
            "payment_attempted": s.payment_attempted,
            "started_at": s.started_at,
            "last_activity_at": s.last_activity_at,
            "completed_at": s.completed_at,
            "abandoned_at": s.abandoned_at,
            "is_demo_simulation": s.is_demo_simulation,
            "recovery_case_id": s.recovery_case_id,
            "customer_name": cust.name if cust else "Shopper",
            "customer_email": cust.email if cust else "shopper@example.com",
            "customer_phone": cust.phone if cust else "+919876543210",
            "customer_tier": cust.tier if cust else "STANDARD"
        })
    return results

@router.get("/sessions/{session_id}", response_model=CheckoutSessionResponse, summary="Get Session Details")
def get_checkout_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Fetches details of a specific checkout session."""
    session = (
        db.query(CheckoutSession)
        .options(joinedload(CheckoutSession.customer))
        .filter(CheckoutSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Checkout session not found")

    cust = session.customer
    return {
        "id": session.id,
        "customer_id": session.customer_id,
        "order_id": session.order_id,
        "cart_amount": session.cart_amount,
        "status": session.status,
        "selected_method": session.selected_method,
        "payment_attempted": session.payment_attempted,
        "started_at": session.started_at,
        "last_activity_at": session.last_activity_at,
        "completed_at": session.completed_at,
        "abandoned_at": session.abandoned_at,
        "is_demo_simulation": session.is_demo_simulation,
        "recovery_case_id": session.recovery_case_id,
        "customer_name": cust.name if cust else "Shopper",
        "customer_email": cust.email if cust else "shopper@example.com",
        "customer_phone": cust.phone if cust else "+919876543210",
        "customer_tier": cust.tier if cust else "STANDARD"
    }

@router.post("/sessions/{session_id}/transition", response_model=CheckoutSessionResponse, summary="Transition Session State")
def transition_checkout_session(
    session_id: str,
    payload: CheckoutSessionTransition,
    db: Session = Depends(get_db)
):
    """Advances checkout session along its lifecycle stages."""
    try:
        session = abandonment_service.transition_session(session_id, payload, db)
        cust = session.customer
        return {
            "id": session.id,
            "customer_id": session.customer_id,
            "order_id": session.order_id,
            "cart_amount": session.cart_amount,
            "status": session.status,
            "selected_method": session.selected_method,
            "payment_attempted": session.payment_attempted,
            "started_at": session.started_at,
            "last_activity_at": session.last_activity_at,
            "completed_at": session.completed_at,
            "abandoned_at": session.abandoned_at,
            "is_demo_simulation": session.is_demo_simulation,
            "recovery_case_id": session.recovery_case_id,
            "customer_name": cust.name if cust else "Shopper",
            "customer_email": cust.email if cust else "shopper@example.com",
            "customer_phone": cust.phone if cust else "+919876543210",
            "customer_tier": cust.tier if cust else "STANDARD"
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

@router.post("/sessions/{session_id}/abandon", summary="Trigger Session Abandonment")
def abandon_checkout_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Manually or simulation-triggers abandonment for a checkout session and initiates recovery."""
    session = db.query(CheckoutSession).filter(CheckoutSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Checkout session not found")

    trans = CheckoutSessionTransition(new_status="ABANDONED")
    abandonment_service.transition_session(session_id, trans, db)
    return {"status": "success", "message": f"Session {session_id} abandoned and recovery initiated."}

@router.post("/check-abandoned", summary="Scan Timed-Out Checkout Sessions")
def check_timed_out_sessions(
    timeout_seconds: int = Query(15, ge=1, le=86400),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Scans active sessions exceeding inactivity timeout and transitions them to ABANDONED.
    Supports short demo timeouts (15s) and production timeouts (up to 24h).
    """
    processed = abandonment_service.check_and_mark_abandoned(db, timeout_seconds=timeout_seconds)
    return {
        "status": "success",
        "scanned_timeout_seconds": timeout_seconds,
        "abandoned_count": len(processed),
        "processed_sessions": [s.id for s in processed]
    }

@router.get("/funnel", response_model=AbandonmentFunnelResponse, summary="Get Abandonment Funnel Metrics")
def get_abandonment_funnel(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Returns the 5-stage pre-payment abandonment funnel metrics and conversion rates."""
    return abandonment_service.get_funnel_metrics(db)

@router.get("/cases", summary="List Pre-Payment Abandonment Cases")
def list_abandonment_cases(
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Returns detailed abandonment cases created from dropped checkout sessions."""
    ws_id = current_user.get("workspace_id")
    query = (
        db.query(RecoveryCase)
        .options(joinedload(RecoveryCase.transaction).joinedload(Transaction.customer))
        .filter(RecoveryCase.failure_category == "ABANDONMENT")
    )
    if ws_id is not None:
        query = query.filter(RecoveryCase.workspace_id == ws_id)

    cases = query.order_by(RecoveryCase.created_at.desc()).limit(limit).all()

    results = []
    for c in cases:
        tx = c.transaction
        cust = tx.customer if tx else None
        session = None
        if c.checkout_session_id:
            session = db.query(CheckoutSession).filter(CheckoutSession.id == c.checkout_session_id).first()

        results.append({
            "case_id": c.id,
            "session_id": c.checkout_session_id or (session.id if session else None),
            "order_id": tx.order_id if tx else None,
            "customer_name": cust.name if cust else "Shopper",
            "customer_email": cust.email if cust else "shopper@example.com",
            "customer_tier": cust.tier if cust else "STANDARD",
            "cart_amount": c.risk_amount,
            "recovery_probability": c.recovery_probability,
            "selected_strategy": c.selected_strategy,
            "expected_recovery_value": c.expected_recovery_value,
            "status": c.status,
            "channel": c.channel,
            "is_demo_simulation": session.is_demo_simulation if session else True,
            "created_at": c.created_at.isoformat()
        })
    return results
