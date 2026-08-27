from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sequence_number: int
    timestamp: datetime
    correlation_id: str
    actor: str
    contract_id: Optional[str] = None
    transaction_id: Optional[str] = None
    event_type: str
    decision: Optional[str] = None
    violations_json: Optional[str] = None
    payload_json: Optional[str] = None
    previous_hash: str
    current_hash: str
    is_valid: bool = True


class AuditVerificationResponse(BaseModel):
    is_valid: bool
    total_events: int
    tampered_event_id: Optional[str] = None
    message: str
    verified_at: datetime
