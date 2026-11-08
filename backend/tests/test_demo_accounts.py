import pytest

from app.database import SessionLocal
from app.models.user import User
from app.seed import ensure_default_users


def test_fresh_demo_accounts_login_with_expected_roles(client):
    with SessionLocal() as db:
        users = ensure_default_users(db)
        assert [u.email for u in users] == [f"{name}@credit-risk.com" for name in ("admin", "officer")]
        assert db.query(User).filter(User.email.in_(["viewer@credit-risk.com", "viewer@credit-risk.local"])).count() == 0
    for name, role in [("Admin", "ADMIN"), ("Officer", "OFFICER")]:
        response = client.post("/api/auth/login", json={"email": f"{name.lower()}@credit-risk.com", "password": f"{name}@123456"})
        assert response.status_code == 200
        assert response.json()["user"]["role"] == role


def test_legacy_rename_preserves_identity_and_password(client):
    with SessionLocal() as db:
        originals = []
        for name in ("admin", "officer"):
            user = db.query(User).filter_by(email=f"{name}@test.com").one()
            user.email = f"{name}@credit-risk.local"
            originals.append((user.id, user.role, user.hashed_password, user.is_active))
        db.commit()
        users = ensure_default_users(db)
        assert [(u.id, u.role, u.hashed_password, u.is_active) for u in users] == originals
        assert all(u.email.endswith("@credit-risk.com") for u in users)
        assert db.query(User).count() == 3
        # Repeated startup must also preserve existing credentials.
        assert [(u.id, u.hashed_password) for u in ensure_default_users(db)] == [(u[0], u[2]) for u in originals]


def test_both_addresses_keep_existing_com_account(client):
    with SessionLocal() as db:
        canonical = ensure_default_users(db)[1]
        original = (canonical.id, canonical.hashed_password)
        legacy = db.query(User).filter_by(email="officer@test.com").one()
        legacy.email = "officer@credit-risk.local"
        db.commit()
        selected = ensure_default_users(db)[1]
        assert (selected.id, selected.hashed_password) == original
        assert db.query(User).filter_by(email="officer@credit-risk.local").one().id == legacy.id


def test_role_conflict_is_checked_before_any_changes(client):
    with SessionLocal() as db:
        user = db.query(User).filter_by(email="viewer@test.com").one()
        user.email = "officer@credit-risk.local"
        db.commit()
        with pytest.raises(RuntimeError, match="Xung đột vai trò"):
            ensure_default_users(db)
        assert db.query(User).filter(User.email.like("%@credit-risk.com")).count() == 0
        assert db.query(User).filter_by(email="officer@credit-risk.local").one().role == "RISK_VIEWER"
