import sys
import os

# Add backend directory to sys.path
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.database.session import SessionLocal
from app.models import (
    Customer,
    Transaction,
    PaymentAttempt,
    CheckoutSession,
    RecoveryCase,
    RecoveryAction,
    AgentDecision,
    AuditLog,
    GuardrailEvent,
    RecoveryOutcome,
    WebhookEvent,
    PaymentLink,
    Profile,
    Workspace,
    WorkspaceMember,
    InternalEvent,
    RecoveryJob,
)
from sqlalchemy import text

def clean_data():
    db = SessionLocal()
    try:
        print("--- CURRENT DATABASE STATE ---")
        counts = {
            "profiles": db.query(Profile).count(),
            "workspaces": db.query(Workspace).count(),
            "workspace_members": db.query(WorkspaceMember).count(),
            "transactions": db.query(Transaction).count(),
            "recovery_cases": db.query(RecoveryCase).count(),
            "customers": db.query(Customer).count(),
            "checkout_sessions": db.query(CheckoutSession).count(),
            "recovery_jobs": db.query(RecoveryJob).count(),
            "recovery_actions": db.query(RecoveryAction).count(),
            "agent_decisions": db.query(AgentDecision).count(),
            "payment_attempts": db.query(PaymentAttempt).count(),
            "recovery_outcomes": db.query(RecoveryOutcome).count(),
            "guardrail_events": db.query(GuardrailEvent).count(),
            "payment_links": db.query(PaymentLink).count(),
            "internal_events": db.query(InternalEvent).count(),
            "webhook_events": db.query(WebhookEvent).count(),
            "audit_logs": db.query(AuditLog).count(),
        }
        for k, v in counts.items():
            print(f"{k:20}: {v}")

        print("\n--- PURGING TRANSACTION, REVENUE, AND CASE DATA ---")
        # Disconnect any foreign keys from checkout_sessions to recovery_cases
        db.execute(text("UPDATE checkout_sessions SET recovery_case_id = NULL"))
        db.commit()

        # Purge child tables in order
        deleted = {}
        deleted["recovery_outcomes"] = db.query(RecoveryOutcome).delete()
        deleted["agent_decisions"] = db.query(AgentDecision).delete()
        deleted["guardrail_events"] = db.query(GuardrailEvent).delete()
        deleted["recovery_actions"] = db.query(RecoveryAction).delete()
        deleted["recovery_jobs"] = db.query(RecoveryJob).delete()
        deleted["internal_events"] = db.query(InternalEvent).delete()
        deleted["audit_logs"] = db.query(AuditLog).delete()
        deleted["payment_links"] = db.query(PaymentLink).delete()
        deleted["payment_attempts"] = db.query(PaymentAttempt).delete()
        deleted["webhook_events"] = db.query(WebhookEvent).delete()
        deleted["recovery_cases"] = db.query(RecoveryCase).delete()
        deleted["transactions"] = db.query(Transaction).delete()
        deleted["checkout_sessions"] = db.query(CheckoutSession).delete()
        deleted["customers"] = db.query(Customer).delete()

        db.commit()

        print("\n--- PURGE RESULTS ---")
        for k, v in deleted.items():
            print(f"Purged {k:20}: {v}")

        print("\n--- VERIFICATION AFTER PURGE ---")
        final_counts = {
            "profiles (preserved)": db.query(Profile).count(),
            "workspaces (preserved)": db.query(Workspace).count(),
            "workspace_members (preserved)": db.query(WorkspaceMember).count(),
            "transactions": db.query(Transaction).count(),
            "recovery_cases": db.query(RecoveryCase).count(),
            "customers": db.query(Customer).count(),
            "checkout_sessions": db.query(CheckoutSession).count(),
            "recovery_jobs": db.query(RecoveryJob).count(),
            "internal_events": db.query(InternalEvent).count(),
        }
        for k, v in final_counts.items():
            print(f"{k:30}: {v}")
        print("\nPurge completed successfully! All users and workspaces are intact.")
    except Exception as e:
        db.rollback()
        print(f"Error during purge: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clean_data()
