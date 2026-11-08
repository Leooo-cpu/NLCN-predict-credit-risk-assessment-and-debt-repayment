"""Home Credit: compare on Training CV, refit separately, evaluate Test separately.

CLI never evaluates Test or exports serving artifacts. The official selection
policy is pending; CV exposes selection inputs without declaring a winner.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline

from app.home_credit_features import (
    CATEGORICAL, CONTRACT_VERSION, DATASET, FEATURES, ID_COLUMN, NUMERIC,
    SPECIAL_CATEGORIES, TARGET, TARGET_MEANING, build_preprocessor, validate_features,
)

MODEL_NAMES = ("LogisticRegression", "RandomForest", "XGBoost")


@dataclass(frozen=True)
class TrainingData:
    x: pd.DataFrame
    y: pd.Series
    record_ids: np.ndarray


@dataclass(frozen=True)
class HeldOutTest:
    x: pd.DataFrame
    y: pd.Series
    record_ids: np.ndarray


@dataclass(frozen=True)
class RefitModel:
    pipeline: Pipeline
    model_name: str
    training_record_ids: np.ndarray
    profile: str


def split_training_test(frame: pd.DataFrame) -> tuple[TrainingData, HeldOutTest]:
    """One fixed internal 80/20 split from labeled application_train only.

    Kaggle application_test.csv is never used. Return separate types so a Test
    partition cannot accidentally be passed into comparison/refitting.
    """
    if frame[ID_COLUMN].isna().any() or frame[ID_COLUMN].duplicated().any():
        raise ValueError("Split requires nonmissing, unique SK_ID_CURR")
    if frame[TARGET].isna().any() or set(frame[TARGET].unique()) != {0, 1}:
        raise ValueError("Split requires complete binary TARGET with both classes")
    positions = np.arange(len(frame))
    train_pos, test_pos = train_test_split(
        positions, test_size=0.2, stratify=frame[TARGET], random_state=42,
    )

    def partition(kind, rows):
        return kind(
            x=frame.iloc[rows].loc[:, FEATURES].copy(),
            y=frame.iloc[rows][TARGET].astype(int).copy(),
            record_ids=frame.iloc[rows][ID_COLUMN].to_numpy(copy=True),
        )

    return partition(TrainingData, train_pos), partition(HeldOutTest, test_pos)


def _validate_training(training: TrainingData, min_per_class: int = 1) -> None:
    if not isinstance(training, TrainingData):
        raise TypeError("Only TrainingData is accepted; HeldOutTest must stay outside model selection")
    validate_features(training.x)
    if not (len(training.x) == len(training.y) == len(training.record_ids)):
        raise ValueError("Training features, labels and IDs must have the same length")
    if not training.x.index.equals(training.y.index):
        raise ValueError("Training features and labels must be aligned")
    if len(np.unique(training.record_ids)) != len(training.record_ids):
        raise ValueError("Training IDs must be unique")
    counts = training.y.value_counts()
    if training.y.isna().any() or set(counts.index) != {0, 1} or counts.min() < min_per_class:
        raise ValueError(f"Training needs both labels and at least {min_per_class} rows per class")


def _positive_weight(y: pd.Series) -> float:
    positive = int(y.eq(1).sum())
    negative = int(y.eq(0).sum())
    if min(positive, negative) == 0:
        raise ValueError("Both classes are required to calculate scale_pos_weight")
    return negative / positive


def make_model(name: str, y_fit: pd.Series, *, profile: str = "standard"):
    """Fixed configurations, no Test tuning. Smoke profile is test-only."""
    if profile not in {"standard", "smoke"}:
        raise ValueError(f"Unknown model profile: {profile}")
    if name == "LogisticRegression":
        return LogisticRegression(max_iter=400, class_weight="balanced", solver="lbfgs")
    if name == "RandomForest":
        return RandomForestClassifier(
            n_estimators=8 if profile == "smoke" else 120,
            max_depth=3 if profile == "smoke" else 10,
            min_samples_leaf=4, class_weight="balanced", random_state=42,
            n_jobs=1 if profile == "smoke" else -1,
        )
    if name == "XGBoost":
        # Lazy import keeps CSV preparation usable without XGBoost installed.
        from xgboost import XGBClassifier

        return XGBClassifier(
            n_estimators=8 if profile == "smoke" else 160,
            max_depth=2 if profile == "smoke" else 5,
            learning_rate=0.08, subsample=0.9, colsample_bytree=0.9,
            scale_pos_weight=_positive_weight(y_fit), eval_metric="logloss",
            random_state=42, n_jobs=1 if profile == "smoke" else -1,
        )
    raise ValueError(f"Unknown model: {name}")


def _new_pipeline(name: str, y_fit: pd.Series, *, profile: str) -> Pipeline:
    return Pipeline([
        ("preprocess", build_preprocessor()),
        ("model", make_model(name, y_fit, profile=profile)),
    ])


def _partition_digest(record_ids) -> str:
    return hashlib.sha256(json.dumps(np.asarray(record_ids).tolist()).encode("utf-8")).hexdigest()


def probability_metrics(y_true, probabilities) -> dict:
    """Threshold-free AP (average precision, not trapezoidal PR-AUC) and AUC."""
    return {
        "ap": float(average_precision_score(y_true, probabilities)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
    }


def compare_on_training(training: TrainingData, *, profile: str = "standard") -> dict:
    """Stage 1: five-fold comparison. No Test input, winner or threshold selection."""
    _validate_training(training, min_per_class=5)
    splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    # Materialize ONCE: every model uses these exact same positional indices.
    splits = tuple(splitter.split(training.x, training.y))
    results = {}
    for name in MODEL_NAMES:
        folds = []
        for fold_number, (fit_pos, valid_pos) in enumerate(splits, start=1):
            x_fit, y_fit = training.x.iloc[fit_pos], training.y.iloc[fit_pos]
            x_valid, y_valid = training.x.iloc[valid_pos], training.y.iloc[valid_pos]
            # A NEW preprocessor and classifier for every model/fold.
            pipe = _new_pipeline(name, y_fit, profile=profile)
            pipe.fit(x_fit, y_fit)
            probabilities = pipe.predict_proba(x_valid)[:, 1]
            folds.append({
                "fold": fold_number,
                "fit_rows": len(fit_pos), "validation_rows": len(valid_pos),
                "fit_ids_sha256": _partition_digest(training.record_ids[fit_pos]),
                "validation_ids_sha256": _partition_digest(training.record_ids[valid_pos]),
                "fit_class_counts": {str(label): int(y_fit.eq(label).sum()) for label in (0, 1)},
                "scale_pos_weight": _positive_weight(y_fit) if name == "XGBoost" else None,
                **probability_metrics(y_valid, probabilities),
            })
        summary = {
            f"{metric}_{stat}": float(operation([fold[metric] for fold in folds]))
            for metric in ("ap", "roc_auc")
            for stat, operation in (("mean", np.mean), ("std", np.std))
        }
        results[name] = {
            "folds": folds,
            "summary": summary,
            # Inputs for the official policy in Prompt 3; never the old Test formula.
            "selection_inputs": summary.copy(),
            "selection_score": None,
        }
    return {
        "dataset": DATASET,
        "contract_version": CONTRACT_VERSION,
        "profile": profile,
        "training_rows": len(training.x),
        "training_ids_sha256": _partition_digest(training.record_ids),
        "cv": {"n_splits": 5, "shuffle": True, "random_state": 42, "std_ddof": 0},
        "models": results,
        "selection_policy": "pending_prompt_3",
        "selected_model": None,
        "test_evaluated": False,
        "model_exported": False,
    }


def refit_selected_on_training(
    training: TrainingData, selected_name: str, *, profile: str = "standard",
) -> RefitModel:
    """Stage 2: fresh Pipeline fit on all Training after an external CV-only choice.

    The selection rule will be added in Prompt 3. This stage receives no Test data.
    """
    _validate_training(training)
    pipe = _new_pipeline(selected_name, training.y, profile=profile)
    pipe.fit(training.x, training.y)
    return RefitModel(pipe, selected_name, training.record_ids.copy(), profile)


def evaluate_on_test(fitted: RefitModel, test: HeldOutTest) -> dict:
    """Stage 3, opt-in by direct call AFTER selection/refit. Never called by CLI.

    No parameter, feature, preprocessing or threshold selection happens here.
    Prompt 2 tests this function only on a tiny artificial holdout.
    """
    if not isinstance(test, HeldOutTest):
        raise TypeError("Evaluation requires a separate HeldOutTest partition")
    if np.intersect1d(fitted.training_record_ids, test.record_ids).size:
        raise ValueError("Test IDs overlap the refit Training partition")
    return {
        "model": fitted.model_name,
        "rows": len(test.x),
        **probability_metrics(test.y, fitted.pipeline.predict_proba(test.x)[:, 1]),
    }


def resolve_csv(explicit, env_name: str, filename: str, data_dir=None) -> Path:
    """Explicit path > per-file env > data dir/env > repo/sibling discovery.

    An invalid explicit override fails; it never silently selects another file.
    Relative paths are interpreted relative to the process working directory.
    """
    override = explicit or os.environ.get(env_name)
    directory = data_dir or os.environ.get("HOME_CREDIT_DATA_DIR")
    if override:
        candidates = [Path(override)]
    elif directory:
        candidates = [Path(directory) / filename]
    else:
        repo = ROOT.parent
        candidates = [
            repo / "home-credit-default-risk" / filename,
            repo.parent / "home-credit-default-risk" / filename,
            ROOT / "data" / "home-credit-default-risk" / filename,
        ]
    candidates = [path.expanduser().resolve() for path in candidates]
    for path in candidates:
        if path.is_file():
            return path
    tried = "\n  ".join(str(path) for path in candidates)
    raise FileNotFoundError(
        f"Missing {filename}. Tried:\n  {tried}\n"
        f"Pass a CSV path or set {env_name} / HOME_CREDIT_DATA_DIR. No simulated fallback."
    )


def load_home_credit(application_csv=None, description_csv=None, data_dir=None):
    application_path = resolve_csv(application_csv, "HOME_CREDIT_APPLICATION_CSV", "application_train.csv", data_dir)
    # A supplied application path also locates its adjacent dictionary by default.
    dictionary_dir = data_dir
    if dictionary_dir is None and not os.environ.get("HOME_CREDIT_DATA_DIR"):
        dictionary_dir = application_path.parent
    description_path = resolve_csv(description_csv, "HOME_CREDIT_DESCRIPTION_CSV", "HomeCredit_columns_description.csv", dictionary_dir)
    if application_path.name.lower() != "application_train.csv":
        raise ValueError("This preparation step only accepts labeled application_train.csv")
    try:
        frame = pd.read_csv(application_path)
        # The official description file contains non-UTF8 bytes (e.g. accented words).
        descriptions = pd.read_csv(description_path, encoding="cp1252")
    except (ValueError, OSError, UnicodeError) as exc:
        raise ValueError(f"Could not read Home Credit CSVs ({application_path}, {description_path}): {exc}") from exc
    required = [ID_COLUMN, TARGET, *FEATURES, "AMT_INCOME_TOTAL"]
    missing = sorted(set(required) - set(frame.columns))
    if missing:
        raise ValueError(f"application_train.csv is missing required columns: {missing}")
    if frame.empty or frame[TARGET].isna().any() or set(frame[TARGET].unique()) != {0, 1}:
        raise ValueError("TARGET must be complete binary labels containing both 0 and 1")
    if frame[ID_COLUMN].isna().any() or frame[ID_COLUMN].duplicated().any():
        raise ValueError("SK_ID_CURR must be nonmissing and unique; duplicate application IDs found")
    if not {"Table", "Row", "Description"}.issubset(descriptions.columns):
        raise ValueError("Description CSV must contain Table, Row and Description columns")
    dictionary = descriptions[descriptions["Table"].eq("application_{train|test}.csv")]
    absent = sorted(set(required) - set(dictionary["Row"]))
    if absent:
        raise ValueError(f"Description CSV lacks application definitions for: {absent}")
    validate_features(frame.loc[:, FEATURES])
    return frame, dictionary, application_path, description_path


def audit_dataset(frame, dictionary, application_path, description_path) -> dict:
    special = {}
    for name in frame.select_dtypes(include=["object", "string"]).columns:
        counts = {value: int(frame[name].eq(value).sum()) for value in SPECIAL_CATEGORIES}
        if any(counts.values()):
            special[name] = {key: count for key, count in counts.items() if count}
    definitions = dictionary.set_index("Row")["Description"].to_dict()
    return {
        "dataset": DATASET,
        "contract_version": CONTRACT_VERSION,
        "application_csv": str(application_path),
        "description_csv": str(description_path),
        "rows": len(frame), "columns": len(frame.columns),
        "target_meaning": TARGET_MEANING,
        "target_counts": {str(key): int(count) for key, count in frame[TARGET].value_counts().sort_index().items()},
        "target_rates": {str(key): float(count) for key, count in frame[TARGET].value_counts(normalize=True).sort_index().items()},
        "duplicate_ids": int(frame[ID_COLUMN].duplicated().sum()),
        "missing_ids": int(frame[ID_COLUMN].isna().sum()),
        "missing_cells": int(frame.isna().sum().sum()),
        "columns_with_missing": int(frame.isna().any().sum()),
        "missing_by_column": {name: int(value) for name, value in frame.isna().sum().items()},
        "special_categories": special,
        "days_employed_365243": int(frame["DAYS_EMPLOYED"].eq(365243).sum()),
        "positive_relative_days": {
            name: int((frame[name] > 0).sum()) for name in frame if name.startswith("DAYS_")
        },
        "infinite_numeric_values": int(np.isinf(frame.select_dtypes(include="number").to_numpy()).sum()),
        "nonpositive_amounts": {
            name: int((frame[name] <= 0).sum()) for name in ("AMT_CREDIT", "AMT_INCOME_TOTAL", "AMT_ANNUITY")
        },
        "numeric_features": NUMERIC, "categorical_features": CATEGORICAL,
        "dictionary": {name: definitions.get(name) for name in frame.columns},
        "status": "preparation_only_no_model_evaluation_or_export",
    }


def smoke_pipeline(frame: pd.DataFrame, sample_size: int = 256) -> dict:
    if sample_size < 10:
        raise ValueError("sample_size must be at least 10")
    # Stratified small sample; split BEFORE learning imputers/scaler/categories.
    if len(frame) > sample_size:
        sample, _ = train_test_split(frame, train_size=sample_size, stratify=frame[TARGET], random_state=42)
    else:
        sample = frame
    train, valid = train_test_split(sample, test_size=0.25, stratify=sample[TARGET], random_state=42)
    preprocessor = build_preprocessor()
    transformed_train = preprocessor.fit_transform(train.loc[:, FEATURES], train[TARGET])
    transformed_valid = preprocessor.transform(valid.loc[:, FEATURES])
    for values in (transformed_train, transformed_valid):
        dense = values.toarray() if hasattr(values, "toarray") else values
        if not np.isfinite(dense).all():
            raise ValueError("Pipeline produced non-finite values")
    return {
        "sample_rows": len(sample), "fit_rows": len(train), "transform_rows": len(valid),
        "train_shape": list(transformed_train.shape), "validation_shape": list(transformed_valid.shape),
        "feature_names": preprocessor.get_feature_names_out().tolist(),
        "classifier_fitted": False, "model_exported": False,
    }


def make_smoke_frame(n: int = 150) -> pd.DataFrame:
    """Artificial data ONLY for executable CV checks, never a CSV error fallback."""
    if n < 50:
        raise ValueError("CV smoke requires at least 50 artificial rows")
    rng = np.random.default_rng(42)
    target = (np.arange(n) % 5 == 0).astype(int)
    annuity = rng.uniform(500, 5000, n)
    annuity[::11] = np.nan
    employed = -rng.integers(0, 10000, n)
    employed[::13] = 365243
    return pd.DataFrame({
        ID_COLUMN: np.arange(100000, 100000 + n), TARGET: target,
        "AMT_CREDIT": rng.uniform(50000, 500000, n),
        "AMT_ANNUITY": annuity,
        "DAYS_BIRTH": -rng.integers(7000, 25000, n),
        "DAYS_EMPLOYED": employed,
        "NAME_CONTRACT_TYPE": rng.choice(["Cash loans", "Revolving loans"], n),
        "OCCUPATION_TYPE": rng.choice(["Laborers", "Managers", None], n),
    })


def run_cv_smoke(sample_size: int = 150) -> dict:
    training, test = split_training_test(make_smoke_frame(sample_size))
    report = compare_on_training(training, profile="smoke")
    report["dataset"] = "artificial_home_credit_contract_fixture_NOT_REAL_CSV"
    report["input_rows"] = sample_size
    report["held_out_rows"] = len(test.record_ids)
    report["refit_performed"] = False
    # HeldOutTest is neither passed to comparison nor evaluated.
    return report


def train_and_export(*args, **kwargs):
    raise RuntimeError(
        "Automatic training/evaluation/export is disabled. "
        "Run training/train.py --mode cv for Training-only CV comparison, "
        "or --mode cv-smoke for artificial-data checks. "
        "Keep the existing synthetic serving artifacts until inference contracts are migrated."
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("prepare", "cv", "cv-smoke"), default="prepare")
    parser.add_argument("--application-csv")
    parser.add_argument("--description-csv")
    parser.add_argument("--data-dir")
    parser.add_argument("--sample-size", type=int, default=256, help="Preparation/CV-smoke sample size; real CV uses ALL Training")
    parser.add_argument("--report", type=Path, help="Optional preparation/CV JSON (no model artifacts)")
    args = parser.parse_args()
    try:
        if args.mode == "cv-smoke":
            if args.application_csv or args.description_csv or args.data_dir:
                raise ValueError("cv-smoke only uses artificial test data; CSV arguments are not accepted")
            report = run_cv_smoke(args.sample_size)
        else:
            frame, dictionary, application_path, description_path = load_home_credit(
                args.application_csv, args.description_csv, args.data_dir
            )
            # The internal Test is held aside before any fit, even preprocessing smoke.
            training, held_out = split_training_test(frame)
            if args.mode == "cv":
                report = compare_on_training(training)
                report["application_csv"] = str(application_path)
                report["description_csv"] = str(description_path)
            else:
                report = audit_dataset(frame, dictionary, application_path, description_path)
                training_frame = training.x.assign(**{TARGET: training.y})
                report["pipeline_smoke"] = smoke_pipeline(training_frame, args.sample_size)
            report["split"] = {
                "training_rows": len(training.x), "held_out_rows": len(held_out.record_ids),
                "test_size": 0.2, "stratify": TARGET, "random_state": 42,
            }
            report["test_evaluated"] = False
        if args.report:
            # Do not let a preparation report overwrite the active model or metadata.
            report_path = args.report.resolve()
            if "artifacts" in report_path.parts or report_path.suffix.lower() != ".json":
                raise ValueError("Write audit reports to a .json outside artifacts directories")
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        summary = {key: value for key, value in report.items() if key not in {"dictionary", "missing_by_column"}}
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Home Credit preparation failed: {exc}\n")


if __name__ == "__main__":
    main()
