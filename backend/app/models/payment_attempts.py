from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, default=DEFAULT_WORKSPACE_ID, index=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id"), nullable=False, index=True)
    attempt_number = Column(Integer, default=1)
    gateway = Column(String(64), default="Razorpay")
    gateway_payment_id = Column(String(64), nullable=True, index=True)
    error_code = Column(String(64), nullable=True)
    error_description = Column(String(512), nullable=True)
    error_category = Column(String(64), nullable=True)
    latency_ms = Column(Integer, default=0)
    status = Column(String(32), default="FAILED")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    transaction = relationship("Transaction", back_populates="payment_attempts")
