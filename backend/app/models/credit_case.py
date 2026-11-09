"""Home Credit records retain their own units/outcome, without legacy placeholders."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.types import JSONType


class CreditCase(Base):
    __tablename__ = "credit_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_application_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), index=True)
    source: Mapped[str] = mapped_column(String(128))
    inputs_json: Mapped[dict] = mapped_column(JSONType)
    input_revision: Mapped[int] = mapped_column(Integer, default=1)
    reference_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    predictions = relationship("CreditPrediction", back_populates="case", cascade="all, delete-orphan")


class CreditPrediction(Base):
    __tablename__ = "credit_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("credit_cases.id", ondelete="CASCADE"), index=True)
    input_revision: Mapped[int] = mapped_column(Integer)
    inputs_snapshot: Mapped[dict] = mapped_column(JSONType)
    model_version: Mapped[str] = mapped_column(String(64))
    algorithm: Mapped[str] = mapped_column(String(64))
    data_source: Mapped[str] = mapped_column(String(255))
    payment_difficulty_probability: Mapped[Decimal] = mapped_column(Numeric(12, 10))
    predicted_payment_difficulty: Mapped[bool] = mapped_column(Boolean)
    classification_threshold: Mapped[Decimal] = mapped_column(Numeric(12, 10))
    risk_level: Mapped[str] = mapped_column(String(32))
    credit_score: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    response_json: Mapped[dict] = mapped_column(JSONType)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    case = relationship("CreditCase", back_populates="predictions")
