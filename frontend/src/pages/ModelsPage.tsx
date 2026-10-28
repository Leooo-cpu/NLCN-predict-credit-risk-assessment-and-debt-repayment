import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { Loading } from "../components/Loading";
import { useToast } from "../components/Toast";
import type { ModelInfo } from "../types";

export function ModelsPage() {
  const [current, setCurrent] = useState<ModelInfo | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.get<ModelInfo>("/api/models/current"), api.get<ModelInfo[]>("/api/models")])
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
          <h3 className="text-xl font-medium">{current.model_name} · {current.version}</h3>
          <p>Thuật toán: {current.algorithm}</p>
          <p>Tập dữ liệu: {current.training_dataset}</p>
          <p>Công thức điểm: {current.credit_score_formula}</p>
          <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(current.metrics_json, null, 2)}</pre>
        </div>
      )}
      <div className="card">
        <h3 className="mb-3 font-medium">Model registry</h3>
        <table className="table">
          <thead>
            <tr><th>Tên</th><th>Phiên bản</th><th>Thuật toán</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td>{m.model_name}</td>
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
