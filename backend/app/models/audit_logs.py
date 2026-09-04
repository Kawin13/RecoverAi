from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, default=DEFAULT_WORKSPACE_ID, index=True)
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id"), nullable=True, index=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id"), nullable=True, index=True)
    actor = Column(String(64), default="AUTONOMOUS_AGENT")  # AUTONOMOUS_AGENT, MERCHANT_ADMIN, SYSTEM_GUARDRAIL, WEBHOOK_EVENT
    action_type = Column(String(64), nullable=False)
    target_resource = Column(String(128), nullable=False)
    details = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recovery_case = relationship("RecoveryCase", back_populates="audit_logs")
    transaction = relationship("Transaction", back_populates="audit_logs")
