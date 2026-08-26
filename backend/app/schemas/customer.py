from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class CustomerBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    tier: str = "STANDARD"
    ltv: float = 0.0

class CustomerCreate(CustomerBase):
    id: str

class CustomerResponse(CustomerBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
