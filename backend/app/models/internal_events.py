import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Uuid, Integer, Index
from app.core.datetime_utils import utcnow
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class InternalEvent(Base):
    __tablename__ = "internal_events"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(
        Uuid(as_uuid=False),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        default=DEFAULT_WORKSPACE_ID,
        index=True
    )
    event_type = Column(String(64), nullable=False, index=True)
    # Examples: PAYMENT_FAILED, PAYMENT_CAPTURED, CHECKOUT_ABANDONED,
    # RECOVERY_CASE_CREATED, RECOVERY_ANALYZED, STRATEGY_SELECTED,
    # GUARDRAIL_REQUIRED, ACTION_SCHEDULED, ACTION_EXECUTED,
    # PAYMENT_LINK_CREATED, CUSTOMER_WAITING, RECOVERY_SUCCEEDED, RECOVERY_FAILED

    entity_type = Column(String(64), nullable=False, index=True)
    # transaction, recovery_case, checkout_session, payment_link

    entity_id = Column(String(128), nullable=False, index=True)
    idempotency_key = Column(String(128), nullable=True, unique=True, index=True)
    processing_status = Column(String(32), default="PROCESSED", nullable=False, index=True)
    # PENDING, PROCESSED, FAILED, IGNORED

    attempt_count = Column(Integer, default=1, nullable=False)
    payload_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    processed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_internal_events_ws_type", "workspace_id", "event_type"),
        Index("ix_internal_events_entity", "entity_type", "entity_id"),
    )
