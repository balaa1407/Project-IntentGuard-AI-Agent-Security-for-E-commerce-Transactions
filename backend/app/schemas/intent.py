from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
import unicodedata
from backend.app.schemas.common import ContractStatus


def sanitize_text(v: str) -> str:
    """Normalize unicode NFKC and strip dangerous control characters."""
    if not isinstance(v, str):
        return v
    normalized = unicodedata.normalize("NFKC", v)
    # Strip non-printable / control chars except regular whitespace
    cleaned = "".join(ch for ch in normalized if ch.isprintable() or ch in " \t\n\r")
    return cleaned.strip()


class IntentExtractRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1500, description="Natural language shopping instruction")

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        cleaned = sanitize_text(v)
        if len(cleaned) < 3:
            raise ValueError("Instruction too short after sanitization")
        return cleaned


class IntentDraft(BaseModel):
    category: str = Field(..., description="Target product category, e.g., 'gaming laptop'")
    max_price: float = Field(..., gt=0, le=10_000_000, description="Upper monetary limit")
    currency: str = Field(default="INR", max_length=10)
    ram_min: Optional[int] = Field(default=None, ge=1, le=1024, description="Minimum RAM requirement in GB")
    seller_requirement: str = Field(default="trusted", description="trusted, verified, or any")
    max_quantity: int = Field(default=1, ge=1, le=10, description="Allowed purchase quantity")
    authorization_type: str = Field(default="single_purchase")
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    ambiguities: List[str] = Field(default_factory=list)
    clarification_needed: bool = False

    @field_validator("category", "seller_requirement")
    @classmethod
    def sanitize_strings(cls, v: str) -> str:
        return sanitize_text(v).lower()


class ContractCreateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1500)
    intent: IntentDraft
    ttl_minutes: Optional[int] = Field(default=120, ge=5, le=1440)


class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    natural_language_prompt: str
    category: str
    max_price: float
    currency: str
    ram_min: Optional[int]
    seller_requirement: str
    max_quantity: int
    status: ContractStatus
    hash_fingerprint: str
    signature: str
    created_at: datetime
    expires_at: datetime
