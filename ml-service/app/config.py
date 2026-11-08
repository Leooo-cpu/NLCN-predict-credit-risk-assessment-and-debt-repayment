from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    artifact_dir: str = str(Path(__file__).resolve().parents[1] / "artifacts")
    # Versioned manifest is the sole serving source. Legacy risk-band environment
    # variables are ignored; Home Credit bands remain disabled pending validation.


@lru_cache
def get_settings() -> Settings:
    return Settings()
