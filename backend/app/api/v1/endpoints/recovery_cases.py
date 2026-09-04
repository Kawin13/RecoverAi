from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.recovery_service import RecoveryService
from app.schemas.recovery_case import RecoveryCaseDetailResponse, RecoveryCaseListResponse
from app.schemas.canonical import QueueCounts
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/recovery-cases/queue-counts", response_model=QueueCounts, tags=["Recovery Cases"])
@router.get("/queue-counts", response_model=QueueCounts, tags=["Recovery Cases"])
def get_queue_counts(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns canonical active at-risk queue counts where each queue category
    is a strict subset of all active cases, and batch dispatch count equals eligible cases.
    """
    ws_id = current_user.get("workspace_id")
    service = RecoveryService(db)
    counts = service.get_queue_counts(workspace_id=ws_id)
    return QueueCounts(**counts)

@router.get("/recovery-cases", response_model=RecoveryCaseListResponse, tags=["Recovery Cases"])
def list_recovery_cases(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status: IN_PROGRESS, RECOVERED, PENDING_APPROVAL, etc."),
    failure_category: Optional[str] = Query(None, description="Filter by failure category"),
    search: Optional[str] = Query(None, description="Search by customer name, email, order ID"),
    min_erv: Optional[float] = Query(None, description="Minimum Expected Recovery Value"),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    service = RecoveryService(db)
    items, total = service.list_recovery_cases(
        page=page,
        limit=limit,
        status=status,
        failure_category=failure_category,
        search=search,
        min_erv=min_erv,
        workspace_id=ws_id
    )

    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return RecoveryCaseListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@router.get("/recovery-cases/{id}", response_model=RecoveryCaseDetailResponse, tags=["Recovery Cases"])
def get_recovery_case(
    id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    service = RecoveryService(db)
    case = service.get_recovery_case(id, workspace_id=ws_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recovery case with ID '{id}' was not found."
        )
    return case
