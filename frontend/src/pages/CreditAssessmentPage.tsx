import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { CreditCase } from "../creditTypes";
import type { Paginated } from "../types";
import { CreditCaseCreateContent } from "./CreditCaseDetailPage";
import { useReadRequest } from "../hooks/useReadRequest";
import { Loading } from "../components/Loading";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
} from "../components/UI";
export function CreditAssessmentPage() {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const submitted = useRef("");
  const { data, loading, error, run } = useReadRequest<Paginated<CreditCase>>();
  const search = () => {
    submitted.current = query.trim();
    setSearched(true);
    void run(
      async (signal) =>
        (
          await api.get<Paginated<CreditCase>>("/api/credit-cases", {
            signal,
            params: { q: query.trim(), page: 1, page_size: 10 },
          })
        ).data,
    );
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Đánh giá rủi ro"
        description="Chọn hồ sơ có sẵn hoặc nhập hồ sơ mới để dự đoán rủi ro gặp khó khăn thanh toán."
      />
      <div className="actions" role="group" aria-label="Nguồn hồ sơ">
        <button
          type="button"
          className={tab === "existing" ? "btn-primary" : "btn-secondary"}
          aria-pressed={tab === "existing"}
          onClick={() => setTab("existing")}
        >
          Chọn hồ sơ có sẵn
        </button>
        <button
          type="button"
          className={tab === "new" ? "btn-primary" : "btn-secondary"}
          aria-pressed={tab === "new"}
          onClick={() => setTab("new")}
        >
          Nhập hồ sơ mới
        </button>
      </div>
      {tab === "new" ? (
        <CreditCaseCreateContent />
      ) : (
        <section className="card space-y-5" aria-label="Tìm hồ sơ để đánh giá">
          <form
            className="toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              if (searched && loading && submitted.current === query.trim())
                return;
              search();
            }}
          >
            <SearchInput
              label="Tên hoặc mã hồ sơ"
              required
              placeholder="Nhập thông tin hồ sơ cần đánh giá"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearched(false);
              }}
            />
            <button className="btn-primary">
              {searched && loading ? "Đang tìm…" : "Tìm hồ sơ"}
            </button>
          </form>
          {searched &&
            (loading ? (
              <Loading label="Đang tìm hồ sơ…" />
            ) : error ? (
              <ErrorState message={error} retry={search} />
            ) : !data?.items.length ? (
              <EmptyState
                title="Không tìm thấy hồ sơ phù hợp"
                description="Thử tìm bằng tên hoặc mã hồ sơ khác."
              />
            ) : (
              <ul className="divide-y divide-slate-200">
                {data.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.display_name}</p>
                      <p className="mt-1 text-sm text-muted">
                        Mã hồ sơ: {item.source_application_id ?? item.id}
                      </p>
                    </div>
                    <Link
                      className="btn-secondary"
                      aria-label={`Chọn và đánh giá ${item.display_name}`}
                      to={`/risk-assessment/${item.id}`}
                    >
                      Chọn và đánh giá →
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          <p className="field-hint">
            Hiển thị tối đa 10 kết quả. Nhập mã hồ sơ để tìm chính xác hơn.
          </p>
        </section>
      )}
    </div>
  );
}
