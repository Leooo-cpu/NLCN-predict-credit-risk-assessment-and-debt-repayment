"""Reload/version-contract/API checks first; atomically activate only on success."""
import argparse
import json
import os
from pathlib import Path

from fastapi.testclient import TestClient

from app import scoring
from app.config import get_settings
from app.main import app
from training.train import ROOT


def verify_and_activate(version: str, artifact_root=None):
    root = Path(artifact_root or get_settings().artifact_dir).resolve()
    directory = (root / "versions" / version).resolve()
    if not directory.is_relative_to(root / "versions"):
        raise ValueError("Version path must stay inside artifacts/versions")
    pipeline, info = scoring.load_bundle(directory)
    if info["version"] != version:
        raise ValueError("Requested version does not match saved metadata")
    sample = json.loads((directory / "sample_request.json").read_text(encoding="utf-8"))
    assert not {"TARGET", "SK_ID_CURR"} & set(sample)
    scoring._PIPELINE, scoring._METADATA = pipeline, info
    with TestClient(app) as client:
        valid = client.post("/predict", json=sample)
        if valid.status_code != 200:
            raise ValueError(f"Candidate API verification failed: {valid.text}")
        if valid.json()["model_version"] != version:
            raise ValueError("API returned a different version")
        missing = dict(sample)
        missing.pop("AMT_CREDIT")
        missing_response = client.post("/predict", json=missing)
        forbidden_response = client.post("/predict", json={**sample, "TARGET": 1, "SK_ID_CURR": 100001})
        if missing_response.status_code != 422 or forbidden_response.status_code != 422:
            raise ValueError("Candidate API schema validation did not reject missing/leaking fields")
        report = {
            "version": version, "pipeline_reloaded": True,
            "valid_request_status": valid.status_code, "missing_field_status": missing_response.status_code,
            "forbidden_fields_status": forbidden_response.status_code, "prediction": valid.json(),
            "sample_source": "one Training record, features only; TARGET/SK_ID_CURR excluded",
        }
    (directory / "activation_checks.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    pending = root / "active_model.pending.json"
    pending.write_text(json.dumps({"version": version, "relative_dir": f"versions/{version}"}), encoding="utf-8")
    os.replace(pending, root / "active_model.json")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--artifact-root", type=Path)
    args = parser.parse_args()
    print(json.dumps(verify_and_activate(args.version, args.artifact_root), indent=2, ensure_ascii=True))
