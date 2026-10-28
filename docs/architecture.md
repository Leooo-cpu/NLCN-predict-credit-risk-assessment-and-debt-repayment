# Kiến trúc hệ thống

Hệ thống hỗ trợ đánh giá rủi ro tín dụng theo mô hình 3 dịch vụ + 1 CSDL.

```
┌─────────────┐     JWT      ┌──────────────┐   SQL    ┌────────────┐
│  Frontend   │ ───────────► │   Backend    │ ───────► │ PostgreSQL │
│ React+Vite  │              │   FastAPI    │          └────────────┘
└─────────────┘              └──────┬───────┘
                                    │ HTTP /predict
                                    ▼
                             ┌──────────────┐
                             │  ML Service  │
                             │ FastAPI+SHAP │
                             └──────────────┘
```

## Nguyên tắc

- Frontend **không** gọi ML Service.
- Backend là cổng duy nhất: xác thực, phân quyền, lưu audit và lịch sử dự đoán.
- ML Service chỉ nhận đặc trưng hồ sơ, trả JSON xác suất + SHAP.
- Điểm tín dụng là **mô phỏng**: `850 - 550 * P(default)`.
- Hệ thống **không** phê duyệt/từ chối khoản vay thật.

## Vai trò

| Vai trò | Quyền |
|---|---|
| ADMIN | Người dùng, toàn bộ dữ liệu, dashboard, mô hình |
| CREDIT_OFFICER | CRUD khách hàng/hồ sơ, chạy score |
| RISK_VIEWER | Chỉ xem dashboard, hồ sơ, kết quả, mô hình |

## Thành phần

- `frontend/`: giao diện tiếng Việt, Axios, Recharts.
- `backend/`: REST API, SQLAlchemy, JWT, httpx → ML.
- `ml-service/`: pipeline joblib, XGBoost/RF/LR, SHAP.
- `database/`: schema SQL, seed, CSV mẫu.
