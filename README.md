# Hệ thống hỗ trợ đánh giá rủi ro tín dụng và dự đoán khả năng trả nợ bằng máy học

**Đề tài Niên luận Kỹ thuật phần mềm**  
Hệ thống **hỗ trợ** cán bộ tín dụng ước lượng rủi ro gặp khó khăn thanh toán theo Home Credit bằng Machine Learning, **không** thay thế quyết định cấp tín dụng thực tế và **không** kết nối ngân hàng thật. Hồ sơ và giải thích SHAP mô phỏng cũ được giữ để xem lịch sử.

> **Cảnh báo bắt buộc:** Kết quả chỉ mang tính hỗ trợ đánh giá rủi ro, không thay thế quyết định cấp tín dụng thực tế.  
> **Nguồn dữ liệu:** Mô hình đang phục vụ là Home Credit `home-credit-v1-20261108`. Theo yêu cầu thay demo cũ, đã sao lưu rồi xóa 6 hồ sơ mô phỏng, nạp toàn bộ **307511 hồ sơ Home Credit** vào PostgreSQL. Có thể mở từng hồ sơ, dự đoán và lưu lịch sử. Xem [cách dùng và kết quả kiểm tra](docs/home_credit_customer_flow.md).

**Sử dụng ngay:** `http://localhost:3000/customers` → chọn hồ sơ → **Dự đoán và lưu kết quả**.
CSV không có họ tên thật nên danh sách dùng mã hồ sơ ẩn danh. TARGET gốc hiển thị riêng,
không gửi vào mô hình. Dữ liệu đã ở volume Docker; không cần import/huấn luyện lại mỗi lần mở app.

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

Hệ thống chỉ có hai vai trò hoạt động: `ADMIN` và `OFFICER`. Khách hàng là hồ sơ nghiệp vụ, không cần tài khoản đăng nhập. Tài khoản Viewer cũ đã ngừng sử dụng; chi tiết migration và kiểm tra tại [docs/two_roles.md](docs/two_roles.md).

Trang đăng nhập có nút điền nhanh cho hai tài khoản Admin và Officer `.com` dưới đây. Nút chỉ điền thông tin; bấm **Đăng nhập** để xác thực. Nếu mật khẩu đã được đổi, nhập mật khẩu hiện tại.

Backend tạo tài khoản khi chưa có. Với tài khoản demo cũ dùng đuôi `.local`, bước seed chỉ đổi email sang `.com`, giữ ID, vai trò và mật khẩu đã băm. Nếu cả hai địa chỉ cùng tồn tại, dùng `.com` và giữ nguyên cả hai; nếu tài khoản được chọn sai vai trò, seed báo xung đột để kiểm tra. Không cần xóa database hay Docker volume. `ADMIN_EMAIL` vẫn hỗ trợ địa chỉ quản trị tùy chỉnh; cấu hình mặc định dùng `admin@credit-risk.com`.

| Vai trò | Email | Mật khẩu | Quyền hạn |
|---|---|---|---|
| **ADMIN** | `admin@credit-risk.com` | `Admin@123456` | Quản trị người dùng, mô hình, toàn bộ dữ liệu |
| **OFFICER** | `officer@credit-risk.com` | `Officer@123456` | Quản lý khách hàng, tạo hồ sơ vay, chạy đánh giá ML |

---

## 5. Hướng dẫn chạy hệ thống

### Cách 1: Chạy bằng Docker Compose (Khuyến nghị - 1 lệnh duy nhất)

```bash
# 1. Sao chép file cấu hình môi trường
cp .env.example .env

# 2. Khởi tạo và chạy toàn bộ dịch vụ
docker compose up --build
```

Đã kiểm tra chạy thực tế trên Docker Desktop: PostgreSQL, backend, ML Service và frontend.
ML Service cần `active_model.json` và thư mục phiên bản Home Credit tương ứng trong
volume `ml_artifacts`. Binary mô hình được lưu cục bộ và Git bỏ qua. Với volume cũ,
phải sao chép bản phiên bản đã xác minh cùng manifest vào volume hoặc huấn luyện và
kích hoạt trong môi trường đó. Không tự huấn luyện lúc khởi động. Khi cần thay dữ liệu
mô phỏng, dùng importer có backup trong [hướng dẫn hồ sơ khách hàng](docs/home_credit_customer_flow.md).

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
# Cần artifact Home Credit đã train và activate theo mục 7.
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

## 7. Huấn luyện và phục vụ Home Credit

Chỉ dùng bảng có nhãn `application_train.csv`. Chia phân tầng một lần 80% Training /
20% Test với `random_state=42`. Trên Training, cả ba mô hình chạy cùng 5 fold phân tầng
(`shuffle=True`, `random_state=42`), mỗi lượt fit Pipeline mới. Chọn **AP CV trung bình
cao nhất**, hòa thì ROC-AUC CV trung bình, vẫn hòa thì Logistic Regression → Random
Forest → XGBoost. Không dùng điểm tổng hợp hoặc kết quả Test để chọn thuật toán.

Ngưỡng phân loại **0,5** được cố định trước khi mở Test. Fit lại toàn bộ Pipeline trên
Training, đánh giá mô hình đã chốt **một lần** trên Test. Không dùng `application_test.csv`
Kaggle để đánh giá. Hai ngưỡng nhóm rủi ro 0,20/0,45 cũ chỉ được kiểm tra bằng OOF của
Training và đang **tắt**; phản hồi mới là `NOT_VALIDATED`, xác suất chưa hiệu chỉnh.

```powershell
# Kiểm tra 15 lượt CV bằng 150 dòng nhân tạo; không đọc CSV thật hay đánh giá Test thật.
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --mode cv-smoke --sample-size 150
```

```powershell
# Từ gốc repo; dùng tên phiên bản MỚI khi tái lập, không ghi đè phiên bản hiện có.
$env:HOME_CREDIT_DATA_DIR = 'D:/HK1_nam_4/CT250H_nien_luan_chuyen_nganh/home-credit-default-risk'
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --mode train --version home-credit-v1-repro --report docs/home_credit_repro_results.json
Push-Location ml-service
& './.venv/Scripts/python.exe' -m training.activate --version home-credit-v1-repro
Pop-Location
```

Lệnh tự tìm CSV trong thư mục `home-credit-default-risk` bên trong hoặc cạnh repo;
có thể truyền `--application-csv`, `--description-csv`, `--data-dir` hoặc biến môi trường.
`--mode prepare` (mặc định) chỉ audit và thử tiền xử lý trên mẫu Training;
`--mode cv` chỉ so sánh CV; `--mode train --version ...` chạy đầy đủ và lưu candidate.
Không fallback sang dữ liệu mô phỏng nếu CSV lỗi. Các biến `HOME_CREDIT_APPLICATION_CSV`
và `HOME_CREDIT_DESCRIPTION_CSV` hỗ trợ cấu hình từng tệp. `ARTIFACT_DIR` cấu hình nơi
ML Service nạp manifest; nếu dùng đường dẫn khác, truyền cùng nơi đó cho training/activation.

Candidate nằm ở `ml-service/artifacts/versions/<version>/`: Pipeline chứa classifier,
metadata CV/Test, khóa lựa chọn trước Test, yêu cầu mẫu và báo cáo kiểm tra API.
Chỉ lệnh activate mới cập nhật `active_model.json`, sau khi reload và kiểm tra API thành công.
Điểm hồ sơ `850 - 550*p` vẫn là minh họa, tách biệt hoàn toàn với tiêu chí AP chọn thuật toán.

Định nghĩa thuộc tính, bảng đối chiếu, kết quả kiểm tra thực tế, lệnh PowerShell và
Docker: [Home Credit preparation](docs/home_credit_preparation.md).
Kết quả thật và giới hạn: [Home Credit release](docs/home_credit_release.md).

---

## 8. Kịch bản Demo Niên luận (5 phút)

1. **Đăng nhập:** Mở `http://localhost:3000`, đăng nhập bằng `officer@credit-risk.com` / `Officer@123456`.
2. **Dashboard:** Xem thống kê hồ sơ, biểu đồ tròn phân bố rủi ro, phân bố điểm tín dụng mô phỏng.
3. **Quản lý khách hàng:** Vào menu **Khách hàng**, bấm xem hoặc tạo mới khách hàng mẫu.
4. **Hồ sơ vay:** Vào menu **Hồ sơ vay**, bấm **Import CSV** chọn tệp `database/sample_loan_import.csv` để nạp dữ liệu nhanh.
5. **Dự đoán theo khách hàng:** Vào Khách hàng hoặc Hồ sơ và dự đoán, chọn hồ sơ Home Credit,
   kiểm tra 6 đầu vào, bấm Dự đoán và lưu kết quả. Mỗi lần lưu gắn đúng hồ sơ, snapshot đầu
   vào và phiên bản mô hình; mở Lịch sử dự đoán để xem lại. Không mặc định số tiền là VND.
6. **Lịch sử dự đoán:** Vào menu **Lịch sử dự đoán**, lọc theo nhóm rủi ro, mở modal xem chi tiết SHAP của các lượt đánh giá cũ.
7. **Phân quyền:** Đăng xuất và đăng nhập tài khoản `admin@credit-risk.com` / `Admin@123456` để kiểm tra trang **Người dùng** và **Mô hình**.
