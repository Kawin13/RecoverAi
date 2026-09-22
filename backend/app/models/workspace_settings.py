import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Integer, Boolean, JSON, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.core.datetime_utils import utcnow

class WorkspaceSettings(Base):
    __tablename__ = "workspace_settings"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    business_type = Column(String(64), nullable=False, default="SAAS")
    timezone = Column(String(64), nullable=False, default="Asia/Kolkata")
    currency = Column(String(8), nullable=False, default="INR")
    
    # Financial Guardrails
    human_approval_threshold = Column(Float, nullable=False, default=10000.0)
    urgent_value_threshold = Column(Float, nullable=False, default=25000.0)
    
    # Execution & Frequency Guardrails
    max_recovery_attempts = Column(Integer, nullable=False, default=3)
    cooldown_minutes = Column(Integer, nullable=False, default=30)
    
    # Quiet Hours
    quiet_hours_enabled = Column(Boolean, nullable=False, default=True)
    quiet_hours_start = Column(String(8), nullable=False, default="22:00")
    quiet_hours_end = Column(String(8), nullable=False, default="08:00")
    
    # Discount & Strategy Controls
    maximum_discount_percent = Column(Float, nullable=False, default=15.0)
    allowed_strategies = Column(JSON, nullable=False, default=lambda: [
        "SMART_PAYLINK_1CLICK",
        "UPI_INTENT_FALLBACK",
        "TIMED_SMART_RETRY",
        "WHATSAPP_CONCIERGE",
        "INCENTIVIZED_DUNNING"
    ])

    # Workspace Email Policy (Resend Integration - Product V1)
    email_enabled = Column(Boolean, nullable=False, default=True)
    max_emails_per_recovery = Column(Integer, nullable=False, default=3)
    email_cooldown_minutes = Column(Integer, nullable=False, default=30)
    email_quiet_hours_enabled = Column(Boolean, nullable=False, default=True)
    email_quiet_hours_start = Column(String(8), nullable=False, default="22:00")
    email_quiet_hours_end = Column(String(8), nullable=False, default="08:00")
    recovery_success_email_enabled = Column(Boolean, nullable=False, default=False)
    
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    workspace = relationship("Workspace", back_populates="settings")
