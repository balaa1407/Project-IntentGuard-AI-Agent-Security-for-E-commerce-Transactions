from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_db, get_current_user
from backend.app.core.security import create_access_token, verify_password, get_password_hash
from backend.app.models.user import User
from backend.app.schemas.auth import LoginRequest, Token, UserResponse
from backend.app.schemas.common import UserRole

router = APIRouter()


@router.post("/login", response_model=Token)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Auto-seed standard demo accounts if not exist
        role = UserRole.SECURITY_OPERATOR.value
        if "admin" in req.email:
            role = UserRole.ADMIN.value
        elif "auditor" in req.email:
            role = UserRole.AUDITOR.value
        elif "agent" in req.email:
            role = UserRole.AGENT.value

        user = User(
            email=req.email,
            hashed_password=get_password_hash(req.password),
            full_name=req.email.split("@")[0].replace(".", " ").title(),
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    token = create_access_token(subject=user.email, role=user.role)
    return Token(
        access_token=token,
        token_type="bearer",
        user_role=user.role,
        user_email=user.email,
        user_name=user.full_name
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return user
