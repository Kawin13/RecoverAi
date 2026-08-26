from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.audit_logs import AuditLog

class AuditRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_transaction_id(self, transaction_id: str) -> List[AuditLog]:
        return (
            self.db.query(AuditLog)
            .filter(AuditLog.transaction_id == transaction_id)
            .order_by(desc(AuditLog.created_at))
            .all()
        )

    def list_all(self, actor: Optional[str] = None, limit: int = 50) -> List[AuditLog]:
        query = self.db.query(AuditLog)
        if actor and actor != "ALL":
            query = query.filter(AuditLog.actor == actor)
        return query.order_by(desc(AuditLog.created_at)).limit(limit).all()
