import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text
from backend.app.db.session import Base


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    version = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    content_yaml = Column(Text, nullable=False)
    created_by = Column(String(100), default="system", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    description = Column(String(255), nullable=True)
