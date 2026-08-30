import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db, get_current_user
from backend.app.models.contract import AuthorizationContract
from backend.app.models.transaction import TransactionProposal
from backend.app.models.user import User
from backend.app.schemas.common import DecisionType, PolicyViolationCode, TransactionStatus
from backend.app.schemas.transaction import (
    PolicyViolationDetail,
    TransactionConfirmRequest,
    TransactionDecisionResponse,
    TransactionSubmitRequest
)
from backend.app.services.audit_service import AuditService
from backend.app.services.payment_adapter import SandboxedPaymentAdapter, SecurityPaymentViolationError
from backend.app.services.policy_engine import PolicyEngine

router = APIRouter()


@router.post("/submit", response_model=TransactionDecisionResponse)
def submit_transaction_proposal(
    req: TransactionSubmitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    x_correlation_id: str = Header(default_factory=lambda: str(uuid.uuid4()))
):
    """
    Submits a purchase proposed by a shopping agent.
    Enforces deterministic policy evaluation and calls Sandboxed Payment Adapter if APPROVED.
    """
    # 1. Idempotency Check
    existing_tx = db.query(TransactionProposal).filter(
        TransactionProposal.idempotency_key == req.idempotency_key
    ).first()

    if existing_tx:
        # Return existing decision idempotently
        parsed_violations = []
        try:
            raw_v = json.loads(existing_tx.violations)
            parsed_violations = [PolicyViolationDetail(**v) for v in raw_v]
        except Exception:
            pass

        return TransactionDecisionResponse(
            transaction_id=existing_tx.id,
            contract_id=existing_tx.contract_id,
            decision=DecisionType(existing_tx.decision or "BLOCK"),
            status=TransactionStatus(existing_tx.status),
            risk_score=existing_tx.risk_score,
            intent_match_pct=existing_tx.intent_match_pct,
            violations=parsed_violations,
            ai_explanation=existing_tx.ai_explanation,
            payment_reference=existing_tx.payment_reference,
            confirmation_token=existing_tx.confirmation_token,
            timestamp=existing_tx.created_at
        )

    # 2. Contract Lookup
    contract = db.query(AuthorizationContract).filter(
        AuthorizationContract.id == req.contract_id
    ).first()

    if not contract:
        # Fail closed: reject without contract
        missing_violation = PolicyViolationDetail(
            code=PolicyViolationCode.MISSING_OR_EXPIRED_AUTH,
            message="No authorization contract found matching contract_id.",
            field="contract_id",
            expected="Valid active contract ID",
            actual=req.contract_id,
            severity="CRITICAL"
        )
        tx_id = str(uuid.uuid4())
        
        tx_record = TransactionProposal(
            id=tx_id,
            contract_id=req.contract_id,
            idempotency_key=req.idempotency_key,
            agent_id=req.agent_id,
            merchant_name=req.merchant_name,
            seller_id=req.seller_id,
            seller_trust_level=req.seller_trust_level.value,
            product_name=req.product_name,
            category=req.category,
            price=req.price,
            currency=req.currency,
            quantity=req.quantity,
            ram_gb=req.ram_gb,
            status=TransactionStatus.BLOCKED.value,
            decision=DecisionType.BLOCK.value,
            risk_score=100,
            intent_match_pct=0,
            violations=json.dumps([missing_violation.model_dump()]),
            ai_explanation="Transaction blocked: unverified or missing authorization contract."
        )
        db.add(tx_record)
        db.commit()

        AuditService.record_event(
            db=db,
            actor=req.agent_id,
            event_type="UNAUTHORIZED_TRANSACTION_ATTEMPT",
            correlation_id=x_correlation_id,
            contract_id=req.contract_id,
            transaction_id=tx_id,
            decision=DecisionType.BLOCK.value,
            violations=[missing_violation.model_dump()],
            payload=req.model_dump()
        )

        return TransactionDecisionResponse(
            transaction_id=tx_id,
            contract_id=req.contract_id,
            decision=DecisionType.BLOCK,
            status=TransactionStatus.BLOCKED,
            risk_score=100,
            intent_match_pct=0,
            violations=[missing_violation],
            ai_explanation=tx_record.ai_explanation,
            timestamp=datetime.now(timezone.utc)
        )

    # 3. Deterministic Policy Evaluation
    decision, violations, risk_score, intent_match_pct, explanation = PolicyEngine.evaluate(
        contract=contract,
        transaction=req
    )

    # 4. Map decision to status & tokens
    tx_id = str(uuid.uuid4())
    confirmation_token = None

    if decision == DecisionType.APPROVE:
        initial_status = TransactionStatus.APPROVED.value
    elif decision == DecisionType.REQUIRE_CONFIRMATION:
        initial_status = TransactionStatus.REQUIRE_CONFIRMATION.value
        confirmation_token = f"conf_{uuid.uuid4().hex}"
    else:
        initial_status = TransactionStatus.BLOCKED.value

    tx_record = TransactionProposal(
        id=tx_id,
        contract_id=contract.id,
        idempotency_key=req.idempotency_key,
        agent_id=req.agent_id,
        merchant_name=req.merchant_name,
        seller_id=req.seller_id,
        seller_trust_level=req.seller_trust_level.value,
        product_name=req.product_name,
        category=req.category,
        price=req.price,
        currency=req.currency,
        quantity=req.quantity,
        ram_gb=req.ram_gb,
        status=initial_status,
        decision=decision.value,
        risk_score=risk_score,
        intent_match_pct=intent_match_pct,
        violations=json.dumps([v.model_dump() for v in violations]),
        ai_explanation=explanation,
        confirmation_token=confirmation_token
    )

    db.add(tx_record)
    db.commit()
    db.refresh(tx_record)

    # 5. Record Policy Decision Audit Event
    AuditService.record_event(
        db=db,
        actor="PolicyEngine",
        event_type="POLICY_EVALUATION",
        correlation_id=x_correlation_id,
        contract_id=contract.id,
        transaction_id=tx_id,
        decision=decision.value,
        violations=[v.model_dump() for v in violations],
        payload={"price": req.price, "product": req.product_name}
    )

    # 6. Execute Sandboxed Payment if APPROVED
    payment_reference = None
    if decision == DecisionType.APPROVE:
        try:
            pay_res = SandboxedPaymentAdapter.execute_payment(
                db=db,
                transaction=tx_record,
                contract=contract
            )
            payment_reference = pay_res.get("payment_reference")

            AuditService.record_event(
                db=db,
                actor="PaymentAdapter",
                event_type="PAYMENT_CAPTURED",
                correlation_id=x_correlation_id,
                contract_id=contract.id,
                transaction_id=tx_id,
                decision="PAYMENT_SUCCESS",
                payload=pay_res
            )
        except SecurityPaymentViolationError as e:
            tx_record.status = TransactionStatus.PAYMENT_FAILED.value
            db.commit()
            raise HTTPException(status_code=400, detail=str(e))

    return TransactionDecisionResponse(
        transaction_id=tx_record.id,
        contract_id=tx_record.contract_id,
        decision=decision,
        status=TransactionStatus(tx_record.status),
        risk_score=tx_record.risk_score,
        intent_match_pct=tx_record.intent_match_pct,
        violations=violations,
        ai_explanation=tx_record.ai_explanation,
        payment_reference=payment_reference,
        confirmation_token=confirmation_token,
        timestamp=tx_record.created_at
    )


@router.post("/{transaction_id}/confirm", response_model=TransactionDecisionResponse)
def confirm_transaction(
    transaction_id: str,
    req: TransactionConfirmRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    x_correlation_id: str = Header(default_factory=lambda: str(uuid.uuid4()))
):
    """
    Explicit customer authorization for a transaction requiring confirmation (e.g. slight price deviation).
    Releases payment execution through the sandboxed adapter.
    """
    tx = db.query(TransactionProposal).filter(TransactionProposal.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if tx.status != TransactionStatus.REQUIRE_CONFIRMATION.value:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction is in '{tx.status}' state, not pending confirmation."
        )

    if tx.confirmation_token != req.confirmation_token:
        raise HTTPException(status_code=403, detail="Invalid confirmation token")

    contract = db.query(AuthorizationContract).filter(AuthorizationContract.id == tx.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Mark as confirmed
    tx.status = TransactionStatus.CONFIRMED.value
    db.commit()

    # Execute payment
    pay_res = SandboxedPaymentAdapter.execute_payment(
        db=db,
        transaction=tx,
        contract=contract
    )

    AuditService.record_event(
        db=db,
        actor=user.email,
        event_type="HUMAN_CONFIRMATION_GRANTED",
        correlation_id=x_correlation_id,
        contract_id=contract.id,
        transaction_id=tx.id,
        decision="CONFIRMED_AND_PAID",
        payload={"reason": req.reason, "payment_ref": pay_res.get("payment_reference")}
    )

    parsed_violations = []
    try:
        raw_v = json.loads(tx.violations)
        parsed_violations = [PolicyViolationDetail(**v) for v in raw_v]
    except Exception:
        pass

    return TransactionDecisionResponse(
        transaction_id=tx.id,
        contract_id=tx.contract_id,
        decision=DecisionType.REQUIRE_CONFIRMATION,
        status=TransactionStatus(tx.status),
        risk_score=tx.risk_score,
        intent_match_pct=tx.intent_match_pct,
        violations=parsed_violations,
        ai_explanation=f"Explicit Customer Authorization Granted: {req.reason}",
        payment_reference=pay_res.get("payment_reference"),
        confirmation_token=None,
        timestamp=datetime.now(timezone.utc)
    )


@router.get("", response_model=List[TransactionDecisionResponse])
def list_transactions(
    limit: int = 50,
    status_filter: Optional[str] = None,
    decision_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TransactionProposal)
    if status_filter:
        query = query.filter(TransactionProposal.status == status_filter)
    if decision_filter:
        query = query.filter(TransactionProposal.decision == decision_filter)
    
    txs = query.order_by(TransactionProposal.created_at.desc()).limit(limit).all()
    results = []
    for tx in txs:
        parsed_violations = []
        try:
            raw_v = json.loads(tx.violations)
            parsed_violations = [PolicyViolationDetail(**v) for v in raw_v]
        except Exception:
            pass
        results.append(TransactionDecisionResponse(
            transaction_id=tx.id,
            contract_id=tx.contract_id,
            decision=DecisionType(tx.decision or "BLOCK"),
            status=TransactionStatus(tx.status),
            risk_score=tx.risk_score,
            intent_match_pct=tx.intent_match_pct,
            violations=parsed_violations,
            ai_explanation=tx.ai_explanation,
            payment_reference=tx.payment_reference,
            confirmation_token=tx.confirmation_token,
            timestamp=tx.created_at
        ))
    return results


@router.get("/{transaction_id}", response_model=TransactionDecisionResponse)
def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    tx = db.query(TransactionProposal).filter(TransactionProposal.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    parsed_violations = []
    try:
        raw_v = json.loads(tx.violations)
        parsed_violations = [PolicyViolationDetail(**v) for v in raw_v]
    except Exception:
        pass

    return TransactionDecisionResponse(
        transaction_id=tx.id,
        contract_id=tx.contract_id,
        decision=DecisionType(tx.decision or "BLOCK"),
        status=TransactionStatus(tx.status),
        risk_score=tx.risk_score,
        intent_match_pct=tx.intent_match_pct,
        violations=parsed_violations,
        ai_explanation=tx.ai_explanation,
        payment_reference=tx.payment_reference,
        confirmation_token=tx.confirmation_token,
        timestamp=tx.created_at
    )
