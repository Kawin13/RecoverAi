from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, desc, asc
from app.models.recovery_cases import RecoveryCase
from app.models.transactions import Transaction
from app.models.customers import Customer

class RecoveryCaseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, case_id: str) -> Optional[RecoveryCase]:
        return (
            self.db.query(RecoveryCase)
            .options(
                joinedload(RecoveryCase.transaction).joinedload(Transaction.customer),
                joinedload(RecoveryCase.recovery_actions),
                joinedload(RecoveryCase.agent_decisions),
                joinedload(RecoveryCase.recovery_outcome)
            )
            .filter(RecoveryCase.id == case_id)
            .first()
        )

    def list_cases(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        failure_category: Optional[str] = None,
        search: Optional[str] = None,
        min_erv: Optional[float] = None
    ) -> Tuple[List[RecoveryCase], int]:
        query = (
            self.db.query(RecoveryCase)
            .join(Transaction, RecoveryCase.transaction_id == Transaction.id)
            .join(Customer, Transaction.customer_id == Customer.id)
            .options(
                joinedload(RecoveryCase.transaction).joinedload(Transaction.customer),
                joinedload(RecoveryCase.recovery_actions),
                joinedload(RecoveryCase.agent_decisions),
                joinedload(RecoveryCase.recovery_outcome)
            )
        )

        if status and status != "ALL":
            query = query.filter(RecoveryCase.status == status)

        if failure_category and failure_category != "ALL":
            query = query.filter(RecoveryCase.failure_category == failure_category)

        if min_erv is not None:
            query = query.filter(RecoveryCase.expected_recovery_value >= min_erv)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    RecoveryCase.id.ilike(search_pattern),
                    Transaction.order_id.ilike(search_pattern),
                    Customer.name.ilike(search_pattern),
                    Customer.email.ilike(search_pattern)
                )
            )

        total = query.count()
        offset = (page - 1) * limit
        items = query.order_by(desc(RecoveryCase.created_at)).offset(offset).limit(limit).all()

        return items, total
