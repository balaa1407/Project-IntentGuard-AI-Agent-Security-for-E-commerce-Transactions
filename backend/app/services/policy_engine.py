from datetime import datetime, timezone
from typing import List, Tuple
from backend.app.core.config import settings
from backend.app.core.security import compute_canonical_sha256
from backend.app.models.contract import AuthorizationContract
from backend.app.schemas.common import (
    ContractStatus,
    DecisionType,
    PolicyViolationCode,
    SellerTrustLevel
)
from backend.app.schemas.transaction import (
    PolicyViolationDetail,
    TransactionSubmitRequest
)


class PolicyEngine:
    """
    100% Deterministic Policy Evaluation Engine.
    Enforces fail-closed security invariants at the boundary between shopping agent and payment rails.
    """

    @staticmethod
    def evaluate(
        contract: AuthorizationContract,
        transaction: TransactionSubmitRequest,
        policy_config: dict = None
    ) -> Tuple[DecisionType, List[PolicyViolationDetail], int, int, str]:
        """
        Evaluates a candidate transaction against an immutable authorization contract.
        Returns: (DecisionType, List[PolicyViolationDetail], risk_score, intent_match_pct, explanation)
        """
        violations: List[PolicyViolationDetail] = []
        now = datetime.now(timezone.utc)
        
        # Policy tolerance thresholds
        tolerance_pct = policy_config.get("max_price_tolerance_pct", settings.MAX_PRICE_TOLERANCE_PCT) if policy_config else settings.MAX_PRICE_TOLERANCE_PCT

        # 1. Contract State & Expiry Validation
        if contract.status != ContractStatus.ACTIVE.value:
            violations.append(PolicyViolationDetail(
                code=PolicyViolationCode.MISSING_OR_EXPIRED_AUTH,
                message=f"Contract is in '{contract.status}' state. Only ACTIVE contracts can authorize payments.",
                field="status",
                expected=ContractStatus.ACTIVE.value,
                actual=contract.status,
                severity="CRITICAL"
            ))

        contract_expires = contract.expires_at
        if contract_expires.tzinfo is None:
            contract_expires = contract_expires.replace(tzinfo=timezone.utc)

        if now > contract_expires:
            violations.append(PolicyViolationDetail(
                code=PolicyViolationCode.MISSING_OR_EXPIRED_AUTH,
                message=f"Authorization contract expired at {contract.expires_at.isoformat()}.",
                field="expires_at",
                expected="<= now()",
                actual=contract.expires_at.isoformat(),
                severity="CRITICAL"
            ))

        # 2. Cryptographic Contract Tamper Check
        contract_data = {
            "user_id": contract.user_id,
            "category": contract.category,
            "max_price": contract.max_price,
            "currency": contract.currency,
            "ram_min": contract.ram_min,
            "seller_requirement": contract.seller_requirement,
            "max_quantity": contract.max_quantity
        }
        recomputed_hash = compute_canonical_sha256(contract_data)
        if contract.hash_fingerprint != recomputed_hash:
            violations.append(PolicyViolationDetail(
                code=PolicyViolationCode.CONTRACT_MODIFIED,
                message="Cryptographic integrity verification failed: contract payload has been modified post-authorization.",
                field="hash_fingerprint",
                expected=recomputed_hash,
                actual=contract.hash_fingerprint,
                severity="CRITICAL"
            ))

        # 3. Product Category & Spec Validation
        req_cat = contract.category.lower()
        trans_cat = transaction.category.lower()
        trans_prod = transaction.product_name.lower()

        # Check category alignment
        if req_cat not in trans_cat and req_cat not in trans_prod:
            violations.append(PolicyViolationDetail(
                code=PolicyViolationCode.PRODUCT_REQUIREMENTS_VIOLATED,
                message=f"Attempted product '{transaction.product_name}' ({transaction.category}) does not match authorized category '{contract.category}'.",
                field="category",
                expected=contract.category,
                actual=f"{transaction.product_name} ({transaction.category})",
                severity="CRITICAL"
            ))

        # Hardware Specs (e.g. RAM)
        if contract.ram_min is not None:
            if transaction.ram_gb is None or transaction.ram_gb < contract.ram_min:
                violations.append(PolicyViolationDetail(
                    code=PolicyViolationCode.PRODUCT_REQUIREMENTS_VIOLATED,
                    message=f"Hardware requirement violated: item has {transaction.ram_gb or 'unspecified'}GB RAM, but minimum {contract.ram_min}GB RAM is required.",
                    field="ram_gb",
                    expected=f">= {contract.ram_min} GB",
                    actual=f"{transaction.ram_gb or 'None'} GB",
                    severity="HIGH"
                ))

        # 4. Seller Trust Validation
        req_trust = contract.seller_requirement.lower()
        if req_trust in ["trusted", "verified"]:
            if transaction.seller_trust_level not in [SellerTrustLevel.TRUSTED, SellerTrustLevel.VERIFIED]:
                violations.append(PolicyViolationDetail(
                    code=PolicyViolationCode.SELLER_NOT_TRUSTED,
                    message=f"Seller '{transaction.merchant_name}' trust level is '{transaction.seller_trust_level.value}', which fails the required '{contract.seller_requirement}' trust threshold.",
                    field="seller_trust_level",
                    expected=contract.seller_requirement,
                    actual=transaction.seller_trust_level.value,
                    severity="HIGH"
                ))

        # 5. Quantity & Single-Purchase Bounds
        if transaction.quantity > contract.max_quantity:
            violations.append(PolicyViolationDetail(
                code=PolicyViolationCode.UNAUTHORIZED_QUANTITY,
                message=f"Attempted purchase quantity ({transaction.quantity}) exceeds authorized maximum ({contract.max_quantity}).",
                field="quantity",
                expected=f"<= {contract.max_quantity}",
                actual=transaction.quantity,
                severity="HIGH"
            ))

        # 6. Budget & Price Verification
        price_drift = transaction.price - contract.max_price
        is_soft_budget_violation = False

        if price_drift > 0:
            drift_pct = price_drift / contract.max_price
            if drift_pct <= tolerance_pct:
                is_soft_budget_violation = True
                violations.append(PolicyViolationDetail(
                    code=PolicyViolationCode.BUDGET_EXCEEDED,
                    message=f"Price ₹{transaction.price:,.2f} exceeds authorized limit of ₹{contract.max_price:,.2f} by ₹{price_drift:,.2f} ({drift_pct * 100:.1f}%), within allowable review tolerance.",
                    field="price",
                    expected=f"<= ₹{contract.max_price:,.2f}",
                    actual=f"₹{transaction.price:,.2f}",
                    severity="MEDIUM"
                ))
            else:
                violations.append(PolicyViolationDetail(
                    code=PolicyViolationCode.BUDGET_EXCEEDED,
                    message=f"Price ₹{transaction.price:,.2f} exceeds authorized budget of ₹{contract.max_price:,.2f} by ₹{price_drift:,.2f} ({drift_pct * 100:.1f}%), exceeding hard threshold.",
                    field="price",
                    expected=f"<= ₹{contract.max_price:,.2f}",
                    actual=f"₹{transaction.price:,.2f}",
                    severity="CRITICAL"
                ))

        # 7. Decision Determination & Deterministic Scoring
        if not violations:
            decision = DecisionType.APPROVE
            risk_score = 5
            intent_match_pct = 98
            explanation = "Transaction strictly satisfies all authorization constraints: budget, hardware specifications, seller trust, and quantity."
        elif len(violations) == 1 and is_soft_budget_violation:
            decision = DecisionType.REQUIRE_CONFIRMATION
            risk_score = 45
            intent_match_pct = 75
            explanation = f"Transaction exceeds budget limit by ₹{price_drift:,.2f} ({price_drift/contract.max_price*100:.1f}%), but respects hardware specifications and seller trust. Requires explicit customer confirmation."
        else:
            decision = DecisionType.BLOCK
            violation_count = len(violations)
            critical_count = sum(1 for v in violations if v.severity == "CRITICAL")
            risk_score = min(100, 50 + (critical_count * 20) + (violation_count * 10))
            intent_match_pct = max(10, 100 - (violation_count * 25))
            
            reasons = "; ".join([f"{v.code.value}: {v.message}" for v in violations])
            explanation = f"Critical Authorization Drift Detected: {reasons}"

        return decision, violations, risk_score, intent_match_pct, explanation
