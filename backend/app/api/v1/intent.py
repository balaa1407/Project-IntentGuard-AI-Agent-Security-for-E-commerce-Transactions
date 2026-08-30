import uuid
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db, get_current_user
from backend.app.core.security import compute_canonical_sha256, compute_hmac_signature
from backend.app.models.contract import AuthorizationContract
from backend.app.models.user import User
from backend.app.schemas.common import ContractStatus
from backend.app.schemas.intent import (
    ContractCreateRequest,
    ContractResponse,
    IntentDraft,
    IntentExtractRequest
)
from backend.app.services.audit_service import AuditService
from backend.app.services.intent_extractor import extract_intent_from_prompt

router = APIRouter()


@router.post("/extract", response_model=IntentDraft)
async def extract_intent(req: IntentExtractRequest):
    """
    Parses natural language shopping prompt into structured draft constraints.
    Enforces strict Pydantic schema validation.
    """
    draft = await extract_intent_from_prompt(req.prompt)
    return draft


@router.post("/confirm", response_model=ContractResponse)
def confirm_authorization_contract(
    req: ContractCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    x_correlation_id: str = Header(default_factory=lambda: str(uuid.uuid4()))
):
    """
    Commits a confirmed intent draft into an immutable, cryptographically sealed Authorization Contract.
    """
    intent = req.intent
    contract_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=req.ttl_minutes or 120)

    # 1. Canonical data for cryptographic fingerprint
    contract_data = {
        "user_id": user.id,
        "category": intent.category,
        "max_price": intent.max_price,
        "currency": intent.currency,
        "ram_min": intent.ram_min,
        "seller_requirement": intent.seller_requirement,
        "max_quantity": intent.max_quantity
    }

    # 2. Compute SHA-256 fingerprint & HMAC signature
    hash_fingerprint = compute_canonical_sha256(contract_data)
    signature = compute_hmac_signature(hash_fingerprint)

    contract = AuthorizationContract(
        id=contract_id,
        user_id=user.id,
        natural_language_prompt=req.prompt,
        category=intent.category,
        max_price=intent.max_price,
        currency=intent.currency,
        ram_min=intent.ram_min,
        seller_requirement=intent.seller_requirement,
        max_quantity=intent.max_quantity,
        status=ContractStatus.ACTIVE.value,
        hash_fingerprint=hash_fingerprint,
        signature=signature,
        created_at=now,
        expires_at=expires_at,
        metadata_json=intent.model_dump_json()
    )

    db.add(contract)
    db.commit()
    db.refresh(contract)

    # 3. Log tamper-evident audit event
    AuditService.record_event(
        db=db,
        actor=user.email,
        event_type="CONTRACT_AUTHORIZED",
        correlation_id=x_correlation_id,
        contract_id=contract.id,
        decision=None,
        payload=contract_data
    )

    return contract


@router.get("/contracts", response_model=List[ContractResponse])
def list_contracts(
    limit: int = 50,
    status_filter: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = db.query(AuthorizationContract)
    if status_filter:
        query = query.filter(AuthorizationContract.status == status_filter)
    contracts = query.order_by(AuthorizationContract.created_at.desc()).limit(limit).all()
    return contracts


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db)
):
    contract = db.query(AuthorizationContract).filter(AuthorizationContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Authorization contract not found")
    return contract
