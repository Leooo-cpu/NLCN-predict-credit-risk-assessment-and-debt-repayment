export type Role = "ADMIN" | "CREDIT_OFFICER" | "RISK_VIEWER";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Customer {
  id: number;
  full_name: string;
  date_of_birth?: string | null;
  age?: number | null;
  occupation: string;
  monthly_income: number;
  years_employed: number;
  credit_history: string;
  late_payments: number;
  current_debt: number;
  existing_loans: number;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanApplication {
  id: number;
  customer_id: number;
  requested_amount: number;
  term_months: number;
  purpose: string;
  monthly_income: number;
  years_employed: number;
  current_debt: number;
  existing_loans: number;
  dti?: number | null;
  credit_history: string;
  late_payments: number;
  status: string;
  notes?: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
  customer?: Customer | null;
  latest_risk_level?: string | null;
  latest_credit_score?: number | null;
  latest_default_probability?: number | null;
}

export interface ShapFactor {
  feature_name: string;
  feature_value: number | string | null;
  shap_value: number;
  impact: "INCREASE_RISK" | "DECREASE_RISK";
  description: string;
}

export interface Prediction {
  id: number;
  loan_application_id: number;
  model_version: string;
  default_probability: number;
  repayment_probability: number;
  credit_score: number;
  risk_level: string;
  explanation_json: {
    shap_explanation?: ShapFactor[];
  };
  created_at: string;
  shap_explanation?: ShapFactor[];
  disclaimer?: string;
}

export interface PredictionWithLoan extends Prediction {
  customer_name?: string | null;
  customer_id?: number | null;
  requested_amount?: number | null;
  term_months?: number | null;
  purpose?: string | null;
}

export interface DashboardSummary {
  total_applications: number;
  total_customers: number;
  risk_counts: { risk_level: string; count: number }[];
  status_counts: { status: string; count: number }[];
  applications_over_time: { date: string; count: number }[];
  credit_score_distribution: { bucket: string; count: number }[];
  recent_high_risk: {
    loan_application_id: number;
    customer_name: string;
    requested_amount: number;
    risk_level: string;
    credit_score: number;
    default_probability: number;
    created_at: string;
  }[];
  disclaimer: string;
  data_note: string;
}

export interface ModelInfo {
  id: number;
  model_name: string;
  version: string;
  algorithm: string;
  training_dataset: string;
  metrics_json?: Record<string, unknown> | null;
  status: string;
  created_at: string;
  credit_score_formula?: string;
}
