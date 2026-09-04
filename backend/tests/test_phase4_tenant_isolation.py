import uuid
import json
import asyncio
from datetime import datetime
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
USER_B_ID = "bbbbbbb2-2222-2222-2222-222222222222"


@pytest.fixture
def multi_tenant_setup(db_session, monkeypatch):
    """
    Sets up two isolated workspaces (Workspace A and Workspace B)
    with their own dedicated users, customers, transactions, and recovery cases.
    """
    now = datetime.utcnow()

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

    prof_b = db_session.query(Profile).filter(Profile.id == USER_B_ID).first()
    if not prof_b:
        prof_b = Profile(id=USER_B_ID, email="beta@merchant.io", full_name="Beta Admin", role="admin", created_at=now, updated_at=now)
        db_session.add(prof_b)

    db_session.flush()

    # 4. Create Workspace Memberships
    mem_a = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_A_ID, WorkspaceMember.user_id == USER_A_ID).first()
    if not mem_a:
        mem_a = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_A_ID, user_id=USER_A_ID, role="admin", created_at=now, updated_at=now)
        db_session.add(mem_a)

    mem_b = db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == WORKSPACE_B_ID, WorkspaceMember.user_id == USER_B_ID).first()
    if not mem_b:
        mem_b = WorkspaceMember(id=str(uuid.uuid4()), workspace_id=WORKSPACE_B_ID, user_id=USER_B_ID, role="admin", created_at=now, updated_at=now)
        db_session.add(mem_b)

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

    # Mock JWT verification for Alpha and Beta
    original_verify = auth.verify_supabase_jwt
    def _tenant_verify(token: str):
        if token == "token_user_a":
            return {"id": USER_A_ID, "email": "alpha@merchant.io", "user_metadata": {"full_name": "Alpha Admin"}}
        elif token == "token_user_b":
            return {"id": USER_B_ID, "email": "beta@merchant.io", "user_metadata": {"full_name": "Beta Admin"}}
        elif token in ("test_auth_token", "test_admin_token"):
            return {"id": "597289a7-e26e-415d-ab4d-fa587e32899a", "email": "test.ops@recoverai.io", "user_metadata": {"full_name": "Revenue Ops Admin"}}
        return original_verify(token)

    monkeypatch.setattr(auth, "verify_supabase_jwt", _tenant_verify)

    return {
        "workspace_a_id": WORKSPACE_A_ID,
        "workspace_b_id": WORKSPACE_B_ID,
        "user_a_token": "token_user_a",
        "user_b_token": "token_user_b",
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
