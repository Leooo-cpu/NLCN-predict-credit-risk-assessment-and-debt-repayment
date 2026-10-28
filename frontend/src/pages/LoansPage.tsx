import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { Pager } from "../components/Pager";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";
import type { LoanApplication, Paginated } from "../types";
import { money, riskClass, riskLabel } from "../utils/format";

export function LoansPage() {
  const [items, setItems] = useState<LoanApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = user?.role !== "RISK_VIEWER";

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await api.get<Paginated<LoanApplication>>("/api/loan-applications", {
        params: { page: p, page_size: 8, q: q || undefined, status: status || undefined },
      });
      setItems(res.data.items);
      setTotal(res.data.total);
      setPage(p);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onImport(file: File) {
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const res = await api.post("/api/loan-applications/import", form);
      toast.success(`Đã import ${res.data.created} hồ sơ`);
      load(1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Tìm theo tên khách hàng" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="SCORED">SCORED</option>
          <option value="REVIEWED">REVIEWED</option>
        </select>
        <button className="btn-primary" onClick={() => load(1)}>Lọc</button>
        {canWrite && (
          <>
            <Link className="btn-primary" to="/loans/new">Tạo hồ sơ</Link>
            <label className="btn-ghost cursor-pointer">
              {uploading ? "Đang import..." : "Import CSV"}
              <input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            </label>
          </>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Rủi ro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.id}</td>
                  <td>{loan.customer?.full_name || loan.customer_id}</td>
                  <td>{money(loan.requested_amount)}</td>
                  <td>{loan.status}</td>
                  <td>
                    <span className={`rounded px-2 py-1 text-xs ${riskClass(loan.latest_risk_level)}`}>
                      {riskLabel(loan.latest_risk_level)}
                    </span>
                  </td>
                  <td className="space-x-3 whitespace-nowrap">
                    <Link className="text-brand-600 hover:underline" to={`/loans/${loan.id}`}>Chi tiết</Link>
                    <Link className="text-emerald-600 hover:underline font-medium" to={`/loans/${loan.id}/result`}>Đánh giá & SHAP</Link>
                    {canWrite && <Link className="text-slate-600 hover:underline" to={`/loans/${loan.id}/edit`}>Sửa</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pageSize={8} total={total} onPage={load} />
        </>
      )}
    </div>
  );
}
