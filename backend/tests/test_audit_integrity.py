import uuid
from backend.app.models.audit import AuditEvent
from backend.app.services.audit_service import AuditService


def test_audit_hash_chain_validity(db_session):
    corr_id = str(uuid.uuid4())
    ev1 = AuditService.record_event(
        db=db_session,
        actor="user@test.internal",
        event_type="CONTRACT_AUTHORIZED",
        correlation_id=corr_id,
        contract_id="contract-001",
        payload={"action": "authorized"}
    )
    ev2 = AuditService.record_event(
        db=db_session,
        actor="policy_engine",
        event_type="POLICY_EVALUATION",
        correlation_id=corr_id,
        contract_id="contract-001",
        transaction_id="tx-001",
        decision="APPROVE",
        payload={"price": 75000}
    )
    ev3 = AuditService.record_event(
        db=db_session,
        actor="payment_adapter",
        event_type="PAYMENT_CAPTURED",
        correlation_id=corr_id,
        contract_id="contract-001",
        transaction_id="tx-001",
        decision="SUCCESS",
        payload={"payment_ref": "pay_mock_123"}
    )

    assert ev1.sequence_number == 1
    assert ev1.previous_hash == AuditService.GENESIS_HASH
    assert ev2.sequence_number == 2
    assert ev2.previous_hash == ev1.current_hash
    assert ev3.sequence_number == 3
    assert ev3.previous_hash == ev2.current_hash

    # Verification passes for intact chain
    verification = AuditService.verify_chain_integrity(db_session)
    assert verification.is_valid is True
    assert verification.total_events == 3
    assert verification.tampered_event_id is None


def test_audit_tamper_detection(db_session):
    corr_id = str(uuid.uuid4())
    AuditService.record_event(
        db=db_session,
        actor="user@test.internal",
        event_type="CONTRACT_AUTHORIZED",
        correlation_id=corr_id,
        contract_id="contract-001"
    )
    ev2 = AuditService.record_event(
        db=db_session,
        actor="policy_engine",
        event_type="POLICY_EVALUATION",
        correlation_id=corr_id,
        contract_id="contract-001",
        transaction_id="tx-001",
        decision="BLOCK"
    )

    # Malicious SQL modification: attacker flips decision to APPROVE
    ev2.decision = "APPROVE"
    db_session.commit()

    # Integrity verification must catch the discrepancy
    verification = AuditService.verify_chain_integrity(db_session)
    assert verification.is_valid is False
    assert verification.tampered_event_id == ev2.id
    assert "Cryptographic hash invalid" in verification.message
