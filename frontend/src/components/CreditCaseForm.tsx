import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { useToast } from "./Toast";
import type { HomeCreditContract } from "../types";
import type { CreditCase, CreditInputs, CasePrediction } from "../creditTypes";
import { creditHints, creditLabel } from "../utils/creditLabels";

export function CreditCaseForm({ record, onSaved, onPredicted }: {
  record?: CreditCase; onSaved: (record: CreditCase) => void; onPredicted?: (result: CasePrediction) => void;
}) {
  const [contract, setContract] = useState<HomeCreditContract | null>(null);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [unknown, setUnknown] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get<HomeCreditContract>("/api/home-credit/input-schema").then(res => setContract(res.data)).catch(err => setError(errorMessage(err)));
  }, []);
  useEffect(() => {
    const entries = Object.entries(record?.inputs_json || {}).filter(([key]) => key !== "amount_unit");
    setValues(Object.fromEntries(entries.map(([key, value]) => [key, value == null ? "" : String(value)])));
    setUnknown(Object.fromEntries(entries.map(([key, value]) => [key, value == null])));
    setConfirmed(record?.inputs_json.amount_unit === "HOME_CREDIT_SOURCE");
  }, [record?.inputs_json, record?.input_revision]);

  async function submit(event: FormEvent, score: boolean) {
    event.preventDefault();
    if (!contract || !confirmed || busy) return;
    const inputs: CreditInputs = { amount_unit: contract.amount_unit };
    for (const [key, spec] of Object.entries(contract.features)) {
      if (unknown[key] && spec.nullable) inputs[key] = null;
      else {
        if (!values[key]?.trim()) { setError(`Cần bổ sung ${creditLabel(key, spec.label)}`); return; }
        inputs[key] = spec.kind === "string" ? values[key] : Number(values[key]);
      }
    }
    setBusy(true); setError("");
    try {
      const saved = record
        ? (await api.put<CreditCase>(`/api/credit-cases/${record.id}/inputs`, { inputs, expected_revision: record.input_revision })).data
        : (await api.post<CreditCase>("/api/credit-cases", { inputs, display_name: name })).data;
      onSaved(saved);
      if (score) {
        const result = (await api.post<CasePrediction>(`/api/credit-cases/${saved.id}/score`, { expected_revision: saved.input_revision })).data;
        onPredicted?.(result);
        toast.success("Đã lưu dự đoán vào lịch sử của hồ sơ này");
      } else toast.success("Đã lưu đầu vào của hồ sơ");
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  if (!contract) return <p role={error ? "alert" : undefined}>{error || "Đang tải định nghĩa đầu vào…"}</p>;
  return <form className="card space-y-4" onSubmit={event => submit(event, true)}>
    <h3 className="font-semibold">{record ? "Chỉnh sửa thông tin và dự đoán" : "Tạo hồ sơ khách hàng và dự đoán"}</h3>
    {!record && <label className="block">Tên hoặc mã khách hàng<input className="input mt-1" required maxLength={255} value={name} onChange={event => setName(event.target.value)} /></label>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(contract.features).map(([key, spec]) => <div key={key}>
        <label className="block font-medium" htmlFor={key}>{creditLabel(key, spec.label)}</label>
        {creditHints[key] && <p className="text-xs text-slate-500">{creditHints[key]}</p>}
        {spec.choices ? <select className="input w-full mt-1" id={key} required={!unknown[key]} disabled={busy || !!unknown[key]} value={values[key] || ""} onChange={event => setValues({ ...values, [key]: event.target.value })}>
          <option value="">Chọn thông tin thực tế</option>
          {values[key] && !spec.choices.includes(values[key]) && <option value={values[key]}>{values[key]} (giá trị nguồn)</option>}
          {spec.choices.map(value => <option key={value}>{value}</option>)}
        </select> : <input className="input mt-1" id={key} type={spec.kind === "string" ? "text" : "number"} step={spec.kind === "integer" ? "1" : "any"} required={!unknown[key]} disabled={busy || !!unknown[key]} value={values[key] || ""} onChange={event => setValues({ ...values, [key]: event.target.value })} />}
        {spec.nullable && <label className="block text-sm mt-1"><input type="checkbox" disabled={busy} checked={!!unknown[key]} onChange={event => setUnknown({ ...unknown, [key]: event.target.checked })} /> Không rõ</label>}
      </div>)}
    </div>
    <label className="block text-sm"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Tôi xác nhận số tiền dùng đơn vị của hồ sơ Home Credit gốc, không mặc định là đồng Việt Nam.</label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="flex gap-3">
      <button className="btn-primary" disabled={busy || !confirmed}>{busy ? "Đang xử lý…" : "Dự đoán và lưu kết quả"}</button>
      {record && <button type="button" className="btn-ghost" disabled={busy || !confirmed} onClick={event => { if (event.currentTarget.form?.reportValidity()) submit(event, false); }}>Chỉ lưu thông tin</button>}
    </div>
    <p className="text-xs text-slate-500">Thông tin và kết quả của mỗi lần dự đoán được lưu trong lịch sử hồ sơ.</p>
  </form>;
}
