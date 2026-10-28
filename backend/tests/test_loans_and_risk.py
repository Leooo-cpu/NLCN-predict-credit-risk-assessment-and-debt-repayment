from app.services.risk import compute_dti, risk_level_from_probability, simulated_credit_score
from tests.conftest import login


def test_credit_score_formula():
    assert simulated_credit_score(0) == 850
    assert simulated_credit_score(1) == 300
    assert risk_level_from_probability(0.1) == "LOW_RISK"
    assert risk_level_from_probability(0.3) == "MEDIUM_RISK"
    assert risk_level_from_probability(0.5) == "HIGH_RISK"


def test_create_loan_computes_dti(client):
    token = login(client, "officer@test.com", "Officer@123456")
    headers = {"Authorization": f"Bearer {token}"}
    customer = client.post(
        "/api/customers",
        headers=headers,
        json={
            "full_name": "Loan Customer",
            "age": 40,
            "occupation": "Giao vien",
            "monthly_income": 10000000,
            "years_employed": 8,
            "credit_history": "GOOD",
            "late_payments": 0,
            "current_debt": 25000000,
            "existing_loans": 1,
        },
    ).json()
    loan = client.post(
        "/api/loan-applications",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "requested_amount": 50000000,
            "term_months": 24,
            "purpose": "TIEU_DUNG",
            "monthly_income": 10000000,
            "years_employed": 8,
            "current_debt": 25000000,
            "existing_loans": 1,
            "credit_history": "GOOD",
            "late_payments": 0,
        },
    )
    assert loan.status_code == 201, loan.text
    assert float(loan.json()["dti"]) == float(compute_dti(25000000, 10000000))


def test_list_all_predictions_empty(client):
    token = login(client, "officer@test.com", "Officer@123456")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/loan-applications/predictions/all", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data

