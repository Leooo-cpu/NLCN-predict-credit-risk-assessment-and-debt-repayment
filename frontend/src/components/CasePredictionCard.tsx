import { useEffect, useRef } from "react";
import type { CasePrediction } from "../creditTypes";
import { pct } from "../utils/format";
import { creditLabel } from "../utils/creditLabels";
export function CasePredictionCard({
  prediction,
  revision,
  focusResult = false,
}: {
  prediction: CasePrediction;
  revision?: number;
  focusResult?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusResult) heading.current?.focus();
  }, [prediction.id, focusResult]);
  const stale = revision != null && prediction.input_revision !== revision;
  return (
    <section className="card space-y-5" aria-label="Kết quả dự đoán đã lưu">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 ref={heading} tabIndex={-1}>
          Kết quả đã lưu #{prediction.id}
        </h2>
        <span className="badge">
          Phiên bản đầu vào {prediction.input_revision}
        </span>
      </div>
      {stale && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        >
          Đầu vào đã thay đổi sau lần dự đoán này. Hãy dự đoán lại để có kết quả
          cho phiên bản hiện tại.
        </p>
      )}
      <div className="rounded-lg bg-brand-50 p-4 sm:p-5">
        <p className="text-sm font-medium text-brand-900">
          Rủi ro gặp khó khăn thanh toán
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-brand-700">
          {pct(prediction.payment_difficulty_probability)}
        </p>
        <p className="mt-3 text-sm text-brand-900">
          Lớp dự đoán ở ngưỡng {Number(prediction.classification_threshold)}:{" "}
          <strong>
            {prediction.predicted_payment_difficulty
              ? "1 — gặp khó khăn thanh toán"
              : "0 — các trường hợp còn lại"}
          </strong>
        </p>
      </div>
      <p className="text-sm text-muted">
        Không phải bảo đảm trả nợ hoặc xác suất vỡ nợ đã hiệu chỉnh. Nhóm
        thấp/trung bình/cao chưa được xác nhận.
      </p>
      <dl className="detail-grid">
        <div>
          <dt>Điểm hồ sơ minh họa</dt>
          <dd>{Number(prediction.credit_score).toFixed(2)} / 850</dd>
        </div>
        <div>
          <dt>Nguồn mô hình</dt>
          <dd>
            {prediction.data_source} · {prediction.algorithm} ·{" "}
            {prediction.model_version}
          </dd>
        </div>
        <div>
          <dt>Ngày dự đoán</dt>
          <dd>{new Date(prediction.created_at).toLocaleString("vi-VN")}</dd>
        </div>
        <div>
          <dt>Thông tin còn thiếu</dt>
          <dd>
            {prediction.response_json.imputed_features
              ?.map((key) => creditLabel(key))
              .join(", ") || "Không có"}
          </dd>
        </div>
      </dl>
      <details className="border-t border-line pt-4">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-brand-600">
          Xem thông tin đã dùng để dự đoán
        </summary>
        <dl className="detail-grid mt-4">
          {Object.entries(prediction.inputs_snapshot)
            .filter(([key]) => key !== "amount_unit")
            .map(([key, value]) => (
              <div key={key}>
                <dt>{creditLabel(key)}</dt>
                <dd>{value == null ? "Không rõ" : String(value)}</dd>
              </div>
            ))}
        </dl>
      </details>
    </section>
  );
}
