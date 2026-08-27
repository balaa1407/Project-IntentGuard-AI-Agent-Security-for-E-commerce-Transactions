import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text
from backend.app.db.session import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sequence_number = Column(Integer, primary_key=False, autoincrement=True, unique=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    correlation_id = Column(String(64), index=True, nullable=False)
    actor = Column(String(100), nullable=False)
    contract_id = Column(String(36), nullable=True, index=True)
    transaction_id = Column(String(36), nullable=True, index=True)
    event_type = Column(String(50), nullable=False)
    decision = Column(String(30), nullable=True)
    violations_json = Column(Text, nullable=True)
    payload_json = Column(Text, nullable=True)
    previous_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False)
    hmac_signature = Column(String(64), nullable=False)
