from decimal import Decimal

import httpx

from app.config import get_settings
from app.core.exceptions import AppError
from app.models.customer import Customer
from app.models.loan_application import LoanApplication


def build_ml_payload(loan: LoanApplication, customer: Customer) -> dict:
    age = customer.age
    if age is None and customer.date_of_birth is not None:
        from datetime import date

        today = date.today()
        born = customer.date_of_birth
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return {
        "age": int(age or 30),
        "occupation": customer.occupation,
        "monthly_income": float(loan.monthly_income),
        "years_employed": float(loan.years_employed),
        "requested_amount": float(loan.requested_amount),
        "term_months": int(loan.term_months),
        "purpose": loan.purpose,
        "current_debt": float(loan.current_debt),
        "existing_loans": int(loan.existing_loans),
        "late_payments": int(loan.late_payments),
        "credit_history": loan.credit_history,
        "dti": float(loan.dti or 0),
    }


def score_loan(loan: LoanApplication, customer: Customer) -> dict:
    settings = get_settings()
    payload = build_ml_payload(loan, customer)
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(f"{settings.ml_service_url}/predict", json=payload)
    except httpx.RequestError as exc:
        raise AppError(f"Không kết nối được ML Service: {exc}", status_code=500, code="ML_UNAVAILABLE") from exc

    if response.status_code >= 400:
        detail = response.text
        raise AppError(f"ML Service trả lỗi: {detail}", status_code=500, code="ML_ERROR")
    return response.json()


def decimal_safe(value) -> Decimal:
    return Decimal(str(round(float(value), 6)))
