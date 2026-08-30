from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db
from backend.app.models.audit import AuditEvent
from backend.app.schemas.audit import AuditEventResponse, AuditVerificationResponse
from backend.app.services.audit_service import AuditService

router = APIRouter()


@router.get("/events", response_model=List[AuditEventResponse])
def list_audit_events(
    limit: int = 50,
    actor: Optional[str] = None,
    decision: Optional[str] = None,
    contract_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditEvent)
    if actor:
        query = query.filter(AuditEvent.actor == actor)
    if decision:
        query = query.filter(AuditEvent.decision == decision)
    if contract_id:
        query = query.filter(AuditEvent.contract_id == contract_id)

    events = query.order_by(AuditEvent.sequence_number.desc()).limit(limit).all()
    return events


@router.get("/verify", response_model=AuditVerificationResponse)
def verify_audit_ledger(db: Session = Depends(get_db)):
    """
    Cryptographic verification endpoint.
    Recalculates the complete SHA-256 hash chain and verifies HMAC signatures.
    """
    return AuditService.verify_chain_integrity(db)
