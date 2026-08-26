from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.audit_repository import AuditRepository
from app.models.audit_logs import AuditLog

class AuditService:
    def __init__(self, db: Session):
        self.repo = AuditRepository(db)

    def get_transaction_audit(self, transaction_id: str) -> List[AuditLog]:
        return self.repo.get_by_transaction_id(transaction_id)

    def list_all_audits(self, actor: Optional[str] = None, limit: int = 50) -> List[AuditLog]:
        return self.repo.list_all(actor=actor, limit=limit)
