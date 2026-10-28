from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./credit_risk_demo.db"
    jwt_secret_key: str = "change-this-demo-secret-key-not-for-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    ml_service_url: str = "http://localhost:8001"
    seed_on_startup: bool = True

    admin_email: str = "admin@credit-risk.com"
    admin_password: str = "Admin@123456"
    admin_full_name: str = "Quản trị hệ thống"

    low_risk_threshold: float = 0.20
    medium_risk_threshold: float = 0.45
    credit_score_max: float = 850.0
    credit_score_range: float = 550.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
