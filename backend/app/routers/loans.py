from decimal import Decimal
from io import StringIO

import pandas as pd
from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import AppError, NotFoundError
from app.core.roles import ADMIN, CREDIT_OFFICER, RISK_VIEWER
from app.database import get_db
from app.dependencies import require_roles
from app.models.customer import Customer
from app.models.loan_application import LoanApplication
from app.models.model_prediction import ModelPrediction
from app.models.model_registry import ModelRegistry
from app.models.user import User
from app.schemas.common import Paginated
from app.schemas.loan import (
    LoanApplicationCreate,
    LoanApplicationPublic,
    LoanApplicationUpdate,
    PredictionPublic,
    PredictionWithLoanPublic,
    ScoreResponse,
    ShapFactor,
)
from app.services.audit import write_audit
from app.services.ml_client import decimal_safe, score_loan
from app.services.risk import compute_dti, risk_level_from_probability, simulated_credit_score

router = APIRouter(prefix="/api/loan-applications", tags=["loan-applications"])


def _attach_latest(db: Session, loans: list[LoanApplication]) -> list[LoanApplication]:
    if not loans:
        return loans
    ids = [loan.id for loan in loans]
    preds = (
        db.query(ModelPrediction)
        .filter(ModelPrediction.loan_application_id.in_(ids))
        .order_by(ModelPrediction.created_at.desc())
        .all()
    )
    latest: dict[int, ModelPrediction] = {}
    for pred in preds:
        latest.setdefault(pred.loan_application_id, pred)
    for loan in loans:
        pred = latest.get(loan.id)
        loan.latest_risk_level = pred.risk_level if pred else None
        loan.latest_credit_score = pred.credit_score if pred else None
        loan.latest_default_probability = pred.default_probability if pred else None
    return loans


@router.post("", response_model=LoanApplicationPublic, status_code=201)
def create_loan(
    payload: LoanApplicationCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN, CREDIT_OFFICER)),
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if customer is None:
        raise NotFoundError("Không tìm thấy khách hàng")
    data = payload.model_dump()
    loan = LoanApplication(
        **data,
        dti=compute_dti(payload.current_debt, payload.monthly_income),
        status="SUBMITTED",
        is_simulated=True,
        created_by=current.id,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    loan.customer = customer
    write_audit(db, user=current, action="CREATE_LOAN", entity_type="loan_application", entity_id=loan.id)
    return loan


@router.get("", response_model=Paginated[LoanApplicationPublic])
def list_loans(
    q: str | None = None,
    status: str | None = None,
    risk_level: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    query = db.query(LoanApplication).options(joinedload(LoanApplication.customer))
    if q:
        query = query.join(Customer).filter(Customer.full_name.ilike(f"%{q}%"))
    if status:
        query = query.filter(LoanApplication.status == status)
    total = query.count()
    items = query.order_by(LoanApplication.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    _attach_latest(db, items)
    if risk_level:
        items = [item for item in items if item.latest_risk_level == risk_level]
        total = len(items)
    return Paginated(items=items, total=total, page=page, page_size=page_size)


@router.get("/predictions/all", response_model=Paginated[PredictionWithLoanPublic])
def list_all_predictions(
    q: str | None = None,
    risk_level: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    query = (
        db.query(ModelPrediction)
        .join(ModelPrediction.loan_application)
        .outerjoin(LoanApplication.customer)
    )
    if q:
        query = query.filter(Customer.full_name.ilike(f"%{q}%"))
    if risk_level:
        query = query.filter(ModelPrediction.risk_level == risk_level)
    total = query.count()
    items = (
        query.order_by(ModelPrediction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    results: list[PredictionWithLoanPublic] = []
    for pred in items:
        loan = pred.loan_application
        customer = loan.customer if loan else None
        shap_list = []
        if pred.explanation_json and isinstance(pred.explanation_json, dict):
            raw_shap = pred.explanation_json.get("shap_explanation", [])
            if isinstance(raw_shap, list):
                shap_list = [ShapFactor(**f) for f in raw_shap if isinstance(f, dict)]
        data = PredictionWithLoanPublic.model_validate(pred)
        data.customer_name = customer.full_name if customer else "N/A"
        data.customer_id = customer.id if customer else None
        data.requested_amount = loan.requested_amount if loan else None
        data.term_months = loan.term_months if loan else None
        data.purpose = loan.purpose if loan else None
        data.shap_explanation = shap_list
        results.append(data)
    return Paginated(items=results, total=total, page=page, page_size=page_size)


@router.get("/{loan_application_id}", response_model=LoanApplicationPublic)
def get_loan(
    loan_application_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    loan = (
        db.query(LoanApplication)
        .options(joinedload(LoanApplication.customer))
        .filter(LoanApplication.id == loan_application_id)
        .first()
    )
    if loan is None:
        raise NotFoundError("Không tìm thấy hồ sơ vay")
    _attach_latest(db, [loan])
    return loan


@router.put("/{loan_application_id}", response_model=LoanApplicationPublic)
def update_loan(
    loan_application_id: int,
    payload: LoanApplicationUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN, CREDIT_OFFICER)),
):
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_application_id).first()
    if loan is None:
        raise NotFoundError("Không tìm thấy hồ sơ vay")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(loan, key, value)
    loan.dti = compute_dti(loan.current_debt, loan.monthly_income)
    db.commit()
    db.refresh(loan)
    write_audit(db, user=current, action="UPDATE_LOAN", entity_type="loan_application", entity_id=loan.id)
    return loan


@router.post("/import", response_model=dict)
def import_loans(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN, CREDIT_OFFICER)),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise AppError("Chỉ hỗ trợ file CSV", 400)
    content = file.file.read().decode("utf-8-sig")
    frame = pd.read_csv(StringIO(content))
    required = {
        "customer_id",
        "requested_amount",
        "term_months",
        "purpose",
        "monthly_income",
        "years_employed",
        "current_debt",
        "existing_loans",
        "credit_history",
        "late_payments",
    }
    missing = required - set(frame.columns)
    if missing:
        raise AppError(f"CSV thiếu cột: {', '.join(sorted(missing))}", 400)

    created = 0
    errors: list[str] = []
    for idx, row in frame.iterrows():
        try:
            customer = db.query(Customer).filter(Customer.id == int(row["customer_id"])).first()
            if customer is None:
                errors.append(f"Dòng {idx + 2}: không có khách hàng {row['customer_id']}")
                continue
            amount = Decimal(str(row["requested_amount"]))
            income = Decimal(str(row["monthly_income"]))
            debt = Decimal(str(row["current_debt"]))
            loan = LoanApplication(
                customer_id=customer.id,
                requested_amount=amount,
                term_months=int(row["term_months"]),
                purpose=str(row["purpose"]),
                monthly_income=income,
                years_employed=Decimal(str(row["years_employed"])),
                current_debt=debt,
                existing_loans=int(row["existing_loans"]),
                dti=compute_dti(debt, income),
                credit_history=str(row["credit_history"]),
                late_payments=int(row["late_payments"]),
                status="SUBMITTED",
                is_simulated=True,
                created_by=current.id,
                notes="Import CSV - dữ liệu mô phỏng",
            )
            db.add(loan)
            created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Dòng {idx + 2}: {exc}")
    db.commit()
    write_audit(
        db,
        user=current,
        action="IMPORT_LOANS",
        entity_type="loan_application",
        details={"created": created, "errors": errors[:20]},
    )
    return {"created": created, "errors": errors, "note": "Dữ liệu mô phỏng"}


@router.post("/{loan_application_id}/score", response_model=ScoreResponse)
def score_application(
    loan_application_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN, CREDIT_OFFICER)),
):
    loan = (
        db.query(LoanApplication)
        .options(joinedload(LoanApplication.customer))
        .filter(LoanApplication.id == loan_application_id)
        .first()
    )
    if loan is None or loan.customer is None:
        raise NotFoundError("Không tìm thấy hồ sơ vay")

    result = score_loan(loan, loan.customer)
    default_p = float(result["default_probability"])
    risk = result.get("risk_level") or risk_level_from_probability(default_p)
    score = result.get("credit_score") or simulated_credit_score(default_p)
    model_version = result.get("model_version", "unknown")
    registry = db.query(ModelRegistry).filter(ModelRegistry.status == "ACTIVE").first()

    explanation = result.get("shap_explanation") or []
    prediction = ModelPrediction(
        loan_application_id=loan.id,
        model_registry_id=registry.id if registry else None,
        model_version=model_version,
        default_probability=decimal_safe(default_p),
        repayment_probability=decimal_safe(result.get("repayment_probability", 1 - default_p)),
        credit_score=decimal_safe(score),
        risk_level=risk,
        explanation_json={"shap_explanation": explanation, "raw": result},
        created_by=current.id,
    )
    db.add(prediction)
    loan.status = "SCORED"
    db.commit()
    db.refresh(prediction)
    write_audit(
        db,
        user=current,
        action="SCORE_LOAN",
        entity_type="loan_application",
        entity_id=loan.id,
        details={"prediction_id": prediction.id, "risk_level": risk},
    )
    factors = [ShapFactor(**item) for item in explanation]
    return ScoreResponse(
        **PredictionPublic.model_validate(prediction).model_dump(),
        shap_explanation=factors,
    )


@router.get("/{loan_application_id}/predictions", response_model=list[PredictionPublic])
def list_predictions(
    loan_application_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_application_id).first()
    if loan is None:
        raise NotFoundError("Không tìm thấy hồ sơ vay")
    return (
        db.query(ModelPrediction)
        .filter(ModelPrediction.loan_application_id == loan_application_id)
        .order_by(ModelPrediction.created_at.desc())
        .all()
    )
