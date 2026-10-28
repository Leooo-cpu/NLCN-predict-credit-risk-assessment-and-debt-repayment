from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.config import get_settings
from app.feature_map import human_feature_name, impact_description
from app.schemas import PredictRequest, PredictResponse, ShapFactor

NUMERIC_FEATURES = [
    "age",
    "monthly_income",
    "years_employed",
    "requested_amount",
    "term_months",
    "current_debt",
    "existing_loans",
    "late_payments",
    "dti",
    "loan_to_income",
    "debt_burden",
]
CATEGORICAL_FEATURES = ["occupation", "credit_history", "purpose"]


_PIPELINE = None
_METADATA: dict = {}


def _ensure_loaded():
    global _PIPELINE, _METADATA
    settings = get_settings()
    if _PIPELINE is None:
        if not settings.pipeline_path.exists():
            from training.train import train_and_export

            train_and_export(settings.artifact_dir)
        _PIPELINE = joblib.load(settings.pipeline_path)
        if settings.metadata_path.exists():
            _METADATA = json.loads(settings.metadata_path.read_text(encoding="utf-8"))
        else:
            _METADATA = {"version": "1.0.0-sim", "algorithm": "unknown"}


def request_to_frame(payload: PredictRequest) -> pd.DataFrame:
    income = max(payload.monthly_income, 1.0)
    dti = payload.dti if payload.dti is not None else payload.current_debt / income
    loan_to_income = payload.requested_amount / income
    debt_burden = (payload.current_debt + payload.requested_amount) / income
    row = {
        "age": payload.age,
        "occupation": payload.occupation,
        "monthly_income": payload.monthly_income,
        "years_employed": payload.years_employed,
        "requested_amount": payload.requested_amount,
        "term_months": payload.term_months,
        "purpose": payload.purpose,
        "current_debt": payload.current_debt,
        "existing_loans": payload.existing_loans,
        "late_payments": payload.late_payments,
        "credit_history": payload.credit_history,
        "dti": dti,
        "loan_to_income": loan_to_income,
        "debt_burden": debt_burden,
    }
    return pd.DataFrame([row])


def _risk_and_score(default_p: float) -> tuple[str, float]:
    settings = get_settings()
    if default_p < settings.low_risk_threshold:
        level = "LOW_RISK"
    elif default_p < settings.medium_risk_threshold:
        level = "MEDIUM_RISK"
    else:
        level = "HIGH_RISK"
    score = settings.credit_score_max - settings.credit_score_range * default_p
    score = float(max(300.0, min(settings.credit_score_max, round(score, 2))))
    return level, score


def _feature_names(pipeline) -> list[str]:
    pre = pipeline.named_steps["preprocess"]
    try:
        return list(pre.get_feature_names_out())
    except Exception:
        return NUMERIC_FEATURES + CATEGORICAL_FEATURES


def _raw_value_map(row: pd.Series) -> dict:
    return {col: row[col] for col in row.index}


def shap_factors(pipeline, frame: pd.DataFrame) -> list[ShapFactor]:
    settings = get_settings()
    row = frame.iloc[0]
    raw_values = _raw_value_map(row)
    try:
        import shap

        preprocess = pipeline.named_steps["preprocess"]
        model = pipeline.named_steps["model"]
        transformed = preprocess.transform(frame)
        names = _feature_names(pipeline)
        if hasattr(model, "predict_proba") and type(model).__name__ == "LogisticRegression":
            explainer = shap.LinearExplainer(model, transformed)
        else:
            explainer = shap.TreeExplainer(model)
        values = explainer.shap_values(transformed)
        if isinstance(values, list):
            values = values[1] if len(values) > 1 else values[0]
        values = np.array(values)
        if values.ndim > 1:
            values = values[0]
        pairs = list(zip(names, values))
        pairs.sort(key=lambda item: abs(float(item[1])), reverse=True)
        factors: list[ShapFactor] = []
        for name, shap_value in pairs[: settings.shap_top_k]:
            base_key = name.split("__")[-1] if "__" in name else name
            raw_key = next((k for k in raw_values if k in base_key or base_key.startswith(k)), None)
            feature_value = raw_values.get(raw_key, None) if raw_key else None
            shap_f = float(shap_value)
            factors.append(
                ShapFactor(
                    feature_name=human_feature_name(base_key),
                    feature_value=feature_value if feature_value is not None else base_key,
                    shap_value=round(shap_f, 6),
                    impact="INCREASE_RISK" if shap_f > 0 else "DECREASE_RISK",
                    description=impact_description(base_key, feature_value if feature_value is not None else base_key, shap_f),
                )
            )
        return factors
    except Exception:
        return heuristic_factors(row)


def heuristic_factors(row: pd.Series) -> list[ShapFactor]:
    heuristics = [
        ("late_payments", float(row["late_payments"]) / 10.0),
        ("dti", float(row["dti"]) / 8.0),
        ("debt_burden", float(row["debt_burden"]) / 12.0),
        ("credit_history", 0.15 if row["credit_history"] == "POOR" else (-0.12 if row["credit_history"] == "GOOD" else 0.02)),
        ("years_employed", -min(float(row["years_employed"]), 15) / 40.0),
        ("monthly_income", -min(float(row["monthly_income"]), 5e7) / 2e8),
        ("existing_loans", float(row["existing_loans"]) / 8.0),
    ]
    heuristics.sort(key=lambda item: abs(item[1]), reverse=True)
    factors = []
    for name, value in heuristics[:7]:
        factors.append(
            ShapFactor(
                feature_name=human_feature_name(name),
                feature_value=row[name],
                shap_value=round(float(value), 6),
                impact="INCREASE_RISK" if value > 0 else "DECREASE_RISK",
                description=impact_description(name, row[name], value),
            )
        )
    return factors


def predict(payload: PredictRequest) -> PredictResponse:
    _ensure_loaded()
    frame = request_to_frame(payload)
    proba = float(_PIPELINE.predict_proba(frame)[0][1])
    proba = min(0.999, max(0.001, proba))
    level, score = _risk_and_score(proba)
    return PredictResponse(
        default_probability=round(proba, 6),
        repayment_probability=round(1.0 - proba, 6),
        risk_level=level,
        credit_score=score,
        shap_explanation=shap_factors(_PIPELINE, frame),
        model_version=_METADATA.get("version", "1.0.0-sim"),
        algorithm=_METADATA.get("algorithm", "XGBoost"),
    )


def metadata() -> dict:
    _ensure_loaded()
    return _METADATA
