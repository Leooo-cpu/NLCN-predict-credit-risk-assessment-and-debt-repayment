import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";
import type { LoanApplication, Prediction, ShapFactor } from "../types";
import { money, pct, riskClass, riskLabel } from "../utils/format";

export function LoanDetailPage() {
  const { id } = useParams();
  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const canScore = user?.role === "ADMIN" || user?.role === "CREDIT_OFFICER";

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [loanRes, predRes] = await Promise.all([
        api.get<LoanApplication>(`/api/loan-applications/${id}`),
        api.get<Prediction[]>(`/api/loan-applications/${id}/predictions`),
      ]);
      setLoan(loanRes.data);
      setHistory(predRes.data);
      setPrediction(predRes.data[0] || null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function score() {
    if (!id) return;
    setScoring(true);
    try {
      const res = await api.post<Prediction>(`/api/loan-applications/${id}/score`);
      setPrediction(res.data);
      toast.success("Đã đánh giá rủi ro");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setScoring(false);
    }
  }

  if (loading) return <Loading />;
  if (!loan) return null;

  const shap: ShapFactor[] =
    prediction?.shap_explanation ||
    prediction?.explanation_json?.shap_explanation ||
    [];
  const chartData = shap.map((s) => ({
    name: s.feature_name,
    value: s.shap_value,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Hồ sơ vay #{loan.id}</h2>
        <div className="space-x-2">
          <Link className="btn-ghost" to="/loans">Quay lại</Link>
          <Link className="btn-ghost text-brand-600 font-medium" to={`/loans/${loan.id}/result`}>
            Phiếu đánh giá & SHAP
          </Link>
          {canScore && (
            <Link className="btn-ghost" to={`/loans/${loan.id}/edit`}>Sửa</Link>
          )}
          {canScore && (
            <button className="btn-primary" onClick={score} disabled={scoring}>
              {scoring ? "Đang đánh giá..." : "Đánh giá rủi ro"}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="card col-span-2 space-y-2">
          <h3 className="font-medium">Thông tin hồ sơ · Dữ liệu mô phỏng</h3>
          <p>Khách hàng: {loan.customer?.full_name}</p>
          <p>Số tiền: {money(loan.requested_amount)} · Kỳ hạn {loan.term_months} tháng</p>
          <p>Thu nhập: {money(loan.monthly_income)} · DTI: {Number(loan.dti || 0).toFixed(2)}</p>
          <p>Lịch sử: {loan.credit_history} · Chậm trả: {loan.late_payments}</p>
          <p>Trạng thái: {loan.status}</p>
        </div>
        <div className="card">
          <h3 className="font-medium">Kết quả mới nhất</h3>
          {prediction ? (
            <div className="space-y-1">
              <span className={`inline-block rounded px-2 py-1 text-sm ${riskClass(prediction.risk_level)}`}>
                {riskLabel(prediction.risk_level)}
              </span>
              <p>Xác suất vỡ nợ: {pct(prediction.default_probability)}</p>
              <p>Khả năng trả nợ: {pct(prediction.repayment_probability)}</p>
              <p>Điểm tín dụng mô phỏng: {Number(prediction.credit_score).toFixed(0)}</p>
              <p className="text-xs text-slate-500">Mô hình {prediction.model_version}</p>
            </div>
          ) : (
            <p className="text-slate-500">Chưa có dự đoán.</p>
          )}
        </div>
      </div>
      {shap.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-medium">Giải thích SHAP</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip />
                <Bar dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.value > 0 ? "#e11d48" : "#059669"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {shap.map((item, idx) => (
              <li key={idx} className="rounded bg-slate-50 p-2">
                <strong>{item.feature_name}</strong> ({item.impact === "INCREASE_RISK" ? "Tăng rủi ro" : "Giảm rủi ro"}): {item.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card">
        <h3 className="mb-3 font-medium">Lịch sử dự đoán</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Phiên bản</th>
              <th>Xác suất</th>
              <th>Điểm</th>
              <th>Nhóm</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="cursor-pointer" onClick={() => setPrediction(item)}>
                <td>{new Date(item.created_at).toLocaleString("vi-VN")}</td>
                <td>{item.model_version}</td>
                <td>{pct(item.default_probability)}</td>
                <td>{Number(item.credit_score).toFixed(0)}</td>
                <td>{riskLabel(item.risk_level)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
