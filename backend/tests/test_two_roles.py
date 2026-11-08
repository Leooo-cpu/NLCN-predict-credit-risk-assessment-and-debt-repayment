"""Role retirement, old-session revocation and lossless startup migration."""
import pytest
from sqlalchemy import text

from app.core.security import create_access_token
from app.database import SessionLocal, engine
from app.migrations import apply_migrations
from app.models.audit_log import AuditLog
from app.models.user import User
from tests.conftest import login


@pytest.mark.parametrize("role", ["VIEWER", "RISK_VIEWER", "CREDIT_OFFICER", "", None])
def test_reject_retired_and_invalid_roles_via_api(client, role):
    headers = {"Authorization": f"Bearer {login(client, 'admin@test.com', 'Admin@123456')}"}
    payload = {"email": "blocked@test.com", "full_name": "Blocked Role", "password": "Testing123!", "role": role}
    assert client.post("/api/auth/register", json=payload).status_code in (400, 422)
    assert client.post("/api/users", json=payload, headers=headers).status_code in (400, 422)
    with SessionLocal() as db:
        officer_id = db.query(User).filter_by(email="officer@test.com").one().id
    assert client.put(f"/api/users/{officer_id}", json={"role": role}, headers=headers).status_code in (400, 422)
    with SessionLocal() as db:
        assert db.query(User).filter_by(id=officer_id).one().role == "OFFICER"
        assert db.query(User).filter_by(email="blocked@test.com").first() is None


@pytest.mark.parametrize("role", ["VIEWER", "RISK_VIEWER"])
def test_legacy_viewer_cannot_login_use_old_token_or_be_reactivated(client, role):
    with SessionLocal() as db:
        viewer = db.query(User).filter_by(email="viewer@test.com").one()
        viewer.role = role
        viewer_id = viewer.id
        # Even a stale/incorrect active flag cannot bypass the active-role allowlist.
        viewer.is_active = True
        db.commit()
    assert client.post("/api/auth/login", json={"email": "viewer@test.com", "password": "Viewer@123456"}).status_code == 401
    old = {"Authorization": f"Bearer {create_access_token('viewer@test.com', role)}"}
    for path in ("/api/auth/me", "/api/customers", "/api/loan-applications", "/api/dashboard/summary", "/api/models/current", "/api/home-credit/input-schema", "/api/credit-cases", "/api/credit-cases/summary", "/api/credit-cases/predictions"):
        status = client.get(path, headers=old).status_code
        assert status == 401, path
    admin = {"Authorization": f"Bearer {login(client, 'admin@test.com', 'Admin@123456')}"}
    assert client.put(f"/api/users/{viewer_id}", json={"is_active": True}, headers=admin).status_code == 400
    assert client.put(f"/api/users/{viewer_id}", json={"role": "OFFICER"}, headers=admin).status_code == 400
    assert any(user["id"] == viewer_id and user["role"] == role for user in client.get("/api/users", headers=admin).json()["items"])


def test_migration_preserves_accounts_passwords_and_audit_history(client):
    with SessionLocal() as db:
        officer = db.query(User).filter_by(email="officer@test.com").one()
        viewer = db.query(User).filter_by(email="viewer@test.com").one()
        officer.role = "CREDIT_OFFICER"
        viewer.is_active = True
        originals = {user.id: (user.email, user.hashed_password) for user in db.query(User)}
        viewer_id, officer_id = viewer.id, officer.id
        db.add(AuditLog(user_id=viewer_id, action="HISTORICAL_VIEW", entity_type="user", entity_id=viewer_id, details_json={"role": "RISK_VIEWER"}))
        db.execute(text("DELETE FROM schema_migrations WHERE version = '20261108_two_active_roles'"))
        db.commit()
    apply_migrations(engine)
    apply_migrations(engine)  # Safe on repeated startup.
    with SessionLocal() as db:
        assert {user.id: (user.email, user.hashed_password) for user in db.query(User)} == originals
        assert db.get(User, officer_id).role == "OFFICER"
        assert db.get(User, viewer_id).role == "RISK_VIEWER"
        assert db.get(User, viewer_id).is_active is False
        log = db.query(AuditLog).filter_by(action="HISTORICAL_VIEW").one()
        assert log.user_id == viewer_id and log.details_json == {"role": "RISK_VIEWER"}
        assert db.execute(text("SELECT count(*) FROM schema_migrations")).scalar() == 1


def test_officer_allowed_admin_only_stays_protected_and_anonymous_blocked(client):
    officer = {"Authorization": f"Bearer {login(client, 'officer@test.com', 'Officer@123456')}"}
    assert client.get("/api/auth/me", headers=officer).json()["role"] == "OFFICER"
    assert client.get("/api/credit-cases", headers=officer).status_code == 200
    assert client.get("/api/users", headers=officer).status_code == 403
    assert client.post("/api/auth/register", json={"email": "employee@test.com", "full_name": "Employee", "password": "Testing123!", "role": "OFFICER"}).status_code == 201
    for path in ("/api/credit-cases", "/api/home-credit/input-schema", "/api/users"):
        assert client.get(path).status_code == 401
    assert client.post("/api/credit-cases", json={"display_name": "Anonymous", "inputs": {}}).status_code == 401
    assert client.post("/api/credit-cases/1/score", json={"expected_revision": 1}).status_code == 401
