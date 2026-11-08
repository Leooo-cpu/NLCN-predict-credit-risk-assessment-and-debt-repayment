import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import scoring
from app.home_credit_features import FEATURES
from app.main import app
from training import train


def test_selection_ap_then_auc_then_fixed_order():
    def results(ap, auc):
        return {name: {"summary": {"ap_mean": ap[i], "roc_auc_mean": auc[i]}} for i, name in enumerate(train.MODEL_NAMES)}
    assert train.select_model(results([0.3, 0.2, 0.1], [0.5, 0.9, 0.9])) == "LogisticRegression"
    assert train.select_model(results([0.3, 0.3, 0.1], [0.6, 0.7, 0.9])) == "RandomForest"
    assert train.select_model(dict(reversed(list(results([0.3] * 3, [0.6] * 3).items())))) == "LogisticRegression"


@pytest.fixture()
def active_client(monkeypatch):
    # Only reload/predict on the saved Training sample. Never load or evaluate the Test CSV.
    root = Path(__file__).resolve().parents[1] / "artifacts"
    manifest = root / "active_model.json"
    if not manifest.is_file():
        pytest.skip("Train/activate a version to run saved-model API integration checks")
    monkeypatch.setattr(scoring, "_PIPELINE", None)
    monkeypatch.setattr(scoring, "_METADATA", {})
    with TestClient(app) as client:
        yield client, json.loads((root / json.loads(manifest.read_text())["relative_dir"] / "sample_request.json").read_text())


def test_active_model_api_valid_missing_extra_and_null(active_client):
    client, sample = active_client
    assert not {"TARGET", "SK_ID_CURR"} & set(sample)
    valid = client.post("/predict", json=sample)
    assert valid.status_code == 200, valid.text
    prediction = valid.json()
    assert prediction["data_source"].startswith("Home Credit")
    assert prediction["risk_level"] == "NOT_VALIDATED"
    assert not prediction["risk_bands_validated"]
    assert prediction["classification_threshold"] == 0.5
    assert prediction["shap_explanation"] == []
    assert "repayment_probability" not in prediction
    assert client.post("/predict", json={**sample, "TARGET": 1}).status_code == 422
    assert client.post("/predict", json={**sample, "SK_ID_CURR": 1}).status_code == 422
    assert client.post("/predict", json={name: value for name, value in sample.items() if name != "DAYS_BIRTH"}).status_code == 422
    assert client.post("/predict", json={**sample, "amount_unit": "VND"}).status_code == 422
    assert client.post("/predict", json={**sample, "AMT_CREDIT": -1}).status_code == 422
    assert client.post("/predict", json={**sample, "DAYS_BIRTH": 12000}).status_code == 422
    assert client.post("/predict", json={**sample, "AMT_CREDIT": "227520"}).status_code == 422
    explicit_null = client.post("/predict", json={**sample, "AMT_ANNUITY": None, "DAYS_EMPLOYED": 365243, "OCCUPATION_TYPE": None})
    assert explicit_null.status_code == 200
    assert set(explicit_null.json()["imputed_features"]) == {"AMT_ANNUITY", "DAYS_EMPLOYED", "OCCUPATION_TYPE"}
    assert list(client.get("/model/input-schema").json()["features"]) == FEATURES


def test_model_bundle_refuses_incompatible_or_tampered_metadata(tmp_path):
    (tmp_path / "model_metadata.json").write_text(json.dumps({"contract_version": "synthetic"}))
    with pytest.raises(ValueError, match="contract"):
        scoring.load_bundle(tmp_path)


def test_full_training_orchestration_locks_before_test_and_never_activates(tmp_path, monkeypatch):
    # Small fixture. Stub CV to avoid duplicate model comparisons; fit a real LR Pipeline.
    frame = train.make_smoke_frame(150)
    cv = {"selected_model": "LogisticRegression", "models": {}}

    def compare(training, *, oof_predictions):
        import numpy as np
        oof_predictions["LogisticRegression"] = np.full(len(training.y), 0.4)
        return cv

    monkeypatch.setattr(train, "compare_on_training", compare)
    real_evaluate = train.evaluate_on_test
    calls = []

    def evaluate(fitted, test):
        assert (tmp_path / "versions" / "fixture-v1" / "selection_lock.json").exists()
        calls.append(len(test.y))
        return real_evaluate(fitted, test)

    monkeypatch.setattr(train, "evaluate_on_test", evaluate)
    metadata = train.train_version(frame, "fixture-v1", tmp_path)
    assert calls == [30]
    assert metadata["test_evaluation_count"] == 1
    assert not (tmp_path / "active_model.json").exists()
    with pytest.raises(FileExistsError):
        train.train_version(frame, "fixture-v1", tmp_path)
    assert calls == [30]
