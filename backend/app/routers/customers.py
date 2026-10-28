from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.roles import ADMIN, CREDIT_OFFICER, RISK_VIEWER
from app.database import get_db
from app.dependencies import require_roles
from app.models.customer import Customer
from app.models.user import User
from app.schemas.common import Paginated
from app.schemas.customer import CustomerCreate, CustomerPublic, CustomerUpdate
from app.services.audit import write_audit

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.post("", response_model=CustomerPublic, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN, CREDIT_OFFICER)),
):
    customer = Customer(**payload.model_dump(), is_simulated=True, created_by=current.id)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    write_audit(db, user=current, action="CREATE_CUSTOMER", entity_type="customer", entity_id=customer.id)
    return customer


@router.get("", response_model=Paginated[CustomerPublic])
def list_customers(
    q: str | None = None,
    credit_history: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    query = db.query(Customer)
    if q:
        like = f"%{q}%"
        query = query.filter(Customer.full_name.ilike(like))
    if credit_history:
        query = query.filter(Customer.credit_history == credit_history)
    total = query.count()
    items = query.order_by(Customer.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return Paginated(items=items, total=total, page=page, page_size=page_size)


@router.get("/{customer_id}", response_model=CustomerPublic)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(ADMIN, CREDIT_OFFICER, RISK_VIEWER)),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if customer is None:
        raise NotFoundError("Không tìm thấy khách hàng")
    return customer


@router.put("/{customer_id}", response_model=CustomerPublic)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(ADMIN, CREDIT_OFFICER)),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if customer is None:
        raise NotFoundError("Không tìm thấy khách hàng")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    write_audit(db, user=current, action="UPDATE_CUSTOMER", entity_type="customer", entity_id=customer.id)
    return customer
