from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.database import SessionLocal, init_db
from app.routers import auth, customers, dashboard, loans, models, users
from app.seed import seed_if_needed

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            seed_if_needed(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="Credit Risk Support API",
    description=(
        "Hệ thống hỗ trợ đánh giá rủi ro tín dụng (Niên luận KTPM). "
        "Kết quả chỉ mang tính hỗ trợ, không thay thế quyết định cấp tín dụng thực tế. "
        "Dữ liệu demo là dữ liệu mô phỏng."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(customers.router)
app.include_router(loans.router)
app.include_router(dashboard.router)
app.include_router(models.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "backend"}
