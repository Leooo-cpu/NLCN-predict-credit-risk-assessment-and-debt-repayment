from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    age: int = Field(ge=18, le=90)
    occupation: str
    monthly_income: float = Field(gt=0)
    years_employed: float = Field(ge=0)
    requested_amount: float = Field(gt=0)
    term_months: int = Field(ge=3, le=360)
    purpose: str
    current_debt: float = Field(ge=0)
    existing_loans: int = Field(ge=0)
    late_payments: int = Field(ge=0)
    credit_history: str
    dti: float | None = None


class ShapFactor(BaseModel):
    feature_name: str
    feature_value: float | str | None
    shap_value: float
    impact: str
    description: str


class PredictResponse(BaseModel):
    default_probability: float
    repayment_probability: float
    risk_level: str
    credit_score: float
    shap_explanation: list[ShapFactor]
    model_version: str
    algorithm: str
    credit_score_is_simulated: bool = True
    data_note: str = "Dữ liệu mô phỏng"
    disclaimer: str = (
        "Kết quả chỉ mang tính hỗ trợ đánh giá rủi ro, không thay thế quyết định cấp tín dụng thực tế."
    )
