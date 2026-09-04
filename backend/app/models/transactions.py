from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, default=DEFAULT_WORKSPACE_ID, index=True)
    order_id = Column(String(64), nullable=False, index=True)
    customer_id = Column(String(64), ForeignKey("customers.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="INR")
    method = Column(String(32), default="Card")  # UPI, Card, NetBanking, Wallet, EMI
    status = Column(String(32), default="FAILED")  # PENDING, SUCCESS, FAILED, RECOVERED, ABANDONED
    razorpay_order_id = Column(String(64), nullable=True, index=True)
    razorpay_payment_id = Column(String(64), nullable=True, index=True)
    razorpay_signature = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="transactions")
    payment_attempts = relationship("PaymentAttempt", back_populates="transaction", cascade="all, delete-orphan")
    recovery_case = relationship("RecoveryCase", back_populates="transaction", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="transaction")
