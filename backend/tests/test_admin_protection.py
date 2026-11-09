import pytest

from app.database import SessionLocal
from app.models.user import User
from tests.conftest import login


@pytest.mark.parametrize("change", [{"is_active": False}, {"is_active": None}, {"role": "OFFICER"}, {"role": "OFFICER", "is_active": False}])
def test_admin_cannot_be_locked_or_demoted(client, change):
    token = login(client, "admin@test.com", "Admin@123456")
    headers = {"Authorization": f"Bearer {token}"}
    with SessionLocal() as db:
        admin = db.query(User).filter_by(email="admin@test.com").one()
        admin_id, original_hash = admin.id, admin.hashed_password
    status = client.put(f"/api/users/{admin_id}", headers=headers, json=change).status_code
    assert status == 400
    with SessionLocal() as db:
        admin = db.get(User, admin_id)
        assert admin.is_active and admin.role == "ADMIN" and admin.hashed_password == original_hash
    assert client.get("/api/auth/me", headers=headers).status_code == 200


def test_cannot_create_or_promote_another_admin(client):
    headers = {"Authorization": f"Bearer {login(client, 'admin@test.com', 'Admin@123456')}"}
    created = client.post("/api/users", headers=headers, json={"email": "second-admin@test.com", "full_name": "Another Admin", "password": "Testing123!", "role": "ADMIN"})
    assert created.status_code == 400
    with SessionLocal() as db:
        officer_id = db.query(User).filter_by(email="officer@test.com").one().id
    assert client.put(f"/api/users/{officer_id}", headers=headers, json={"role": "ADMIN"}).status_code == 400
    with SessionLocal() as db:
        assert db.query(User).filter_by(role="ADMIN").count() == 1
        assert db.query(User).filter_by(email="second-admin@test.com").first() is None
        assert db.get(User, officer_id).role == "OFFICER"


def test_officer_creation_locking_and_admin_profile_edit_still_work(client):
    headers = {"Authorization": f"Bearer {login(client, 'admin@test.com', 'Admin@123456')}"}
    created = client.post("/api/users", headers=headers, json={"email": "new-officer@test.com", "full_name": "New Officer", "password": "Testing123!", "role": "OFFICER"})
    assert created.status_code == 201
    user_id = created.json()["id"]
    for active in (False, True):
        response = client.put(f"/api/users/{user_id}", headers=headers, json={"is_active": active})
        assert response.status_code == 200 and response.json()["is_active"] is active
    admin_id = client.get("/api/auth/me", headers=headers).json()["id"]
    assert client.put(f"/api/users/{admin_id}", headers=headers, json={"full_name": "Admin Updated"}).status_code == 200
