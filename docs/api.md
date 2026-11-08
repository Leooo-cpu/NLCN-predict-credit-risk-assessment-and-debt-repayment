# Mô tả API

Base URL backend: `http://localhost:8000`  
Swagger: `http://localhost:8000/docs`

Tất cả API trừ `/api/auth/register`, `/api/auth/login`, `/health` yêu cầu header:

`Authorization: Bearer <token>`

## Auth

- `POST /api/auth/register` — đăng ký CREDIT_OFFICER hoặc RISK_VIEWER
- `POST /api/auth/login` — `{email, password}` → `{access_token, user}`
- `GET /api/auth/me`

## Customers

- `POST /api/customers`
- `GET /api/customers?q=&credit_history=&page=&page_size=`
- `GET /api/customers/{customer_id}`
- `PUT /api/customers/{customer_id}`

## Loan applications

- `POST /api/loan-applications`
- `GET /api/loan-applications`
- `GET /api/loan-applications/{id}`
- `PUT /api/loan-applications/{id}`
- `POST /api/loan-applications/import` (multipart CSV)
- `POST /api/loan-applications/{id}/score` — hồ sơ schema cũ trả 422 HOME_CREDIT_INPUT_REQUIRED; không tự chế giá trị để chấm bằng Home Credit.
- `GET /api/loan-applications/{id}/predictions`
- `GET /api/loan-applications/predictions/all?q=&risk_level=&page=&page_size=` (Lấy lịch sử dự đoán toàn hệ thống)

## Dashboard & models

- `GET /api/dashboard/summary`
- `GET /api/models/current` — metadata phiên bản thực sự được ML Service phục vụ (manifest), gồm CV và Test độc lập.
- `GET /api/models` — registry lịch sử trong database; trạng thái đã lưu không quyết định manifest đang phục vụ.
- `GET /health`

## Users (ADMIN)

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{id}`

## Mã lỗi

400 validation nghiệp vụ · 401 chưa đăng nhập · 403 sai vai trò · 404 không tìm thấy · 422 Pydantic · 500 lỗi hệ thống/ML.

## ML Service (chỉ Backend gọi)

- `POST http://localhost:8001/predict`
- `GET /health`
- `GET /model/info`
- `GET /model/input-schema` — định nghĩa kiểu/đơn vị/nullability dùng chung cho giao diện.
- `GET /model/sample` — một dòng Training chỉ có đặc trưng và xác nhận đơn vị, không có TARGET/ID.

## Home Credit (luồng mới)

- `GET /api/home-credit/input-schema`, `GET /api/home-credit/sample`: mọi vai trò đã đăng nhập.
- `POST /api/home-credit/predict`: ADMIN/CREDIT_OFFICER; backend chuyển nguyên hợp đồng đến ML,
  giữ lỗi 422 từng trường, không chuyển hồ sơ mô phỏng hoặc lưu vào cột kết quả lịch sử cũ.

Yêu cầu mẫu đã chạy, không chứa TARGET/SK_ID_CURR:

```json
{
  "AMT_CREDIT": 227520.0,
  "AMT_ANNUITY": 13189.5,
  "DAYS_BIRTH": -12298,
  "DAYS_EMPLOYED": -946,
  "NAME_CONTRACT_TYPE": "Cash loans",
  "OCCUPATION_TYPE": "Laborers",
  "amount_unit": "HOME_CREDIT_SOURCE"
}
```

Mọi khóa bắt buộc có mặt. AMT_ANNUITY/DAYS_EMPLOYED/OCCUPATION_TYPE có thể `null` rõ ràng;
các trường còn lại không được null. Mã 365243 được Pipeline xử lý thiếu. Tiền giữ thang
Home Credit, không mặc định VND, không suy kỳ thu nhập. Cột thừa, nhãn, ID, sai kiểu,
số tiền không dương và ngày dương không hợp lệ đều bị từ chối.

Phản hồi: `payment_difficulty_probability`, `other_outcome_probability`, lớp tại
`classification_threshold=0.5`, `data_source`, `model_version`, `imputed_features` và
điểm hồ sơ minh họa. Không gọi `1-p` là khả năng trả nợ đầy đủ. `risk_level=NOT_VALIDATED`
và `risk_bands_validated=false`; không dùng ngưỡng synthetic 0,20/0,45. SHAP chưa triển
khai cho hợp đồng mới nên trả danh sách rỗng kèm giải thích, không dùng heuristic giả.
