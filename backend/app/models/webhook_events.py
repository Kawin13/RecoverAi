from app.core.datetime_utils import utcnow
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from app.database.base import Base

class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String(128), primary_key=True, index=True)  # Razorpay event ID (e.g. event_EKwxwAgItmmXdp)
    event_type = Column(String(64), nullable=False, index=True)  # payment.captured, payment.failed, order.paid, etc.
    resource_id = Column(String(64), nullable=True, index=True)  # pay_..., order_...
    status = Column(String(32), default="PROCESSED")  # PROCESSED, IGNORED_DUPLICATE, IGNORED_OUT_OF_ORDER
    payload_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
