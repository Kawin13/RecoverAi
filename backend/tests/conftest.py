import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database.base import Base
from app.database.session import get_db
from app.database.seed import seed_database

# Use in-memory SQLite with StaticPool so all threads/sessions share the same in-memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ensure app.database.session and app.main use in-memory test engine for isolated, fast, reliable tests
import app.database.session as app_session
app_session.engine = engine
app_session.SessionLocal = TestingSessionLocal
import app.main as app_main
app_main.engine = engine
app_main.SessionLocal = TestingSessionLocal

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers(monkeypatch):
    from app.core import auth
    original_verify = auth.verify_supabase_jwt

    def _test_verify(token: str):
        if token in ("test_auth_token", "test_admin_token"):
            return {
                "id": "597289a7-e26e-415d-ab4d-fa587e32899a",
                "email": "test.ops@recoverai.io",
                "user_metadata": {"full_name": "Revenue Ops Admin"}
            }
        elif token == "test_operator_token":
            return {
                "id": "00000000-0000-0000-0000-000000000002",
                "email": "operator.user@recoverai.io",
                "user_metadata": {"full_name": "Operator User"}
            }
        return original_verify(token)

    monkeypatch.setattr(auth, "verify_supabase_jwt", _test_verify)
    return {"Authorization": "Bearer test_auth_token"}

@pytest.fixture
def auth_client(db_session, auth_headers):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.headers.update(auth_headers)
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def operator_headers(monkeypatch):
    from app.core import auth
    original_verify = auth.verify_supabase_jwt

    def _test_verify(token: str):
        if token == "test_operator_token":
            return {
                "id": "00000000-0000-0000-0000-000000000002",
                "email": "operator.user@recoverai.io",
                "user_metadata": {"full_name": "Operator User"}
            }
        elif token in ("test_auth_token", "test_admin_token"):
            return {
                "id": "597289a7-e26e-415d-ab4d-fa587e32899a",
                "email": "test.ops@recoverai.io",
                "user_metadata": {"full_name": "Revenue Ops Admin"}
            }
        return original_verify(token)

    monkeypatch.setattr(auth, "verify_supabase_jwt", _test_verify)
    return {"Authorization": "Bearer test_operator_token"}

@pytest.fixture
def operator_client(db_session, operator_headers):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.headers.update(operator_headers)
        yield test_client
    app.dependency_overrides.clear()

