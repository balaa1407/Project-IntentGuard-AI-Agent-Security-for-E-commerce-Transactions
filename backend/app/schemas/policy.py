from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.schemas.common import DecisionType
from backend.app.schemas.intent import IntentDraft
from backend.app.schemas.transaction import PolicyViolationDetail, TransactionSubmitRequest


class PolicyRuleSchema(BaseModel):
    max_price_tolerance_pct: float = Field(default=0.10, ge=0.0, le=1.0)
    strict_spec_match: bool = Field(default=True)
    strict_seller_verification: bool = Field(default=True)
    enforce_single_use: bool = Field(default=True)
    allowed_currencies: List[str] = Field(default_factory=lambda: ["INR", "USD", "EUR"])


class PolicyCreateUpdateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    version: str = Field(..., min_length=1, max_length=20)
    content_yaml: str = Field(..., min_length=5)
    description: Optional[str] = Field(default=None, max_length=255)


class PolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    version: str
    name: str
    is_active: bool
    content_yaml: str
    created_by: str
    created_at: Any
    description: Optional[str]


class PolicyTestRequest(BaseModel):
    policy_yaml: str
    sample_contract: IntentDraft
    sample_transaction: TransactionSubmitRequest


class PolicyTestResponse(BaseModel):
    is_valid_syntax: bool
    error_message: Optional[str] = None
    decision: Optional[DecisionType] = None
    violations: List[PolicyViolationDetail] = Field(default_factory=list)
    risk_score: Optional[int] = None
    intent_match_pct: Optional[int] = None
