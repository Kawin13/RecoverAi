from app.core.datetime_utils import utcnow
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class PaymentLink(Base):
    __tablename__ = "payment_links"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, default=DEFAULT_WORKSPACE_ID, index=True)
    payment_link_id = Column(String(64), nullable=False, unique=True, index=True)  # Razorpay plink_...
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id"), nullable=False, index=True)
    short_url = Column(String(256), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="INR")
    status = Column(String(32), default="created")  # created, paid, expired, cancelled
    is_live_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    recovery_case = relationship("RecoveryCase", back_populates="payment_links")
