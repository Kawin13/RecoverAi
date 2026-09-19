import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, CheckConstraint, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.core.datetime_utils import utcnow
from app.core.vault import generate_opaque_webhook_id

class WorkspaceIntegration(Base):
    __tablename__ = "workspace_integrations"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(32), nullable=False, default="razorpay")
    mode = Column(String(16), nullable=False, default="test")
    
    public_key_id = Column(String(255), nullable=True)
    encrypted_key_secret = Column(String(512), nullable=True)
    encrypted_webhook_secret = Column(String(512), nullable=True)
    
    webhook_endpoint_id = Column(String(64), unique=True, nullable=False, index=True, default=generate_opaque_webhook_id)
    status = Column(String(32), nullable=False, default="NOT_CONFIGURED") # NOT_CONFIGURED, CONNECTED, ERROR, DISCONNECTED
    
    last_verified_at = Column(DateTime, nullable=True)
    last_webhook_at = Column(DateTime, nullable=True)
    last_error = Column(String(512), nullable=True)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("workspace_id", "provider", name="uq_workspace_provider"),
        CheckConstraint("mode = 'test'", name="check_integration_mode_test_only"),
        CheckConstraint("provider IN ('razorpay')", name="check_integration_provider"),
    )

    workspace = relationship("Workspace", back_populates="integrations")
