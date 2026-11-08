"""Small fixtures test customer-linked persistence, stale inputs and safe replacement."""
from copy import deepcopy
import json
import os
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.import_home_credit import import_csv
from app.models.credit_case import CreditCase, CreditPrediction
from app.models.customer import Customer
from app.models.loan_application import LoanApplication
from app.models.model_prediction import ModelPrediction
from app.models.user import User
from app.routers import credit_cases
from tests.conftest import login

INPUTS = {"AMT_CREDIT": 227520.0, "AMT_ANNUITY": 13189.5, "DAYS_BIRTH": -12298,
          "DAYS_EMPLOYED": -946, "NAME_CONTRACT_TYPE": "Cash loans", "OCCUPATION_TYPE": "Laborers",
          "amount_unit": "HOME_CREDIT_SOURCE"}


@pytest.fixture()
def ml_stub(monkeypatch):
    sent = []
    def request(method, path, payload):
        if set(payload) != set(INPUTS):
            raise HTTPException(422, "Missing or extra model inputs")
        sent.append((path, deepcopy(payload)))
        if path == "/validate":
            return {"inputs": deepcopy(payload), "contract_version": "home-credit-application-v1"}
        return {"payment_difficulty_probability": 0.3, "other_outcome_probability": 0.7,
                "predicted_payment_difficulty": False, "classification_threshold": 0.5,
                "model_version": "fixture-model", "algorithm": "XGBoost", "data_source": "Home Credit Default Risk / application_train.csv",
                "risk_level": "NOT_VALIDATED", "credit_score": 685, "imputed_features": [],
                "disclaimer": "fixture, not real model results", "explanation_note": "No SHAP"}
    monkeypatch.setattr(credit_cases, "request_home_credit", request)
    return sent


def headers(client, role="officer"):
    email, password = ("officer@test.com", "Officer@123456") if role == "officer" else ("viewer@test.com", "Viewer@123456")
    return {"Authorization": f"Bearer {login(client, email, password)}"}


def test_create_save_predict_reload_and_history_are_linked(client, ml_stub):
    auth = headers(client)
    created = client.post("/api/credit-cases", headers=auth, json={"display_name": "Khách hàng thử nghiệm", "inputs": INPUTS})
    assert created.status_code == 201, created.text
    case = created.json()
    assert case["reference_target"] is None
    first = client.post(f"/api/credit-cases/{case['id']}/score", headers=auth, json={"expected_revision": 1})
    assert first.status_code == 201, first.text
    assert first.json()["case_id"] == case["id"]
    changed = {**INPUTS, "AMT_CREDIT": 300000.0}
    saved = client.put(f"/api/credit-cases/{case['id']}/inputs", headers=auth, json={"expected_revision": 1, "inputs": changed})
    assert saved.status_code == 200 and saved.json()["input_revision"] == 2
    assert saved.json()["latest_prediction"]["input_revision"] == 1
    assert client.post(f"/api/credit-cases/{case['id']}/score", headers=auth, json={"expected_revision": 1}).status_code == 409
    assert client.put(f"/api/credit-cases/{case['id']}/inputs", headers=auth, json={"expected_revision": 1, "inputs": INPUTS}).status_code == 409
    second = client.post(f"/api/credit-cases/{case['id']}/score", headers=auth, json={"expected_revision": 2})
    assert second.status_code == 201
    history = client.get(f"/api/credit-cases/{case['id']}/predictions", headers=auth).json()
    assert len(history) == 2
    assert history[0]["inputs_snapshot"] == changed and history[1]["inputs_snapshot"] == INPUTS
    assert history[0]["input_revision"] == 2 and history[1]["input_revision"] == 1
    assert client.get(f"/api/credit-cases/{case['id']}", headers=auth).json()["latest_prediction"]["id"] == second.json()["id"]
    assert client.get("/api/credit-cases/predictions", headers=auth).json()["items"][0]["display_name"] == case["display_name"]
    assert client.get("/api/credit-cases?predicted=false", headers=auth).json()["total"] == 0
    assert client.get("/api/credit-cases/summary", headers=auth).json()["total_predictions"] == 2
    assert all(not {"TARGET", "SK_ID_CURR", "reference_target"} & set(payload) for _, payload in ml_stub)


def test_read_only_missing_record_validation_and_ml_failure(client, ml_stub, monkeypatch):
    auth = headers(client)
    viewer = headers(client, "viewer")
    assert client.post("/api/credit-cases", headers=viewer, json={"display_name": "x", "inputs": INPUTS}).status_code == 403
    assert client.get("/api/credit-cases").status_code == 401
    assert client.get("/api/credit-cases/999", headers=auth).status_code == 404
    assert client.post("/api/credit-cases", headers=auth, json={"display_name": "x", "inputs": {"TARGET": 1}}).status_code == 422
    case = client.post("/api/credit-cases", headers=auth, json={"display_name": "x", "inputs": INPUTS}).json()
    assert client.get(f"/api/credit-cases/{case['id']}", headers=viewer).status_code == 200
    assert client.post(f"/api/credit-cases/{case['id']}/score", headers=viewer, json={"expected_revision": 1}).status_code == 403
    monkeypatch.setattr(credit_cases, "request_home_credit", lambda *args: (_ for _ in ()).throw(HTTPException(503, "ML offline")))
    assert client.post(f"/api/credit-cases/{case['id']}/score", headers=auth, json={"expected_revision": 1}).status_code == 503
    assert client.get(f"/api/credit-cases/{case['id']}/predictions", headers=auth).json() == []


def source_csv(tmp_path):
    data = [{**{key: value for key, value in INPUTS.items() if key != "amount_unit"}, "SK_ID_CURR": 100001 + index, "TARGET": index % 2} for index in range(3)]
    path = tmp_path / "application_train.csv"
    pd.DataFrame(data).to_csv(path, index=False)
    return path


def add_synthetic():
    with SessionLocal() as db:
        person = Customer(full_name="Synthetic to replace", age=30, occupation="demo", monthly_income=1, years_employed=0,
                          credit_history="GOOD", late_payments=0, current_debt=0, existing_loans=0, is_simulated=True)
        db.add(person); db.flush()
        loan = LoanApplication(customer_id=person.id, requested_amount=1, term_months=12, purpose="demo", monthly_income=1,
                               years_employed=0, current_debt=0, existing_loans=0, credit_history="GOOD", late_payments=0, is_simulated=True)
        db.add(loan); db.flush()
        db.add(ModelPrediction(loan_application_id=loan.id, model_version="1.0.0-sim", default_probability=0.1,
                               repayment_probability=0.9, credit_score=795, risk_level="LOW_RISK", explanation_json={}))
        db.commit()


def test_import_backup_replace_and_repeat_preserve_home_credit(client, tmp_path):
    add_synthetic()
    path = source_csv(tmp_path)
    result = import_csv(path, replace_synthetic=True, backup_dir=tmp_path / "backup")
    assert result["csv_rows"] == 3 and result["new_cases"] == 3
    backup = json.loads(open(result["backup_file"], encoding="utf-8").read())
    assert len(backup["model_predictions"]) == len(backup["customers"]) == len(backup["loan_applications"]) == 1
    assert result["synthetic_remaining"] == {"customers": 0, "predictions": 0}
    with SessionLocal() as db:
        case = db.query(CreditCase).first()
        assert not {"TARGET", "SK_ID_CURR"} & set(case.inputs_json)
        assert case.reference_target == 0
        case.display_name = "User edit preserved"
        db.commit()
        assert db.query(User).count() == 3
    again = import_csv(path, replace_synthetic=True, backup_dir=tmp_path / "backup")
    assert again["new_cases"] == 0 and again["total_cases"] == 3
    with SessionLocal() as db:
        assert db.query(CreditCase).first().display_name == "User edit preserved"


def test_invalid_csv_rolls_back_and_never_deletes_synthetic(client, tmp_path):
    add_synthetic()
    path = source_csv(tmp_path)
    frame = pd.read_csv(path)
    frame.loc[2, "TARGET"] = 2
    frame.to_csv(path, index=False)
    with pytest.raises(ValueError):
        import_csv(path, replace_synthetic=True, backup_dir=tmp_path / "backup")
    with SessionLocal() as db:
        assert db.query(Customer).count() == 1
        assert db.query(ModelPrediction).count() == 1
        assert db.query(CreditCase).count() == 0


@pytest.mark.skipif(not os.environ.get("ML_INTEGRATION_URL"), reason="Needs the running ML API")
def test_saved_customer_prediction_with_real_ml_api(client, monkeypatch):
    from app.services import ml_client
    monkeypatch.setattr(ml_client, "get_settings", lambda: SimpleNamespace(ml_service_url=os.environ["ML_INTEGRATION_URL"]))
    auth = headers(client)
    created = client.post("/api/credit-cases", headers=auth, json={"display_name": "Live API fixture (test DB only)", "inputs": INPUTS})
    assert created.status_code == 201, created.text
    case_id = created.json()["id"]
    response = client.post(f"/api/credit-cases/{case_id}/score", headers=auth, json={"expected_revision": 1})
    assert response.status_code == 201, response.text
    assert response.json()["model_version"] == "home-credit-v1-20261108"
    history = client.get(f"/api/credit-cases/{case_id}/predictions", headers=auth).json()
    assert len(history) == 1 and history[0]["id"] == response.json()["id"]
    assert history[0]["inputs_snapshot"] == INPUTS
