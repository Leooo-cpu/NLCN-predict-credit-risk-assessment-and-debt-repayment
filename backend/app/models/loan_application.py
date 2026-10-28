from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    requested_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    term_months: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(String(64))
    monthly_income: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    years_employed: Mapped[Decimal] = mapped_column(Numeric(6, 1), default=0)
    current_debt: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    existing_loans: Mapped[int] = mapped_column(Integer, default=0)
    dti: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    credit_history: Mapped[str] = mapped_column(String(32))
    late_payments: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", index=True)
    notes: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer = relationship("Customer", back_populates="loan_applications")
    predictions = relationship("ModelPrediction", back_populates="loan_application", cascade="all, delete-orphan")
