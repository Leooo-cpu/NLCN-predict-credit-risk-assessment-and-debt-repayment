from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app.config import get_settings
from app.schemas import PredictRequest, PredictResponse
from app.scoring import metadata, predict

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load or train on startup so /predict sẵn sàng cho demo
    try:
        metadata()
    except Exception as exc:  # noqa: BLE001
        print(f"Khởi tạo mô hình thất bại: {exc}")
        raise
    yield


app = FastAPI(
    title="Credit Risk ML Service",
    description=(
        "Dịch vụ máy học dự đoán xác suất vỡ nợ trên dữ liệu mô phỏng. "
        "Không dùng cho phê duyệt tín dụng thật."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}


@app.get("/model/info")
def model_info():
    return metadata()


@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(payload: PredictRequest):
    try:
        return predict(payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Lỗi dự đoán: {exc}") from exc
