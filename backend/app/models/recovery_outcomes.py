from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class RecoveryOutcome(Base):
    __tablename__ = "recovery_outcomes"

    id = Column(String(64), primary_key=True, index=True)
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id"), nullable=False, unique=True, index=True)
    recovered_amount = Column(Float, nullable=False)
    payment_method_used = Column(String(32), default="UPI")
    time_to_recover_seconds = Column(Integer, default=0)
    settled_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recovery_case = relationship("RecoveryCase", back_populates="recovery_outcome")
