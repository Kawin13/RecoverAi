from pydantic import BaseModel, Field
from typing import List, Optional

class AIExplanationResponse(BaseModel):
    recovery_id: str
    selected_action: str
    summary: str
    operator_notes: List[str]
    customer_risk_profile: Optional[str] = "Low"
    source: str
    model: str
    generated_at: str

class AIMessageRequest(BaseModel):
    language: Optional[str] = Field("EN", description="Language code: EN, HI, HINGLISH, TA")

class AIMessageResponse(BaseModel):
    recovery_id: str
    language: str
    headline: str
    message_body: str
    call_to_action: str
    channel_recommended: str
    source: str
    model: str
