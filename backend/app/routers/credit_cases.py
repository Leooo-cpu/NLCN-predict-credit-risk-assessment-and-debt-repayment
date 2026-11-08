from copy import deepcopy

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast, or_, update, func
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import AppError, NotFoundError
from app.core.roles import ADMIN, CREDIT_OFFICER, RISK_VIEWER
from app.database import get_db
from app.dependencies import require_roles
from app.models.credit_case import CreditCase, CreditPrediction
from app.schemas.common import Paginated
from app.schemas.credit_case import CreditCaseCreate, CreditCasePublic, CreditCaseUpdate, CreditCaseScore, CreditPredictionPublic
from app.services.audit import write_audit
from app.services.ml_client import request_home_credit

router = APIRouter(prefix="/api/credit-cases", tags=["customer-credit-assessments"])
read = require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)
write = require_roles(ADMIN, CREDIT_OFFICER)


def get_case(db, case_id):
    case = db.get(CreditCase, case_id)
    if case is None:
        raise NotFoundError("Không tìm thấy hồ sơ khách hàng")
    return case


def public_case(db, case):
    result = CreditCasePublic.model_validate(case)
    latest = db.query(CreditPrediction).filter_by(case_id=case.id).order_by(CreditPrediction.id.desc()).first()
    result.latest_prediction = CreditPredictionPublic.model_validate(latest) if latest else None
    return result


@router.get("", response_model=Paginated[CreditCasePublic])
def list_cases(q: str | None = None, predicted: bool | None = None,
               page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
               db: Session = Depends(get_db), _=Depends(read)):
    query = db.query(CreditCase)
    if q:
        query = query.filter(or_(CreditCase.display_name.ilike(f"%{q}%"), cast(CreditCase.source_application_id, String).ilike(f"%{q}%")))
    if predicted is not None:
        query = query.filter(CreditCase.predictions.any() if predicted else ~CreditCase.predictions.any())
    total = query.count()
    cases = query.order_by(CreditCase.id).offset((page - 1) * page_size).limit(page_size).all()
    ids = [case.id for case in cases]
    latest = {}
    for prediction in db.query(CreditPrediction).filter(CreditPrediction.case_id.in_(ids)).order_by(CreditPrediction.id.desc()).all():
        latest.setdefault(prediction.case_id, prediction)
    results = []
    for case in cases:
        item = CreditCasePublic.model_validate(case)
        item.latest_prediction = CreditPredictionPublic.model_validate(latest[case.id]) if case.id in latest else None
        results.append(item)
    return Paginated(items=results, total=total, page=page, page_size=page_size)


@router.get("/predictions")
def list_predictions(q: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                     db: Session = Depends(get_db), _=Depends(read)):
    query = db.query(CreditPrediction).join(CreditCase)
    if q:
        query = query.filter(CreditCase.display_name.ilike(f"%{q}%"))
    total = query.count()
    rows = query.options(joinedload(CreditPrediction.case)).order_by(CreditPrediction.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [{**CreditPredictionPublic.model_validate(row).model_dump(), "display_name": row.case.display_name,
                       "source_application_id": row.case.source_application_id} for row in rows],
            "total": total, "page": page, "page_size": page_size}


@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(read)):
    return {"total_cases": db.query(CreditCase).count(),
            "total_predictions": db.query(CreditPrediction).count(),
            "assessed_cases": db.query(func.count(func.distinct(CreditPrediction.case_id))).scalar(),
            "source": "Home Credit Default Risk / application_train.csv",
            "reference_target_counts": {str(label): count for label, count in db.query(CreditCase.reference_target, func.count(CreditCase.id)).group_by(CreditCase.reference_target).all()},
            "identity_note": "Home Credit không công bố họ tên; mỗi bản ghi là một hồ sơ SK_ID_CURR, không khẳng định danh tính khách hàng."}


@router.post("", response_model=CreditCasePublic, status_code=201)
def create_case(payload: CreditCaseCreate, db: Session = Depends(get_db), current=Depends(write)):
    validated = request_home_credit("POST", "/validate", payload.inputs)["inputs"]
    case = CreditCase(display_name=payload.display_name.strip(), source="user_supplied", inputs_json=validated)
    if not case.display_name:
        raise AppError("Cần nhập tên hoặc mã khách hàng", 422)
    db.add(case)
    db.commit()
    db.refresh(case)
    write_audit(db, user=current, action="CREATE_CREDIT_CASE", entity_type="credit_case", entity_id=case.id)
    return public_case(db, case)


@router.get("/{case_id}", response_model=CreditCasePublic)
def read_case(case_id: int, db: Session = Depends(get_db), _=Depends(read)):
    return public_case(db, get_case(db, case_id))


@router.put("/{case_id}/inputs", response_model=CreditCasePublic)
def save_inputs(case_id: int, payload: CreditCaseUpdate, db: Session = Depends(get_db), current=Depends(write)):
    get_case(db, case_id)
    validated = request_home_credit("POST", "/validate", payload.inputs)["inputs"]
    changed = db.execute(update(CreditCase).where(CreditCase.id == case_id, CreditCase.input_revision == payload.expected_revision)
                         .values(inputs_json=validated, input_revision=CreditCase.input_revision + 1))
    if changed.rowcount != 1:
        db.rollback()
        raise AppError("Hồ sơ đã thay đổi. Tải lại trước khi lưu hoặc dự đoán.", 409, "STALE_CREDIT_INPUT")
    db.commit()
    db.expire_all()
    write_audit(db, user=current, action="UPDATE_CREDIT_INPUTS", entity_type="credit_case", entity_id=case_id)
    return public_case(db, get_case(db, case_id))


@router.post("/{case_id}/score", response_model=CreditPredictionPublic, status_code=201)
def score_case(case_id: int, payload: CreditCaseScore, db: Session = Depends(get_db), current=Depends(write)):
    case = get_case(db, case_id)
    if case.input_revision != payload.expected_revision:
        raise AppError("Đầu vào đã thay đổi. Tải lại hồ sơ trước khi dự đoán.", 409, "STALE_CREDIT_INPUT")
    inputs = deepcopy(case.inputs_json)
    result = request_home_credit("POST", "/predict", inputs)
    # The label/identifier never enter the model payload; only the saved inputs do.
    if not result.get("data_source", "").startswith("Home Credit") or result.get("risk_level") != "NOT_VALIDATED":
        raise AppError("ML Service trả nguồn mô hình hoặc quy tắc phân nhóm không tương thích", 503)
    db.refresh(case)
    if case.input_revision != payload.expected_revision:
        raise AppError("Hồ sơ thay đổi trong khi dự đoán; chưa lưu kết quả. Hãy thử lại.", 409, "STALE_CREDIT_INPUT")
    prediction = CreditPrediction(
        case_id=case.id, input_revision=payload.expected_revision, inputs_snapshot=inputs,
        model_version=result["model_version"], algorithm=result["algorithm"], data_source=result["data_source"],
        payment_difficulty_probability=result["payment_difficulty_probability"],
        predicted_payment_difficulty=result["predicted_payment_difficulty"], classification_threshold=result["classification_threshold"],
        risk_level=result["risk_level"], credit_score=result["credit_score"], response_json=result, created_by=current.id,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    write_audit(db, user=current, action="SCORE_CREDIT_CASE", entity_type="credit_case", entity_id=case.id,
                details={"prediction_id": prediction.id, "model_version": prediction.model_version, "input_revision": prediction.input_revision})
    return prediction


@router.get("/{case_id}/predictions", response_model=list[CreditPredictionPublic])
def case_history(case_id: int, db: Session = Depends(get_db), _=Depends(read)):
    get_case(db, case_id)
    return db.query(CreditPrediction).filter_by(case_id=case_id).order_by(CreditPrediction.id.desc()).all()
