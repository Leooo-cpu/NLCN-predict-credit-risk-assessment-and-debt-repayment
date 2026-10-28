from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.customer import CustomerPublic


class LoanApplicationBase(BaseModel):
    customer_id: int
    requested_amount: Decimal = Field(gt=0)
    term_months: int = Field(ge=3, le=360)
    purpose: str
    monthly_income: Decimal = Field(gt=0)
    years_employed: Decimal = Field(ge=0)
    current_debt: Decimal = Field(ge=0)
    existing_loans: int = Field(ge=0)
    credit_history: str
    late_payments: int = Field(ge=0)
    notes: str | None = None


class LoanApplicationCreate(LoanApplicationBase):
    pass


class LoanApplicationUpdate(BaseModel):
    requested_amount: Decimal | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, ge=3, le=360)
    purpose: str | None = None
    monthly_income: Decimal | None = Field(default=None, gt=0)
    years_employed: Decimal | None = Field(default=None, ge=0)
    current_debt: Decimal | None = Field(default=None, ge=0)
    existing_loans: int | None = Field(default=None, ge=0)
    credit_history: str | None = None
    late_payments: int | None = Field(default=None, ge=0)
    status: str | None = None
    notes: str | None = None


class LoanApplicationPublic(LoanApplicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dti: Decimal | None
    status: str
    is_simulated: bool
    created_at: datetime
    updated_at: datetime
    customer: CustomerPublic | None = None
    latest_risk_level: str | None = None
    latest_credit_score: Decimal | None = None
    latest_default_probability: Decimal | None = None


class ShapFactor(BaseModel):
    feature_name: str
    feature_value: float | str | None = None
    shap_value: float
    impact: str
    description: str


class PredictionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_application_id: int
    model_version: str
    default_probability: Decimal
    repayment_probability: Decimal
    credit_score: Decimal
    risk_level: str
    explanation_json: dict
    created_at: datetime
    credit_score_is_simulated: bool = True
    disclaimer: str = (
        "Kết quả chỉ mang tính hỗ trợ đánh giá rủi ro, không thay thế quyết định cấp tín dụng thực tế."
    )


class ScoreResponse(PredictionPublic):
    shap_explanation: list[ShapFactor] = []


class PredictionWithLoanPublic(PredictionPublic):
    customer_name: str | None = None
    customer_id: int | None = None
    requested_amount: Decimal | None = None
    term_months: int | None = None
    purpose: str | None = None
    shap_explanation: list[ShapFactor] = []

