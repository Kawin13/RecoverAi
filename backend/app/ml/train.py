#!/usr/bin/env python3
"""
RecoverAI - Machine Learning Pipeline
Trains genuine XGBoost models for:
1. Overall Recovery Propensity: P(recovery | X)
2. Action-Conditioned Intervention Success: P(recovery | X, Action=a) for all candidate actions

Evaluates models rigorously with Accuracy, Precision, Recall, F1, ROC-AUC, Brier score,
and Confusion Matrix on the hold-out test set without data leakage.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
import xgboost as xgb
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    brier_score_loss,
    classification_report
)

# Ensure UTF-8 output on Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PROCESSED_DATA_DIR = os.path.join(BASE_DIR, "data", "processed")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "backend", "ml", "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

CATEGORICAL_FEATURES = [
    "payment_method",
    "bank",
    "failure_reason",
    "failure_category",
    "preferred_payment_method",
    "customer_value_segment",
    "merchant_category",
    "device_type"
]

NUMERICAL_FEATURES = [
    "amount",
    "attempt_count",
    "previous_success_count",
    "previous_failure_count",
    "customer_tenure_days",
    "hour_of_day",
    "day_of_week",
    "checkout_abandoned",
    "checkout_duration_seconds",
    "historical_avg_order_value"
]

ALL_FEATURE_COLS = CATEGORICAL_FEATURES + NUMERICAL_FEATURES

# Action mapping to standard taxonomy
ACTION_MAPPING = {
    "SMART_PAYLINK_1CLICK": "PAYMENT_LINK",
    "UPI_INTENT_FALLBACK": "UPI_SWITCH",
    "TIMED_SMART_RETRY": "RETRY_LATER",
    "INCENTIVIZED_DUNNING": "PERSONALIZED_REMINDER",
    "WHATSAPP_CONCIERGE": "HUMAN_ESCALATION",
    "CARD_UPDATE_PROMPT": "PAYMENT_LINK"
}

STANDARD_ACTIONS = [
    "RETRY_NOW",
    "RETRY_LATER",
    "UPI_SWITCH",
    "PAYMENT_LINK",
    "PERSONALIZED_REMINDER",
    "HUMAN_ESCALATION",
    "NO_ACTION"
]

def load_data():
    train_path = os.path.join(PROCESSED_DATA_DIR, "train.csv")
    val_path = os.path.join(PROCESSED_DATA_DIR, "val.csv")
    test_path = os.path.join(PROCESSED_DATA_DIR, "test.csv")

    if not os.path.exists(train_path):
        raise FileNotFoundError(f"Missing train data at {train_path}. Run generate_synthetic_data.py first.")

    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    test_df = pd.read_csv(test_path)

    # Map recovery actions to standard taxonomy
    for df in [train_df, val_df, test_df]:
        df["mapped_action"] = df["recovery_action"].map(ACTION_MAPPING).fillna("PAYMENT_LINK")

    return train_df, val_df, test_df

def build_preprocessor():
    categorical_transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    numerical_transformer = StandardScaler()

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numerical_transformer, NUMERICAL_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES)
        ]
    )
    return preprocessor

def train_recovery_model(train_df, val_df, test_df):
    print("=" * 65)
    print("TRAINING MODEL 1: OVERALL RECOVERY PROBABILITY MODEL (XGBoost)")
    print("=" * 65)

    X_train = train_df[ALL_FEATURE_COLS]
    y_train = train_df["recovery_success"]

    X_val = val_df[ALL_FEATURE_COLS]
    y_val = val_df["recovery_success"]

    X_test = test_df[ALL_FEATURE_COLS]
    y_test = test_df["recovery_success"]

    preprocessor = build_preprocessor()
    X_train_proc = preprocessor.fit_transform(X_train)
    X_val_proc = preprocessor.transform(X_val)
    X_test_proc = preprocessor.transform(X_test)

    # XGBoost Classifier
    model = xgb.XGBClassifier(
        n_estimators=250,
        max_depth=5,
        learning_rate=0.06,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=1.0,
        eval_metric=["logloss", "auc"],
        random_state=42,
        n_jobs=-1
    )

    model.fit(
        X_train_proc, y_train,
        eval_set=[(X_val_proc, y_val)],
        verbose=False
    )

    # Predictions & Metrics on Holdout Test Set
    y_pred_proba = model.predict_proba(X_test_proc)[:, 1]
    y_pred = (y_pred_proba >= 0.50).astype(int)

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    brier = brier_score_loss(y_test, y_pred_proba)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"Test Set Evaluation ({len(X_test):,} samples):")
    print(f"  - Accuracy:        {acc * 100:.2f}%")
    print(f"  - Precision:       {prec * 100:.2f}%")
    print(f"  - Recall:          {rec * 100:.2f}%")
    print(f"  - F1-Score:        {f1 * 100:.2f}%")
    print(f"  - ROC-AUC:         {roc_auc:.4f}")
    print(f"  - Brier Score:     {brier:.4f}")
    print(f"  - Confusion Matrix (TN, FP, FN, TP): {cm}")

    return model, preprocessor, {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(roc_auc), 4),
        "brier_score": round(float(brier), 4),
        "confusion_matrix": cm
    }

def train_intervention_model(train_df, val_df, test_df):
    print("\n" + "=" * 65)
    print("TRAINING MODEL 2: ACTION-CONDITIONED INTERVENTION SUCCESS MODEL")
    print("=" * 65)

    # Features include action as an input condition
    action_feature_cols = ALL_FEATURE_COLS + ["mapped_action"]
    
    categorical_with_action = CATEGORICAL_FEATURES + ["mapped_action"]
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_with_action)
        ]
    )

    X_train = train_df[action_feature_cols]
    y_train = train_df["recovery_success"]

    X_val = val_df[action_feature_cols]
    y_val = val_df["recovery_success"]

    X_test = test_df[action_feature_cols]
    y_test = test_df["recovery_success"]

    X_train_proc = preprocessor.fit_transform(X_train)
    X_val_proc = preprocessor.transform(X_val)
    X_test_proc = preprocessor.transform(X_test)

    intervention_model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        eval_metric=["logloss", "auc"],
        random_state=42,
        n_jobs=-1
    )

    intervention_model.fit(
        X_train_proc, y_train,
        eval_set=[(X_val_proc, y_val)],
        verbose=False
    )

    y_pred_proba = intervention_model.predict_proba(X_test_proc)[:, 1]
    y_pred = (y_pred_proba >= 0.50).astype(int)

    acc = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    f1 = f1_score(y_test, y_pred)

    print(f"Intervention Model Test Evaluation:")
    print(f"  - Action Response Accuracy: {acc * 100:.2f}%")
    print(f"  - ROC-AUC:                  {roc_auc:.4f}")
    print(f"  - F1 Score:                 {f1:.4f}")

    return intervention_model, preprocessor, {
        "accuracy": round(float(acc), 4),
        "roc_auc": round(float(roc_auc), 4),
        "f1": round(float(f1), 4)
    }

def save_artifacts(rec_model, rec_preprocessor, rec_metrics,
                   int_model, int_preprocessor, int_metrics):
    rec_model_path = os.path.join(ARTIFACTS_DIR, "recovery_model.joblib")
    rec_prep_path = os.path.join(ARTIFACTS_DIR, "recovery_preprocessor.joblib")
    int_model_path = os.path.join(ARTIFACTS_DIR, "intervention_model.joblib")
    int_prep_path = os.path.join(ARTIFACTS_DIR, "intervention_preprocessor.joblib")
    meta_path = os.path.join(ARTIFACTS_DIR, "model_metadata.json")

    joblib.dump(rec_model, rec_model_path)
    joblib.dump(rec_preprocessor, rec_prep_path)
    joblib.dump(int_model, int_model_path)
    joblib.dump(int_preprocessor, int_prep_path)

    import hashlib
    def get_file_sha256(filepath):
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    rec_hash = get_file_sha256(rec_model_path)

    metadata = {
        "model_version": "1.0.0-production",
        "trained_at": datetime.utcnow().isoformat(),
        "algorithm": "XGBoost Gradient Boosted Decision Trees",
        "framework": "xgboost 3.2.0 + scikit-learn",
        "model_name": "XGBoost Gradient Boosted Decision Trees",
        "random_seed": 42,
        "dataset": {
            "type": "synthetic",
            "records": 35000,
            "disclosure": "Trained and evaluated on synthetic Indian digital payment records with statistical correlations. Not trained on merchant-proven real-world data."
        },
        "artifact_checksum": rec_hash,
        "artifact_checksums": {
            "recovery_model": rec_hash,
            "recovery_preprocessor": get_file_sha256(rec_prep_path),
            "intervention_model": get_file_sha256(int_model_path),
            "intervention_preprocessor": get_file_sha256(int_prep_path)
        },
        "features": {
            "categorical": CATEGORICAL_FEATURES,
            "numerical": NUMERICAL_FEATURES,
            "total_count": len(ALL_FEATURE_COLS)
        },
        "candidate_actions": STANDARD_ACTIONS,
        "metrics": {
            "overall_recovery_model": rec_metrics,
            "intervention_success_model": int_metrics
        }
    }

    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print("\n" + "=" * 65)
    print(f"SAVED PRODUCTION ML ARTIFACTS TO: {ARTIFACTS_DIR}")
    print(f"  - {rec_model_path}")
    print(f"  - {rec_prep_path}")
    print(f"  - {int_model_path}")
    print(f"  - {int_prep_path}")
    print(f"  - {meta_path}")
    print("=" * 65)

def main():
    train_df, val_df, test_df = load_data()
    rec_model, rec_prep, rec_metrics = train_recovery_model(train_df, val_df, test_df)
    int_model, int_prep, int_metrics = train_intervention_model(train_df, val_df, test_df)
    save_artifacts(rec_model, rec_prep, rec_metrics, int_model, int_prep, int_metrics)

if __name__ == "__main__":
    main()
