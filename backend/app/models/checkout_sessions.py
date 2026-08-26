from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class CheckoutSession(Base):
    __tablename__ = "checkout_sessions"

    id = Column(String(64), primary_key=True, index=True)
    customer_id = Column(String(64), ForeignKey("customers.id"), nullable=False, index=True)
    order_id = Column(String(64), nullable=False, index=True)
    items_summary = Column(String(512), nullable=True)
    cart_value = Column(Float, nullable=False)
    dropped_at_step = Column(String(64), default="PAYMENT_METHOD_SELECT")
    is_recovered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="checkout_sessions")
