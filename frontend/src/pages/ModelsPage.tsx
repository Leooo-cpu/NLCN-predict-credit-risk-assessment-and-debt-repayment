import { useCallback, useEffect } from "react";
import { api } from "../api/client";
import { Loading } from "../components/Loading";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
} from "../components/UI";
import { useReadRequest } from "../hooks/useReadRequest";
import type { ModelInfo, ServingModel } from "../types";
export function ModelsPage() {
  const { data, loading, error, run } = useReadRequest<{
    current: ServingModel;
    models: ModelInfo[];
  }>();
  const load = useCallback(
    () =>
      run(async (signal) => {
        const [current, models] = await Promise.all([
          api.get<ServingModel>("/api/models/current", { signal }),
          api.get<ModelInfo[]>("/api/models", { signal }),
        ]);
        return { current: current.data, models: models.data };
      }),
    [run],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const current = data?.current;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông tin mô hình"
        description="Thông tin mô hình đang phục vụ, kết quả đánh giá và registry lịch sử."
      />
      {loading ? (
        <Loading label="Đang tải thông tin mô hình…" />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : (
        data && (
          <>
            {current && (
              <section className="card space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">MÔ HÌNH ĐANG PHỤC VỤ</p>
                    <h2>Home Credit · {current.version}</h2>
                  </div>
                  <span className="badge border-emerald-200 bg-emerald-50 text-emerald-800">
                    ACTIVE
                  </span>
                </div>
                <dl className="detail-grid">
                  <div>
                    <dt>Thuật toán</dt>
                    <dd>{current.algorithm}</dd>
                  </div>
                  <div>
                    <dt>Tập dữ liệu</dt>
                    <dd>{current.training_dataset}</dd>
                  </div>
                  <div>
                    <dt>Ngưỡng phân loại</dt>
                    <dd>{current.classification_threshold}</dd>
                  </div>
                  <div>
                    <dt>Phân nhóm rủi ro cũ</dt>
                    <dd>Chưa áp dụng ({current.risk_bands.status})</dd>
                  </div>
                </dl>
                <div className="info-note">
                  Chọn thuật toán: AP trung bình CV cao nhất → ROC-AUC trung
                  bình → Logistic Regression, Random Forest, XGBoost nếu vẫn
                  bằng nhau.
                </div>
                <div>
                  <h3 className="mb-3">Kết quả Cross Validation</h3>
                  {!Object.keys(current.cv_results.models).length ? (
                    <EmptyState description="Chưa có kết quả Cross Validation." />
                  ) : (
                    <DataTable label="Kết quả Cross Validation">
                      <table className="table">
                        <caption>Kết quả Cross Validation</caption>
                        <thead>
                          <tr>
                            <th scope="col">Mô hình</th>
                            <th scope="col">AP CV mean ± std</th>
                            <th scope="col">ROC-AUC CV mean ± std</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(current.cv_results.models).map(
                            ([name, result]) => (
                              <tr key={name}>
                                <th scope="row" className="normal-case">
                                  {name}
                                </th>
                                <td className="whitespace-nowrap tabular-nums">
                                  {result.summary.ap_mean.toFixed(6)} ±{" "}
                                  {result.summary.ap_std.toFixed(6)}
                                </td>
                                <td className="whitespace-nowrap tabular-nums">
                                  {result.summary.roc_auc_mean.toFixed(6)} ±{" "}
                                  {result.summary.roc_auc_std.toFixed(6)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </DataTable>
                  )}
                </div>
                <p className="text-sm text-muted">
                  Điểm hồ sơ minh họa (tách biệt với chọn thuật toán):{" "}
                  <span className="font-mono text-ink">
                    {current.credit_score_formula}
                  </span>
                </p>
                <div>
                  <h3 className="mb-3">Test độc lập của mô hình đã chọn</h3>
                  <pre
                    tabIndex={0}
                    aria-label="Chỉ số test độc lập dạng JSON"
                    className="max-w-full overflow-auto rounded-lg border border-line bg-slate-50 p-4 text-sm text-slate-800"
                  >
                    {JSON.stringify(current.test_metrics, null, 2)}
                  </pre>
                </div>
              </section>
            )}
            <section className="card space-y-4">
              <h2>Registry lịch sử</h2>
              <p className="field-hint">
                Không quyết định mô hình đang phục vụ. Giữ nguyên nguồn và trạng
                thái đã lưu. Metric pr_auc trong kết quả mô phỏng cũ thực chất
                là AP; công thức chọn cũ chỉ là dữ liệu lịch sử.
              </p>
              {!data.models.length ? (
                <EmptyState
                  title="Chưa có mô hình trong registry"
                  description="Các phiên bản lịch sử sẽ xuất hiện tại đây."
                />
              ) : (
                <DataTable label="Registry mô hình lịch sử">
                  <table className="table">
                    <caption>Registry mô hình lịch sử</caption>
                    <thead>
                      <tr>
                        <th scope="col">Tên / Tập dữ liệu</th>
                        <th scope="col">Phiên bản</th>
                        <th scope="col">Thuật toán</th>
                        <th scope="col">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.models.map((model) => (
                        <tr key={model.id}>
                          <td className="min-w-48">
                            <p className="font-medium">{model.model_name}</p>
                            <p className="mt-1 text-xs text-muted">
                              {model.training_dataset}
                            </p>
                          </td>
                          <td>{model.version}</td>
                          <td>{model.algorithm}</td>
                          <td>
                            <span className="badge">{model.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
