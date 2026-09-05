import uuid
import json
import asyncio
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import get_db
from app.models import (
    Workspace,
    WorkspaceMember,
    Profile,
    Customer,
    Transaction,
    RecoveryCase,
    AuditLog,
    DEFAULT_WORKSPACE_ID
)
from app.core import auth
from app.core.events import EventBroadcaster, event_broadcaster


# Distinct Tenant IDs
WORKSPACE_A_ID = "11111111-1111-1111-1111-111111111111"
WORKSPACE_B_ID = "22222222-2222-2222-2222-222222222222"

USER_A_ID = "aaaaaaa1-1111-1111-1111-111111111111"
USER_A_OP_ID = "aaaaaaa2-1111-1111-1111-111111111111"
USER_B_ID = "bbbbbbb2-2222-2222-2222-222222222222"
USER_B_OP_ID = "bbbbbbb3-2222-2222-2222-222222222222"
USER_C_ID = "ccccccc3-3333-3333-3333-333333333333"
USER_M_ID = "ddddddd4-4444-4444-4444-444444444444"


@pytest.fixture
def multi_tenant_setup(db_session, monkeypatch):
    """
    Sets up two isolated workspaces (Workspace A and Workspace B)
    with their own dedicated users, customers, transactions, and recovery cases.
    """
    now = datetime.now(timezone.utc)

    # 1. Create Workspace A
    ws_a = db_session.query(Workspace).filter(Workspace.id == WORKSPACE_A_ID).first()
    if not ws_a:
        ws_a = Workspace(id=WORKSPACE_A_ID, name="Merchant Alpha Inc", created_at=now, updated_at=now)
        db_session.add(ws_a)

    # 2. Create Workspace B
    ws_b = db_session.query(Workspace).filter(Workspace.id == WORKSPACE_B_ID).first()
    if not ws_b:
        ws_b = Workspace(id=WORKSPACE_B_ID, name="Merchant Beta Corp", created_at=now, updated_at=now)
        db_session.add(ws_b)

    # 3. Create Profiles
    prof_a = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    if not prof_a:
        prof_a = Profile(id=USER_A_ID, email="alpha@merchant.io", full_name="Alpha Admin", role="admin", created_at=now, updated_at=now)
        db_session.add(prof_a)

    prof_a_op = db_session.query(Profile).filter(Profile.id == USER_A_OP_ID).first()
    if not prof_a_op:
        prof_a_op = Profile(id=USER_A_OP_ID, email="alpha.op@merchant.io", full_name="Alpha Operator", role="operator", created_at=now, updated_at=now)
        db_session.add(prof_a_op)

    prof_b = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    if not prof_b:
        prof_b = Profile(id=USER_B_ID, email="beta@merchant.io", full_name="Beta Admin", role="admin", created_at=now, updated_at=now)
        db_session.add(prof_b)

    prof_b_op = db_session.query(Profile).filter(Profile.id == USER_B_OP_ID).first()
    if not prof_b_op:
        prof_b_op = Profile(id=USER_B_OP_ID, email="beta.op@merchant.io", full_name="Beta Operator", role="operator", created_at=now, updated_at=now)
        db_session.add(prof_b_op)

    prof_c = db_session.query(Profile).filter(Profile.id == USER_C_ID).first()
    if not prof_c:
        prof_c = Profile(id=USER_C_ID, email="orphan@noworkspace.io", full_name="Orphan User", role="operator", created_at=now, updated_at=now)
        db_session.add(prof_c)

    prof_m = db_session.query(Profile).filter(Profile.id == USER_M_ID).first()
    if not prof_m:
        prof_m = Profile(id=USER_M_ID, email="multi@merchant.io", full_name="Multi User", role="operator", created_at=now, updated_at=now)
        db_session.add(prof_m)

    db_session.flush()

    # 4. Create Workspace Memberships
    mem_a = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_A_ID, WorkspaceMember.user_id == USER_A_ID).first()
    if not mem_a:
        mem_a = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_A_ID, user_id=USER_A_ID, role="admin", created_at=now, updated_at=now)
        db_session.add(mem_a)

    mem_a_op = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_A_ID, WorkspaceMember.user_id == USER_A_OP_ID).first()
    if not mem_a_op:
        mem_a_op = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_A_ID, user_id=USER_A_OP_ID, role="operator", created_at=now, updated_at=now)
        db_session.add(mem_a_op)

    mem_b = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_B_ID, WorkspaceMember.user_id == USER_B_ID).first()
    if not mem_b:
        mem_b = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_B_ID, user_id=USER_B_ID, role="admin", created_at=now, updated_at=now)
        db_session.add(mem_b)

    mem_b_op = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_B_ID, WorkspaceMember.user_id == USER_B_OP_ID).first()
    if not mem_b_op:
        mem_b_op = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_B_ID, user_id=USER_B_OP_ID, role="operator", created_at=now, updated_at=now)
        db_session.add(mem_b_op)

    # Multi-workspace user memberships in BOTH A and B
    mem_m_a = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_A_ID, WorkspaceMember.user_id == USER_M_ID).first()
    if not mem_m_a:
        mem_m_a = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_A_ID, user_id=USER_M_ID, role="operator", created_at=now, updated_at=now)
        db_session.add(mem_m_a)

    mem_m_b = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_B_ID, WorkspaceMember.user_id == USER_M_ID).first()
    if not mem_m_b:
        mem_m_b = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_B_ID, user_id=USER_M_ID, role="operator", created_at=now, updated_at=now)
        db_session.add(mem_m_b)

    # NOTE: USER_C_ID has NO WorkspaceMember row intentionally!

    # 5. Create Tenant A Domain Records
    cust_a = db_session.query(Customer).filter(Customer.id == "cust_alpha_01").first()
    if not cust_a:
        cust_a = Customer(id="cust_alpha_01", workspace_id=WORKSPACE_A_ID, name="Alpha Customer", email="shopper@alpha.io", phone="+919811111111", tier="ENTERPRISE", ltv=50000.0)
        db_session.add(cust_a)

    tx_a = db_session.query(Transaction).filter(Transaction.id == "tx_alpha_01").first()
    if not tx_a:
        tx_a = Transaction(id="tx_alpha_01", workspace_id=WORKSPACE_A_ID, customer_id="cust_alpha_01", order_id="ord_alpha_101", amount=12000.0, method="UPI", status="FAILED", created_at=now)
        db_session.add(tx_a)

    rc_a = db_session.query(RecoveryCase).filter(RecoveryCase.id == "rc_alpha_01").first()
    if not rc_a:
        rc_a = RecoveryCase(
            id="rc_alpha_01",
            workspace_id=WORKSPACE_A_ID,
            transaction_id="tx_alpha_01",
            risk_amount=12000.0,
            status="IN_PROGRESS",
            failure_category="BANK_TIMEOUT",
            selected_strategy="PAYMENT_LINK",
            recovery_probability=0.85,
            expected_recovery_value=10200.0,
            created_at=now
        )
        db_session.add(rc_a)

    audit_a = db_session.query(AuditLog).filter(AuditLog.id == "aud_alpha_01").first()
    if not audit_a:
        audit_a = AuditLog(
            id="aud_alpha_01",
            workspace_id=WORKSPACE_A_ID,
            recovery_case_id="rc_alpha_01",
            transaction_id="tx_alpha_01",
            actor="SYSTEM_ALPHA",
            action_type="TEST_ALPHA",
            target_resource="rc_alpha_01",
            details="Alpha private operational audit log",
            created_at=now
        )
        db_session.add(audit_a)

    # 6. Create Tenant B Domain Records
    cust_b = db_session.query(Customer).filter(Customer.id == "cust_beta_01").first()
    if not cust_b:
        cust_b = Customer(id="cust_beta_01", workspace_id=WORKSPACE_B_ID, name="Beta Customer", email="shopper@beta.io", phone="+919822222222", tier="GROWTH", ltv=25000.0)
        db_session.add(cust_b)

    tx_b = db_session.query(Transaction).filter(Transaction.id == "tx_beta_01").first()
    if not tx_b:
        tx_b = Transaction(id="tx_beta_01", workspace_id=WORKSPACE_B_ID, customer_id="cust_beta_01", order_id="ord_beta_202", amount=45000.0, method="Card", status="FAILED", created_at=now)
        db_session.add(tx_b)

    rc_b = db_session.query(RecoveryCase).filter(RecoveryCase.id == "rc_beta_01").first()
    if not rc_b:
        rc_b = RecoveryCase(
            id="rc_beta_01",
            workspace_id=WORKSPACE_B_ID,
            transaction_id="tx_beta_01",
            risk_amount=45000.0,
            status="PENDING_APPROVAL",
            failure_category="HIGH_VALUE_THRESHOLD",
            selected_strategy="PAYMENT_LINK",
            recovery_probability=0.75,
            expected_recovery_value=33750.0,
            created_at=now
        )
        db_session.add(rc_b)

    audit_b = db_session.query(AuditLog).filter(AuditLog.id == "aud_beta_01").first()
    if not audit_b:
        audit_b = AuditLog(
            id="aud_beta_01",
            workspace_id=WORKSPACE_B_ID,
            recovery_case_id="rc_beta_01",
            transaction_id="tx_beta_01",
            actor="SYSTEM_BETA",
            action_type="TEST_BETA",
            target_resource="rc_beta_01",
            details="Beta private confidential audit log",
            created_at=now
        )
        db_session.add(audit_b)

    db_session.commit()

    # Mock JWT verification for Alpha, Beta, Orphan, and Multi-workspace
    original_verify = auth.verify_supabase_jwt
    def _tenant_verify(token: str):
        if token == "token_user_a":
            return {"id": USER_A_ID, "email": "alpha@merchant.io", "user_metadata": {"full_name": "Alpha Admin"}}
        elif token == "token_user_a_op":
            return {"id": USER_A_OP_ID, "email": "alpha.op@merchant.io", "user_metadata": {"full_name": "Alpha Operator"}}
        elif token == "token_user_b":
            return {"id": USER_B_ID, "email": "beta@merchant.io", "user_metadata": {"full_name": "Beta Admin"}}
        elif token == "token_user_b_op":
            return {"id": USER_B_OP_ID, "email": "beta.op@merchant.io", "user_metadata": {"full_name": "Beta Operator"}}
        elif token == "token_user_c":
            return {"id": USER_C_ID, "email": "orphan@noworkspace.io", "user_metadata": {"full_name": "Orphan User"}}
        elif token == "token_user_m":
            return {"id": USER_M_ID, "email": "multi@merchant.io", "user_metadata": {"full_name": "Multi User"}}
        elif token in ("test_auth_token", "test_admin_token"):
            return {"id": "597289a7-e26e-415d-ab4d-fa587e32899a", "email": "test.ops@recoverai.io", "user_metadata": {"full_name": "Revenue Ops Admin"}}
        return original_verify(token)

    monkeypatch.setattr(auth, "verify_supabase_jwt", _tenant_verify)

    return {
        "workspace_a_id": WORKSPACE_A_ID,
        "workspace_b_id": WORKSPACE_B_ID,
        "user_a_token": "token_user_a",
        "user_a_op_token": "token_user_a_op",
        "user_b_token": "token_user_b",
        "user_b_op_token": "token_user_b_op",
        "user_c_token": "token_user_c",
        "user_m_token": "token_user_m",
        "user_a_id": USER_A_ID,
        "user_a_op_id": USER_A_OP_ID,
        "user_b_id": USER_B_ID,
        "user_b_op_id": USER_B_OP_ID,
        "user_c_id": USER_C_ID,
        "user_m_id": USER_M_ID,
        "tx_a_id": "tx_alpha_01",
        "tx_b_id": "tx_beta_01",
        "rc_a_id": "rc_alpha_01",
        "rc_b_id": "rc_beta_01",
        "aud_a_id": "aud_alpha_01",
        "aud_b_id": "aud_beta_01",
    }


def test_workspace_and_membership_models_exist(multi_tenant_setup, db_session):
    """1. Verifies that Workspace and WorkspaceMember models exist and persist correctly."""
    ws_a = db_session.query(Workspace).filter(Workspace.id == WORKSPACE_A_ID).first()
    assert ws_a is not None
    assert ws_a.name == "Merchant Alpha Inc"

    mem_a = db_session.query(WorkspaceMember).filter(WorkspaceMember.user_id == USER_A_ID).first()
    assert mem_a is not None
    assert str(mem_a.workspace_id) == WORKSPACE_A_ID
    assert mem_a.role == "admin"


def test_existing_data_backfilled_to_demo_workspace(client, auth_headers, db_session):
    """2. Verifies that default RecoverAI Demo Workspace exists and existing records belong to it."""
    demo_ws = db_session.query(Workspace).filter(Workspace.id == DEFAULT_WORKSPACE_ID).first()
    assert demo_ws is not None
    assert "RecoverAI" in demo_ws.name

    # Default admin belongs to demo workspace
    mem = db_session.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == DEFAULT_WORKSPACE_ID,
        WorkspaceMember.user_id == "597289a7-e26e-415d-ab4d-fa587e32899a"
    ).first()
    assert mem is not None


def test_transactions_scoped_to_workspace(multi_tenant_setup, client):
    """3. User A can list and view A transactions, but cannot retrieve B transactions (404)."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {multi_tenant_setup['user_b_token']}"}

    # User A lists transactions
    res_a = client.get("/api/v1/transactions", headers=headers_a)
    assert res_a.status_code == 200
    tx_ids_a = [t["id"] for t in res_a.json()["items"]]
    assert multi_tenant_setup["tx_a_id"] in tx_ids_a
    assert multi_tenant_setup["tx_b_id"] not in tx_ids_a

    # User B lists transactions
    res_b = client.get("/api/v1/transactions", headers=headers_b)
    assert res_b.status_code == 200
    tx_ids_b = [t["id"] for t in res_b.json()["items"]]
    assert multi_tenant_setup["tx_b_id"] in tx_ids_b
    assert multi_tenant_setup["tx_a_id"] not in tx_ids_b

    # User A accesses A transaction -> 200 OK
    own_tx = client.get(f"/api/v1/transactions/{multi_tenant_setup['tx_a_id']}", headers=headers_a)
    assert own_tx.status_code == 200

    # Cross-tenant: User A accesses B transaction -> 404 Not Found
    cross_tx = client.get(f"/api/v1/transactions/{multi_tenant_setup['tx_b_id']}", headers=headers_a)
    assert cross_tx.status_code == 404
    assert "not found" in cross_tx.json()["detail"].lower()


def test_recovery_cases_scoped_to_workspace(multi_tenant_setup, client):
    """4. User A can view A recovery cases, but cannot retrieve B recovery cases (404)."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {multi_tenant_setup['user_b_token']}"}

    # User A lists cases
    res_a = client.get("/api/v1/recovery-cases", headers=headers_a)
    assert res_a.status_code == 200
    case_ids_a = [c["id"] for c in res_a.json()["items"]]
    assert multi_tenant_setup["rc_a_id"] in case_ids_a
    assert multi_tenant_setup["rc_b_id"] not in case_ids_a

    # User A reads A case -> 200
    own_case = client.get(f"/api/v1/recovery-cases/{multi_tenant_setup['rc_a_id']}", headers=headers_a)
    assert own_case.status_code == 200

    # Cross-tenant: User A reads B case -> 404 Not Found
    cross_case = client.get(f"/api/v1/recovery-cases/{multi_tenant_setup['rc_b_id']}", headers=headers_a)
    assert cross_case.status_code == 404


def test_recovery_executor_workflows_scoped_to_workspace(multi_tenant_setup, client):
    """5. User A cannot view, step, execute, or simulate B workflows (404)."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}

    # Cross-tenant workflow get -> 404
    res_get = client.get(f"/api/v1/recovery/workflows/{multi_tenant_setup['rc_b_id']}", headers=headers_a)
    assert res_get.status_code == 404

    # Cross-tenant workflow step -> 404
    res_step = client.post(f"/api/v1/recovery/workflows/{multi_tenant_setup['rc_b_id']}/step", json={}, headers=headers_a)
    assert res_step.status_code == 404

    # Cross-tenant workflow execute -> 404
    res_exec = client.post(f"/api/v1/recovery/workflows/{multi_tenant_setup['rc_b_id']}/execute", json={}, headers=headers_a)
    assert res_exec.status_code == 404

    # Cross-tenant payment-link -> 404
    res_link = client.post(f"/api/v1/recovery/workflows/{multi_tenant_setup['rc_b_id']}/payment-link", json={}, headers=headers_a)
    assert res_link.status_code == 404

    # Cross-tenant simulate-outcome -> 404
    res_sim = client.post(f"/api/v1/recovery/workflows/{multi_tenant_setup['rc_b_id']}/simulate-outcome", json={"outcome": "RECOVERED"}, headers=headers_a)
    assert res_sim.status_code == 404


def test_audit_trail_scoped_to_workspace(multi_tenant_setup, client):
    """6. User A cannot view B audit logs or case chronology (404 or filtered out)."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {multi_tenant_setup['user_b_token']}"}

    # User A lists all audits -> only sees Alpha events
    res_a = client.get("/api/v1/audit", headers=headers_a)
    assert res_a.status_code == 200
    audit_ids = [a["id"] for a in res_a.json()["items"]]
    assert multi_tenant_setup["aud_a_id"] in audit_ids
    assert multi_tenant_setup["aud_b_id"] not in audit_ids

    # User A requests transaction audit for B -> returns empty []
    tx_audit_b = client.get(f"/api/v1/audit/{multi_tenant_setup['tx_b_id']}", headers=headers_a)
    assert tx_audit_b.status_code == 200
    assert tx_audit_b.json() == []

    # User A requests chronology of Case B -> 404 Not Found
    chrono_b = client.get(f"/api/v1/audit/case/{multi_tenant_setup['rc_b_id']}/chronology", headers=headers_a)
    assert chrono_b.status_code == 404


def test_guardrails_approval_queue_scoped_to_workspace(multi_tenant_setup, client):
    """7. User A cannot see or approve B approval queue items (404)."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}

    # Case B is PENDING_APPROVAL; User A must not see Case B in approval queue
    q_res = client.get("/api/v1/guardrails/approval-queue", headers=headers_a)
    assert q_res.status_code == 200
    case_ids = [item["case_id"] for item in q_res.json()]
    assert multi_tenant_setup["rc_b_id"] not in case_ids

    # Cross-tenant approval decision: User A attempts to approve Case B -> 404 Not Found
    dec_res = client.post(
        f"/api/v1/guardrails/approval-queue/{multi_tenant_setup['rc_b_id']}/decision",
        json={"decision": "APPROVE", "operator_name": "Attacker"},
        headers=headers_a
    )
    assert dec_res.status_code == 404

    # Cross-tenant forensics: User A requests why-stopped for Case B -> 404 Not Found
    forensics = client.get(f"/api/v1/guardrails/forensics/{multi_tenant_setup['rc_b_id']}", headers=headers_a)
    assert forensics.status_code == 404


def test_cross_workspace_header_tampering_rejected_403(multi_tenant_setup, client):
    """8. Unauthorized attempt to switch workspace via X-Workspace-Id header returns 403 Forbidden."""
    # User A attempts to supply X-Workspace-Id for Workspace B
    attack_headers = {
        "Authorization": f"Bearer {multi_tenant_setup['user_a_token']}",
        "X-Workspace-Id": WORKSPACE_B_ID
    }
    res = client.get("/api/v1/transactions", headers=attack_headers)
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]

    # User B attempts to supply X-Workspace-Id for Workspace A
    attack_headers_b = {
        "Authorization": f"Bearer {multi_tenant_setup['user_b_token']}",
        "X-Workspace-Id": WORKSPACE_A_ID
    }
    res_b = client.get("/api/v1/transactions", headers=attack_headers_b)
    assert res_b.status_code == 403
    assert "Access denied" in res_b.json()["detail"]


@pytest.mark.asyncio
async def test_sse_event_broadcaster_workspace_partitioning():
    """9. SSE events broadcast to Workspace A must never be delivered to Workspace B listeners."""
    broadcaster = EventBroadcaster()

    queue_a = asyncio.Queue()
    queue_b = asyncio.Queue()

    # Register listeners in isolated workspaces
    broadcaster._listeners[WORKSPACE_A_ID].add(queue_a)
    broadcaster._listeners[WORKSPACE_B_ID].add(queue_b)

    assert broadcaster.listener_count == 2
    assert broadcaster.workspace_listener_count(WORKSPACE_A_ID) == 1
    assert broadcaster.workspace_listener_count(WORKSPACE_B_ID) == 1

    # Broadcast event strictly to Workspace A
    await broadcaster.broadcast(
        event_type="SECRET_TRANSACTION_RECOVERED",
        data={"order_id": "ORD_ALPHA_CONFIDENTIAL", "amount": 99999.0},
        workspace_id=WORKSPACE_A_ID
    )

    # Queue A must receive the event
    assert not queue_a.empty()
    item_a = queue_a.get_nowait()
    assert item_a["type"] == "SECRET_TRANSACTION_RECOVERED"
    assert item_a["workspace_id"] == WORKSPACE_A_ID
    assert item_a["data"]["order_id"] == "ORD_ALPHA_CONFIDENTIAL"

    # Queue B must receive NOTHING (complete silence)
    assert queue_b.empty()


def test_sse_stream_ticket_scoped_to_user_workspace(multi_tenant_setup, client):
    """10. Stream tickets generated by User A are bound to Workspace A."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    res = client.post("/api/events/stream-ticket", headers=headers_a)
    assert res.status_code == 200
    data = res.json()
    assert "ticket" in data
    assert data["workspace_id"] == WORKSPACE_A_ID


def test_overview_kpis_strictly_isolated(multi_tenant_setup, client):
    """11. Overview KPIs (Revenue at Risk, Recovered, Active) are strictly scoped per workspace."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {multi_tenant_setup['user_b_token']}"}

    # User A requests Dashboard
    res_a = client.get("/api/v1/dashboard", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    metrics_a = data_a["metrics"]
    assert metrics_a["revenue_at_risk"] == 12000.0
    assert metrics_a["active_recoveries"] == 1

    # User B requests Dashboard
    res_b = client.get("/api/v1/dashboard", headers=headers_b)
    assert res_b.status_code == 200
    data_b = res_b.json()
    metrics_b = data_b["metrics"]
    assert metrics_b["revenue_at_risk"] == 45000.0
    assert metrics_b["revenue_at_risk"] != metrics_a["revenue_at_risk"]


def test_analytics_strictly_isolated(multi_tenant_setup, client):
    """12. Financial analytics breakdowns and time series return only the authenticated tenant's data."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {multi_tenant_setup['user_b_token']}"}

    # User A Analytics
    res_a = client.get("/api/v1/analytics", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["kpis"]["revenue_at_risk"] == 12000.0
    upi_a = next(m for m in data_a["recovery_by_payment_method"] if m["method"].upper() == "UPI")
    card_a = next(m for m in data_a["recovery_by_payment_method"] if m["method"].upper() == "CARD")
    assert upi_a["total_volume"] == 1
    assert upi_a["at_risk_amount"] == 12000.0
    assert card_a["total_volume"] == 0
    assert card_a["at_risk_amount"] == 0.0

    # User B Analytics
    res_b = client.get("/api/v1/analytics", headers=headers_b)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["kpis"]["revenue_at_risk"] == 45000.0
    card_b = next(m for m in data_b["recovery_by_payment_method"] if m["method"].upper() == "CARD")
    upi_b = next(m for m in data_b["recovery_by_payment_method"] if m["method"].upper() == "UPI")
    assert card_b["total_volume"] == 1
    assert card_b["at_risk_amount"] == 45000.0
    assert upi_b["total_volume"] == 0
    assert upi_b["at_risk_amount"] == 0.0


def test_at_risk_totals_strictly_isolated(multi_tenant_setup, client):
    """13. At-Risk queue totals include only cases from the current workspace."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {multi_tenant_setup['user_b_token']}"}

    res_a = client.get("/api/v1/recovery-cases/queue-counts", headers=headers_a)
    assert res_a.status_code == 200
    assert res_a.json()["all_at_risk"] == 1

    res_b = client.get("/api/v1/recovery-cases/queue-counts", headers=headers_b)
    assert res_b.status_code == 200
    assert res_b.json()["all_at_risk"] == 1


def test_user_management_strictly_isolated(multi_tenant_setup, client):
    """14. Workspace user list is scoped; Admin cross-workspace role update is blocked."""
    headers_a = {"Authorization": f"Bearer {multi_tenant_setup['user_a_token']}"}
    headers_b = {"Authorization": f"Bearer {multi_tenant_setup['user_b_token']}"}

    # Admin A lists users
    res_a = client.get("/api/v1/admin/users", headers=headers_a)
    assert res_a.status_code == 200
    user_ids_a = [u["id"] for u in res_a.json()]
    assert multi_tenant_setup["user_a_id"] in user_ids_a
    assert multi_tenant_setup["user_a_op_id"] in user_ids_a
    assert multi_tenant_setup["user_b_id"] not in user_ids_a
    assert multi_tenant_setup["user_b_op_id"] not in user_ids_a

    # Admin B lists users
    res_b = client.get("/api/v1/admin/users", headers=headers_b)
    assert res_b.status_code == 200
    user_ids_b = [u["id"] for u in res_b.json()]
    assert multi_tenant_setup["user_b_id"] in user_ids_b
    assert multi_tenant_setup["user_b_op_id"] in user_ids_b
    assert multi_tenant_setup["user_a_id"] not in user_ids_b

    # Admin A attempts cross-workspace role change on User B -> 404
    attack_res = client.patch(
        f"/api/v1/admin/users/{multi_tenant_setup['user_b_id']}/role",
        json={"role": "operator"},
        headers=headers_a
    )
    assert attack_res.status_code == 404
    assert "not found" in attack_res.json()["detail"].lower()

    # Admin A updates role of in-workspace operator -> 200 OK
    promote_res = client.patch(
        f"/api/v1/admin/users/{multi_tenant_setup['user_a_op_id']}/role",
        json={"role": "admin"},
        headers=headers_a
    )
    assert promote_res.status_code == 200
    assert promote_res.json()["role"] == "admin"


def test_public_checkout_workspace_ownership_and_anti_spoofing(multi_tenant_setup, client, db_session):
    """15. Public checkout works without JWT and prevents client-side workspace_id spoofing."""
    from app.models import CheckoutSession

    # Malicious attempt to inject Workspace B ID in public checkout payload
    payload = {
        "cart_amount": 2999.0,
        "customer_name": "Public Shopper",
        "customer_email": "shopper@public.com",
        "workspace_id": WORKSPACE_B_ID
    }
    res = client.post("/api/v1/checkout/sessions", json=payload)
    assert res.status_code == 200
    session_id = res.json()["id"]

    # Verify session in database is assigned to trusted demo workspace, NOT WORKSPACE_B_ID
    session_db = db_session.query(CheckoutSession).filter(CheckoutSession.id == session_id).first()
    assert session_db is not None
    assert str(session_db.workspace_id) == DEFAULT_WORKSPACE_ID
    assert str(session_db.workspace_id) != WORKSPACE_B_ID


def test_razorpay_webhook_derives_workspace_internally(multi_tenant_setup, client, db_session, monkeypatch):
    """16. Razorpay webhook derives workspace ownership internally from transaction, never external payload."""
    import hmac
    import hashlib
    from app.services.razorpay_service import razorpay_service

    # Monkeypatch signature verification to true for this test
    monkeypatch.setattr(razorpay_service, "verify_webhook_signature", lambda raw, sig: True)

    webhook_payload = {
        "event": "payment.captured",
        "id": f"evt_test_{uuid.uuid4().hex[:12]}",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_{uuid.uuid4().hex[:10]}",
                    "order_id": "ord_alpha_101",
                    "amount": 1200000,
                    "method": "upi",
                    "notes": {
                        "workspace_id": WORKSPACE_B_ID  # Malicious attempt to forge workspace in webhook payload
                    }
                }
            }
        }
    }

    raw_json = json.dumps(webhook_payload).encode("utf-8")
    headers = {
        "X-Razorpay-Signature": "mock_sig_123",
        "Content-Type": "application/json"
    }

    res = client.post("/api/v1/webhooks/razorpay", data=raw_json, headers=headers)
    assert res.status_code == 200

    # Verify AuditLog created for this event has workspace_id == WORKSPACE_A_ID (derived from tx_alpha_01)
    aud = db_session.query(AuditLog).filter(
        AuditLog.transaction_id == multi_tenant_setup["tx_a_id"],
        AuditLog.action_type == "PAYMENT_CAPTURED"
    ).first()
    assert aud is not None
    assert str(aud.workspace_id) == WORKSPACE_A_ID
    assert str(aud.workspace_id) != WORKSPACE_B_ID


def test_unassigned_user_safely_bounded_to_default_workspace(multi_tenant_setup, client, db_session):
    """17. Authenticated user with no pre-assigned workspace is safely placed into bounded DEFAULT_WORKSPACE_ID and cannot access other tenants."""
    headers_c = {"Authorization": f"Bearer {multi_tenant_setup['user_c_token']}"}

    # 1. User C requests transactions -> bounded to DEFAULT_WORKSPACE_ID
    res = client.get("/api/v1/transactions", headers=headers_c)
    assert res.status_code == 200
    tx_ids = [t["id"] for t in res.json()["items"]]
    assert multi_tenant_setup["tx_a_id"] not in tx_ids
    assert multi_tenant_setup["tx_b_id"] not in tx_ids

    # 2. User C direct read of Workspace A transaction -> 404 Not Found
    res_direct = client.get(f"/api/v1/transactions/{multi_tenant_setup['tx_a_id']}", headers=headers_c)
    assert res_direct.status_code == 404

    # 3. User C attempt to switch to Workspace A via header -> 403 Forbidden
    res_tamper = client.get(
        "/api/v1/transactions",
        headers={**headers_c, "X-Workspace-Id": multi_tenant_setup["workspace_a_id"]}
    )
    assert res_tamper.status_code == 403
    assert "Access denied" in res_tamper.json()["detail"]


def test_multi_workspace_user_deterministic_behavior(multi_tenant_setup, client):
    """18. Multi-workspace user requires explicit X-Workspace-Id header; routes correctly when provided."""
    headers_m = {"Authorization": f"Bearer {multi_tenant_setup['user_m_token']}"}

    # 1. Request without header -> 400 Bad Request
    res_no_header = client.get("/api/v1/transactions", headers=headers_m)
    assert res_no_header.status_code == 400
    assert "Multiple workspace memberships found" in res_no_header.json()["detail"]

    # 2. Request with Workspace A header -> sees only Workspace A
    res_a = client.get("/api/v1/transactions", headers={**headers_m, "X-Workspace-Id": WORKSPACE_A_ID})
    assert res_a.status_code == 200
    tx_ids_a = [t["id"] for t in res_a.json()["items"]]
    assert multi_tenant_setup["tx_a_id"] in tx_ids_a
    assert multi_tenant_setup["tx_b_id"] not in tx_ids_a

    # 3. Request with Workspace B header -> sees only Workspace B
    res_b = client.get("/api/v1/transactions", headers={**headers_m, "X-Workspace-Id": WORKSPACE_B_ID})
    assert res_b.status_code == 200
    tx_ids_b = [t["id"] for t in res_b.json()["items"]]
    assert multi_tenant_setup["tx_b_id"] in tx_ids_b
    assert multi_tenant_setup["tx_a_id"] not in tx_ids_b

    # 4. Request with unauthorized workspace header -> 403 Forbidden
    res_unauth = client.get("/api/v1/transactions", headers={**headers_m, "X-Workspace-Id": "33333333-3333-3333-3333-333333333333"})
    assert res_unauth.status_code == 403
    assert "Access denied" in res_unauth.json()["detail"]

