import os
import time
import threading
import collections
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_, desc, asc, func, case
from app.models.recovery_cases import RecoveryCase
from app.models.transactions import Transaction
from app.models.customers import Customer
from app.core.guardrail_policy import guardrail_policy

_QUEUE_COUNTS_LOCK = threading.Lock()
_QUEUE_COUNTS_CACHE: "collections.OrderedDict[Optional[str], Tuple[Dict[str, int], float]]" = collections.OrderedDict()
_QUEUE_COUNTS_TTL_SECONDS = 5.0

class RecoveryCaseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, case_id: str, workspace_id: Optional[str] = None) -> Optional[RecoveryCase]:
        query = (
            self.db.query(RecoveryCase)
            .options(
                joinedload(RecoveryCase.transaction).joinedload(Transaction.customer),
                selectinload(RecoveryCase.recovery_actions),
                selectinload(RecoveryCase.agent_decisions),
                joinedload(RecoveryCase.recovery_outcome)
            )
            .filter(RecoveryCase.id == case_id)
        )
        if workspace_id is not None:
            query = query.filter(RecoveryCase.workspace_id == workspace_id)
        return query.first()

    def list_cases(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        failure_category: Optional[str] = None,
        search: Optional[str] = None,
        min_erv: Optional[float] = None,
        workspace_id: Optional[str] = None
    ) -> Tuple[List[RecoveryCase], int]:
        query = (
            self.db.query(RecoveryCase)
            .join(Transaction, RecoveryCase.transaction_id == Transaction.id)
            .join(Customer, Transaction.customer_id == Customer.id)
            .options(
                joinedload(RecoveryCase.transaction).joinedload(Transaction.customer),
                selectinload(RecoveryCase.recovery_actions),
                selectinload(RecoveryCase.agent_decisions),
                joinedload(RecoveryCase.recovery_outcome)
            )
        )

        if workspace_id is not None:
            query = query.filter(RecoveryCase.workspace_id == workspace_id)

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

    def get_queue_counts(self, workspace_id: Optional[str] = None) -> Dict[str, int]:
        """
        Computes exact canonical active at-risk queue counts in a single SQL aggregate query.
        Uses a short 5s TTL cache in production to protect DB pool under heavy polling traffic.
        Ensures all subset queues are strictly <= all_at_risk.
        """
        use_cache = not bool(os.environ.get("PYTEST_CURRENT_TEST"))
        cache_key = str(workspace_id) if workspace_id is not None else None
        if use_cache:
            now_ts = time.time()
            with _QUEUE_COUNTS_LOCK:
                entry = _QUEUE_COUNTS_CACHE.get(cache_key)
                if entry is not None:
                    cached_counts, expiry = entry
                    if now_ts < expiry:
                        _QUEUE_COUNTS_CACHE.move_to_end(cache_key)
                        return dict(cached_counts)
                    _QUEUE_COUNTS_CACHE.pop(cache_key, None)

        urgent_threshold = guardrail_policy.URGENT_HIGH_VALUE_THRESHOLD_INR
        outage_categories = [
            "BANK_TIMEOUT", "TEMPORARY", "BANK_SERVER_DOWN",
            "GATEWAY_TIMEOUT", "ACQUIRER_UNAVAILABLE", "AUTHENTICATION_FAILED"
        ]

        query = (
            self.db.query(
                func.count(RecoveryCase.id).label("all_at_risk"),
                func.count(
                    case(
                        (
                            or_(
                                RecoveryCase.risk_amount >= urgent_threshold,
                                Transaction.amount >= urgent_threshold,
                            ),
                            1,
                        )
                    )
                ).label("high_value_urgent"),
                func.count(
                    case((Customer.tier.in_(["VIP", "ENTERPRISE"]), 1))
                ).label("vip_enterprise"),
                func.count(
                    case((RecoveryCase.failure_category.in_(outage_categories), 1))
                ).label("gateway_bank_outages"),
                func.count(
                    case(
                        (
                            or_(
                                RecoveryCase.status.is_(None),
                                RecoveryCase.status.notin_(["COOLING_DOWN", "NO_ACTION"]),
                            ),
                            1,
                        )
                    )
                ).label("batch_dispatch_eligible"),
            )
            .select_from(RecoveryCase)
            .join(Transaction, RecoveryCase.transaction_id == Transaction.id)
            .join(Customer, Transaction.customer_id == Customer.id)
            .filter(RecoveryCase.status != "RECOVERED")
            .filter(RecoveryCase.status != "SUCCESS")
            .filter(RecoveryCase.status != "STOPPED")
        )
        if workspace_id is not None:
            query = query.filter(RecoveryCase.workspace_id == workspace_id)

        row = query.first()
        all_at_risk = int(row.all_at_risk or 0) if row else 0
        high_value_urgent = int(row.high_value_urgent or 0) if row else 0
        vip_enterprise = int(row.vip_enterprise or 0) if row else 0
        gateway_bank_outages = int(row.gateway_bank_outages or 0) if row else 0
        batch_dispatch_eligible = int(row.batch_dispatch_eligible or 0) if row else 0

        result = {
            "all_at_risk": all_at_risk,
            "high_value_urgent": min(high_value_urgent, all_at_risk),
            "vip_enterprise": min(vip_enterprise, all_at_risk),
            "gateway_bank_outages": min(gateway_bank_outages, all_at_risk),
            "batch_dispatch_eligible": min(batch_dispatch_eligible, all_at_risk)
        }
        if use_cache:
            with _QUEUE_COUNTS_LOCK:
                _QUEUE_COUNTS_CACHE[cache_key] = (result, time.time() + _QUEUE_COUNTS_TTL_SECONDS)
                _QUEUE_COUNTS_CACHE.move_to_end(cache_key)
                while len(_QUEUE_COUNTS_CACHE) > 256:
                    _QUEUE_COUNTS_CACHE.popitem(last=False)
        return result
