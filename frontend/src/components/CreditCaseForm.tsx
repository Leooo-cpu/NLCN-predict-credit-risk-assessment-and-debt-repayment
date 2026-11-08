import { Loading } from "./Loading";
import { ErrorState, FormField } from "./UI";
import { useCreditCaseForm } from "../hooks/useCreditCaseForm";
import type { HomeCreditContract } from "../types";
import type { CreditCase, CasePrediction } from "../creditTypes";
import { creditHints, creditLabel } from "../utils/creditLabels";
export function CreditCaseForm({
  record,
  onSaved,
  onPredicted,
}: {
  record?: CreditCase;
  onSaved: (record: CreditCase) => void;
  onPredicted?: (result: CasePrediction) => void;
}) {
  const state = useCreditCaseForm({ record, onSaved, onPredicted });
  const {
    contract,
    loading,
    schemaError,
    load,
    error,
    fieldErrors,
    values,
    unknown,
    confirmed,
    name,
    busy,
    form,
    errorSummary,
    invalid,
    submit,
    setName,
    setValues,
    setUnknown,
    setConfirmed,
    clearField,
  } = state;
  if (loading) return <Loading label="Đang tải định nghĩa đầu vào…" />;
  if (schemaError || !contract)
    return (
      <ErrorState
        message={schemaError || "Không tải được định nghĩa đầu vào"}
        retry={load}
      />
    );
  return (
    <form
      ref={form}
      className="card space-y-6"
      aria-busy={busy}
      onInvalid={invalid}
      onSubmit={(event) => {
        void submit(event, true);
      }}
    >
      <div>
        <h2>
          {record
            ? "Chỉnh sửa thông tin và dự đoán"
            : "Tạo hồ sơ khách hàng và dự đoán"}
        </h2>
        <p className="mt-2 field-hint">
          Nhập thông tin thực tế theo định nghĩa Home Credit. Với trường cho
          phép thiếu dữ liệu, có thể chọn “Không rõ”.
        </p>
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-6">
        <legend className="sr-only">Thông tin đầu vào hồ sơ</legend>
        {!record && (
          <FormField
            label="Tên hoặc mã khách hàng"
            htmlFor="case-name"
            error={fieldErrors["case-name"]}
          >
            <input
              id="case-name"
              className="input"
              required
              maxLength={255}
              aria-invalid={!!fieldErrors["case-name"]}
              aria-describedby={
                fieldErrors["case-name"] ? "case-name-error" : undefined
              }
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearField("case-name");
              }}
            />
          </FormField>
        )}
        <CreditFields contract={contract} state={state} />
        <div className="info-note">
          <label className="flex items-start gap-3">
            <input
              id="amount-confirmation"
              className="mt-1"
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => {
                setConfirmed(event.target.checked);
                clearField("amount-confirmation");
              }}
            />
            <span>
              Tôi xác nhận số tiền dùng đơn vị của hồ sơ Home Credit gốc, không
              mặc định là đồng Việt Nam.
            </span>
          </label>
        </div>
      </fieldset>
      {error && (
        <div ref={errorSummary} tabIndex={-1}>
          <ErrorState message={error} />
        </div>
      )}
      <div className="actions border-t border-line pt-5">
        <button className="btn-primary" disabled={busy || !confirmed}>
          {busy ? "Đang xử lý…" : "Dự đoán và lưu kết quả"}
        </button>
        {record && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !confirmed}
            onClick={(event) => {
              if (form.current?.reportValidity()) void submit(event, false);
            }}
          >
            Chỉ lưu thông tin
          </button>
        )}
      </div>
      <p className="field-hint">
        Thông tin và kết quả của mỗi lần dự đoán được lưu trong lịch sử hồ sơ.
      </p>
    </form>
  );
}

function CreditFields({
  contract,
  state,
}: {
  contract: HomeCreditContract;
  state: ReturnType<typeof useCreditCaseForm>;
}) {
  const {
    values,
    unknown,
    busy,
    setValues,
    setUnknown,
    clearField,
    fieldErrors,
  } = state;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
      {Object.entries(contract.features).map(([key, spec]) => {
        const hint = [creditHints[key], spec.unit && `Đơn vị: ${spec.unit}`]
          .filter(Boolean)
          .join(" · ");
        const describedBy =
          [hint && key + "-hint", fieldErrors[key] && key + "-error"]
            .filter(Boolean)
            .join(" ") || undefined;
        const common = {
          id: key,
          className: "input",
          required: !unknown[key],
          disabled: busy || !!unknown[key],
          value: values[key] || "",
          "aria-invalid": !!fieldErrors[key],
          "aria-describedby": describedBy,
          onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
          ) => {
            setValues((previous) => ({
              ...previous,
              [key]: event.target.value,
            }));
            clearField(key);
          },
        };
        return (
          <FormField
            key={key}
            label={creditLabel(key, spec.label)}
            htmlFor={key}
            hint={hint}
            error={fieldErrors[key]}
          >
            {spec.choices ? (
              <select {...common}>
                <option value="">Chọn thông tin thực tế</option>
                {values[key] && !spec.choices.includes(values[key]) && (
                  <option value={values[key]}>
                    {values[key]} (giá trị nguồn)
                  </option>
                )}
                {spec.choices.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={spec.kind === "string" ? "text" : "number"}
                step={spec.kind === "integer" ? "1" : "any"}
              />
            )}
            {spec.nullable && (
              <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={!!unknown[key]}
                  onChange={(event) => {
                    setUnknown((previous) => ({
                      ...previous,
                      [key]: event.target.checked,
                    }));
                    clearField(key);
                  }}
                />
                Không rõ
                <span className="sr-only">
                  : {creditLabel(key, spec.label)}
                </span>
              </label>
            )}
          </FormField>
        );
      })}
    </div>
  );
}
