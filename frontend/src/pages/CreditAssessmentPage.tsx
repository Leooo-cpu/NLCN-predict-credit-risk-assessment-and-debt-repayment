import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import type { CreditCase } from "../creditTypes";
import type { Paginated } from "../types";
import { CreditCaseCreatePage } from "./CreditCaseDetailPage";

export function CreditAssessmentPage() {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CreditCase[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="space-y-4">
    <h2 className="text-2xl font-semibold">Đánh giá rủi ro</h2>
    <p>Chọn hồ sơ có sẵn hoặc nhập hồ sơ mới để dự đoán rủi ro gặp khó khăn thanh toán.</p>
    <div className="flex gap-3">
      <button className={tab === "existing" ? "btn-primary" : "btn-ghost"} aria-pressed={tab === "existing"} onClick={() => setTab("existing")}>Chọn hồ sơ có sẵn</button>
      <button className={tab === "new" ? "btn-primary" : "btn-ghost"} aria-pressed={tab === "new"} onClick={() => setTab("new")}>Nhập hồ sơ mới</button>
    </div>
    {tab === "new" ? <CreditCaseCreatePage /> : <section className="card space-y-4">
      <form className="flex flex-wrap gap-3" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError("");
        try {
          const { data } = await api.get<Paginated<CreditCase>>("/api/credit-cases", { params: { q: query.trim(), page: 1, page_size: 10 } });
          setItems(data.items); setSearched(true);
        } catch (err) { setError(errorMessage(err)); }
        finally { setBusy(false); }
      }}>
        <label className="flex-1">Tên hoặc mã hồ sơ<input className="input mt-1" required value={query} onChange={event => { setQuery(event.target.value); setSearched(false); setItems([]); }} /></label>
        <button className="btn-primary self-end" disabled={busy}>{busy ? "Đang tìm…" : "Tìm hồ sơ"}</button>
      </form>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {items.map(item => <div key={item.id} className="flex justify-between gap-4 border-b py-3"><span>{item.display_name}</span><Link className="text-brand-600 underline" to={`/risk-assessment/${item.id}`}>Chọn và đánh giá</Link></div>)}
      {searched && !items.length && <p>Không tìm thấy hồ sơ phù hợp.</p>}
      <p className="text-sm text-slate-500">Hiển thị tối đa 10 kết quả. Nhập mã hồ sơ để tìm chính xác hơn.</p>
    </section>}
  </div>;
}
