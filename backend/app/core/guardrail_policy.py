"""
RecoverAI - Central Fintech Guardrail Policy Configuration
Defines enterprise safety thresholds, rate limits, high-value circuit breakers,
and customer protection policies for autonomous payment recovery.
"""

from typing import Dict, Any, List
from pydantic import BaseModel, Field

class PolicyRuleDefinition(BaseModel):
    id: str
    name: str
    category: str  # FINANCIAL, RATE_LIMIT, RISK, CUSTOMER_EXPERIENCE
    threshold_display: str
    description: str
    action_on_breach: str
    enabled: bool = True

class GuardrailPolicy:
    """Central singleton storing default fintech guardrail policies."""

    # -------------------------------------------------------------------------
    # Mandatory Default Guardrail Thresholds
    # -------------------------------------------------------------------------
    MAX_AUTOMATIC_RETRIES: int = 2
    MAX_RECOVERY_ATTEMPTS: int = 3
    MAX_MESSAGES_PER_DAY: int = 1
    HUMAN_APPROVAL_THRESHOLD_INR: float = 10000.0    # Gated safety threshold requiring supervisor sign-off
    URGENT_HIGH_VALUE_THRESHOLD_INR: float = 25000.0 # Urgency/risk tiering for high-priority routing
    HIGH_VALUE_THRESHOLD_INR: float = 10000.0        # Backward compatibility alias for HUMAN_APPROVAL_THRESHOLD_INR
    MIN_RECOVERY_PROBABILITY: float = 0.20
    POLICY_VERSION: str = "2026.08-fintech-v1"

    # Known permanent failure codes across Indian payment switches (NPCI/RBI)
    PERMANENT_FAILURE_CODES: set[str] = {
        "ACCOUNT_CLOSED",
        "CARD_BLOCKED",
        "CARD_EXPIRED",
        "EXPIRED_CARD",
        "INVALID_CARD",
        "INVALID_ACCOUNT",
        "FRAUD_SUSPECTED",
        "MANDATE_CANCELLED",
        "MANDATE_REVOKED",
        "BENEFICIARY_BLOCKED",
        "PERMANENT_DECLINE"
    }

    # Taxonomy values that represent risk or fraud flags
    RISK_TAXONOMIES: set[str] = {
        "RISK_BLOCKED",
        "FRAUD_SUSPECTED",
        "CHARGEBACK_RISK",
        "SANCTIONS_BLOCKED"
    }

    def __init__(self):
        self._rules: List[PolicyRuleDefinition] = [
            PolicyRuleDefinition(
                id="CUSTOMER_OPT_OUT",
                name="Customer Opt-Out & DND Protection",
                category="CUSTOMER_EXPERIENCE",
                threshold_display="Strict Zero-Contact",
                description="Immediately halts all autonomous communications and recovery interventions if customer is registered under DND or opted out.",
                action_on_breach="STOP",
                enabled=True
            ),
            PolicyRuleDefinition(
                id="RISK_FRAUD_CIRCUIT_BREAKER",
                name="Risk & Fraud Detection Circuit Breaker",
                category="RISK",
                threshold_display="High Risk / Fraud Score",
                description="Permanently stops automated recovery if gateway, bank, or ML fraud model marks the transaction as fraudulent.",
                action_on_breach="STOP_AUTO_RECOVERY",
                enabled=True
            ),
            PolicyRuleDefinition(
                id="PERMANENT_FAILURE_SUPPRESSION",
                name="Permanent Failure Method Suppression",
                category="FINANCIAL",
                threshold_display="Terminal Instrument Error",
                description="Suppresses repeat attempts against the same dead payment instrument (closed account, expired/blocked card).",
                action_on_breach="DO_NOT_RETRY_SAME_METHOD",
                enabled=True
            ),
            PolicyRuleDefinition(
                id="MAX_RECOVERY_ATTEMPTS",
                name="Maximum Recovery Attempt Ceiling",
                category="RATE_LIMIT",
                threshold_display="Max 3 Attempts",
                description="Strict hard stop preventing infinite autonomous recovery loops and protecting merchant PSP health metrics.",
                action_on_breach="STOP",
                enabled=True
            ),
            PolicyRuleDefinition(
                id="MAX_AUTOMATIC_RETRIES",
                name="Maximum Automatic Silent Retries",
                category="RATE_LIMIT",
                threshold_display="Max 2 Retries",
                description="Limits direct automated retries before requiring customer communication or strategy rotation.",
                action_on_breach="DO_NOT_RETRY_SAME_METHOD",
                enabled=True
            ),
            PolicyRuleDefinition(
                id="HIGH_VALUE_THRESHOLD",
                name="Human Approval Supervision Threshold",
                category="FINANCIAL",
                threshold_display=">= ₹10,000 INR",
                description="Diverts any transaction meeting or exceeding the human approval threshold (₹10,000) to the Human Approval Queue before any recovery dispatch.",
                action_on_breach="HUMAN_APPROVAL",
                enabled=True
            ),
            PolicyRuleDefinition(
                id="MIN_RECOVERY_PROBABILITY",
                name="Minimum Economic Recovery Propensity",
                category="FINANCIAL",
                threshold_display="< 20% Propensity",
                description="Suppresses autonomous interventions when statistical recovery likelihood is under 20% to avoid customer annoyance.",
                action_on_breach="NO_ACTION",
                enabled=True
            ),
            PolicyRuleDefinition(
                id="MAX_MESSAGES_PER_DAY",
                name="Outbound Message Fatigue Ceiling",
                category="CUSTOMER_EXPERIENCE",
                threshold_display="1 Msg / 24 Hours",
                description="Enforces anti-spam communication boundaries across WhatsApp, SMS, and Email channels.",
                action_on_breach="SUPPRESS_MESSAGING",
                enabled=True
            )
        ]

    def get_rules(self) -> List[PolicyRuleDefinition]:
        return self._rules

    def get_summary(self) -> Dict[str, Any]:
        return {
            "policy_version": self.POLICY_VERSION,
            "max_automatic_retries": self.MAX_AUTOMATIC_RETRIES,
            "max_recovery_attempts": self.MAX_RECOVERY_ATTEMPTS,
            "max_messages_per_day": self.MAX_MESSAGES_PER_DAY,
            "human_approval_threshold_inr": self.HUMAN_APPROVAL_THRESHOLD_INR,
            "urgent_high_value_threshold_inr": self.URGENT_HIGH_VALUE_THRESHOLD_INR,
            "high_value_threshold_inr": self.HIGH_VALUE_THRESHOLD_INR,
            "min_recovery_probability": self.MIN_RECOVERY_PROBABILITY,
            "total_rules": len(self._rules),
            "enabled_rules": sum(1 for r in self._rules if r.enabled)
        }

guardrail_policy = GuardrailPolicy()
