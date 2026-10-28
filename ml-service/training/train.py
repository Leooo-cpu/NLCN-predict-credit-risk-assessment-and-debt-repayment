from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from training.generate_data import generate_simulated_dataset

NUMERIC = [
    "age",
    "monthly_income",
    "years_employed",
    "requested_amount",
    "term_months",
    "current_debt",
    "existing_loans",
    "late_payments",
    "dti",
    "loan_to_income",
    "debt_burden",
]
CATEGORICAL = ["occupation", "credit_history", "purpose"]
TARGET = "default"


def build_preprocessor() -> ColumnTransformer:
    numeric_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipe, NUMERIC),
            ("cat", categorical_pipe, CATEGORICAL),
        ]
    )


def evaluate(y_true, y_proba, threshold: float = 0.5) -> dict:
    y_pred = (y_proba >= threshold).astype(int)
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_proba)),
        "pr_auc": float(average_precision_score(y_true, y_proba)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "selection_score": float(
            0.45 * roc_auc_score(y_true, y_proba)
            + 0.35 * average_precision_score(y_true, y_proba)
            + 0.20 * f1_score(y_true, y_pred, zero_division=0)
        ),
    }


def candidate_models(pos_weight: float) -> dict:
    return {
        "LogisticRegression": LogisticRegression(
            max_iter=400, class_weight="balanced", solver="lbfgs"
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=120,
            max_depth=10,
            min_samples_leaf=4,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=160,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            scale_pos_weight=pos_weight,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        ),
    }


def save_plots(y_true, y_proba, y_pred, feature_names, importances, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    fpr, tpr, _ = roc_curve(y_true, y_proba)
    plt.figure()
    plt.plot(fpr, tpr)
    plt.plot([0, 1], [0, 1], linestyle="--")
    plt.title("ROC Curve (dữ liệu mô phỏng)")
    plt.xlabel("FPR")
    plt.ylabel("TPR")
    plt.savefig(out_dir / "roc_curve.png", bbox_inches="tight")
    plt.close()

    precision, recall, _ = precision_recall_curve(y_true, y_proba)
    plt.figure()
    plt.plot(recall, precision)
    plt.title("Precision-Recall Curve (dữ liệu mô phỏng)")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.savefig(out_dir / "pr_curve.png", bbox_inches="tight")
    plt.close()

    cm = confusion_matrix(y_true, y_pred)
    plt.figure()
    plt.imshow(cm, cmap="Blues")
    plt.title("Confusion Matrix (dữ liệu mô phỏng)")
    plt.colorbar()
    for (i, j), value in np.ndenumerate(cm):
        plt.text(j, i, str(value), ha="center", va="center")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.savefig(out_dir / "confusion_matrix.png", bbox_inches="tight")
    plt.close()

    if importances is not None and feature_names is not None:
        order = np.argsort(importances)[-15:]
        plt.figure(figsize=(8, 6))
        plt.barh(np.array(feature_names)[order], np.array(importances)[order])
        plt.title("Feature Importance (dữ liệu mô phỏng)")
        plt.savefig(out_dir / "feature_importance.png", bbox_inches="tight")
        plt.close()

    try:
        import shap

        # Placeholder summary file note if shap plots need fitted pipeline later
        (out_dir / "shap_note.txt").write_text(
            "SHAP summary plot được tạo khi có TreeExplainer trên mô hình ACTIVE.\nDữ liệu mô phỏng.",
            encoding="utf-8",
        )
    except Exception:
        pass


def train_and_export(artifact_dir: str | os.PathLike | None = None) -> dict:
    root = Path(artifact_dir or Path(__file__).resolve().parents[1] / "artifacts")
    root.mkdir(parents=True, exist_ok=True)
    plots = root / "plots"
    data_dir = Path(__file__).resolve().parents[1] / "data"
    data_dir.mkdir(exist_ok=True)

    frame = generate_simulated_dataset()
    frame.to_csv(data_dir / "simulated_credit_risk.csv", index=False)

    x = frame[NUMERIC + CATEGORICAL]
    y = frame[TARGET]
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, stratify=y, random_state=42
    )
    pos = max(int((y_train == 1).sum()), 1)
    neg = max(int((y_train == 0).sum()), 1)
    pos_weight = neg / pos

    results = {}
    best_name = None
    best_score = -1.0
    best_pipeline = None
    best_metrics = None

    for name, model in candidate_models(pos_weight).items():
        pipe = Pipeline(steps=[("preprocess", build_preprocessor()), ("model", model)])
        pipe.fit(x_train, y_train)
        proba = pipe.predict_proba(x_test)[:, 1]
        metrics = evaluate(y_test, proba)
        results[name] = metrics
        if metrics["selection_score"] > best_score:
            best_score = metrics["selection_score"]
            best_name = name
            best_pipeline = pipe
            best_metrics = metrics

    # Stratified K-Fold sanity check on winner
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_auc = []
    for fold_train, fold_valid in cv.split(x_train, y_train):
        fold_pipe = Pipeline(
            steps=[("preprocess", build_preprocessor()), ("model", candidate_models(pos_weight)[best_name])]
        )
        fold_pipe.fit(x_train.iloc[fold_train], y_train.iloc[fold_train])
        fold_proba = fold_pipe.predict_proba(x_train.iloc[fold_valid])[:, 1]
        cv_auc.append(float(roc_auc_score(y_train.iloc[fold_valid], fold_proba)))

    y_proba = best_pipeline.predict_proba(x_test)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)
    try:
        feature_names = list(best_pipeline.named_steps["preprocess"].get_feature_names_out())
    except Exception:
        feature_names = NUMERIC + CATEGORICAL
    model = best_pipeline.named_steps["model"]
    importances = getattr(model, "feature_importances_", None)
    if importances is None and hasattr(model, "coef_"):
        importances = np.abs(model.coef_[0])
    save_plots(y_test, y_proba, y_pred, feature_names, importances, plots)

    try:
        import shap

        sample = x_test.sample(n=min(120, len(x_test)), random_state=42)
        transformed = best_pipeline.named_steps["preprocess"].transform(sample)
        if hasattr(model, "predict_proba") and type(model).__name__ == "LogisticRegression":
            explainer = shap.LinearExplainer(model, transformed)
        else:
            explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(transformed)
        if isinstance(shap_values, list):
            shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]
        plt.figure()
        shap.summary_plot(shap_values, transformed, feature_names=feature_names, show=False)
        plt.tight_layout()
        plt.savefig(plots / "shap_summary.png", bbox_inches="tight")
        plt.close()
        (plots / "shap_note.txt").write_text(
            f"SHAP summary plot được tạo thành công cho mô hình ACTIVE ({best_name}).\nDữ liệu mô phỏng.",
            encoding="utf-8",
        )
    except Exception as exc:
        (plots / "shap_summary_error.txt").write_text(str(exc), encoding="utf-8")

    metadata = {
        "version": "1.0.0-sim",
        "algorithm": best_name,
        "training_dataset": "Dữ liệu mô phỏng nội bộ (synthetic_credit_risk)",
        "n_rows": int(len(frame)),
        "class_balance": {
            "good_repayment_0": int((y == 0).sum()),
            "default_risk_1": int((y == 1).sum()),
        },
        "metrics": best_metrics,
        "all_models": results,
        "cv_roc_auc_mean": float(np.mean(cv_auc)),
        "selection_rule": "0.45*ROC-AUC + 0.35*PR-AUC + 0.20*F1 (không chọn theo Accuracy)",
        "credit_score_formula": "850 - 550 * default_probability (điểm mô phỏng)",
        "thresholds": {"LOW_RISK": 0.20, "MEDIUM_RISK": 0.45},
    }
    joblib.dump(best_pipeline, root / "credit_pipeline.joblib")
    (root / "model_metadata.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    return metadata


if __name__ == "__main__":
    info = train_and_export()
    print(json.dumps({"best": info["algorithm"], "metrics": info["metrics"]}, ensure_ascii=False, indent=2))
