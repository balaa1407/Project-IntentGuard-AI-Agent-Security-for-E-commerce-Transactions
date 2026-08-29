import uuid
from datetime import datetime, timezone
import pytest
from backend.app.models.contract import AuthorizationContract
from backend.app.models.transaction import TransactionProposal
from backend.app.schemas.common import ContractStatus, DecisionType, TransactionStatus
from backend.app.services.payment_adapter import SandboxedPaymentAdapter, SecurityPaymentViolationError


def test_payment_adapter_refuses_blocked_transaction(db_session):
    contract = AuthorizationContract(
        id=str(uuid.uuid4()),
        user_id="user-1",
        natural_language_prompt="prompt",
        category="laptop",
        max_price=80000.0,
        currency="INR",
        seller_requirement="trusted",
        max_quantity=1,
        status=ContractStatus.ACTIVE.value,
        hash_fingerprint="hash",
        signature="sig",
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc)
    )
    db_session.add(contract)

    blocked_tx = TransactionProposal(
        id=str(uuid.uuid4()),
        contract_id=contract.id,
        idempotency_key="idemp-blocked-01",
        agent_id="agent-01",
        merchant_name="Unknown Store",
        seller_id="seller_bad",
        seller_trust_level="unverified",
        product_name="Bad Laptop",
        category="laptop",
        price=90000.0,
        currency="INR",
        quantity=1,
        status=TransactionStatus.BLOCKED.value,
        decision=DecisionType.BLOCK.value,
        violations="[]"
    )
    db_session.add(blocked_tx)
    db_session.commit()

    with pytest.raises(SecurityPaymentViolationError) as exc_info:
        SandboxedPaymentAdapter.execute_payment(db_session, blocked_tx, contract)
    assert "Unauthorized Execution Attempt" in str(exc_info.value)


def test_payment_adapter_executes_approved_transaction(db_session):
    contract = AuthorizationContract(
        id=str(uuid.uuid4()),
        user_id="user-1",
        natural_language_prompt="prompt",
        category="laptop",
        max_price=80000.0,
        currency="INR",
        seller_requirement="trusted",
        max_quantity=1,
        status=ContractStatus.ACTIVE.value,
        hash_fingerprint="hash",
        signature="sig",
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc)
    )
    db_session.add(contract)

    approved_tx = TransactionProposal(
        id=str(uuid.uuid4()),
        contract_id=contract.id,
        idempotency_key="idemp-approved-01",
        agent_id="agent-01",
        merchant_name="Official Store",
        seller_id="seller_ok",
        seller_trust_level="verified",
        product_name="Good Laptop",
        category="laptop",
        price=75000.0,
        currency="INR",
        quantity=1,
        status=TransactionStatus.APPROVED.value,
        decision=DecisionType.APPROVE.value,
        violations="[]"
    )
    db_session.add(approved_tx)
    db_session.commit()

    result = SandboxedPaymentAdapter.execute_payment(db_session, approved_tx, contract)

    assert result["status"] == "PAYMENT_SUCCESS"
    assert result["payment_reference"].startswith("pay_mock_rzp_")
    assert approved_tx.status == TransactionStatus.PAYMENT_SUCCESS.value
    assert contract.status == ContractStatus.CONSUMED.value

    # Idempotent re-execution returns same reference without second charge
    replay = SandboxedPaymentAdapter.execute_payment(db_session, approved_tx, contract)
    assert replay["is_replay"] is True
    assert replay["payment_reference"] == result["payment_reference"]
