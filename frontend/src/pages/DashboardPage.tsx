import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { useToast } from "../components/Toast";
import type { DashboardSummary } from "../types";
import { money, pct, riskLabel } from "../utils/format";
import { Link } from "react-router-dom";

const COLORS = ["#059669", "#d97706", "#e11d48"];

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api
      .get<DashboardSummary>("/api/dashboard/summary")
      .then((res) => setData(res.data))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <Loading />;
  if (!data) return null;

  const pieData = data.risk_counts.map((item) => ({
    name: riskLabel(item.risk_level),
    value: item.count,
  }));

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="grid grid-cols-4 gap-4">
        <div className="card"><div className="text-sm text-slate-500">Tổng hồ sơ vay</div><div className="text-2xl font-semibold">{data.total_applications}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Khách hàng</div><div className="text-2xl font-semibold">{data.total_customers}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Rủi ro cao</div><div className="text-2xl font-semibold">{data.risk_counts.find((x) => x.risk_level === "HIGH_RISK")?.count || 0}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Ghi chú</div><div className="text-sm">{data.data_note}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card h-80">
          <h3 className="mb-3 font-medium">Hồ sơ theo nhóm rủi ro</h3>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card h-80">
          <h3 className="mb-3 font-medium">Phân bố điểm tín dụng mô phỏng</h3>
          <ResponsiveContainer>
            <BarChart data={data.credit_score_distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#1d4ed8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card h-80">
          <h3 className="mb-3 font-medium">Hồ sơ theo trạng thái</h3>
          <ResponsiveContainer>
            <BarChart data={data.status_counts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card h-80">
          <h3 className="mb-3 font-medium">Số hồ sơ theo thời gian</h3>
          <ResponsiveContainer>
            <BarChart data={data.applications_over_time}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Hồ sơ rủi ro cao gần nhất</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Số tiền</th>
              <th>Xác suất vỡ nợ</th>
              <th>Điểm mô phỏng</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.recent_high_risk.map((row) => (
              <tr key={row.loan_application_id}>
                <td>{row.customer_name}</td>
                <td>{money(row.requested_amount)}</td>
                <td>{pct(row.default_probability)}</td>
                <td>{row.credit_score}</td>
                <td>
                  <Link className="text-brand-600" to={`/loans/${row.loan_application_id}`}>
                    Xem
                  </Link>
                </td>
              </tr>
            ))}
            {data.recent_high_risk.length === 0 && (
              <tr>
                <td colSpan={5} className="text-slate-500">
                  Chưa có dự đoán rủi ro cao. Hãy chạy đánh giá trên hồ sơ vay.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
