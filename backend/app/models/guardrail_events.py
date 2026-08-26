from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class GuardrailEvent(Base):
    __tablename__ = "guardrail_events"

    id = Column(String(64), primary_key=True, index=True)
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id"), nullable=True, index=True)
    rule_name = Column(String(128), nullable=False)
    threshold_breached = Column(String(128), nullable=False)
    action_taken = Column(String(64), default="BLOCKED")  # BLOCKED, REQUIRE_MANUAL_APPROVAL, NOTIFY_ONLY
    details = Column(Text, nullable=True)
    triggered_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recovery_case = relationship("RecoveryCase", back_populates="guardrail_events")
