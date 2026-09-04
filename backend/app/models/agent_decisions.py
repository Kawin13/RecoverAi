from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class AgentDecision(Base):
    __tablename__ = "agent_decisions"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, default=DEFAULT_WORKSPACE_ID, index=True)
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id"), nullable=False, index=True)
    model_name = Column(String(64), default="XGBoost+Gemini-2.5-Flash")
    input_features = Column(Text, nullable=True)
    propensity_scores = Column(Text, nullable=True)
    selected_action = Column(String(64), nullable=False)
    reasoning_summary = Column(Text, nullable=False)
    decided_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recovery_case = relationship("RecoveryCase", back_populates="agent_decisions")
