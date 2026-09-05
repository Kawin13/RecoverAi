"""
Phase 10: RBAC & User Management Data Quality & Concurrency Tests
Validates:
1. Provider metadata accuracy (Gmail with email/pwd vs non-gmail with Google OAuth).
2. Last sign-in accuracy (real auth.users.last_sign_in_at vs None, never profile.updated_at).
3. Status safe derivation (Active, Suspended, Unconfirmed, None).
4. Atomic last-admin demotion under high-concurrency race conditions (never 0 admins).
"""

import uuid
import pytest
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from app.models.profiles import Profile
from app.api.v1.endpoints import admin_users


def test_provider_accuracy_gmail_password_is_email(client, db_session, monkeypatch):
    """
    1. Enforces that a @gmail.com address using email/password is reported as 'Email',
    not heuristically classified as 'Google'.
    """
    uid = str(uuid.uuid4())
    prof = Profile(
        id=uid,
        email="john.doe@gmail.com",
        full_name="John Doe",
        role="operator",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    admin_prof = Profile(
        id=str(uuid.uuid4()),
        email="admin@recoverai.io",
        full_name="Admin User",
        role="admin",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add_all([prof, admin_prof])
    db_session.commit()

    # Mock Supabase Auth to return actual provider 'email' for the gmail user
    monkeypatch.setattr(admin_users, "fetch_supabase_auth_users", lambda db: {
        uid: {
            "id": uid,
            "email": "john.doe@gmail.com",
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "last_sign_in_at": "2026-09-01T10:00:00Z",
            "confirmed_at": "2026-09-01T09:00:00Z"
        }
    })

    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_prof.id,
        "email": admin_prof.email,
        "user_metadata": {"full_name": admin_prof.full_name}
    })

    res = client.get("/api/v1/admin/users", headers={"Authorization": "Bearer fake_token"})
    assert res.status_code == 200
    users = res.json()
    target = next((u for u in users if u["id"] == uid), None)
    assert target is not None
    assert target["provider"] == "Email"
    assert target["provider"] != "Google"


def test_provider_accuracy_workspace_domain_google_oauth(client, db_session, monkeypatch):
    """
    1b. Enforces that a non-gmail domain using Google OAuth is reported as 'Google'.
    """
    uid = str(uuid.uuid4())
    prof = Profile(
        id=uid,
        email="sarah@fintech-enterprise.corp",
        full_name="Sarah Connor",
        role="operator",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    admin_prof = Profile(
        id=str(uuid.uuid4()),
        email="admin2@recoverai.io",
        full_name="Admin User 2",
        role="admin",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add_all([prof, admin_prof])
    db_session.commit()

    # Mock Supabase Auth metadata indicating Google OAuth provider
    monkeypatch.setattr(admin_users, "fetch_supabase_auth_users", lambda db: {
        uid: {
            "id": uid,
            "email": "sarah@fintech-enterprise.corp",
            "app_metadata": {"provider": "google", "providers": ["google"]},
            "last_sign_in_at": "2026-09-02T14:30:00Z",
            "confirmed_at": "2026-09-02T14:00:00Z"
        }
    })

    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_prof.id,
        "email": admin_prof.email,
        "user_metadata": {"full_name": admin_prof.full_name}
    })

    res = client.get("/api/v1/admin/users", headers={"Authorization": "Bearer fake_token"})
    assert res.status_code == 200
    users = res.json()
    target = next((u for u in users if u["id"] == uid), None)
    assert target is not None
    assert target["provider"] == "Google"


def test_last_sign_in_real_and_never_profile_updated_at(client, db_session, monkeypatch):
    """
    2. Enforces that last_sign_in_at uses real auth metadata and never falls back to profile.updated_at.
    """
    uid_with_signin = str(uuid.uuid4())
    uid_no_signin = str(uuid.uuid4())
    admin_uid = str(uuid.uuid4())

    real_signin_time = "2026-08-25T12:34:56Z"
    old_updated_at = datetime(2025, 1, 1, 0, 0, 0)

    p1 = Profile(
        id=uid_with_signin,
        email="active@recoverai.io",
        full_name="Active User",
        role="operator",
        created_at=datetime.utcnow(),
        updated_at=old_updated_at
    )
    p2 = Profile(
        id=uid_no_signin,
        email="nosignin@recoverai.io",
        full_name="No Sign In User",
        role="operator",
        created_at=datetime.utcnow(),
        updated_at=old_updated_at
    )
    admin_prof = Profile(
        id=admin_uid,
        email="superadmin@recoverai.io",
        full_name="Super Admin",
        role="admin",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add_all([p1, p2, admin_prof])
    db_session.commit()

    monkeypatch.setattr(admin_users, "fetch_supabase_auth_users", lambda db: {
        uid_with_signin: {
            "id": uid_with_signin,
            "email": "active@recoverai.io",
            "last_sign_in_at": real_signin_time,
            "confirmed_at": "2026-08-20T00:00:00Z"
        },
        uid_no_signin: {
            "id": uid_no_signin,
            "email": "nosignin@recoverai.io",
            "last_sign_in_at": None,
            "confirmed_at": "2026-08-20T00:00:00Z"
        }
    })

    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_uid,
        "email": admin_prof.email,
        "user_metadata": {"full_name": admin_prof.full_name}
    })

    res = client.get("/api/v1/admin/users", headers={"Authorization": "Bearer fake_token"})
    assert res.status_code == 200
    users = res.json()

    u1 = next(u for u in users if u["id"] == uid_with_signin)
    u2 = next(u for u in users if u["id"] == uid_no_signin)

    assert u1["last_sign_in_at"] == real_signin_time
    assert u1["last_sign_in_at"] != old_updated_at.isoformat()

    # User who never signed in must have None, NOT profile.updated_at
    assert u2["last_sign_in_at"] is None
    assert u2["last_sign_in_at"] != old_updated_at.isoformat()


def test_status_safe_derivation(client, db_session, monkeypatch):
    """
    3. Enforces that status is derived from real account state (Suspended, Unconfirmed, Active, None).
    Never hardcodes every user as 'Active'.
    """
    banned_uid = str(uuid.uuid4())
    unconfirmed_uid = str(uuid.uuid4())
    no_meta_uid = str(uuid.uuid4())
    admin_uid = str(uuid.uuid4())

    future_ban = (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z"

    p_banned = Profile(id=banned_uid, email="banned@recoverai.io", role="operator")
    p_unconfirmed = Profile(id=unconfirmed_uid, email="unconfirmed@recoverai.io", role="operator")
    p_nometa = Profile(id=no_meta_uid, email="nometa@recoverai.io", role="operator")
    p_admin = Profile(id=admin_uid, email="admin_status@recoverai.io", role="admin")

    db_session.add_all([p_banned, p_unconfirmed, p_nometa, p_admin])
    db_session.commit()

    monkeypatch.setattr(admin_users, "fetch_supabase_auth_users", lambda db: {
        banned_uid: {
            "id": banned_uid,
            "banned_until": future_ban,
            "confirmed_at": "2026-01-01T00:00:00Z"
        },
        unconfirmed_uid: {
            "id": unconfirmed_uid,
            "confirmed_at": None,
            "email_confirmed_at": None
        }
        # no_meta_uid is not in auth_users
    })

    from app.core import auth
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_uid,
        "email": p_admin.email,
        "user_metadata": {"full_name": "Admin"}
    })

    res = client.get("/api/v1/admin/users", headers={"Authorization": "Bearer fake_token"})
    assert res.status_code == 200
    users = res.json()

    u_banned = next(u for u in users if u["id"] == banned_uid)
    u_unconfirmed = next(u for u in users if u["id"] == unconfirmed_uid)
    u_nometa = next(u for u in users if u["id"] == no_meta_uid)

    assert u_banned["status"] == "Suspended"
    assert u_unconfirmed["status"] == "Unconfirmed"
    assert u_nometa["status"] is None  # Safe: not hardcoded as 'Active'!


def test_concurrent_last_admin_demotion_race(client, db_session, monkeypatch):
    """
    4. Concurrency Test:
    When two admins exist and both are simultaneously targeted for demotion to operator,
    the atomic protection guarantees that exactly one succeeds and the other fails with 400.
    The workspace is NEVER left with zero administrators.
    """
    admin_a_id = str(uuid.uuid4())
    admin_b_id = str(uuid.uuid4())

    # Clear existing admins and seed exactly 2 admins
    db_session.query(Profile).filter(Profile.role == "admin").delete()
    admin_a = Profile(id=admin_a_id, email="admin_a@recoverai.io", full_name="Admin Alpha", role="admin")
    admin_b = Profile(id=admin_b_id, email="admin_b@recoverai.io", full_name="Admin Beta", role="admin")
    db_session.add_all([admin_a, admin_b])
    db_session.commit()

    from app.core import auth
    # Map token to corresponding admin identity so both concurrent threads authenticate as valid admins
    monkeypatch.setattr(auth, "verify_supabase_jwt", lambda token: {
        "id": admin_b_id if "token_b" in str(token) else admin_a_id,
        "email": "admin_b@recoverai.io" if "token_b" in str(token) else "admin_a@recoverai.io",
        "user_metadata": {"full_name": "Admin User"}
    })

    results = []

    def demote_user(target_id: str, token_str: str):
        # Dedicated client call in thread
        resp = client.patch(
            f"/api/v1/admin/users/{target_id}/role",
            json={"role": "operator"},
            headers={"Authorization": f"Bearer {token_str}"}
        )
        return resp.status_code, resp.json()

    # Launch two simultaneous demotion requests across thread pool
    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(demote_user, admin_a_id, "token_a")
        f2 = executor.submit(demote_user, admin_b_id, "token_b")
        results.append(f1.result())
        results.append(f2.result())

    status_codes = [r[0] for r in results]

    # Exactly ONE must succeed (200) and exactly ONE must fail (400)
    assert 200 in status_codes, f"Expected one successful demotion, got: {status_codes}"
    assert 400 in status_codes, f"Expected one blocked demotion, got: {status_codes}"

    # Verify error detail mentions at least one administrator requirement
    failed_res = next(r[1] for r in results if r[0] == 400)
    assert "RecoverAI must have at least one Administrator." in failed_res["detail"]

    # Authoritative DB verification: recount admins
    remaining_admins = db_session.query(Profile).filter(Profile.role == "admin").count()
    assert remaining_admins == 1, f"Expected exactly 1 admin to remain, but found {remaining_admins}!"
