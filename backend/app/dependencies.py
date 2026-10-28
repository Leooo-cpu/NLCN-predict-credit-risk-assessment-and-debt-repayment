from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.roles import ALL_ROLES
from app.core.security import decode_token
from app.database import get_db
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Thiếu token xác thực")
    payload = decode_token(credentials.credentials)
    email = payload.get("sub")
    if not email:
        raise UnauthorizedError("Token không chứa thông tin người dùng")
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise UnauthorizedError("Tài khoản không tồn tại hoặc đã bị khóa")
    return user


def require_roles(*roles: str):
    allowed = set(roles) or ALL_ROLES

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise ForbiddenError("Vai trò hiện tại không được phép truy cập API này")
        return user

    return checker


def client_ip(x_forwarded_for: str | None = Header(default=None)) -> str | None:
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return None
