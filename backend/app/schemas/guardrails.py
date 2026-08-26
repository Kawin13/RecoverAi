from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class GuardrailDecision(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    allowed: bool = Field(..., description="Whether autonomous recovery is permitted to proceed")
    requires_approval: bool = Field(..., description="Whether human supervisor sign-off is required before execution")
    reason_code: str = Field(..., description="Machine-readable policy reason code")
    human_readable_reason: str = Field(..., description="Clear explanation of guardrail evaluation outcome")
    policy_version: str = Field(..., description="Evaluated fintech guardrail policy version")
    suggested_action: Optional[str] = Field(None, description="Recommended terminal action: 'STOP', 'NO_ACTION', or 'PROCEED'")
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
    rule_details: Dict[str, Any] = Field(default_factory=dict)

class HumanApprovalActionRequest(BaseModel):
    decision: str = Field(..., description="Operator decision: 'APPROVE', 'REJECT', or 'NO_ACTION'")
    operator_name: str = Field(..., description="Identity of supervisor or operator making the decision")
    operator_notes: Optional[str] = Field(None, description="Optional justification or audit notes")

class HumanApprovalQueueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    case_id: str
    transaction_id: str
    order_id: Optional[str] = None
    customer_name: str
    customer_tier: str
    customer_phone: Optional[str] = None
    amount: float = Field(..., description="Monetary value in INR (Strictly Read-Only, immutable)")
    currency: str = "INR"
    failure_category: str
    selected_strategy: str
    channel: str
    expected_recovery_value: float
    recovery_probability: float
    reason_code: str
    human_readable_reason: str
    created_at: datetime
    updated_at: datetime

class WhyStoppedForensicResponse(BaseModel):
    case_id: str
    transaction_id: str
    status: str
    current_step: str
    reason_code: str
    human_readable_reason: str
    policy_version: str
    attempt_count: int
    max_attempts: int
    customer_opted_out: bool
    fraud_flag_detected: bool
    failure_category: str
    risk_amount: float
    rule_breached: str
    suggested_action: str
    evaluated_at: datetime
    audit_events: List[Dict[str, Any]] = []

class GuardrailPolicyRuleItem(BaseModel):
    id: str
    name: str
    category: str
    threshold_display: str
    description: str
    action_on_breach: str
    enabled: bool

class GuardrailPoliciesResponse(BaseModel):
    policy_version: str
    summary: Dict[str, Any]
    rules: List[GuardrailPolicyRuleItem]
