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
- `POST /api/loan-applications/{id}/score`
- `GET /api/loan-applications/{id}/predictions`
- `GET /api/loan-applications/predictions/all?q=&risk_level=&page=&page_size=` (Lấy lịch sử dự đoán toàn hệ thống)

## Dashboard & models

- `GET /api/dashboard/summary`
- `GET /api/models/current`
- `GET /api/models`
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
