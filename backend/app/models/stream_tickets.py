from sqlalchemy import Column, String, DateTime, Uuid
from app.database.base import Base
from app.core.datetime_utils import utcnow

class ConsumedStreamTicket(Base):
    __tablename__ = "consumed_stream_tickets"

    ticket = Column(String(255), primary_key=True, index=True)
    workspace_id = Column(Uuid(as_uuid=False), nullable=False, index=True)
    user_id = Column(Uuid(as_uuid=False), nullable=False)
    consumed_at = Column(DateTime, default=utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
