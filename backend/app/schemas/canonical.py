"""
RecoverAI - Canonical Domain Models & Schemas
Centralized schemas for FailureDiagnosis, SelectedAction, StrategyScore, and QueueCounts.
Ensures uniform business logic across backend diagnostic engines, ML pipelines, Gemini LLM prompts, and frontend UI.
"""

from typing import Optional, Dict, Any, List
from enum import Enum
from pydantic import BaseModel, Field

class FailureTaxonomy(str, Enum):
    TEMPORARY = "TEMPORARY"
    PAYMENT_METHOD_SPECIFIC = "PAYMENT_METHOD_SPECIFIC"
    CUSTOMER_ACTION_REQUIRED = "CUSTOMER_ACTION_REQUIRED"
    PERMANENT = "PERMANENT"
    ABANDONMENT = "ABANDONMENT"
    RISK_BLOCKED = "RISK_BLOCKED"
    UNKNOWN = "UNKNOWN"

class FailureDiagnosis(BaseModel):
    failure_reason_code: str = Field(..., description="Canonical error code, e.g. BANK_GATEWAY_TIMEOUT, INSUFFICIENT_FUNDS, UNKNOWN")
    failure_category: FailureTaxonomy = Field(..., description="Taxonomy grouping: TEMPORARY, CUSTOMER_ACTION_REQUIRED, etc.")
    failure_source: str = Field("ISSUER_BANK", description="Origin: ISSUER_BANK, GATEWAY, CUSTOMER, MERCHANT, SYSTEM")
    human_readable_reason: str = Field(..., description="Clear human explanation, e.g. 'Temporary bank gateway timeout'")
    confidence: float = Field(0.95, ge=0.0, le=1.0, description="Diagnostic confidence score")
    raw_gateway_code: Optional[str] = Field(None, description="Original raw error code from payment gateway")
    is_transient: bool = Field(False, description="Whether error is temporary and retryable")
    is_retryable_same_instrument: bool = Field(False, description="Whether same payment method can be retried immediately")
    requires_customer_switch: bool = Field(False, description="Whether user should switch payment methods")
    is_risk_blocked: bool = Field(False, description="Whether guardrails block automatic retries")
    attempt_number: int = Field(1, description="Current attempt number")
    description: str = Field(..., description="Full operational description of the diagnosis")

class SelectedAction(BaseModel):
    action_code: str = Field(..., description="Machine action code: RETRY_NOW, RETRY_LATER, UPI_SWITCH, PAYMENT_LINK, PERSONALIZED_REMINDER, HUMAN_ESCALATION, NO_ACTION")
    display_name: str = Field(..., description="Human-friendly label: Immediate Retry, Timed Retry, UPI Switch, etc.")
    customer_cta: str = Field(..., description="Direct customer call-to-action button text: Pay with UPI, Retry Payment, etc.")
    execution_handler: str = Field(..., description="Handler method name for executing the action")

# Canonical 1-to-1 Mapping for all supported actions
CANONICAL_ACTIONS: Dict[str, Dict[str, str]] = {
    "RETRY_NOW": {
        "action_code": "RETRY_NOW",
        "display_name": "Immediate Retry",
        "customer_cta": "Retry Payment",
        "execution_handler": "execute_immediate_retry"
    },
    "RETRY_LATER": {
        "action_code": "RETRY_LATER",
        "display_name": "Timed Retry",
        "customer_cta": "Retry Later",
        "execution_handler": "execute_timed_retry"
    },
    "UPI_SWITCH": {
        "action_code": "UPI_SWITCH",
        "display_name": "UPI Switch",
        "customer_cta": "Pay with UPI",
        "execution_handler": "execute_upi_switch"
    },
    "UPI_INTENT_FALLBACK": {
        "action_code": "UPI_SWITCH",
        "display_name": "UPI Switch",
        "customer_cta": "Pay with UPI",
        "execution_handler": "execute_upi_switch"
    },
    "PAYMENT_LINK": {
        "action_code": "PAYMENT_LINK",
        "display_name": "1-Click Paylink",
        "customer_cta": "Open Payment Link",
        "execution_handler": "execute_payment_link"
    },
    "SMART_PAYLINK_1CLICK": {
        "action_code": "PAYMENT_LINK",
        "display_name": "1-Click Paylink",
        "customer_cta": "Open Payment Link",
        "execution_handler": "execute_payment_link"
    },
    "PERSONALIZED_REMINDER": {
        "action_code": "PERSONALIZED_REMINDER",
        "display_name": "Personalized Reminder",
        "customer_cta": "Complete Payment",
        "execution_handler": "execute_personalized_reminder"
    },
    "INCENTIVIZED_DUNNING": {
        "action_code": "PERSONALIZED_REMINDER",
        "display_name": "Personalized Reminder",
        "customer_cta": "Complete Payment",
        "execution_handler": "execute_personalized_reminder"
    },
    "HUMAN_ESCALATION": {
        "action_code": "HUMAN_ESCALATION",
        "display_name": "Concierge Escalation",
        "customer_cta": "Support Will Contact You",
        "execution_handler": "execute_human_escalation"
    },
    "WHATSAPP_CONCIERGE": {
        "action_code": "HUMAN_ESCALATION",
        "display_name": "Concierge Escalation",
        "customer_cta": "Support Will Contact You",
        "execution_handler": "execute_human_escalation"
    },
    "NO_ACTION": {
        "action_code": "NO_ACTION",
        "display_name": "No Action",
        "customer_cta": "none",
        "execution_handler": "execute_no_action"
    }
}

def get_canonical_action(action_key: str) -> SelectedAction:
    key_upper = (action_key or "NO_ACTION").upper().strip()
    data = CANONICAL_ACTIONS.get(key_upper)
    if not data:
        # Fallback dynamic
        return SelectedAction(
            action_code=key_upper,
            display_name=key_upper.replace("_", " ").title(),
            customer_cta="Complete Payment",
            execution_handler=f"execute_{key_upper.lower()}"
        )
    return SelectedAction(
        action_code=data["action_code"],
        display_name=data["display_name"],
        customer_cta=data["customer_cta"],
        execution_handler=data["execution_handler"]
    )

class StrategyScore(BaseModel):
    action: str
    action_code: str
    display_name: str
    customer_cta: str
    probability: float
    expected_recovery_value: float
    erv_paise: int
    cost: float
    friction_penalty: float
    risk_penalty: float = 0.0
    allowed: bool = True
    guardrail_reason: Optional[str] = None
    rank: int = 1

class QueueCounts(BaseModel):
    all_at_risk: int = Field(..., description="Total active cases requiring intervention in current scope")
    high_value_urgent: int = Field(..., description="Active cases with amount >= 25,000 or HIGH risk")
    vip_enterprise: int = Field(..., description="Active cases for VIP or ENTERPRISE customers")
    gateway_bank_outages: int = Field(..., description="Active cases caused by bank or gateway timeout/downtime")
    batch_dispatch_eligible: int = Field(..., description="Active cases currently eligible for autonomous batch dispatch")
