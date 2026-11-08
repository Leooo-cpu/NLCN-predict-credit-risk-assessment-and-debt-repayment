import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { Pager } from "../components/Pager";
import { CasePredictionCard } from "../components/CasePredictionCard";
import { pct } from "../utils/format";
import type { CasePrediction } from "../creditTypes";
import type { Paginated } from "../types";

export function CreditCaseHistoryPage() {
  const [items, setItems] = useState<CasePrediction[]>([]);
  const [selected, setSelected] = useState<CasePrediction | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  async function load(next = 1) {
    try { const { data } = await api.get<Paginated<CasePrediction>>("/api/credit-cases/predictions", { params: { page: next, q: q || undefined } }); setItems(data.items); setTotal(data.total); setPage(next); setError(""); }
    catch (err) { setError(errorMessage(err)); }
  }
  useEffect(() => { load(); }, []);
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Lịch sử dự đoán theo khách hàng</h2>
    <form className="flex gap-3" onSubmit={event => { event.preventDefault(); load(); }}><input className="input max-w-sm" placeholder="Tìm tên / mã hồ sơ" value={q} onChange={event => setQ(event.target.value)} /><button className="btn-primary">Tìm kiếm</button></form>
    {error && <p role="alert">{error}</p>}
    <div className="card overflow-auto"><table className="table"><thead><tr><th>Khách hàng / hồ sơ</th><th>Thời gian</th><th>Khó khăn thanh toán</th><th>Mô hình</th><th>Thao tác</th></tr></thead><tbody>
      {items.map(item => <tr key={item.id}><td><Link to={`/customers/${item.case_id}`} className="text-brand-600 underline">{item.display_name}</Link></td><td>{new Date(item.created_at).toLocaleString("vi-VN")}</td><td>{pct(item.payment_difficulty_probability)}</td><td>{item.model_version}</td><td><button className="text-brand-600 underline" onClick={() => setSelected(item)}>Xem kết quả</button></td></tr>)}
      {!items.length && <tr><td colSpan={5}>Chưa có dự đoán đã lưu. Mở hồ sơ khách hàng để thực hiện dự đoán.</td></tr>}</tbody></table><Pager page={page} pageSize={10} total={total} onPage={load} /></div>
    {selected && <CasePredictionCard prediction={selected} />}
  </div>;
}
