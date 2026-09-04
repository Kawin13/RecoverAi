from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, CheckConstraint, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Uuid(as_uuid=False), primary_key=True, index=True)  # UUID matching auth.users(id)
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    avatar_url = Column(Text, nullable=True)
    role = Column(String(32), nullable=False, default="operator")  # 'admin' or 'operator'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'operator')", name="role_check"),
    )

    workspace_memberships = relationship("WorkspaceMember", back_populates="profile", cascade="all, delete-orphan")
