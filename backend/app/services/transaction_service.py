from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from app.repositories.transaction_repository import TransactionRepository
from app.models.transactions import Transaction

class TransactionService:
    def __init__(self, db: Session):
        self.repo = TransactionRepository(db)

    def get_transaction(self, transaction_id: str, workspace_id: Optional[str] = None) -> Optional[Transaction]:
        return self.repo.get_by_id(transaction_id, workspace_id=workspace_id)

    def list_transactions(
        self,
        page: int = 1,
        limit: int = 20,
        method: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        workspace_id: Optional[str] = None
    ) -> Tuple[List[Transaction], int]:
        return self.repo.list_transactions(
            page=page,
            limit=limit,
            method=method,
            status=status,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
            workspace_id=workspace_id
        )
