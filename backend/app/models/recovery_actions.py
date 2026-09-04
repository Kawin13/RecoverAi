from datetime import datetime
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class RecoveryAction(Base):
    __tablename__ = "recovery_actions"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, default=DEFAULT_WORKSPACE_ID, index=True)
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id"), nullable=False, index=True)
    strategy = Column(String(64), nullable=False)
    channel = Column(String(32), default="SMS")  # SMS, EMAIL, WHATSAPP, PAYLINK, IN_APP
    payload_data = Column(Text, nullable=True)
    erv = Column(Float, default=0.0)
    status = Column(String(32), default="DISPATCHED")  # DISPATCHED, DELIVERED, OPENED, CLICKED, COMPLETED, BLOCKED
    dispatched_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recovery_case = relationship("RecoveryCase", back_populates="recovery_actions")
