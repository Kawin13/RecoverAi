"""
RecoverAI - Safe Email Templates
Generates responsive, sanitized HTML and plain-text emails.
All dynamic text is strictly HTML-escaped to prevent injection.
Never exposes internal ML scores, ERV, raw error codes, or secrets to customers.
"""

import html
from typing import Dict, Any, Tuple
from app.services.notifications.base import TemplateType

# Base HTML layout template
BASE_EMAIL_LAYOUT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      width: 100%;
      table-layout: fixed;
      background-color: #f8fafc;
      padding: 40px 0;
    }}
    .main-table {{
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 580px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      padding: 32px 40px 24px;
      border-bottom: 1px solid #f1f5f9;
    }}
    .brand {{
      font-size: 18px;
      font-weight: 700;
      color: #4f46e5;
      letter-spacing: -0.02em;
    }}
    .content {{
      padding: 36px 40px;
      line-height: 1.65;
      font-size: 15px;
      color: #334155;
    }}
    .greeting {{
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 16px;
    }}
    .btn-container {{
      margin: 32px 0;
      text-align: center;
    }}
    .btn {{
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
    }}
    .btn-outline {{
      display: inline-block;
      background-color: #ffffff;
      color: #4f46e5 !important;
      border: 1px solid #4f46e5;
      padding: 12px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
    }}
    .highlight-box {{
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 20px 0;
    }}
    .footer {{
      padding: 24px 40px;
      background-color: #f8fafc;
      border-top: 1px solid #f1f5f9;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <div class="brand">{merchant_name}</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          {body_content}
        </td>
      </tr>
      <tr>
        <td class="footer">
          {footer_content}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
"""


def _sanitize(value: Any) -> str:
    """Escapes user and runtime values to prevent HTML injection."""
    if value is None:
        return ""
    return html.escape(str(value).strip())


def render_payment_failed_template(context: Dict[str, Any]) -> Tuple[str, str, str]:
    customer_name = _sanitize(context.get("customer_name") or "Valued Customer")
    raw_amount = context.get("amount") or 0.0
    amount_str = f"{float(raw_amount):,.2f}"
    merchant_name = _sanitize(context.get("merchant_name") or "RecoverAI")
    order_id = _sanitize(context.get("order_id") or "N/A")
    failure_reason = _sanitize(context.get("failure_reason") or "Payment authorization declined by issuing bank")
    action_url = context.get("action_url") or ""

    subject = f"Payment Failed: Order #{order_id} (INR {amount_str})"

    # Plain text version
    text_content = (
        f"Hi {customer_name},\n\n"
        f"We wanted to let you know that your recent payment attempt of ₹{amount_str} for Order #{order_id} was unsuccessful.\n\n"
        f"Status: Payment Failed\n"
        f"Reason: {failure_reason}\n\n"
        f"Please rest assured that if any funds were debited, your issuing bank will automatically release the hold.\n\n"
        f"Our autonomous recovery engine is reviewing your transaction to help you complete it securely.\n"
        f"{'You can review and retry your order here: ' + action_url if action_url else ''}\n\n"
        f"— {merchant_name}"
    )

    # HTML body content
    action_btn_html = (
        f'<div class="btn-container">'
        f'<a href="{html.escape(action_url)}" class="btn" target="_blank" rel="noopener noreferrer">Retry Payment</a>'
        f'</div>'
        if action_url else ''
    )

    body_html = f"""
      <div class="greeting">Payment Unsuccessful</div>
      <p>Hi {customer_name},</p>
      <p>We wanted to let you know that your recent payment attempt of <strong>₹{amount_str}</strong> could not be completed.</p>
      <div class="highlight-box" style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b;">
        <p style="margin: 4px 0;"><strong>Order Reference:</strong> #{order_id}</p>
        <p style="margin: 4px 0;"><strong>Amount:</strong> ₹{amount_str}</p>
        <p style="margin: 4px 0;"><strong>Reason:</strong> {failure_reason}</p>
      </div>
      <p style="font-size: 14px; color: #475569;">
        <strong>Safety Note:</strong> If any funds were deducted, your issuing bank will automatically release the hold within standard settlement hours.
      </p>
      {action_btn_html}
      <p style="font-size: 13px; color: #64748b;">Our recovery assistant is actively preparing an alternate payment solution. You may receive an updated 1-click link shortly.</p>
      <p style="margin-top: 24px;">Warm regards,<br><strong>{merchant_name}</strong></p>
    """

    footer_html = f"Secured by RecoverAI &bull; Razorpay Test Mode &bull; {merchant_name}"

    html_content = BASE_EMAIL_LAYOUT.format(
        subject=subject,
        merchant_name=merchant_name,
        body_content=body_html,
        footer_content=footer_html
    )

    return subject, text_content, html_content


def render_payment_link_template(context: Dict[str, Any]) -> Tuple[str, str, str]:
    customer_name = _sanitize(context.get("customer_name") or "Valued Customer")
    raw_amount = context.get("amount") or 0.0
    amount_str = f"{float(raw_amount):,.2f}"
    merchant_name = _sanitize(context.get("merchant_name") or "RecoverAI")
    action_url = context.get("action_url") or ""
    attempt_number = context.get("attempt_number")
    max_attempts = context.get("max_attempts") or 3

    if attempt_number:
        subject = f"Complete your payment - INR {amount_str} (Attempt {attempt_number}/{max_attempts})"
        attempt_badge_html = f'<div style="display: inline-block; padding: 4px 10px; background-color: #eef2ff; color: #4338ca; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 12px;">Recovery Attempt {attempt_number} of {max_attempts}</div>'
        attempt_text = f" (Recovery Attempt {attempt_number}/{max_attempts})"
    else:
        subject = "Complete your payment"
        attempt_badge_html = ""
        attempt_text = ""

    # Plain text version
    text_content = (
        f"Hi {customer_name}{attempt_text},\n\n"
        f"We noticed that your payment of ₹{amount_str} could not be completed.\n\n"
        f"You can securely complete your payment using your new 1-click recovery link below:\n"
        f"{action_url}\n\n"
        f"If you've already completed the payment, you can ignore this message.\n\n"
        f"— {merchant_name}"
    )

    # HTML body content
    body_html = f"""
      {attempt_badge_html}
      <div class="greeting">Hi {customer_name},</div>
      <p>We noticed that your recent payment of <strong>₹{amount_str}</strong> could not be completed.</p>
      <p>We've generated a new, verified 1-click payment link to help you finish your transaction seamlessly:</p>
      <div class="btn-container">
        <a href="{html.escape(action_url)}" class="btn" target="_blank" rel="noopener noreferrer">Complete Payment Now</a>
      </div>
      <p style="font-size: 13px; color: #64748b;">If you've already completed the payment or believe this is in error, you can safely ignore this message.</p>
      <p style="margin-top: 24px;">Warm regards,<br><strong>{merchant_name}</strong></p>
    """

    footer_html = f"Secured by RecoverAI &bull; Razorpay Test Mode &bull; {merchant_name}"

    html_content = BASE_EMAIL_LAYOUT.format(
        subject=subject,
        merchant_name=merchant_name,
        body_content=body_html,
        footer_content=footer_html
    )

    return subject, text_content, html_content


def render_cart_abandonment_template(context: Dict[str, Any]) -> Tuple[str, str, str]:
    customer_name = _sanitize(context.get("customer_name") or "Valued Shopper")
    raw_amount = context.get("amount") or 0.0
    amount_str = f"{float(raw_amount):,.2f}"
    merchant_name = _sanitize(context.get("merchant_name") or "RecoverAI")
    action_url = context.get("action_url") or ""

    subject = "Complete your checkout"

    text_content = (
        f"Hi {customer_name},\n\n"
        f"It looks like your checkout wasn't completed.\n\n"
        f"Your order of ₹{amount_str} is still available and waiting for you.\n\n"
        f"Complete your order here:\n"
        f"{action_url}\n\n"
        f"— {merchant_name}"
    )

    body_html = f"""
      <div class="greeting">Hi {customer_name},</div>
      <p>It looks like your checkout wasn't completed.</p>
      <div class="highlight-box">
        <strong>Saved Cart Total:</strong> ₹{amount_str}
      </div>
      <p>Your order is still available and held for a limited time.</p>
      <div class="btn-container">
        <a href="{html.escape(action_url)}" class="btn" target="_blank" rel="noopener noreferrer">Complete Checkout</a>
      </div>
      <p style="margin-top: 24px;">Best regards,<br><strong>{merchant_name}</strong></p>
    """

    footer_html = f"Cart assistance provided by {merchant_name}"

    html_content = BASE_EMAIL_LAYOUT.format(
        subject=subject,
        merchant_name=merchant_name,
        body_content=body_html,
        footer_content=footer_html
    )

    return subject, text_content, html_content


def render_admin_approval_template(context: Dict[str, Any]) -> Tuple[str, str, str]:
    customer_name = _sanitize(context.get("customer_name") or "Customer")
    raw_amount = context.get("amount") or 0.0
    amount_str = f"{float(raw_amount):,.2f}"
    strategy = _sanitize(context.get("strategy") or "PAYMENT_LINK")
    reason = _sanitize(context.get("reason") or "High-value transaction threshold exceeded.")
    approval_url = context.get("action_url") or ""
    workspace_name = _sanitize(context.get("workspace_name") or "RecoverAI")

    subject = "RecoverAI action requires approval"

    text_content = (
        f"RecoverAI Guardrails: Action Requires Supervisor Approval\n\n"
        f"Workspace: {workspace_name}\n"
        f"Transaction Amount: ₹{amount_str}\n"
        f"Customer: {customer_name}\n"
        f"Proposed Strategy: {strategy}\n"
        f"Reason: {reason}\n\n"
        f"Review and approve or reject this recovery action in the Approval Queue:\n"
        f"{approval_url}\n"
    )

    body_html = f"""
      <div class="greeting">Action Requires Approval</div>
      <p>A recovery action in <strong>{workspace_name}</strong> has entered the Human Approval Queue according to your fintech guardrail policies.</p>
      <div class="highlight-box">
        <p style="margin: 4px 0;"><strong>Customer:</strong> {customer_name}</p>
        <p style="margin: 4px 0;"><strong>At-Risk Amount:</strong> ₹{amount_str}</p>
        <p style="margin: 4px 0;"><strong>Recommended Strategy:</strong> {strategy}</p>
        <p style="margin: 4px 0; color: #b45309;"><strong>Reason:</strong> {reason}</p>
      </div>
      <div class="btn-container">
        <a href="{html.escape(approval_url)}" class="btn" target="_blank" rel="noopener noreferrer">Review in Approval Queue</a>
      </div>
      <p style="font-size: 13px; color: #64748b;">No customer communication has been sent. The recovery action will remain paused until an administrator confirms it.</p>
    """

    footer_html = "RecoverAI Autonomous Safety Engine &bull; Confidential Administrative Notification"

    html_content = BASE_EMAIL_LAYOUT.format(
        subject=subject,
        merchant_name=f"RecoverAI &mdash; {workspace_name}",
        body_content=body_html,
        footer_content=footer_html
    )

    return subject, text_content, html_content


def render_team_invitation_template(context: Dict[str, Any]) -> Tuple[str, str, str]:
    workspace_name = _sanitize(context.get("workspace_name") or "RecoverAI")
    role = _sanitize(context.get("role") or "operator").title()
    invite_url = context.get("action_url") or ""
    invited_by = _sanitize(context.get("invited_by") or "A team administrator")

    subject = "You've been invited to RecoverAI"

    text_content = (
        f"You've been invited to join RecoverAI\n\n"
        f"{invited_by} has invited you to collaborate in the workspace '{workspace_name}' with the role '{role}'.\n\n"
        f"Accept your invitation using the link below (valid for 7 days):\n"
        f"{invite_url}\n"
    )

    body_html = f"""
      <div class="greeting">You've been invited!</div>
      <p>{invited_by} has invited you to join the <strong>{workspace_name}</strong> workspace on RecoverAI as an <strong>{role}</strong>.</p>
      <p>With RecoverAI, your team autonomously monitors at-risk revenue, verifies payment drops, and orchestrates recovery pipelines.</p>
      <div class="btn-container">
        <a href="{html.escape(invite_url)}" class="btn" target="_blank" rel="noopener noreferrer">Accept Invitation</a>
      </div>
      <p style="font-size: 13px; color: #64748b;">This invitation link will expire in 7 days. If you did not expect this email, you can safely ignore it.</p>
    """

    footer_html = "RecoverAI Autonomous Revenue Operations"

    html_content = BASE_EMAIL_LAYOUT.format(
        subject=subject,
        merchant_name=workspace_name,
        body_content=body_html,
        footer_content=footer_html
    )

    return subject, text_content, html_content


def render_recovery_success_template(context: Dict[str, Any]) -> Tuple[str, str, str]:
    customer_name = _sanitize(context.get("customer_name") or "Valued Customer")
    raw_amount = context.get("amount") or 0.0
    amount_str = f"{float(raw_amount):,.2f}"
    merchant_name = _sanitize(context.get("merchant_name") or "RecoverAI")
    order_id = _sanitize(context.get("order_id") or "")

    subject = "Payment Successful - Thank you"

    text_content = (
        f"Hi {customer_name},\n\n"
        f"Your payment of ₹{amount_str} has been successfully completed.\n"
        f"Reference: {order_id}\n\n"
        f"Thank you for your business!\n\n"
        f"— {merchant_name}"
    )

    body_html = f"""
      <div class="greeting">Payment Confirmed</div>
      <p>Hi {customer_name},</p>
      <p>We're pleased to confirm that your payment of <strong>₹{amount_str}</strong> has been successfully received.</p>
      <div class="highlight-box">
        <p style="margin: 4px 0;"><strong>Order / Reference:</strong> {order_id}</p>
        <p style="margin: 4px 0; color: #16a34a;"><strong>Status:</strong> Completed & Verified</p>
      </div>
      <p>Thank you for your business!</p>
      <p style="margin-top: 24px;">Warm regards,<br><strong>{merchant_name}</strong></p>
    """

    footer_html = f"Payment verified &bull; {merchant_name}"

    html_content = BASE_EMAIL_LAYOUT.format(
        subject=subject,
        merchant_name=merchant_name,
        body_content=body_html,
        footer_content=footer_html
    )

    return subject, text_content, html_content


def render_personalized_reminder_template(context: Dict[str, Any]) -> Tuple[str, str, str]:
    customer_name = _sanitize(context.get("customer_name") or "Valued Customer")
    raw_amount = context.get("amount") or 0.0
    amount_str = f"{float(raw_amount):,.2f}"
    merchant_name = _sanitize(context.get("merchant_name") or "RecoverAI")
    action_url = context.get("action_url") or ""
    custom_msg = context.get("custom_message")

    subject = "Help with your recent payment"

    if custom_msg:
        sanitized_msg = _sanitize(custom_msg)
        body_html = f"""
          <div class="greeting">Hi {customer_name},</div>
          <p>{sanitized_msg}</p>
          <div class="btn-container">
            <a href="{html.escape(action_url)}" class="btn" target="_blank" rel="noopener noreferrer">Complete Order</a>
          </div>
          <p style="margin-top: 24px;">Warm regards,<br><strong>{merchant_name}</strong></p>
        """
        text_content = f"Hi {customer_name},\n\n{custom_msg}\n\nLink: {action_url}\n\n— {merchant_name}"
    else:
        return render_payment_link_template(context)

    footer_html = f"Assistance by {merchant_name}"

    html_content = BASE_EMAIL_LAYOUT.format(
        subject=subject,
        merchant_name=merchant_name,
        body_content=body_html,
        footer_content=footer_html
    )

    return subject, text_content, html_content


def render_template(template_type: str, context: Dict[str, Any]) -> Tuple[str, str, str]:
    """
    Renders (subject, text, html) for the specified TemplateType.
    """
    norm = str(template_type).upper()
    if norm in (TemplateType.PAYMENT_FAILED.value, "PAYMENT_FAILED"):
        return render_payment_failed_template(context)
    elif norm == TemplateType.PAYMENT_LINK.value:
        return render_payment_link_template(context)
    elif norm == TemplateType.CART_ABANDONMENT.value:
        return render_cart_abandonment_template(context)
    elif norm == TemplateType.ADMIN_APPROVAL.value:
        return render_admin_approval_template(context)
    elif norm == TemplateType.TEAM_INVITATION.value:
        return render_team_invitation_template(context)
    elif norm == TemplateType.RECOVERY_SUCCESS.value:
        return render_recovery_success_template(context)
    elif norm == TemplateType.PERSONALIZED_REMINDER.value:
        return render_personalized_reminder_template(context)
    else:
        return render_payment_link_template(context)
