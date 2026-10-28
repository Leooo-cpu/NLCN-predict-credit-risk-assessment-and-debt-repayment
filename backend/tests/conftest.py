import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_credit.db"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ["ML_SERVICE_URL"] = "http://ml-test"

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine, SessionLocal, init_db
from app.main import app
from app.models.user import User
from app.core.security import hash_password


@pytest.fixture()
def client():
    init_db()
    db = SessionLocal()
    db.add(
        User(
            email="admin@test.com",
            full_name="Admin Test",
            hashed_password=hash_password("Admin@123456"),
            role="ADMIN",
            is_active=True,
        )
    )
    db.add(
        User(
            email="officer@test.com",
            full_name="Officer Test",
            hashed_password=hash_password("Officer@123456"),
            role="CREDIT_OFFICER",
            is_active=True,
        )
    )
    db.add(
        User(
            email="viewer@test.com",
            full_name="Viewer Test",
            hashed_password=hash_password("Viewer@123456"),
            role="RISK_VIEWER",
            is_active=True,
        )
    )
    db.commit()
    db.close()
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    db_file = ROOT / "test_credit.db"
    if db_file.exists():
        db_file.unlink()


def login(client: TestClient, email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]
