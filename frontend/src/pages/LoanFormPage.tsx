import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import { Loading } from "../components/Loading";
import type { Customer, Paginated } from "../types";
import { CREDIT_OPTIONS, PURPOSE_OPTIONS } from "../utils/format";

export function LoanFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    customer_id: 0,
    requested_amount: 50000000,
    term_months: 24,
    purpose: "TIEU_DUNG",
    monthly_income: 15000000,
    years_employed: 3,
    current_debt: 0,
    existing_loans: 0,
    credit_history: "FAIR",
    late_payments: 0,
    notes: "",
  });
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    async function boot() {
      try {
        const list = await api.get<Paginated<Customer>>("/api/customers", { params: { page: 1, page_size: 100 } });
        setCustomers(list.data.items);
        if (isEdit && id) {
          const loan = await api.get(`/api/loan-applications/${id}`);
          setForm({
            customer_id: loan.data.customer_id,
            requested_amount: Number(loan.data.requested_amount),
            term_months: loan.data.term_months,
            purpose: loan.data.purpose,
            monthly_income: Number(loan.data.monthly_income),
            years_employed: Number(loan.data.years_employed),
            current_debt: Number(loan.data.current_debt),
            existing_loans: loan.data.existing_loans,
            credit_history: loan.data.credit_history,
            late_payments: loan.data.late_payments,
            notes: loan.data.notes || "",
          });
        } else if (list.data.items[0]) {
          const c = list.data.items[0];
          setForm((prev) => ({
            ...prev,
            customer_id: c.id,
            monthly_income: Number(c.monthly_income),
            years_employed: Number(c.years_employed),
            current_debt: Number(c.current_debt),
            existing_loans: c.existing_loans,
            credit_history: c.credit_history,
            late_payments: c.late_payments,
          }));
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [id, isEdit, toast]);

  function validate() {
    const next: Record<string, string> = {};
    if (!form.customer_id) next.customer_id = "Chọn khách hàng";
    if (form.requested_amount <= 0) next.requested_amount = "Số tiền phải lớn hơn 0";
    if (form.monthly_income <= 0) next.monthly_income = "Thu nhập phải lớn hơn 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await api.put(`/api/loan-applications/${id}`, form);
        toast.success("Đã cập nhật hồ sơ");
        navigate(`/loans/${id}`);
      } else {
        const res = await api.post("/api/loan-applications", form);
        toast.success("Đã tạo hồ sơ vay");
        navigate(`/loans/${res.data.id}`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <form className="card max-w-3xl space-y-3" onSubmit={onSubmit}>
      <h2 className="text-xl font-semibold">{isEdit ? "Sửa hồ sơ vay" : "Tạo hồ sơ vay"}</h2>
      <label className="block text-sm">
        Khách hàng
        <select
          className="input mt-1"
          value={form.customer_id}
          onChange={(e) => {
            const cid = Number(e.target.value);
            const c = customers.find((x) => x.id === cid);
            setForm((prev) => ({
              ...prev,
              customer_id: cid,
              monthly_income: c ? Number(c.monthly_income) : prev.monthly_income,
              years_employed: c ? Number(c.years_employed) : prev.years_employed,
              current_debt: c ? Number(c.current_debt) : prev.current_debt,
              existing_loans: c ? c.existing_loans : prev.existing_loans,
              credit_history: c ? c.credit_history : prev.credit_history,
              late_payments: c ? c.late_payments : prev.late_payments,
            }));
          }}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
        {errors.customer_id && <span className="text-rose-600">{errors.customer_id}</span>}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Số tiền vay
          <input className="input mt-1" type="number" value={form.requested_amount} onChange={(e) => setForm({ ...form, requested_amount: Number(e.target.value) })} />
          {errors.requested_amount && <span className="text-rose-600">{errors.requested_amount}</span>}
        </label>
        <label className="text-sm">Thời hạn (tháng)
          <input className="input mt-1" type="number" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Mục đích
          <select className="input mt-1" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
            {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Thu nhập/tháng
          <input className="input mt-1" type="number" value={form.monthly_income} onChange={(e) => setForm({ ...form, monthly_income: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Năm làm việc
          <input className="input mt-1" type="number" step="0.1" value={form.years_employed} onChange={(e) => setForm({ ...form, years_employed: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Dư nợ hiện tại
          <input className="input mt-1" type="number" value={form.current_debt} onChange={(e) => setForm({ ...form, current_debt: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Số khoản vay
          <input className="input mt-1" type="number" value={form.existing_loans} onChange={(e) => setForm({ ...form, existing_loans: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Chậm thanh toán
          <input className="input mt-1" type="number" value={form.late_payments} onChange={(e) => setForm({ ...form, late_payments: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Lịch sử tín dụng
          <select className="input mt-1" value={form.credit_history} onChange={(e) => setForm({ ...form, credit_history: e.target.value })}>
            {CREDIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <textarea className="input" rows={3} placeholder="Ghi chú" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button className="btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu hồ sơ"}</button>
    </form>
  );
}
