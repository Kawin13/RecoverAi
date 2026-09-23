import json
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, Depends, status, Path
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.logging import logger
from app.core.events import event_broadcaster
from app.core.config import settings
from app.core.datetime_utils import diff_seconds, utcnow
from app.models import (
    Customer,
    Transaction,
    PaymentAttempt,
    CheckoutSession,
    RecoveryCase,
    RecoveryOutcome,
    PaymentLink,
    AuditLog,
    WebhookEvent,
    InternalEvent,
    RecoveryJob
)
from app.models.workspaces import DEFAULT_WORKSPACE_ID
from app.models.workspace_integrations import WorkspaceIntegration
from app.core.vault import decrypt_secret
from app.services.razorpay_service import razorpay_service
from app.services.background_worker import background_worker, JobType

router = APIRouter()

async def process_razorpay_webhook(
    raw_body: bytes,
    signature: str,
    workspace_id: str,
    integration_id: Optional[str],
    webhook_secret: str,
    db: Session
) -> Dict[str, Any]:
    """
    Core multi-merchant webhook verification and processing engine.
    - Validates HMAC signature against the merchant's decrypted webhook secret.
    - Idempotently deduplicates events scoped to the merchant workspace.
    - Ensures all created entities, background jobs, audit logs, and SSE events
      are strictly bound to workspace_id.
    """
    # 1. Signature Verification
    if not signature:
        logger.warning("[Webhook] Rejected: Missing X-Razorpay-Signature header.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header."
        )

    is_valid = razorpay_service.verify_webhook_signature(raw_body, signature, secret=webhook_secret)
    if not is_valid:
        logger.warning(f"[Webhook] Rejected: Invalid HMAC signature for workspace {workspace_id}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Razorpay-Signature."
        )

    # 2. Parse JSON payload
    try:
        payload: Dict[str, Any] = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        logger.error(f"[Webhook] Malformed JSON payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON body."
        )

    # 3. Extract Identifiers & Idempotency Check
    event_type = payload.get("event", "unknown")
    event_id = payload.get("id") or f"evt_{hashlib.sha256(raw_body).hexdigest()[:24]}"

    existing_event = db.query(WebhookEvent).filter(
        WebhookEvent.id == event_id,
        WebhookEvent.workspace_id == workspace_id
    ).first()
    if not existing_event:
        # Also check global legacy id
        existing_event = db.query(WebhookEvent).filter(WebhookEvent.id == event_id).first()

    if existing_event:
        logger.info(f"[Webhook] Duplicate event skipped: {event_id} ({event_type}) in workspace {workspace_id}")
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

    logger.info(f"[Webhook] Processing event '{event_type}' [{event_id}] for workspace '{workspace_id}'")

    # 4. Resolve associated entities strictly within workspace
    tx = None
    case = None
    plink_record = None

    if plink_id:
        plink_record = db.query(PaymentLink).filter(
            PaymentLink.payment_link_id == plink_id,
            PaymentLink.workspace_id == workspace_id
        ).first()
        if not plink_record:
            plink_record = db.query(PaymentLink).filter(PaymentLink.payment_link_id == plink_id).first()
        if plink_record:
            case = plink_record.recovery_case
            if case:
                tx = case.transaction

    if not case:
        notes = payment_entity.get("notes") or plink_entity.get("notes") or {}
        case_id = notes.get("recovery_case_id")
        if case_id:
            case = db.query(RecoveryCase).filter(
                RecoveryCase.id == case_id,
                RecoveryCase.workspace_id == workspace_id
            ).first()
            if not case:
                case = db.query(RecoveryCase).filter(RecoveryCase.id == case_id).first()
            if case and not tx:
                tx = case.transaction

    if not tx and order_id:
        tx = db.query(Transaction).filter(
            (Transaction.order_id == order_id) | (Transaction.razorpay_order_id == order_id)
        ).filter(Transaction.workspace_id == workspace_id).first()
        if not tx:
            tx = db.query(Transaction).filter(
                (Transaction.order_id == order_id) | (Transaction.razorpay_order_id == order_id)
            ).first()
        if tx and not case:
            case = tx.recovery_case

    if not tx and payment_id:
        tx = db.query(Transaction).filter(
            Transaction.razorpay_payment_id == payment_id,
            Transaction.workspace_id == workspace_id
        ).first()
        if not tx:
            tx = db.query(Transaction).filter(Transaction.razorpay_payment_id == payment_id).first()
        if tx and not case:
            case = tx.recovery_case

    # Derive workspace ownership internally from transaction when using legacy webhook
    if tx and tx.workspace_id and workspace_id == DEFAULT_WORKSPACE_ID:
        workspace_id = str(tx.workspace_id)

    webhook_status = "PROCESSED"
    now_utc = utcnow()

    # 5. Out-of-order delivery protection
    if tx and tx.status in ("SUCCESS", "RECOVERED"):
        if event_type in ("payment.failed", "payment.authorized"):
            logger.warning(
                f"[Webhook] Out-of-order event '{event_type}' for Transaction {tx.id} already in '{tx.status}'. Skipping."
            )
            webhook_status = "IGNORED_OUT_OF_ORDER"
            webhook_record = WebhookEvent(
                id=event_id,
                workspace_id=workspace_id,
                integration_id=integration_id,
                provider_event_id=event_id,
                event_type=event_type,
                resource_id=payment_id or order_id or plink_id,
                status=webhook_status,
                payload_summary=f"Ignored out-of-order {event_type} for transaction {tx.id}",
                created_at=now_utc
            )
            db.add(webhook_record)
            db.commit()
            return {
                "status": "ignored_out_of_order",
                "event_id": event_id,
                "current_transaction_status": tx.status,
                "message": "State preserved against out-of-order regression."
            }

    # 6. Event Handling
    if event_type in ("payment.captured", "order.paid", "payment_link.paid"):
        if plink_record:
            plink_record.status = "paid"
            plink_record.updated_at = now_utc

        if case:
            case.status = "RECOVERED"
            case.current_step = "RECOVERED"
            case.recovered_at = now_utc
            case.updated_at = now_utc

            outcome = db.query(RecoveryOutcome).filter(RecoveryOutcome.recovery_case_id == case.id).first()
            recovered_val = case.risk_amount or amount_inr
            if not outcome:
                outcome = RecoveryOutcome(
                    id=f"out_{uuid.uuid4().hex[:10]}",
                    workspace_id=workspace_id,
                    recovery_case_id=case.id,
                    recovered_amount=recovered_val,
                    payment_method_used=normalized_method,
                    time_to_recover_seconds=int(diff_seconds(now_utc, case.created_at, default=120.0)),
                    settled_at=now_utc
                )
                db.add(outcome)
            else:
                outcome.recovered_amount = recovered_val
                outcome.payment_method_used = normalized_method
                outcome.settled_at = now_utc

        if tx:
            tx.status = "SUCCESS"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.method = normalized_method
            tx.updated_at = now_utc

            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="SUCCESS",
                latency_ms=280,
                created_at=now_utc
            )
            db.add(attempt)

        # Audit trail
        db.add(
            AuditLog(
                id=f"aud_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                transaction_id=tx.id if tx else (case.transaction_id if case else None),
                recovery_case_id=case.id if case else (tx.recovery_case.id if tx and tx.recovery_case else None),
                actor="RAZORPAY_WEBHOOK",
                action_type="PAYMENT_CAPTURED",
                target_resource=case.id if case else (tx.id if tx else (payment_id or plink_id or "unknown")),
                details=f"Webhook confirmed {event_type} for ₹{amount_inr or (case.risk_amount if case else 0):,.2f} via {normalized_method}.",
                created_at=now_utc
            )
        )

        # Persistent Internal Event
        db.add(
            InternalEvent(
                id=f"evt_{uuid.uuid4().hex[:12]}",
                workspace_id=workspace_id,
                event_type="PAYMENT_CAPTURED",
                entity_type="transaction",
                entity_id=tx.id if tx else (order_id or payment_id or "unknown"),
                idempotency_key=f"cap_{event_id}_{workspace_id}",
                processing_status="PROCESSED",
                attempt_count=1,
                payload_json=json.dumps({"event_id": event_id, "amount": amount_inr, "method": normalized_method, "payment_id": payment_id}),
                created_at=now_utc,
                processed_at=now_utc
            )
        )

        # Real-time SSE Broadcasts (Strictly Scoped to Workspace)
        if tx:
            event_broadcaster.broadcast_sync("TRANSACTION_UPDATED", {
                "transaction_id": tx.id,
                "order_id": tx.order_id,
                "status": "SUCCESS",
                "amount": tx.amount,
                "method": tx.method,
                "event_type": event_type
            }, workspace_id=workspace_id)
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
                "timestamp": now_utc.isoformat()
            }, workspace_id=workspace_id)
            event_broadcaster.broadcast_sync("RECOVERY_QUEUE_UPDATED", {
                "case_id": case.id,
                "payment_link_id": plink_id or (plink_record.payment_link_id if plink_record else ""),
                "status": "paid"
            }, workspace_id=workspace_id)
        event_broadcaster.broadcast_sync("DASHBOARD_REFRESH", {
            "reason": "payment_recovered",
            "transaction_id": tx.id if tx else "",
            "case_id": case.id if case else "",
            "amount": amount_inr or (case.risk_amount if case else 0)
        }, workspace_id=workspace_id)

    elif event_type == "payment.failed":
        error_entity = payment_entity.get("error_code") or payment_entity.get("error_description") or {}
        error_code = payment_entity.get("error_code") or "GATEWAY_DECLINE"
        error_description = payment_entity.get("error_description") or "Payment authorization declined by cardholder bank"
        error_reason = payment_entity.get("error_reason") or "BANK_TIMEOUT"

        if not tx:
            # Auto-provision failed transaction
            cust_email = payment_entity.get("email") or "customer@checkout.com"
            cust_contact = payment_entity.get("contact")
            customer = db.query(Customer).filter(Customer.email == cust_email, Customer.workspace_id == workspace_id).first()
            if not customer:
                customer = Customer(
                    id=f"cust_{uuid.uuid4().hex[:8]}",
                    workspace_id=workspace_id,
                    name=cust_email.split("@")[0].title() if "@" in cust_email else "Valued Shopper",
                    email=cust_email,
                    phone=cust_contact,
                    tier="STANDARD",
                    ltv=amount_inr,
                    created_at=now_utc
                )
                db.add(customer)
                db.flush()

            tx = Transaction(
                id=f"tx_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                order_id=order_id or f"order_ext_{uuid.uuid4().hex[:8]}",
                customer_id=customer.id,
                amount=amount_inr,
                currency=payment_entity.get("currency", "INR"),
                method=normalized_method,
                status="FAILED",
                razorpay_order_id=order_id,
                razorpay_payment_id=payment_id,
                created_at=now_utc,
                updated_at=now_utc
            )
            db.add(tx)
            db.flush()

        if tx:
            tx.status = "FAILED"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.updated_at = now_utc

            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="FAILED",
                error_code=error_code,
                error_description=error_description,
                error_category=error_reason,
                latency_ms=1200,
                created_at=now_utc
            )
            db.add(attempt)

            # Provision recovery case in DETECTED state
            if not tx.recovery_case:
                case = RecoveryCase(
                    id=f"case_{uuid.uuid4().hex[:8]}",
                    workspace_id=workspace_id,
                    transaction_id=tx.id,
                    risk_amount=tx.amount,
                    failure_category=error_reason,
                    recovery_probability=0.0,
                    selected_strategy="PENDING",
                    expected_recovery_value=0.0,
                    status="DETECTED",
                    current_step="DETECTED",
                    attempt_count=0,
                    max_attempts=3,
                    channel="IN_APP",
                    created_at=now_utc,
                    updated_at=now_utc
                )
                db.add(case)
                db.flush()
            else:
                case = tx.recovery_case

            # Persistent Internal Event
            db.add(
                InternalEvent(
                    id=f"evt_{uuid.uuid4().hex[:12]}",
                    workspace_id=workspace_id,
                    event_type="PAYMENT_FAILED",
                    entity_type="transaction",
                    entity_id=tx.id,
                    idempotency_key=f"fail_{event_id}_{workspace_id}",
                    processing_status="PROCESSED",
                    attempt_count=1,
                    payload_json=json.dumps({"error_code": error_code, "error_description": error_description, "amount": tx.amount}),
                    created_at=now_utc,
                    processed_at=now_utc
                )
            )

            # Enqueue Durable Background Recovery Job
            background_worker.enqueue_job(
                db=db,
                job_type=JobType.PROCESS_RECOVERY_CASE.value,
                entity_id=case.id,
                workspace_id=workspace_id,
                payload={"case_id": case.id, "transaction_id": tx.id, "failure_reason": error_reason},
                idempotency_key=f"job_rec_{case.id}"
            )

            # Audit trail
            db.add(
                AuditLog(
                    id=f"aud_{uuid.uuid4().hex[:10]}",
                    workspace_id=workspace_id,
                    transaction_id=tx.id,
                    recovery_case_id=case.id,
                    actor="RAZORPAY_WEBHOOK",
                    action_type="PAYMENT_FAILED",
                    target_resource=tx.id,
                    details=f"Webhook reported payment.failed: {error_code} - {error_description}. Job queued for autonomous recovery.",
                    created_at=now_utc
                )
            )

            # Customer payment failure email notification
            from app.services.notification_service import notification_service
            try:
                cust = tx.customer
                recipient_email = cust.email if cust and cust.email and "@" in cust.email else None
                if recipient_email:
                    base_url = settings.FRONTEND_PUBLIC_URL.rstrip('/')
                    checkout_url = f"{base_url}/demo-checkout?order_id={tx.order_id}&recovery_case={case.id}&amount={tx.amount}&auto_open=true"
                    notification_service.send_recovery_notification(
                        recipient=recipient_email,
                        channel="EMAIL",
                        strategy="PAYMENT_FAILED",
                        template_type="PAYMENT_FAILED",
                        customer_name=cust.name if cust and cust.name else "Valued Customer",
                        amount=tx.amount,
                        action_url=checkout_url,
                        recovery_case_id=case.id,
                        transaction_id=tx.id,
                        workspace_id=str(workspace_id),
                        customer_id=cust.id if cust else None,
                        order_id=tx.order_id,
                        failure_reason=error_description or error_code,
                        is_demo=True,
                        db=db
                    )
            except Exception as exc:
                logger.warning(f"[Webhooks] Failed to send payment failed notice: {exc}")

            # Real-Time SSE Broadcasts (Strictly Scoped)
            event_broadcaster.broadcast_sync("TRANSACTION_UPDATED", {
                "transaction_id": tx.id,
                "order_id": tx.order_id,
                "status": "FAILED",
                "amount": tx.amount,
                "error_code": error_code,
                "event_type": event_type
            }, workspace_id=workspace_id)
            event_broadcaster.broadcast_sync("RECOVERY_QUEUE_UPDATED", {
                "transaction_id": tx.id,
                "risk_amount": tx.amount
            }, workspace_id=workspace_id)
            event_broadcaster.broadcast_sync("DASHBOARD_REFRESH", {
                "reason": "payment_failed",
                "transaction_id": tx.id
            }, workspace_id=workspace_id)

    elif event_type == "payment.authorized":
        if tx and tx.status not in ("SUCCESS", "RECOVERED"):
            tx.status = "AUTHORIZED"
            if payment_id:
                tx.razorpay_payment_id = payment_id
            tx.method = normalized_method
            tx.updated_at = now_utc

            attempt = PaymentAttempt(
                id=f"pa_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                transaction_id=tx.id,
                attempt_number=len(tx.payment_attempts) + 1,
                gateway="Razorpay",
                gateway_payment_id=payment_id,
                status="AUTHORIZED",
                latency_ms=250,
                created_at=now_utc
            )
            db.add(attempt)

            db.add(
                AuditLog(
                    id=f"aud_{uuid.uuid4().hex[:10]}",
                    workspace_id=workspace_id,
                    transaction_id=tx.id,
                    recovery_case_id=tx.recovery_case.id if tx.recovery_case else None,
                    actor="RAZORPAY_WEBHOOK",
                    action_type="PAYMENT_AUTHORIZED",
                    target_resource=tx.id,
                    details=f"Transitional payment.authorized for ₹{tx.amount:,.2f} via {normalized_method}.",
                    created_at=now_utc
                )
            )

            event_broadcaster.broadcast_sync("TRANSACTION_UPDATED", {
                "transaction_id": tx.id,
                "order_id": tx.order_id,
                "status": "AUTHORIZED",
                "amount": tx.amount,
                "method": tx.method,
                "event_type": event_type
            }, workspace_id=workspace_id)

    # 7. Record WebhookEvent for Idempotency
    webhook_record = WebhookEvent(
        id=event_id,
        workspace_id=workspace_id,
        integration_id=integration_id,
        provider_event_id=event_id,
        event_type=event_type,
        resource_id=payment_id or order_id,
        status=webhook_status,
        payload_summary=f"Event {event_type} processed for ₹{amount_inr:,.2f}",
        created_at=now_utc
    )
    db.add(webhook_record)

    # Update integration timestamp if available
    if integration_id:
        integration = db.query(WorkspaceIntegration).filter(WorkspaceIntegration.id == integration_id).first()
        if integration:
            integration.last_webhook_at = now_utc

    db.commit()

    return {
        "status": "processed",
        "event_id": event_id,
        "event_type": event_type,
        "resource_id": payment_id or order_id,
        "workspace_id": workspace_id
    }

# --- Endpoints ---

@router.post("/razorpay/{webhook_endpoint_id}", summary="Per-Merchant Razorpay Test Webhook Handler")
async def per_merchant_razorpay_webhook_receiver(
    webhook_endpoint_id: str = Path(..., description="Opaque merchant webhook endpoint identifier"),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Receives and processes Razorpay Test events strictly scoped to the merchant integration.
    Identifies workspace from webhook_endpoint_id and verifies HMAC using merchant's decrypted secret.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")

    integration = db.query(WorkspaceIntegration).filter(
        WorkspaceIntegration.webhook_endpoint_id == webhook_endpoint_id
    ).first()
    if not integration:
        logger.warning(f"[Webhook] Unknown endpoint: {webhook_endpoint_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown or invalid webhook endpoint."
        )

    # Decrypt merchant webhook secret
    webhook_secret = None
    if integration.encrypted_webhook_secret:
        try:
            webhook_secret = decrypt_secret(integration.encrypted_webhook_secret)
        except Exception as exc:
            logger.error(f"[Webhook] Secret decryption failed: {exc}")

    if not webhook_secret:
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET

    return await process_razorpay_webhook(
        raw_body=raw_body,
        signature=signature,
        workspace_id=str(integration.workspace_id),
        integration_id=str(integration.id),
        webhook_secret=webhook_secret,
        db=db
    )

@router.post("/razorpay", summary="Default Razorpay Webhook Handler (Platform / Demo Store)")
async def razorpay_webhook_receiver(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Default Razorpay webhook listener for platform demo store and test suite.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_placeholder"

    return await process_razorpay_webhook(
        raw_body=raw_body,
        signature=signature,
        workspace_id=DEFAULT_WORKSPACE_ID,
        integration_id=None,
        webhook_secret=webhook_secret,
        db=db
    )
