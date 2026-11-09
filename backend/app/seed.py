from datetime import date, timedelta
from decimal import Decimal
import logging

from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password
from app.models.customer import Customer
from app.models.loan_application import LoanApplication
from app.models.model_registry import ModelRegistry
from app.models.user import User
from app.services.risk import compute_dti

settings = get_settings()
logger = logging.getLogger(__name__)


def ensure_default_users(db: Session) -> list[User]:
    specs = [
        ("admin@credit-risk.com" if settings.admin_email.lower() == "admin@credit-risk.local" else settings.admin_email.lower(), settings.admin_full_name, settings.admin_password, "ADMIN"),
        ("officer@credit-risk.com", "Cán bộ tín dụng Demo", "Officer@123456", "OFFICER"),
    ]
    # Preflight all demo addresses before modifying any record. Prefer existing
    # .com users; never merge accounts, change roles, or reset stored passwords.
    resolved = []
    for email, name, password, role in specs:
        user = db.query(User).filter(User.email == email).first()
        legacy_email = email.removesuffix(".com") + ".local" if email in {
            "admin@credit-risk.com", "officer@credit-risk.com"
        } else None
        legacy = db.query(User).filter(User.email == legacy_email).first() if legacy_email else None
        selected = user if user is not None else legacy
        if legacy_email and selected is not None and selected.role != role:
            raise RuntimeError(f"Xung đột vai trò tài khoản demo {selected.email}; cần kiểm tra trước khi cập nhật email")
        if user is not None and legacy is not None:
            logger.warning("Cả %s và %s đã tồn tại; dùng tài khoản .com, giữ nguyên hai tài khoản", email, legacy_email)
        resolved.append((email, name, password, role, selected))
    created: list[User] = []
    for email, name, password, role, user in resolved:
        if user is None:
            user = User(
                email=email,
                full_name=name,
                hashed_password=hash_password(password),
                role=role,
                is_active=True,
            )
            db.add(user)
            db.flush()
        elif user.email != email:
            user.email = email
        created.append(user)
    db.commit()
    return created


def ensure_model_registry(db: Session) -> None:
    existing = db.query(ModelRegistry).filter(ModelRegistry.version == "1.0.0-sim").first()
    if existing:
        return
    db.add(
        ModelRegistry(
            model_name="credit_default_pipeline",
            version="1.0.0-sim",
            algorithm="XGBoost",
            training_dataset="Dữ liệu mô phỏng nội bộ (synthetic_credit_risk)",
            metrics_json={
                "note": "Mô hình demo trên dữ liệu mô phỏng. Metrics đầy đủ nằm ở ML Service.",
                "dataset": "simulated",
            },
            status="HISTORICAL",
            artifact_path="/app/artifacts/credit_pipeline.joblib",
        )
    )
    db.commit()


def ensure_demo_records(db: Session, officer: User) -> None:
    if db.query(Customer).count() > 0:
        return

    today = date.today()
    samples = [
        {
            "full_name": "Nguyễn Văn An",
            "dob": today - timedelta(days=365 * 34),
            "age": 34,
            "occupation": "Kỹ sư phần mềm",
            "monthly_income": Decimal("28000000"),
            "years_employed": Decimal("6.0"),
            "credit_history": "GOOD",
            "late_payments": 0,
            "current_debt": Decimal("45000000"),
            "existing_loans": 1,
            "amount": Decimal("120000000"),
            "term": 36,
            "purpose": "MUA_NHA",
        },
        {
            "full_name": "Trần Thị Bình",
            "dob": today - timedelta(days=365 * 41),
            "age": 41,
            "occupation": "Nhân viên bán hàng",
            "monthly_income": Decimal("12000000"),
            "years_employed": Decimal("3.0"),
            "credit_history": "FAIR",
            "late_payments": 2,
            "current_debt": Decimal("80000000"),
            "existing_loans": 2,
            "amount": Decimal("90000000"),
            "term": 24,
            "purpose": "TIEU_DUNG",
        },
        {
            "full_name": "Lê Minh Cường",
            "dob": today - timedelta(days=365 * 29),
            "age": 29,
            "occupation": "Tài xế công nghệ",
            "monthly_income": Decimal("9000000"),
            "years_employed": Decimal("1.5"),
            "credit_history": "POOR",
            "late_payments": 6,
            "current_debt": Decimal("110000000"),
            "existing_loans": 3,
            "amount": Decimal("50000000"),
            "term": 18,
            "purpose": "HOP_TAC_KINH_DOANH",
        },
        {
            "full_name": "Phạm Thu Dung",
            "dob": today - timedelta(days=365 * 46),
            "age": 46,
            "occupation": "Giáo viên",
            "monthly_income": Decimal("15000000"),
            "years_employed": Decimal("12.0"),
            "credit_history": "GOOD",
            "late_payments": 1,
            "current_debt": Decimal("20000000"),
            "existing_loans": 1,
            "amount": Decimal("70000000"),
            "term": 48,
            "purpose": "GIAO_DUC",
        },
        {
            "full_name": "Hoàng Đức Em",
            "dob": today - timedelta(days=365 * 38),
            "age": 38,
            "occupation": "Kinh doanh tự do",
            "monthly_income": Decimal("18000000"),
            "years_employed": Decimal("4.0"),
            "credit_history": "FAIR",
            "late_payments": 3,
            "current_debt": Decimal("95000000"),
            "existing_loans": 2,
            "amount": Decimal("150000000"),
            "term": 60,
            "purpose": "HOP_TAC_KINH_DOANH",
        },
        {
            "full_name": "Võ Thanh Hà",
            "dob": today - timedelta(days=365 * 52),
            "age": 52,
            "occupation": "Công chức",
            "monthly_income": Decimal("22000000"),
            "years_employed": Decimal("20.0"),
            "credit_history": "GOOD",
            "late_payments": 0,
            "current_debt": Decimal("15000000"),
            "existing_loans": 0,
            "amount": Decimal("200000000"),
            "term": 84,
            "purpose": "MUA_NHA",
        },
    ]

    for item in samples:
        customer = Customer(
            full_name=item["full_name"],
            date_of_birth=item["dob"],
            age=item["age"],
            occupation=item["occupation"],
            monthly_income=item["monthly_income"],
            years_employed=item["years_employed"],
            credit_history=item["credit_history"],
            late_payments=item["late_payments"],
            current_debt=item["current_debt"],
            existing_loans=item["existing_loans"],
            phone="0900000000",
            notes="Dữ liệu mô phỏng phục vụ demo niên luận.",
            is_simulated=True,
            created_by=officer.id,
        )
        db.add(customer)
        db.flush()
        loan = LoanApplication(
            customer_id=customer.id,
            requested_amount=item["amount"],
            term_months=item["term"],
            purpose=item["purpose"],
            monthly_income=item["monthly_income"],
            years_employed=item["years_employed"],
            current_debt=item["current_debt"],
            existing_loans=item["existing_loans"],
            dti=compute_dti(item["current_debt"], item["monthly_income"]),
            credit_history=item["credit_history"],
            late_payments=item["late_payments"],
            status="SUBMITTED",
            notes="Hồ sơ mô phỏng.",
            is_simulated=True,
            created_by=officer.id,
        )
        db.add(loan)
    db.commit()


def seed_if_needed(db: Session) -> None:
    users = ensure_default_users(db)
    officer = next((u for u in users if u.role == "OFFICER"), users[0])
    # Keep accounts, but never recreate synthetic customers/results after replacement.
    # Home Credit records are imported explicitly from the real labeled CSV.
