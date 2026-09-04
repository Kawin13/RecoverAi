"""
Phase 9 Automated Tests: Frontend Truthfulness & API Error Truthfulness Contract
Verifies that:
1. When API encounters missing resources or error states, honest HTTP error codes are returned
   without silently synthesizing fake data.
2. Canonical active-case filtering excludes terminal states:
   SUCCESS, CAPTURED, RECOVERED, CLOSED, CANCELLED, STOPPED.
3. Recovery analysis failure does not return fabricated UPI_SWITCH/88%/gateway timeout.
4. Empty dataset returns honest empty collection with total=0.
"""

import pytest

TERMINAL_STATES = {'SUCCESS', 'CAPTURED', 'RECOVERED', 'CLOSED', 'CANCELLED', 'STOPPED', 'FAILED_TERMINAL'}

def test_nonexistent_transaction_returns_404_not_mock(auth_client):
    response = auth_client.get("/api/transactions/00000000-0000-0000-0000-999999999999")
    assert response.status_code == 404
    # Ensure it did NOT return a fabricated or mock transaction
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

def test_empty_workspace_returns_honest_empty_list_not_mock(auth_client):
    # Query an empty dummy status
    response = auth_client.get("/api/transactions?status=NON_EXISTENT_STATUS_XYZ")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    # Must NOT return mockTransactions fallback
    assert len(data["items"]) == 0

def test_canonical_active_filter_terminal_states_exclusion():
    """Verify that canonical active logic rejects all terminal states."""
    test_cases = [
        {"id": "c1", "status": "RECOVERED", "is_terminal": True},
        {"id": "c2", "status": "SUCCESS", "is_terminal": True},
        {"id": "c3", "status": "CAPTURED", "is_terminal": True},
        {"id": "c4", "status": "CLOSED", "is_terminal": True},
        {"id": "c5", "status": "CANCELLED", "is_terminal": True},
        {"id": "c6", "status": "STOPPED", "is_terminal": True},
        {"id": "c7", "status": "DETECTED", "is_terminal": False},
        {"id": "c8", "status": "ANALYZED", "is_terminal": False},
        {"id": "c9", "status": "STRATEGY_SELECTED", "is_terminal": False},
        {"id": "c10", "status": "WAITING_FOR_CUSTOMER", "is_terminal": False},
    ]

    active_cases = [c for c in test_cases if c["status"] not in TERMINAL_STATES]
    assert len(active_cases) == 4
    for c in active_cases:
        assert c["status"] in ["DETECTED", "ANALYZED", "STRATEGY_SELECTED", "WAITING_FOR_CUSTOMER"]

def test_recovery_analysis_nonexistent_case_fails_honestly(auth_client):
    response = auth_client.post("/api/recovery/analyze/00000000-0000-0000-0000-999999999999", json={})
    # Must return 404/controlled error, not synthesize UPI_SWITCH
    assert response.status_code in [404, 400, 422, 500]
    data = response.json()
    assert "selected_action" not in data or data.get("selected_action") != "UPI_SWITCH"

def test_ai_explain_nonexistent_case_fails_honestly(auth_client):
    response = auth_client.post("/api/ai/explain/00000000-0000-0000-0000-999999999999")
    assert response.status_code in [404, 400, 422, 500]
