# BÁO CÁO NIÊN LUẬN KỸ THUẬT PHẦN MỀM

**Đề tài:** Xây dựng hệ thống hỗ trợ đánh giá rủi ro tín dụng và dự đoán khả năng trả nợ bằng máy học  
**Chuyên ngành:** Kỹ thuật Phần mềm  
**Môi trường triển khai:** Docker Compose, React, FastAPI, PostgreSQL, XGBoost/SHAP  

---

## 1. ĐẶT VẤN ĐỀ VÀ MỤC TIÊU ĐỀ TÀI

### 1.1. Bối cảnh
Trong hoạt động tín dụng bán lẻ và tài chính tiêu dùng, đánh giá rủi ro tín dụng là bước then chốt quyết định tỷ lệ nợ xấu (NPL - Non-Performing Loans). Theo phương pháp truyền thống, cán bộ tín dụng dựa vào bảng tính điểm thủ công (scorecard) hoặc kinh nghiệm cá nhân, dễ dẫn tới:
- Độ trễ trong xử lý hồ sơ vay.
- Khó nắm bắt các mối quan hệ phi tuyến tính phức tạp giữa thu nhập, dư nợ và hành vi trả nợ.
- Thiếu khả năng giải thích chi tiết lý do tại sao một hồ sơ bị xếp loại rủi ro cao.

### 1.2. Mục tiêu nghiên cứu và phát triển
- Xây dựng hệ thống phần mềm hỗ trợ ra quyết định tín dụng hoàn chỉnh từ giao diện người dùng, backend quản lý đến dịch vụ máy học độc lập.
- Áp dụng các thuật toán máy học hiện đại (Logistic Regression, Random Forest, XGBoost) để dự đoán xác suất vỡ nợ (Probability of Default).
- Tích hợp công nghệ giải thích mô hình **SHAP (SHapley Additive exPlanations)** để giải thích rõ ràng từng yếu tố tác động (tăng/giảm rủi ro) bằng ngôn ngữ tiếng Việt trực quan.
- Quy đổi xác suất sang điểm tín dụng mô phỏng (300 - 850) và phân loại nhóm rủi ro (LOW_RISK, MEDIUM_RISK, HIGH_RISK) theo các ngưỡng cấu hình linh hoạt.

### 1.3. Phạm vi và nguyên tắc đạo đức dữ liệu
- **Hệ thống niên luận:** Hệ thống đóng vai trò hỗ trợ phân tích, **không** thay thế quyền phê duyệt hoặc từ chối khoản vay thật của tổ chức tín dụng.
- **Dữ liệu:** Toàn bộ dữ liệu demo là **dữ liệu mô phỏng (synthetic data)**, không chứa dữ liệu cá nhân thật hoặc kết nối hệ thống ngân hàng thật.

---

## 2. KIẾN TRÚC HỆ THỐNG VÀ CÔNG NGHỆ

### 2.1. Kiến trúc tổng thể (Service-Oriented Architecture)
Hệ thống được thiết kế theo kiến trúc hướng dịch vụ với sự tách biệt rõ ràng giữa các phân tầng:

```
┌───────────────────────────────────────────────┐
│              FRONTEND (React + Vite)          │
│ - Dashboard biểu đồ Recharts                 │
│ - Quản lý Khách hàng & Hồ sơ vay             │
│ - Xem kết quả đánh giá rủi ro & SHAP          │
│ - Lịch sử dự đoán toàn hệ thống              │
└───────────────────────┬───────────────────────┘
                        │ HTTP / JSON (JWT Auth)
                        ▼
┌───────────────────────────────────────────────┐
│              BACKEND API (FastAPI)            │
│ - Xác thực & Phân quyền RBAC (JWT + Bcrypt)   │
│ - Nghiệp vụ Khách hàng & Hồ sơ vay           │
│ - Quản lý Lịch sử dự đoán & Audit Log         │
│ - Cổng kết nối duy nhất tới ML Service        │
└───────────────┬───────────────────────┬───────┘
                │ SQL                   │ HTTP (Internal)
                ▼                       ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│  DATABASE (PostgreSQL)  │   │  ML SERVICE (FastAPI)   │
│ - Users, Roles          │   │ - Pipeline Joblib       │
│ - Customers, Loans      │   │ - Dự đoán xác suất      │
│ - Predictions, Registry │   │ - Tính SHAP values      │
│ - Audit Logs            │   │ - Quy đổi điểm & nhóm   │
└─────────────────────────┘   └─────────────────────────┘
```

### 2.2. Công nghệ bắt buộc sử dụng
- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, Axios, Recharts.
- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2, Passlib/Bcrypt, Python-jose.
- **ML Service:** FastAPI, scikit-learn, XGBoost, pandas, NumPy, SHAP, Matplotlib, Joblib.
- **Cơ sở dữ liệu:** PostgreSQL 16 (hỗ trợ SQLite cho demo độc lập).
- **Điều phối container:** Docker và Docker Compose.
- **Kiểm thử tự động:** Pytest (kiểm thử đơn vị và tích hợp API).

---

## 3. PHÂN TÍCH & THIẾT KẾ CƠ SỞ DỮ LIỆU

### 3.1. Sơ đồ thực thể liên kết (ERD)
1. **`users`:** Quản lý người dùng, email, mật khẩu hash, họ tên, vai trò (`ADMIN`, `CREDIT_OFFICER`, `RISK_VIEWER`).
2. **`customers`:** Lưu trữ thông tin khách hàng (họ tên, tuổi, nghề nghiệp, thu nhập hàng tháng, số năm công tác, lịch sử tín dụng, số lần chậm trả, dư nợ hiện tại, số khoản vay).
3. **`loan_applications`:** Lưu trữ chi tiết hồ sơ đề nghị vay (khách hàng, số tiền vay, kỳ hạn vay, mục đích vay, tỷ lệ nợ trên thu nhập DTI, trạng thái hồ sơ).
4. **`model_predictions`:** Lưu trữ chi tiết từng lượt chấm điểm (mã hồ sơ, phiên bản mô hình, xác suất vỡ nợ, khả năng trả nợ, điểm tín dụng mô phỏng, phân nhóm rủi ro, `explanation_json` chứa SHAP).
5. **`model_registry`:** Quản lý vòng đời mô hình máy học (tên, phiên bản, thuật toán, tập huấn luyện, metrics json, trạng thái `ACTIVE`/`ARCHIVED`).
6. **`audit_logs`:** Ghi nhận nhật ký kiểm toán mọi thao tác thay đổi dữ liệu hoặc chạy dự đoán.

### 3.2. Cơ chế phân quyền RBAC (Role-Based Access Control)
- **ADMIN:** Toàn quyền quản trị tài khoản người dùng, xem toàn bộ dữ liệu hệ thống, quản lý mô hình máy học.
- **CREDIT_OFFICER (Cán bộ tín dụng):** Tạo và cập nhật khách hàng, tạo hồ sơ vay, import danh sách hồ sơ từ CSV, kích hoạt chạy đánh giá rủi ro (scoring).
- **RISK_VIEWER (Người xem rủi ro):** Chỉ có quyền đọc (read-only) bảng điều khiển, xem danh sách hồ sơ, xem kết quả đánh giá rủi ro và lịch sử dự đoán.

---

## 4. QUY TRÌNH XÂY DỰNG MÔ HÌNH MÁY HỌC & GIẢI THÍCH

### 4.1. Tiền xử lý & Kỹ thuật tạo đặc trưng (Feature Engineering)
- **Biến mục tiêu ($y$):**
  - $1$: Khách hàng có nguy cơ vỡ nợ / không trả nợ tốt.
  - $0$: Khách hàng có khả năng hoàn trả nợ tốt.
- **Đặc trưng phái sinh:**
  - **DTI (Debt-to-Income):** Tỷ lệ tổng dư nợ hiện tại trên thu nhập hàng tháng.
  - **Loan-to-Income:** Tỷ lệ số tiền vay đề nghị trên thu nhập hàng tháng.
  - **Debt Burden:** Tổng gánh nặng nợ sau khi cộng thêm khoản vay mới trên thu nhập.
- **Tiền xử lý:**
  - Imputer: Điền giá trị khuyết thiếu bằng Median (biến số) và Most Frequent (biến phân loại).
  - Scaler: Chuẩn hóa biến số bằng `StandardScaler`.
  - Encoder: Mã hóa One-Hot Encoding cho các biến hạng mục (`occupation`, `credit_history`, `purpose`).

### 4.2. Huấn luyện và lựa chọn mô hình
- Dữ liệu được chia theo tỷ lệ 80/20 với phương pháp **Stratified Train/Test Split** nhằm bảo toàn phân phối nhãn.
- Áp dụng kỹ thuật cân bằng lớp bằng trọng số `scale_pos_weight` hoặc `class_weight='balanced'`.
- So sánh 3 thuật toán:
  1. **Logistic Regression:** Mô hình tuyến tính baseline.
  2. **Random Forest Classifier:** Mô hình tập hợp cây quyết định phân tán.
  3. **XGBoost Classifier:** Thuật toán tăng cường độ dốc (Gradient Boosting) tối ưu.
- **Tiêu chuẩn lựa chọn mô hình:**
  $$\text{Selection Score} = 0.45 \times \text{ROC-AUC} + 0.35 \times \text{PR-AUC} + 0.20 \times \text{F1-score}$$
  *Quyết định: Không lựa chọn mô hình chỉ theo Accuracy do phân phối mất cân bằng nhãn trong bài toán tín dụng.*

### 4.3. Công thức tính điểm tín dụng mô phỏng
$$\text{CreditScore} = \text{round}\left(\max\left(300, \min\left(850, 850 - 550 \times \text{default\_probability}\right)\right)\right)$$

- **Ngưỡng phân nhóm rủi ro:**
  - $\text{default\_probability} < 0.20$: **LOW_RISK** (Rủi ro thấp, đề xuất duyệt).
  - $0.20 \le \text{default\_probability} < 0.45$: **MEDIUM_RISK** (Rủi ro trung bình, cần thẩm định bổ sung).
  - $\text{default\_probability} \ge 0.45$: **HIGH_RISK** (Rủi ro cao, cảnh báo nợ xấu).

### 4.4. Giải thích bằng SHAP (Explainable AI)
- Sử dụng `shap.TreeExplainer` trích xuất giá trị SHAP đóng góp cho từng quyết định dự đoán.
- Phân tích top 5-7 đặc trưng ảnh hưởng mạnh nhất:
  - Giá trị SHAP dương ($> 0$): **INCREASE_RISK** (Tăng nguy cơ vỡ nợ, ví dụ: có lịch sử chậm trả nợ, DTI vượt mức 4.0).
  - Giá trị SHAP âm ($< 0$): **DECREASE_RISK** (Giảm nguy cơ vỡ nợ, tăng khả năng hoàn trả, ví dụ: số năm công tác cao, thu nhập ổn định, lịch sử tín dụng tốt).
- Tự động diễn giải ý nghĩa bằng câu tiếng Việt thân thiện với cán bộ tín dụng.

---

## 5. HƯỚNG DẪN CÀI ĐẶT VÀ VẬN HÀNH

### 5.1. Chạy toàn bộ hệ thống bằng Docker Compose
Chỉ cần thực hiện lệnh duy nhất tại thư mục gốc:

```bash
docker compose up --build
```

Hệ thống sẽ tự động:
1. Khởi tạo container PostgreSQL, áp dụng schema `init.sql` và seed `seed.sql`.
2. Khởi tạo container `ml-service`, nạp pipeline và tự động huấn luyện nếu chưa có artifact.
3. Khởi tạo container `backend`, kiểm tra database, tự động seed tài khoản admin/cán bộ và dữ liệu mẫu.
4. Build và phục vụ `frontend` qua Nginx tại cổng `3000`.

### 5.2. Các cổng dịch vụ
- **Giao diện Web:** `http://localhost:3000`
- **Backend API & Swagger UI:** `http://localhost:8000/docs`
- **ML Service Swagger:** `http://localhost:8001/docs`

### 5.3. Tài khoản demo kiểm thử
- **Quản trị viên (ADMIN):**
  - Email: `admin@credit-risk.com`
  - Mật khẩu: `Admin@123456`
- **Cán bộ tín dụng (CREDIT_OFFICER):**
  - Email: `officer@credit-risk.com`
  - Mật khẩu: `Officer@123456`
- **Người xem rủi ro (RISK_VIEWER):**
  - Email: `viewer@credit-risk.com`
  - Mật khẩu: `Viewer@123456`

---

## 6. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN
Hệ thống đã hoàn thành 100% mục tiêu của đề tài Niên luận Kỹ thuật phần mềm:
- Đáp ứng đầy đủ kiến trúc tách biệt 3 dịch vụ + CSDL.
- Giao diện trực quan, hỗ trợ tiếng Việt hoàn chỉnh, biểu đồ tương tác cao.
- Khả năng giải thích minh bạch với SHAP values giúp giải quyết bài toán "hộp đen" của Machine Learning trong lĩnh vực tài chính tín dụng.
- Dễ dàng mở rộng sang các bài toán thẩm định hạn mức tự động hoặc tích hợp dữ liệu phi cấu trúc trong tương lai.
