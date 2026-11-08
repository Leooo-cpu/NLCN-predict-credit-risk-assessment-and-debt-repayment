import type { CasePrediction } from "../creditTypes";
import { pct } from "../utils/format";
import { creditLabel } from "../utils/creditLabels";

export function CasePredictionCard({ prediction, revision }: { prediction: CasePrediction; revision?: number }) {
  const stale = revision != null && prediction.input_revision !== revision;
  return <section className="card space-y-2" aria-label="Kết quả dự đoán đã lưu">
    <h3 className="font-semibold">Kết quả đã lưu #{prediction.id}</h3>
    {stale && <p className="text-amber-800">Đầu vào đã thay đổi sau lần dự đoán này. Hãy dự đoán lại để có kết quả cho phiên bản hiện tại.</p>}
    <p className="text-2xl font-semibold">Rủi ro gặp khó khăn thanh toán: {pct(prediction.payment_difficulty_probability)}</p>
    <p>Lớp dự đoán ở ngưỡng {Number(prediction.classification_threshold)}: <strong>{prediction.predicted_payment_difficulty ? "1 — gặp khó khăn thanh toán" : "0 — các trường hợp còn lại"}</strong></p>
    <p>Không phải bảo đảm trả nợ hoặc xác suất vỡ nợ đã hiệu chỉnh. Nhóm thấp/trung bình/cao chưa được xác nhận.</p>
    <p>Điểm hồ sơ minh họa: {Number(prediction.credit_score).toFixed(2)} / 850.</p>
    <p>Nguồn mô hình: {prediction.data_source} · {prediction.algorithm} · {prediction.model_version}</p>
    <p>Ngày dự đoán: {new Date(prediction.created_at).toLocaleString("vi-VN")} · Phiên bản đầu vào {prediction.input_revision}</p>
    <p>Thông tin còn thiếu: {prediction.response_json.imputed_features?.map(key => creditLabel(key)).join(", ") || "Không có"}</p>
    <details><summary className="cursor-pointer">Xem thông tin đã dùng để dự đoán</summary>
      <dl className="mt-2 space-y-1">{Object.entries(prediction.inputs_snapshot).filter(([key]) => key !== "amount_unit").map(([key, value]) =>
        <div key={key}><dt className="inline font-medium">{creditLabel(key)}: </dt><dd className="inline">{value == null ? "Không rõ" : String(value)}</dd></div>
      )}</dl>
    </details>
  </section>;
}
