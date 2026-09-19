import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import get_current_user

client = TestClient(app)

def test_profile_endpoints_authenticated():
    # Mock authenticated user dependency
    mock_user = {
        "id": "7d98f202-dcdd-4ba1-8da1-2c7d006aa7f1",
        "email": "kawindharma@gmail.com",
        "role": "admin",
        "user_metadata": {
            "full_name": "kawin dharma",
            "avatar_url": "https://example.com/avatar.jpg"
        },
        "workspace_id": "00000000-0000-0000-0000-000000000001"
    }

    app.dependency_overrides[get_current_user] = lambda: mock_user

    try:
        # 1. GET /api/v1/profile/me
        res = client.get("/api/v1/profile/me")
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "kawindharma@gmail.com"

        # 2. PATCH /api/v1/profile/me (update full_name and avatar_url)
        patch_res = client.patch("/api/v1/profile/me", json={
            "full_name": "Kawin Dharma Admin",
            "avatar_url": "https://images.unsplash.com/photo-test?w=200"
        })
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["full_name"] == "Kawin Dharma Admin"
        assert updated["avatar_url"] == "https://images.unsplash.com/photo-test?w=200"

        # 3. Restore name
        restore_res = client.patch("/api/v1/profile/me", json={
            "full_name": "kawin dharma",
            "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIhjNsxCSwJPfIBRwSPvSFwptOl29i3-Nc9EClgywMGay9Qs_Rr=s96-c"
        })
        assert restore_res.status_code == 200
        restored = restore_res.json()
        assert restored["full_name"] == "kawin dharma"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
