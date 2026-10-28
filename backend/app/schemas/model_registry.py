from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ModelRegistryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    model_name: str
    version: str
    algorithm: str
    training_dataset: str
    metrics_json: dict | None
    status: str
    artifact_path: str | None
    created_at: datetime
    updated_at: datetime
    credit_score_formula: str = "CreditScore = 850 - 550 * default_probability (điểm mô phỏng)"
