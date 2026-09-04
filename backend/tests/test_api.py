import pytest

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "RecoverAI" in data["service"]

def test_get_dashboard(auth_client):
    response = auth_client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "trend_data" in data
    assert "strategy_performance" in data
    assert data["metrics"]["revenue_at_risk"] > 0
    assert data["metrics"]["recovery_rate"] > 0

def test_list_transactions(auth_client):
    response = auth_client.get("/api/transactions?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0
    assert len(data["items"]) > 0

    first_item = data["items"][0]
    assert "id" in first_item
    assert "order_id" in first_item
    assert "amount" in first_item
    assert "customer" in first_item

def test_filter_transactions_by_method(auth_client):
    response = auth_client.get("/api/transactions?method=UPI")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["method"] == "UPI"

def test_search_transactions(auth_client):
    response = auth_client.get("/api/transactions?search=Aditya")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert "Aditya" in data["items"][0]["customer"]["name"]

def test_get_transaction_by_id(auth_client):
    # First get list
    list_res = auth_client.get("/api/transactions")
    tx_id = list_res.json()["items"][0]["id"]

    res = auth_client.get(f"/api/transactions/{tx_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == tx_id
    assert data["customer"] is not None

def test_get_transaction_not_found(auth_client):
    res = auth_client.get("/api/transactions/non_existent_id_9999")
    assert res.status_code == 404

def test_list_recovery_cases(auth_client):
    response = auth_client.get("/api/recovery-cases?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] > 0

    first_case = data["items"][0]
    assert "id" in first_case
    assert "risk_amount" in first_case
    assert "recovery_probability" in first_case
    assert "expected_recovery_value" in first_case

def test_get_recovery_case_by_id(auth_client):
    list_res = auth_client.get("/api/recovery-cases")
    case_id = list_res.json()["items"][0]["id"]

    res = auth_client.get(f"/api/recovery-cases/{case_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == case_id
    assert "transaction" in data

def test_get_audit_trail_for_transaction(auth_client):
    res = auth_client.get("/api/audit/tx_rec_98214")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["transaction_id"] == "tx_rec_98214"
