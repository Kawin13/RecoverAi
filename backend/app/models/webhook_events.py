from app.core.datetime_utils import utcnow
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint, Uuid
from app.database.base import Base

class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String(128), primary_key=True, index=True)  # Internal or synthesized event ID
    workspace_id = Column(Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    integration_id = Column(Uuid(as_uuid=False), ForeignKey("workspace_integrations.id", ondelete="SET NULL"), nullable=True, index=True)
    provider_event_id = Column(String(128), nullable=True, index=True) # Provider raw event ID (e.g. evt_...)
    event_type = Column(String(64), nullable=False, index=True)  # payment.captured, payment.failed, etc.
    resource_id = Column(String(64), nullable=True, index=True)  # pay_..., order_...
    status = Column(String(32), default="PROCESSED")  # PROCESSED, IGNORED_DUPLICATE, IGNORED_OUT_OF_ORDER, FAILED
    payload_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("workspace_id", "provider_event_id", name="uq_workspace_webhook_event"),
    )
