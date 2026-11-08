from decimal import Decimal

import httpx

from app.config import get_settings
from app.core.exceptions import AppError
from app.models.customer import Customer
from app.models.loan_application import LoanApplication


def build_ml_payload(loan: LoanApplication, customer: Customer) -> dict:
    raise AppError(
        "Hồ sơ cũ chưa đủ thông tin Home Credit. Dùng biểu mẫu /home-credit và bổ sung "
        "AMT_CREDIT, AMT_ANNUITY, DAYS_BIRTH, DAYS_EMPLOYED, NAME_CONTRACT_TYPE, "
        "OCCUPATION_TYPE cùng xác nhận thang tiền gốc. Không tự chuyển thu nhập tháng, kỳ hạn hoặc lịch sử trả nợ.",
        status_code=422, code="HOME_CREDIT_INPUT_REQUIRED",
    )


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


def request_home_credit(method: str, path: str, payload: dict | None = None) -> dict:
    """Forward the canonical ML contract unchanged; never build fake legacy inputs."""
    from fastapi import HTTPException

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.request(method, f"{get_settings().ml_service_url}{path}", json=payload)
    except httpx.RequestError as exc:
        raise AppError(f"Không kết nối được Home Credit ML Service: {exc}", 503, "ML_UNAVAILABLE") from exc
    if response.status_code >= 400:
        try:
            detail = response.json().get("detail", response.text)
        except ValueError:
            detail = response.text
        raise HTTPException(status_code=response.status_code if response.status_code < 500 else 503, detail=detail)
    return response.json()
