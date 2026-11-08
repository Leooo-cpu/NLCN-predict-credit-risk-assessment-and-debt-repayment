"""Historical synthetic fixture remains labeled; active inference uses Home Credit."""
import pytest
from pydantic import ValidationError

from app.scoring import request_to_frame
from app.schemas import PredictRequest
from training.generate_data import generate_simulated_dataset


def test_simulated_dataset_has_target_and_note():
    frame = generate_simulated_dataset(n=200, seed=1)
    assert set(frame["default"].unique()).issubset({0, 1})
    assert (frame["dataset_note"] == "Dữ liệu mô phỏng").all()


def test_old_request_is_rejected_instead_of_inventing_home_credit_values():
    with pytest.raises(ValidationError):
        PredictRequest(age=30, monthly_income=10000000, term_months=24)


def test_request_uses_exact_features_and_explicit_nullable_values():
    payload = PredictRequest(
        AMT_CREDIT=100000.0, AMT_ANNUITY=None, DAYS_BIRTH=-12000,
        DAYS_EMPLOYED=365243, NAME_CONTRACT_TYPE="Cash loans", OCCUPATION_TYPE=None,
        amount_unit="HOME_CREDIT_SOURCE",
    )
    frame = request_to_frame(payload)
    assert "TARGET" not in frame and "SK_ID_CURR" not in frame
    assert frame["AMT_ANNUITY"].isna().all()
