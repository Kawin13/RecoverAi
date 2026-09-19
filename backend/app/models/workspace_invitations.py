import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, CheckConstraint, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.core.datetime_utils import utcnow

class WorkspaceInvitation(Base):
    __tablename__ = "workspace_invitations"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(32), nullable=False, default="operator")
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    invited_by_user_id = Column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'operator')", name="check_invitation_role"),
    )

    workspace = relationship("Workspace", back_populates="invitations")
    inviter = relationship("Profile", foreign_keys=[invited_by_user_id])
