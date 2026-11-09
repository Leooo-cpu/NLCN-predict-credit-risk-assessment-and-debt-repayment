import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import type { HomeCreditContract, HomeCreditPrediction } from "../types";

export function HomeCreditPage() {
  const [contract, setContract] = useState<HomeCreditContract | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [unknown, setUnknown] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<HomeCreditPrediction | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get<HomeCreditContract>("/api/home-credit/input-schema").then(res => setContract(res.data)).catch(err => toast.error(errorMessage(err)));
  }, [toast]);

  async function loadSample() {
    try {
      const { data } = await api.get<Record<string, string | number | null>>("/api/home-credit/sample");
      const entries = Object.entries(data).filter(([name]) => name !== "amount_unit");
      setValues(Object.fromEntries(entries.map(([name, value]) => [name, value == null ? "" : String(value)])));
      setUnknown(Object.fromEntries(entries.map(([name, value]) => [name, value == null])));
      setConfirmed(true); setResult(null);
    } catch (err) { toast.error(errorMessage(err)); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!contract || !confirmed) return;
    const payload: Record<string, string | number | null> = { amount_unit: contract.amount_unit };
    for (const [name, spec] of Object.entries(contract.features)) {
      if (spec.nullable && unknown[name]) payload[name] = null;
      else {
        if (!values[name]?.trim()) { toast.error(`Cần bổ sung ${spec.label}`); return; }
        payload[name] = spec.kind === "string" ? values[name] : Number(values[name]);
      }
    }
    setBusy(true); setResult(null);
    try { setResult((await api.post<HomeCreditPrediction>("/api/home-credit/predict", payload)).data); }
    catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <h2 className="text-2xl font-semibold">Home Credit — khó khăn thanh toán</h2>
    <p>Nhập hồ sơ theo định nghĩa Home Credit. Không tự chuyển dữ liệu vay mô phỏng, thu nhập tháng hoặc lịch sử trả nợ sang các trường này. Luồng demo này không ghi vào lịch sử hồ sơ mô phỏng cũ.</p>
    <button className="btn-ghost" onClick={loadSample}>Nạp một hồ sơ mẫu từ Training</button>
    {!contract ? <p>Đang tải hợp đồng đầu vào từ dịch vụ mô hình…</p> : <form onSubmit={submit} className="card space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(contract.features).map(([name, spec]) => <div key={name} className="space-y-1">
          <label className="block font-medium" htmlFor={name}>{spec.label} ({name})</label>
          <p className="text-xs text-slate-500">{spec.unit}</p>
          {spec.choices ? <select id={name} className="input w-full" disabled={unknown[name]} required={!unknown[name]} value={values[name] || ""} onChange={e => { setValues({ ...values, [name]: e.target.value }); setResult(null); }}>
            <option value="">Chọn giá trị thực tế</option>{spec.choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
          </select> : <input id={name} className="input w-full" type={spec.kind === "string" ? "text" : "number"} step={spec.kind === "integer" ? "1" : "any"} required={!unknown[name]} disabled={unknown[name]} value={values[name] || ""} onChange={e => { setValues({ ...values, [name]: e.target.value }); setResult(null); }} />}
          {spec.nullable && <label className="block text-sm"><input type="checkbox" checked={!!unknown[name]} onChange={e => { setUnknown({ ...unknown, [name]: e.target.checked }); setResult(null); }} /> Không biết — dùng xử lý thiếu đã học từ Training</label>}
        </div>)}
      </div>
      <label className="block text-sm"><input type="checkbox" required checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setResult(null); }} /> Xác nhận số tiền ở thang Home Credit gốc; không mặc định là VND. Không có tỷ giá hoặc kỳ thu nhập để tự quy đổi.</label>
      <button className="btn-primary" disabled={busy || !confirmed}>{busy ? "Đang dự đoán…" : "Ước lượng khó khăn thanh toán"}</button>
    </form>}
    {result && <div className="card space-y-2" aria-live="polite">
      <p className="text-xl font-medium">Ước lượng TARGET=1: {(100 * result.payment_difficulty_probability).toFixed(2)}%</p>
      <p>Lớp dự đoán ở ngưỡng {result.classification_threshold}: {result.predicted_payment_difficulty ? "Gặp khó khăn thanh toán" : "Các trường hợp còn lại"}.</p>
      <p>TARGET=1: trễ hơn X ngày ở ít nhất một trong Y kỳ trả đầu tiên (Home Credit không công bố X/Y). Xác suất chưa được hiệu chỉnh.</p>
      <p>Chưa gán nhóm thấp/trung bình/cao vì ngưỡng cũ chưa được xác nhận cho mô hình này.</p>
      <p>Điểm hồ sơ minh họa: {result.credit_score.toFixed(2)} — không phải điểm dùng để chọn thuật toán.</p>
      <p>Nguồn: {result.data_source} · {result.algorithm} · {result.model_version}</p>
      <p>Trường được xử lý thiếu: {result.imputed_features.join(", ") || "Không có"}</p>
      <p>{result.disclaimer}</p>
    </div>}
  </div>;
}
