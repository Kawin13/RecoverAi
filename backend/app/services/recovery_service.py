from typing import Optional, List, Tuple, Dict
from sqlalchemy.orm import Session
from app.repositories.recovery_case_repository import RecoveryCaseRepository
from app.models.recovery_cases import RecoveryCase

class RecoveryService:
    def __init__(self, db: Session):
        self.repo = RecoveryCaseRepository(db)

    def get_recovery_case(self, case_id: str) -> Optional[RecoveryCase]:
        return self.repo.get_by_id(case_id)

    def list_recovery_cases(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        failure_category: Optional[str] = None,
        search: Optional[str] = None,
        min_erv: Optional[float] = None
    ) -> Tuple[List[RecoveryCase], int]:
        return self.repo.list_cases(
            page=page,
            limit=limit,
            status=status,
            failure_category=failure_category,
            search=search,
            min_erv=min_erv
        )

    def get_queue_counts(self) -> Dict[str, int]:
        return self.repo.get_queue_counts()
