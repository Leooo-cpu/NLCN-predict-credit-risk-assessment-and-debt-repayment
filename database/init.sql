-- Schema PostgreSQL - Hệ thống hỗ trợ đánh giá rủi ro tín dụng
-- Dữ liệu demo là dữ liệu mô phỏng

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('ADMIN', 'CREDIT_OFFICER', 'RISK_VIEWER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    age INTEGER,
    occupation VARCHAR(128) NOT NULL,
    monthly_income NUMERIC(14, 2) NOT NULL,
    years_employed NUMERIC(6, 1) NOT NULL DEFAULT 0,
    credit_history VARCHAR(32) NOT NULL CHECK (credit_history IN ('GOOD', 'FAIR', 'POOR')),
    late_payments INTEGER NOT NULL DEFAULT 0,
    current_debt NUMERIC(14, 2) NOT NULL DEFAULT 0,
    existing_loans INTEGER NOT NULL DEFAULT 0,
    phone VARCHAR(32),
    email VARCHAR(255),
    address VARCHAR(512),
    notes VARCHAR(1024),
    is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_applications (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    requested_amount NUMERIC(14, 2) NOT NULL,
    term_months INTEGER NOT NULL,
    purpose VARCHAR(64) NOT NULL,
    monthly_income NUMERIC(14, 2) NOT NULL,
    years_employed NUMERIC(6, 1) NOT NULL DEFAULT 0,
    current_debt NUMERIC(14, 2) NOT NULL DEFAULT 0,
    existing_loans INTEGER NOT NULL DEFAULT 0,
    dti NUMERIC(8, 4),
    credit_history VARCHAR(32) NOT NULL CHECK (credit_history IN ('GOOD', 'FAIR', 'POOR')),
    late_payments INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'SCORED', 'REVIEWED')),
    notes VARCHAR(1024),
    is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_registry (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(128) NOT NULL,
    version VARCHAR(64) NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    training_dataset VARCHAR(255) NOT NULL,
    metrics_json JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'TRAINING'
        CHECK (status IN ('TRAINING', 'VALIDATED', 'ACTIVE', 'ARCHIVED')),
    artifact_path VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (model_name, version)
);

CREATE TABLE IF NOT EXISTS model_predictions (
    id SERIAL PRIMARY KEY,
    loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    model_registry_id INTEGER REFERENCES model_registry(id),
    model_version VARCHAR(64) NOT NULL,
    default_probability NUMERIC(10, 6) NOT NULL,
    repayment_probability NUMERIC(10, 6) NOT NULL,
    credit_score NUMERIC(8, 2) NOT NULL,
    risk_level VARCHAR(32) NOT NULL CHECK (risk_level IN ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK')),
    explanation_json JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id INTEGER,
    details_json JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers (created_at);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (full_name);

CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON loan_applications (customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loan_applications (status);
CREATE INDEX IF NOT EXISTS idx_loans_created_at ON loan_applications (created_at);

CREATE INDEX IF NOT EXISTS idx_pred_loan_id ON model_predictions (loan_application_id);
CREATE INDEX IF NOT EXISTS idx_pred_risk_level ON model_predictions (risk_level);
CREATE INDEX IF NOT EXISTS idx_pred_created_at ON model_predictions (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_registry_status ON model_registry (status);
