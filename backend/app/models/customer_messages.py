import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid, Integer, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.core.datetime_utils import utcnow

class CustomerMessage(Base):
    __tablename__ = "customer_messages"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    recovery_case_id = Column(String(64), ForeignKey("recovery_cases.id", ondelete="SET NULL"), nullable=True, index=True)
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(String(64), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    recovery_action_id = Column(String(64), ForeignKey("recovery_actions.id", ondelete="SET NULL"), nullable=True, index=True)
    recovery_job_id = Column(String(64), ForeignKey("recovery_jobs.id", ondelete="SET NULL"), nullable=True, index=True)

    channel = Column(String(32), nullable=False, default="EMAIL", index=True)
    recipient = Column(String(255), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    template_type = Column(String(64), nullable=True, index=True)
    message_text = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)  # Backward compatibility alias
    message_html = Column(Text, nullable=True)

    provider = Column(String(32), nullable=False, default="resend", index=True)
    provider_message_id = Column(String(128), nullable=True, index=True)

    # Lifecycle: QUEUED -> SENDING -> SENT -> DELIVERED / BOUNCED / FAILED / BLOCKED / CANCELLED
    status = Column(String(32), nullable=False, default="QUEUED", index=True)

    idempotency_key = Column(String(128), nullable=True, unique=True, index=True)
    attempt_count = Column(Integer, default=1, nullable=False)

    scheduled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    error_code = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    error = Column(Text, nullable=True)  # Backward compatibility alias
    metadata_json = Column(Text, nullable=True)

    # Table arguments & indexes
    __table_args__ = (
        Index("ix_customer_messages_ws_status", "workspace_id", "status"),
        Index("ix_customer_messages_case", "workspace_id", "recovery_case_id"),
    )

    # Relationships
    workspace = relationship("Workspace")
    recovery_case = relationship("RecoveryCase")
    transaction = relationship("Transaction")
    customer = relationship("Customer")
    recovery_action = relationship("RecoveryAction")
    recovery_job = relationship("RecoveryJob")
