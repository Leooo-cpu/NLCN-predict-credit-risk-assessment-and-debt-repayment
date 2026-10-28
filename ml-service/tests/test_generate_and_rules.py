from app.scoring import request_to_frame, _risk_and_score
from app.schemas import PredictRequest
from training.generate_data import generate_simulated_dataset


def test_simulated_dataset_has_target_and_note():
    frame = generate_simulated_dataset(n=200, seed=1)
    assert set(frame["default"].unique()).issubset({0, 1})
    assert (frame["dataset_note"] == "Dữ liệu mô phỏng").all()
    assert "dti" in frame.columns
    assert "loan_to_income" in frame.columns
    assert "debt_burden" in frame.columns


def test_risk_thresholds():
    assert _risk_and_score(0.10)[0] == "LOW_RISK"
    assert _risk_and_score(0.20)[0] == "MEDIUM_RISK"
    assert _risk_and_score(0.45)[0] == "HIGH_RISK"
    level, score = _risk_and_score(0.2)
    assert level == "MEDIUM_RISK"
    assert abs(score - (850 - 550 * 0.2)) < 0.01


def test_request_to_frame_derives_features():
    payload = PredictRequest(
        age=30,
        occupation="Ky su",
        monthly_income=10_000_000,
        years_employed=3,
        requested_amount=20_000_000,
        term_months=24,
        purpose="TIEU_DUNG",
        current_debt=5_000_000,
        existing_loans=1,
        late_payments=0,
        credit_history="GOOD",
    )
    frame = request_to_frame(payload)
    assert frame.loc[0, "loan_to_income"] == 2.0
    assert frame.loc[0, "dti"] == 0.5
