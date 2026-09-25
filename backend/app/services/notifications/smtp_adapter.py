"""
RecoverAI - SMTP Email Adapter
Gmail SMTP (or any SMTP server) fallback for sending to any recipient.

Use when Resend sandbox blocks delivery to non-owner email addresses.
Gmail setup:
  1. Enable 2FA on your Google Account
  2. Go to myaccount.google.com/apppasswords
  3. Create an App Password for "Mail"
  4. Set SMTP_USERNAME=yourname@gmail.com, SMTP_PASSWORD=<16-char app password>
"""

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings
from app.core.logging import logger
from app.services.notifications.base import NotificationResult, NotificationStatus


class SMTPAdapter:
    """Sends transactional emails via SMTP (Gmail or any SMTP provider)."""

    @property
    def is_configured(self) -> bool:
        return bool(
            getattr(settings, "SMTP_HOST", "")
            and getattr(settings, "SMTP_USERNAME", "")
            and getattr(settings, "SMTP_PASSWORD", "")
        )

    def _get_from_address(self) -> str:
        smtp_from = getattr(settings, "SMTP_FROM_ADDRESS", "").strip()
        if smtp_from:
            return smtp_from
        username = getattr(settings, "SMTP_USERNAME", "").strip()
        return f"RecoverAI <{username}>" if username else "RecoverAI <noreply@recoverai.app>"

    def send_sync(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_address: Optional[str] = None,
    ) -> NotificationResult:
        """Sends an email synchronously via SMTP."""
        if not self.is_configured:
            return NotificationResult(
                success=False,
                provider="smtp",
                status=NotificationStatus.FAILED.value,
                error_code="SMTP_NOT_CONFIGURED",
                error_message="SMTP credentials (SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD) are not configured."
            )

        smtp_host = getattr(settings, "SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(getattr(settings, "SMTP_PORT", 587))
        smtp_user = getattr(settings, "SMTP_USERNAME", "")
        smtp_pass = getattr(settings, "SMTP_PASSWORD", "")
        use_tls = bool(getattr(settings, "SMTP_USE_TLS", True))
        resolved_from = from_address or self._get_from_address()

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = resolved_from
        msg["To"] = to
        msg["X-Mailer"] = "RecoverAI-SMTP/1.0"

        if text_content:
            msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            if use_tls:
                context = ssl.create_default_context()
                with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(resolved_from, to, msg.as_string())
            else:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(resolved_from, to, msg.as_string())

            logger.info(f"[SMTPAdapter] Email sent via SMTP to '{to}' | Subject: {subject[:60]}")
            return NotificationResult(
                success=True,
                provider="smtp",
                status=NotificationStatus.SENT.value,
                provider_message_id=f"smtp_{smtp_host}_{to}",
                delivery_label="SMTP DELIVERY"
            )
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"[SMTPAdapter] Authentication failed for {smtp_user}: {e}")
            return NotificationResult(
                success=False,
                provider="smtp",
                status=NotificationStatus.FAILED.value,
                error_code="SMTP_AUTH_FAILED",
                error_message=f"SMTP authentication failed. Check SMTP_USERNAME and SMTP_PASSWORD. Error: {e}"
            )
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"[SMTPAdapter] Recipient refused '{to}': {e}")
            return NotificationResult(
                success=False,
                provider="smtp",
                status=NotificationStatus.FAILED.value,
                error_code="SMTP_RECIPIENT_REFUSED",
                error_message=f"SMTP recipient refused: {e}"
            )
        except Exception as e:
            logger.error(f"[SMTPAdapter] Failed to send email to '{to}': {e}")
            return NotificationResult(
                success=False,
                provider="smtp",
                status=NotificationStatus.FAILED.value,
                error_code="SMTP_ERROR",
                error_message=str(e)
            )


smtp_adapter = SMTPAdapter()
