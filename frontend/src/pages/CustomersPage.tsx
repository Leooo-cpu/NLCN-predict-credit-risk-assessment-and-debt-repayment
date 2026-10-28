import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { Pager } from "../components/Pager";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";
import type { Customer, Paginated } from "../types";
import { CREDIT_OPTIONS, money } from "../utils/format";

const emptyForm = {
  full_name: "",
  age: 30,
  occupation: "",
  monthly_income: 15000000,
  years_employed: 3,
  credit_history: "FAIR",
  late_payments: 0,
  current_debt: 0,
  existing_loans: 0,
  phone: "",
};

export function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<number | null>(null);
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = user?.role !== "RISK_VIEWER";

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await api.get<Paginated<Customer>>("/api/customers", {
        params: { page: p, page_size: 8, q: q || undefined, credit_history: history || undefined },
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/api/customers/${editing}`, form);
        toast.success("Đã cập nhật khách hàng");
      } else {
        await api.post("/api/customers", form);
        toast.success("Đã tạo khách hàng");
      }
      setForm(emptyForm);
      setEditing(null);
      load(1);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="grid grid-cols-[1.4fr_1fr] gap-4">
      <div className="card">
        <div className="mb-4 flex gap-2">
          <input className="input" placeholder="Tìm theo họ tên" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-40" value={history} onChange={(e) => setHistory(e.target.value)}>
            <option value="">Mọi lịch sử</option>
            {CREDIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => load(1)}>Lọc</button>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Thu nhập</th>
                  <th>Lịch sử</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.full_name}
                      {c.is_simulated && <div className="text-xs text-slate-400">Dữ liệu mô phỏng</div>}
                    </td>
                    <td>{money(c.monthly_income)}</td>
                    <td>{c.credit_history}</td>
                    <td>
                      {canWrite && (
                        <button
                          className="text-brand-600"
                          onClick={() => {
                            setEditing(c.id);
                            setForm({
                              full_name: c.full_name,
                              age: c.age || 30,
                              occupation: c.occupation,
                              monthly_income: Number(c.monthly_income),
                              years_employed: Number(c.years_employed),
                              credit_history: c.credit_history,
                              late_payments: c.late_payments,
                              current_debt: Number(c.current_debt),
                              existing_loans: c.existing_loans,
                              phone: c.phone || "",
                            });
                          }}
                        >
                          Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={8} total={total} onPage={load} />
          </>
        )}
      </div>
      {canWrite && (
        <form className="card space-y-3" onSubmit={onSubmit}>
          <h3 className="font-medium">{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</h3>
          {Object.entries({
            full_name: "Họ tên",
            occupation: "Nghề nghiệp",
            age: "Tuổi",
            monthly_income: "Thu nhập/tháng",
            years_employed: "Năm làm việc",
            late_payments: "Số lần chậm trả",
            current_debt: "Dư nợ hiện tại",
            existing_loans: "Số khoản vay",
            phone: "Điện thoại",
          }).map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                className="input mt-1"
                value={(form as never)[key]}
                onChange={(e) => setForm({ ...form, [key]: key === "full_name" || key === "occupation" || key === "phone" ? e.target.value : Number(e.target.value) })}
                required={key !== "phone"}
              />
            </label>
          ))}
          <select className="input" value={form.credit_history} onChange={(e) => setForm({ ...form, credit_history: e.target.value })}>
            {CREDIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn-primary w-full">{editing ? "Cập nhật" : "Tạo mới"}</button>
        </form>
      )}
    </div>
  );
}
