"""
RecoverAI - Central Email Service & Policy Engine
Coordinates policy evaluation, idempotency, test-mode allowlists,
durable CustomerMessage tracking, Resend dispatching, and audit events.
"""

import json
import uuid
import re
from datetime import datetime, timedelta, timezone, time as dt_time
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.config import settings
from app.core.logging import logger
from app.core.datetime_utils import utcnow
from app.core.events import event_broadcaster
from app.models import (
    CustomerMessage,
    WorkspaceSettings,
    Customer,
    RecoveryCase,
    RecoveryAction,
    Transaction,
    AuditLog
)
from app.services.notifications.base import (
    NotificationResult,
    NotificationStatus,
    TemplateType
)
from app.services.notifications.templates import render_template
from app.services.notifications.resend_adapter import resend_adapter

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailService:
    """Enterprise policy-aware email recovery orchestrator."""

    def _is_valid_email(self, email: Optional[str]) -> bool:
        if not email:
            return False
        return bool(EMAIL_REGEX.match(email.strip()))

    def _is_in_quiet_hours(self, start_str: str, end_str: str, tz_name: str) -> bool:
        """Determines if current moment is inside quiet hours for merchant's local timezone."""
        try:
            from zoneinfo import ZoneInfo
            tz = ZoneInfo(tz_name or "Asia/Kolkata")
        except Exception:
            tz = timezone(timedelta(hours=5, minutes=30))

        now_local = datetime.now(tz)
        now_time = now_local.time()

        try:
            start_parts = [int(p) for p in start_str.split(":")]
            end_parts = [int(p) for p in end_str.split(":")]
            start_t = dt_time(start_parts[0], start_parts[1])
            end_t = dt_time(end_parts[0], end_parts[1])

            if start_t > end_t:
                # Spans midnight, e.g. 22:00 -> 08:00
                return now_time >= start_t or now_time < end_t
            else:
                return start_t <= now_time < end_t
        except Exception as e:
            logger.warning(f"[EmailPolicy] Failed to evaluate quiet hours: {e}")
            return False

    def generate_idempotency_key(
        self,
        workspace_id: str,
        recovery_case_id: Optional[str],
        recovery_action_id: Optional[str],
        template_type: str,
        attempt_number: int = 1
    ) -> str:
        """Creates a deterministic business key to prevent any duplicate customer message."""
        case_part = recovery_case_id or "no_case"
        act_part = recovery_action_id or "no_act"
        return f"idemp_{workspace_id[:8]}_{case_part[:12]}_{act_part[:10]}_{template_type.lower()}_att{attempt_number}"

    def evaluate_email_policy(
        self,
        recipient: str,
        workspace_id: str,
        db: Session,
        recovery_case_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        bypass_quiet_hours: bool = False,
        template_type: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates whether communication is permissible under all RecoverAI and merchant policies:
        - Valid syntax
        - Global settings
        - Customer opt-out
        - Case status (already paid / recovered)
        - Workspace email policy (enabled, max messages, cooldown, quiet hours)
        """
        # 1. Recipient syntax check
        if not self._is_valid_email(recipient):
            return False, "INVALID_RECIPIENT_SYNTAX"

        # 2. Global platform switch
        if not getattr(settings, "EMAIL_ENABLED", True):
            return False, "GLOBAL_EMAIL_DISABLED"

        # 3. Customer Opt-Out Check
        if customer_id:
            cust = db.query(Customer).filter(Customer.id == customer_id).first()
            if cust and cust.email_opt_out:
                return False, "CUSTOMER_OPTED_OUT"

        # 4. Check if case or transaction is already terminal or paid
        if recovery_case_id:
            case = db.query(RecoveryCase).filter(RecoveryCase.id == recovery_case_id).first()
            if case:
                if case.status in ("RECOVERED", "STOPPED"):
                    return False, f"CASE_TERMINAL_{case.status}"
                tx = case.transaction
                if tx and tx.status in ("SUCCESS", "RECOVERED"):
                    return False, "TRANSACTION_ALREADY_PAID"

        # 5. Workspace Email Policy
        ws_settings = db.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == workspace_id).first()
        if ws_settings:
            # Policy switch
            if not getattr(ws_settings, "email_enabled", True):
                return False, "WORKSPACE_EMAIL_DISABLED"

            is_immediate_recovery = template_type == "PAYMENT_FAILED"

            # Max communications check for this case
            if recovery_case_id and not is_immediate_recovery:
                max_emails = getattr(ws_settings, "max_emails_per_recovery", 3)
                existing_count = (
                    db.query(CustomerMessage)
                    .filter(
                        CustomerMessage.workspace_id == workspace_id,
                        CustomerMessage.recovery_case_id == recovery_case_id,
                        CustomerMessage.status.in_(["SENT", "DELIVERED", "SENDING"])
                    )
                    .count()
                )
                if existing_count >= max_emails:
                    return False, "MAX_RECOVERY_EMAILS_EXCEEDED"

                # Cooldown check (bypassed for immediate failure alerts and live demo testing)
                cooldown_mins = getattr(ws_settings, "email_cooldown_minutes", 30)
                if not is_immediate_recovery and not bypass_quiet_hours and cooldown_mins > 0:
                    cutoff = utcnow() - timedelta(minutes=cooldown_mins)
                    recent_send = (
                        db.query(CustomerMessage)
                        .filter(
                            CustomerMessage.workspace_id == workspace_id,
                            CustomerMessage.recovery_case_id == recovery_case_id,
                            CustomerMessage.status.in_(["SENT", "DELIVERED", "SENDING"]),
                            CustomerMessage.created_at >= cutoff
                        )
                        .first()
                    )
                    if recent_send:
                        return False, "EMAIL_COOLDOWN_ACTIVE"

            # Quiet Hours Check (bypassed for explicit operator diagnostic tests or immediate payment failure alerts)
            if not is_immediate_recovery and not bypass_quiet_hours and getattr(ws_settings, "quiet_hours_enabled", True) and getattr(ws_settings, "email_quiet_hours_enabled", True):
                q_start = getattr(ws_settings, "email_quiet_hours_start", "22:00")
                q_end = getattr(ws_settings, "email_quiet_hours_end", "08:00")
                tz = getattr(ws_settings, "timezone", "Asia/Kolkata")
                if self._is_in_quiet_hours(q_start, q_end, tz):
                    return False, "QUIET_HOURS_ACTIVE"

        return True, None

    def send_recovery_email(
        self,
        recipient: str,
        template_type: str,
        template_context: Dict[str, Any],
        workspace_id: str,
        db: Session,
        recovery_case_id: Optional[str] = None,
        transaction_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        recovery_action_id: Optional[str] = None,
        recovery_job_id: Optional[str] = None,
        attempt_number: int = 1,
        is_async: bool = False,
        bypass_quiet_hours: bool = False,
        custom_idempotency_key: Optional[str] = None
    ) -> NotificationResult:
        """
        Coordinates full transactional recovery email dispatch:
        1. Generates deterministic business idempotency key.
        2. Returns cached result if identical message was already processed.
        3. Evaluates fintech safety, customer opt-out, cooldown, and quiet hours.
        4. Enforces Phase 4 No-Domain Test Mode restrictions.
        5. Persists durable CustomerMessage and AuditLog.
        6. Dispatches to Resend and updates lifecycle status.
        """
        cleaned_recipient = (recipient or "").strip()
        now = utcnow()

        # Defensive check: if connected to PostgreSQL or DB enforcing FKs, ensure referenced records exist
        if recovery_case_id:
            try:
                if db.bind and db.bind.dialect.name == "postgresql":
                    case_exists = db.query(RecoveryCase.id).filter(RecoveryCase.id == recovery_case_id).first()
                    if not case_exists:
                        logger.warning(
                            f"[EmailService] recovery_case_id '{recovery_case_id}' not found in database; setting to None."
                        )
                        recovery_case_id = None
            except Exception as e:
                logger.warning(f"[EmailService] Could not check recovery_case_id in DB: {e}")

        if transaction_id:
            try:
                if db.bind and db.bind.dialect.name == "postgresql":
                    tx_exists = db.query(Transaction.id).filter(Transaction.id == transaction_id).first()
                    if not tx_exists:
                        transaction_id = None
            except Exception as e:
                logger.warning(f"[EmailService] Could not check transaction_id in DB: {e}")

        if recovery_action_id:
            try:
                if db.bind and db.bind.dialect.name == "postgresql":
                    act_exists = db.query(RecoveryAction.id).filter(RecoveryAction.id == recovery_action_id).first()
                    if not act_exists:
                        recovery_action_id = None
            except Exception as e:
                logger.warning(f"[EmailService] Could not check recovery_action_id in DB: {e}")

        # Generate deterministic idempotency key or use custom key for on-demand diagnostic tests
        if custom_idempotency_key:
            idempotency_key = custom_idempotency_key
        else:
            idempotency_key = self.generate_idempotency_key(
                workspace_id=workspace_id,
                recovery_case_id=recovery_case_id,
                recovery_action_id=recovery_action_id,
                template_type=template_type,
                attempt_number=attempt_number
            )

        # 1. Idempotency Check: if already processed, return existing
        existing_msg = (
            db.query(CustomerMessage)
            .filter(
                CustomerMessage.workspace_id == workspace_id,
                CustomerMessage.idempotency_key == idempotency_key
            )
            .first()
        )
        if existing_msg:
            logger.info(
                f"[EmailService] Idempotency cache hit: Msg {existing_msg.id} ({existing_msg.status}) "
                f"for key {idempotency_key}."
            )
            return NotificationResult(
                success=existing_msg.status in (NotificationStatus.SENT.value, NotificationStatus.DELIVERED.value),
                provider=existing_msg.provider or "resend",
                provider_message_id=existing_msg.provider_message_id,
                status=existing_msg.status,
                idempotency_key=existing_msg.idempotency_key,
                delivery_label="RESEND EMAIL" if existing_msg.status == "SENT" else existing_msg.status,
                details={"id": str(existing_msg.id), "cached": True}
            )

        # 2. Render Template
        subject, text_body, html_body = render_template(template_type, template_context)

        # 3. Policy Evaluation
        allowed, rejection_code = self.evaluate_email_policy(
            recipient=cleaned_recipient,
            workspace_id=workspace_id,
            db=db,
            recovery_case_id=recovery_case_id,
            customer_id=customer_id,
            bypass_quiet_hours=bypass_quiet_hours,
            template_type=template_type
        )

        if not allowed:
            logger.info(
                f"[EmailService] Email suppressed by policy ({rejection_code}) for {cleaned_recipient} in workspace {workspace_id}."
            )
            # Create a BLOCKED message record for auditability
            blocked_msg = CustomerMessage(
                id=str(uuid.uuid4()),
                workspace_id=workspace_id,
                recovery_case_id=recovery_case_id,
                transaction_id=transaction_id,
                customer_id=customer_id,
                recovery_action_id=recovery_action_id,
                recovery_job_id=recovery_job_id,
                channel="EMAIL",
                recipient=cleaned_recipient,
                subject=subject,
                template_type=template_type,
                message_text=text_body,
                body_text=text_body,
                message_html=html_body,
                provider="resend",
                status=NotificationStatus.BLOCKED.value,
                idempotency_key=idempotency_key,
                attempt_count=attempt_number,
                created_at=now,
                error_code=rejection_code,
                error_message=f"Suppressed by policy: {rejection_code}",
                error=f"Suppressed by policy: {rejection_code}"
            )
            db.add(blocked_msg)
            db.commit()

            self._record_audit_log(
                db=db,
                workspace_id=workspace_id,
                action_type="EMAIL_BLOCKED",
                recovery_case_id=recovery_case_id,
                transaction_id=transaction_id,
                details=f"Email to {cleaned_recipient} blocked: {rejection_code}.",
                metadata={"reason": rejection_code, "idempotency_key": idempotency_key}
            )

            return NotificationResult(
                success=False,
                provider="resend",
                status=NotificationStatus.BLOCKED.value,
                error_code=rejection_code,
                error_message=f"Email blocked: {rejection_code}",
                idempotency_key=idempotency_key,
                delivery_label="POLICY BLOCKED"
            )

        # 4. Dispatch Recipient Resolution
        # Always dispatch directly to the entered recipient email address
        is_test_mode = getattr(settings, "EMAIL_TEST_MODE", False)
        actual_dispatch_to = cleaned_recipient
        was_redirected = False
        original_intended_recipient = None

        if is_test_mode:
            allowed_recipients = settings.get_allowed_test_recipients()
            norm_recip = cleaned_recipient.lower()
            if allowed_recipients and norm_recip not in allowed_recipients:
                auto_redirect = getattr(settings, "EMAIL_AUTO_REDIRECT_DEMO", False)
                primary_test_email = settings.get_primary_test_recipient()
                # Only redirect synthetic placeholder domains (@techcorp.in, @zenithai.com) in mock tests
                # Real entered user email addresses are NEVER hijacked or redirected
                SYNTHETIC_MOCK_DOMAINS = ("@techcorp.in", "@zenithai.com", "@local.dev")
                is_synthetic_mock = any(norm_recip.endswith(d) for d in SYNTHETIC_MOCK_DOMAINS)
                is_demo_eligible = bool(
                    auto_redirect and primary_test_email and (is_synthetic_mock or template_context.get("auto_redirect_demo", False))
                )

                if is_demo_eligible:
                    actual_dispatch_to = primary_test_email
                    was_redirected = True
                    original_intended_recipient = cleaned_recipient
                    logger.info(
                        f"[EmailService] EMAIL_TEST_MODE redirected synthetic mock email for '{cleaned_recipient}' "
                        f"to verified test recipient '{primary_test_email}'."
                    )

                    redirect_banner_text = (
                        f"[RECOVERAI DEMO TEST NOTICE: Originally destined for {cleaned_recipient} during checkout]\n\n"
                    )
                    text_body = redirect_banner_text + text_body

                    redirect_banner_html = (
                        f'<div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; '
                        f'padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; '
                        f'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">'
                        f'<strong>⚠️ RecoverAI Test Mode Notice:</strong> This recovery email was originally addressed to '
                        f'<code>{cleaned_recipient}</code> in demo checkout and automatically routed to your verified test inbox.'
                        f'</div>'
                    )
                    html_body = redirect_banner_html + html_body
                else:
                    block_reason = "Email delivery restricted to configured test recipients."
                    logger.warning(
                        f"[EmailService] Blocked non-test recipient '{cleaned_recipient}' in EMAIL_TEST_MODE. "
                        f"Configured allowlist: {list(allowed_recipients)}"
                    )

                    blocked_msg = CustomerMessage(
                        id=str(uuid.uuid4()),
                        workspace_id=workspace_id,
                        recovery_case_id=recovery_case_id,
                        transaction_id=transaction_id,
                        customer_id=customer_id,
                        recovery_action_id=recovery_action_id,
                        recovery_job_id=recovery_job_id,
                        channel="EMAIL",
                        recipient=cleaned_recipient,
                        subject=subject,
                        template_type=template_type,
                        message_text=text_body,
                        body_text=text_body,
                        message_html=html_body,
                        provider="resend",
                        status=NotificationStatus.BLOCKED.value,
                        idempotency_key=idempotency_key,
                        attempt_count=attempt_number,
                        created_at=now,
                        error_code="BLOCKED_TEST_RECIPIENT",
                        error_message=block_reason,
                        error=block_reason
                    )
                    db.add(blocked_msg)
                    db.commit()

                    self._record_audit_log(
                        db=db,
                        workspace_id=workspace_id,
                        action_type="EMAIL_BLOCKED",
                        recovery_case_id=recovery_case_id,
                        transaction_id=transaction_id,
                        details=f"Email to {cleaned_recipient} blocked: {block_reason}",
                        metadata={"error_code": "BLOCKED_TEST_RECIPIENT", "recipient": cleaned_recipient}
                    )

                    # Broadcast real-time SSE with BLOCKED_TEST_RECIPIENT label
                    event_broadcaster.broadcast_sync(
                        "EMAIL_STATUS_CHANGED",
                        {
                            "message_id": str(blocked_msg.id),
                            "recipient": cleaned_recipient,
                            "status": "BLOCKED",
                            "delivery_label": "BLOCKED_TEST_RECIPIENT",
                            "error_code": "BLOCKED_TEST_RECIPIENT",
                            "error_message": block_reason,
                            "recovery_case_id": recovery_case_id,
                            "workspace_id": str(workspace_id),
                            "timestamp": now.isoformat()
                        },
                        workspace_id=workspace_id
                    )

                    return NotificationResult(
                        success=False,
                        provider="resend",
                        status=NotificationStatus.BLOCKED.value,
                        error_code="BLOCKED_TEST_RECIPIENT",
                        error_message=block_reason,
                        idempotency_key=idempotency_key,
                        delivery_label="BLOCKED_TEST_RECIPIENT"
                    )

        # 5. Persist QUEUED state before attempting external network request
        message_id = str(uuid.uuid4())
        msg = CustomerMessage(
            id=message_id,
            workspace_id=workspace_id,
            recovery_case_id=recovery_case_id,
            transaction_id=transaction_id,
            customer_id=customer_id,
            recovery_action_id=recovery_action_id,
            recovery_job_id=recovery_job_id,
            channel="EMAIL",
            recipient=cleaned_recipient,
            subject=subject,
            template_type=template_type,
            message_text=text_body,
            body_text=text_body,
            message_html=html_body,
            provider="resend",
            status=NotificationStatus.QUEUED.value,
            idempotency_key=idempotency_key,
            attempt_count=attempt_number,
            created_at=now,
            metadata_json=json.dumps({"was_redirected": was_redirected, "actual_dispatch_to": actual_dispatch_to, "original_recipient": original_intended_recipient}) if was_redirected else None
        )
        db.add(msg)
        db.commit()

        self._record_audit_log(
            db=db,
            workspace_id=workspace_id,
            action_type="EMAIL_QUEUED",
            recovery_case_id=recovery_case_id,
            transaction_id=transaction_id,
            details=f"Email queued for dispatch to {cleaned_recipient}{' (redirected to ' + actual_dispatch_to + ')' if was_redirected else ''} via Resend.",
            metadata={"message_id": message_id, "template_type": template_type}
        )

        # 6. Dispatch to Resend Provider
        msg.status = NotificationStatus.SENDING.value
        db.commit()

        send_res = resend_adapter.send_sync(
            to=actual_dispatch_to,
            subject=subject,
            html_content=html_body,
            text_content=text_body
        )

        # Sandbox Fallback: If Resend rejects because destination is restricted to account owner on onboarding@resend.dev
        if (
            not send_res.success
            and send_res.error_message
            and "only send testing emails to your own email address" in send_res.error_message
        ):
            import re
            m = re.search(r"\(([^)]+@[^)]+)\)", send_res.error_message)
            verified_owner = m.group(1) if m else None  # Never hardcode — only use what Resend tells us
            if verified_owner and verified_owner.lower() != actual_dispatch_to.lower():
                logger.warning(
                    f"[EmailService] Resend sandbox restriction: '{actual_dispatch_to}' redirected to "
                    f"verified Resend account owner '{verified_owner}'. "
                    f"Verify a custom domain at resend.com/domains to send to any recipient."
                )
                sandbox_banner_html = (
                    f'<div style="background-color: #fef3c7; border: 2px solid #f59e0b; color: #92400e; '
                    f'padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; '
                    f'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">'
                    f'<strong>⚠️ Resend Sandbox — Delivery Redirected</strong><br><br>'
                    f'This recovery email was <strong>originally addressed to: '
                    f'<code>{cleaned_recipient}</code></strong>.<br><br>'
                    f'Because <code>onboarding@resend.dev</code> is a shared Resend test domain, it can only '
                    f'deliver to your Resend account owner (<code>{verified_owner}</code>).<br><br>'
                    f'<strong>To send to any customer email, verify a custom domain at '
                    f'<a href="https://resend.com/domains" style="color:#92400e;">resend.com/domains</a>.</strong>'
                    f'</div>'
                )
                sandbox_banner_text = (
                    f"=== RESEND SANDBOX DELIVERY NOTICE ===\n"
                    f"ORIGINALLY ADDRESSED TO: {cleaned_recipient}\n"
                    f"DELIVERED TO: {verified_owner} (Resend account owner)\n"
                    f"REASON: onboarding@resend.dev can only deliver to the Resend account owner.\n"
                    f"FIX: Verify a custom domain at resend.com/domains to send to any recipient.\n"
                    f"========================================\n\n"
                )
                # Prefix subject so it's instantly clear who this was intended for
                sandboxed_subject = f"[INTENDED FOR: {cleaned_recipient}] {subject}"
                retry_res = resend_adapter.send_sync(
                    to=verified_owner,
                    subject=sandboxed_subject,
                    html_content=sandbox_banner_html + html_body,
                    text_content=sandbox_banner_text + text_body
                )
                if retry_res.success:
                    send_res = retry_res
                    was_redirected = True
                    original_intended_recipient = cleaned_recipient
                    actual_dispatch_to = verified_owner
                    msg.metadata_json = json.dumps({
                        "was_redirected": True,
                        "actual_dispatch_to": verified_owner,
                        "original_recipient": cleaned_recipient,
                        "sandbox_notice": f"Resend sandbox: onboarding@resend.dev can only deliver to account owner. Verify domain at resend.com/domains to send to any recipient."
                    })

        # 7. Update status based on provider acceptance
        if send_res.success:
            msg.status = NotificationStatus.SENT.value
            msg.provider_message_id = send_res.provider_message_id
            msg.sent_at = utcnow()
            db.commit()

            self._record_audit_log(
                db=db,
                workspace_id=workspace_id,
                action_type="EMAIL_SENT",
                recovery_case_id=recovery_case_id,
                transaction_id=transaction_id,
                details=f"Email sent via Resend to {cleaned_recipient}{' (redirected to ' + actual_dispatch_to + ')' if was_redirected else ''} (Provider ID: {send_res.provider_message_id}).",
                metadata={"provider_message_id": send_res.provider_message_id, "was_redirected": was_redirected, "actual_dispatch_to": actual_dispatch_to}
            )

            # Broadcast SSE
            event_broadcaster.broadcast_sync(
                "EMAIL_STATUS_CHANGED",
                {
                    "message_id": message_id,
                    "recipient": cleaned_recipient,
                    "status": "SENT",
                    "delivery_label": "RESEND EMAIL",
                    "provider_message_id": send_res.provider_message_id,
                    "recovery_case_id": recovery_case_id,
                    "workspace_id": str(workspace_id),
                    "was_redirected": was_redirected,
                    "actual_dispatch_to": actual_dispatch_to if was_redirected else None,
                    "timestamp": utcnow().isoformat()
                },
                workspace_id=workspace_id
            )
            event_broadcaster.broadcast_sync(
                "NOTIFICATION_DISPATCHED",
                {
                    "notification_id": message_id,
                    "channel": "EMAIL",
                    "recipient": cleaned_recipient,
                    "delivery_label": "RESEND EMAIL",
                    "status": "SENT",
                    "title": subject,
                    "body": text_body,
                    "recovery_case_id": recovery_case_id,
                    "dispatched_at": utcnow().isoformat()
                },
                workspace_id=workspace_id
            )
        else:
            msg.status = NotificationStatus.FAILED.value
            msg.failed_at = utcnow()
            msg.error_code = send_res.error_code
            msg.error_message = send_res.error_message
            msg.error = send_res.error_message
            db.commit()

            self._record_audit_log(
                db=db,
                workspace_id=workspace_id,
                action_type="EMAIL_FAILED",
                recovery_case_id=recovery_case_id,
                transaction_id=transaction_id,
                details=f"Resend delivery failed for {cleaned_recipient}: {send_res.error_message}",
                metadata={"error_code": send_res.error_code}
            )

            event_broadcaster.broadcast_sync(
                "EMAIL_STATUS_CHANGED",
                {
                    "message_id": message_id,
                    "recipient": cleaned_recipient,
                    "status": "FAILED",
                    "delivery_label": "RESEND FAILED",
                    "error_code": send_res.error_code,
                    "error_message": send_res.error_message,
                    "recovery_case_id": recovery_case_id,
                    "workspace_id": str(workspace_id),
                    "timestamp": utcnow().isoformat()
                },
                workspace_id=workspace_id
            )

        send_res.idempotency_key = idempotency_key
        return send_res

    def _record_audit_log(
        self,
        db: Session,
        workspace_id: str,
        action_type: str,
        details: str,
        recovery_case_id: Optional[str] = None,
        transaction_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        try:
            audit = AuditLog(
                id=f"aud_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                recovery_case_id=recovery_case_id,
                transaction_id=transaction_id,
                actor="EMAIL_SERVICE",
                action_type=action_type,
                target_resource=recovery_case_id or transaction_id or "email_queue",
                details=details,
                metadata_json=json.dumps(metadata or {}),
                created_at=utcnow()
            )
            db.add(audit)
            db.commit()
        except Exception as e:
            logger.warning(f"[EmailService] Could not write audit log: {e}")


email_service = EmailService()
