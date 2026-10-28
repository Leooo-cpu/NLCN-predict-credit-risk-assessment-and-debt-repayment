import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { Pager } from "../components/Pager";
import { useToast } from "../components/Toast";
import type { Paginated, PredictionWithLoan, ShapFactor } from "../types";
import { money, pct, riskClass, riskLabel } from "../utils/format";

export function PredictionHistoryPage() {
  const [items, setItems] = useState<PredictionWithLoan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionWithLoan | null>(null);
  const toast = useToast();

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await api.get<Paginated<PredictionWithLoan>>("/api/loan-applications/predictions/all", {
        params: {
          page: p,
          page_size: 10,
          q: q || undefined,
          risk_level: riskLevel || undefined,
        },
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

  const lowCount = items.filter((x) => x.risk_level === "LOW_RISK").length;
  const medCount = items.filter((x) => x.risk_level === "MEDIUM_RISK").length;
  const highCount = items.filter((x) => x.risk_level === "HIGH_RISK").length;

  const modalShap: ShapFactor[] =
    selectedPrediction?.shap_explanation ||
    selectedPrediction?.explanation_json?.shap_explanation ||
    [];

  const chartData = modalShap.map((s) => ({
    name: s.feature_name,
    value: s.shap_value,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Lịch sử dự đoán rủi ro</h2>
          <p className="text-sm text-slate-500">
            Tổng hợp toàn bộ lượt tính toán điểm tín dụng và dự đoán xác suất vỡ nợ bằng mô hình máy học (Dữ liệu mô phỏng)
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">Tổng lượt đánh giá</div>
          <div className="text-2xl font-bold text-slate-900">{total}</div>
        </div>
        <div className="card border-l-4 border-l-emerald-500">
          <div className="text-sm text-slate-500">Rủi ro thấp (Trang hiện tại)</div>
          <div className="text-2xl font-bold text-emerald-600">{lowCount}</div>
        </div>
        <div className="card border-l-4 border-l-amber-500">
          <div className="text-sm text-slate-500">Rủi ro trung bình (Trang hiện tại)</div>
          <div className="text-2xl font-bold text-amber-600">{medCount}</div>
        </div>
        <div className="card border-l-4 border-l-rose-500">
          <div className="text-sm text-slate-500">Rủi ro cao (Trang hiện tại)</div>
          <div className="text-2xl font-bold text-rose-600">{highCount}</div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input max-w-sm"
            placeholder="Tìm theo tên khách hàng..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
          />
          <select
            className="input w-48"
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
          >
            <option value="">Tất cả nhóm rủi ro</option>
            <option value="LOW_RISK">Rủi ro thấp</option>
            <option value="MEDIUM_RISK">Rủi ro trung bình</option>
            <option value="HIGH_RISK">Rủi ro cao</option>
          </select>
          <button className="btn-primary" onClick={() => load(1)}>
            Lọc kết quả
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setQ("");
              setRiskLevel("");
              load(1);
            }}
          >
            Đặt lại
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Khách hàng</th>
                    <th>Mã hồ sơ</th>
                    <th>Số tiền đề nghị</th>
                    <th>Xác suất vỡ nợ</th>
                    <th>Khả năng trả nợ</th>
                    <th>Điểm mô phỏng</th>
                    <th>Nhóm rủi ro</th>
                    <th>Mô hình</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const prob = Number(item.default_probability || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition">
                        <td className="whitespace-nowrap text-xs text-slate-600">
                          {new Date(item.created_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="font-medium text-slate-900">
                          {item.customer_name || "N/A"}
                        </td>
                        <td>
                          <Link
                            className="font-mono text-brand-600 hover:underline"
                            to={`/loans/${item.loan_application_id}`}
                          >
                            #{item.loan_application_id}
                          </Link>
                        </td>
                        <td>
                          {item.requested_amount ? money(item.requested_amount) : "—"}
                          {item.term_months && (
                            <span className="text-xs text-slate-500 block">
                              {item.term_months} tháng
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {pct(item.default_probability)}
                            </span>
                            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  prob < 0.2
                                    ? "bg-emerald-500"
                                    : prob < 0.45
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, prob * 100))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-emerald-700 font-medium">
                          {pct(item.repayment_probability)}
                        </td>
                        <td>
                          <span className="font-bold text-slate-900">
                            {Number(item.credit_score).toFixed(0)}
                          </span>
                          <span className="text-xs text-slate-400 block">/ 850</span>
                        </td>
                        <td>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${riskClass(
                              item.risk_level
                            )}`}
                          >
                            {riskLabel(item.risk_level)}
                          </span>
                        </td>
                        <td className="text-xs font-mono text-slate-500">
                          {item.model_version}
                        </td>
                        <td className="space-x-2 whitespace-nowrap">
                          <button
                            className="text-xs text-brand-600 hover:underline font-medium"
                            onClick={() => setSelectedPrediction(item)}
                          >
                            Xem SHAP
                          </button>
                          <Link
                            className="text-xs text-slate-600 hover:underline"
                            to={`/loans/${item.loan_application_id}`}
                          >
                            Hồ sơ
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-slate-500">
                        Chưa có lịch sử dự đoán nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={10} total={total} onPage={load} />
          </>
        )}
      </div>

      {/* SHAP Explanation Modal */}
      {selectedPrediction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Chi tiết đánh giá rủi ro · Hồ sơ #{selectedPrediction.loan_application_id}
                </h3>
                <p className="text-xs text-slate-500">
                  Khách hàng: <strong>{selectedPrediction.customer_name}</strong> · Mô hình{" "}
                  <strong>{selectedPrediction.model_version}</strong> · Thời gian:{" "}
                  {new Date(selectedPrediction.created_at).toLocaleString("vi-VN")}
                </p>
              </div>
              <button
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                onClick={() => setSelectedPrediction(null)}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center">
              <div>
                <span className="text-xs text-slate-500">Xác suất vỡ nợ</span>
                <div className="text-xl font-bold text-slate-900">
                  {pct(selectedPrediction.default_probability)}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">Điểm tín dụng mô phỏng</span>
                <div className="text-xl font-bold text-brand-600">
                  {Number(selectedPrediction.credit_score).toFixed(0)} / 850
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">Nhóm rủi ro</span>
                <div className="mt-1">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${riskClass(
                      selectedPrediction.risk_level
                    )}`}
                  >
                    {riskLabel(selectedPrediction.risk_level)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-800 mb-2">
                Biểu đồ đặc trưng ảnh hưởng (SHAP Values)
              </h4>
              {chartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 90, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={130} />
                      <Tooltip />
                      <Bar dataKey="value">
                        {chartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.value > 0 ? "#e11d48" : "#059669"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Không có dữ liệu SHAP chi tiết.</p>
              )}
            </div>

            {modalShap.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">
                  Giải thích các yếu tố (Tiếng Việt)
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {modalShap.map((factor, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded border text-sm flex items-start justify-between ${
                        factor.impact === "INCREASE_RISK"
                          ? "bg-rose-50 border-rose-200 text-rose-900"
                          : "bg-emerald-50 border-emerald-200 text-emerald-900"
                      }`}
                    >
                      <div>
                        <strong>{factor.feature_name}</strong>: {factor.description}
                      </div>
                      <span className="font-mono text-xs whitespace-nowrap ml-3 font-semibold">
                        {factor.shap_value > 0 ? `+${factor.shap_value}` : factor.shap_value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <button
                className="btn-primary"
                onClick={() => setSelectedPrediction(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
