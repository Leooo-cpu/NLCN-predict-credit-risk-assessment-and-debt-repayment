from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    artifact_dir: str = str(Path(__file__).resolve().parents[1] / "artifacts")
    pipeline_filename: str = "credit_pipeline.joblib"
    metadata_filename: str = "model_metadata.json"
    low_risk_threshold: float = 0.20
    medium_risk_threshold: float = 0.45
    credit_score_max: float = 850.0
    credit_score_range: float = 550.0
    shap_top_k: int = 7

    @property
    def pipeline_path(self) -> Path:
        return Path(self.artifact_dir) / self.pipeline_filename

    @property
    def metadata_path(self) -> Path:
        return Path(self.artifact_dir) / self.metadata_filename


@lru_cache
def get_settings() -> Settings:
    return Settings()
