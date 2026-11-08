"""Offline contract checks; no model evaluation or serving artifacts."""
import numpy as np
import pandas as pd
import pytest

from app.home_credit_features import FEATURES, build_preprocessor, validate_features
from training.train import load_home_credit, resolve_csv, train_and_export


def inputs():
    return pd.DataFrame({
        "AMT_CREDIT": [100.0, 200.0, 300.0],
        "AMT_ANNUITY": [10.0, np.nan, 30.0],
        "DAYS_BIRTH": [-10000, -15000, -20000],
        "DAYS_EMPLOYED": [-100, 365243, -300],
        "NAME_CONTRACT_TYPE": ["Cash loans", "Cash loans", "Revolving loans"],
        "OCCUPATION_TYPE": ["Laborers", None, "XNA"],
    })[FEATURES]


def test_imputation_and_categories_are_fit_on_training_only():
    train = inputs()
    validation = train.iloc[[0]].copy()
    validation.loc[:, "AMT_CREDIT"] = 999999
    validation.loc[:, "AMT_ANNUITY"] = np.nan
    validation.loc[:, "OCCUPATION_TYPE"] = "Unseen occupation"
    pre = build_preprocessor().fit(train)
    numeric = pre.named_steps["columns"].named_transformers_["num"]
    medians = numeric.named_steps["imputer"].statistics_.copy()
    means = numeric.named_steps["scaler"].mean_.copy()
    categories = pre.named_steps["columns"].named_transformers_["cat"].named_steps["encoder"].categories_
    assert medians.tolist() == [200.0, 20.0, -15000.0, -200.0]
    assert "Unseen occupation" not in categories[1]
    transformed = pre.transform(validation)
    assert np.isfinite(transformed.toarray() if hasattr(transformed, "toarray") else transformed).all()
    np.testing.assert_array_equal(medians, numeric.named_steps["imputer"].statistics_)
    np.testing.assert_array_equal(means, numeric.named_steps["scaler"].mean_)
    assert "Unseen occupation" not in categories[1]
    assert not any("TARGET" in name or "SK_ID_CURR" in name for name in pre.get_feature_names_out())


@pytest.mark.parametrize("column", ["TARGET", "SK_ID_CURR", "monthly_income"])
def test_contract_rejects_extra_and_leaking_columns(column):
    with pytest.raises(ValueError, match="schema mismatch"):
        validate_features(inputs().assign(**{column: 1}))


def test_contract_rejects_missing_and_invalid_numeric():
    with pytest.raises(ValueError, match="schema mismatch"):
        validate_features(inputs().drop(columns="AMT_CREDIT"))
    frame = inputs()
    frame.loc[0, "DAYS_EMPLOYED"] = 123
    with pytest.raises(ValueError, match="Unexpected positive"):
        validate_features(frame)


def test_explicit_missing_path_does_not_fall_back(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME_CREDIT_APPLICATION_CSV", str(tmp_path / "application_train.csv"))
    with pytest.raises(FileNotFoundError, match="No simulated fallback"):
        resolve_csv(None, "HOME_CREDIT_APPLICATION_CSV", "application_train.csv")


@pytest.mark.parametrize("problem", ["label", "duplicate_id", "missing_label", "missing_feature"])
def test_loader_rejects_corrupted_csv(tmp_path, problem):
    frame = inputs().assign(SK_ID_CURR=[1, 2, 3], TARGET=[0, 1, 0], AMT_INCOME_TOTAL=1000)
    if problem == "label":
        frame.loc[0, "TARGET"] = 2
    elif problem == "duplicate_id":
        frame.loc[0, "SK_ID_CURR"] = 2
    elif problem == "missing_label":
        frame.loc[0, "TARGET"] = np.nan
    else:
        frame = frame.drop(columns="AMT_CREDIT")
    frame.to_csv(tmp_path / "application_train.csv", index=False)
    pd.DataFrame({"Table": [], "Row": [], "Description": []}).to_csv(tmp_path / "HomeCredit_columns_description.csv", index=False)
    with pytest.raises(ValueError):
        load_home_credit(data_dir=tmp_path)


def test_export_is_disabled(tmp_path):
    with pytest.raises(RuntimeError, match="disabled"):
        train_and_export(tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_serving_does_not_train_when_artifact_is_missing(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from app import scoring

    monkeypatch.setattr(scoring, "_PIPELINE", None)
    monkeypatch.setattr(scoring, "get_settings", lambda: SimpleNamespace(
        pipeline_path=tmp_path / "credit_pipeline.joblib",
    ))
    with pytest.raises(FileNotFoundError, match="Restore the existing synthetic artifact"):
        scoring._ensure_loaded()
    assert list(tmp_path.iterdir()) == []
