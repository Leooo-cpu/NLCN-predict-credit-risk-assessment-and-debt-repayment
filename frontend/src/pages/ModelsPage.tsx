import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { useToast } from "../components/Toast";
import type { ModelInfo, ServingModel } from "../types";

export function ModelsPage() {
  const [current, setCurrent] = useState<ServingModel | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.get<ServingModel>("/api/models/current"), api.get<ModelInfo[]>("/api/models")])
      .then(([cur, list]) => {
        setCurrent(cur.data);
        setModels(list.data);
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Thông tin mô hình</h2>
      {current && (
        <div className="card space-y-2">
          <p className="text-sm text-slate-500">Mô hình ACTIVE</p>
          <h3 className="text-xl font-medium">Home Credit · {current.version}</h3>
          <p>Thuật toán: {current.algorithm}</p>
          <p>Tập dữ liệu: {current.training_dataset}</p>
          <p>Chọn thuật toán: AP trung bình CV cao nhất → ROC-AUC trung bình → Logistic Regression, Random Forest, XGBoost nếu vẫn bằng nhau.</p>
          <p>Ngưỡng phân loại: {current.classification_threshold}. Phân nhóm rủi ro cũ: chưa áp dụng ({current.risk_bands.status}).</p>
          <table className="table"><thead><tr><th>Mô hình</th><th>AP CV mean ± std</th><th>ROC-AUC CV mean ± std</th></tr></thead><tbody>
            {Object.entries(current.cv_results.models).map(([name, result]) => <tr key={name}><td>{name}</td><td>{result.summary.ap_mean.toFixed(6)} ± {result.summary.ap_std.toFixed(6)}</td><td>{result.summary.roc_auc_mean.toFixed(6)} ± {result.summary.roc_auc_std.toFixed(6)}</td></tr>)}
          </tbody></table>
          <p>Điểm hồ sơ minh họa (tách biệt với chọn thuật toán): {current.credit_score_formula}</p>
          <p>Test độc lập của mô hình đã chọn:</p>
          <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(current.test_metrics, null, 2)}</pre>
        </div>
      )}
      <div className="card">
        <h3 className="mb-3 font-medium">Registry lịch sử (không quyết định mô hình đang phục vụ)</h3>
        <p className="mb-3 text-sm">Giữ nguyên nguồn và trạng thái đã lưu. Metric pr_auc trong kết quả mô phỏng cũ thực chất là AP; công thức chọn cũ chỉ là dữ liệu lịch sử.</p>
        <table className="table">
          <thead>
            <tr><th>Tên</th><th>Phiên bản</th><th>Thuật toán</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td>{m.model_name}<div className="text-xs">{m.training_dataset}</div></td>
                <td>{m.version}</td>
                <td>{m.algorithm}</td>
                <td>{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
