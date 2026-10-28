from decimal import Decimal

from app.config import get_settings


def compute_dti(current_debt: Decimal, monthly_income: Decimal) -> Decimal:
    if monthly_income <= 0:
        return Decimal("0")
    return (Decimal(current_debt) / Decimal(monthly_income)).quantize(Decimal("0.0001"))


def simulated_credit_score(default_probability: float) -> float:
    settings = get_settings()
    score = settings.credit_score_max - settings.credit_score_range * default_probability
    return round(max(300.0, min(settings.credit_score_max, score)), 2)


def risk_level_from_probability(default_probability: float) -> str:
    settings = get_settings()
    if default_probability < settings.low_risk_threshold:
        return "LOW_RISK"
    if default_probability < settings.medium_risk_threshold:
        return "MEDIUM_RISK"
    return "HIGH_RISK"
