"""Import labeled Home Credit cases; back up and replace synthetic demo records.

No training, Test evaluation or automatic predictions happen during import.
"""
import argparse
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path

import pandas as pd
from sqlalchemy import or_, select

from app.database import SessionLocal, engine, init_db
from app.models.credit_case import CreditCase
from app.models.customer import Customer
from app.models.loan_application import LoanApplication
from app.models.model_prediction import ModelPrediction
from app.models.model_registry import ModelRegistry

FEATURES = ["AMT_CREDIT", "AMT_ANNUITY", "DAYS_BIRTH", "DAYS_EMPLOYED", "NAME_CONTRACT_TYPE", "OCCUPATION_TYPE"]


def json_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(type(value).__name__)


def synthetic_selection(db):
    customer_ids = select(Customer.id).where(Customer.is_simulated.is_(True))
    loans = db.query(LoanApplication).filter(or_(LoanApplication.is_simulated.is_(True), LoanApplication.customer_id.in_(customer_ids)))
    loan_ids = select(LoanApplication.id).where(or_(LoanApplication.is_simulated.is_(True), LoanApplication.customer_id.in_(customer_ids)))
    predictions = db.query(ModelPrediction).filter(or_(ModelPrediction.loan_application_id.in_(loan_ids), ModelPrediction.model_version.like("%-sim")))
    return predictions, loans, db.query(Customer).filter(Customer.is_simulated.is_(True))


def backup_synthetic(db, directory):
    predictions, loans, customers = synthetic_selection(db)
    snapshot = {}
    for name, query in (("model_predictions", predictions), ("loan_applications", loans), ("customers", customers)):
        snapshot[name] = [{column.name: getattr(row, column.name) for column in row.__table__.columns} for row in query.all()]
    snapshot["model_registry"] = [
        {column.name: getattr(row, column.name) for column in row.__table__.columns}
        for row in db.query(ModelRegistry).filter(ModelRegistry.version.like("%-sim")).all()
    ]
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    filename = directory / f"synthetic-before-home-credit-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}.json"
    with filename.open("x", encoding="utf-8") as output:
        json.dump(snapshot, output, default=json_value, ensure_ascii=True, indent=2)
    # Verify the backup before any delete. Transaction rollback preserves data if later import fails.
    check = json.loads(filename.read_text(encoding="utf-8"))
    assert {key: len(value) for key, value in check.items()} == {key: len(value) for key, value in snapshot.items()}
    return filename, {key: len(value) for key, value in snapshot.items()}


def import_csv(csv_path, *, replace_synthetic=False, backup_dir=None):
    csv_path = Path(csv_path).resolve()
    if not csv_path.is_file():
        raise FileNotFoundError(f"Missing labeled application_train.csv: {csv_path}")
    if csv_path.name.lower() != "application_train.csv":
        raise ValueError("Only application_train.csv is accepted; application_test.csv has no public labels")
    if replace_synthetic and backup_dir is None:
        raise ValueError("--replace-synthetic requires --backup-dir before deleting anything")
    init_db()
    with SessionLocal() as db:
        before = db.query(CreditCase).count()
        backup_file, counts = backup_synthetic(db, backup_dir) if replace_synthetic else (None, {})
        seen = set()
        for frame in pd.read_csv(csv_path, usecols=["SK_ID_CURR", "TARGET", *FEATURES], chunksize=2000):
            rows = []
            for raw in frame.to_dict(orient="records"):
                source_id, label = raw["SK_ID_CURR"], raw["TARGET"]
                if pd.isna(source_id) or int(source_id) != source_id or source_id in seen or label not in (0, 1):
                    raise ValueError("CSV contains missing/duplicate/noninteger IDs or invalid TARGET")
                seen.add(source_id)
                values = {name: None if pd.isna(raw[name]) else raw[name] for name in FEATURES}
                for name in ("DAYS_BIRTH", "DAYS_EMPLOYED"):
                    if values[name] is not None:
                        if int(values[name]) != values[name]:
                            raise ValueError(f"Noninteger source days: {name}")
                        values[name] = int(values[name])
                if values["AMT_CREDIT"] is None or values["DAYS_BIRTH"] is None or not values["NAME_CONTRACT_TYPE"]:
                    raise ValueError(f"Missing required source values in Home Credit application {source_id}")
                if (values["AMT_CREDIT"] <= 0 or values["DAYS_BIRTH"] >= 0
                    or (values["AMT_ANNUITY"] is not None and values["AMT_ANNUITY"] <= 0)
                    or (values["DAYS_EMPLOYED"] is not None and values["DAYS_EMPLOYED"] > 0 and values["DAYS_EMPLOYED"] != 365243)
                    or values["NAME_CONTRACT_TYPE"] not in {"Cash loans", "Revolving loans"}):
                    raise ValueError(f"Invalid Home Credit source values in application {source_id}")
                values["amount_unit"] = "HOME_CREDIT_SOURCE"
                rows.append({"source_application_id": int(source_id), "display_name": f"Hồ sơ Home Credit #{int(source_id)}",
                             "source": "Home Credit Default Risk / application_train.csv", "inputs_json": values,
                             "input_revision": 1, "reference_target": int(label)})
            if engine.dialect.name == "postgresql":
                from sqlalchemy.dialects.postgresql import insert
            elif engine.dialect.name == "sqlite":
                from sqlalchemy.dialects.sqlite import insert
            else:
                raise ValueError("Importer supports PostgreSQL and SQLite")
            # Repeat imports are safe: existing edits and prediction histories are never reset.
            statement = insert(CreditCase).values(rows).on_conflict_do_nothing(index_elements=["source_application_id"])
            db.execute(statement)
            if len(seen) % 20000 == 0:
                print(f"Read {len(seen)} labeled Home Credit applications", flush=True)
        if not seen:
            raise ValueError("CSV is empty; refusing to delete synthetic data")
        if replace_synthetic:
            predictions, loans, customers = synthetic_selection(db)
            predictions.delete(synchronize_session=False)
            loans.delete(synchronize_session=False)
            customers.delete(synchronize_session=False)
            db.query(ModelRegistry).filter(ModelRegistry.version.like("%-sim"), ~ModelRegistry.id.in_(
                select(ModelPrediction.model_registry_id).where(ModelPrediction.model_registry_id.is_not(None))
            )).delete(synchronize_session=False)
        db.commit()
        after = db.query(CreditCase).count()
        result = {"source": str(csv_path), "source_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
                  "csv_rows": len(seen), "new_cases": after - before, "total_cases": after,
                  "backup_file": str(backup_file) if backup_file else None, "backed_up_synthetic": counts,
                  "synthetic_remaining": {"customers": db.query(Customer).filter(Customer.is_simulated.is_(True)).count(),
                                          "predictions": db.query(ModelPrediction).filter(ModelPrediction.model_version.like("%-sim")).count()},
                  "predictions_generated": 0, "target_sent_to_model": False}
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--replace-synthetic", action="store_true")
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    result = import_csv(args.csv, replace_synthetic=args.replace_synthetic, backup_dir=args.backup_dir)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
