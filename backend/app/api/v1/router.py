from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    dashboard,
    transactions,
    recovery_cases,
    audit,
    ml,
    recovery_decision,
    ai,
    payments,
    webhooks,
    events,
    recovery_executor,
    guardrails
)

api_router = APIRouter()

api_router.include_router(dashboard.router)
api_router.include_router(transactions.router)
api_router.include_router(recovery_cases.router)
api_router.include_router(audit.router)
api_router.include_router(payments.router, prefix="/payments", tags=["Payments & Gateway"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Razorpay Webhook"])
api_router.include_router(events.router, prefix="/events", tags=["Real-Time Events & SSE"])
api_router.include_router(ml.router, prefix="/ml", tags=["ML & Propensity Engine"])
api_router.include_router(recovery_decision.router, prefix="/recovery", tags=["Decision Intelligence & ERV"])
api_router.include_router(recovery_executor.router, prefix="/recovery", tags=["Recovery Executor & Workflows"])
api_router.include_router(guardrails.router, prefix="/guardrails", tags=["Fintech Guardrails & Governance"])
api_router.include_router(ai.router, prefix="/ai", tags=["Gemini GenAI & Multi-Lingual Communications"])
