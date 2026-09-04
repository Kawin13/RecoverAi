from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.dashboard_service import DashboardService
from app.schemas.dashboard import DashboardResponse
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/dashboard", response_model=DashboardResponse, tags=["Dashboard"])
def get_dashboard(
    time_range: str = Query("7d", description="Time window: 24h, today, 7d, 30d"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    workspace_id = current_user.get("workspace_id")
    service = DashboardService(db)
    return service.get_dashboard_summary(time_range=time_range, workspace_id=workspace_id)
