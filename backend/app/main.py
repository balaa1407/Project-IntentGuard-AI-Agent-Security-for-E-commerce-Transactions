import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from backend.app.api.v1.api import api_router
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash
from backend.app.db.session import Base, SessionLocal, engine
from backend.app.models.policy import PolicyRule
from backend.app.models.user import User
from backend.app.schemas.common import UserRole


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class CorrelationAndTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        start_time = time.perf_counter()
        response: Response = await call_next(request)
        process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Process-Time-Ms"] = str(process_time_ms)
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed default accounts
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed default operator
        if not db.query(User).filter(User.email == "operator@intentguard.internal").first():
            op = User(
                id=str(uuid.uuid4()),
                email="operator@intentguard.internal",
                hashed_password=get_password_hash("Operator2026!"),
                full_name="Security Operator",
                role=UserRole.SECURITY_OPERATOR.value,
                is_active=True
            )
            db.add(op)
        
        # Seed default admin
        if not db.query(User).filter(User.email == "admin@intentguard.internal").first():
            adm = User(
                id=str(uuid.uuid4()),
                email="admin@intentguard.internal",
                hashed_password=get_password_hash("AdminMaster2026!"),
                full_name="Enterprise Admin",
                role=UserRole.ADMIN.value,
                is_active=True
            )
            db.add(adm)

        db.commit()
    finally:
        db.close()

    yield
    # Shutdown logic if needed


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="IntentGuard Enterprise — AI-Agent Transaction Security & Authorization Platform",
    lifespan=lifespan
)

# Middleware stack
app.add_middleware(CorrelationAndTimingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "sandbox_mode": settings.SANDBOX_PAYMENT_ENABLED
    }
