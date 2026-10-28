import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { Pager } from "../components/Pager";
import { useToast } from "../components/Toast";
import type { Paginated, Role, User } from "../types";

export function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "CREDIT_OFFICER" as Role });
  const toast = useToast();

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await api.get<Paginated<User>>("/api/users", { params: { page: p, page_size: 8, q: q || undefined } });
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
      await api.post("/api/users", form);
      toast.success("Đã tạo người dùng");
      setForm({ email: "", full_name: "", password: "", role: "CREDIT_OFFICER" });
      load(1);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function toggle(user: User) {
    try {
      await api.put(`/api/users/${user.id}`, { is_active: !user.is_active });
      load(page);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="grid grid-cols-[1.4fr_1fr] gap-4">
      <div className="card">
        <div className="mb-3 flex gap-2">
          <input className="input" placeholder="Tìm email / họ tên" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-primary" onClick={() => load(1)}>Tìm</button>
        </div>
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead>
                <tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.is_active ? "Hoạt động" : "Khóa"}</td>
                    <td><button className="text-brand-600" onClick={() => toggle(u)}>{u.is_active ? "Khóa" : "Mở"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={8} total={total} onPage={load} />
          </>
        )}
      </div>
      <form className="card space-y-3" onSubmit={onSubmit}>
        <h3 className="font-medium">Tạo người dùng</h3>
        <input className="input" placeholder="Họ tên" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          <option value="ADMIN">ADMIN</option>
          <option value="CREDIT_OFFICER">CREDIT_OFFICER</option>
          <option value="RISK_VIEWER">RISK_VIEWER</option>
        </select>
        <button className="btn-primary w-full">Tạo</button>
      </form>
    </div>
  );
}
