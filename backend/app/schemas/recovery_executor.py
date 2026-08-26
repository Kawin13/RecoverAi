from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class WorkflowStepRequest(BaseModel):
    is_live_demo: bool = Field(True, description="Whether to call Razorpay test API for live link generation")

class WorkflowOutcomeRequest(BaseModel):
    outcome: str = Field(..., description="Simulated outcome: 'RECOVERED' or 'FAILED'")

class PaymentLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    payment_link_id: str
    short_url: str
    amount: float
    status: str
    is_live_demo: bool
    created_at: datetime

class WorkflowCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_id: str
    order_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_tier: Optional[str] = None
    customer_phone: Optional[str] = None
    risk_amount: float
    failure_category: str
    selected_strategy: str
    current_step: str
    status: str
    attempt_count: int
    max_attempts: int
    channel: str
    expected_recovery_value: float
    recovery_probability: float
    scheduled_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    execution_payload: Optional[str] = None
    payment_links: List[PaymentLinkResponse] = []
    created_at: datetime
    updated_at: datetime

class WorkflowListResponse(BaseModel):
    total_cases: int
    active_cases: int
    workflows: List[WorkflowCaseResponse]
