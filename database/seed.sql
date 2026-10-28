-- Seed PostgreSQL (chạy khi volume trống).
-- Tài khoản người dùng được backend hash bcrypt khi khởi động (SEED_ON_STARTUP).
-- File này ghi nhận mô hình mặc định; khách hàng/hồ sơ được backend seed để thống nhất mật khẩu.
-- DỮ LIỆU MÔ PHỎNG — không phải dữ liệu khách hàng thật.

INSERT INTO model_registry (
    model_name, version, algorithm, training_dataset, metrics_json, status, artifact_path
)
SELECT
    'credit_default_pipeline',
    '1.0.0-sim',
    'XGBoost',
    'Dữ liệu mô phỏng nội bộ (synthetic_credit_risk)',
    '{"note": "Metrics được cập nhật sau khi ML Service huấn luyện", "dataset": "simulated"}'::jsonb,
    'ACTIVE',
    '/app/artifacts/credit_pipeline.joblib'
WHERE NOT EXISTS (
    SELECT 1 FROM model_registry WHERE model_name = 'credit_default_pipeline' AND version = '1.0.0-sim'
);
