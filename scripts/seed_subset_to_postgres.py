#!/usr/bin/env python3
"""
RecoverAI - Seed Representative Subset to Live PostgreSQL Database
Reads generated synthetic transactions and populates customers, transactions,
recovery cases, payment attempts, decisions, and audit logs in Supabase.
"""

import os
import sys
import pandas as pd
from datetime import datetime, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database.session import SessionLocal, engine
from app.database.base import Base
from app.models import (
    Customer,
    Transaction,
    PaymentAttempt,
    RecoveryCase,
    RecoveryAction,
    AgentDecision,
    AuditLog,
    RecoveryOutcome
)

def seed_representative_subset(n_samples: int = 75):
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    csv_path = os.path.join(base_dir, "data", "raw", "synthetic_transactions.csv")

    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found. Run generate_synthetic_data.py first.")
        return

    # Note: Schema is managed authoritatively via Alembic migrations.
    df = pd.read_csv(csv_path)
    sample_df = df.sample(n=n_samples, random_state=42).copy()

    db = SessionLocal()
    try:
        print(f"Seeding {len(sample_df)} representative transactions into PostgreSQL...")

        now = datetime.utcnow()
        customers_map = {}

        # 1. Upsert / Create Customers
        for _, row in sample_df.iterrows():
            cust_id = row["customer_id"]
            if cust_id not in customers_map:
                existing_cust = db.query(Customer).filter(Customer.id == cust_id).first()
                if not existing_cust:
                    cust_name = f"Customer {cust_id.split('_')[-1]}"
                    cust_email = f"user_{cust_id.split('_')[-1]}@merchantclient.in"
                    new_cust = Customer(
                        id=cust_id,
                        name=cust_name,
                        email=cust_email,
                        phone=f"+91 9{abs(hash(cust_id)) % 900000000 + 100000000}",
                        tier=row["customer_value_segment"],
                        ltv=float(row["historical_avg_order_value"] * 4.5),
                        created_at=now - timedelta(days=int(row["customer_tenure_days"]))
                    )
                    db.add(new_cust)
                    customers_map[cust_id] = new_cust
                else:
                    customers_map[cust_id] = existing_cust

        db.flush()

        # 2. Add Transactions and Recovery Cases
        added_tx_count = 0
        for _, row in sample_df.iterrows():
            tx_id = row["transaction_id"]
            existing_tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
            if existing_tx:
                continue

            order_id = f"ORD-{tx_id.split('_')[-1]}"
            is_recovered = int(row["recovery_success"]) == 1
            tx_status = "RECOVERED" if is_recovered else "IN_PROGRESS"

            # Dynamic timestamps
            minutes_ago = int(abs(hash(tx_id)) % 360) + 5
            created_time = now - timedelta(minutes=minutes_ago)
            recovered_time = (created_time + timedelta(minutes=float(row["recovery_delay_minutes"]))) if is_recovered else None

            # Transaction Record
            new_tx = Transaction(
                id=tx_id,
                order_id=order_id,
                customer_id=row["customer_id"],
                amount=float(row["amount"]),
                currency="INR",
                method=row["payment_method"],
                status=tx_status,
                created_at=created_time,
                updated_at=recovered_time or created_time
            )
            db.add(new_tx)
            db.flush()

            # Payment Attempt
            att_id = f"att_{tx_id.split('_')[-1]}"
            new_att = PaymentAttempt(
                id=att_id,
                transaction_id=tx_id,
                attempt_number=int(row["attempt_count"]),
                gateway="Razorpay",
                error_code=row["failure_reason"],
                error_description=f"Transaction drop: {row['failure_reason']} on {row['bank']}",
                error_category=row["failure_category"],
                latency_ms=int(abs(hash(tx_id)) % 8000) + 400,
                status="FAILED",
                created_at=created_time
            )
            db.add(new_att)

            # Recovery Case
            rc_id = f"rc_{tx_id.split('_')[-1]}"
            est_erv = float(row["amount"]) * 0.85 if is_recovered else float(row["amount"]) * 0.40
            new_case = RecoveryCase(
                id=rc_id,
                transaction_id=tx_id,
                risk_amount=float(row["amount"]),
                failure_category=row["failure_category"],
                recovery_probability=0.88 if is_recovered else 0.45,
                selected_strategy=row["recovery_action"],
                expected_recovery_value=round(est_erv, 2),
                status=tx_status,
                attempt_count=int(row["attempt_count"]),
                created_at=created_time,
                updated_at=recovered_time or created_time,
                recovered_at=recovered_time
            )
            db.add(new_case)
            db.flush()

            # Recovery Action
            act_id = f"act_{tx_id.split('_')[-1]}"
            new_act = RecoveryAction(
                id=act_id,
                recovery_case_id=rc_id,
                strategy=row["recovery_action"],
                channel="SMS" if "PAYLINK" in row["recovery_action"] else "IN_APP" if "UPI" in row["recovery_action"] else "EMAIL",
                payload_data=f'{{"action": "{row["recovery_action"]}", "order": "{order_id}"}}',
                erv=round(est_erv, 2),
                status="COMPLETED" if is_recovered else "DISPATCHED",
                dispatched_at=created_time + timedelta(minutes=1)
            )
            db.add(new_act)

            # Agent Decision
            dec_id = f"dec_{tx_id.split('_')[-1]}"
            new_dec = AgentDecision(
                id=dec_id,
                recovery_case_id=rc_id,
                model_name="XGBoost+Gemini-2.5-Flash",
                input_features=f'{{"amount": {row["amount"]}, "bank": "{row["bank"]}", "category": "{row["failure_category"]}"}}',
                propensity_scores=f'{{"{row["recovery_action"]}": 0.85}}',
                selected_action=row["recovery_action"],
                reasoning_summary=f"Diagnosed {row['failure_reason']}. Selected {row['recovery_action']} based on ERV optimization.",
                decided_at=created_time + timedelta(seconds=45)
            )
            db.add(new_dec)

            # Recovery Outcome if recovered
            if is_recovered:
                out_id = f"out_{tx_id.split('_')[-1]}"
                new_outcome = RecoveryOutcome(
                    id=out_id,
                    recovery_case_id=rc_id,
                    recovered_amount=float(row["recovered_amount"]),
                    payment_method_used=row["payment_method"],
                    time_to_recover_seconds=int(float(row["recovery_delay_minutes"]) * 60),
                    settled_at=recovered_time
                )
                db.add(new_outcome)

            # Audit Log
            aud_id = f"aud_{tx_id.split('_')[-1]}"
            new_aud = AuditLog(
                id=aud_id,
                recovery_case_id=rc_id,
                transaction_id=tx_id,
                actor="AUTONOMOUS_AGENT",
                action_type="DISPATCH_INTERVENTION",
                target_resource=tx_id,
                details=f"Autonomous intervention {row['recovery_action']} dispatched with ERV INR {est_erv:,.2f}",
                metadata_json=f'{{"strategy": "{row["recovery_action"]}"}}',
                created_at=created_time + timedelta(minutes=1)
            )
            db.add(new_aud)

            added_tx_count += 1

        db.commit()
        print(f"Successfully seeded {added_tx_count} transactions and recovery cases into PostgreSQL!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_representative_subset(75)
