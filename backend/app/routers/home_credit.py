from fastapi import APIRouter, Body, Depends

from app.core.roles import ADMIN, OFFICER
from app.dependencies import require_roles
from app.services.ml_client import request_home_credit

router = APIRouter(prefix="/api/home-credit", tags=["home-credit"])


@router.get("/input-schema")
def input_schema(_=Depends(require_roles(ADMIN, OFFICER))):
    # Single source of truth is ML Service; backend/frontend do not duplicate fields.
    return request_home_credit("GET", "/model/input-schema")


@router.post("/predict")
def predict(payload: dict = Body(...), _=Depends(require_roles(ADMIN, OFFICER))):
    # This demo has a different outcome/units contract from historical synthetic loans.
    # Do not write its response into historical default/repayment fields.
    return request_home_credit("POST", "/predict", payload)


@router.get("/sample")
def sample(_=Depends(require_roles(ADMIN, OFFICER))):
    return request_home_credit("GET", "/model/sample")
