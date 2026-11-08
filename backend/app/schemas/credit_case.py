from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CreditPredictionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: int
    input_revision: int
    inputs_snapshot: dict
    model_version: str
    algorithm: str
    data_source: str
    payment_difficulty_probability: Decimal
    predicted_payment_difficulty: bool
    classification_threshold: Decimal
    risk_level: str
    credit_score: Decimal
    response_json: dict
    created_at: datetime


class CreditCasePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source_application_id: int | None
    display_name: str
    source: str
    inputs_json: dict
    input_revision: int
    reference_target: int | None
    created_at: datetime
    updated_at: datetime
    latest_prediction: CreditPredictionPublic | None = None


class CreditCaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=255)
    inputs: dict


class CreditCaseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=1)
    inputs: dict


class CreditCaseScore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=1)
