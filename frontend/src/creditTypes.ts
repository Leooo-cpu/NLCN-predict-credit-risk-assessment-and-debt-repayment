export type CreditInputs = Record<string, string | number | null>;

export interface CasePrediction {
  id: number;
  case_id: number;
  input_revision: number;
  inputs_snapshot: CreditInputs;
  model_version: string;
  algorithm: string;
  data_source: string;
  payment_difficulty_probability: number;
  predicted_payment_difficulty: boolean;
  classification_threshold: number;
  risk_level: string;
  credit_score: number;
  created_at: string;
  response_json: { imputed_features: string[]; disclaimer: string; explanation_note: string };
  display_name?: string;
  source_application_id?: number;
}

export interface CreditCase {
  id: number;
  source_application_id: number | null;
  display_name: string;
  source: string;
  inputs_json: CreditInputs;
  input_revision: number;
  reference_target: number | null;
  created_at: string;
  updated_at: string;
  latest_prediction: CasePrediction | null;
}
