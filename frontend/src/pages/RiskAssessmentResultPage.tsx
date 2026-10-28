import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Loading } from "../components/Loading";
import { useToast } from "../components/Toast";
import type { LoanApplication, Paginated, Prediction, ShapFactor } from "../types";
import { money, pct, riskClass, riskLabel } from "../utils/format";

export function RiskAssessmentResultPage() {
  const { id: paramId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentLoanId = paramId || searchParams.get("loan_id") || "";

  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const canScore = user?.role === "ADMIN" || user?.role === "CREDIT_OFFICER";

  // Load list of available loans for quick selection
  useEffect(() => {
    api
      .get<Paginated<LoanApplication>>("/api/loan-applications", { params: { page: 1, page_size: 50 } })
      .then((res) => setLoans(res.data.items))
      .catch(() => {});
  }, []);

  async function loadData(targetId: string) {
    if (!targetId) return;
    setLoading(true);
    try {
      const [loanRes, predRes] = await Promise.all([
        api.get<LoanApplication>(`/api/loan-applications/${targetId}`),
        api.get<Prediction[]>(`/api/loan-applications/${targetId}/predictions`),
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
    if (currentLoanId) {
      loadData(currentLoanId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLoanId]);

  async function handleScore() {
    if (!currentLoanId) return;
    setScoring(true);
    try {
      const res = await api.post<Prediction>(`/api/loan-applications/${currentLoanId}/score`);
      setPrediction(res.data);
      toast.success("Đã hoàn thành đánh giá rủi ro bằng mô hình máy học!");
      await loadData(currentLoanId);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setScoring(false);
    }
  }

  function handleSelectLoan(newId: string) {
    if (paramId) {
      navigate(`/loans/${newId}/result`);
    } else {
      setSearchParams({ loan_id: newId });
    }
  }

  const shap: ShapFactor[] =
    prediction?.shap_explanation ||
    prediction?.explanation_json?.shap_explanation ||
    [];

  const chartData = shap.map((s) => ({
    name: s.feature_name,
    value: s.shap_value,
  }));

  const defaultProb = Number(prediction?.default_probability || 0);
  const creditScore = Number(prediction?.credit_score || 0);

  // Recommendations based on simulated risk
  function getRecommendation(level?: string) {
    switch (level) {
      case "LOW_RISK":
        return {
          title: "Đề xuất: Phê duyệt theo quy trình tiêu chuẩn",
          text: "Khách hàng có lịch sử tài chính tích cực, tỷ lệ nợ DTI trong giới hạn an toàn. Đề xuất cấp tín dụng với mức lãi suất tiêu chuẩn hoặc gói ưu đãi.",
          badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
        };
      case "MEDIUM_RISK":
        return {
          title: "Đề xuất: Thẩm định chuyên sâu & Có điều kiện",
          text: "Khách hàng có một số chỉ số tài chính tiệm cận ngưỡng rủi ro. Khuyến nghị yêu cầu thêm tài sản đảm bảo, rút ngắn kỳ hạn hoặc giảm 15-25% hạn mức cho vay.",
          badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
        };
      case "HIGH_RISK":
        return {
          title: "Cảnh báo: Nguy cơ vỡ nợ cao",
          text: "Khách hàng có xác suất vỡ nợ cao theo mô hình máy học (do quá khứ chậm thanh toán, DTI cao hoặc gánh nặng nợ lớn). Đề xuất từ chối hoặc yêu cầu bảo đảm tài sản 100%.",
          badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
        };
      default:
        return {
          title: "Chưa có đánh giá",
          text: "Hồ sơ chưa được chấm điểm tín dụng bởi mô hình máy học. Hãy bấm nút 'Đánh giá rủi ro' bên dưới.",
          badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
        };
    }
  }

  const rec = getRecommendation(prediction?.risk_level);

  return (
    <div className="space-y-6">
      {/* Header and selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Kết quả đánh giá rủi ro tín dụng & Giải thích máy học
          </h2>
          <p className="text-sm text-slate-500">
            Ứng dụng Machine Learning phân tích xác suất vỡ nợ, điểm tín dụng mô phỏng và SHAP Values
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input w-64 text-sm"
            value={currentLoanId}
            onChange={(e) => handleSelectLoan(e.target.value)}
          >
            <option value="">-- Chọn hồ sơ vay --</option>
            {loans.map((item) => (
              <option key={item.id} value={item.id}>
                #{item.id} - {item.customer?.full_name || `Khách hàng ${item.customer_id}`} (
                {money(item.requested_amount)})
              </option>
            ))}
          </select>
          {canScore && loan && (
            <button
              className="btn-primary"
              onClick={handleScore}
              disabled={scoring}
            >
              {scoring ? "Đang chạy mô hình..." : "Chạy đánh giá mới"}
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() => window.print()}
            title="In hoặc lưu kết quả dạng PDF"
          >
            In kết quả
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : !loan ? (
        <div className="card text-center py-12 space-y-3">
          <p className="text-slate-500">
            Vui lòng chọn một hồ sơ vay từ danh sách phía trên để xem kết quả đánh giá rủi ro chi tiết.
          </p>
          <Link to="/loans" className="btn-primary inline-block">
            Xem danh sách hồ sơ vay
          </Link>
        </div>
      ) : (
        <>
          {/* Main Scoring Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Credit Score Gauge Card */}
            <div className="card text-center space-y-3 flex flex-col justify-center items-center p-6 border-t-4 border-t-brand-600">
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Điểm tín dụng mô phỏng
              </span>
              <div className="relative flex items-center justify-center w-40 h-40 rounded-full border-8 border-slate-100 shadow-inner bg-gradient-to-b from-white to-slate-50">
                <div className="text-center">
                  <span className="text-4xl font-extrabold text-slate-900 block">
                    {creditScore ? creditScore.toFixed(0) : "---"}
                  </span>
                  <span className="text-xs text-slate-400">Thang điểm 300 - 850</span>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Công thức: <code>Score = 850 - 550 * P(vỡ nợ)</code>
              </div>
            </div>

            {/* Default Probability and Repayment Probability */}
            <div className="card space-y-4 p-6">
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Xác suất từ mô hình ML
              </span>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">Xác suất vỡ nợ:</span>
                    <span className="font-bold text-rose-600">{pct(defaultProb)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-rose-500 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, defaultProb * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">Khả năng hoàn trả:</span>
                    <span className="font-bold text-emerald-600">
                      {pct(prediction?.repayment_probability || 1 - defaultProb)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, (1 - defaultProb) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-slate-500 space-y-1">
                <div>Mô hình: <strong>{prediction?.model_version || "Chưa có"}</strong></div>
                <div>Thời gian đánh giá: {prediction ? new Date(prediction.created_at).toLocaleString("vi-VN") : "---"}</div>
              </div>
            </div>

            {/* Risk Group & Decision Recommendation */}
            <div className="card flex flex-col justify-between p-6">
              <div>
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider block mb-2">
                  Phân nhóm rủi ro
                </span>
                <span
                  className={`inline-block text-base font-bold rounded-lg px-4 py-2 border ${riskClass(
                    prediction?.risk_level
                  )}`}
                >
                  {riskLabel(prediction?.risk_level)}
                </span>
              </div>

              <div className={`mt-4 p-3 rounded-lg border text-sm ${rec.badgeColor}`}>
                <h4 className="font-bold mb-1">{rec.title}</h4>
                <p className="text-xs leading-relaxed">{rec.text}</p>
              </div>
            </div>
          </div>

          {/* Loan Application and Customer Summary */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold text-slate-900">
                Thông tin hồ sơ vay #{loan.id} · Khách hàng {loan.customer?.full_name}
              </h3>
              <Link to={`/loans/${loan.id}`} className="text-xs text-brand-600 hover:underline">
                Xem toàn bộ hồ sơ
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Số tiền vay đề nghị</span>
                <span className="font-semibold text-slate-800">{money(loan.requested_amount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Thời hạn vay</span>
                <span className="font-semibold text-slate-800">{loan.term_months} tháng</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Thu nhập hàng tháng</span>
                <span className="font-semibold text-slate-800">{money(loan.monthly_income)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Tỷ lệ nợ / thu nhập (DTI)</span>
                <span className="font-semibold text-slate-800">{Number(loan.dti || 0).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Nghề nghiệp / Kinh nghiệm</span>
                <span className="font-semibold text-slate-800">
                  {loan.customer?.occupation || "N/A"} ({loan.years_employed} năm)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Dư nợ hiện tại</span>
                <span className="font-semibold text-slate-800">{money(loan.current_debt)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Lịch sử tín dụng</span>
                <span className="font-semibold text-slate-800">{loan.credit_history}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Số lần chậm thanh toán</span>
                <span className="font-semibold text-slate-800">{loan.late_payments} lần</span>
              </div>
            </div>
          </div>

          {/* SHAP Explainability Section */}
          {shap.length > 0 ? (
            <div className="card space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Giải thích quyết định mô hình (SHAP Explainability)
                </h3>
                <p className="text-xs text-slate-500">
                  Thanh màu <strong className="text-rose-600">Đỏ</strong> làm tăng nguy cơ vỡ nợ, thanh màu{" "}
                  <strong className="text-emerald-600">Xanh lá</strong> làm giảm nguy cơ vỡ nợ theo giá trị thực tế của hồ sơ.
                </p>
              </div>

              <div className="h-80">
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={140} />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {shap.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-sm flex items-start justify-between ${
                      item.impact === "INCREASE_RISK"
                        ? "bg-rose-50/60 border-rose-200"
                        : "bg-emerald-50/60 border-emerald-200"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900">{item.feature_name}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{item.description}</div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ml-3 ${
                        item.impact === "INCREASE_RISK"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.shap_value > 0 ? `+${item.shap_value}` : item.shap_value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card text-center py-6 text-slate-500">
              Chưa có giải thích SHAP cho hồ sơ này. Hãy bấm "Chạy đánh giá mới".
            </div>
          )}

          {/* Historical Prediction Runs for this Loan */}
          {history.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-slate-900">
                Lịch sử các lần đánh giá trên hồ sơ này ({history.length} lần)
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Phiên bản mô hình</th>
                    <th>Xác suất vỡ nợ</th>
                    <th>Điểm tín dụng</th>
                    <th>Nhóm rủi ro</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr
                      key={item.id}
                      className={item.id === prediction?.id ? "bg-slate-100/70 font-medium" : ""}
                    >
                      <td>{new Date(item.created_at).toLocaleString("vi-VN")}</td>
                      <td>{item.model_version}</td>
                      <td>{pct(item.default_probability)}</td>
                      <td>{Number(item.credit_score).toFixed(0)}</td>
                      <td>
                        <span className={`rounded px-2 py-0.5 text-xs ${riskClass(item.risk_level)}`}>
                          {riskLabel(item.risk_level)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() => setPrediction(item)}
                        >
                          Xem lượt này
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
