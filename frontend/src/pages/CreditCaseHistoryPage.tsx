import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Pager } from "../components/Pager";
import { Loading } from "../components/Loading";
import { CasePredictionCard } from "../components/CasePredictionCard";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
} from "../components/UI";
import { useReadRequest } from "../hooks/useReadRequest";
import { pct } from "../utils/format";
import type { CasePrediction } from "../creditTypes";
import type { Paginated } from "../types";
export function CreditCaseHistoryPage() {
  const [selected, setSelected] = useState<CasePrediction | null>(null);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ q: "", page: 1 });
  const submitted = useRef("");
  const { data, loading, error, run } =
    useReadRequest<Paginated<CasePrediction>>();
  const load = useCallback(
    (next = 1, query = applied.q) => {
      setApplied({ q: query, page: next });
      setSelected(null);
      return run(
        async (signal) =>
          (
            await api.get<Paginated<CasePrediction>>(
              "/api/credit-cases/predictions",
              { signal, params: { page: next, q: query || undefined } },
            )
          ).data,
      );
    },
    [run, applied.q],
  );
  useEffect(() => {
    void run(
      async (signal) =>
        (
          await api.get<Paginated<CasePrediction>>(
            "/api/credit-cases/predictions",
            { signal, params: { page: 1, q: undefined } },
          )
        ).data,
    );
  }, [run]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch sử dự đoán theo khách hàng"
        description="Tra cứu và xem lại các kết quả đã lưu của từng hồ sơ."
      />
      <section className="card space-y-5">
        <form
          className="toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            if (loading && submitted.current === q) return;
            submitted.current = q;
            void load(1, q);
          }}
        >
          <SearchInput
            label="Tên hoặc mã hồ sơ"
            placeholder="Tìm trong lịch sử dự đoán"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <button className="btn-secondary">Tìm kiếm</button>
        </form>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={() => load(applied.page)} />
        ) : (
          data && (
            <>
              {!data.items.length ? (
                <EmptyState
                  title={
                    applied.q
                      ? "Không tìm thấy kết quả phù hợp"
                      : "Chưa có dự đoán đã lưu"
                  }
                  description={
                    applied.q
                      ? "Thử tìm bằng tên hoặc mã hồ sơ khác."
                      : "Mở hồ sơ khách hàng để thực hiện dự đoán."
                  }
                />
              ) : (
                <DataTable label="Lịch sử dự đoán">
                  <table className="table">
                    <caption>Lịch sử dự đoán theo khách hàng</caption>
                    <thead>
                      <tr>
                        <th scope="col">Khách hàng / hồ sơ</th>
                        <th scope="col">Thời gian</th>
                        <th scope="col">Khó khăn thanh toán</th>
                        <th scope="col">Mô hình</th>
                        <th scope="col">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            selected?.id === item.id ? "bg-brand-50" : ""
                          }
                        >
                          <td className="min-w-48">
                            <Link
                              to={`/customers/${item.case_id}`}
                              className="text-link"
                            >
                              {item.display_name}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString("vi-VN")}
                          </td>
                          <td className="font-semibold tabular-nums">
                            {pct(item.payment_difficulty_probability)}
                          </td>
                          <td>{item.model_version}</td>
                          <td>
                            <button
                              type="button"
                              className="text-link whitespace-nowrap"
                              aria-label={`Xem kết quả số ${item.id} của ${item.display_name || item.case_id}`}
                              onClick={() => setSelected(item)}
                            >
                              Xem kết quả
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              )}
              <Pager
                page={applied.page}
                pageSize={10}
                total={data.total}
                onPage={load}
              />
            </>
          )
        )}
      </section>
      {selected && <CasePredictionCard prediction={selected} focusResult />}
    </div>
  );
}
