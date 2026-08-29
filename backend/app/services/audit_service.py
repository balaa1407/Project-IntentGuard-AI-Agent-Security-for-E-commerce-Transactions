import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from backend.app.core.security import compute_hmac_signature, verify_hmac_signature
from backend.app.models.audit import AuditEvent
from backend.app.schemas.audit import AuditVerificationResponse


class AuditService:
    """
    Append-only Tamper-Evident Cryptographic Audit Ledger.
    Maintains a SHA-256 hash-chain with server-side HMAC signatures for verifiable non-repudiation.
    """

    GENESIS_HASH = "0" * 64

    @classmethod
    def _format_timestamp(cls, dt: datetime) -> str:
        """Format timestamp into a canonical UTC ISO-8601 second string."""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    @classmethod
    def _compute_event_hash(
        cls,
        sequence_number: int,
        timestamp_str: str,
        actor: str,
        contract_id: Optional[str],
        transaction_id: Optional[str],
        event_type: str,
        decision: Optional[str],
        violations_json: str,
        payload_json: str,
        previous_hash: str
    ) -> str:
        """Deterministic SHA-256 hash over canonical audit event fields."""
        content = (
            f"{sequence_number}:{timestamp_str}:{actor}:{contract_id or ''}:"
            f"{transaction_id or ''}:{event_type}:{decision or ''}:{violations_json}:"
            f"{payload_json}:{previous_hash}"
        )
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @classmethod
    def record_event(
        cls,
        db: Session,
        actor: str,
        event_type: str,
        correlation_id: str,
        contract_id: Optional[str] = None,
        transaction_id: Optional[str] = None,
        decision: Optional[str] = None,
        violations: Optional[List[Dict[str, Any]]] = None,
        payload: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Appends a new cryptographically chained audit event."""
        last_event = db.query(AuditEvent).order_by(AuditEvent.sequence_number.desc()).first()
        
        if last_event:
            seq_num = last_event.sequence_number + 1
            prev_hash = last_event.current_hash
        else:
            seq_num = 1
            prev_hash = cls.GENESIS_HASH

        now = datetime.now(timezone.utc)
        now_str = cls._format_timestamp(now)
        violations_str = json.dumps(violations or [], sort_keys=True)
        payload_str = json.dumps(payload or {}, sort_keys=True)

        current_hash = cls._compute_event_hash(
            sequence_number=seq_num,
            timestamp_str=now_str,
            actor=actor,
            contract_id=contract_id,
            transaction_id=transaction_id,
            event_type=event_type,
            decision=decision,
            violations_json=violations_str,
            payload_json=payload_str,
            previous_hash=prev_hash
        )

        signature = compute_hmac_signature(current_hash)

        event = AuditEvent(
            id=str(uuid.uuid4()),
            sequence_number=seq_num,
            timestamp=now,
            correlation_id=correlation_id,
            actor=actor,
            contract_id=contract_id,
            transaction_id=transaction_id,
            event_type=event_type,
            decision=decision,
            violations_json=violations_str,
            payload_json=payload_str,
            previous_hash=prev_hash,
            current_hash=current_hash,
            hmac_signature=signature
        )

        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @classmethod
    def verify_chain_integrity(cls, db: Session) -> AuditVerificationResponse:
        """
        Validates the unbroken cryptographic integrity of the entire audit chain.
        Detects any row alteration, sequence skipping, deletion, or forgery.
        """
        events = db.query(AuditEvent).order_by(AuditEvent.sequence_number.asc()).all()
        now = datetime.now(timezone.utc)

        if not events:
            return AuditVerificationResponse(
                is_valid=True,
                total_events=0,
                tampered_event_id=None,
                message="Audit ledger is empty. Chain is trivially valid.",
                verified_at=now
            )

        expected_prev_hash = cls.GENESIS_HASH
        expected_seq = 1

        for ev in events:
            # 1. Monotonic sequence check
            if ev.sequence_number != expected_seq:
                return AuditVerificationResponse(
                    is_valid=False,
                    total_events=len(events),
                    tampered_event_id=ev.id,
                    message=f"Sequence broken: expected #{expected_seq}, found #{ev.sequence_number}.",
                    verified_at=now
                )

            # 2. Previous hash link check
            if ev.previous_hash != expected_prev_hash:
                return AuditVerificationResponse(
                    is_valid=False,
                    total_events=len(events),
                    tampered_event_id=ev.id,
                    message=f"Hash chain broken at event #{ev.sequence_number} ({ev.id}). Previous hash mismatch.",
                    verified_at=now
                )

            # 3. Recompute current hash
            recomputed = cls._compute_event_hash(
                sequence_number=ev.sequence_number,
                timestamp_str=cls._format_timestamp(ev.timestamp),
                actor=ev.actor,
                contract_id=ev.contract_id,
                transaction_id=ev.transaction_id,
                event_type=ev.event_type,
                decision=ev.decision,
                violations_json=ev.violations_json or "[]",
                payload_json=ev.payload_json or "{}",
                previous_hash=ev.previous_hash
            )

            if ev.current_hash != recomputed:
                return AuditVerificationResponse(
                    is_valid=False,
                    total_events=len(events),
                    tampered_event_id=ev.id,
                    message=f"Cryptographic hash invalid at event #{ev.sequence_number} ({ev.id}). Content has been modified.",
                    verified_at=now
                )

            # 4. Signature verification
            if not verify_hmac_signature(ev.current_hash, ev.hmac_signature):
                return AuditVerificationResponse(
                    is_valid=False,
                    total_events=len(events),
                    tampered_event_id=ev.id,
                    message=f"HMAC signature invalid at event #{ev.sequence_number} ({ev.id}).",
                    verified_at=now
                )

            expected_prev_hash = ev.current_hash
            expected_seq += 1

        return AuditVerificationResponse(
            is_valid=True,
            total_events=len(events),
            tampered_event_id=None,
            message=f"Cryptographic integrity verified across {len(events)} append-only audit events.",
            verified_at=now
        )
