# Home Credit v1 — kết quả thật và tích hợp dự đoán

Phiên bản: **home-credit-v1-20261108**. Đã đọc CSV thật, chạy đủ 15 lượt CV,
refit XGBoost trên toàn bộ Training, đánh giá Test một lần, reload và kiểm tra API
trước khi kích hoạt manifest. Không thay nguồn hoặc nội dung kết quả mô phỏng cũ.

## Dữ liệu, lựa chọn và Test độc lập

- Nguồn: `../home-credit-default-risk/application_train.csv` và từ điển cột cạnh repo.
  Không đọc `application_test.csv` Kaggle để đánh giá.
- 307511 dòng → **246008 Training / 61503 Test**, chia phân tầng TARGET, seed 42.
- Training: cùng 5 fold phân tầng, shuffle/seed 42 cho cả ba thuật toán; mỗi lượt
  tạo Pipeline mới. Median, mean/scale và one-hot chỉ học từ phần fit; trọng số
  XGBoost chỉ tính từ nhãn của phần fit.
- Chọn AP (`average_precision_score`) trung bình cao nhất; hòa chính xác thì ROC-AUC
  trung bình cao nhất; vẫn hòa chính xác thì LogisticRegression → RandomForest →
  XGBoost. Không dùng F1 hoặc Test để chọn. Std dưới đây dùng ddof=0.

| Thuật toán | Fold | AP CV mean ± std | ROC-AUC CV mean ± std |
|---|---:|---:|---:|
| Logistic Regression | 5 | 0.125337 ± 0.002642 | 0.630012 ± 0.003086 |
| Random Forest | 5 | 0.133694 ± 0.001918 | 0.640619 ± 0.003528 |
| **XGBoost — được chọn** | 5 | **0.143035 ± 0.001938** | **0.652889 ± 0.002960** |

Ngưỡng phân loại **0.5** được cố định trước Test. Tên thuật toán, ngưỡng và kiểm tra
OOF của ngưỡng nhóm cũ được ghi [selection_lock.json](../ml-service/artifacts/versions/home-credit-v1-20261108/selection_lock.json)
trước khi mở kết quả Test. Sau đó refit Pipeline mới trên toàn bộ Training.

Test độc lập, mô hình XGBoost đã chốt:

| Chỉ số | Giá trị |
|---|---:|
| AP | 0.1438612424 |
| ROC-AUC | 0.6522581182 |
| Precision tại 0.5 | 0.1239478744 |
| Recall tại 0.5 | 0.5842900302 |
| F1 tại 0.5 | 0.2045118082 |

Ma trận nhầm lẫn, hàng = thực tế 0/1, cột = dự đoán 0/1:

| | Dự đoán 0 | Dự đoán 1 |
|---|---:|---:|
| Thực tế 0 | TN=36034 | FP=20504 |
| Thực tế 1 | FN=2064 | TP=2901 |

Đã gọi bước đánh giá Test thật **một lần**. Không đổi mô hình, thuộc tính, tiền xử lý
hoặc ngưỡng sau kết quả này. Các lần reload/API sau đó chỉ dùng một dòng **Training**
đã lưu. Chạy lại cùng tên phiên bản bị từ chối, tránh ghi đè hoặc vô tình đánh giá lại.

Số liệu đầy đủ từng fold: [home_credit_final_results.json](home_credit_final_results.json).
Metadata phiên bản: [model_metadata.json](../ml-service/artifacts/versions/home-credit-v1-20261108/model_metadata.json).
Metadata mô phỏng cũ ở thư mục artifacts gốc vẫn nguyên bản; `pr_auc` trong bản cũ
thực chất là AP, còn điểm lựa chọn cũ chỉ là thông tin lịch sử. Đã xóa công thức
lựa chọn cũ khỏi mã thực thi và báo cáo mô tả quy trình hiện tại. Điểm hồ sơ minh họa
`850 - 550*p` vẫn là khái niệm riêng, không tham gia chọn thuật toán.

## Hợp đồng dự đoán

Một định nghĩa nguồn: [home_credit_features.py](../ml-service/app/home_credit_features.py).
API tạo schema từ FEATURE_SPEC; backend chuyển hợp đồng nguyên trạng, frontend tải
schema qua backend để dựng form. Metadata lưu cùng danh sách, kiểu, đơn vị/nullability;
loader từ chối nếu không khớp, nguồn sai, lớp sai hoặc checksum Pipeline sai.

| Trường | Kiểu | Null | Ý nghĩa / đơn vị |
|---|---|---|---|
| AMT_CREDIT | number > 0 | Không | Tiền cấp tín dụng, thang Home Credit gốc |
| AMT_ANNUITY | number > 0 | Có | Annuity theo điều kiện khoản vay; không tự suy tần suất |
| DAYS_BIRTH | integer âm | Không | Ngày sinh so với ngày nộp hồ sơ |
| DAYS_EMPLOYED | integer không dương, hoặc 365243 | Có | Ngày bắt đầu việc so với ngày nộp; sentinel → thiếu |
| NAME_CONTRACT_TYPE | string | Không | Cash loans / Revolving loans |
| OCCUPATION_TYPE | string | Có | Nghề theo danh mục Home Credit; giá trị mới được encoder xử lý unknown |
| amount_unit | literal HOME_CREDIT_SOURCE | Không | Xác nhận thang tiền gốc; là thông tin hợp đồng, không đưa vào X |

Mọi khóa bắt buộc có mặt. Null rõ ràng chỉ ở các trường cho phép và được Pipeline
đã fit xử lý thiếu; phản hồi báo các trường imputed. Không đưa TARGET hoặc SK_ID_CURR
vào yêu cầu. Không dùng AMT_INCOME_TOTAL vì từ điển chưa xác định kỳ thu nhập; không
chuyển `monthly_income`, không tự tạo kỳ hạn, mục đích hoặc lịch sử trả nợ.
Không mặc định tiền tệ Home Credit là VND hoặc tự đặt tỷ giá.

Frontend `/home-credit` (menu Home Credit) có form mới và nút nạp hồ sơ Training mẫu.
Hồ sơ mô phỏng cũ trả 422 HOME_CREDIT_INPUT_REQUIRED khi gọi chấm điểm; các nút cũ
dẫn đến form bổ sung. Luồng Home Credit demo chưa ghi vào database lịch sử cũ vì
các cột default/repayment cũ có nghĩa khác. Không thay nhãn hoặc ghi đè lịch sử.

Phản hồi mới dùng `payment_difficulty_probability`: ước lượng sự kiện TARGET=1
(trễ hơn X ngày ở ít nhất một trong Y kỳ đầu; X/Y không được công bố). `1-p` chỉ
là các trường hợp còn lại, không phải bảo đảm trả nợ đầy đủ. Xác suất chưa hiệu chỉnh.
SHAP cho hợp đồng mới chưa triển khai: danh sách rỗng có ghi chú, không tạo giải
thích giả từ heuristic mô phỏng.

### Kiểm tra riêng ngưỡng phân nhóm cũ

Chỉ kiểm tra trên OOF của **Training**, trước Test:

| Ngưỡng cũ | Số dự đoán dương OOF | Precision OOF | Recall OOF |
|---|---:|---:|---:|
| 0.20 | 238119 | 0.082606 | 0.990433 |
| 0.45 | 125919 | 0.111429 | 0.706495 |

Các con số không đủ xác nhận ý nghĩa nghiệp vụ thấp/trung bình/cao hoặc hiệu chỉnh
xác suất của mô hình dùng trọng số lớp. Vì vậy hai ngưỡng cũ **không được dùng** cho
Home Credit: `risk_level=NOT_VALIDATED`, `risk_bands_validated=false`. Ngưỡng lớp 0.5
là quy tắc báo cáo độc lập; không tối ưu lại sau khi xem Test.

## Artifact và kiểm tra API

- [Pipeline + classifier](../ml-service/artifacts/versions/home-credit-v1-20261108/credit_pipeline.joblib):
  416724 byte, SHA256 `1bd857f7bb44edcc7e6e48280e22368cf702580d2c715df42659e9070b8de2d2`.
  Binary lưu cục bộ, Git bỏ qua; cần giữ/copy bản này khi triển khai hoặc tái lập bằng training.
- [Manifest đang hoạt động](../ml-service/artifacts/active_model.json) trỏ đến phiên bản trên.
- [sample_request.json](../ml-service/artifacts/versions/home-credit-v1-20261108/sample_request.json):
  một hồ sơ Training, không nhãn/ID. Số tiền 227520, annuity 13189.5, ngày sinh -12298,
  ngày bắt đầu việc -946, Cash loans, Laborers, xác nhận HOME_CREDIT_SOURCE.
- [activation_checks.json](../ml-service/artifacts/versions/home-credit-v1-20261108/activation_checks.json):
  reload thành công; hồ sơ hợp lệ **200**, thiếu trường **422**, gửi TARGET/ID **422**.
  Xác suất mẫu 0.6411752701, lớp 1 ở 0.5; đây là dự đoán minh họa trên Training,
  không phải chỉ số đánh giá mô hình.
- Backend đã được kiểm tra qua ML HTTP thật ở 127.0.0.1:18001: sample/predict **200**,
  request cũ/nhãn thừa **422**, chưa đăng nhập **401**, RISK_VIEWER dự đoán **403**;
  `/api/models/current` trả đúng phiên bản phục vụ.
- **27 kiểm thử ML qua**, **12 kiểm thử backend qua** (có live bridge), TypeScript
  `--noEmit` và Vite production build thành công. Không đánh giá lại Test thật trong tests.

Môi trường: Python 3.13.14, pandas 2.2.3, NumPy 2.2.1, scikit-learn 1.6.0,
XGBoost 2.1.4, joblib 1.4.2. Có OptimizeWarning `iprint` từ scikit-learn/SciPy trong
Logistic Regression, cảnh báo pytest-asyncio và cảnh báo kích thước bundle Vite;
không có kiểm thử hoặc build thất bại. Docker chưa được chạy vì máy không có lệnh Docker.
Frontend đã type-check/build; chưa thao tác kiểm thử giao diện bằng trình duyệt.

## PowerShell tái lập

Từ gốc repo, dùng môi trường hiện có hoặc tạo venv rồi cài requirements. Không dùng
lại tên phiên bản đã tồn tại. `--mode train` chạy toàn bộ quá trình thật; các bước
verify/API sau đó không chạy lại đánh giá Test.

```powershell
# Đã chạy train thật với version home-credit-v1-20261108.
# Dùng tên MỚI bên dưới nếu muốn tự tái lập:
$env:HOME_CREDIT_DATA_DIR = 'D:/HK1_nam_4/CT250H_nien_luan_chuyen_nganh/home-credit-default-risk'
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --mode train --version home-credit-v1-repro --report docs/home_credit_repro_results.json
Push-Location ml-service
& './.venv/Scripts/python.exe' -m training.activate --version home-credit-v1-repro
& './.venv/Scripts/python.exe' -m pytest -q
# Khởi động/restart worker sau activate để nạp manifest mới:
& './.venv/Scripts/python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8001
Pop-Location
```

Có thể thay biến thư mục bằng `--application-csv`/`--description-csv` hoặc các biến
môi trường từng tệp. `--artifact-root`/`ARTIFACT_DIR` cấu hình thư mục artifact của
training; activate hỗ trợ `--artifact-root`, serving dùng `ARTIFACT_DIR`. Các nơi này
phải cùng trỏ đến thư mục chứa manifest. Thiếu tệp báo lỗi, không fallback synthetic.

Kiểm tra HTTP cục bộ ở terminal khác sau khi ML Service chạy:

```powershell
$sample = Get-Content './ml-service/artifacts/versions/home-credit-v1-20261108/sample_request.json' -Raw
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8001/predict' -ContentType 'application/json' -Body $sample

Push-Location backend
$env:ML_INTEGRATION_URL = 'http://127.0.0.1:8001'
& '../ml-service/.venv/Scripts/python.exe' -m pytest -q
Remove-Item Env:ML_INTEGRATION_URL
Pop-Location

Push-Location frontend
npm.cmd ci --no-audit --no-fund
& './node_modules/.bin/tsc.cmd' --noEmit
npm.cmd run build
Pop-Location
```

## Danh sách tệp thay đổi / thêm

- Huấn luyện/kích hoạt: [train.py](../ml-service/training/train.py),
  [activate.py](../ml-service/training/activate.py).
- ML contract và phục vụ: [home_credit_features.py](../ml-service/app/home_credit_features.py),
  [schemas.py](../ml-service/app/schemas.py), [scoring.py](../ml-service/app/scoring.py),
  [main.py](../ml-service/app/main.py), [config.py](../ml-service/app/config.py),
  [feature_map.py](../ml-service/app/feature_map.py), [requirements.txt](../ml-service/requirements.txt).
- Kiểm thử ML: [test_final_model.py](../ml-service/tests/test_final_model.py),
  [test_training_cv.py](../ml-service/tests/test_training_cv.py),
  [test_home_credit.py](../ml-service/tests/test_home_credit.py),
  [test_generate_and_rules.py](../ml-service/tests/test_generate_and_rules.py).
- Backend: [main.py](../backend/app/main.py), [home_credit.py](../backend/app/routers/home_credit.py),
  [models.py](../backend/app/routers/models.py), [ml_client.py](../backend/app/services/ml_client.py),
  [seed.py](../backend/app/seed.py), [test_home_credit.py](../backend/tests/test_home_credit.py).
- Frontend: [HomeCreditPage.tsx](../frontend/src/pages/HomeCreditPage.tsx),
  [ModelsPage.tsx](../frontend/src/pages/ModelsPage.tsx), [App.tsx](../frontend/src/App.tsx),
  [types.ts](../frontend/src/types.ts), [client.ts](../frontend/src/api/client.ts),
  [Layout.tsx](../frontend/src/components/Layout.tsx),
  [Disclaimer.tsx](../frontend/src/components/Disclaimer.tsx),
  [LoanDetailPage.tsx](../frontend/src/pages/LoanDetailPage.tsx),
  [RiskAssessmentResultPage.tsx](../frontend/src/pages/RiskAssessmentResultPage.tsx).
- Cấu hình/tài liệu: [.gitignore](../.gitignore), [.env.example](../.env.example),
  [README.md](../README.md), [api.md](api.md), [architecture.md](architecture.md),
  [sequence.md](sequence.md), [bao-cao-nien-luan.md](bao-cao-nien-luan.md),
  [home_credit_preparation.md](home_credit_preparation.md),
  [home_credit_training_cv.md](home_credit_training_cv.md), bản bàn giao này,
  [home_credit_final_results.json](home_credit_final_results.json).
- Artifact mới: manifest, binary Pipeline, metadata, sample request, khóa lựa chọn,
  marker bắt đầu Test và báo cáo activation trong thư mục phiên bản đã liên kết ở trên.

Các file dữ liệu/metadata/audit lịch sử của Prompt 1–2 vẫn giữ nguyên nội dung;
package-lock frontend không đổi. Không sửa snapshot đính kèm chỉ đọc.
