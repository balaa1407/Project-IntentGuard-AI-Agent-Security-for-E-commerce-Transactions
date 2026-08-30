import uuid
import yaml
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db, get_current_user
from backend.app.models.contract import AuthorizationContract
from backend.app.models.policy import PolicyRule
from backend.app.models.user import User
from backend.app.schemas.policy import (
    PolicyCreateUpdateRequest,
    PolicyResponse,
    PolicyTestRequest,
    PolicyTestResponse
)
from backend.app.services.policy_engine import PolicyEngine

router = APIRouter()

DEFAULT_POLICY_YAML = """# IntentGuard Enterprise Policy Definition (v1.2.0)
version: "1.2.0"
name: "Standard E-Commerce Guardrails"
description: "Default policy enforcing budget boundaries, hardware specs, and verified seller trust."

rules:
  # Up to 10% price drift is held for human confirmation; beyond 10% is hard blocked
  max_price_tolerance_pct: 0.10
  
  # Strictly enforces RAM and hardware constraint matching
  strict_spec_match: true
  
  # Enforces verified/trusted seller status
  strict_seller_verification: true
  
  # Enforces single-purchase contract lifecycle
  enforce_single_use: true
  
  # Allowed transaction currencies
  allowed_currencies:
    - "INR"
    - "USD"
"""


def get_or_create_default_policy(db: Session) -> PolicyRule:
    policy = db.query(PolicyRule).filter(PolicyRule.is_active == True).first()
    if not policy:
        policy = PolicyRule(
            id=str(uuid.uuid4()),
            version="1.2.0",
            name="Standard E-Commerce Guardrails",
            is_active=True,
            content_yaml=DEFAULT_POLICY_YAML,
            created_by="system",
            created_at=datetime.now(timezone.utc),
            description="Default enterprise guardrails"
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy


@router.get("", response_model=List[PolicyResponse])
def list_policies(db: Session = Depends(get_db)):
    get_or_create_default_policy(db)
    policies = db.query(PolicyRule).order_by(PolicyRule.created_at.desc()).all()
    return policies


@router.get("/active", response_model=PolicyResponse)
def get_active_policy(db: Session = Depends(get_db)):
    return get_or_create_default_policy(db)


@router.post("", response_model=PolicyResponse)
def create_or_update_policy(
    req: PolicyCreateUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Saves a new policy version from the Monaco Editor workbench.
    Enforces strict YAML syntax validation.
    """
    try:
        parsed_yaml = yaml.safe_load(req.content_yaml)
        if not isinstance(parsed_yaml, dict):
            raise ValueError("YAML root must be a mapping/object")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML syntax: {str(e)}")

    # Check if version exists
    existing = db.query(PolicyRule).filter(PolicyRule.version == req.version).first()
    if existing:
        existing.content_yaml = req.content_yaml
        existing.name = req.name
        existing.description = req.description
        existing.created_by = user.email
        db.commit()
        db.refresh(existing)
        return existing

    new_policy = PolicyRule(
        id=str(uuid.uuid4()),
        version=req.version,
        name=req.name,
        is_active=False,
        content_yaml=req.content_yaml,
        created_by=user.email,
        created_at=datetime.now(timezone.utc),
        description=req.description
    )
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    return new_policy


@router.post("/test", response_model=PolicyTestResponse)
def test_policy_sandbox(req: PolicyTestRequest):
    """
    Dry-runs a policy draft in the Monaco Editor against sample fixtures.
    Does not modify database records.
    """
    try:
        parsed_yaml = yaml.safe_load(req.policy_yaml)
        if not isinstance(parsed_yaml, dict):
            return PolicyTestResponse(
                is_valid_syntax=False,
                error_message="Policy YAML must parse into a dictionary."
            )
    except Exception as e:
        return PolicyTestResponse(
            is_valid_syntax=False,
            error_message=f"YAML Parse Error: {str(e)}"
        )

    rules_dict = parsed_yaml.get("rules", {})

    # Create dummy contract model for dry-run
    dummy_contract = AuthorizationContract(
        id=req.sample_transaction.contract_id,
        user_id="test-user",
        natural_language_prompt="Sample test contract",
        category=req.sample_contract.category,
        max_price=req.sample_contract.max_price,
        currency=req.sample_contract.currency,
        ram_min=req.sample_contract.ram_min,
        seller_requirement=req.sample_contract.seller_requirement,
        max_quantity=req.sample_contract.max_quantity,
        status="ACTIVE",
        hash_fingerprint="dry-run",
        signature="dry-run",
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + datetime.resolution * 3600 * 24
    )

    decision, violations, risk_score, intent_match_pct, explanation = PolicyEngine.evaluate(
        contract=dummy_contract,
        transaction=req.sample_transaction,
        policy_config=rules_dict
    )

    return PolicyTestResponse(
        is_valid_syntax=True,
        decision=decision,
        violations=violations,
        risk_score=risk_score,
        intent_match_pct=intent_match_pct
    )


@router.post("/{policy_id}/activate", response_model=PolicyResponse)
def activate_policy(
    policy_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    policy = db.query(PolicyRule).filter(PolicyRule.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    # Deactivate all others
    db.query(PolicyRule).update({PolicyRule.is_active: False})
    policy.is_active = True
    db.commit()
    db.refresh(policy)
    return policy
