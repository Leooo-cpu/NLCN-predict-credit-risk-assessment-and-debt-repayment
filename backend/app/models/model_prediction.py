from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.types import JSONType


class ModelPrediction(Base):
    __tablename__ = "model_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    loan_application_id: Mapped[int] = mapped_column(
        ForeignKey("loan_applications.id", ondelete="CASCADE"), index=True
    )
    model_registry_id: Mapped[int | None] = mapped_column(ForeignKey("model_registry.id"), nullable=True)
    model_version: Mapped[str] = mapped_column(String(64))
    default_probability: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    repayment_probability: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    credit_score: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    risk_level: Mapped[str] = mapped_column(String(32), index=True)
    explanation_json: Mapped[dict] = mapped_column(JSONType)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    loan_application = relationship("LoanApplication", back_populates="predictions")
