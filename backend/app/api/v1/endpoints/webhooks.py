import json
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.logging import logger
from app.core.events import event_broadcaster
from app.core.datetime_utils import diff_seconds
from app.models import (
    Customer,
    Transaction,
    PaymentAttempt,
    CheckoutSession,
    RecoveryCase,
    RecoveryOutcome,
    PaymentLink,
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
    plink_entity = payload_data.get("payment_link", {}).get("entity", {})

    payment_id = payment_entity.get("id")
    order_id = payment_entity.get("order_id") or order_entity.get("id")
    plink_id = plink_entity.get("id") or payment_entity.get("payment_link_id") or payment_entity.get("notes", {}).get("payment_link_id")
    amount_paise = payment_entity.get("amount") or order_entity.get("amount") or plink_entity.get("amount") or 0
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

    logger.info(f"Processing Razorpay webhook event '{event_type}' [Event ID: {event_id}] for Order {order_id}, Payment {payment_id}, Link {plink_id}")

    # Resolve associated entities across tables
    tx = None
    case = None
    plink_record = None

    if plink_id:
        plink_record = db.query(PaymentLink).filter(PaymentLink.payment_link_id == plink_id).first()
        if plink_record:
            case = plink_record.recovery_case
            if case:
                tx = case.transaction

    if not case:
        notes = payment_entity.get("notes") or plink_entity.get("notes") or {}
        case_id = notes.get("recovery_case_id")
        if case_id:
            case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
            if case and not tx:
                tx = case.transaction

    if not tx and order_id:
        tx = db.query(Transaction).filter(
            (Transaction.order_id == order_id) | (Transaction.razorpay_order_id == order_id)
        ).first()
        if tx and not case:
            case = tx.recovery_case

    if not tx and payment_id:
        tx = db.query(Transaction).filter(Transaction.razorpay_payment_id == payment_id).first()
        if tx and not case:
            case = tx.recovery_case

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
                resource_id=payment_id or order_id or plink_id,
                status=webhook_status,
                payload_summary=f"Ignored out-of-order {event_type} for existing {tx.status} transaction {tx.id}",
                created_at=datetime.now(timezone.utc)
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
    if event_type in ("payment.captured", "order.paid", "payment_link.paid"):
        # Validate expected amount if transaction is present
        if tx and amount_paise:
            expected_paise = int(round(tx.amount * 100))
            if amount_paise != expected_paise:
                logger.warning(
                    f"Webhook amount mismatch for Tx {tx.id}: Expected {expected_paise} paise, received {amount_paise} paise."
                )
                # Fail closed on amount mismatch
                db.add(
                    AuditLog(
                        id=f"aud_{uuid.uuid4().hex[:10]}",
                        workspace_id=tx.workspace_id,
                        transaction_id=tx.id,
                        actor="RAZORPAY_WEBHOOK_SECURITY",
                        action_type="AMOUNT_MISMATCH_REJECTED",
                        target_resource=tx.id,
                        details=f"Webhook {event_type} amount mismatch. Expected {expected_paise} paise, got {amount_paise} paise. Ignored.",
                        created_at=datetime.now(timezone.utc)
                    )
                )
                db.commit()
                return {
                    "status": "amount_mismatch_ignored",
                    "event_id": event_id,
                    "message": "Payment amount does not match transaction."
                }

        ws_id = tx.workspace_id if tx else (case.workspace_id if case else (plink_record.workspace_id if plink_record else None))

        if plink_record:
            plink_record.status = "paid"
            plink_record.updated_at = datetime.now(timezone.utc)

        if case:
            case.status = "RECOVERED"
            case.current_step = "RECOVERED"
            case.recovered_at = datetime.now(timezone.utc)
            case.updated_at = datetime.now(timezone.utc)

            # Record or update RecoveryOutcome
            outcome = db.query(RecoveryOutcome).filter(RecoveryOutcome.recovery_case_id == case.id).first()
            recovered_val = case.risk_amount or amount_inr
            if not outcome:
                outcome = RecoveryOutcome(
                    id=f"out_{uuid.uuid4().hex[:10]}",
                    workspace_id=ws_id,
                    recovery_case_id=case.id,
                    recovered_amount=recovered_val,
                    payment_method_used=normalized_method,
                    time_to_recover_seconds=int(diff_seconds(datetime.now(timezone.utc), case.created_at, default=120.0)),
                    settled_at=datetime.now(timezone.utc)
                )
                db.add(outcome)
            else:
                outcome.recovered_amount = recovered_val
                outcome.payment_method_used = normalized_method
                outcome.settled_at = datetime.now(timezone.utc)

        if tx:
            tx.status = "SUCCESS"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.method = normalized_method
            tx.updated_at = datetime.now(timezone.utc)

            # Record payment attempt
            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                workspace_id=ws_id,
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="SUCCESS",
                latency_ms=280,
                created_at=datetime.now(timezone.utc)
            )
            db.add(attempt)

        # Audit trail
        db.add(
            AuditLog(
                id=f"aud_{uuid.uuid4().hex[:10]}",
                workspace_id=ws_id,
                transaction_id=tx.id if tx else (case.transaction_id if case else None),
                recovery_case_id=case.id if case else (tx.recovery_case.id if tx and tx.recovery_case else None),
                actor="RAZORPAY_WEBHOOK",
                action_type="PAYMENT_CAPTURED",
                target_resource=case.id if case else (tx.id if tx else (payment_id or plink_id or "unknown")),
                details=f"Webhook confirmed {event_type} for ₹{amount_inr or (case.risk_amount if case else 0):,.2f} via {normalized_method} (Payment {payment_id or 'N/A'}, Link {plink_id or 'N/A'}). Recovery case marked RECOVERED.",
                created_at=datetime.now(timezone.utc)
            )
        )

        # Real-Time SSE Broadcasts
        if tx:
            event_broadcaster.broadcast_sync("TRANSACTION_UPDATED", {
                "transaction_id": tx.id,
                "order_id": tx.order_id,
                "status": "SUCCESS",
                "amount": tx.amount,
                "method": tx.method,
                "event_type": event_type
            })
        if case:
            event_broadcaster.broadcast_sync("RECOVERY_AGENT_TRANSITION", {
                "case_id": case.id,
                "transaction_id": case.transaction_id,
                "prev_step": "WAITING_FOR_CUSTOMER",
                "current_step": "RECOVERED",
                "strategy": case.selected_strategy,
                "status": "RECOVERED",
                "risk_amount": case.risk_amount,
                "details": f"Payment verified via Razorpay webhook ({event_type}).",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            event_broadcaster.broadcast_sync("RECOVERY_QUEUE_UPDATED", {
                "case_id": case.id,
                "payment_link_id": plink_id or (plink_record.payment_link_id if plink_record else ""),
                "status": "paid"
            })
        event_broadcaster.broadcast_sync("DASHBOARD_REFRESH", {
            "reason": "payment_recovered",
            "transaction_id": tx.id if tx else "",
            "case_id": case.id if case else "",
            "amount": amount_inr or (case.risk_amount if case else 0)
        })
        event_broadcaster.broadcast_sync("transaction_recovered", {
            "transaction_id": tx.id if tx else "",
            "case_id": case.id if case else "",
            "amount": amount_inr or (case.risk_amount if case else 0)
        })

    elif event_type == "payment.failed":
        error_code = payment_entity.get("error_code") or "PAYMENT_FAILED"
        error_description = payment_entity.get("error_description") or "Declined by gateway/bank."
        error_reason = payment_entity.get("error_reason") or "GATEWAY_ERROR"

        if not tx:
            # External or untracked transaction detected via webhook: auto-provision to avoid lost revenue
            cust_email = payment_entity.get("email") or "shopper@example.com"
            cust_contact = payment_entity.get("contact") or "+919876543210"
            customer = db.query(Customer).filter(Customer.email == cust_email).first()
            if not customer:
                customer = Customer(
                    id=f"cust_{uuid.uuid4().hex[:8]}",
                    name=cust_email.split("@")[0].title() if "@" in cust_email else "Valued Shopper",
                    email=cust_email,
                    phone=cust_contact,
                    tier="STANDARD",
                    ltv=amount_inr,
                    created_at=datetime.now(timezone.utc)
                )
                db.add(customer)
                db.flush()

            tx = Transaction(
                id=f"tx_{uuid.uuid4().hex[:10]}",
                order_id=order_id or f"order_ext_{uuid.uuid4().hex[:8]}",
                customer_id=customer.id,
                amount=amount_inr,
                currency=payment_entity.get("currency", "INR"),
                method=normalized_method,
                status="FAILED",
                razorpay_order_id=order_id,
                razorpay_payment_id=payment_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(tx)
            db.flush()

        if tx:
            tx.status = "FAILED"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.updated_at = datetime.now(timezone.utc)

            # Record payment attempt
            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                workspace_id=tx.workspace_id,
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="FAILED",
                error_code=error_code,
                error_description=error_description,
                error_category=error_reason,
                latency_ms=1200,
                created_at=datetime.now(timezone.utc)
            )
            db.add(attempt)

            # Ensure recovery case provisioned
            if not tx.recovery_case:
                case = RecoveryCase(
                    id=f"case_{uuid.uuid4().hex[:8]}",
                    workspace_id=tx.workspace_id,
                    transaction_id=tx.id,
                    risk_amount=tx.amount,
                    failure_category=error_reason,
                    recovery_probability=0.76,
                    selected_strategy="INSTANT_RETRY_FALLBACK",
                    expected_recovery_value=round(tx.amount * 0.76, 2),
                    status="PENDING_APPROVAL",
                    attempt_count=1,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                db.add(case)

            # Audit trail
            db.add(
                AuditLog(
                    id=f"aud_{uuid.uuid4().hex[:10]}",
                    workspace_id=tx.workspace_id,
                    transaction_id=tx.id,
                    recovery_case_id=tx.recovery_case.id if tx.recovery_case else None,
                    actor="RAZORPAY_WEBHOOK",
                    action_type="PAYMENT_FAILED",
                    target_resource=tx.id,
                    details=f"Webhook reported payment.failed: {error_code} - {error_description}. Case updated for AI Recovery.",
                    created_at=datetime.now(timezone.utc)
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
            tx.updated_at = datetime.now(timezone.utc)

            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="AUTHORIZED",
                latency_ms=250,
                created_at=datetime.now(timezone.utc)
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
                    created_at=datetime.now(timezone.utc)
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
        created_at=datetime.now(timezone.utc)
    )
    db.add(webhook_record)
    db.commit()

    return {
        "status": "processed",
        "event_id": event_id,
        "event_type": event_type,
        "resource_id": payment_id or order_id
    }
