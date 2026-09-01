from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field

class AuditLogResponse(BaseModel):
    id: str
    recovery_case_id: Optional[str] = None
    transaction_id: Optional[str] = None
    actor: str
    action_type: str
    target_resource: str
    details: str
    metadata_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int

class AuditChronologyItem(BaseModel):
    step: int = Field(..., ge=1, le=13, description="Ordinal chronological step 1 to 13")
    step_key: str = Field(..., description="Stage identifier e.g. PAYMENT_EVENT_RECEIVED")
    timestamp: str = Field(..., description="Human readable time e.g. 10:30:21")
    iso_timestamp: str = Field(..., description="Full ISO timestamp")
    title: str = Field(..., description="Short stage headline e.g. CARD_DECLINED diagnosed")
    actor: str = Field("AUTONOMOUS_AGENT", description="AUTONOMOUS_AGENT, SYSTEM_GUARDRAIL, WEBHOOK_EVENT, MERCHANT_ADMIN")
    summary: str = Field(..., description="Clear explanation of decision or system event")
    details: Dict[str, Any] = Field(default_factory=dict, description="Sanitized factual payload with zero secret exposure")

class CaseAuditTimelineResponse(BaseModel):
    case_id: str
    transaction_id: str
    order_id: str
    customer_name: str
    customer_tier: str
    amount: float
    currency: str = "INR"
    payment_method: str
    status: str
    failure_reason: str
    failure_category: str
    recovery_probability: float
    expected_recovery_value: float
    selected_strategy: str
    attempt_count: int
    created_at: str
    updated_at: str
    recovered_at: Optional[str] = None
    chronological_entries: List[AuditChronologyItem]
    redaction_verified: bool = Field(True, description="Ensures no secrets, CVVs or full card numbers are exposed")
    exportable_json: str = Field(..., description="Serialized complete audit trail JSON")

class CaseAuditSummaryItem(BaseModel):
    case_id: str
    transaction_id: str
    order_id: str
    customer_name: str
    customer_tier: str
    amount: float
    payment_method: str
    failure_reason: str
    status: str
    selected_strategy: str
    created_at: str
    latest_activity: str

class CaseAuditListResponse(BaseModel):
    items: List[CaseAuditSummaryItem]
    total: int
