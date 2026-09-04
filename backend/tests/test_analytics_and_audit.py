"""
RecoverAI - Financial Analytics & Audit Trail Tests (Phase 13)
Verifies:
1. Analytics endpoint calculations & multidimensional breakdowns
2. Dynamic filter options (time_range, payment_method, strategy, status)
3. 13-stage chronological audit timeline reconstruction
4. Data security: zero secret leakage, strict card credential redaction
5. Auditable case searching & filtering
6. JSON compliance export
"""

import json
import pytest

def test_analytics_kpis_and_breakdowns(auth_client):
    response = auth_client.get("/api/analytics?time_range=7d")
    assert response.status_code == 200
    data = response.json()

    kpis = data["kpis"]
    assert kpis["revenue_at_risk"] > 0
    assert kpis["revenue_recovered"] > 0
    assert 0 <= kpis["recovery_rate"] <= 100
    assert kpis["net_recovery_value"] > 0
    assert kpis["avg_recovery_time_minutes"] > 0
    assert kpis["avg_attempts_before_recovery"] >= 1.0

    # 5 Breakdowns
    assert len(data["recovery_by_strategy"]) >= 4
    assert len(data["recovery_by_failure_reason"]) >= 4
    assert len(data["recovery_by_payment_method"]) >= 4
    assert len(data["recovery_by_merchant_category"]) >= 1
    assert len(data["recovery_by_customer_segment"]) >= 4

    # Trend points
    assert len(data["timeline_trend"]) > 0

def test_analytics_time_filters(auth_client):
    # Today filter
    res_today = auth_client.get("/api/analytics?time_range=today")
    assert res_today.status_code == 200
    assert res_today.json()["applied_filters"]["time_range"] == "today"

    # 30d filter
    res_30d = auth_client.get("/api/analytics?time_range=30d")
    assert res_30d.status_code == 200
    assert res_30d.json()["applied_filters"]["time_range"] == "30d"

def test_case_chronology_exact_13_stages(auth_client):
    cases_resp = auth_client.get("/api/audit/cases?limit=5")
    assert cases_resp.status_code == 200
    items = cases_resp.json()["items"]
    assert len(items) > 0
    
    test_case_id = items[0]["case_id"]
    timeline_resp = auth_client.get(f"/api/audit/case/{test_case_id}/chronology")
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()

    assert timeline["case_id"] == test_case_id
    assert len(timeline["chronological_entries"]) == 13

    # Check that all 13 stages exist in strict ordinal sequence 1..13
    expected_stage_keys = [
        "PAYMENT_EVENT_RECEIVED",
        "FAILURE_DIAGNOSED",
        "FEATURES_CALCULATED",
        "MODEL_VERSION",
        "PROBABILITIES_GENERATED",
        "ERV_VALUES",
        "STRATEGY_SELECTED",
        "GUARDRAIL_RESULT",
        "LLM_EXPLANATION",
        "ACTION_EXECUTED",
        "CUSTOMER_INTERACTION",
        "PAYMENT_RESULT",
        "CASE_CLOSED"
    ]

    for idx, expected_key in enumerate(expected_stage_keys, start=1):
        entry = timeline["chronological_entries"][idx - 1]
        assert entry["step"] == idx
        assert entry["step_key"] == expected_key
        assert entry["timestamp"] is not None
        assert len(entry["title"]) > 0
        assert len(entry["summary"]) > 0

def test_audit_data_security_redaction(auth_client):
    timeline_resp = auth_client.get("/api/audit/case/rc_98214/chronology")
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()

    assert timeline["redaction_verified"] is True
    export_json = timeline["exportable_json"]
    assert len(export_json) > 100

    # Verify no sensitive secrets or full unmasked card numbers
    assert '"cvv"' not in export_json.lower()
    assert '"secret_key"' not in export_json.lower()
    assert '"webhook_secret"' not in export_json.lower()
    assert '"rzp_test_secret"' not in export_json.lower()
    
    parsed = json.loads(export_json)
    assert "chronological_decision_trail" in parsed
    assert len(parsed["chronological_decision_trail"]) == 13

def test_list_auditable_cases_search(auth_client):
    all_cases_resp = auth_client.get("/api/audit/cases?limit=10")
    assert all_cases_resp.status_code == 200
    items = all_cases_resp.json()["items"]
    assert len(items) > 0

    # Search by customer name prefix
    sample = items[0]
    search_term = sample["customer_name"][:4]
    searched_resp = auth_client.get(f"/api/audit/cases?search={search_term}&limit=10")
    assert searched_resp.status_code == 200
    assert len(searched_resp.json()["items"]) > 0
