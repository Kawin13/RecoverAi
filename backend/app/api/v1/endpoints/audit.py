from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.audit_service import AuditService
from app.schemas.audit import AuditLogResponse, AuditLogListResponse

router = APIRouter()

@router.get("/audit/{transaction_id}", response_model=List[AuditLogResponse], tags=["Audit Logs"])
def get_transaction_audit_trail(transaction_id: str, db: Session = Depends(get_db)):
    service = AuditService(db)
    return service.get_transaction_audit(transaction_id)

@router.get("/audit", response_model=AuditLogListResponse, tags=["Audit Logs"])
def list_audit_logs(
    actor: Optional[str] = Query(None, description="Filter by actor: AUTONOMOUS_AGENT, MERCHANT_ADMIN, SYSTEM_GUARDRAIL, WEBHOOK_EVENT"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    service = AuditService(db)
    items = service.list_all_audits(actor=actor, limit=limit)
    return AuditLogListResponse(items=items, total=len(items))
