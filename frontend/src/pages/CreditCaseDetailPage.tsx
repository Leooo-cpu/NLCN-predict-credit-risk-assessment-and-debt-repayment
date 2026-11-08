import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { Loading } from "../components/Loading";
import { CreditCaseForm } from "../components/CreditCaseForm";
import { CasePredictionCard } from "../components/CasePredictionCard";
import type { CreditCase, CasePrediction } from "../creditTypes";
import { pct } from "../utils/format";

export function CreditCaseDetailPage({ mode = "loans" }: { mode?: "customers" | "loans" | "assessment" }) {
  const { id } = useParams();
  const [record, setRecord] = useState<CreditCase | null>(null);
  const [history, setHistory] = useState<CasePrediction[]>([]);
  const [selected, setSelected] = useState<CasePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();
  const { user } = useAuth();
  useEffect(() => {
    setLoading(true); setError("");
    Promise.all([api.get<CreditCase>(`/api/credit-cases/${id}`), api.get<CasePrediction[]>(`/api/credit-cases/${id}/predictions`)])
      .then(([item, previous]) => { setRecord(item.data); setHistory(previous.data); setSelected(previous.data[0] || null); })
      .catch(err => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [id]);
  if (loading) return <Loading />;
  if (error || !record) return <p role="alert">{error || "Không tìm thấy hồ sơ"}</p>;
  return <div className="space-y-4">
    <Link className="text-brand-600 underline" to={mode === "assessment" ? "/risk-assessment" : `/${mode}`}>← {mode === "assessment" ? "Chọn hồ sơ khác" : mode === "customers" ? "Danh sách khách hàng" : "Danh sách hồ sơ và dự đoán"}</Link>
    <h2 className="text-2xl font-semibold">{record.display_name}</h2>
    <section className="card space-y-2"><h3 className="font-semibold">Thông tin khách hàng trong hồ sơ</h3>
      <p>Nguồn: {record.source} · Mã hồ sơ nguồn: {record.source_application_id ?? "Nhập trực tiếp"}</p>
      <p>{record.source_application_id != null ? "Định danh ẩn danh; dữ liệu Home Credit không công bố họ tên thật." : "Hồ sơ do người dùng cung cấp; cần xác nhận đúng đơn vị trước khi dự đoán."}</p>
      <p>Số tiền cấp tín dụng: {Number(record.inputs_json.AMT_CREDIT).toLocaleString("vi-VN")} (thang Home Credit, không mặc định VND).</p>
      <p>Loại hợp đồng: {record.inputs_json.NAME_CONTRACT_TYPE} · Nghề nghiệp: {record.inputs_json.OCCUPATION_TYPE ?? "Không biết"}.</p>
      <p>Ngày sinh so với ngày nộp hồ sơ: {record.inputs_json.DAYS_BIRTH} ngày · Ngày bắt đầu việc: {record.inputs_json.DAYS_EMPLOYED === 365243 || record.inputs_json.DAYS_EMPLOYED == null ? "Không biết" : `${record.inputs_json.DAYS_EMPLOYED} ngày so với ngày nộp`}.</p>
      <p>Số tiền trả theo kỳ: {record.inputs_json.AMT_ANNUITY == null ? "Không rõ" : Number(record.inputs_json.AMT_ANNUITY).toLocaleString("vi-VN")}</p>
      {record.reference_target != null && <p className="rounded bg-slate-100 p-2">Thông tin tham khảo từ hồ sơ gốc: {record.reference_target ? "Có khó khăn thanh toán" : "Thuộc các trường hợp còn lại"}. Đây là thông tin lịch sử, không phải kết quả dự đoán và không dùng làm đầu vào dự đoán.</p>}
    </section>
    <div className="flex gap-3">
      {mode === "customers" && <Link className="btn-ghost" to={`/loans/${record.id}`}>Xem kết quả và lịch sử</Link>}
      {mode !== "assessment" && (user?.role === "ADMIN" || user?.role === "OFFICER") && <Link className="btn-primary" to={`/risk-assessment/${record.id}`}>Đánh giá rủi ro hồ sơ này</Link>}
    </div>
    {mode === "assessment" && (user?.role === "ADMIN" || user?.role === "OFFICER") && <CreditCaseForm record={record} onSaved={setRecord} onPredicted={prediction => {
      setSelected(prediction); setHistory(previous => [prediction, ...previous]); setRecord(previous => previous ? { ...previous, latest_prediction: prediction } : previous);
    }} />}
    {mode !== "customers" && (selected ? <CasePredictionCard prediction={selected} revision={record.input_revision} /> : <div className="card">Chưa có dự đoán cho hồ sơ này. {mode === "assessment" ? "Kiểm tra thông tin phía trên rồi bấm “Dự đoán và lưu kết quả”." : "Chọn “Đánh giá rủi ro hồ sơ này” để thực hiện dự đoán."}</div>)}
    {mode !== "customers" && <section className="card overflow-auto"><h3 className="font-semibold mb-3">Lịch sử dự đoán của {record.display_name}</h3>
      <table className="table"><thead><tr><th>Thời gian</th><th>Đầu vào</th><th>Rủi ro khó khăn thanh toán</th><th>Mô hình</th><th>Thao tác</th></tr></thead>
        <tbody>{history.map(prediction => <tr key={prediction.id}><td>{new Date(prediction.created_at).toLocaleString("vi-VN")}</td><td>Phiên bản {prediction.input_revision}</td><td>{pct(prediction.payment_difficulty_probability)}</td><td>{prediction.algorithm} · {prediction.model_version}</td><td><button className="text-brand-600 underline" onClick={() => setSelected(prediction)}>Xem kết quả đã lưu</button></td></tr>)}
          {!history.length && <tr><td colSpan={5}>Chưa có lịch sử.</td></tr>}</tbody></table>
    </section>}
  </div>;
}

export function CreditCaseCreatePage() {
  const navigate = useNavigate();
  const [record, setRecord] = useState<CreditCase | undefined>();
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Thêm hồ sơ khách hàng</h2><CreditCaseForm record={record} onSaved={setRecord} onPredicted={prediction => navigate(`/loans/${prediction.case_id}`)} /></div>;
}
