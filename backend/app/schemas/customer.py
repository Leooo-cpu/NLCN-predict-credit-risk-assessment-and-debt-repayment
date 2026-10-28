from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    date_of_birth: date | None = None
    age: int | None = Field(default=None, ge=18, le=90)
    occupation: str = Field(min_length=2, max_length=128)
    monthly_income: Decimal = Field(gt=0)
    years_employed: Decimal = Field(ge=0)
    credit_history: str
    late_payments: int = Field(ge=0)
    current_debt: Decimal = Field(ge=0)
    existing_loans: int = Field(ge=0)
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    date_of_birth: date | None = None
    age: int | None = Field(default=None, ge=18, le=90)
    occupation: str | None = None
    monthly_income: Decimal | None = Field(default=None, gt=0)
    years_employed: Decimal | None = Field(default=None, ge=0)
    credit_history: str | None = None
    late_payments: int | None = Field(default=None, ge=0)
    current_debt: Decimal | None = Field(default=None, ge=0)
    existing_loans: int | None = Field(default=None, ge=0)
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None


class CustomerPublic(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_simulated: bool
    created_at: datetime
    updated_at: datetime
