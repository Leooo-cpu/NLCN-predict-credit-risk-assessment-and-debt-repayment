import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Pager } from "../components/Pager";
import { Loading } from "../components/Loading";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
} from "../components/UI";
import { useReadRequest } from "../hooks/useReadRequest";
import { pct } from "../utils/format";
import type { Paginated } from "../types";
import type { CreditCase } from "../creditTypes";
export function CreditCaseListPage({
  mode = "customers",
}: {
  mode?: "customers" | "loans";
}) {
  const customers = mode === "customers";
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ q: "", status: "", page: 1 });
  const submitted = useRef("");
  const { data, loading, error, run } = useReadRequest<Paginated<CreditCase>>();
  const load = useCallback(
    (next = 1, query = applied.q, predicted = applied.status) => {
      setApplied({ q: query, status: predicted, page: next });
      return run(
        async (signal) =>
          (
            await api.get<Paginated<CreditCase>>("/api/credit-cases", {
              signal,
              params: {
                page: next,
                page_size: 10,
                q: query || undefined,
                predicted: predicted || undefined,
              },
            })
          ).data,
      );
    },
    [applied.q, applied.status, run],
  );
  useEffect(() => {
    void run(
      async (signal) =>
        (
          await api.get<Paginated<CreditCase>>("/api/credit-cases", {
            signal,
            params: {
              page: 1,
              page_size: 10,
              q: undefined,
              predicted: undefined,
            },
          })
        ).data,
    );
  }, [run, mode]);
  const canWrite = user?.role === "ADMIN" || user?.role === "OFFICER";
  return (
    <div className="space-y-6">
      <PageHeader
        title={customers ? "Khách hàng" : "Hồ sơ và dự đoán"}
        description={
          customers
            ? "Tra cứu thông tin khách hàng Home Credit đã ẩn danh. Dữ liệu nguồn không công bố họ tên thật."
            : "Theo dõi hồ sơ vay và kết quả dự đoán mới nhất. Lọc hồ sơ chưa được đánh giá hoặc cần đánh giá lại."
        }
      >
        {canWrite && (
          <Link
            className="btn-primary"
            to={customers ? "/customers/new" : "/risk-assessment"}
          >
            {customers ? "+ Thêm hồ sơ khách hàng" : "Đánh giá rủi ro"}
          </Link>
        )}
      </PageHeader>
      <section className="card space-y-5" aria-label="Tra cứu hồ sơ">
        <form
          className="toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            const key = JSON.stringify([q, status]);
            if (loading && submitted.current === key) return;
            submitted.current = key;
            void load(1, q, status);
          }}
        >
          <SearchInput
            label="Tên hoặc mã hồ sơ nguồn"
            placeholder="Nhập tên hoặc mã để tìm kiếm"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          {!customers && (
            <div className="w-full sm:w-48">
              <label
                htmlFor="prediction-status"
                className="field-label mb-2 block"
              >
                Trạng thái dự đoán
              </label>
              <select
                id="prediction-status"
                className="input"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Mọi trạng thái</option>
                <option value="true">Đã có dự đoán</option>
                <option value="false">Chưa dự đoán</option>
              </select>
            </div>
          )}
          <button className="btn-secondary">Tìm kiếm</button>
        </form>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={() => load(applied.page)} />
        ) : (
          data && (
            <>
              <p className="text-sm text-muted" role="status">
                {data.total.toLocaleString("vi-VN")} hồ sơ phù hợp
              </p>
              {!data.items.length ? (
                <EmptyState
                  title={
                    applied.q || applied.status
                      ? "Không tìm thấy hồ sơ phù hợp"
                      : "Chưa có hồ sơ"
                  }
                  description={
                    applied.q || applied.status
                      ? "Thử tên, mã hồ sơ hoặc trạng thái khác."
                      : "Danh sách hồ sơ hiện chưa có dữ liệu."
                  }
                />
              ) : (
                <CreditCaseTable
                  items={data.items}
                  customers={customers}
                  canWrite={canWrite}
                />
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
    </div>
  );
}

function CreditCaseTable({
  items,
  customers,
  canWrite,
}: {
  items: CreditCase[];
  customers: boolean;
  canWrite: boolean;
}) {
  return (
    <DataTable label="Danh sách hồ sơ">
      <table className="table">
        <caption>{customers ? "Khách hàng" : "Hồ sơ và dự đoán"}</caption>
        <thead>
          <tr>
            <th scope="col">Khách hàng / hồ sơ</th>
            <th scope="col">Số tiền (thang HC)</th>
            <th scope="col">Loại hợp đồng</th>
            <th scope="col">
              {customers ? "Nghề nghiệp" : "Kết quả mới nhất"}
            </th>
            <th scope="col">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="min-w-48">
                <Link
                  className="text-link"
                  to={`/${customers ? "customers" : "loans"}/${item.id}`}
                >
                  {item.display_name}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  Mã hồ sơ: {item.source_application_id ?? item.id}
                </p>
              </td>
              <td className="tabular-nums">
                {Number(item.inputs_json.AMT_CREDIT).toLocaleString("vi-VN")}
              </td>
              <td>{item.inputs_json.NAME_CONTRACT_TYPE}</td>
              <td className="min-w-40">
                {customers ? (
                  (item.inputs_json.OCCUPATION_TYPE ?? "Không rõ")
                ) : item.latest_prediction ? (
                  <>
                    <strong>
                      {pct(
                        item.latest_prediction.payment_difficulty_probability,
                      )}
                    </strong>{" "}
                    khó khăn thanh toán
                    {item.latest_prediction.input_revision !==
                      item.input_revision && (
                      <p className="mt-2 text-amber-800">
                        Thông tin đã thay đổi — cần dự đoán lại
                      </p>
                    )}
                  </>
                ) : (
                  <span className="badge">Chưa dự đoán</span>
                )}
              </td>
              <td className="min-w-36">
                <Link
                  className="text-link"
                  aria-label={`${customers ? "Xem thông tin" : "Xem kết quả"} của ${item.display_name}`}
                  to={`/${customers ? "customers" : "loans"}/${item.id}`}
                >
                  {customers ? "Xem thông tin" : "Xem kết quả"}
                </Link>
                {!customers && canWrite && (
                  <Link
                    className="text-link block"
                    to={`/risk-assessment/${item.id}`}
                  >
                    Đánh giá hồ sơ
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}
