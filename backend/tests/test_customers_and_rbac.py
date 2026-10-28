from tests.conftest import login


def test_officer_can_create_customer(client):
    token = login(client, "officer@test.com", "Officer@123456")
    res = client.post(
        "/api/customers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Nguyen Van Test",
            "age": 30,
            "occupation": "Ky su",
            "monthly_income": 20000000,
            "years_employed": 4,
            "credit_history": "GOOD",
            "late_payments": 0,
            "current_debt": 10000000,
            "existing_loans": 1,
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["is_simulated"] is True


def test_viewer_cannot_create_customer(client):
    token = login(client, "viewer@test.com", "Viewer@123456")
    res = client.post(
        "/api/customers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Forbidden",
            "age": 30,
            "occupation": "Test",
            "monthly_income": 10000000,
            "years_employed": 1,
            "credit_history": "FAIR",
            "late_payments": 0,
            "current_debt": 0,
            "existing_loans": 0,
        },
    )
    assert res.status_code == 403


def test_users_admin_only(client):
    token = login(client, "officer@test.com", "Officer@123456")
    res = client.get("/api/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
