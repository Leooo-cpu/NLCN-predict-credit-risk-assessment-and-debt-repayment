# Sequence diagram: dự đoán Home Credit

```mermaid
sequenceDiagram
  actor Officer as Cán bộ tín dụng
  participant UI as Frontend Home Credit
  participant API as Backend
  participant ML as ML Service
  Officer->>UI: Đăng nhập, mở Home Credit
  UI->>API: GET /api/home-credit/input-schema (JWT)
  API->>ML: GET /model/input-schema
  ML-->>UI: Hợp đồng 6 trường + kiểu, đơn vị, xử lý thiếu (qua Backend)
  Officer->>UI: Nhập giá trị thật hoặc nạp mẫu Training
  UI->>API: POST /api/home-credit/predict (JWT)
  API->>API: Kiểm tra vai trò
  API->>ML: POST /predict, nguyên hợp đồng, không TARGET/ID
  ML->>ML: Validate, transform Pipeline đã fit, predict
  ML-->>API: Ước lượng TARGET=1, lớp ở 0.5, phiên bản/nguồn
  API-->>UI: Kết quả hoặc lỗi 422 từng trường
  UI-->>Officer: Khó khăn thanh toán, điểm minh họa, nhóm chưa xác nhận
```

Luồng mới không ghi vào lịch sử kết quả mô phỏng có nghĩa default/repayment khác.
Hồ sơ cũ thiếu đầu vào tương đương nhận 422 khi gọi chấm điểm; lịch sử vẫn đọc được.
Không gọi fit, CV, chọn mô hình hay đánh giá Test trong quá trình dự đoán.
