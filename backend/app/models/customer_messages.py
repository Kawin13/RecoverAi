import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.core.datetime_utils import utcnow

class CustomerMessage(Base):
    __tablename__ = "customer_messages"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    
    channel = Column(String(32), nullable=False, default="EMAIL")
    recipient = Column(String(255), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    body_text = Column(Text, nullable=True)
    provider_message_id = Column(String(128), nullable=True, index=True)
    
    # Lifecycle: QUEUED -> SENT -> DELIVERED (only with provider webhook) / FAILED
    status = Column(String(32), nullable=False, default="QUEUED", index=True)
    
    created_at = Column(DateTime, default=utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)

    workspace = relationship("Workspace")
    recovery_case = relationship("RecoveryCase")
    customer = relationship("Customer")
