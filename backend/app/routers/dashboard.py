from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.core.roles import ADMIN, CREDIT_OFFICER, RISK_VIEWER
from app.database import get_db
from app.dependencies import require_roles
from app.models.customer import Customer
from app.models.loan_application import LoanApplication
from app.models.model_prediction import ModelPrediction
from app.models.user import User
from app.schemas.dashboard import (
    DashboardSummary,
    HighRiskLoan,
    RiskCount,
    ScoreBucket,
    StatusCount,
    TimeCount,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DISCLAIMER = "Kết quả chỉ mang tính hỗ trợ đánh giá rủi ro, không thay thế quyết định cấp tín dụng thực tế."


@router.get("/summary", response_model=DashboardSummary)
def summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    total_applications = db.query(func.count(LoanApplication.id)).scalar() or 0
    total_customers = db.query(func.count(Customer.id)).scalar() or 0

    latest_sub = (
        db.query(
            ModelPrediction.loan_application_id.label("loan_id"),
            func.max(ModelPrediction.id).label("max_id"),
        )
        .group_by(ModelPrediction.loan_application_id)
        .subquery()
    )
    latest = (
        db.query(ModelPrediction)
        .join(latest_sub, ModelPrediction.id == latest_sub.c.max_id)
        .all()
    )

    risk_map = {"LOW_RISK": 0, "MEDIUM_RISK": 0, "HIGH_RISK": 0}
    buckets = {"300-499": 0, "500-649": 0, "650-749": 0, "750-850": 0}
    for pred in latest:
        risk_map[pred.risk_level] = risk_map.get(pred.risk_level, 0) + 1
        score = float(pred.credit_score)
        if score < 500:
            buckets["300-499"] += 1
        elif score < 650:
            buckets["500-649"] += 1
        elif score < 750:
            buckets["650-749"] += 1
        else:
            buckets["750-850"] += 1

    status_rows = (
        db.query(LoanApplication.status, func.count(LoanApplication.id))
        .group_by(LoanApplication.status)
        .all()
    )
    time_rows = (
        db.query(func.date(LoanApplication.created_at), func.count(LoanApplication.id))
        .group_by(func.date(LoanApplication.created_at))
        .order_by(func.date(LoanApplication.created_at))
        .all()
    )

    high_risk_rows = (
        db.query(ModelPrediction, LoanApplication, Customer)
        .join(LoanApplication, LoanApplication.id == ModelPrediction.loan_application_id)
        .join(Customer, Customer.id == LoanApplication.customer_id)
        .filter(ModelPrediction.risk_level == "HIGH_RISK")
        .order_by(ModelPrediction.created_at.desc())
        .limit(8)
        .all()
    )

    def _as_date(value) -> str:
        if value is None:
            return ""
        if isinstance(value, datetime):
            return value.date().isoformat()
        return str(value)

    return DashboardSummary(
        total_applications=total_applications,
        total_customers=total_customers,
        risk_counts=[RiskCount(risk_level=k, count=v) for k, v in risk_map.items()],
        status_counts=[StatusCount(status=s, count=c) for s, c in status_rows],
        applications_over_time=[TimeCount(date=_as_date(d), count=c) for d, c in time_rows],
        credit_score_distribution=[ScoreBucket(bucket=k, count=v) for k, v in buckets.items()],
        recent_high_risk=[
            HighRiskLoan(
                loan_application_id=loan.id,
                customer_name=customer.full_name,
                requested_amount=loan.requested_amount,
                risk_level=pred.risk_level,
                credit_score=pred.credit_score,
                default_probability=pred.default_probability,
                created_at=pred.created_at,
            )
            for pred, loan, customer in high_risk_rows
        ],
        disclaimer=DISCLAIMER,
        data_note="Dữ liệu mô phỏng phục vụ demo niên luận.",
    )
