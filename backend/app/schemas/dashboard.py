from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class RiskCount(BaseModel):
    risk_level: str
    count: int


class StatusCount(BaseModel):
    status: str
    count: int


class TimeCount(BaseModel):
    date: str
    count: int


class ScoreBucket(BaseModel):
    bucket: str
    count: int


class HighRiskLoan(BaseModel):
    loan_application_id: int
    customer_name: str
    requested_amount: Decimal
    risk_level: str
    credit_score: Decimal
    default_probability: Decimal
    created_at: datetime


class DashboardSummary(BaseModel):
    total_applications: int
    total_customers: int
    risk_counts: list[RiskCount]
    status_counts: list[StatusCount]
    applications_over_time: list[TimeCount]
    credit_score_distribution: list[ScoreBucket]
    recent_high_risk: list[HighRiskLoan]
    disclaimer: str
    data_note: str
