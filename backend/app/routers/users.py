from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, NotFoundError
from app.core.roles import ADMIN, ALL_ROLES
from app.core.security import hash_password
from app.database import get_db
from app.dependencies import require_roles
from app.models.user import User
from app.schemas.common import Paginated
from app.schemas.user import UserCreate, UserPublic, UserUpdate
from app.services.audit import write_audit

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=Paginated[UserPublic])
def list_users(
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN)),
):
    query = db.query(User)
    if q:
        like = f"%{q}%"
        query = query.filter((User.email.ilike(like)) | (User.full_name.ilike(like)))
    total = query.count()
    items = query.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Paginated(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=UserPublic, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN)),
):
    if payload.role not in ALL_ROLES:
        raise AppError("Vai trò không hợp lệ", 400)
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise AppError("Email đã tồn tại", 400)
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    write_audit(db, user=current, action="CREATE_USER", entity_type="user", entity_id=user.id)
    return user


@router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise NotFoundError("Không tìm thấy người dùng")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.hashed_password = hash_password(data.pop("password"))
    if "role" in data and data["role"] and data["role"] not in ALL_ROLES:
        raise AppError("Vai trò không hợp lệ", 400)
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    write_audit(db, user=current, action="UPDATE_USER", entity_type="user", entity_id=user.id)
    return user
