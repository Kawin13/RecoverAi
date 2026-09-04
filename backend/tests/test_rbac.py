import uuid
import pytest
from app.models.profiles import Profile
from app.models.audit_logs import AuditLog
from app.models.recovery_cases import RecoveryCase
from app.models.transactions import Transaction
from app.models.customers import Customer

def _setup_users_and_case(db_session):
    s = uuid.uuid4().hex[:8]
    # Setup Admin Profile
    admin_prof = Profile(
        id=str(uuid.uuid4()),
        email=f"admin_{s}@recoverai.io",
        full_name=f"Admin User {s}",
        role="admin"
    )
    # Setup Operator Profile
    operator_prof = Profile(
        id=str(uuid.uuid4()),
        email=f"operator_{s}@recoverai.io",
        full_name=f"Operator User {s}",
        role="operator"
    )
    # Setup a Pending Case
    cust = Customer(id=f"c_rbac_{s}", name=f"RBAC Customer {s}", email=f"rbac_{s}@customer.io", ltv=10000.0)
    tx = Transaction(id=f"tx_rbac_{s}", order_id=f"ord_rbac_{s}", customer_id=cust.id, amount=15000.0, status="FAILED")
    case = RecoveryCase(
        id=f"case_rbac_{s}",
        transaction_id=tx.id,
        risk_amount=15000.0,
        failure_category="GATEWAY_TIMEOUT",
        status="PENDING_APPROVAL",
        current_step="PENDING_APPROVAL"
    )
    db_session.add_all([admin_prof, operator_prof, cust, tx, case])
    db_session.commit()
    return admin_prof, operator_prof, case

def test_unauthenticated_access_to_admin_endpoints(client):
    # Test A: Invalid / Expired Token -> admin API returns 401
    res = client.get("/api/v1/admin/users", headers={"Authorization": "Bearer invalid_expired_token_123"})
    assert res.status_code == 401

def test_operator_cannot_access_admin_users(client, db_session, monkeypatch):
    admin_prof, operator_prof, case = _setup_users_and_case(db_session)
    
    # Mock verify_supabase_jwt to return operator identity
    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": operator_prof.id,
        "email": operator_prof.email,
        "user_metadata": {"full_name": operator_prof.full_name}
    })

    headers = {"Authorization": "Bearer fake_operator_token"}
    
    # Test B: Operator -> admin users API -> 403
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 403
    assert "Administrator" in res.json()["detail"]

def test_operator_cannot_approve_guardrails(client, db_session, monkeypatch):
    admin_prof, operator_prof, case = _setup_users_and_case(db_session)
    
    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": operator_prof.id,
        "email": operator_prof.email,
        "user_metadata": {"full_name": operator_prof.full_name}
    })

    headers = {"Authorization": "Bearer fake_operator_token"}
    payload = {
        "decision": "APPROVE",
        "operator_name": "Malicious Operator",
        "operator_notes": "Attempting unauthorized approval"
    }
    
    # Test C: Operator -> Guardrail approval API -> 403
    res = client.post(f"/api/guardrails/approval-queue/{case.id}/decision", json=payload, headers=headers)
    assert res.status_code == 403

def test_operator_cannot_change_roles(client, db_session, monkeypatch):
    admin_prof, operator_prof, case = _setup_users_and_case(db_session)
    
    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": operator_prof.id,
        "email": operator_prof.email,
        "user_metadata": {"full_name": operator_prof.full_name}
    })

    headers = {"Authorization": "Bearer fake_operator_token"}
    
    # Test D: Operator -> self promote / role change API -> 403
    res = client.patch(f"/api/v1/admin/users/{operator_prof.id}/role", json={"role": "admin"}, headers=headers)
    assert res.status_code == 403

def test_admin_can_list_users_and_promote_operator(client, db_session, monkeypatch):
    admin_prof, operator_prof, case = _setup_users_and_case(db_session)
    
    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_prof.id,
        "email": admin_prof.email,
        "user_metadata": {"full_name": admin_prof.full_name}
    })

    headers = {"Authorization": "Bearer fake_admin_token"}
    
    # Test E: Admin -> users API -> success
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 200
    users = res.json()
    assert any(u["id"] == operator_prof.id for u in users)

    # Test F: Admin -> promote operator -> success
    promote_res = client.patch(
        f"/api/v1/admin/users/{operator_prof.id}/role",
        json={"role": "admin"},
        headers=headers
    )
    assert promote_res.status_code == 200
    assert promote_res.json()["role"] == "admin"
    
    db_session.refresh(operator_prof)
    assert operator_prof.role == "admin"

    # Verify AuditLog created
    audit = db_session.query(AuditLog).filter(
        AuditLog.action_type == "USER_ROLE_CHANGED",
        AuditLog.target_resource == operator_prof.id
    ).first()
    assert audit is not None
    assert "Administrator changed" in audit.details

def test_last_admin_protection(client, db_session, monkeypatch):
    s = uuid.uuid4().hex[:8]
    # Ensure only 1 admin exists
    db_session.query(Profile).filter(Profile.role == "admin").delete()
    solo_admin = Profile(
        id=str(uuid.uuid4()),
        email=f"soloadmin_{s}@recoverai.io",
        full_name=f"Solo Admin {s}",
        role="admin"
    )
    db_session.add(solo_admin)
    db_session.commit()

    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": solo_admin.id,
        "email": solo_admin.email,
        "user_metadata": {"full_name": solo_admin.full_name}
    })

    headers = {"Authorization": "Bearer fake_admin_token"}

    # Test G: Demote final remaining admin -> blocked
    demote_res = client.patch(
        f"/api/v1/admin/users/{solo_admin.id}/role",
        json={"role": "operator"},
        headers=headers
    )
    assert demote_res.status_code == 400
    assert "RecoverAI must have at least one Administrator." in demote_res.json()["detail"]

    # Verify admin role remains intact
    db_session.refresh(solo_admin)
    assert solo_admin.role == "admin"

def test_admin_can_approve_guardrails(client, db_session, monkeypatch):
    admin_prof, operator_prof, case = _setup_users_and_case(db_session)

    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_prof.id,
        "email": admin_prof.email,
        "user_metadata": {"full_name": admin_prof.full_name}
    })

    headers = {"Authorization": "Bearer fake_admin_token"}
    payload = {
        "decision": "APPROVE",
        "operator_name": "Senior Admin",
        "operator_notes": "Supervisor verified high ticket order"
    }

    res = client.post(f"/api/guardrails/approval-queue/{case.id}/decision", json=payload, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    
    db_session.refresh(case)
    assert case.status == "ACTION_SCHEDULED"
