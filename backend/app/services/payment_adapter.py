import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.models.contract import AuthorizationContract
from backend.app.models.transaction import TransactionProposal
from backend.app.schemas.common import ContractStatus, DecisionType, TransactionStatus


class SecurityPaymentViolationError(Exception):
    pass


class SandboxedPaymentAdapter:
    """
    Sandboxed Payment Gateway Adapter for Razorpay/Mock Execution.
    Enforces idempotency, single-use contract consumption, and security assertions.
    """

    @classmethod
    def execute_payment(
        cls,
        db: Session,
        transaction: TransactionProposal,
        contract: AuthorizationContract
    ) -> dict:
        """
        Executes a payment for an approved or confirmed transaction.
        Enforces that unapproved transactions CANNOT move funds.
        """
        # Security Guardrail 1: Decision check
        if transaction.decision not in [DecisionType.APPROVE.value, DecisionType.REQUIRE_CONFIRMATION.value]:
            raise SecurityPaymentViolationError(
                f"Unauthorized Execution Attempt: Transaction {transaction.id} is in '{transaction.decision}' state."
            )

        if transaction.decision == DecisionType.REQUIRE_CONFIRMATION.value and transaction.status != TransactionStatus.CONFIRMED.value:
            raise SecurityPaymentViolationError(
                f"Confirmation Required: Transaction {transaction.id} has not been confirmed by customer."
            )

        # Security Guardrail 2: Idempotency & Duplicate Execution Protection
        if transaction.status == TransactionStatus.PAYMENT_SUCCESS.value:
            return {
                "status": "PAYMENT_SUCCESS",
                "payment_reference": transaction.payment_reference,
                "is_replay": True,
                "amount": transaction.price,
                "currency": transaction.currency,
                "message": "Payment already executed for this idempotency key."
            }

        # Security Guardrail 3: Contract single-use enforcement
        if settings.ENFORCE_SINGLE_PURCHASE:
            if contract.status == ContractStatus.CONSUMED.value and transaction.status != TransactionStatus.CONFIRMED.value:
                raise SecurityPaymentViolationError(
                    f"Contract {contract.id} has already been consumed by an earlier purchase."
                )

        # Generate sandbox payment reference
        payment_ref = f"pay_mock_rzp_{uuid.uuid4().hex[:16]}"
        now = datetime.now(timezone.utc)

        # Atomic State Transitions
        transaction.status = TransactionStatus.PAYMENT_SUCCESS.value
        transaction.payment_reference = payment_ref
        transaction.updated_at = now

        if settings.ENFORCE_SINGLE_PURCHASE:
            contract.status = ContractStatus.CONSUMED.value

        db.commit()
        db.refresh(transaction)
        db.refresh(contract)

        return {
            "status": "PAYMENT_SUCCESS",
            "payment_reference": payment_ref,
            "is_replay": False,
            "amount": transaction.price,
            "currency": transaction.currency,
            "executed_at": now.isoformat(),
            "mode": "SANDBOX",
            "message": "Sandbox payment successfully captured."
        }
