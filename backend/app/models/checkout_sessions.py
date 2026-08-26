from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class CheckoutSession(Base):
    __tablename__ = "checkout_sessions"

    id = Column(String(64), primary_key=True, index=True)  # checkout_session_id
    customer_id = Column(String(64), ForeignKey("customers.id"), nullable=False, index=True)
    order_id = Column(String(64), nullable=False, index=True)
    cart_amount = Column(Float, nullable=False, default=0.0)
    status = Column(String(32), default="STARTED", index=True)  # STARTED, CUSTOMER_IDENTIFIED, PAYMENT_METHOD_VIEWED, PAYMENT_INITIATED, COMPLETED, ABANDONED
    selected_method = Column(String(32), nullable=True)  # UPI, CARD, NETBANKING, WALLET
    payment_attempted = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    abandoned_at = Column(DateTime, nullable=True)
    is_demo_simulation = Column(Boolean, default=True)  # Clearly labels demo checkout vs real Razorpay test transactions
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id"), nullable=True, index=True)

    # Legacy fields for backward compatibility with payment order creation
    items_summary = Column(String(255), nullable=True)
    cart_value = Column(Float, nullable=True)
    dropped_at_step = Column(String(64), nullable=True)
    is_recovered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="checkout_sessions")
    recovery_case = relationship("RecoveryCase", foreign_keys=[recovery_case_id])

    def __init__(self, **kwargs):
        if "cart_value" in kwargs and "cart_amount" not in kwargs:
            kwargs["cart_amount"] = kwargs["cart_value"]
        if "created_at" in kwargs and "started_at" not in kwargs:
            kwargs["started_at"] = kwargs["created_at"]
        super().__init__(**kwargs)
