from __future__ import annotations

import numpy as np
import pandas as pd

OCCUPATIONS = [
    "Kỹ sư phần mềm",
    "Nhân viên bán hàng",
    "Tài xế công nghệ",
    "Giáo viên",
    "Kinh doanh tự do",
    "Công chức",
    "Công nhân",
    "Bác sĩ",
]
PURPOSES = ["TIEU_DUNG", "MUA_NHA", "MUA_XE", "GIAO_DUC", "HOP_TAC_KINH_DOANH"]
CREDIT = ["GOOD", "FAIR", "POOR"]


def generate_simulated_dataset(n: int = 3500, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    age = rng.integers(22, 65, size=n)
    occupation = rng.choice(OCCUPATIONS, size=n)
    monthly_income = rng.lognormal(mean=16.2, sigma=0.45, size=n).clip(5_000_000, 80_000_000)
    years_employed = rng.uniform(0, 25, size=n).round(1)
    requested_amount = rng.lognormal(mean=18.2, sigma=0.55, size=n).clip(20_000_000, 500_000_000)
    term_months = rng.choice([12, 18, 24, 36, 48, 60, 72, 84], size=n)
    purpose = rng.choice(PURPOSES, size=n, p=[0.28, 0.22, 0.18, 0.12, 0.20])
    current_debt = rng.lognormal(mean=17.4, sigma=0.7, size=n).clip(0, 400_000_000)
    existing_loans = rng.integers(0, 6, size=n)
    late_payments = rng.integers(0, 10, size=n)
    credit_history = rng.choice(CREDIT, size=n, p=[0.45, 0.35, 0.20])

    dti = current_debt / np.maximum(monthly_income, 1)
    loan_to_income = requested_amount / np.maximum(monthly_income, 1)
    debt_burden = (current_debt + requested_amount) / np.maximum(monthly_income, 1)

    credit_penalty = np.select(
        [credit_history == "POOR", credit_history == "FAIR"],
        [1.15, 0.35],
        default=-0.45,
    )
    logit = (
        -2.1
        + 0.18 * late_payments
        + 0.12 * dti
        + 0.08 * loan_to_income
        + 0.06 * debt_burden
        + 0.22 * existing_loans
        + credit_penalty
        - 0.06 * years_employed
        - 0.000000015 * monthly_income
        + 0.01 * (age < 25).astype(float)
        + rng.normal(0, 0.45, size=n)
    )
    prob = 1 / (1 + np.exp(-logit))
    default_flag = (rng.uniform(0, 1, size=n) < prob).astype(int)

    frame = pd.DataFrame(
        {
            "age": age,
            "occupation": occupation,
            "monthly_income": monthly_income.round(0),
            "years_employed": years_employed,
            "requested_amount": requested_amount.round(0),
            "term_months": term_months,
            "purpose": purpose,
            "current_debt": current_debt.round(0),
            "existing_loans": existing_loans,
            "late_payments": late_payments,
            "credit_history": credit_history,
            "dti": dti,
            "loan_to_income": loan_to_income,
            "debt_burden": debt_burden,
            "default": default_flag,
            "dataset_note": "Dữ liệu mô phỏng",
        }
    )
    frame = frame.drop_duplicates()
    for col in ["monthly_income", "requested_amount", "current_debt", "dti", "loan_to_income", "debt_burden"]:
        q01, q99 = frame[col].quantile(0.01), frame[col].quantile(0.99)
        frame[col] = frame[col].clip(q01, q99)
    return frame.reset_index(drop=True)
