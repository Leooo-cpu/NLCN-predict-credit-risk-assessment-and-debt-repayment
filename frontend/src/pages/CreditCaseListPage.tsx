import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { Pager } from "../components/Pager";
import { Loading } from "../components/Loading";
import { pct } from "../utils/format";
import type { Paginated } from "../types";
import type { CreditCase } from "../creditTypes";

export function CreditCaseListPage({ mode = "customers" }: { mode?: "customers" | "loans" }) {
  const customers = mode === "customers";
  const [items, setItems] = useState<CreditCase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const { user } = useAuth();
  async function load(next = 1) {
    setLoading(true);
    try {
      const { data } = await api.get<Paginated<CreditCase>>("/api/credit-cases", { params: { page: next, page_size: 10, q: q || undefined, predicted: status || undefined } });
      setItems(data.items); setTotal(data.total); setPage(next);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  return <div className="space-y-4">
    <h2 className="text-2xl font-semibold">{customers ? "Khách hàng" : "Hồ sơ và dự đoán"}</h2>
    <p>{customers ? "Tra cứu thông tin khách hàng Home Credit đã ẩn danh. Dữ liệu nguồn không công bố họ tên thật." : "Theo dõi hồ sơ vay và kết quả dự đoán mới nhất. Lọc hồ sơ chưa được đánh giá hoặc cần đánh giá lại."}</p>
    <form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); load(); }}>
      <input className="input max-w-sm" placeholder="Tìm theo tên hoặc mã hồ sơ nguồn" value={q} onChange={event => setQ(event.target.value)} />
      {!customers && <select aria-label="Trạng thái dự đoán" className="input w-48" value={status} onChange={event => setStatus(event.target.value)}><option value="">Mọi trạng thái</option><option value="true">Đã có dự đoán</option><option value="false">Chưa dự đoán</option></select>}
      <button className="btn-primary">Tìm kiếm</button>
      {(user?.role === "ADMIN" || user?.role === "OFFICER") && <Link className="btn-ghost" to={customers ? "/customers/new" : "/risk-assessment"}>{customers ? "Thêm hồ sơ khách hàng" : "Đánh giá rủi ro"}</Link>}
    </form>
    <p>{total.toLocaleString("vi-VN")} hồ sơ phù hợp</p>
    {loading ? <Loading /> : <div className="card overflow-auto"><table className="table">
      <thead><tr><th>Khách hàng / hồ sơ</th><th>Số tiền (thang HC)</th><th>Loại hợp đồng</th><th>{customers ? "Nghề nghiệp" : "Kết quả mới nhất"}</th><th>Thao tác</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td><Link className="text-brand-600 font-medium" to={`/${customers ? "customers" : "loans"}/${item.id}`}>{item.display_name}</Link><div className="text-xs text-slate-500">Mã hồ sơ: {item.source_application_id ?? item.id}</div></td>
        <td>{Number(item.inputs_json.AMT_CREDIT).toLocaleString("vi-VN")}</td><td>{item.inputs_json.NAME_CONTRACT_TYPE}</td>
        <td>{customers ? item.inputs_json.OCCUPATION_TYPE ?? "Không rõ" : item.latest_prediction ? <><strong>{pct(item.latest_prediction.payment_difficulty_probability)}</strong> khó khăn thanh toán{item.latest_prediction.input_revision !== item.input_revision && <div className="text-amber-700">Thông tin đã thay đổi — cần dự đoán lại</div>}</> : "Chưa dự đoán"}</td>
        <td><Link className="text-brand-600 underline" to={`/${customers ? "customers" : "loans"}/${item.id}`}>{customers ? "Xem thông tin" : "Xem kết quả"}</Link>{!customers && (user?.role === "ADMIN" || user?.role === "OFFICER") && <Link className="block text-brand-600 underline" to={`/risk-assessment/${item.id}`}>Đánh giá hồ sơ</Link>}</td>
      </tr>)}{!items.length && <tr><td colSpan={5}>Chưa có hồ sơ. Cần nạp application_train.csv bằng lệnh import Home Credit.</td></tr>}</tbody>
    </table><Pager page={page} pageSize={10} total={total} onPage={load} /></div>}
  </div>;
}
