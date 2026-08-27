from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from backend.app.schemas.common import DecisionType, PolicyViolationCode, SellerTrustLevel, TransactionStatus
from backend.app.schemas.intent import sanitize_text


class PolicyViolationDetail(BaseModel):
    code: PolicyViolationCode
    message: str
    field: str
    expected: Any
    actual: Any
    severity: str = "HIGH"  # CRITICAL, HIGH, MEDIUM


class TransactionSubmitRequest(BaseModel):
    contract_id: str = Field(..., min_length=36, max_length=36)
    idempotency_key: str = Field(..., min_length=8, max_length=128)
    agent_id: str = Field(default="shopping-agent-01", max_length=100)
    merchant_name: str = Field(..., min_length=1, max_length=200)
    seller_id: str = Field(..., min_length=1, max_length=100)
    seller_trust_level: SellerTrustLevel = Field(default=SellerTrustLevel.UNVERIFIED)
    product_name: str = Field(..., min_length=2, max_length=255)
    category: str = Field(..., min_length=2, max_length=100)
    price: float = Field(..., gt=0, le=10_000_000)
    currency: str = Field(default="INR", max_length=10)
    quantity: int = Field(default=1, ge=1, le=10)
    ram_gb: Optional[int] = Field(default=None, ge=1, le=1024)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("product_name", "merchant_name", "category")
    @classmethod
    def sanitize_fields(cls, v: str) -> str:
        return sanitize_text(v)


class TransactionDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: str
    contract_id: str
    decision: DecisionType
    status: TransactionStatus
    risk_score: int
    intent_match_pct: int
    violations: List[PolicyViolationDetail]
    ai_explanation: Optional[str] = None
    payment_reference: Optional[str] = None
    confirmation_token: Optional[str] = None
    timestamp: datetime


class TransactionConfirmRequest(BaseModel):
    confirmation_token: str = Field(..., min_length=16, max_length=100)
    reason: Optional[str] = Field(default="Customer explicitly authorized revised transaction terms", max_length=500)
