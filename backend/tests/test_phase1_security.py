"""
RecoverAI - Phase 1 Security Validation Suite
Tests all Phase 1 objectives:
1. Valid admin login -> works (200 OK)
2. Valid operator login -> works (200 OK on operator routes, 403 Forbidden on admin routes)
3. Missing JWT -> rejected (401 Unauthorized)
4. Fake X-RecoverAI-Demo header -> rejected (401 Unauthorized)
5. Fake role=admin request / metadata -> ignored (DB role authoritative)
6. Hardcoded old test account gets no special privileges (new profile defaults to operator)
7. Bootstrapped admin stored in profiles continues to work
8. Demo header provides zero privilege escalation to authenticated operators
"""

import uuid
import pytest
from datetime import datetime
from app.models.profiles import Profile
from app.models.recovery_cases import RecoveryCase
from app.models.transactions import Transaction
from app.models.customers import Customer
from app.core import auth

def test_missing_jwt_rejected(client):
    """Missing JWT bearer token must be rejected with 401 Unauthorized."""
    # Test protected endpoints without any Authorization header
    res_dash = client.get("/api/dashboard")
    assert res_dash.status_code == 401
    assert "Authentication required" in res_dash.json().get("detail", "")

    res_admin = client.get("/api/v1/admin/users")
    assert res_admin.status_code == 401

    res_tx = client.get("/api/transactions")
    assert res_tx.status_code == 401

    res_analytics = client.get("/api/analytics")
    assert res_analytics.status_code == 401


def test_fake_demo_header_rejected(client):
    """X-RecoverAI-Demo header must NEVER grant access or create a session."""
    # Missing JWT + X-RecoverAI-Demo: active -> 401
    headers_demo = {"X-RecoverAI-Demo": "active"}

    res_dash = client.get("/api/dashboard", headers=headers_demo)
    assert res_dash.status_code == 401
    assert "Authentication required" in res_dash.json().get("detail", "")

    res_admin = client.get("/api/v1/admin/users", headers=headers_demo)
    assert res_admin.status_code == 401

    res_tx = client.get("/api/transactions", headers=headers_demo)
    assert res_tx.status_code == 401

    # Invalid token + X-RecoverAI-Demo: active -> 401
    headers_both = {
        "X-RecoverAI-Demo": "active",
        "Authorization": "Bearer fake_or_expired_jwt_token"
    }
    res_invalid = client.get("/api/dashboard", headers=headers_both)
    assert res_invalid.status_code == 401


def test_valid_admin_login_works(client, db_session, monkeypatch):
    """Valid administrator with database role 'admin' can access admin & protected endpoints."""
    admin_id = str(uuid.uuid4())
    admin_prof = Profile(
        id=admin_id,
        email=f"admin_{admin_id[:8]}@recoverai.io",
        full_name="Phase1 Admin",
        role="admin",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(admin_prof)
    db_session.commit()

    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_id,
        "email": admin_prof.email,
        "user_metadata": {"full_name": admin_prof.full_name}
    })

    headers = {"Authorization": "Bearer valid_admin_token"}

    # Admin access to dashboard -> 200
    res_dash = client.get("/api/dashboard", headers=headers)
    assert res_dash.status_code == 200

    # Admin access to user management -> 200
    res_admin = client.get("/api/v1/admin/users", headers=headers)
    assert res_admin.status_code == 200
    users = res_admin.json()
    assert any(u["id"] == admin_id for u in users)


def test_valid_operator_login_works_and_admin_blocked(client, db_session, monkeypatch):
    """Valid operator with database role 'operator' can access operations, blocked from admin."""
    operator_id = str(uuid.uuid4())
    operator_prof = Profile(
        id=operator_id,
        email=f"op_{operator_id[:8]}@recoverai.io",
        full_name="Phase1 Operator",
        role="operator",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(operator_prof)
    db_session.commit()

    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": operator_id,
        "email": operator_prof.email,
        "user_metadata": {"full_name": operator_prof.full_name}
    })

    headers = {"Authorization": "Bearer valid_operator_token"}

    # Operator access to dashboard -> 200
    res_dash = client.get("/api/dashboard", headers=headers)
    assert res_dash.status_code == 200

    # Operator access to admin users list -> 403 Forbidden
    res_admin = client.get("/api/v1/admin/users", headers=headers)
    assert res_admin.status_code == 403
    assert "Administrator privileges required" in res_admin.json()["detail"]

    # Operator trying to promote themselves -> 403 Forbidden
    res_promote = client.patch(
        f"/api/v1/admin/users/{operator_id}/role",
        json={"role": "admin"},
        headers=headers
    )
    assert res_promote.status_code == 403


def test_fake_role_admin_in_request_is_ignored(client, db_session, monkeypatch):
    """Client role tampering via token metadata or request payload has no effect; DB role rules."""
    operator_id = str(uuid.uuid4())
    operator_prof = Profile(
        id=operator_id,
        email=f"spoof_{operator_id[:8]}@recoverai.io",
        full_name="Spoofer Attempt",
        role="operator",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(operator_prof)
    db_session.commit()

    # Tampered metadata claims 'role': 'admin'
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": operator_id,
        "email": operator_prof.email,
        "user_metadata": {"full_name": "Spoofer Attempt", "role": "admin"}
    })

    headers = {"Authorization": "Bearer spoofed_token"}

    # Must still evaluate to 'operator' from public.profiles and reject admin access
    res_admin = client.get("/api/v1/admin/users", headers=headers)
    assert res_admin.status_code == 403

    # Database role remains operator
    db_session.refresh(operator_prof)
    assert operator_prof.role == "operator"


def test_hardcoded_old_test_account_gets_no_special_privileges(client, db_session, monkeypatch):
    """Old test accounts or hardcoded emails/UUIDs get NO admin elevation; new users default to operator."""
    new_user_id = str(uuid.uuid4())
    old_test_email = "test.ops@recoverai.io"

    # Ensure profile does not exist beforehand for this user_id
    existing = db_session.query(Profile).filter(Profile.id == new_user_id).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()

    # resolve_authoritative_role for this new user must assign 'operator'
    role, profile_data = auth.resolve_authoritative_role(
        user_id=new_user_id,
        email=old_test_email,
        full_name="New Register with Old Email",
        db=db_session
    )

    assert role == "operator", f"Expected 'operator', got '{role}' - hardcoded admin fallback detected!"
    assert profile_data["role"] == "operator"

    # Verify in DB
    created_profile = db_session.query(Profile).filter(Profile.id == new_user_id).first()
    assert created_profile is not None
    assert created_profile.role == "operator"


def test_bootstrapped_administrator_in_profiles_still_works(client, db_session, monkeypatch):
    """The explicitly bootstrapped admin in public.profiles works because its DB role is 'admin'."""
    bootstrapped_admin_id = "597289a7-e26e-415d-ab4d-fa587e32899a"
    admin_prof = db_session.query(Profile).filter(Profile.id == bootstrapped_admin_id).first()
    if not admin_prof:
        admin_prof = Profile(
            id=bootstrapped_admin_id,
            email="test.ops@recoverai.io",
            full_name="Revenue Ops Admin",
            role="admin",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(admin_prof)
        db_session.commit()
    else:
        admin_prof.role = "admin"
        db_session.commit()

    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": bootstrapped_admin_id,
        "email": admin_prof.email,
        "user_metadata": {"full_name": admin_prof.full_name}
    })

    headers = {"Authorization": "Bearer bootstrapped_admin_jwt"}

    # Authoritative role resolution returns 'admin' from public.profiles
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 200
    assert any(u["id"] == bootstrapped_admin_id for u in res.json())


def test_demo_header_does_not_elevate_operator(client, db_session, monkeypatch):
    """Sending X-RecoverAI-Demo: active alongside operator token does NOT elevate privileges."""
    operator_id = str(uuid.uuid4())
    operator_prof = Profile(
        id=operator_id,
        email=f"op_demo_{operator_id[:8]}@recoverai.io",
        full_name="Operator With Demo Header",
        role="operator",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(operator_prof)
    db_session.commit()

    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": operator_id,
        "email": operator_prof.email,
        "user_metadata": {"full_name": operator_prof.full_name}
    })

    headers = {
        "Authorization": "Bearer operator_token",
        "X-RecoverAI-Demo": "active"
    }

    # Should still be rejected on admin endpoint with 403 Forbidden
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 403
