from __future__ import annotations

import hashlib
import json
from pathlib import Path

import joblib
import numpy as np

from app.config import get_settings
from app.home_credit_features import (
    CONTRACT_VERSION, DATASET, FEATURES, FEATURE_SPEC, TARGET_MEANING, frame_from_values,
)
from app.schemas import PredictRequest, PredictResponse

_PIPELINE = None
_METADATA: dict = {}


def load_bundle(directory: Path):
    directory = Path(directory)
    info = json.loads((directory / "model_metadata.json").read_text(encoding="utf-8"))
    binary = directory / "credit_pipeline.joblib"
    if info.get("contract_version") != CONTRACT_VERSION or info.get("features") != FEATURES:
        raise ValueError("Model input contract does not match the Home Credit API")
    if info.get("input_specification") != FEATURE_SPEC or info.get("amount_unit") != "HOME_CREDIT_SOURCE":
        raise ValueError("Model input types/units/missing-value contract does not match the API")
    if info.get("training_dataset") != DATASET or info.get("positive_class") != 1:
        raise ValueError("Model source or positive class does not match Home Credit")
    if hashlib.sha256(binary.read_bytes()).hexdigest() != info.get("pipeline_sha256"):
        raise ValueError("Pipeline checksum mismatch")
    pipeline = joblib.load(binary)
    if list(pipeline.feature_names_in_) != FEATURES or list(pipeline.classes_) != [0, 1]:
        raise ValueError("Saved pipeline features/classes do not match metadata")
    return pipeline, info


def _ensure_loaded():
    global _PIPELINE, _METADATA
    if _PIPELINE is None:
        settings = get_settings()
        root = Path(settings.artifact_dir)
        pointer = root / "active_model.json"
        if not pointer.is_file():
            raise FileNotFoundError("No validated active Home Credit model. Run training.activate after version training; never retrain at startup.")
        active = json.loads(pointer.read_text(encoding="utf-8"))
        directory = (root / active["relative_dir"]).resolve()
        if not directory.is_relative_to(root.resolve() / "versions"):
            raise ValueError("Active model must be inside artifacts/versions")
        pipeline, info = load_bundle(directory)
        if info["version"] != active["version"]:
            raise ValueError("Active model version mismatch")
        _PIPELINE, _METADATA = pipeline, info


def request_to_frame(payload: PredictRequest):
    return frame_from_values(payload.model_dump())


def predict(payload: PredictRequest) -> PredictResponse:
    _ensure_loaded()
    frame = request_to_frame(payload)
    probability = float(_PIPELINE.predict_proba(frame)[0, 1])
    if not np.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError("Model returned an invalid probability")
    cleaned = _PIPELINE.named_steps["preprocess"].named_steps["clean"].transform(frame)
    missing = cleaned.columns[cleaned.isna().iloc[0]].tolist()
    return PredictResponse(
        payment_difficulty_probability=probability,
        other_outcome_probability=1 - probability,
        predicted_payment_difficulty=probability >= _METADATA["classification_threshold"],
        classification_threshold=_METADATA["classification_threshold"],
        # Legacy risk-band defaults are deliberately not applied to Home Credit.
        risk_level="NOT_VALIDATED", risk_bands_validated=False,
        credit_score=round(max(300, min(850, 850 - 550 * probability)), 2),
        model_version=_METADATA["version"], algorithm=_METADATA["algorithm"],
        data_source=_METADATA["training_dataset"], outcome_definition=TARGET_MEANING["1"],
        imputed_features=missing,
    )


def metadata() -> dict:
    _ensure_loaded()
    return _METADATA


def input_contract() -> dict:
    _ensure_loaded()
    specs = {name: dict(spec) for name, spec in FEATURE_SPEC.items()}
    encoder = _PIPELINE.named_steps["preprocess"].named_steps["columns"].named_transformers_["cat"].named_steps["encoder"]
    specs["OCCUPATION_TYPE"]["choices"] = [value for value in encoder.categories_[1].tolist() if value != "__MISSING__"]
    return {
        "contract_version": CONTRACT_VERSION, "features": specs,
        "amount_unit": "HOME_CREDIT_SOURCE", "json_schema": PredictRequest.model_json_schema(),
        "missing_policy": "Every key required. Explicit null only for nullable fields; fitted Pipeline imputes it.",
    }


def sample_request() -> dict:
    _ensure_loaded()
    root = Path(get_settings().artifact_dir)
    # Use the version actually loaded by this worker; activation requires restart.
    sample = json.loads((root / "versions" / _METADATA["version"] / "sample_request.json").read_text(encoding="utf-8"))
    return PredictRequest.model_validate(sample).model_dump()
