import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text
from backend.app.db.session import Base
from backend.app.schemas.common import ContractStatus


class AuthorizationContract(Base):
    __tablename__ = "authorization_contracts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    natural_language_prompt = Column(Text, nullable=False)
    category = Column(String(100), nullable=False)
    max_price = Column(Float, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    ram_min = Column(Integer, nullable=True)
    seller_requirement = Column(String(50), default="trusted", nullable=False)
    max_quantity = Column(Integer, default=1, nullable=False)
    status = Column(String(30), default=ContractStatus.ACTIVE.value, nullable=False)
    hash_fingerprint = Column(String(64), nullable=False)
    signature = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    metadata_json = Column(Text, nullable=True)
