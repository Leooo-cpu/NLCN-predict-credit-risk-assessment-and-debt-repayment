# Hệ thống hỗ trợ đánh giá rủi ro tín dụng và dự đoán khả năng trả nợ bằng máy học

**Đề tài Niên luận Kỹ thuật phần mềm**  
Hệ thống **hỗ trợ** cán bộ tín dụng ước lượng xác suất vỡ nợ bằng Machine Learning và Explainable AI (SHAP), **không** thay thế quyết định cấp tín dụng thực tế, **không** kết nối ngân hàng thật và **không** dùng dữ liệu cá nhân thật.

> **Cảnh báo bắt buộc:** Kết quả chỉ mang tính hỗ trợ đánh giá rủi ro, không thay thế quyết định cấp tín dụng thực tế.  
> **Dữ liệu mô phỏng:** Toàn bộ khách hàng, hồ sơ vay và tập dữ liệu huấn luyện đều là dữ liệu mô phỏng (synthetic data).

---

## 1. Kiến trúc hệ thống

```
┌───────────────────────────┐      JWT      ┌─────────────────────────────┐     SQL     ┌────────────┐
│         Frontend          │ ────────────► │           Backend           │ ──────────► │ PostgreSQL │
│ (React + Vite + Tailwind) │               │      (FastAPI + JWT + RBAC) │             └────────────┘
└───────────────────────────┘               └──────────────┬──────────────┘
                                                           │ HTTP /predict
                                                           ▼
                                            ┌─────────────────────────────┐
                                            │         ML Service          │
                                            │ (FastAPI + XGBoost + SHAP)  │
                                            └─────────────────────────────┘
```

- **Frontend:** Không gọi trực tiếp ML Service; toàn bộ giao tiếp đi qua Backend.
- **Backend:** Quản lý người dùng, phân quyền RBAC, khách hàng, hồ sơ vay, lưu lịch sử dự đoán và nhật ký kiểm toán (audit log).
- **ML Service:** Tiền xử lý dữ liệu, nạp pipeline Joblib, dự đoán xác suất vỡ nợ, trích xuất SHAP values và sinh giải thích tiếng Việt.

---

## 2. Công nghệ sử dụng

| Phân hệ | Công nghệ |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, Axios, Recharts |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2, JWT, Bcrypt |
| **ML Service** | FastAPI, scikit-learn, XGBoost, pandas, NumPy, SHAP, Matplotlib, Joblib |
| **Database** | PostgreSQL 16 (hỗ trợ SQLite cho demo chạy nhẹ) |
| **Container & CI** | Docker, Docker Compose |
| **Testing** | Pytest (Backend & ML Service) |

---

## 3. Danh sách 10 trang giao diện người dùng

1. **Đăng nhập (`/login`):** Xác thực JWT, ghi nhớ phiên làm việc, phân quyền theo vai trò.
2. **Dashboard (`/`):** Thống kê tổng số hồ sơ, phân bố nhóm rủi ro (Pie chart), phân bố điểm tín dụng (Bar chart), trạng thái hồ sơ và danh sách hồ sơ rủi ro cao gần nhất.
3. **Danh sách khách hàng (`/customers`):** Tìm kiếm, lọc theo lịch sử tín dụng, phân trang, thêm mới và xem chi tiết khách hàng.
4. **Danh sách hồ sơ vay (`/loans`):** Tìm kiếm, lọc theo trạng thái/rủi ro, phân trang, thêm mới và import hàng loạt từ CSV.
5. **Chi tiết hồ sơ vay (`/loans/:id`):** Xem thông số tài chính, tính DTI tự động, kích hoạt chấm điểm ML trực tiếp.
6. **Tạo / Chỉnh sửa hồ sơ vay (`/loans/new`, `/loans/:id/edit`):** Form validation đầy đủ với Pydantic backend.
7. **Kết quả đánh giá rủi ro (`/risk-assessment`, `/loans/:id/result`):** Đồng hồ đo điểm tín dụng 300-850, xác suất vỡ nợ vs khả năng hoàn trả, biểu đồ SHAP thanh ngang, giải thích chi tiết từng yếu tố bằng tiếng Việt, gợi ý quyết định tín dụng và nút in kết quả.
8. **Lịch sử dự đoán (`/predictions`):** Bảng tổng hợp toàn bộ lượt đánh giá trên hệ thống, lọc theo rủi ro, tìm kiếm khách hàng, modal xem nhanh SHAP.
9. **Quản lý người dùng (`/users`):** Dành riêng cho `ADMIN` tạo, phân quyền và khóa tài khoản cán bộ.
10. **Thông tin mô hình (`/models`):** Xem mô hình đang ACTIVE, thuật toán, tập huấn luyện, công thức điểm và model registry.

---

## 4. Tài khoản demo

| Vai trò | Email | Mật khẩu | Quyền hạn |
|---|---|---|---|
| **ADMIN** | `admin@credit-risk.com` | `Admin@123456` | Quản trị người dùng, mô hình, toàn bộ dữ liệu |
| **CREDIT_OFFICER** | `officer@credit-risk.com` | `Officer@123456` | Quản lý khách hàng, tạo hồ sơ vay, chạy đánh giá ML |
| **RISK_VIEWER** | `viewer@credit-risk.com` | `Viewer@123456` | Chỉ xem dashboard, hồ sơ vay, kết quả và báo cáo |

---

## 5. Hướng dẫn chạy hệ thống

### Cách 1: Chạy bằng Docker Compose (Khuyến nghị - 1 lệnh duy nhất)

```bash
# 1. Sao chép file cấu hình môi trường
cp .env.example .env

# 2. Khởi tạo và chạy toàn bộ dịch vụ
docker compose up --build
```

**Các cổng truy cập:**
- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ML Service Docs (Swagger):** [http://localhost:8001/docs](http://localhost:8001/docs)

---

### Cách 2: Chạy Local độc lập (dành cho phát triển & kiểm thử)

#### 1. ML Service
```bash
cd ml-service
python -m pip install -r requirements.txt
python training/train.py
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

#### 2. Backend
```bash
cd backend
python -m pip install -r requirements.txt
# Mặc định sử dụng SQLite tại ./credit_risk_demo.db
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# Mở trình duyệt tại http://localhost:5173
```

---

## 6. Chạy kiểm thử tự động (Pytest)

```bash
# Kiểm thử Backend (Auth, RBAC, Customer, Loan, Risk scoring)
cd backend
python -m pytest

# Kiểm thử ML Service (Tạo dữ liệu mô phỏng, logic quy đổi điểm, pipeline)
cd ../ml-service
python -m pytest
```

---

## 7. Huấn luyện lại mô hình máy học

```bash
cd ml-service
python training/train.py
```

Quy trình huấn luyện:
- Tự động sinh tập dữ liệu mô phỏng có nhãn tại `data/simulated_credit_risk.csv`.
- So sánh 3 mô hình: **Logistic Regression**, **Random Forest**, **XGBoost** dựa trên:
  $$\text{Score} = 0.45 \times \text{ROC-AUC} + 0.35 \times \text{PR-AUC} + 0.20 \times \text{F1}$$
- Không đánh giá chỉ theo Accuracy do phân phối dữ liệu thực tế mất cân bằng.
- Xuất artifacts vào `artifacts/`:
  - `credit_pipeline.joblib`: Pipeline hoàn chỉnh (Imputer, Scaler, Encoder, Model).
  - `model_metadata.json`: Siêu dữ liệu phiên bản và metrics.
  - `plots/roc_curve.png`: Biểu đồ đường cong ROC.
  - `plots/pr_curve.png`: Biểu đồ đường cong Precision-Recall.
  - `plots/confusion_matrix.png`: Ma trận nhầm lẫn.
  - `plots/feature_importance.png`: Tầm quan trọng của các đặc trưng.
  - `plots/shap_summary.png`: Biểu đồ phân tích SHAP Summary.

---

## 8. Kịch bản Demo Niên luận (5 phút)

1. **Đăng nhập:** Mở `http://localhost:3000`, đăng nhập bằng `officer@credit-risk.com` / `Officer@123456`.
2. **Dashboard:** Xem thống kê hồ sơ, biểu đồ tròn phân bố rủi ro, phân bố điểm tín dụng mô phỏng.
3. **Quản lý khách hàng:** Vào menu **Khách hàng**, bấm xem hoặc tạo mới khách hàng mẫu.
4. **Hồ sơ vay:** Vào menu **Hồ sơ vay**, bấm **Import CSV** chọn tệp `database/sample_loan_import.csv` để nạp dữ liệu nhanh.
5. **Đánh giá rủi ro & SHAP:** Mở một hồ sơ bất kỳ, bấm **Đánh giá rủi ro** (hoặc mở menu **Đánh giá rủi ro**), xem:
   - Điểm tín dụng mô phỏng (300 - 850).
   - Xác suất vỡ nợ vs Khả năng trả nợ.
   - Nhóm rủi ro (LOW, MEDIUM, HIGH) và đề xuất xử lý hồ sơ.
   - Biểu đồ SHAP thanh ngang với yếu tố tăng (đỏ) và giảm (xanh) rủi ro.
6. **Lịch sử dự đoán:** Vào menu **Lịch sử dự đoán**, lọc theo nhóm rủi ro, mở modal xem chi tiết SHAP của các lượt đánh giá cũ.
7. **Phân quyền:** Đăng xuất và đăng nhập tài khoản `admin@credit-risk.com` / `Admin@123456` để kiểm tra trang **Người dùng** và **Mô hình**.
