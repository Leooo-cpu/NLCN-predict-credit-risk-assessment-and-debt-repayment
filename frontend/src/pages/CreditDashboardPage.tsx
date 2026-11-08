import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";

interface Summary { total_cases: number; total_predictions: number; assessed_cases: number; source: string; identity_note: string }
export function CreditDashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get<Summary>("/api/credit-cases/summary").then(response => setData(response.data)).catch(err => setError(errorMessage(err))); }, []);
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Tổng quan dữ liệu Home Credit</h2>
    {error && <p role="alert">{error}</p>}{data && <>
      <p>Nguồn: {data.source}</p><div className="grid grid-cols-3 gap-4">{[["Hồ sơ nguồn", data.total_cases], ["Hồ sơ đã dự đoán", data.assessed_cases], ["Lượt dự đoán đã lưu", data.total_predictions]].map(([label, count]) => <div className="card" key={label}><p>{label}</p><strong className="text-2xl">{Number(count).toLocaleString("vi-VN")}</strong></div>)}</div>
      <p>{data.identity_note}</p><p>Nhãn gốc trong CSV và dự đoán của mô hình được hiển thị riêng. Không tự chạy dự đoán hàng loạt khi nạp dữ liệu.</p>
      <Link className="btn-primary inline-block" to="/customers">Xem khách hàng / hồ sơ và dự đoán</Link>
    </>}
  </div>;
}
