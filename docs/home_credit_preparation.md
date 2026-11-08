# Chuẩn bị dữ liệu Home Credit Default Risk

## Phạm vi và nguồn

Repo được tìm thấy tại `D:/HK1_nam_4/CT250H_nien_luan_chuyen_nganh/NLCN-predict-credit-risk-assessment-and-debt-repayment`.
Dữ liệu thực tế nằm cạnh repo: `../home-credit-default-risk/`.
Đã mở toàn bộ `application_train.csv` và `HomeCredit_columns_description.csv` vào ngày 2026-11-08.
Không đọc `application_test.csv`, không ghép các bảng lịch sử khác.
Từ điển được đọc bằng cp1252 do bản phát hành có ký tự ngoài UTF-8.

`TARGET=1`: khách hàng gặp khó khăn thanh toán — trễ hơn X ngày ở ít nhất một
trong Y kỳ trả đầu tiên của khoản vay trong mẫu. Home Credit không công bố X/Y.
`TARGET=0`: mọi trường hợp còn lại; không diễn giải thành bảo đảm trả nợ đầy đủ.
`TARGET` chỉ là nhãn; `SK_ID_CURR` chỉ dùng kiểm tra định danh, không vào mô hình.

Luồng cũ lựa chọn mô hình/evaluate/export đã được gỡ khỏi entrypoint chuẩn bị;
`train_and_export()` báo lỗi rõ ràng. Không thay đổi metadata demo, nhãn nguồn dữ
liệu của kết quả cũ hay dữ liệu mô phỏng đã lưu. Không ghi pipeline phục vụ mới.
Checkout này chưa có `credit_pipeline.joblib`; muốn chạy dịch vụ demo phải khôi phục
artifact mô phỏng tương thích từ nguồn hiện có. Dịch vụ báo thiếu artifact thay vì
tự huấn luyện khi khởi động. Không tuyên bố đã kiểm thử dự đoán online.

## Hợp đồng thuộc tính v1

Nguồn định nghĩa dùng chung: [home_credit_features.py](../ml-service/app/home_credit_features.py).
Các cột được giữ tên CSV; không ép sang schema demo hiện tại.
Đây là các thuộc tính có thể thu thập tại thời điểm nộp hồ sơ/lập điều kiện khoản vay,
không phụ thuộc kết quả trả nợ tương lai. Giá trị tiền giữ thang đo của CSV; từ điển
không công bố mã tiền tệ. Không mặc định các số tiền này là VND.

| Cột CSV | Ý nghĩa theo từ điển | Đơn vị | Trường cũ | Nguồn khi dự đoán / xử lý |
|---|---|---|---|---|
| AMT_CREDIT | Credit amount of the loan | Tiền, chưa xác định tiền tệ | requested_amount chỉ gần nghĩa | Số tiền cấp tín dụng trong đề nghị/điều kiện khoản vay, phải thống nhất với định nghĩa và thang đo nguồn; số dương, thiếu → trung vị train; chuẩn hóa |
| AMT_ANNUITY | Loan annuity | Tiền trả theo lịch; từ điển không nêu tần suất | Chưa có | Nhập số tiền annuity do điều kiện khoản vay cung cấp trước chấm điểm; không suy ra từ kỳ hạn/lãi suất tự đặt; số dương, thiếu → trung vị train; chuẩn hóa |
| DAYS_BIRTH | Client's age in days at application | Ngày âm so với ngày nộp | age / date_of_birth | Tính từ ngày sinh và ngày nộp hồ sơ thực tế; không dùng tuổi mặc định 30 hoặc ngày hiện tại khi chấm lại hồ sơ cũ; thiếu → trung vị train; chuẩn hóa |
| DAYS_EMPLOYED | Days before application when current employment started | Ngày không dương so với ngày nộp | years_employed | Ngày bắt đầu công việc và ngày nộp; mã 365243 → thiếu, không hiểu là thâm niên thật; thiếu → trung vị train; chuẩn hóa |
| NAME_CONTRACT_TYPE | Identification if loan is cash or revolving | Danh mục | Chưa có; không phải purpose | Nhập loại Cash loans / Revolving loans từ điều kiện khoản vay; thiếu/mã đặc biệt → __MISSING__; one-hot |
| OCCUPATION_TYPE | What kind of occupation does the client have | Danh mục | occupation dạng tự do | Hồ sơ nghề nghiệp, cần danh mục tương thích Home Credit; thiếu/mã đặc biệt → __MISSING__; one-hot; danh mục nghề chưa thấy ở train → bỏ qua mã hóa |
| AMT_INCOME_TOTAL | Income of the client | Tiền; từ điển không nêu kỳ thu nhập | monthly_income **không tương đương** | Đã kiểm tra nhưng **không chọn** ở v1. Cần bằng chứng kỳ thu nhập, tiền tệ và nguồn thu thập trước khi thêm; không tự nhân/chia 12 |
| TARGET | Khó khăn thanh toán theo định nghĩa trên | Nhị phân | default của dữ liệu mô phỏng có nghĩa khác | Chỉ nhãn; không gán cùng ý nghĩa với nhãn cũ |
| SK_ID_CURR | ID of loan in sample | Định danh | ID nội bộ không tương đương | Kiểm tra thiếu/trùng; không đưa vào X |
| Không có nguồn tương đương trực tiếp trong bảng này | Kỳ hạn, mục đích vay, tổng dư nợ, số khoản vay, số lần trễ, credit_history | Tùy trường | term_months, purpose, current_debt, existing_loans, late_payments, credit_history | Không tạo giá trị để khớp form; không lấy TARGET làm lịch sử tín dụng |
| Không có tử số/mẫu số cùng định nghĩa | Tỷ lệ demo | Tỷ lệ | dti, loan_to_income, debt_burden | Không dùng; không chia số tiền vay cho thu nhập chưa rõ kỳ |
| Các cột còn lại trong application_train | Ngoài phạm vi v1 | Theo từ điển | Không có ánh xạ đã xác minh | Không chọn; gồm EXT_SOURCE_*, thông tin bureau, giấy tờ và chỉ báo không có nguồn vận hành rõ ràng |

Danh sách chính xác: số = `AMT_CREDIT, AMT_ANNUITY, DAYS_BIRTH, DAYS_EMPLOYED`;
phân loại = `NAME_CONTRACT_TYPE, OCCUPATION_TYPE`. Schema từ chối cột thừa, cột thiếu,
dữ liệu số sai kiểu, vô cực, tiền không dương và mã ngày dương không hợp lệ.

Pipeline: làm sạch không học tham số → ColumnTransformer (median + StandardScaler
cho số; constant missing + OneHotEncoder cho danh mục). Mọi trung vị, mean/scale,
và tập danh mục đều chỉ được học trong `fit` trên phần train. Trường số hoàn toàn thiếu
trong train được giữ chiều và điền 0 theo `keep_empty_features=True`; đó là giá trị
kỹ thuật sau xử lý thiếu, không phải dữ liệu hồ sơ được tự tạo. Các mã XNA/XAP/Unknown
được coi là thiếu theo chính sách hợp đồng; báo cáo vẫn giữ số đếm giá trị gốc.

## Kiểm tra thực tế

Báo cáo máy đọc được: [home_credit_audit.json](home_credit_audit.json), gồm missing của
từng cột và mô tả CSV của toàn bộ 122 cột. Báo cáo không chứa dòng hồ sơ gốc.

| Chỉ tiêu | Kết quả |
|---|---:|
| Dòng / cột CSV gốc | 307511 / 122 |
| TARGET=0 | 282686 (91.9271%) |
| TARGET=1 | 24825 (8.0729%) |
| SK_ID_CURR trùng / thiếu | 0 / 0 |
| Ô thiếu / cột có thiếu | 9152465 / 67 |
| DAYS_EMPLOYED=365243 | 55374 |
| Thiếu AMT_ANNUITY / OCCUPATION_TYPE | 12 / 96391 |
| Thiếu AMT_CREDIT / AMT_INCOME_TOTAL / DAYS_BIRTH / DAYS_EMPLOYED / NAME_CONTRACT_TYPE | 0 / 0 / 0 / 0 / 0 |
| CODE_GENDER=XNA | 4 |
| ORGANIZATION_TYPE=XNA | 55374 |
| NAME_FAMILY_STATUS=Unknown | 2 |
| Giá trị vô cực ở các cột số | 0 |
| AMT_CREDIT / AMT_INCOME_TOTAL / AMT_ANNUITY không dương | 0 / 0 / 0 |
| Mẫu smoke / fit / transform | 256 / 192 / 64 |
| Đầu ra Pipeline train / validation | (192, 22) / (64, 22), hữu hạn |
| Kiểm thử schema/Pipeline/loader/chặn export và tự huấn luyện | 12 passed |
| Toàn bộ bộ kiểm thử ML (gồm 3 kiểm thử demo cũ) | 15 passed |

Không fit classifier, không tính AUC/F1, không chạy quy trình đánh giá cũ. Bộ kiểm thử
dùng mẫu nhân tạo rất nhỏ để kiểm tra lỗi/không rò rỉ tham số; entrypoint không dùng
các mẫu này làm nguồn huấn luyện và không có fallback sang dữ liệu mô phỏng.

## Những chỗ phải đồng bộ trước khi dùng Home Credit để dự đoán

- [schemas.py](../ml-service/app/schemas.py): thêm request được version hóa theo hợp đồng
  v1, đúng tên/kiểu/nullable; không thay schema demo đang dùng. Phản hồi cần diễn đạt
  đúng sự kiện TARGET, không khẳng định `1-p` là khả năng hoàn trả đầy đủ.
- [scoring.py](../ml-service/app/scoring.py): dùng chung FEATURES/validate_features và
  Pipeline đã fit khi có model v1; bỏ tỷ lệ demo và heuristic SHAP cũ ở nhánh Home Credit;
  kiểm tra contract_version và nguồn metadata trước load, không lấy model mới cho schema cũ.
- [feature_map.py](../ml-service/app/feature_map.py): tên/đơn vị của 6 thuộc tính và danh
  mục Home Credit; diễn giải ngày âm/missing, không mô tả mã 365243 thành số năm làm việc.
- [ml_client.py](../backend/app/services/ml_client.py), [customer.py](../backend/app/models/customer.py),
  [loan_application.py](../backend/app/models/loan_application.py), các schema customer/loan:
  lưu ngày nộp, ngày sinh, ngày bắt đầu công việc, số tiền annuity, loại hợp đồng,
  nghề nghiệp theo danh mục và nguồn/thang tiền tệ; migration database tương ứng.
  Không dùng `age or 30`, không chuyển `monthly_income` sang tổng thu nhập.
- [LoanFormPage.tsx](../frontend/src/pages/LoanFormPage.tsx),
  [CustomersPage.tsx](../frontend/src/pages/CustomersPage.tsx), [types.ts](../frontend/src/types.ts):
  nhập/hiển thị các trường mới và trạng thái không biết; bỏ mặc định nghề/annuity/contract
  không có nguồn. Các trường nghiệp vụ kỳ hạn/mục đích có thể tồn tại độc lập nhưng không
  gửi vào X của v1. Đồng bộ import CSV và form sửa hồ sơ.
- Lưu phiên bản model/dataset cùng lịch sử dự đoán; các kết quả demo và model registry cũ
  vẫn giữ nhãn synthetic. Xác minh thang tiền tệ và ý nghĩa annuity trước triển khai.

## PowerShell

Chạy từ thư mục gốc repo. Môi trường kiểm tra dùng Python 3.13.14, pandas 2.2.3,
NumPy 2.2.1, scikit-learn 1.6.0. Python Store cần chạy ngoài sandbox của agent;
đã tạo môi trường riêng trong `ml-service/.venv` (Git bỏ qua).

Đã chạy thành công với tự tìm thư mục cạnh repo:

```powershell
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --sample-size 256 --report docs/home_credit_audit.json
```

Đường dẫn tường minh (đã chạy thành công trên cùng dữ liệu):

```powershell
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --application-csv '../home-credit-default-risk/application_train.csv' --description-csv '../home-credit-default-risk/HomeCredit_columns_description.csv' --sample-size 256
```

Biến môi trường (đã chạy thành công; đường dẫn có khoảng trắng được hỗ trợ):

```powershell
$env:HOME_CREDIT_DATA_DIR = 'D:/HK1_nam_4/CT250H_nien_luan_chuyen_nganh/home-credit-default-risk'
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --sample-size 256
Remove-Item Env:HOME_CREDIT_DATA_DIR
```

Ưu tiên theo từng file: tham số `--application-csv`/`--description-csv` →
`HOME_CREDIT_APPLICATION_CSV`/`HOME_CREDIT_DESCRIPTION_CSV` → `--data-dir` hoặc
`HOME_CREDIT_DATA_DIR` → tìm tự động. Khi chỉ truyền file application, từ điển mặc định
ở cạnh file đó. Đường dẫn tương đối tính từ working directory. Override sai sẽ báo lỗi
kèm đường dẫn đã thử, không tìm file khác âm thầm. Không cấu hình gì thì thử thư mục
`home-credit-default-risk` trong repo, cạnh repo, rồi trong `ml-service/data`.

Kiểm thử:

```powershell
Push-Location ml-service
& './.venv/Scripts/python.exe' -m pytest tests/test_home_credit.py -q
& './.venv/Scripts/python.exe' -m pytest -q
Pop-Location
```

## Docker

Thêm service chạy một lần trong [docker-compose.home-credit.yml](../docker-compose.home-credit.yml),
profile `prepare`, mount dữ liệu chỉ đọc và ghi audit vào docs; không mount volume
artifacts của dịch vụ chấm điểm. Python image đã có các dependency cần thiết.

```powershell
$env:HOME_CREDIT_DATA_DIR = 'D:/HK1_nam_4/CT250H_nien_luan_chuyen_nganh/home-credit-default-risk'
docker compose -f docker-compose.yml -f docker-compose.home-credit.yml --profile prepare run --rm --build home-credit-prepare
```

Chưa chạy container/build hoặc xác thực Compose vì máy không có lệnh `docker`.
CSV gốc trong repo bị Git và Docker build context bỏ qua;
không cần copy CSV vào image. Thư mục dữ liệu hiện nằm ngoài Git repo.
