import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useReadRequest } from "../hooks/useReadRequest";
import { Loading } from "../components/Loading";
import { PageHeader, ErrorState, EmptyState } from "../components/UI";
interface Summary {
  total_cases: number;
  total_predictions: number;
  assessed_cases: number;
  source: string;
  identity_note: string;
}
export function CreditDashboardPage() {
  const { data, loading, error, run } = useReadRequest<Summary>();
  const load = useCallback(
    () =>
      run(
        async (signal) =>
          (await api.get<Summary>("/api/credit-cases/summary", { signal }))
            .data,
      ),
    [run],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan dữ liệu Home Credit"
        description="Theo dõi hồ sơ nguồn và các lượt dự đoán đã lưu trong hệ thống."
      >
        <Link className="btn-primary" to="/customers">
          Xem khách hàng / hồ sơ →
        </Link>
      </PageHeader>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : (
        data && (
          <>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Hồ sơ nguồn", data.total_cases],
                ["Hồ sơ đã dự đoán", data.assessed_cases],
                ["Lượt dự đoán đã lưu", data.total_predictions],
              ].map(([label, count], index) => (
                <section
                  className="card border-t-2 border-t-brand-600"
                  key={label}
                >
                  <h2 className="text-sm font-medium text-muted">{label}</h2>
                  <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight text-brand-900">
                    {Number(count).toLocaleString("vi-VN")}
                  </p>
                  <p className="mt-3 text-xs text-muted">
                    {index === 2 ? "Lịch sử kết quả" : "Dữ liệu hồ sơ"}
                  </p>
                </section>
              ))}
            </div>
            {data.total_cases === 0 && (
              <div className="card">
                <EmptyState
                  title="Chưa có hồ sơ nguồn"
                  description="Danh sách hồ sơ hiện chưa có dữ liệu."
                />
              </div>
            )}
            <section className="card space-y-4">
              <h2>Nguồn và phạm vi dữ liệu</h2>
              <p className="text-sm">
                <span className="font-semibold">Nguồn:</span> {data.source}
              </p>
              <p className="text-sm text-muted">{data.identity_note}</p>
              <div className="info-note">
                Nhãn gốc trong CSV và dự đoán của mô hình được hiển thị riêng.
                Không tự chạy dự đoán hàng loạt khi nạp dữ liệu.
              </div>
            </section>
          </>
        )
      )}
    </div>
  );
}
