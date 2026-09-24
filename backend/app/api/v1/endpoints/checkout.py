"""
RecoverAI - Pre-Payment Checkout Session & Abandonment Recovery Endpoints
Provides checkout session tracking, abandonment timeout processing, and funnel metrics.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database.session import get_db
from app.core.auth import get_current_user
from app.models import CheckoutSession, Customer, RecoveryCase, Transaction, PaymentLink
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
    updated_session = abandonment_service.transition_session(session_id, trans, db)
    
    # Query created recovery case to return dynamic, calculated ERV & strategy
    case = None
    if updated_session.recovery_case_id:
        case = db.query(RecoveryCase).filter(RecoveryCase.id == updated_session.recovery_case_id).first()

    return {
        "status": "success",
        "message": f"Session {session_id} abandoned and recovery initiated.",
        "session_id": session_id,
        "case_id": case.id if case else updated_session.recovery_case_id,
        "recovery_case_id": case.id if case else updated_session.recovery_case_id,
        "expected_recovery_value": float(case.expected_recovery_value) if case and case.expected_recovery_value else 0.0,
        "recovery_probability": float(case.recovery_probability) if case and case.recovery_probability else 0.0,
        "selected_strategy": case.selected_strategy if case else "PAYMENT_LINK",
        "channel": case.channel if case else "EMAIL"
    }

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

@router.get("/order-info", summary="Get Order or Recovery Case Info for Checkout")
def get_order_info(
    order_id: Optional[str] = Query(None),
    recovery_case: Optional[str] = Query(None),
    payment_link_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Public lookup endpoint for checkout/recovery pages.
    Returns the real order amount, customer, and recovery case info from the database.
    """
    case = None
    if recovery_case:
        case = db.query(RecoveryCase).filter(RecoveryCase.id == recovery_case).first()

    plink = None
    if payment_link_id:
        plink = db.query(PaymentLink).filter(PaymentLink.payment_link_id == payment_link_id).first()
        if plink and not case:
            case = db.query(RecoveryCase).filter(RecoveryCase.id == plink.recovery_case_id).first()

    cs = None
    if order_id:
        cs = db.query(CheckoutSession).filter(CheckoutSession.order_id == order_id).first()
        if not cs and not case:
            cs = db.query(CheckoutSession).filter(CheckoutSession.id == order_id).first()

    tx = None
    if order_id:
        tx = db.query(Transaction).filter(
            (Transaction.order_id == order_id) | (Transaction.razorpay_order_id == order_id) | (Transaction.id == order_id)
        ).first()

    if not case and cs and cs.recovery_case_id:
        case = db.query(RecoveryCase).filter(RecoveryCase.id == cs.recovery_case_id).first()
    if not case and tx and tx.recovery_case:
        case = tx.recovery_case

    if not case and not cs and not tx and not plink:
        raise HTTPException(status_code=404, detail="Order or recovery case not found")

    customer = None
    if case and case.transaction and case.transaction.customer:
        customer = case.transaction.customer
    elif tx and tx.customer:
        customer = tx.customer
    elif cs and cs.customer:
        customer = cs.customer

    amount = 0.0
    if case and case.risk_amount:
        amount = float(case.risk_amount)
    elif cs and cs.cart_amount:
        amount = float(cs.cart_amount)
    elif tx and tx.amount:
        amount = float(tx.amount)
    elif plink and plink.amount:
        amount = float(plink.amount)

    resolved_order_id = (
        (cs.order_id if cs and cs.order_id else None)
        or (tx.order_id if tx and tx.order_id else None)
        or (case.transaction.order_id if case and case.transaction else None)
        or order_id
        or (case.id if case else "ORDER")
    )

    product_name = (
        (cs.items_summary if cs and cs.items_summary else None)
        or "Recovered Order Item"
    )

    return {
        "order_id": resolved_order_id,
        "recovery_case_id": case.id if case else (cs.recovery_case_id if cs else None),
        "transaction_id": tx.id if tx else (case.transaction_id if case else None),
        "amount": amount,
        "currency": "INR",
        "customer_name": customer.name if customer else "Valued Customer",
        "customer_email": customer.email if customer else "",
        "customer_phone": customer.phone if customer else "",
        "product_name": product_name,
        "status": case.status if case else (tx.status if tx else (cs.status if cs else "PENDING")),
        "is_recovered": (case.status == "RECOVERED") if case else (cs.is_recovered if cs else False)
    }

