"""All tests use tiny artificial data; never load or evaluate the real CSV Test."""
import json
import sys

import numpy as np
import pytest
from sklearn.model_selection import StratifiedKFold

from app.home_credit_features import FEATURES
from training import train


@pytest.fixture(scope="module")
def cv_run():
    frame = train.make_smoke_frame(150)
    training, test = train.split_training_test(frame)
    created = []
    original = train._new_pipeline

    def track(name, y_fit, *, profile):
        pipeline = original(name, y_fit, profile=profile)
        created.append((name, y_fit.index.to_numpy(copy=True), pipeline))
        return pipeline

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(train, "_new_pipeline", track)
        report = train.compare_on_training(training, profile="smoke")
    return frame, training, test, report, created


def test_single_reproducible_stratified_80_20_split(monkeypatch):
    frame = train.make_smoke_frame(150)
    original = train.train_test_split
    calls = []

    def track(*args, **kwargs):
        calls.append(kwargs)
        return original(*args, **kwargs)

    monkeypatch.setattr(train, "train_test_split", track)
    training, test = train.split_training_test(frame)
    assert len(calls) == 1
    assert calls[0]["test_size"] == 0.2 and calls[0]["random_state"] == 42
    assert calls[0]["stratify"].equals(frame["TARGET"])
    assert len(training.x) == 120 and len(test.x) == 30
    assert training.y.value_counts().to_dict() == {0: 96, 1: 24}
    assert test.y.value_counts().to_dict() == {0: 24, 1: 6}
    assert not set(training.record_ids) & set(test.record_ids)
    assert set(training.record_ids) | set(test.record_ids) == set(frame["SK_ID_CURR"])
    again, test_again = train.split_training_test(frame)
    np.testing.assert_array_equal(training.record_ids, again.record_ids)
    np.testing.assert_array_equal(test.record_ids, test_again.record_ids)
    assert list(training.x.columns) == FEATURES


def test_three_models_each_run_five_identical_folds(cv_run):
    _, training, test, report, created = cv_run
    assert len(created) == 15
    assert set(report["models"]) == set(train.MODEL_NAMES)
    assert report["selected_model"] is None
    assert report["selection_policy"] == "pending_prompt_3"
    assert report["test_evaluated"] is False
    expected = list(StratifiedKFold(n_splits=5, shuffle=True, random_state=42).split(training.x, training.y))
    reference_fingerprints = None
    for name, result in report["models"].items():
        assert len(result["folds"]) == 5
        seen_validation_ids = []
        fingerprints = []
        for fold, (fit_pos, valid_pos) in zip(result["folds"], expected):
            fit_ids, valid_ids = training.record_ids[fit_pos], training.record_ids[valid_pos]
            assert not set(fit_ids) & set(valid_ids)
            assert not (set(fit_ids) | set(valid_ids)) & set(test.record_ids)
            assert fold["fit_ids_sha256"] == train._partition_digest(fit_ids)
            assert fold["validation_ids_sha256"] == train._partition_digest(valid_ids)
            fingerprints.append((fold["fit_ids_sha256"], fold["validation_ids_sha256"]))
            seen_validation_ids.extend(valid_ids)
            assert fold["fit_rows"] == 96 and fold["validation_rows"] == 24
            assert 0 <= fold["ap"] <= 1 and 0 <= fold["roc_auc"] <= 1
            if name == "XGBoost":
                y_fit = training.y.iloc[fit_pos]
                assert fold["scale_pos_weight"] == y_fit.eq(0).sum() / y_fit.eq(1).sum()
        assert sorted(seen_validation_ids) == sorted(training.record_ids)
        if reference_fingerprints is None:
            reference_fingerprints = fingerprints
        assert fingerprints == reference_fingerprints
        for metric in ("ap", "roc_auc"):
            scores = [fold[metric] for fold in result["folds"]]
            assert result["summary"][f"{metric}_mean"] == pytest.approx(np.mean(scores))
            assert result["summary"][f"{metric}_std"] == pytest.approx(np.std(scores, ddof=0))
        assert result["selection_inputs"] == result["summary"]
        assert result["selection_score"] is None


def test_every_pipeline_and_preprocessor_is_new_and_fit_only_on_four_folds(cv_run):
    _, training, test, _, created = cv_run
    pipelines = [pipeline for _, _, pipeline in created]
    assert len({id(pipe) for pipe in pipelines}) == 15
    assert len({id(pipe.named_steps["preprocess"]) for pipe in pipelines}) == 15
    assert len({id(pipe.named_steps["model"]) for pipe in pipelines}) == 15
    for name, fit_indices, pipeline in created:
        assert not set(fit_indices) & set(test.x.index)
        assert len(fit_indices) == 96
        expected_fit = training.x.loc[fit_indices]
        pre = pipeline.named_steps["preprocess"]
        numeric = pre.named_steps["columns"].named_transformers_["num"]
        cleaned = pre.named_steps["clean"].transform(expected_fit)
        np.testing.assert_allclose(
            numeric.named_steps["imputer"].statistics_, cleaned[train.NUMERIC].median().to_numpy(),
        )
        assert numeric.named_steps["scaler"].n_samples_seen_ == 96
        if name == "XGBoost":
            y_fit = training.y.loc[fit_indices]
            assert pipeline.named_steps["model"].get_params()["scale_pos_weight"] == train._positive_weight(y_fit)


def test_test_partition_rejected_by_comparison_and_refit(cv_run):
    _, _, test, _, _ = cv_run
    with pytest.raises(TypeError, match="outside model selection"):
        train.compare_on_training(test)
    with pytest.raises(TypeError, match="outside model selection"):
        train.refit_selected_on_training(test, "LogisticRegression")


def test_changing_only_test_cannot_change_cv(cv_run):
    _, training, test, original, _ = cv_run
    # Test-only corruption/categories/extremes never reach any comparison call.
    test.x.loc[:, "AMT_CREDIT"] = 1e12
    test.x.loc[:, "OCCUPATION_TYPE"] = "TEST_ONLY_CATEGORY"
    test.y.loc[:] = 1 - test.y
    repeated = train.compare_on_training(training, profile="smoke")
    assert repeated == original


def test_refit_and_test_evaluation_are_separate_stages(monkeypatch):
    training, test = train.split_training_test(train.make_smoke_frame(150))
    calls = []
    original_fit = train.Pipeline.fit

    def track_fit(self, x, y, **kwargs):
        calls.append(len(x))
        return original_fit(self, x, y, **kwargs)

    monkeypatch.setattr(train.Pipeline, "fit", track_fit)
    # A fixed test fixture choice, NOT an official model selection policy.
    fitted = train.refit_selected_on_training(training, "LogisticRegression", profile="smoke")
    assert calls[0] == 120
    before = len(calls)
    metrics = train.evaluate_on_test(fitted, test)
    assert len(calls) == before  # evaluate only transforms/predicts; no fit.
    assert metrics["rows"] == 30
    assert set(metrics) == {"model", "rows", "ap", "roc_auc"}
    with pytest.raises(ValueError, match="overlap"):
        train.evaluate_on_test(fitted, train.HeldOutTest(training.x, training.y, training.record_ids))


def test_cli_smoke_does_not_read_csv_refit_or_evaluate_test(monkeypatch, tmp_path):
    def forbidden(*args, **kwargs):
        pytest.fail("Smoke comparison must not load CSV, refit winner, evaluate Test or export")

    for name in ("load_home_credit", "refit_selected_on_training", "evaluate_on_test", "train_and_export"):
        monkeypatch.setattr(train, name, forbidden)
    output = tmp_path / "cv.json"
    monkeypatch.setattr(sys, "argv", ["train.py", "--mode", "cv-smoke", "--sample-size", "150", "--report", str(output)])
    train.main()
    report = json.loads(output.read_text(encoding="utf-8"))
    assert report["dataset"] == "artificial_home_credit_contract_fixture_NOT_REAL_CSV"
    assert report["held_out_rows"] == 30
    assert report["test_evaluated"] is False
    assert report["model_exported"] is False


def test_real_cv_cli_passes_only_training_and_never_opens_test(monkeypatch):
    # Simulate the real-CSV code path with a tiny frame; no physical CSV is read.
    from pathlib import Path

    frame = train.make_smoke_frame(150)
    seen = []
    monkeypatch.setattr(train, "load_home_credit", lambda *args: (frame, None, Path("application_train.csv"), Path("dictionary.csv")))

    def compare(training):
        assert isinstance(training, train.TrainingData)
        seen.append(training.record_ids)
        return {"test_evaluated": False}

    def forbidden(*args, **kwargs):
        pytest.fail("Real CV CLI must not refit, evaluate or export")

    monkeypatch.setattr(train, "compare_on_training", compare)
    for name in ("refit_selected_on_training", "evaluate_on_test", "train_and_export"):
        monkeypatch.setattr(train, name, forbidden)
    monkeypatch.setattr(sys, "argv", ["train.py", "--mode", "cv"])
    train.main()
    assert len(seen) == 1 and len(seen[0]) == 120
