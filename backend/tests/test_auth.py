from tests.conftest import login


def test_login_and_me(client):
    token = login(client, "officer@test.com", "Officer@123456")
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "officer@test.com"
    assert "hashed_password" not in body


def test_login_wrong_password(client):
    res = client.post("/api/auth/login", json={"email": "officer@test.com", "password": "wrong"})
    assert res.status_code == 401


def test_register_cannot_be_admin(client):
    res = client.post(
        "/api/auth/register",
        json={
            "email": "newadmin@test.com",
            "full_name": "Hack Admin",
            "password": "Password1",
            "role": "ADMIN",
        },
    )
    assert res.status_code == 400


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
