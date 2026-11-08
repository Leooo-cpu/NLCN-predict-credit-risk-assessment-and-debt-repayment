# Prompt 2: so sánh mô hình bằng CV trên Training

## Luồng được cài đặt

Trong [train.py](../ml-service/training/train.py):

1. `split_training_test`: chia **một lần** các dòng có nhãn từ
   `application_train.csv` thành Training 80% / Test nội bộ 20%, phân tầng `TARGET`,
   `random_state=42`. `SK_ID_CURR` chỉ theo dõi phân chia; X dùng hợp đồng 6 thuộc
   tính của Prompt 1. Không đọc hay dùng `application_test.csv` của Kaggle.
2. `compare_on_training`: chỉ nhận `TrainingData`, từ chối kiểu `HeldOutTest`.
   Tạo `StratifiedKFold(5, shuffle=True, random_state=42)` rồi materialize các chỉ số
   một lần để cả Logistic Regression, Random Forest và XGBoost dùng cùng phân chia.
   Mỗi mô hình/fold tạo mới toàn bộ Pipeline và classifier; fit preprocessor chỉ trên
   4 fold, transform/predict fold validation. XGBoost nhận tỷ số số nhãn 0 / số nhãn 1
   từ chính 4 fold fit, không dùng toàn bộ Training hoặc nhãn Test.
3. `refit_selected_on_training`: hàm riêng, nhận tên mô hình đã chọn từ bên ngoài,
   tạo Pipeline mới và fit toàn bộ Training. XGBoost khi refit tính lại trọng số từ
   toàn bộ Training. Hàm này không nhận Test, không xuất artifact.
4. `evaluate_on_test`: hàm riêng, chỉ gọi sau khi hoàn tất lựa chọn/refit. Chỉ
   transform/predict và tính AP/ROC-AUC; không fit, tune hoặc chọn ngưỡng. Kiểm tra
   ID Test không trùng ID Training đã refit. CLI hiện không gọi hàm này.

CV ghi từng fold: AP, ROC-AUC, số dòng fit/validation, số nhãn trong phần fit,
`scale_pos_weight` (XGBoost) và SHA256 của các ID trong hai phần. Mỗi mô hình có
`ap_mean`, `ap_std`, `roc_auc_mean`, `roc_auc_std`; std dùng **ddof=0**, trên 5 giá trị.
AP được tính bằng `average_precision_score`, không phải diện tích PR nội suy hình thang.

`selection_inputs` chứa các thống kê CV để Prompt 3 dùng; `selection_score=null`,
`selected_model=null`, `selection_policy=pending_prompt_3`. Chưa áp dụng công thức
chọn chính thức hoặc tự tuyên bố mô hình thắng. Không tính công thức cũ trên Test.
Thuộc tính, tiền xử lý và hyperparameter được cố định trong mã trước đánh giá.

## Các chế độ CLI

- `--mode prepare` (mặc định): giữ chức năng kiểm tra CSV ở Prompt 1. Bây giờ tách
  80/20 trước; mẫu thử preprocessor chỉ lấy từ Training. Audit dữ liệu nguồn không
  phải chỉ số đánh giá Test. Không chạy classifier.
- `--mode cv`: đọc CSV thật, tách 80/20, chỉ chạy 15 lượt CV trên toàn bộ Training.
  Không refit mô hình thắng, không tính chỉ số Test, không ghi model đang phục vụ.
  `--sample-size` không giảm số dòng Training của chế độ này.
- `--mode cv-smoke`: chỉ dùng fixture nhân tạo, không đọc CSV hay fallback khi CSV
  lỗi. Random Forest/XGBoost dùng 8 cây và độ sâu nhỏ để kiểm tra luồng. Báo cáo
  mang nhãn `artificial_home_credit_contract_fixture_NOT_REAL_CSV`.

`train_and_export` vẫn bị chặn để tránh tự huấn luyện/ghi đè mô hình phục vụ.
Các kết quả audit, metadata và dữ liệu mô phỏng cũ không bị thay nhãn nguồn.

## Những kiểm tra thực sự đã chạy

**Tất cả kiểm tra Prompt 2 dùng dữ liệu nhỏ nhân tạo. Không mở CSV thật, không tính
chỉ số của 20% Test Home Credit và không chạy CV thật trong bước này.**

[Báo cáo CV smoke](home_credit_cv_smoke.json): 150 dòng nhân tạo → 120 Training /
30 Test giả. Trong Training, mỗi fold có 96 fit / 24 validation, tổng cộng 15 lượt fit.

| Mô hình | Fold | AP mean ± std | ROC-AUC mean ± std |
|---|---:|---:|---:|
| Logistic Regression | 5 | 0.303297 ± 0.058946 | 0.432500 ± 0.049379 |
| Random Forest | 5 | 0.332257 ± 0.118326 | 0.537500 ± 0.097902 |
| XGBoost | 5 | 0.237852 ± 0.023207 | 0.473158 ± 0.072555 |

Các con số này chỉ chứng minh luồng hoạt động, không dùng để chọn mô hình thật.
Trong fixture, trọng số XGBoost là 3.8 ở fold 1 và 77/19 ở fold 2–5; mã tính từ
nhãn fit mỗi fold, không dùng tỷ số 96/24=4 của toàn bộ Training.

[test_training_cv.py](../ml-service/tests/test_training_cv.py) có 8 kiểm thử mới:

- Split được gọi đúng một lần, tỷ lệ/phân tầng/seed đúng, ID Training/Test rời nhau
  và chia lại cho cùng kết quả.
- Mỗi mô hình có đủ 5 fold, dùng cùng fingerprint; mỗi dòng Training xuất hiện đúng
  một lần trong validation và không có ID Test trong fit/validation.
- 15 Pipeline/preprocessor/classifier là các object khác nhau; median và số mẫu
  scaler đúng phần fit 96 dòng; XGBoost nhận đúng trọng số fold.
- Mean/std khớp các metric fold; chưa có score hoặc mô hình thắng.
- Từ chối truyền Test vào compare/refit.
- Đảo nhãn, đổi số tiền thành cực lớn và thêm danh mục chỉ có trong Test vẫn giữ
  nguyên kết quả CV khi chạy lại trên cùng Training.
- Thử riêng refit + evaluate trên fixture mới: chọn cố định Logistic Regression
  để kiểm tra hàm, fit 120 Training, đánh giá 30 Test giả, không gọi fit trong evaluate;
  từ chối ID chồng lấn. Đây không phải áp dụng tiêu chí chọn mô hình chính thức.
- Hai đường CLI được kiểm tra bằng chặn các hàm đọc CSV/evaluate/refit/export:
  smoke không đọc CSV; nhánh `cv` dùng loader giả 150 dòng chỉ chuyển Training cho
  compare. Không có nhánh nào gọi evaluate hoặc export.

Toàn bộ kiểm thử ML: **23 passed**, gồm 15 kiểm thử cũ và 8 kiểm thử mới.
Môi trường kiểm tra dùng XGBoost 2.1.4 theo dependency hiện có. Có cảnh báo
`OptimizeWarning: Unknown solver options: iprint` từ scikit-learn 1.6.0 với SciPy
1.18.1 trong môi trường kiểm tra; không có kiểm thử thất bại và không tắt cảnh báo.

## Lệnh PowerShell đã kiểm tra

Chạy từ gốc repo:

```powershell
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --mode cv-smoke --sample-size 150 --report docs/home_credit_cv_smoke.json
Push-Location ml-service
& './.venv/Scripts/python.exe' -m pytest -q
Pop-Location
```

Lệnh cho CV thật đã được hỗ trợ nhưng **chưa chạy**:

```powershell
& './ml-service/.venv/Scripts/python.exe' ml-service/training/train.py --mode cv --application-csv '../home-credit-default-risk/application_train.csv' --description-csv '../home-credit-default-risk/HomeCredit_columns_description.csv' --report docs/home_credit_training_cv_results.json
```

Lệnh CV thật chỉ so sánh trên Training; việc áp dụng tiêu chí chọn chính thức và
quyết định mở kết quả Test được để cho bước tiếp theo. Không có cờ CLI đánh giá Test
hay xuất model ở Prompt 2.
