import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey
from backend.app.db.session import Base
from backend.app.schemas.common import TransactionStatus


class TransactionProposal(Base):
    __tablename__ = "transaction_proposals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    contract_id = Column(String(36), ForeignKey("authorization_contracts.id"), nullable=False, index=True)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=False)
    agent_id = Column(String(100), nullable=False)
    merchant_name = Column(String(200), nullable=False)
    seller_id = Column(String(100), nullable=False)
    seller_trust_level = Column(String(50), nullable=False)
    product_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    price = Column(Float, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    ram_gb = Column(Integer, nullable=True)
    status = Column(String(40), default=TransactionStatus.SUBMITTED.value, nullable=False)
    decision = Column(String(40), nullable=True)
    risk_score = Column(Integer, default=0, nullable=False)
    intent_match_pct = Column(Integer, default=0, nullable=False)
    violations = Column(Text, default="[]", nullable=False)
    ai_explanation = Column(Text, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    confirmation_token = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
