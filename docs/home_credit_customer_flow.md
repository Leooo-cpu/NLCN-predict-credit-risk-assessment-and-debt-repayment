# Khách hàng → hồ sơ Home Credit → dự đoán → lịch sử

## Trạng thái đã thực hiện trên Docker

- Đã import **307511** dòng thật từ `application_train.csv`, SHA256
  `52e96b895b1112e1c853f670e58372719c8441c5ed1c57ac2f7fad559d784f5f`.
- Theo yêu cầu thay dữ liệu mô phỏng: sao lưu rồi xóa **6 khách hàng, 6 hồ sơ vay,
  1 bản ghi registry mô phỏng**. Database trước khi thay có **0 dự đoán cũ**.
- Backup: [synthetic-before-home-credit-20261108T092213636486Z.json](../backups/synthetic-before-home-credit-20261108T092213636486Z.json).
  Tài khoản đăng nhập và volume PostgreSQL không bị xóa. Không tự seed lại các hồ sơ mô phỏng.
- Báo cáo import: [home_credit_import.json](../reports/home_credit_import.json).
  Import không huấn luyện lại hoặc tự dự đoán hàng loạt. Import lần sau bỏ qua mã nguồn
  đã có, không reset đầu vào người dùng đã sửa hoặc lịch sử dự đoán.
- Đã build lại backend/ML/frontend, chạy trên Docker thật tại `http://localhost:3000`.

CSV không có họ tên thật: giao diện dùng tên hiển thị “Hồ sơ Home Credit #SK_ID_CURR”.
Mã này là mã hồ sơ nguồn, không khẳng định một cá nhân duy nhất hoặc tự tạo danh tính.
TARGET được lưu riêng làm **nhãn tham khảo gốc**, không phải kết quả dự đoán và không
bao giờ nằm trong payload gửi ML. Nếu sửa đầu vào, nhãn gốc vẫn là thông tin lịch sử
của dòng CSV ban đầu, không tự biến thành ground truth cho đầu vào đã sửa.

## Cách dùng

1. Mở `http://localhost:3000`, đăng nhập tài khoản hiện có.
2. Chọn **Khách hàng** hoặc **Hồ sơ và dự đoán**; tìm theo mã hồ sơ.
3. Bấm tên hồ sơ để xem số tiền, annuity, nghề, ngày sinh/ngày bắt đầu công việc và
   loại hợp đồng từ dữ liệu thật. Không hiển thị số tiền Home Credit như VND.
4. Kiểm tra hoặc chỉnh đầu vào, rồi bấm **Dự đoán và lưu kết quả**.
5. Kết quả lưu theo đúng hồ sơ, cùng snapshot đầu vào, revision, model version,
   nguồn mô hình, ngưỡng và thời gian. Xem lại trong hồ sơ hoặc **Lịch sử dự đoán**.
6. Muốn thêm hồ sơ riêng: **Thêm hồ sơ khách hàng**, nhập tên/mã và các giá trị thật
   theo hợp đồng mô hình. Không tự suy từ thu nhập tháng hoặc các mặc định demo cũ.

`/home-credit` đưa về danh sách khách hàng. `/risk-assessment` cho phép chọn hồ sơ có sẵn
hoặc nhập hồ sơ mới để dự đoán. Chỉ ADMIN và OFFICER đăng nhập và thao tác;
khách hàng không cần tài khoản. Hồ sơ bị sửa sẽ làm kết quả cũ có cảnh báo không còn ứng với revision hiện tại.
Mỗi kết quả lịch sử vẫn giữ snapshot riêng. Request revision cũ trả 409, lỗi ML không
tạo kết quả giả. API kiểm tra đầu vào trực tiếp bằng schema canonical của ML Service.

Đầu ra giữ đúng sự kiện khó khăn thanh toán Home Credit. Xác suất chưa hiệu chỉnh,
không gán nhóm rủi ro cũ 0.20/0.45. Không đưa TARGET/SK_ID_CURR vào mô hình.
Pipeline, tiêu chí chọn AP và kết quả Test ở bước trước không bị thay đổi.

## Lưu trữ và API

Hai bảng mới `credit_cases` / `credit_predictions` được ORM tạo khi backend khởi động,
không sửa hoặc giả lập các cột thu nhập tháng/kỳ hạn của schema cũ. Chỉ dữ liệu mô phỏng
được đánh dấu mới bị importer xóa sau backup, trong transaction cùng lần import.

- `GET /api/credit-cases`: phân trang, q, predicted=true/false.
- `GET /api/credit-cases/summary`: số hồ sơ và lượt dự đoán đã lưu.
- `GET /api/credit-cases/predictions`: lịch sử toàn hệ thống, tìm theo tên/mã.
- `POST /api/credit-cases`: tên/mã khách hàng + inputs hợp lệ.
- `GET /api/credit-cases/{id}`: chi tiết và kết quả mới nhất.
- `PUT /api/credit-cases/{id}/inputs`: inputs + expected_revision.
- `POST /api/credit-cases/{id}/score`: expected_revision; dự đoán bằng inputs đã lưu.
- `GET /api/credit-cases/{id}/predictions`: lịch sử riêng hồ sơ.
- ML `POST /validate`: validate cùng PredictRequest như `/predict`, không chạy model.

## Kiểm tra thực tế

- Backend: **17 passed**, gồm fixture SQLite kiểm tra backup, rollback nếu CSV lỗi,
  import lặp, phân quyền, revision, không truyền nhãn/ID, lưu snapshot và lịch sử;
  đồng thời có kiểm thử gọi ML Docker thật. Fixture không ghi vào database production.
- Frontend: TypeScript `--noEmit` qua; build Docker/Vite qua.
- Trình duyệt thật: đăng nhập → danh sách 307511 hồ sơ → mở #100002 → dự đoán/lưu →
  reload → lịch sử toàn hệ thống. Đã lưu **1 kết quả thực** cho hồ sơ này:
  khoảng **72.6% khó khăn thanh toán**, XGBoost `home-credit-v1-20261108`, ngưỡng 0.5.
  Đây là suy luận một hồ sơ để kiểm tra luồng, không phải đánh giá lại Test.
- Xác minh DB Docker: 307511 credit_cases, 1 credit_prediction, 0 khách hàng mô phỏng,
  0 hồ sơ legacy, 0 dự đoán legacy. Tài khoản được giữ nguyên.

## Tái lập import trên Docker (không cần chạy lại ở database hiện tại)

Chạy ở gốc repo sau khi PostgreSQL đã chạy; backup/report chỉ ghi ra thư mục riêng.
`--replace-synthetic` yêu cầu backup và không xóa tài khoản. Không dùng `down -v`.

```powershell
New-Item -ItemType Directory -Path './backups','./reports' -Force
docker compose build backend ml-service frontend
docker compose run --rm --no-deps --volume "${PWD}/../home-credit-default-risk:/datasets:ro" --volume "${PWD}/backups:/backups" --volume "${PWD}/reports:/reports" backend python -m app.import_home_credit --csv /datasets/application_train.csv --replace-synthetic --backup-dir /backups --report /reports/home_credit_import.json
docker compose up -d
```

Những lần sử dụng sau chỉ mở Docker và start các container / `docker compose up -d`.
Không cần import hoặc huấn luyện lại mỗi lần khởi động.

## Tệp chính thay đổi

- Backend: [models/credit_case.py](../backend/app/models/credit_case.py),
  [schemas/credit_case.py](../backend/app/schemas/credit_case.py),
  [routers/credit_cases.py](../backend/app/routers/credit_cases.py),
  [import_home_credit.py](../backend/app/import_home_credit.py),
  [seed.py](../backend/app/seed.py), [main.py](../backend/app/main.py),
  [models/__init__.py](../backend/app/models/__init__.py),
  [test_credit_cases.py](../backend/tests/test_credit_cases.py), [seed.sql](../database/seed.sql).
- Frontend: [CreditCaseListPage.tsx](../frontend/src/pages/CreditCaseListPage.tsx),
  [CreditCaseDetailPage.tsx](../frontend/src/pages/CreditCaseDetailPage.tsx),
  [CreditCaseHistoryPage.tsx](../frontend/src/pages/CreditCaseHistoryPage.tsx),
  [CreditDashboardPage.tsx](../frontend/src/pages/CreditDashboardPage.tsx),
  [CreditCaseForm.tsx](../frontend/src/components/CreditCaseForm.tsx),
  [CasePredictionCard.tsx](../frontend/src/components/CasePredictionCard.tsx),
  [creditTypes.ts](../frontend/src/creditTypes.ts), [App.tsx](../frontend/src/App.tsx),
  [LoginPage.tsx](../frontend/src/pages/LoginPage.tsx),
  [Layout.tsx](../frontend/src/components/Layout.tsx),
  [Disclaimer.tsx](../frontend/src/components/Disclaimer.tsx), [format.ts](../frontend/src/utils/format.ts).
- ML: [main.py](../ml-service/app/main.py) thêm validate không chạy dự đoán.
- Cấu hình/tài liệu: [.gitignore](../.gitignore), [README.md](../README.md),
  [api.md](api.md), [home_credit_release.md](home_credit_release.md), tài liệu này.
