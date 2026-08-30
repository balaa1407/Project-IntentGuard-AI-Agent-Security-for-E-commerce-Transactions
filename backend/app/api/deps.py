import uuid
from typing import Generator, Optional
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from backend.app.core.security import decode_access_token
from backend.app.db.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.common import UserRole


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates JWT Bearer token or provides a fallback Security Operator profile for interactive demo operations.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user = db.query(User).filter(User.email == payload["sub"]).first()
            if user:
                return user

    # Default fallback user for demo operations
    default_user = db.query(User).filter(User.email == "operator@intentguard.internal").first()
    if not default_user:
        default_user = User(
            id=str(uuid.uuid4()),
            email="operator@intentguard.internal",
            hashed_password="mock-hashed-pw",
            full_name="Security Operator",
            role=UserRole.SECURITY_OPERATOR.value,
            is_active=True
        )
        db.add(default_user)
        db.commit()
        db.refresh(default_user)
    return default_user


def require_role(allowed_roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker
