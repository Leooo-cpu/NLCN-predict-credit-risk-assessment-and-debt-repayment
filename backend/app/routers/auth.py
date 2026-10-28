from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, UnauthorizedError
from app.core.roles import ALL_ROLES
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services.audit import write_audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.role not in ALL_ROLES or payload.role == "ADMIN":
        raise AppError("Chỉ được tự đăng ký vai trò CREDIT_OFFICER hoặc RISK_VIEWER", 400)
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise AppError("Email đã tồn tại", 400)
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit(db, user=user, action="REGISTER", entity_type="user", entity_id=user.id)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise UnauthorizedError("Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise UnauthorizedError("Tài khoản đã bị khóa")
    token = create_access_token(user.email, user.role, extra={"uid": user.id})
    write_audit(db, user=user, action="LOGIN", entity_type="user", entity_id=user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current: User = Depends(get_current_user)):
    return current
