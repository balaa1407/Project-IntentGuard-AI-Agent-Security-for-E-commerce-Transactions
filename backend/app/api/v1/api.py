from fastapi import APIRouter
from backend.app.api.v1 import (
    analytics,
    audit,
    auth,
    intent,
    policies,
    simulation,
    transactions
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(intent.router, prefix="/intent", tags=["Intent & Contracts"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions & Policy"])
api_router.include_router(policies.router, prefix="/policies", tags=["Policy Management"])
api_router.include_router(audit.router, prefix="/audit", tags=["Cryptographic Audit Ledger"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Telemetry & Analytics"])
api_router.include_router(simulation.router, prefix="/simulation", tags=["Attack Simulation Lab"])
