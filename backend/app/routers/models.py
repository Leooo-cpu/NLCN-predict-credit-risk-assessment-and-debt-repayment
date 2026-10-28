from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.roles import ADMIN, CREDIT_OFFICER, RISK_VIEWER
from app.database import get_db
from app.dependencies import require_roles
from app.models.model_registry import ModelRegistry
from app.models.user import User
from app.schemas.model_registry import ModelRegistryPublic

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("/current", response_model=ModelRegistryPublic)
def current_model(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    model = (
        db.query(ModelRegistry)
        .filter(ModelRegistry.status == "ACTIVE")
        .order_by(ModelRegistry.created_at.desc())
        .first()
    )
    if model is None:
        raise NotFoundError("Chưa có mô hình ACTIVE")
    return model


@router.get("", response_model=list[ModelRegistryPublic])
def list_models(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    return db.query(ModelRegistry).order_by(ModelRegistry.created_at.desc()).all()
