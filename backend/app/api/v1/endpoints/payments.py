import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.config import settings
from app.core.logging import logger
from app.models import (
    Customer,
    Transaction,
    PaymentAttempt,
    CheckoutSession,
    RecoveryCase,
    AuditLog
)
from app.schemas.payment import (
    PaymentConfigResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
    PaymentFailureRequest
)
from app.services.razorpay_service import razorpay_service

router = APIRouter()

@router.get("/config", response_model=PaymentConfigResponse, summary="Get Public Razorpay Gateway Configuration")
def get_payment_config():
    """
    Returns public Razorpay configuration for frontend checkout initialization.
    Strictly exposes only the public Test Key ID. The Key Secret is NEVER revealed.
    """
    return PaymentConfigResponse(
        key_id=settings.RAZORPAY_KEY_ID or "rzp_test_recoverai998",
        is_test_mode=True,
        is_configured=razorpay_service.is_configured,
        merchant_name="RecoverAI Demo Store"
    )

@router.post("/order", response_model=CreateOrderResponse, summary="Create Server-Side Razorpay Order")
def create_payment_order(
    request: CreateOrderRequest,
    db: Session = Depends(get_db)
):
    """
    Generates a genuine Razorpay order server-side and registers the transaction
    and checkout session in RecoverAI database.
    """
    # 1. Retrieve or provision customer
    customer = db.query(Customer).filter(Customer.email == request.customer_email).first()
    if not customer:
        customer = Customer(
            id=f"cust_{uuid.uuid4().hex[:8]}",
            name=request.customer_name,
            email=request.customer_email,
            phone=request.customer_phone,
            tier="STANDARD",
            ltv=request.amount,
            created_at=datetime.utcnow()
        )
        db.add(customer)
        db.flush()

    # 2. Calculate minor currency units (paise)
    amount_paise = int(round(request.amount * 100))

    # 3. Create Order via Razorpay
    notes = {
        "product_id": request.product_id,
        "product_name": request.product_name,
        "merchant": "RecoverAI Demo Store",
        "customer_email": request.customer_email
    }
    rzp_order = razorpay_service.create_order(
        amount_paise=amount_paise,
        currency=request.currency,
        notes=notes
    )
    razorpay_order_id = rzp_order.get("id")

    # 4. Persist Transaction in PENDING state
    tx_id = f"tx_{uuid.uuid4().hex[:10]}"
    transaction = Transaction(
        id=tx_id,
        order_id=razorpay_order_id,
        customer_id=customer.id,
        amount=request.amount,
        currency=request.currency,
        method="Card",  # Default placeholder until checkout completes
        status="PENDING",
        razorpay_order_id=razorpay_order_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(transaction)

    # 5. Persist CheckoutSession
    session_id = f"cs_{uuid.uuid4().hex[:10]}"
    checkout_session = CheckoutSession(
        id=session_id,
        customer_id=customer.id,
        order_id=razorpay_order_id,
        items_summary=request.product_name,
        cart_value=request.amount,
        dropped_at_step="ORDER_CREATED",
        is_recovered=False,
        created_at=datetime.utcnow()
    )
    db.add(checkout_session)

    # 6. Audit Trail entry
    audit_entry = AuditLog(
        id=f"aud_{uuid.uuid4().hex[:10]}",
        transaction_id=tx_id,
        actor="DEMO_STORE",
        action_type="ORDER_CREATED",
        target_resource=tx_id,
        details=f"Razorpay order {razorpay_order_id} created for ₹{request.amount:,.2f} ({request.product_name})",
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()

    logger.info(f"Created pending transaction {tx_id} for Razorpay order {razorpay_order_id}")

    return CreateOrderResponse(
        order_id=razorpay_order_id,
        transaction_id=tx_id,
        amount=amount_paise,
        amount_in_rupees=request.amount,
        currency=request.currency,
        key_id=settings.RAZORPAY_KEY_ID or "rzp_test_recoverai998",
        product_name=request.product_name,
        customer={
            "name": request.customer_name,
            "email": request.customer_email,
            "phone": request.customer_phone
        }
    )

@router.post("/verify", response_model=VerifyPaymentResponse, summary="Verify Razorpay Payment Signature")
def verify_payment(
    request: VerifyPaymentRequest,
    db: Session = Depends(get_db)
):
    """
    Validates Razorpay payment signature server-side using HMAC SHA-256.
    Never trusts client response alone. On cryptographic confirmation, updates
    transaction status to SUCCESS and captures payment metadata.
    """
    # 1. Cryptographic HMAC SHA-256 verification
    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        razorpay_signature=request.razorpay_signature
    )

    # 2. Retrieve Transaction record
    tx = (
        db.query(Transaction)
        .filter(
            (Transaction.id == request.transaction_id) |
            (Transaction.razorpay_order_id == request.razorpay_order_id)
        )
        .first()
    )

    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction not found for Order ID '{request.razorpay_order_id}'."
        )

    if not is_valid:
        # Record tamper audit
        db.add(
            AuditLog(
                id=f"aud_{uuid.uuid4().hex[:10]}",
                transaction_id=tx.id,
                actor="GATEWAY_SECURITY_CHECK",
                action_type="SIGNATURE_VERIFICATION_FAILED",
                target_resource=tx.id,
                details=f"Payment signature verification failed for Payment ID {request.razorpay_payment_id}. Potential forgery.",
                created_at=datetime.utcnow()
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment signature verification failed. HMAC SHA-256 signature does not match."
        )

    # 3. Retrieve payment details from gateway
    payment_info = razorpay_service.fetch_payment_details(request.razorpay_payment_id)
    raw_method = payment_info.get("method", "Card")
    method_map = {
        "card": "Card",
        "upi": "UPI",
        "netbanking": "NetBanking",
        "wallet": "Wallet",
        "emi": "EMI"
    }
    normalized_method = method_map.get(raw_method.lower(), raw_method.capitalize())

    # 4. Update Transaction
    tx.status = "SUCCESS"
    tx.razorpay_payment_id = request.razorpay_payment_id
    tx.razorpay_signature = request.razorpay_signature
    tx.method = normalized_method
    tx.updated_at = datetime.utcnow()

    # 5. Record successful payment attempt
    attempt = PaymentAttempt(
        id=f"pa_{uuid.uuid4().hex[:10]}",
        transaction_id=tx.id,
        attempt_number=len(tx.payment_attempts) + 1,
        gateway="Razorpay",
        gateway_payment_id=request.razorpay_payment_id,
        latency_ms=320,
        status="SUCCESS",
        created_at=datetime.utcnow()
    )
    db.add(attempt)

    # 6. Update associated CheckoutSession if exists
    cs = db.query(CheckoutSession).filter(CheckoutSession.order_id == tx.order_id).first()
    if cs:
        cs.dropped_at_step = "COMPLETED"
        cs.is_recovered = True

    # 7. Audit Trail log
    audit_entry = AuditLog(
        id=f"aud_{uuid.uuid4().hex[:10]}",
        transaction_id=tx.id,
        actor="HMAC_SHA256_VERIFIER",
        action_type="PAYMENT_VERIFIED",
        target_resource=tx.id,
        details=f"Payment {request.razorpay_payment_id} successfully verified with HMAC-SHA256. Captured ₹{tx.amount:,.2f} via {normalized_method}.",
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(tx)

    logger.info(f"Payment {request.razorpay_payment_id} verified successfully for Transaction {tx.id}")

    return VerifyPaymentResponse(
        success=True,
        signature_valid=True,
        transaction_id=tx.id,
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        amount=tx.amount,
        method=normalized_method,
        status="SUCCESS",
        verified_at=datetime.utcnow(),
        message="Payment signature cryptographically verified and recorded."
    )

@router.post("/fail", summary="Record Payment Failure and Escalate to RecoverAI Agent")
def record_payment_failure(
    request: PaymentFailureRequest,
    db: Session = Depends(get_db)
):
    """
    Registers a failed payment attempt (e.g. simulated failure, bank decline, user drop-off)
    and automatically routes the case into RecoverAI's Autonomous Recovery Pipeline.
    """
    tx = (
        db.query(Transaction)
        .filter(
            (Transaction.id == request.transaction_id) |
            (Transaction.order_id == request.order_id)
        )
        .first()
    )

    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID '{request.transaction_id}' was not found."
        )

    # 1. Update Transaction status
    tx.status = "FAILED"
    if request.payment_id:
        tx.razorpay_payment_id = request.payment_id
    tx.updated_at = datetime.utcnow()

    # 2. Record failed payment attempt
    attempt = PaymentAttempt(
        id=f"pa_{uuid.uuid4().hex[:10]}",
        transaction_id=tx.id,
        attempt_number=len(tx.payment_attempts) + 1,
        gateway="Razorpay",
        gateway_payment_id=request.payment_id,
        error_code=request.error_code,
        error_description=request.error_description,
        error_category=request.error_category,
        latency_ms=1450,
        status="FAILED",
        created_at=datetime.utcnow()
    )
    db.add(attempt)

    # 3. Create or update RecoveryCase for RecoverAI Autonomous Agent
    recovery_case = db.query(RecoveryCase).filter(RecoveryCase.transaction_id == tx.id).first()
    if not recovery_case:
        recovery_case = RecoveryCase(
            id=f"case_{uuid.uuid4().hex[:8]}",
            transaction_id=tx.id,
            risk_amount=tx.amount,
            failure_category=request.error_category or "GATEWAY_ERROR",
            recovery_probability=0.74,
            selected_strategy="INSTANT_RETRY_FALLBACK",
            expected_recovery_value=round(tx.amount * 0.74, 2),
            status="PENDING_APPROVAL",
            attempt_count=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(recovery_case)

    # 4. Audit Log
    db.add(
        AuditLog(
            id=f"aud_{uuid.uuid4().hex[:10]}",
            transaction_id=tx.id,
            recovery_case_id=recovery_case.id,
            actor="GATEWAY_EVENT_LISTENER",
            action_type="PAYMENT_FAILED",
            target_resource=tx.id,
            details=f"Payment failed: {request.error_code} - {request.error_description}. Case escalated to RecoverAI Autonomous Agent.",
            created_at=datetime.utcnow()
        )
    )

    db.commit()

    logger.info(f"Recorded payment failure for Transaction {tx.id}. Escalated to RecoveryCase {recovery_case.id}")

    return {
        "status": "recorded",
        "transaction_id": tx.id,
        "recovery_case_id": recovery_case.id,
        "error_code": request.error_code,
        "error_description": request.error_description,
        "escalated_to_agent": True
    }
