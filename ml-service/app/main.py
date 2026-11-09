from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app.config import get_settings
from app.schemas import PredictRequest, PredictResponse
from app.scoring import metadata, predict, input_contract, sample_request

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the existing demo artifact only; preparation never trains on startup.
    try:
        metadata()
    except Exception as exc:  # noqa: BLE001
        print(f"Khởi tạo mô hình thất bại: {exc}")
        raise
    yield


app = FastAPI(
    title="Credit Risk ML Service",
    description=(
        "Ước lượng rủi ro gặp khó khăn thanh toán theo TARGET Home Credit Default Risk. "
        "Không dùng cho phê duyệt tín dụng thật."
    ),
    version="2.0.0-home-credit",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}


@app.get("/model/info")
def model_info():
    return metadata()


@app.get("/model/input-schema")
def model_input_schema():
    return input_contract()


@app.get("/model/sample")
def model_sample():
    return sample_request()


@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(payload: PredictRequest):
    try:
        return predict(payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Lỗi dự đoán: {exc}") from exc


@app.post("/validate")
def validate_inputs(payload: PredictRequest):
    from app.home_credit_features import CONTRACT_VERSION
    return {"inputs": payload.model_dump(), "contract_version": CONTRACT_VERSION}
