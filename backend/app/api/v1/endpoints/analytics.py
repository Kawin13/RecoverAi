from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.analytics_service import AnalyticsService
from app.schemas.analytics import AnalyticsResponse, AnalyticsFilters
from app.core.auth import get_current_user

router = APIRouter()

@router.get("", response_model=AnalyticsResponse, summary="Get Consolidated Financial Recovery Analytics")
def get_analytics(
    time_range: str = Query("7d", description="Time interval: today, 24h, 7d, 30d, custom"),
    start_date: Optional[str] = Query(None, description="Custom start date ISO format"),
    end_date: Optional[str] = Query(None, description="Custom end date ISO format"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    failure_reason: Optional[str] = Query(None, description="Filter by failure reason"),
    strategy: Optional[str] = Query(None, description="Filter by strategy"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns multidimensional financial operations console analytics:
    Revenue at Risk, Revenue Recovered, Recovery Rate, Net Recovery Value,
    velocity metrics, and breakdowns across strategies, failure reasons,
    payment methods, merchant categories, and customer segments.
    Truthful metrics scoped to workspace and bounded by time filters.
    """
    filters = AnalyticsFilters(
        time_range=time_range,
        start_date=start_date,
        end_date=end_date,
        payment_method=payment_method,
        failure_reason=failure_reason,
        strategy=strategy,
        status=status
    )
    workspace_id = current_user.get("workspace_id")
    service = AnalyticsService(db)
    return service.get_financial_analytics(filters, workspace_id=workspace_id)
