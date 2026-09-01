from typing import Optional, List, Tuple, Dict, Any
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

    def get_queue_counts(self) -> Dict[str, int]:
        """
        Computes exact canonical active at-risk queue counts from database.
        Ensures all subset queues are strictly <= all_at_risk.
        """
        active_cases = (
            self.db.query(RecoveryCase)
            .join(Transaction, RecoveryCase.transaction_id == Transaction.id)
            .join(Customer, Transaction.customer_id == Customer.id)
            .options(joinedload(RecoveryCase.transaction).joinedload(Transaction.customer))
            .filter(RecoveryCase.status != "RECOVERED")
            .filter(RecoveryCase.status != "SUCCESS")
            .filter(RecoveryCase.status != "STOPPED")
            .all()
        )

        all_at_risk = len(active_cases)

        high_value_urgent = sum(
            1 for rc in active_cases
            if (rc.risk_amount >= 25000.0 or (rc.transaction and rc.transaction.amount >= 25000.0))
        )

        vip_enterprise = sum(
            1 for rc in active_cases
            if (rc.transaction and rc.transaction.customer and rc.transaction.customer.tier in ["VIP", "ENTERPRISE"])
        )

        gateway_bank_outages = sum(
            1 for rc in active_cases
            if (rc.failure_category in ["BANK_TIMEOUT", "TEMPORARY", "BANK_SERVER_DOWN", "GATEWAY_TIMEOUT", "ACQUIRER_UNAVAILABLE", "AUTHENTICATION_FAILED"])
        )

        batch_dispatch_eligible = sum(
            1 for rc in active_cases
            if rc.status not in ["COOLING_DOWN", "NO_ACTION"]
        )

        return {
            "all_at_risk": all_at_risk,
            "high_value_urgent": min(high_value_urgent, all_at_risk),
            "vip_enterprise": min(vip_enterprise, all_at_risk),
            "gateway_bank_outages": min(gateway_bank_outages, all_at_risk),
            "batch_dispatch_eligible": min(batch_dispatch_eligible, all_at_risk)
        }
