import urllib.request
import json
import time
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"

def run_e2e_flow():
    print("=== STARTING RECOVERAI END-TO-END DEMO ===")
    
    # 1. Verify Frontend Routes
    print("\n[Step 1] Verifying Frontend Routes...")
    routes = [
        "/",
        "/transactions",
        "/agent",
        "/simulation",
        "/analytics",
        "/audit",
        "/guardrails",
        "/demo-checkout",
        "/abandonment",
        "/settings"
    ]
    for r in routes:
        req = urllib.request.urlopen(f"{FRONTEND_URL}{r}")
        print(f"  -> Route {r.ljust(18)} : HTTP {req.status} OK")
        assert req.status == 200

    # 2. Verify Backend Health & Live DB
    print("\n[Step 2] Verifying Backend Health & Database Connectivity...")
    h_resp = urllib.request.urlopen(f"{BACKEND_URL}/health")
    h_data = json.loads(h_resp.read())
    print(f"  -> Health Status: {h_data['status'].upper()}, DB: {h_data['database'].upper()}")
    assert h_data["status"] == "healthy"
    assert h_data["database"] == "connected"

    # 3. Create Sample Order & Payment Failure (Trigger Recovery)
    print("\n[Step 3] Creating Sample Order & Simulating Payment Failure...")
    order_payload = json.dumps({
        "product_id": "prod_enterprise_demo",
        "product_name": "RecoverAI Enterprise Demo License",
        "amount": 28994.0,
        "currency": "INR",
        "customer_name": "Aakash Verma",
        "customer_email": "aakash.verma@enterprise.com",
        "customer_phone": "+91 98200 12345"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/payments/order",
        data=order_payload,
        headers={"Content-Type": "application/json"}
    )
    order_res = urllib.request.urlopen(req)
    order_data = json.loads(order_res.read())
    order_id = order_data["order_id"]
    tx_id = order_data["transaction_id"]
    print(f"  -> Order Created: {order_id} (Tx: {tx_id}) for INR {order_data['amount_in_rupees']}")

    # Simulate Webhook: Payment Failed (CARD_DECLINED)
    wh_payload = json.dumps({
        "id": f"evt_demo_{int(time.time())}",
        "event": "payment.failed",
        "created_at": int(time.time()),
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_failed_{tx_id[:8]}",
                    "order_id": order_id,
                    "amount": 2899400,
                    "currency": "INR",
                    "status": "failed",
                    "method": "card",
                    "error_code": "CARD_DECLINED",
                    "error_description": "Card declined by issuing bank",
                    "error_reason": "CUSTOMER_ACTION_REQUIRED"
                }
            }
        }
    }).encode("utf-8")
    
    import hmac, hashlib
    from app.core.config import settings
    sig = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), wh_payload, hashlib.sha256).hexdigest()

    wh_req = urllib.request.Request(
        f"{BACKEND_URL}/webhooks/razorpay",
        data=wh_payload,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig}
    )
    wh_res = urllib.request.urlopen(wh_req)
    wh_data = json.loads(wh_res.read())
    print(f"  -> Webhook Payment.Failed Ingested: Status={wh_data['status']}")

    # 4. Trigger Autonomous AI Inference & Strategy Selection
    print("\n[Step 4] Running ML Inference & Decision Engine on Failure...")
    diag_req = urllib.request.urlopen(f"{BACKEND_URL}/api/v1/recovery-cases")
    queue_data = json.loads(diag_req.read())
    print(f"  -> Recovery Cases Total: {queue_data['total']} active at-risk cases")

    # 5. Run Batch Simulator Preset
    print("\n[Step 5] Executing Batch Recovery Simulator (E-commerce Sale Day Preset)...")
    sim_payload = json.dumps({
        "preset_name": "E-commerce Sale Day",
        "transaction_count": 100,
        "aov_amount": 3500.0,
        "base_failure_rate": 0.15,
        "abandonment_rate": 0.20,
        "random_seed": 42
    }).encode("utf-8")

    sim_req = urllib.request.Request(
        f"{BACKEND_URL}/api/v1/simulation/run",
        data=sim_payload,
        headers={"Content-Type": "application/json"}
    )
    sim_res = urllib.request.urlopen(sim_req)
    sim_data = json.loads(sim_res.read())
    print(f"  -> Simulation Batch Completed:")
    print(f"     Total GMV: INR {sim_data['total_gmv']:,.2f}")
    print(f"     Revenue at Risk: INR {sim_data['revenue_at_risk']:,.2f}")
    print(f"     RecoverAI Recovered: INR {sim_data['recoverai_recovered_revenue']:,.2f} ({sim_data['recoverai_recovery_rate']}%)")
    print(f"     Baseline Recovered:  INR {sim_data['baseline_recovered_revenue']:,.2f} ({sim_data['baseline_recovery_rate']}%)")
    print(f"     Net Value Lift: INR {sim_data['net_value_lift_amount']:,.2f} (+{sim_data['net_value_lift_percent']}%)")
    assert sim_data["recoverai_recovery_rate"] > sim_data["baseline_recovery_rate"]

    # 6. Validate Chronological 13-Stage Audit Trail
    print("\n[Step 6] Validating 13-Stage Chronological Decision Trail...")
    cases_req = urllib.request.urlopen(f"{BACKEND_URL}/api/v1/audit/cases?limit=1")
    cases_data = json.loads(cases_req.read())
    test_case_id = cases_data["items"][0]["case_id"]

    chron_req = urllib.request.urlopen(f"{BACKEND_URL}/api/v1/audit/case/{test_case_id}/chronology")
    chron_data = json.loads(chron_req.read())
    print(f"  -> Inspecting Case: {test_case_id}")
    print(f"     Customer: {chron_data['customer_name']} ({chron_data['customer_tier']})")
    print(f"     Amount: INR {chron_data['amount']:,.2f}")
    print(f"     Decision Stages: {len(chron_data['chronological_entries'])} chronological events")
    assert len(chron_data["chronological_entries"]) == 13
    assert chron_data["redaction_verified"] is True
    
    print("\n  -> Chronological Decision Stages Log:")
    for step in chron_data["chronological_entries"]:
        safe_title = step['title'].replace('\u20b9', 'INR ')
        print(f"     [{step['timestamp']}] Step {step['step']:02d}: {safe_title} ({step['actor']})")

    # 7. Validate Financial Operations Analytics
    print("\n[Step 7] Validating Financial Operations Analytics...")
    an_req = urllib.request.urlopen(f"{BACKEND_URL}/api/v1/analytics?time_range=7d")
    an_data = json.loads(an_req.read())
    print(f"  -> Revenue at Risk: INR {an_data['kpis']['revenue_at_risk']:,.2f}")
    print(f"  -> Revenue Recovered: INR {an_data['kpis']['revenue_recovered']:,.2f} ({an_data['kpis']['recovery_rate']}%)")
    print(f"  -> Net Recovery Value: INR {an_data['kpis']['net_recovery_value']:,.2f}")
    print(f"  -> Operational Velocity: {an_data['kpis']['avg_recovery_time_minutes']} mins (Avg {an_data['kpis']['avg_attempts_before_recovery']} attempts)")

    print("\n=== ALL RECOVERAI END-TO-END VALIDATIONS PASSED CLEANLY ===")

if __name__ == "__main__":
    run_e2e_flow()
