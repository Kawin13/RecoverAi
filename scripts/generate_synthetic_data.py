#!/usr/bin/env python3
"""
RecoverAI - Synthetic Indian Digital Payment Dataset Generator
Generates realistic, statistically correlated payment transactions, failure diagnostics,
and recovery intervention outcomes with zero data leakage.
"""

import os
import sys
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.model_selection import train_test_split

# Ensure UTF-8 output on Windows console
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Set fixed random seeds for strict reproducibility
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

TOTAL_RECORDS = 35000

# Constants & Categorical Spaces
PAYMENT_METHODS = ["UPI", "CARD", "NET_BANKING", "WALLET", "MANDATE"]
PAYMENT_METHOD_WEIGHTS = np.array([0.52, 0.28, 0.10, 0.05, 0.05])
PAYMENT_METHOD_WEIGHTS /= PAYMENT_METHOD_WEIGHTS.sum()

BANKS = [
    "HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank",
    "Kotak Mahindra Bank", "Punjab National Bank", "Bank of Baroda",
    "IndusInd Bank", "Yes Bank", "Federal Bank"
]
BANK_WEIGHTS = np.array([0.24, 0.22, 0.18, 0.14, 0.08, 0.04, 0.04, 0.03, 0.02, 0.01])
BANK_WEIGHTS /= BANK_WEIGHTS.sum()

MERCHANT_CATEGORIES = [
    "E-Commerce & Retail", "SaaS & Cloud Services", "EdTech & Learning",
    "Travel & Hospitality", "Quick Commerce & Food", "Utilities & Telecom"
]
MERCHANT_WEIGHTS = np.array([0.35, 0.25, 0.15, 0.10, 0.10, 0.05])
MERCHANT_WEIGHTS /= MERCHANT_WEIGHTS.sum()

CUSTOMER_SEGMENTS = ["STANDARD", "GROWTH", "VIP", "ENTERPRISE"]
SEGMENT_WEIGHTS = np.array([0.55, 0.25, 0.15, 0.05])
SEGMENT_WEIGHTS /= SEGMENT_WEIGHTS.sum()

DEVICE_TYPES = ["MOBILE_ANDROID", "MOBILE_IOS", "DESKTOP", "TABLET"]
DEVICE_WEIGHTS = np.array([0.65, 0.20, 0.12, 0.03])
DEVICE_WEIGHTS /= DEVICE_WEIGHTS.sum()

HOUR_PROBS = np.array([
    0.02, 0.01, 0.01, 0.01, 0.01, 0.02, 0.03, 0.04, 0.06, 0.07,
    0.08, 0.08, 0.07, 0.06, 0.06, 0.07, 0.07, 0.08, 0.07, 0.05,
    0.04, 0.03, 0.02, 0.02
])
HOUR_PROBS /= HOUR_PROBS.sum()

RECOVERY_ACTIONS = [
    "SMART_PAYLINK_1CLICK",
    "UPI_INTENT_FALLBACK",
    "TIMED_SMART_RETRY",
    "INCENTIVIZED_DUNNING",
    "WHATSAPP_CONCIERGE",
    "CARD_UPDATE_PROMPT"
]

METHOD_FAILURES = {
    "UPI": [
        ("UPI_TIMEOUT", "TECHNICAL_TIMEOUT", 0.30),
        ("BANK_SERVER_DOWN", "TECHNICAL_TIMEOUT", 0.22),
        ("UPI_PIN_FAILED", "AUTHENTICATION", 0.18),
        ("INSUFFICIENT_FUNDS", "FINANCIAL_LIMIT", 0.14),
        ("TRANSACTION_LIMIT", "FINANCIAL_LIMIT", 0.08),
        ("USER_CANCELLED", "INTENT_ABANDONMENT", 0.08)
    ],
    "CARD": [
        ("OTP_FAILED", "AUTHENTICATION", 0.32),
        ("CARD_DECLINED", "FINANCIAL_LIMIT", 0.24),
        ("BANK_DECLINED", "FINANCIAL_LIMIT", 0.18),
        ("EXPIRED_CARD", "INVALID_INSTRUMENT", 0.12),
        ("INVALID_CARD", "INVALID_INSTRUMENT", 0.08),
        ("BANK_TIMEOUT", "TECHNICAL_TIMEOUT", 0.06)
    ],
    "NET_BANKING": [
        ("BANK_TIMEOUT", "TECHNICAL_TIMEOUT", 0.45),
        ("AUTHENTICATION_FAILED", "AUTHENTICATION", 0.35),
        ("USER_CANCELLED", "INTENT_ABANDONMENT", 0.20)
    ],
    "WALLET": [
        ("INSUFFICIENT_FUNDS", "FINANCIAL_LIMIT", 0.50),
        ("AUTHENTICATION_FAILED", "AUTHENTICATION", 0.30),
        ("USER_CANCELLED", "INTENT_ABANDONMENT", 0.20)
    ],
    "MANDATE": [
        ("MANDATE_FAILED", "MANDATE_ISSUE", 0.45),
        ("INSUFFICIENT_FUNDS", "FINANCIAL_LIMIT", 0.35),
        ("MANDATE_CANCELLED", "MANDATE_ISSUE", 0.20)
    ]
}

def generate_synthetic_dataset(n_records: int = TOTAL_RECORDS) -> pd.DataFrame:
    print(f"Generating {n_records:,} synthetic Indian digital payment records...")

    data = []
    
    # Generate pool of 8,000 unique customers for recurring relationships
    num_unique_customers = 8000
    customer_pool = []
    for i in range(num_unique_customers):
        cust_id = f"cust_{10000 + i}"
        tier = np.random.choice(CUSTOMER_SEGMENTS, p=SEGMENT_WEIGHTS)
        preferred_method = np.random.choice(PAYMENT_METHODS, p=PAYMENT_METHOD_WEIGHTS)
        tenure_days = int(np.random.exponential(scale=180)) + 1
        
        if tier == "ENTERPRISE":
            avg_aov = np.random.uniform(25000, 150000)
            hist_success = np.random.randint(20, 120)
            hist_fail = np.random.randint(1, 8)
        elif tier == "VIP":
            avg_aov = np.random.uniform(10000, 60000)
            hist_success = np.random.randint(15, 60)
            hist_fail = np.random.randint(1, 6)
        elif tier == "GROWTH":
            avg_aov = np.random.uniform(3000, 20000)
            hist_success = np.random.randint(5, 30)
            hist_fail = np.random.randint(1, 8)
        else:  # STANDARD
            avg_aov = np.random.uniform(500, 8000)
            hist_success = np.random.randint(1, 15)
            hist_fail = np.random.randint(1, 10)

        customer_pool.append({
            "customer_id": cust_id,
            "tier": tier,
            "preferred_method": preferred_method,
            "tenure_days": min(tenure_days, 1800),
            "avg_aov": avg_aov,
            "hist_success": hist_success,
            "hist_fail": hist_fail
        })

    # Generate records
    for i in range(n_records):
        tx_id = f"tx_rec_{100000 + i}"
        cust = random.choice(customer_pool)
        merchant_id = f"mer_{random.randint(100, 250)}"
        merchant_cat = np.random.choice(MERCHANT_CATEGORIES, p=MERCHANT_WEIGHTS)
        
        # Payment method selection (65% aligned with preferred method)
        if random.random() < 0.65:
            payment_method = cust["preferred_method"]
        else:
            payment_method = np.random.choice(PAYMENT_METHODS, p=PAYMENT_METHOD_WEIGHTS)

        bank = np.random.choice(BANKS, p=BANK_WEIGHTS)
        device = np.random.choice(DEVICE_TYPES, p=DEVICE_WEIGHTS)

        # Amount distribution conditioned on tier & category
        base_amount = cust["avg_aov"] * np.random.lognormal(mean=0, sigma=0.45)
        amount = round(max(99.0, min(base_amount, 500000.0)), 2)

        # Failure selection based on method
        failures_pool = METHOD_FAILURES[payment_method]
        f_reasons = [f[0] for f in failures_pool]
        f_cats = {f[0]: f[1] for f in failures_pool}
        f_weights = np.array([f[2] for f in failures_pool])
        f_weights /= f_weights.sum()
        
        # Check if abandoned checkout
        is_checkout_abandoned = 1 if (random.random() < 0.08 and payment_method in ["UPI", "CARD"]) else 0
        if is_checkout_abandoned:
            failure_reason = "CHECKOUT_ABANDONED" if random.random() < 0.7 else "SESSION_TIMEOUT"
            failure_category = "INTENT_ABANDONMENT"
            checkout_duration = int(np.random.exponential(scale=45)) + 5
        else:
            failure_reason = np.random.choice(f_reasons, p=f_weights)
            failure_category = f_cats[failure_reason]
            checkout_duration = int(np.random.exponential(scale=120)) + 20

        attempt_count = np.random.choice([1, 2, 3, 4], p=[0.72, 0.18, 0.07, 0.03])
        hour_of_day = int(np.random.choice(range(24), p=HOUR_PROBS))
        day_of_week = random.randint(0, 6)

        # Recovery Action Assignment (Contextually assigned)
        if failure_category == "INVALID_INSTRUMENT":
            action_weights = np.array([0.50, 0.35, 0.15])
            action = np.random.choice(["CARD_UPDATE_PROMPT", "UPI_INTENT_FALLBACK", "SMART_PAYLINK_1CLICK"], p=action_weights/action_weights.sum())
        elif failure_reason in ["UPI_TIMEOUT", "BANK_SERVER_DOWN"]:
            action_weights = np.array([0.45, 0.35, 0.20])
            action = np.random.choice(["UPI_INTENT_FALLBACK", "SMART_PAYLINK_1CLICK", "TIMED_SMART_RETRY"], p=action_weights/action_weights.sum())
        elif failure_category == "AUTHENTICATION":
            action_weights = np.array([0.55, 0.30, 0.15])
            action = np.random.choice(["SMART_PAYLINK_1CLICK", "UPI_INTENT_FALLBACK", "WHATSAPP_CONCIERGE"], p=action_weights/action_weights.sum())
        elif failure_category == "FINANCIAL_LIMIT":
            action_weights = np.array([0.45, 0.35, 0.20])
            action = np.random.choice(["TIMED_SMART_RETRY", "UPI_INTENT_FALLBACK", "INCENTIVIZED_DUNNING"], p=action_weights/action_weights.sum())
        elif is_checkout_abandoned:
            action_weights = np.array([0.45, 0.35, 0.20])
            action = np.random.choice(["WHATSAPP_CONCIERGE", "INCENTIVIZED_DUNNING", "SMART_PAYLINK_1CLICK"], p=action_weights/action_weights.sum())
        else:
            action = np.random.choice(RECOVERY_ACTIONS)

        # -------------------------------------------------------------
        # Logit Propensity Calculation (Behavioral Physics & Correlation)
        # -------------------------------------------------------------
        logit = 0.35  # baseline

        # 1. Customer segment effect
        if cust["tier"] == "VIP":
            logit += 0.85
        elif cust["tier"] == "ENTERPRISE":
            logit += 0.70
        elif cust["tier"] == "GROWTH":
            logit += 0.30
        else:
            logit -= 0.15

        # 2. Customer tenure & historical success ratio
        tenure_factor = np.log1p(cust["tenure_days"] / 60.0) * 0.20
        success_ratio = cust["hist_success"] / (cust["hist_success"] + cust["hist_fail"] + 1)
        logit += (success_ratio - 0.5) * 1.3 + tenure_factor

        # 3. Attempt count fatigue
        logit -= 0.55 * (attempt_count - 1)

        # 4. Amount friction
        logit -= np.log1p(amount / 8000.0) * 0.22

        # 5. Device friction
        if device == "MOBILE_ANDROID" or device == "MOBILE_IOS":
            logit += 0.15
        elif device == "DESKTOP":
            logit += 0.05

        # 6. Specific Action & Failure Physics Synergy
        if failure_reason in ["UPI_TIMEOUT", "BANK_SERVER_DOWN"] and action in ["UPI_INTENT_FALLBACK", "SMART_PAYLINK_1CLICK"]:
            logit += 1.45
        elif failure_reason == "EXPIRED_CARD":
            if action == "CARD_UPDATE_PROMPT":
                logit += 1.30
            elif action == "TIMED_SMART_RETRY":
                logit -= 2.60  # Retrying an expired card with same method almost always fails
        elif failure_category == "AUTHENTICATION" and action == "SMART_PAYLINK_1CLICK":
            logit += 1.25
        elif failure_category == "FINANCIAL_LIMIT" and action == "TIMED_SMART_RETRY":
            logit += 0.90
        elif is_checkout_abandoned:
            if checkout_duration < 45:
                logit += 0.50  # Hot recent cart drop is very recoverable
            if action in ["WHATSAPP_CONCIERGE", "INCENTIVIZED_DUNNING"]:
                logit += 1.10

        # Previous UPI success synergy with UPI intent switch
        if cust["preferred_method"] == "UPI" and action == "UPI_INTENT_FALLBACK":
            logit += 0.65

        # Add calibrated stochastic noise
        logit += np.random.normal(0, 0.45)

        # Sigmoid probability
        prob_recovery = 1.0 / (1.0 + np.exp(-logit))
        recovery_success = 1 if random.random() < prob_recovery else 0

        # Outcome-conditioned fields
        if recovery_success == 1:
            if action == "SMART_PAYLINK_1CLICK":
                delay = max(1.0, round(float(np.random.exponential(scale=6.0)), 1))
            elif action == "UPI_INTENT_FALLBACK":
                delay = max(0.5, round(float(np.random.exponential(scale=3.0)), 1))
            elif action == "TIMED_SMART_RETRY":
                delay = max(30.0, round(float(np.random.uniform(60, 360)), 1))
            elif action == "WHATSAPP_CONCIERGE":
                delay = max(2.0, round(float(np.random.exponential(scale=15.0)), 1))
            else:
                delay = max(10.0, round(float(np.random.exponential(scale=45.0)), 1))

            # Potential small incentive discount deduction for dunning
            if action == "INCENTIVIZED_DUNNING":
                discount = round(amount * 0.05, 2)
                recovered_amt = round(amount - discount, 2)
            else:
                recovered_amt = amount
        else:
            delay = 0.0
            recovered_amt = 0.0

        data.append({
            "transaction_id": tx_id,
            "customer_id": cust["customer_id"],
            "merchant_id": merchant_id,
            "amount": amount,
            "payment_method": payment_method,
            "bank": bank,
            "failure_reason": failure_reason,
            "failure_category": failure_category,
            "attempt_count": attempt_count,
            "previous_success_count": cust["hist_success"],
            "previous_failure_count": cust["hist_fail"],
            "preferred_payment_method": cust["preferred_method"],
            "customer_tenure_days": cust["tenure_days"],
            "customer_value_segment": cust["tier"],
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
            "merchant_category": merchant_cat,
            "checkout_abandoned": is_checkout_abandoned,
            "checkout_duration_seconds": checkout_duration,
            "device_type": device,
            "historical_avg_order_value": round(cust["avg_aov"], 2),
            "recovery_action": action,
            "recovery_success": recovery_success,
            "recovery_delay_minutes": delay,
            "recovered_amount": recovered_amt
        })

    df = pd.DataFrame(data)
    return df

def process_and_export_datasets(df: pd.DataFrame):
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    raw_dir = os.path.join(base_dir, "data", "raw")
    processed_dir = os.path.join(base_dir, "data", "processed")

    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)

    raw_path = os.path.join(raw_dir, "synthetic_transactions.csv")
    df.to_csv(raw_path, index=False)
    print(f"Exported raw dataset: {raw_path} ({len(df):,} rows)")

    # Prepare training dataset by EXCLUDING post-outcome leakages
    feature_cols = [
        "transaction_id",
        "customer_id",
        "merchant_id",
        "amount",
        "payment_method",
        "bank",
        "failure_reason",
        "failure_category",
        "attempt_count",
        "previous_success_count",
        "previous_failure_count",
        "preferred_payment_method",
        "customer_tenure_days",
        "customer_value_segment",
        "hour_of_day",
        "day_of_week",
        "merchant_category",
        "checkout_abandoned",
        "checkout_duration_seconds",
        "device_type",
        "historical_avg_order_value",
        "recovery_action",
        "recovery_success"  # Target
    ]

    training_df = df[feature_cols].copy()
    training_path = os.path.join(processed_dir, "training_data.csv")
    training_df.to_csv(training_path, index=False)
    print(f"Exported clean ML training dataset: {training_path} (Leakage-free, {len(training_df):,} rows)")

    # 70% Train, 15% Validation, 15% Test Split
    train_df, temp_df = train_test_split(training_df, test_size=0.30, random_state=RANDOM_SEED, stratify=training_df["recovery_success"])
    val_df, test_df = train_test_split(temp_df, test_size=0.50, random_state=RANDOM_SEED, stratify=temp_df["recovery_success"])

    train_path = os.path.join(processed_dir, "train.csv")
    val_path = os.path.join(processed_dir, "val.csv")
    test_path = os.path.join(processed_dir, "test.csv")

    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path, index=False)
    test_df.to_csv(test_path, index=False)

    print(f"  - Train Set (70%): {len(train_df):,} rows -> {train_path}")
    print(f"  - Val Set   (15%): {len(val_df):,} rows -> {val_path}")
    print(f"  - Test Set  (15%): {len(test_df):,} rows -> {test_path}")

    # Print Automated Statistical Checks
    print("\n" + "=" * 60)
    print("AUTOMATED STATISTICAL CHECKS & DATASET PROFILE")
    print("=" * 60)
    print(f"Total Rows: {len(df):,}")
    print(f"Mean Transaction Amount: INR {df['amount'].mean():,.2f}")
    print(f"Median Transaction Amount: INR {df['amount'].median():,.2f}")
    print(f"Overall Recovery Success Rate: {df['recovery_success'].mean() * 100:.2f}%")
    print(f"Total Recovered Revenue: INR {df['recovered_amount'].sum():,.2f}")

    print("\n[Payment Method Distribution]:")
    print((df["payment_method"].value_counts(normalize=True) * 100).round(2).to_string())

    print("\n[Top Failure Reasons]:")
    print((df["failure_reason"].value_counts(normalize=True) * 100).round(2).to_string())

    print("\n[Failure Categories]:")
    print((df["failure_category"].value_counts(normalize=True) * 100).round(2).to_string())

    print("\n[Recovery Success Rate by Action]:")
    print((df.groupby("recovery_action")["recovery_success"].mean() * 100).round(2).to_string())

    print("\n[Recovery Success Rate by Customer Segment]:")
    print((df.groupby("customer_value_segment")["recovery_success"].mean() * 100).round(2).to_string())

    print("\n[Target Class Balance]:")
    print(df["recovery_success"].value_counts(normalize=True).round(4).to_string())
    print("=" * 60)

if __name__ == "__main__":
    dataset = generate_synthetic_dataset(TOTAL_RECORDS)
    process_and_export_datasets(dataset)
