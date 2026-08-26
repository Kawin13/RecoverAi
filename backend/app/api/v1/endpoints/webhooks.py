import json
import uuid
import hashlib
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.logging import logger
from app.core.events import event_broadcaster
from app.models import (
    Transaction,
    PaymentAttempt,
    CheckoutSession,
    RecoveryCase,
    AuditLog,
    WebhookEvent
)
from app.services.razorpay_service import razorpay_service

router = APIRouter()

@router.post("/razorpay", summary="Razorpay Webhook Handler")
async def razorpay_webhook_receiver(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Secure Razorpay Webhook listener.
    - Preserves raw request body for cryptographic signature verification.
    - Validates X-Razorpay-Signature using HMAC SHA-256.
    - Deduplicates repeated events idempotently.
    - Safeguards against out-of-order event delivery (prevents state regression).
    - Emits real-time SSE updates to connected frontend clients.
    """
    # 1. Preserve exact raw request bytes
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")

    if not signature:
        logger.warning("Rejected webhook request: Missing X-Razorpay-Signature header.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header."
        )

    # 2. Cryptographic signature verification over raw request body
    is_valid = razorpay_service.verify_webhook_signature(raw_body, signature)
    if not is_valid:
        logger.warning("Rejected webhook request: Invalid HMAC-SHA256 signature.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Razorpay-Signature."
        )

    # 3. Parse JSON payload
    try:
        payload: Dict[str, Any] = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to parse webhook JSON payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON body."
        )

    # 4. Extract Event Identifiers & Check Idempotency
    event_type = payload.get("event", "unknown")
    event_id = payload.get("id") or request.headers.get("X-Razorpay-Event-Id") or f"evt_{hashlib.sha256(raw_body).hexdigest()[:24]}"

    existing_event = db.query(WebhookEvent).filter(WebhookEvent.id == event_id).first()
    if existing_event:
        logger.info(f"Duplicate webhook event detected and idempotently skipped: {event_id} ({event_type})")
        return {
            "status": "duplicate_ignored",
            "event_id": event_id,
            "message": "Event was already processed idempotently."
        }

    # Extract entities
    payload_data = payload.get("payload", {})
    payment_entity = payload_data.get("payment", {}).get("entity", {})
    order_entity = payload_data.get("order", {}).get("entity", {})

    payment_id = payment_entity.get("id")
    order_id = payment_entity.get("order_id") or order_entity.get("id")
    amount_paise = payment_entity.get("amount") or order_entity.get("amount") or 0
    amount_inr = round(amount_paise / 100.0, 2)
    raw_method = payment_entity.get("method", "Card")
    method_map = {
        "card": "Card",
        "upi": "UPI",
        "netbanking": "NetBanking",
        "wallet": "Wallet",
        "emi": "EMI"
    }
    normalized_method = method_map.get(raw_method.lower(), raw_method.capitalize())

    logger.info(f"Processing Razorpay webhook event '{event_type}' [Event ID: {event_id}] for Order {order_id}, Payment {payment_id}")

    # Find associated transaction in database
    tx = None
    if order_id:
        tx = db.query(Transaction).filter(
            (Transaction.order_id == order_id) | (Transaction.razorpay_order_id == order_id)
        ).first()
    if not tx and payment_id:
        tx = db.query(Transaction).filter(Transaction.razorpay_payment_id == payment_id).first()

    webhook_status = "PROCESSED"

    # 5. Out-of-order delivery protection
    # If transaction is already in terminal SUCCESS / RECOVERED state, do not regress to PENDING or FAILED
    if tx and tx.status in ("SUCCESS", "RECOVERED"):
        if event_type in ("payment.failed", "payment.authorized"):
            logger.warning(
                f"Out-of-order delivery detected: Received late '{event_type}' for Transaction {tx.id} "
                f"which is already in terminal state '{tx.status}'. Skipping state regression."
            )
            webhook_status = "IGNORED_OUT_OF_ORDER"

            # Record event in WebhookEvent table to maintain idempotency
            webhook_record = WebhookEvent(
                id=event_id,
                event_type=event_type,
                resource_id=payment_id or order_id,
                status=webhook_status,
                payload_summary=f"Ignored out-of-order {event_type} for existing {tx.status} transaction {tx.id}",
                created_at=datetime.utcnow()
            )
            db.add(webhook_record)
            db.commit()

            return {
                "status": "ignored_out_of_order",
                "event_id": event_id,
                "current_transaction_status": tx.status,
                "message": "State preserved against out-of-order regression."
            }

    # 6. Event Handling Logic
    if event_type in ("payment.captured", "order.paid"):
        if tx:
            tx.status = "SUCCESS"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.method = normalized_method
            tx.updated_at = datetime.utcnow()

            # Record payment attempt
            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="SUCCESS",
                latency_ms=280,
                created_at=datetime.utcnow()
            )
            db.add(attempt)

            # If recovering a previous case
            if tx.recovery_case:
                tx.recovery_case.status = "RECOVERED"
                tx.recovery_case.recovered_at = datetime.utcnow()

            # Audit trail
            db.add(
                AuditLog(
                    id=f"aud_{uuid.uuid4().hex[:10]}",
                    transaction_id=tx.id,
                    recovery_case_id=tx.recovery_case.id if tx.recovery_case else None,
                    actor="RAZORPAY_WEBHOOK",
                    action_type="PAYMENT_CAPTURED",
                    target_resource=tx.id,
                    details=f"Webhook confirmed payment.captured for ₹{tx.amount:,.2f} via {normalized_method} (Payment {payment_id})",
                    created_at=datetime.utcnow()
                )
            )

            # Real-Time SSE Broadcast
            event_broadcaster.broadcast_sync("TRANSACTION_UPDATED", {
                "transaction_id": tx.id,
                "order_id": tx.order_id,
                "status": "SUCCESS",
                "amount": tx.amount,
                "method": tx.method,
                "event_type": event_type
            })
            event_broadcaster.broadcast_sync("DASHBOARD_REFRESH", {
                "reason": "payment_captured",
                "transaction_id": tx.id,
                "amount": tx.amount
            })

    elif event_type == "payment.failed":
        error_code = payment_entity.get("error_code") or "PAYMENT_FAILED"
        error_description = payment_entity.get("error_description") or "Declined by gateway/bank."
        error_reason = payment_entity.get("error_reason") or "GATEWAY_ERROR"

        if tx:
            tx.status = "FAILED"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.updated_at = datetime.utcnow()

            # Record payment attempt
            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="FAILED",
                error_code=error_code,
                error_description=error_description,
                error_category=error_reason,
                latency_ms=1200,
                created_at=datetime.utcnow()
            )
            db.add(attempt)

            # Ensure recovery case provisioned
            if not tx.recovery_case:
                case = RecoveryCase(
                    id=f"case_{uuid.uuid4().hex[:8]}",
                    transaction_id=tx.id,
                    risk_amount=tx.amount,
                    failure_category=error_reason,
                    recovery_probability=0.76,
                    selected_strategy="INSTANT_RETRY_FALLBACK",
                    expected_recovery_value=round(tx.amount * 0.76, 2),
                    status="PENDING_APPROVAL",
                    attempt_count=1,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(case)

            # Audit trail
            db.add(
                AuditLog(
                    id=f"aud_{uuid.uuid4().hex[:10]}",
                    transaction_id=tx.id,
                    recovery_case_id=tx.recovery_case.id if tx.recovery_case else None,
                    actor="RAZORPAY_WEBHOOK",
                    action_type="PAYMENT_FAILED",
                    target_resource=tx.id,
                    details=f"Webhook reported payment.failed: {error_code} - {error_description}. Case updated for AI Recovery.",
                    created_at=datetime.utcnow()
                )
            )

            # Real-Time SSE Broadcast
            event_broadcaster.broadcast_sync("TRANSACTION_UPDATED", {
                "transaction_id": tx.id,
                "order_id": tx.order_id,
                "status": "FAILED",
                "amount": tx.amount,
                "error_code": error_code,
                "event_type": event_type
            })
            event_broadcaster.broadcast_sync("RECOVERY_QUEUE_UPDATED", {
                "transaction_id": tx.id,
                "risk_amount": tx.amount
            })
            event_broadcaster.broadcast_sync("DASHBOARD_REFRESH", {
                "reason": "payment_failed",
                "transaction_id": tx.id
            })

    elif event_type == "payment.authorized":
        if tx and tx.status not in ("SUCCESS", "RECOVERED"):
            # Record transitional state correctly without marking final success
            tx.status = "AUTHORIZED"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.method = normalized_method
            tx.updated_at = datetime.utcnow()

            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="AUTHORIZED",
                latency_ms=250,
                created_at=datetime.utcnow()
            )
            db.add(attempt)

            db.add(
                AuditLog(
                    id=f"aud_{uuid.uuid4().hex[:10]}",
                    transaction_id=tx.id,
                    recovery_case_id=tx.recovery_case.id if tx.recovery_case else None,
                    actor="RAZORPAY_WEBHOOK",
                    action_type="PAYMENT_AUTHORIZED",
                    target_resource=tx.id,
                    details=f"Webhook recorded transitional payment.authorized for ₹{tx.amount:,.2f} via {normalized_method} (Payment {payment_id})",
                    created_at=datetime.utcnow()
                )
            )

            event_broadcaster.broadcast_sync("TRANSACTION_UPDATED", {
                "transaction_id": tx.id,
                "order_id": tx.order_id,
                "status": "AUTHORIZED",
                "amount": tx.amount,
                "method": tx.method,
                "event_type": event_type
            })
    else:
        logger.info(f"Webhook event '{event_type}' acknowledged safely without business transition.")

    # 7. Record processed webhook event for idempotency
    webhook_record = WebhookEvent(
        id=event_id,
        event_type=event_type,
        resource_id=payment_id or order_id,
        status=webhook_status,
        payload_summary=f"Event {event_type} processed for ₹{amount_inr:,.2f}",
        created_at=datetime.utcnow()
    )
    db.add(webhook_record)
    db.commit()

    return {
        "status": "processed",
        "event_id": event_id,
        "event_type": event_type,
        "resource_id": payment_id or order_id
    }
