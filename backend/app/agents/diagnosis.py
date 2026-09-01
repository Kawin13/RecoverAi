"""
RecoverAI - Failure Diagnosis Engine
Classifies failed digital payment events and drop-offs into deterministic root-cause taxonomies
and produces canonical FailureDiagnosis objects.
"""

from typing import Dict, Any, Optional
from app.schemas.canonical import FailureTaxonomy, FailureDiagnosis

class FailureDiagnosisEngine:
    """
    Analyzes error codes, error descriptions, and payment method contexts
    to establish canonical root-cause taxonomy and technical characteristics.
    """

    # Canonical mapping from known raw/standard codes to (canonical_code, taxonomy, human_readable, source)
    CANONICAL_LOOKUP = {
        # Gateway & Bank Timeouts / Downtimes
        "BANK_GATEWAY_TIMEOUT": ("BANK_GATEWAY_TIMEOUT", FailureTaxonomy.TEMPORARY, "Temporary bank gateway timeout", "GATEWAY"),
        "GATEWAY_TIMEOUT": ("BANK_GATEWAY_TIMEOUT", FailureTaxonomy.TEMPORARY, "Temporary bank gateway timeout", "GATEWAY"),
        "BANK_TIMEOUT": ("BANK_GATEWAY_TIMEOUT", FailureTaxonomy.TEMPORARY, "Temporary bank gateway timeout", "ISSUER_BANK"),
        "UPI_TIMEOUT": ("BANK_GATEWAY_TIMEOUT", FailureTaxonomy.TEMPORARY, "Temporary bank gateway timeout", "GATEWAY"),
        "BANK_SERVER_DOWN": ("BANK_GATEWAY_TIMEOUT", FailureTaxonomy.TEMPORARY, "Temporary bank gateway timeout", "ISSUER_BANK"),
        "NETWORK_ERROR": ("BANK_GATEWAY_TIMEOUT", FailureTaxonomy.TEMPORARY, "Temporary bank gateway timeout", "GATEWAY"),
        "ACQUIRER_UNAVAILABLE": ("BANK_GATEWAY_TIMEOUT", FailureTaxonomy.TEMPORARY, "Temporary bank gateway timeout", "GATEWAY"),

        # Payment Instrument Issues
        "EXPIRED_CARD": ("EXPIRED_CARD", FailureTaxonomy.PAYMENT_METHOD_SPECIFIC, "Expired or invalid card details", "ISSUER_BANK"),
        "INVALID_CARD": ("INVALID_CARD", FailureTaxonomy.PAYMENT_METHOD_SPECIFIC, "Invalid card number or details", "ISSUER_BANK"),
        "MANDATE_CANCELLED": ("MANDATE_CANCELLED", FailureTaxonomy.PAYMENT_METHOD_SPECIFIC, "Recurring mandate revoked or expired", "CUSTOMER"),
        "MANDATE_FAILED": ("MANDATE_FAILED", FailureTaxonomy.PAYMENT_METHOD_SPECIFIC, "Recurring mandate processing failure", "ISSUER_BANK"),
        "INVALID_VPA": ("INVALID_VPA", FailureTaxonomy.PAYMENT_METHOD_SPECIFIC, "Invalid UPI Virtual Payment Address", "CUSTOMER"),

        # Customer Action Required (Authentication / Funds / Limits)
        "OTP_FAILED": ("AUTHENTICATION_FAILED", FailureTaxonomy.CUSTOMER_ACTION_REQUIRED, "3DS / OTP authentication unsuccessful", "CUSTOMER"),
        "UPI_PIN_FAILED": ("AUTHENTICATION_FAILED", FailureTaxonomy.CUSTOMER_ACTION_REQUIRED, "Incorrect UPI PIN entered", "CUSTOMER"),
        "AUTHENTICATION_FAILED": ("AUTHENTICATION_FAILED", FailureTaxonomy.CUSTOMER_ACTION_REQUIRED, "3DS / OTP authentication unsuccessful", "CUSTOMER"),
        "INSUFFICIENT_FUNDS": ("INSUFFICIENT_FUNDS", FailureTaxonomy.CUSTOMER_ACTION_REQUIRED, "Insufficient account balance or card limit", "CUSTOMER"),
        "TRANSACTION_LIMIT": ("INSUFFICIENT_FUNDS", FailureTaxonomy.CUSTOMER_ACTION_REQUIRED, "Transaction limit exceeded", "ISSUER_BANK"),
        "CARD_DECLINED": ("INSUFFICIENT_FUNDS", FailureTaxonomy.CUSTOMER_ACTION_REQUIRED, "Card declined by issuing bank", "ISSUER_BANK"),
        "BANK_DECLINED": ("INSUFFICIENT_FUNDS", FailureTaxonomy.CUSTOMER_ACTION_REQUIRED, "Payment declined by issuing bank", "ISSUER_BANK"),

        # Cart / Session Abandonments
        "CHECKOUT_ABANDONED": ("CHECKOUT_ABANDONED", FailureTaxonomy.ABANDONMENT, "Checkout session dropped before completion", "CUSTOMER"),
        "SESSION_TIMEOUT": ("CHECKOUT_ABANDONED", FailureTaxonomy.ABANDONMENT, "Checkout session expired before completion", "CUSTOMER"),
        "USER_CANCELLED": ("CHECKOUT_ABANDONED", FailureTaxonomy.ABANDONMENT, "Payment cancelled by user", "CUSTOMER"),

        # Permanent Failures
        "CARD_STOLEN": ("CARD_STOLEN", FailureTaxonomy.PERMANENT, "Card reported lost or stolen", "ISSUER_BANK"),
        "CARD_LOST": ("CARD_LOST", FailureTaxonomy.PERMANENT, "Card reported lost or stolen", "ISSUER_BANK"),
        "ACCOUNT_CLOSED": ("ACCOUNT_CLOSED", FailureTaxonomy.PERMANENT, "Customer bank account closed", "ISSUER_BANK"),
        "BLOCKED_MERCHANT": ("BLOCKED_MERCHANT", FailureTaxonomy.PERMANENT, "Merchant blocked by card issuer", "ISSUER_BANK"),

        # Risk & Compliance
        "FRAUD_ALERT": ("FRAUD_ALERT", FailureTaxonomy.RISK_BLOCKED, "Security or velocity threshold breached", "SYSTEM"),
        "VELOCITY_EXCEEDED": ("FRAUD_ALERT", FailureTaxonomy.RISK_BLOCKED, "Payment velocity threshold exceeded", "SYSTEM"),
        "BLACKLISTED_IP": ("FRAUD_ALERT", FailureTaxonomy.RISK_BLOCKED, "Risk rule triggered: blacklisted IP", "SYSTEM")
    }

    @classmethod
    def diagnose(cls, failure_reason: Optional[str], payment_method: str = "UPI", attempt_count: int = 1) -> Dict[str, Any]:
        raw_reason = str(failure_reason or "").strip()
        reason_upper = raw_reason.upper()

        # Handle explicit UNKNOWN / NONE / empty values
        if not reason_upper or reason_upper in ["NONE", "UNKNOWN", "NULL", "UNSPECIFIED"]:
            canonical_code = "UNKNOWN"
            taxonomy = FailureTaxonomy.UNKNOWN
            human_readable = "Unspecified payment processing issue"
            source = "SYSTEM"
            confidence = 0.5
        elif reason_upper in cls.CANONICAL_LOOKUP:
            canonical_code, taxonomy, human_readable, source = cls.CANONICAL_LOOKUP[reason_upper]
            confidence = 0.98
        else:
            # Fuzzy match rules
            if any(k in reason_upper for k in ["TIMEOUT", "DOWN", "ACQUIRER", "UNAVAILABLE", "NETWORK"]):
                canonical_code = "BANK_GATEWAY_TIMEOUT"
                taxonomy = FailureTaxonomy.TEMPORARY
                human_readable = "Temporary bank gateway timeout"
                source = "GATEWAY"
                confidence = 0.90
            elif any(k in reason_upper for k in ["OTP", "PIN", "AUTH", "3DS"]):
                canonical_code = "AUTHENTICATION_FAILED"
                taxonomy = FailureTaxonomy.CUSTOMER_ACTION_REQUIRED
                human_readable = "3DS / OTP authentication unsuccessful"
                source = "CUSTOMER"
                confidence = 0.90
            elif any(k in reason_upper for k in ["FUNDS", "LIMIT", "DECLINE", "BALANCE"]):
                canonical_code = "INSUFFICIENT_FUNDS"
                taxonomy = FailureTaxonomy.CUSTOMER_ACTION_REQUIRED
                human_readable = "Insufficient account balance or card limit"
                source = "CUSTOMER"
                confidence = 0.90
            elif any(k in reason_upper for k in ["EXPIRED", "INVALID"]):
                canonical_code = "EXPIRED_CARD"
                taxonomy = FailureTaxonomy.PAYMENT_METHOD_SPECIFIC
                human_readable = "Expired or invalid card details"
                source = "ISSUER_BANK"
                confidence = 0.88
            elif any(k in reason_upper for k in ["ABANDON", "CANCEL", "SESSION"]):
                canonical_code = "CHECKOUT_ABANDONED"
                taxonomy = FailureTaxonomy.ABANDONMENT
                human_readable = "Checkout session dropped before completion"
                source = "CUSTOMER"
                confidence = 0.92
            elif any(k in reason_upper for k in ["FRAUD", "RISK", "BLOCK"]):
                canonical_code = "FRAUD_ALERT"
                taxonomy = FailureTaxonomy.RISK_BLOCKED
                human_readable = "Security or velocity threshold breached"
                source = "SYSTEM"
                confidence = 0.95
            else:
                canonical_code = "UNKNOWN"
                taxonomy = FailureTaxonomy.UNKNOWN
                human_readable = "Unspecified payment processing issue"
                source = "SYSTEM"
                confidence = 0.5

        is_transient = taxonomy == FailureTaxonomy.TEMPORARY
        is_retryable_same_instrument = is_transient and canonical_code not in ["EXPIRED_CARD", "INVALID_CARD"]
        requires_customer_switch = taxonomy in [FailureTaxonomy.PAYMENT_METHOD_SPECIFIC, FailureTaxonomy.CUSTOMER_ACTION_REQUIRED]
        is_risk_blocked = taxonomy == FailureTaxonomy.RISK_BLOCKED

        description = cls._generate_diagnostic_summary(canonical_code, human_readable, taxonomy, payment_method, attempt_count)

        return {
            "failure_reason_code": canonical_code,
            "failure_reason": canonical_code,  # Backwards compatibility key
            "failure_category": taxonomy.value,
            "taxonomy": taxonomy.value,        # Backwards compatibility key
            "failure_source": source,
            "human_readable_reason": human_readable,
            "confidence": confidence,
            "raw_gateway_code": raw_reason if raw_reason and raw_reason not in ["NONE", "NULL", "UNKNOWN"] else None,
            "is_transient": is_transient,
            "is_retryable_same_instrument": is_retryable_same_instrument,
            "requires_customer_switch": requires_customer_switch,
            "is_risk_blocked": is_risk_blocked,
            "attempt_number": attempt_count,
            "description": description
        }

    @staticmethod
    def _generate_diagnostic_summary(code: str, human_readable: str, taxonomy: FailureTaxonomy, method: str, attempt: int) -> str:
        if taxonomy == FailureTaxonomy.TEMPORARY:
            return f"Transient bank switch or gateway timeout detected on attempt #{attempt}. High probability of recovery via alternate rail routing or timed retry."
        elif taxonomy == FailureTaxonomy.PAYMENT_METHOD_SPECIFIC:
            return f"Payment instrument defect ({human_readable}) on {method}. Immediate same-instrument retry suppressed; alternate instrument prompt required."
        elif taxonomy == FailureTaxonomy.CUSTOMER_ACTION_REQUIRED:
            return f"{human_readable} on attempt #{attempt}. Frictionless re-engagement recommended."
        elif taxonomy == FailureTaxonomy.ABANDONMENT:
            return f"{human_readable}. Active recovery window."
        elif taxonomy == FailureTaxonomy.RISK_BLOCKED:
            return f"{human_readable}. Autonomous retry suspended by guardrails."
        elif taxonomy == FailureTaxonomy.UNKNOWN:
            return f"Unspecified payment failure on {method}. Autonomous fallback intervention recommended."
        return f"Payment failure {code} on {method} under review."

diagnosis_engine = FailureDiagnosisEngine()
