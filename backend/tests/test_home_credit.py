"""Optional live ML bridge checks plus legacy-input rejection. Never evaluate Test."""
import os
from types import SimpleNamespace

import pytest

from app.core.exceptions import AppError
from app.services import ml_client
from tests.conftest import login
from app.core.security import create_access_token


def test_legacy_loans_require_new_real_inputs():
    with pytest.raises(AppError) as error:
        ml_client.build_ml_payload(SimpleNamespace(), SimpleNamespace())
    assert error.value.status_code == 422
    assert error.value.code == "HOME_CREDIT_INPUT_REQUIRED"


@pytest.mark.skipif(not os.environ.get("ML_INTEGRATION_URL"), reason="Start the versioned ML API and set ML_INTEGRATION_URL")
def test_live_backend_home_credit_bridge(client, monkeypatch):
    monkeypatch.setattr(ml_client, "get_settings", lambda: SimpleNamespace(ml_service_url=os.environ["ML_INTEGRATION_URL"]))
    token = login(client, "officer@test.com", "Officer@123456")
    headers = {"Authorization": f"Bearer {token}"}
    sample_response = client.get("/api/home-credit/sample", headers=headers)
    assert sample_response.status_code == 200, sample_response.text
    sample = sample_response.json()
    assert not {"TARGET", "SK_ID_CURR"} & set(sample)
    response = client.post("/api/home-credit/predict", headers=headers, json=sample)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["data_source"].startswith("Home Credit")
    assert result["risk_level"] == "NOT_VALIDATED"
    assert client.get("/api/models/current", headers=headers).json()["version"] == result["model_version"]
    assert client.post("/api/home-credit/predict", headers=headers, json={"monthly_income": 10000000}).status_code == 422
    assert client.post("/api/home-credit/predict", headers=headers, json={**sample, "TARGET": 1}).status_code == 422
    assert client.post("/api/home-credit/predict", json=sample).status_code == 401
    viewer = create_access_token("viewer@test.com", "RISK_VIEWER")
    assert client.post("/api/home-credit/predict", headers={"Authorization": f"Bearer {viewer}"}, json=sample).status_code == 401
