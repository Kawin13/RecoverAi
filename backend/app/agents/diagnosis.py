"""
RecoverAI - Failure Diagnosis Engine
Classifies failed digital payment events and drop-offs into deterministic root-cause taxonomies.
"""

from typing import Dict, Any, Tuple
from enum import Enum

class FailureTaxonomy(str, Enum):
    TEMPORARY = "TEMPORARY"
    PAYMENT_METHOD_SPECIFIC = "PAYMENT_METHOD_SPECIFIC"
    CUSTOMER_ACTION_REQUIRED = "CUSTOMER_ACTION_REQUIRED"
    PERMANENT = "PERMANENT"
    ABANDONMENT = "ABANDONMENT"
    RISK_BLOCKED = "RISK_BLOCKED"
    UNKNOWN = "UNKNOWN"

class FailureDiagnosisEngine:
    """
    Analyzes error codes, error descriptions, and payment method contexts
    to establish root cause taxonomy and technical characteristics.
    """

    TAXONOMY_MAP = {
        # Temporary Switch / Network / Gateway Downtimes
        "UPI_TIMEOUT": FailureTaxonomy.TEMPORARY,
        "BANK_SERVER_DOWN": FailureTaxonomy.TEMPORARY,
        "BANK_TIMEOUT": FailureTaxonomy.TEMPORARY,
        "GATEWAY_TIMEOUT": FailureTaxonomy.TEMPORARY,
        "NETWORK_ERROR": FailureTaxonomy.TEMPORARY,
        "ACQUIRER_UNAVAILABLE": FailureTaxonomy.TEMPORARY,

        # Payment Instrument Issues
        "EXPIRED_CARD": FailureTaxonomy.PAYMENT_METHOD_SPECIFIC,
        "INVALID_CARD": FailureTaxonomy.PAYMENT_METHOD_SPECIFIC,
        "MANDATE_CANCELLED": FailureTaxonomy.PAYMENT_METHOD_SPECIFIC,
        "MANDATE_FAILED": FailureTaxonomy.PAYMENT_METHOD_SPECIFIC,
        "INVALID_VPA": FailureTaxonomy.PAYMENT_METHOD_SPECIFIC,

        # Customer Action Required (Authentication / Funds / Limits)
        "OTP_FAILED": FailureTaxonomy.CUSTOMER_ACTION_REQUIRED,
        "UPI_PIN_FAILED": FailureTaxonomy.CUSTOMER_ACTION_REQUIRED,
        "AUTHENTICATION_FAILED": FailureTaxonomy.CUSTOMER_ACTION_REQUIRED,
        "INSUFFICIENT_FUNDS": FailureTaxonomy.CUSTOMER_ACTION_REQUIRED,
        "TRANSACTION_LIMIT": FailureTaxonomy.CUSTOMER_ACTION_REQUIRED,
        "CARD_DECLINED": FailureTaxonomy.CUSTOMER_ACTION_REQUIRED,
        "BANK_DECLINED": FailureTaxonomy.CUSTOMER_ACTION_REQUIRED,

        # Cart / Session Abandonments
        "CHECKOUT_ABANDONED": FailureTaxonomy.ABANDONMENT,
        "SESSION_TIMEOUT": FailureTaxonomy.ABANDONMENT,
        "USER_CANCELLED": FailureTaxonomy.ABANDONMENT,

        # Permanent Failures
        "CARD_STOLEN": FailureTaxonomy.PERMANENT,
        "CARD_LOST": FailureTaxonomy.PERMANENT,
        "ACCOUNT_CLOSED": FailureTaxonomy.PERMANENT,
        "BLOCKED_MERCHANT": FailureTaxonomy.PERMANENT,

        # Risk & Compliance
        "FRAUD_ALERT": FailureTaxonomy.RISK_BLOCKED,
        "VELOCITY_EXCEEDED": FailureTaxonomy.RISK_BLOCKED,
        "BLACKLISTED_IP": FailureTaxonomy.RISK_BLOCKED
    }

    @classmethod
    def diagnose(cls, failure_reason: str, payment_method: str = "UPI", attempt_count: int = 1) -> Dict[str, Any]:
        reason_upper = (failure_reason or "").upper().strip()
        
        # Direct lookup or fuzzy match
        taxonomy = cls.TAXONOMY_MAP.get(reason_upper)
        if not taxonomy:
            if "TIMEOUT" in reason_upper or "DOWN" in reason_upper:
                taxonomy = FailureTaxonomy.TEMPORARY
            elif "OTP" in reason_upper or "PIN" in reason_upper or "AUTH" in reason_upper:
                taxonomy = FailureTaxonomy.CUSTOMER_ACTION_REQUIRED
            elif "EXPIRED" in reason_upper or "INVALID" in reason_upper:
                taxonomy = FailureTaxonomy.PAYMENT_METHOD_SPECIFIC
            elif "ABANDON" in reason_upper or "CANCEL" in reason_upper:
                taxonomy = FailureTaxonomy.ABANDONMENT
            elif "FRAUD" in reason_upper or "RISK" in reason_upper:
                taxonomy = FailureTaxonomy.RISK_BLOCKED
            else:
                taxonomy = FailureTaxonomy.UNKNOWN

        is_retryable_same_instrument = taxonomy in [FailureTaxonomy.TEMPORARY] and reason_upper not in ["EXPIRED_CARD", "INVALID_CARD"]
        requires_customer_switch = taxonomy in [FailureTaxonomy.PAYMENT_METHOD_SPECIFIC, FailureTaxonomy.CUSTOMER_ACTION_REQUIRED]

        return {
            "failure_reason": reason_upper,
            "taxonomy": taxonomy.value,
            "is_transient": taxonomy == FailureTaxonomy.TEMPORARY,
            "is_retryable_same_instrument": is_retryable_same_instrument,
            "requires_customer_switch": requires_customer_switch,
            "is_risk_blocked": taxonomy == FailureTaxonomy.RISK_BLOCKED,
            "attempt_number": attempt_count,
            "description": cls._generate_diagnostic_summary(reason_upper, taxonomy, payment_method, attempt_count)
        }

    @staticmethod
    def _generate_diagnostic_summary(reason: str, taxonomy: FailureTaxonomy, method: str, attempt: int) -> str:
        if taxonomy == FailureTaxonomy.TEMPORARY:
            return f"Transient gateway switch outage ({reason}) detected on attempt #{attempt}. High probability of recovery via alternate rail routing or timed retry."
        elif taxonomy == FailureTaxonomy.PAYMENT_METHOD_SPECIFIC:
            return f"Payment instrument defect ({reason}) on {method}. Immediate same-instrument retry suppressed; alternate instrument prompt required."
        elif taxonomy == FailureTaxonomy.CUSTOMER_ACTION_REQUIRED:
            return f"Customer authentication or balance constraint ({reason}) on attempt #{attempt}. Frictionless re-engagement recommended."
        elif taxonomy == FailureTaxonomy.ABANDONMENT:
            return f"Checkout drop-off ({reason}) prior to completion. Hot intent recovery window active."
        elif taxonomy == FailureTaxonomy.RISK_BLOCKED:
            return f"Security or velocity threshold breached ({reason}). Autonomous retry suspended by guardrails."
        return f"Payment failure {reason} on {method} under review."

diagnosis_engine = FailureDiagnosisEngine()
