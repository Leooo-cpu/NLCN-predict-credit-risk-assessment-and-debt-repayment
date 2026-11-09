"""Home Credit v1 input contract, shared by offline preparation and future inference.

This contract is NOT the active synthetic PredictRequest. Monetary amounts keep
the source scale: neither currency conversion nor income-period conversion is
justified by HomeCredit_columns_description.csv.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

CONTRACT_VERSION = "home-credit-application-v1"
DATASET = "Home Credit Default Risk / application_train.csv"
TARGET = "TARGET"
ID_COLUMN = "SK_ID_CURR"
TARGET_MEANING = {
    "1": "Client with payment difficulties: late payment more than X days on at least one of the first Y installments (X/Y not disclosed).",
    "0": "All other cases; not a guarantee of future repayment.",
}
NUMERIC = ["AMT_CREDIT", "AMT_ANNUITY", "DAYS_BIRTH", "DAYS_EMPLOYED"]
CATEGORICAL = ["NAME_CONTRACT_TYPE", "OCCUPATION_TYPE"]
FEATURES = NUMERIC + CATEGORICAL
FEATURE_SPEC = {
    "AMT_CREDIT": {"kind": "number", "nullable": False, "label": "Số tiền cấp tín dụng", "unit": "HOME_CREDIT_SOURCE (không mặc định VND)"},
    "AMT_ANNUITY": {"kind": "number", "nullable": True, "label": "Số tiền annuity theo điều kiện khoản vay", "unit": "HOME_CREDIT_SOURCE; không suy ra tần suất"},
    "DAYS_BIRTH": {"kind": "integer", "nullable": False, "label": "Ngày sinh so với ngày nộp hồ sơ", "unit": "ngày âm"},
    "DAYS_EMPLOYED": {"kind": "integer", "nullable": True, "label": "Ngày bắt đầu công việc so với ngày nộp", "unit": "ngày không dương; 365243 = không biết"},
    "NAME_CONTRACT_TYPE": {"kind": "string", "nullable": False, "label": "Loại hợp đồng", "unit": "danh mục", "choices": ["Cash loans", "Revolving loans"]},
    "OCCUPATION_TYPE": {"kind": "string", "nullable": True, "label": "Nhóm nghề theo Home Credit", "unit": "danh mục"},
}
# Income is deliberately held out until the income period can be documented.
# Do not map monthly_income to AMT_INCOME_TOTAL or invent a conversion factor.
SPECIAL_CATEGORIES = ("XNA", "XAP", "Unknown")


def frame_from_values(values: dict) -> pd.DataFrame:
    frame = pd.DataFrame([{name: values[name] for name in FEATURES}], columns=FEATURES)
    for name in NUMERIC:
        frame[name] = pd.to_numeric(frame[name], errors="raise").astype(float)
    validate_features(frame)
    return frame


def validate_features(frame: pd.DataFrame) -> None:
    if frame.columns.duplicated().any():
        raise ValueError("Duplicate feature columns are not allowed")
    missing = sorted(set(FEATURES) - set(frame.columns))
    extra = sorted(set(frame.columns) - set(FEATURES))
    if missing or extra:
        raise ValueError(f"Home Credit input schema mismatch: missing={missing}, extra={extra}")
    for name in NUMERIC:
        if not pd.api.types.is_numeric_dtype(frame[name]):
            raise ValueError(f"{name} must be numeric (missing values allowed)")
        if np.isinf(frame[name].dropna().to_numpy(dtype=float)).any():
            raise ValueError(f"{name} contains infinite values")
    for name in ("AMT_CREDIT", "AMT_ANNUITY"):
        if (frame[name].dropna() <= 0).any():
            raise ValueError(f"{name} must be positive when supplied")
    if (frame["DAYS_BIRTH"].dropna() >= 0).any():
        raise ValueError("DAYS_BIRTH must be negative, relative to application date")
    employed = frame["DAYS_EMPLOYED"].dropna()
    if ((employed > 0) & (employed != 365243)).any():
        raise ValueError("Unexpected positive DAYS_EMPLOYED (only sentinel 365243 is allowed)")
    for name in CATEGORICAL:
        if not frame[name].dropna().map(lambda value: isinstance(value, str)).all():
            raise ValueError(f"{name} must contain strings or missing values")
    contract = frame["NAME_CONTRACT_TYPE"].dropna()
    invalid = set(contract) - {"Cash loans", "Revolving loans", *SPECIAL_CATEGORIES}
    if invalid:
        raise ValueError(f"Unsupported NAME_CONTRACT_TYPE values: {sorted(invalid)}")


class CleanHomeCredit(BaseEstimator, TransformerMixin):
    """Stateless, identical cleaning for fit and inference; never learns globally."""

    def fit(self, X, y=None):
        validate_features(X)
        self.feature_names_in_ = np.asarray(FEATURES, dtype=object)
        self.n_features_in_ = len(FEATURES)
        return self

    def transform(self, X):
        validate_features(X)
        result = X.loc[:, FEATURES].copy()
        result["DAYS_EMPLOYED"] = result["DAYS_EMPLOYED"].replace(365243, np.nan)
        for name in CATEGORICAL:
            result[name] = result[name].astype(object).replace(list(SPECIAL_CATEGORIES), np.nan)
            result[name] = result[name].where(result[name].notna(), np.nan)
        return result

    def get_feature_names_out(self, input_features=None):
        return np.asarray(FEATURES, dtype=object)


def build_preprocessor() -> Pipeline:
    numeric = Pipeline([
        ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("scaler", StandardScaler()),
    ])
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value="__MISSING__", keep_empty_features=True)),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ])
    return Pipeline([
        ("clean", CleanHomeCredit()),
        ("columns", ColumnTransformer([
            ("num", numeric, NUMERIC),
            ("cat", categorical, CATEGORICAL),
        ], remainder="drop")),
    ])
