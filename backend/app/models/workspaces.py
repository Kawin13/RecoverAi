from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, CheckConstraint, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base

DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_WORKSPACE_NAME = "RecoverAI Demo Workspace"

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Uuid(as_uuid=False), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(Uuid(as_uuid=False), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False, default="operator")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
        CheckConstraint("role IN ('admin', 'operator')", name="workspace_member_role_check"),
    )

    workspace = relationship("Workspace", back_populates="members")
    profile = relationship("Profile", back_populates="workspace_memberships")
