from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.transaction_service import TransactionService
from app.schemas.transaction import TransactionResponse, TransactionListResponse
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/transactions", response_model=TransactionListResponse, tags=["Transactions"])
def list_transactions(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    method: Optional[str] = Query(None, description="Filter by method: UPI, Card, NetBanking, Wallet, EMI"),
    status: Optional[str] = Query(None, description="Filter by status: PENDING, FAILED, RECOVERED, ABANDONED"),
    search: Optional[str] = Query(None, description="Search by Order ID, Transaction ID, customer name or email"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    service = TransactionService(db)
    items, total = service.list_transactions(
        page=page,
        limit=limit,
        method=method,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        workspace_id=ws_id
    )

    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return TransactionListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@router.get("/transactions/{id}", response_model=TransactionResponse, tags=["Transactions"])
def get_transaction(
    id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    service = TransactionService(db)
    tx = service.get_transaction(id, workspace_id=ws_id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID '{id}' was not found."
        )
    return tx
