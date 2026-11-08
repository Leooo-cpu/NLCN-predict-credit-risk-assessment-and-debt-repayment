"""Prepare labeled Home Credit data only; evaluation/export are gated for now."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from app.home_credit_features import (
    CATEGORICAL, CONTRACT_VERSION, DATASET, FEATURES, ID_COLUMN, NUMERIC,
    SPECIAL_CATEGORIES, TARGET, TARGET_MEANING, build_preprocessor, validate_features,
)


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


def train_and_export(*args, **kwargs):
    raise RuntimeError(
        "Home Credit training/evaluation/export is disabled in this preparation step. "
        "Run training/train.py for CSV audit and preprocessing smoke test. "
        "Keep the existing synthetic serving artifacts until inference contracts are migrated."
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--application-csv")
    parser.add_argument("--description-csv")
    parser.add_argument("--data-dir")
    parser.add_argument("--sample-size", type=int, default=256)
    parser.add_argument("--report", type=Path, help="Optional audit JSON (no model artifacts)")
    args = parser.parse_args()
    try:
        frame, dictionary, application_path, description_path = load_home_credit(
            args.application_csv, args.description_csv, args.data_dir
        )
        report = audit_dataset(frame, dictionary, application_path, description_path)
        report["pipeline_smoke"] = smoke_pipeline(frame, args.sample_size)
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
