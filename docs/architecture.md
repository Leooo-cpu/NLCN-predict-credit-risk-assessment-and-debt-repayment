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
- Backend là cổng duy nhất: xác thực, phân quyền; luồng Home Credit demo riêng không ghi
  đè lịch sử mô phỏng. API cũ yêu cầu bổ sung đầu vào thay vì suy giá trị không tương đương.
- ML Service nhận 6 đặc trưng Home Credit theo hợp đồng chung, trả ước lượng khó khăn
  thanh toán, nguồn và phiên bản. Không dùng heuristic SHAP cũ cho dữ liệu mới.
- Manifest active_model.json chỉ được cập nhật sau kiểm tra reload/API. CV chọn AP trên
  Training, refit toàn Training, đánh giá Test độc lập một lần; xem [bản phát hành](home_credit_release.md).
- Điểm tín dụng là **mô phỏng**: `850 - 550 * P(default)`.
- Hệ thống **không** phê duyệt/từ chối khoản vay thật.

## Vai trò

| Vai trò | Quyền |
|---|---|
| ADMIN | Người dùng, toàn bộ dữ liệu, dashboard, mô hình |
| OFFICER | CRUD khách hàng/hồ sơ, chạy score |

## Thành phần

- `frontend/`: giao diện tiếng Việt, Axios, Recharts.
- `backend/`: REST API, SQLAlchemy, JWT, httpx → ML.
- `ml-service/`: pipeline joblib, XGBoost/RF/LR, SHAP.
- `database/`: schema SQL, seed, CSV mẫu.
