import uuid
from datetime import datetime, timedelta, timezone
import pytest
from backend.app.core.security import compute_canonical_sha256, compute_hmac_signature
from backend.app.models.contract import AuthorizationContract
from backend.app.schemas.common import ContractStatus, DecisionType, PolicyViolationCode, SellerTrustLevel
from backend.app.schemas.transaction import TransactionSubmitRequest
from backend.app.services.policy_engine import PolicyEngine


def create_mock_contract(
    category: str = "gaming laptop",
    max_price: float = 80000.0,
    ram_min: int = 16,
    seller_requirement: str = "trusted",
    max_quantity: int = 1,
    status: str = ContractStatus.ACTIVE.value,
    expired: bool = False
) -> AuthorizationContract:
    contract_data = {
        "user_id": "test-user-01",
        "category": category,
        "max_price": max_price,
        "currency": "INR",
        "ram_min": ram_min,
        "seller_requirement": seller_requirement,
        "max_quantity": max_quantity
    }
    h = compute_canonical_sha256(contract_data)
    sig = compute_hmac_signature(h)

    now = datetime.now(timezone.utc)
    expires_at = now - timedelta(hours=1) if expired else now + timedelta(hours=2)

    return AuthorizationContract(
        id=str(uuid.uuid4()),
        user_id="test-user-01",
        natural_language_prompt="Buy a gaming laptop under ₹80k, min 16GB RAM, trusted seller",
        category=category,
        max_price=max_price,
        currency="INR",
        ram_min=ram_min,
        seller_requirement=seller_requirement,
        max_quantity=max_quantity,
        status=status,
        hash_fingerprint=h,
        signature=sig,
        created_at=now,
        expires_at=expires_at
    )


def test_core_gaming_laptop_scenario_rejection():
    """
    MASTER SCENARIO:
    Customer authorizes: Gaming laptop <= ₹80,000, >= 16 GB RAM, verified/trusted seller.
    Agent attempts: ₹89,999 laptop with 8 GB RAM from unverified seller.
    Expected: REJECTED (BLOCK) with exact 3 violated constraints.
    """
    contract = create_mock_contract()

    attempt = TransactionSubmitRequest(
        contract_id=contract.id,
        idempotency_key="idemp-core-001",
        agent_id="agent-007",
        merchant_name="Unknown Marketplace Vendor",
        seller_id="seller_unknown_404",
        seller_trust_level=SellerTrustLevel.UNVERIFIED,
        product_name="Budget Gaming Laptop X",
        category="gaming laptop",
        price=89999.0,
        currency="INR",
        quantity=1,
        ram_gb=8
    )

    decision, violations, risk_score, match_pct, explanation = PolicyEngine.evaluate(contract, attempt)

    assert decision == DecisionType.BLOCK
    assert risk_score >= 80
    assert match_pct < 50
    violation_codes = [v.code for v in violations]
    assert PolicyViolationCode.BUDGET_EXCEEDED in violation_codes
    assert PolicyViolationCode.PRODUCT_REQUIREMENTS_VIOLATED in violation_codes
    assert PolicyViolationCode.SELLER_NOT_TRUSTED in violation_codes
    assert "8GB RAM" in explanation or "Hardware requirement violated" in explanation


def test_perfect_match_approval():
    contract = create_mock_contract()

    attempt = TransactionSubmitRequest(
        contract_id=contract.id,
        idempotency_key="idemp-perfect-001",
        agent_id="agent-007",
        merchant_name="ASUS Official Store",
        seller_id="seller_asus_verified",
        seller_trust_level=SellerTrustLevel.VERIFIED,
        product_name="ASUS TUF Gaming Laptop A15",
        category="gaming laptop",
        price=75000.0,
        currency="INR",
        quantity=1,
        ram_gb=16
    )

    decision, violations, risk_score, match_pct, explanation = PolicyEngine.evaluate(contract, attempt)

    assert decision == DecisionType.APPROVE
    assert violations == []
    assert risk_score <= 10
    assert match_pct >= 95
    assert "strictly satisfies all authorization constraints" in explanation


def test_slight_drift_requires_confirmation():
    """Up to 10% price drift with matching specs requires explicit human confirmation."""
    contract = create_mock_contract()

    attempt = TransactionSubmitRequest(
        contract_id=contract.id,
        idempotency_key="idemp-drift-001",
        agent_id="agent-007",
        merchant_name="Lenovo Authorized Retailer",
        seller_id="seller_lenovo_official",
        seller_trust_level=SellerTrustLevel.TRUSTED,
        product_name="Lenovo Legion 5 Gaming Laptop",
        category="gaming laptop",
        price=84999.0,  # 6.2% over ₹80,000
        currency="INR",
        quantity=1,
        ram_gb=16
    )

    decision, violations, risk_score, match_pct, explanation = PolicyEngine.evaluate(contract, attempt)

    assert decision == DecisionType.REQUIRE_CONFIRMATION
    assert len(violations) == 1
    assert violations[0].code == PolicyViolationCode.BUDGET_EXCEEDED
    assert violations[0].severity == "MEDIUM"
    assert "Requires explicit customer confirmation" in explanation


def test_expired_contract_rejection():
    contract = create_mock_contract(expired=True)

    attempt = TransactionSubmitRequest(
        contract_id=contract.id,
        idempotency_key="idemp-expired-001",
        agent_id="agent-007",
        merchant_name="ASUS Official Store",
        seller_id="seller_asus_verified",
        seller_trust_level=SellerTrustLevel.VERIFIED,
        product_name="ASUS TUF Gaming Laptop",
        category="gaming laptop",
        price=75000.0,
        currency="INR",
        quantity=1,
        ram_gb=16
    )

    decision, violations, risk_score, match_pct, _ = PolicyEngine.evaluate(contract, attempt)
    assert decision == DecisionType.BLOCK
    violation_codes = [v.code for v in violations]
    assert PolicyViolationCode.MISSING_OR_EXPIRED_AUTH in violation_codes


def test_contract_tampering_detection():
    contract = create_mock_contract()
    # Malicious actor silently edits contract max_price in DB without updating hash
    contract.max_price = 150000.0

    attempt = TransactionSubmitRequest(
        contract_id=contract.id,
        idempotency_key="idemp-tamper-001",
        agent_id="agent-007",
        merchant_name="ASUS Official Store",
        seller_id="seller_asus_verified",
        seller_trust_level=SellerTrustLevel.VERIFIED,
        product_name="ASUS TUF Gaming Laptop",
        category="gaming laptop",
        price=120000.0,
        currency="INR",
        quantity=1,
        ram_gb=16
    )

    decision, violations, _, _, _ = PolicyEngine.evaluate(contract, attempt)
    assert decision == DecisionType.BLOCK
    violation_codes = [v.code for v in violations]
    assert PolicyViolationCode.CONTRACT_MODIFIED in violation_codes
