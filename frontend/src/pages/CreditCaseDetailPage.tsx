import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Loading } from "../components/Loading";
import { CreditCaseForm } from "../components/CreditCaseForm";
import { CasePredictionCard } from "../components/CasePredictionCard";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
} from "../components/UI";
import { useReadRequest } from "../hooks/useReadRequest";
import type { CreditCase, CasePrediction } from "../creditTypes";
import { pct } from "../utils/format";
export function CreditCaseDetailPage({
  mode = "loans",
}: {
  mode?: "customers" | "loans" | "assessment";
}) {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, run } = useReadRequest<{
    record: CreditCase;
    history: CasePrediction[];
  }>();
  const [record, setRecord] = useState<CreditCase | null>(null);
  const [history, setHistory] = useState<CasePrediction[]>([]);
  const [selected, setSelected] = useState<CasePrediction | null>(null);
  const [focusResult, setFocusResult] = useState(false);
  const load = useCallback(
    () =>
      run(async (signal) => {
        const [item, previous] = await Promise.all([
          api.get<CreditCase>(`/api/credit-cases/${id}`, { signal }),
          api.get<CasePrediction[]>(`/api/credit-cases/${id}/predictions`, {
            signal,
          }),
        ]);
        return { record: item.data, history: previous.data };
      }),
    [run, id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (data) {
      setRecord(data.record);
      setHistory(data.history);
      setSelected(data.history[0] || null);
      setFocusResult(false);
    }
  }, [data]);
  if (loading) return <Loading />;
  if (error || !record)
    return (
      <ErrorState message={error || "Không tìm thấy hồ sơ"} retry={load} />
    );
  const canWrite = user?.role === "ADMIN" || user?.role === "OFFICER";
  return (
    <div className="space-y-6">
      <Link
        className="text-link text-sm"
        to={mode === "assessment" ? "/risk-assessment" : `/${mode}`}
      >
        ←{" "}
        {mode === "assessment"
          ? "Chọn hồ sơ khác"
          : mode === "customers"
            ? "Danh sách khách hàng"
            : "Danh sách hồ sơ và dự đoán"}
      </Link>
      <PageHeader
        title={record.display_name}
        description={`Nguồn: ${record.source} · Mã hồ sơ nguồn: ${record.source_application_id ?? "Nhập trực tiếp"}`}
      >
        {mode === "customers" && (
          <Link className="btn-secondary" to={`/loans/${record.id}`}>
            Xem kết quả và lịch sử
          </Link>
        )}
        {mode !== "assessment" && canWrite && (
          <Link className="btn-primary" to={`/risk-assessment/${record.id}`}>
            Đánh giá rủi ro hồ sơ này
          </Link>
        )}
      </PageHeader>
      <CreditCaseSummary record={record} />
      {mode === "assessment" && canWrite && (
        <CreditCaseForm
          key={record.id}
          record={record}
          onSaved={setRecord}
          onPredicted={(prediction) => {
            setSelected(prediction);
            setFocusResult(true);
            setHistory((previous) => [prediction, ...previous]);
            setRecord((previous) =>
              previous
                ? { ...previous, latest_prediction: prediction }
                : previous,
            );
          }}
        />
      )}
      {mode !== "customers" &&
        (selected ? (
          <CasePredictionCard
            prediction={selected}
            revision={record.input_revision}
            focusResult={focusResult}
          />
        ) : (
          <div className="card">
            <EmptyState
              title="Chưa có dự đoán cho hồ sơ này"
              description={
                mode === "assessment"
                  ? "Kiểm tra thông tin phía trên rồi bấm “Dự đoán và lưu kết quả”."
                  : "Chọn “Đánh giá rủi ro hồ sơ này” để thực hiện dự đoán."
              }
            />
          </div>
        ))}
      {mode !== "customers" && (
        <section className="card space-y-4">
          <h2>Lịch sử dự đoán của {record.display_name}</h2>
          {!history.length ? (
            <EmptyState description="Chưa có lịch sử dự đoán cho hồ sơ này." />
          ) : (
            <DataTable label="Lịch sử dự đoán của hồ sơ">
              <table className="table">
                <caption>Lịch sử dự đoán của {record.display_name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Đầu vào</th>
                    <th scope="col">Rủi ro khó khăn thanh toán</th>
                    <th scope="col">Mô hình</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((prediction) => (
                    <tr
                      key={prediction.id}
                      className={
                        selected?.id === prediction.id ? "bg-brand-50" : ""
                      }
                    >
                      <td className="whitespace-nowrap">
                        {new Date(prediction.created_at).toLocaleString(
                          "vi-VN",
                        )}
                      </td>
                      <td>Phiên bản {prediction.input_revision}</td>
                      <td className="font-semibold tabular-nums">
                        {pct(prediction.payment_difficulty_probability)}
                      </td>
                      <td>
                        {prediction.algorithm} · {prediction.model_version}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-link whitespace-nowrap"
                          aria-label={`Xem kết quả đã lưu số ${prediction.id}`}
                          onClick={() => {
                            setSelected(prediction);
                            setFocusResult(true);
                          }}
                        >
                          Xem kết quả đã lưu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </section>
      )}
    </div>
  );
}
function CreditCaseSummary({ record }: { record: CreditCase }) {
  return (
    <section className="card space-y-5">
      <h2>Thông tin khách hàng trong hồ sơ</h2>
      <p className="text-sm text-muted">
        {record.source_application_id != null
          ? "Định danh ẩn danh; dữ liệu Home Credit không công bố họ tên thật."
          : "Hồ sơ do người dùng cung cấp; cần xác nhận đúng đơn vị trước khi dự đoán."}
      </p>
      <dl className="detail-grid">
        <div>
          <dt>Số tiền cấp tín dụng</dt>
          <dd>
            {Number(record.inputs_json.AMT_CREDIT).toLocaleString("vi-VN")}{" "}
            <span className="text-sm font-normal text-muted">
              (thang Home Credit, không mặc định VND)
            </span>
          </dd>
        </div>
        <div>
          <dt>Loại hợp đồng</dt>
          <dd>{record.inputs_json.NAME_CONTRACT_TYPE}</dd>
        </div>
        <div>
          <dt>Nghề nghiệp</dt>
          <dd>{record.inputs_json.OCCUPATION_TYPE ?? "Không biết"}</dd>
        </div>
        <div>
          <dt>Ngày sinh so với ngày nộp hồ sơ</dt>
          <dd>{record.inputs_json.DAYS_BIRTH} ngày</dd>
        </div>
        <div>
          <dt>Ngày bắt đầu việc</dt>
          <dd>
            {record.inputs_json.DAYS_EMPLOYED === 365243 ||
            record.inputs_json.DAYS_EMPLOYED == null
              ? "Không biết"
              : `${record.inputs_json.DAYS_EMPLOYED} ngày so với ngày nộp`}
          </dd>
        </div>
        <div>
          <dt>Số tiền trả theo kỳ</dt>
          <dd>
            {record.inputs_json.AMT_ANNUITY == null
              ? "Không rõ"
              : Number(record.inputs_json.AMT_ANNUITY).toLocaleString("vi-VN")}
          </dd>
        </div>
      </dl>
      {record.reference_target != null && (
        <div className="info-note">
          Thông tin tham khảo từ hồ sơ gốc:{" "}
          <strong>
            {record.reference_target
              ? "Có khó khăn thanh toán"
              : "Thuộc các trường hợp còn lại"}
          </strong>
          . Đây là thông tin lịch sử, không phải kết quả dự đoán và không dùng
          làm đầu vào dự đoán.
        </div>
      )}
    </section>
  );
}

export function CreditCaseCreateContent() {
  const navigate = useNavigate();
  const [record, setRecord] = useState<CreditCase | undefined>();
  return (
    <CreditCaseForm
      record={record}
      onSaved={setRecord}
      onPredicted={(prediction) => navigate(`/loans/${prediction.case_id}`)}
    />
  );
}
export function CreditCaseCreatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thêm hồ sơ khách hàng"
        description="Cung cấp thông tin hồ sơ để đánh giá rủi ro gặp khó khăn thanh toán."
      />
      <CreditCaseCreateContent />
    </div>
  );
}
