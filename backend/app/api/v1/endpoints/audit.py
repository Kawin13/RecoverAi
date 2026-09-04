from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.auth import get_current_user
from app.services.audit_service import AuditService
from app.schemas.audit import (
    AuditLogResponse,
    AuditLogListResponse,
    CaseAuditTimelineResponse,
    CaseAuditListResponse
)

router = APIRouter()

@router.get("/audit/cases", response_model=CaseAuditListResponse, tags=["Audit Logs & Traceability"])
def list_auditable_cases(
    search: Optional[str] = Query(None, description="Search by Case ID, Tx ID, Order ID, or Customer"),
    status: Optional[str] = Query(None, description="Filter by status: ALL, RECOVERED, FAILED, etc."),
    strategy: Optional[str] = Query(None, description="Filter by strategy"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns list of recovery cases with metadata and latest operational status for audit inspection.
    """
    ws_id = current_user.get("workspace_id")
    service = AuditService(db)
    return service.list_auditable_cases(search=search, status=status, strategy=strategy, limit=limit, workspace_id=ws_id)

@router.get("/audit/case/{id}/chronology", response_model=CaseAuditTimelineResponse, tags=["Audit Logs & Traceability"])
def get_case_chronological_timeline(
    id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns the complete 13-stage chronological audit trail for a recovery case or transaction.
    """
    ws_id = current_user.get("workspace_id")
    service = AuditService(db)
    return service.get_case_chronology(id, workspace_id=ws_id)

@router.get("/audit/case/{id}/export", tags=["Audit Logs & Traceability"])
def export_case_audit_json(
    id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Exports a downloadable, strictly sanitized JSON audit package for compliance and finance review.
    Guarantees no raw card PANs, CVVs, or secret tokens are leaked.
    """
    ws_id = current_user.get("workspace_id")
    service = AuditService(db)
    case_audit = service.get_case_chronology(id, workspace_id=ws_id)
    
    headers = {
        "Content-Disposition": f'attachment; filename="recoverai_audit_{id}.json"'
    }
    return Response(content=case_audit.exportable_json, media_type="application/json", headers=headers)

@router.get("/audit/{transaction_id}", response_model=List[AuditLogResponse], tags=["Audit Logs & Traceability"])
def get_transaction_audit_trail(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    service = AuditService(db)
    return service.get_transaction_audit(transaction_id, workspace_id=ws_id)

@router.get("/audit", response_model=AuditLogListResponse, tags=["Audit Logs & Traceability"])
def list_audit_logs(
    actor: Optional[str] = Query(None, description="Filter by actor: AUTONOMOUS_AGENT, MERCHANT_ADMIN, SYSTEM_GUARDRAIL, WEBHOOK_EVENT"),
    search: Optional[str] = Query(None, description="Free-text search across details, resources, and IDs"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    service = AuditService(db)
    items = service.list_all_audits(actor=actor, search=search, limit=limit, workspace_id=ws_id)
    return AuditLogListResponse(items=items, total=len(items))
