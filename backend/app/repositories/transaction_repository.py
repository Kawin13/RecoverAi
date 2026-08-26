from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, desc, asc
from app.models.transactions import Transaction
from app.models.customers import Customer
from app.models.recovery_cases import RecoveryCase

class TransactionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, transaction_id: str) -> Optional[Transaction]:
        return (
            self.db.query(Transaction)
            .options(
                joinedload(Transaction.customer),
                joinedload(Transaction.recovery_case),
                joinedload(Transaction.payment_attempts)
            )
            .filter(Transaction.id == transaction_id)
            .first()
        )

    def list_transactions(
        self,
        page: int = 1,
        limit: int = 20,
        method: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Transaction], int]:
        query = (
            self.db.query(Transaction)
            .join(Customer, Transaction.customer_id == Customer.id)
            .outerjoin(RecoveryCase, Transaction.id == RecoveryCase.transaction_id)
            .options(
                joinedload(Transaction.customer),
                joinedload(Transaction.recovery_case),
                joinedload(Transaction.payment_attempts)
            )
        )

        if method and method != "ALL":
            query = query.filter(Transaction.method == method)

        if status and status != "ALL":
            query = query.filter(Transaction.status == status)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Transaction.order_id.ilike(search_pattern),
                    Transaction.id.ilike(search_pattern),
                    Customer.name.ilike(search_pattern),
                    Customer.email.ilike(search_pattern)
                )
            )

        total = query.count()

        # Sorting
        order_col = getattr(Transaction, sort_by, Transaction.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(order_col))
        else:
            query = query.order_by(desc(order_col))

        offset = (page - 1) * limit
        items = query.offset(offset).limit(limit).all()

        return items, total
