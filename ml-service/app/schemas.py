from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, create_model, model_validator

from app.home_credit_features import FEATURES, FEATURE_SPEC, frame_from_values


class _HomeCreditInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    amount_unit: Literal["HOME_CREDIT_SOURCE"] = Field(
        description="Xác nhận thang tiền gốc Home Credit; không tự đổi từ VND hoặc thu nhập tháng."
    )

    @model_validator(mode="after")
    def validate_contract(self):
        frame_from_values(self.model_dump())
        return self


def _field(name):
    spec = FEATURE_SPEC[name]
    kind = {"number": float, "integer": int, "string": str}[spec["kind"]]
    if spec["nullable"]:
        kind = kind | None
    return kind, Field(..., description=f"{spec['label']}; {spec['unit']}. Null chỉ khi không biết và trường cho phép.")


# Every key is required. Explicit null is allowed only where the shared contract permits it.
PredictRequest = create_model("PredictRequest", __base__=_HomeCreditInput, **{name: _field(name) for name in FEATURES})


class PredictResponse(BaseModel):
    payment_difficulty_probability: float
    other_outcome_probability: float
    predicted_payment_difficulty: bool
    classification_threshold: float
    risk_level: str = "NOT_VALIDATED"
    risk_bands_validated: bool = False
    credit_score: float
    credit_score_is_simulated: bool = True
    model_version: str
    algorithm: str
    data_source: str
    outcome_definition: str
    probability_calibrated: bool = False
    imputed_features: list[str]
    shap_explanation: list[dict] = Field(default_factory=list)
    explanation_note: str = "Chưa triển khai SHAP cho hợp đồng Home Credit; không dùng heuristic mô phỏng."
    disclaimer: str = "Ước lượng sự kiện TARGET=1 của Home Credit; 1-p không phải bảo đảm trả nợ đầy đủ. Điểm chỉ minh họa."
