from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.dashboard_service import DashboardService
from app.schemas.dashboard import DashboardResponse

router = APIRouter()

@router.get("/dashboard", response_model=DashboardResponse, tags=["Dashboard"])
def get_dashboard(db: Session = Depends(get_db)):
    service = DashboardService(db)
    return service.get_dashboard_summary()
