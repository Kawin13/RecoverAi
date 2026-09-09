from enum import Enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Uuid, Integer, Index
from app.core.datetime_utils import utcnow
from app.database.base import Base
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class JobType(str, Enum):
    PROCESS_RECOVERY_CASE = "PROCESS_RECOVERY_CASE"
    SCAN_CART_ABANDONMENT = "SCAN_CART_ABANDONMENT"
    EXECUTE_DELAYED_RETRY = "EXECUTE_DELAYED_RETRY"
    RECONCILE_PAYMENT_LINK = "RECONCILE_PAYMENT_LINK"

class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    RETRY_SCHEDULED = "RETRY_SCHEDULED"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    CANCELLED = "CANCELLED"
    DEAD_LETTER = "DEAD_LETTER"

class RecoveryJob(Base):
    __tablename__ = "recovery_jobs"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(
        Uuid(as_uuid=False),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        default=DEFAULT_WORKSPACE_ID,
        index=True
    )
    job_type = Column(String(64), nullable=False, index=True)
    # PROCESS_RECOVERY_CASE, SCAN_CART_ABANDONMENT, EXECUTE_DELAYED_RETRY, RECONCILE_PAYMENT_LINK

    entity_id = Column(String(128), nullable=True, index=True)
    payload_json = Column(Text, nullable=True)

    status = Column(String(32), default="PENDING", nullable=False, index=True)
    # PENDING, PROCESSING, SUCCEEDED, FAILED, RETRY_SCHEDULED, WAITING_FOR_APPROVAL, CANCELLED, DEAD_LETTER

    scheduled_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    attempt_count = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    backoff_seconds = Column(Integer, default=30, nullable=False)
    last_error = Column(Text, nullable=True)

    locked_by = Column(String(128), nullable=True)
    locked_until = Column(DateTime, nullable=True, index=True)

    idempotency_key = Column(String(128), nullable=True, unique=True, index=True)

    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_recovery_jobs_claim", "status", "scheduled_at", "locked_until"),
        Index("ix_recovery_jobs_ws_type", "workspace_id", "job_type"),
    )
