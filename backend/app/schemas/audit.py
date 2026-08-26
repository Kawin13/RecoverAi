from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

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
