import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InvalidEvent,
} from "react";
import { api, errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import { useMounted, useReadRequest } from "./useReadRequest";
import type { HomeCreditContract } from "../types";
import type { CreditCase, CreditInputs, CasePrediction } from "../creditTypes";
import { creditLabel } from "../utils/creditLabels";

export function useCreditCaseForm({
  record,
  onSaved,
  onPredicted,
}: {
  record?: CreditCase;
  onSaved: (record: CreditCase) => void;
  onPredicted?: (result: CasePrediction) => void;
}) {
  const {
    data: contract,
    loading,
    error: schemaError,
    run,
  } = useReadRequest<HomeCreditContract>();
  const load = useCallback(
    () =>
      run(
        async (signal) =>
          (
            await api.get<HomeCreditContract>("/api/home-credit/input-schema", {
              signal,
            })
          ).data,
      ),
    [run],
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [unknown, setUnknown] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const toast = useToast();
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const entries = Object.entries(record?.inputs_json || {}).filter(
      ([key]) => key !== "amount_unit",
    );
    setValues(
      Object.fromEntries(
        entries.map(([key, value]) => [
          key,
          value == null ? "" : String(value),
        ]),
      ),
    );
    setUnknown(
      Object.fromEntries(entries.map(([key, value]) => [key, value == null])),
    );
    setConfirmed(record?.inputs_json.amount_unit === "HOME_CREDIT_SOURCE");
  }, [record?.inputs_json, record?.input_revision]);
  function clearField(key: string) {
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }
  function invalid(event: InvalidEvent<HTMLFormElement>) {
    const control = event.target;
    if (!(
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement
    ))
      return;
    if (control.id)
      setFieldErrors((previous) => ({
        ...previous,
        [control.id]: control.validationMessage,
      }));
  }
  async function submit(event: FormEvent, score: boolean) {
    event.preventDefault();
    if (!contract || !confirmed || lock.current) return;
    const inputs: CreditInputs = { amount_unit: contract.amount_unit };
    for (const [key, spec] of Object.entries(contract.features)) {
      if (unknown[key] && spec.nullable) inputs[key] = null;
      else {
        if (!values[key]?.trim()) {
          const message = `Cần bổ sung ${creditLabel(key, spec.label)}`;
          setFieldErrors((previous) => ({ ...previous, [key]: message }));
          document.getElementById(key)?.focus();
          return;
        }
        inputs[key] =
          spec.kind === "string" ? values[key] : Number(values[key]);
      }
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const saved = record
        ? (
            await api.put<CreditCase>(`/api/credit-cases/${record.id}/inputs`, {
              inputs,
              expected_revision: record.input_revision,
            })
          ).data
        : (
            await api.post<CreditCase>("/api/credit-cases", {
              inputs,
              display_name: name,
            })
          ).data;
      if (mounted.current) onSaved(saved);
      if (score) {
        const result = (
          await api.post<CasePrediction>(
            `/api/credit-cases/${saved.id}/score`,
            { expected_revision: saved.input_revision },
          )
        ).data;
        if (mounted.current) {
          onPredicted?.(result);
          toast.success("Đã lưu dự đoán vào lịch sử của hồ sơ này");
        }
      } else if (mounted.current) toast.success("Đã lưu đầu vào của hồ sơ");
    } catch (err) {
      if (!mounted.current) return;
      setError(errorMessage(err));
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        .response?.data?.detail;
      const errors: Record<string, string> = {};
      if (Array.isArray(detail))
        for (const item of detail as {
          loc?: (string | number)[];
          msg?: string;
        }[]) {
          const key = item.loc
            ?.map(String)
            .find(
              (part) => part in contract.features || part === "display_name",
            );
          if (key)
            errors[key === "display_name" ? "case-name" : key] =
              item.msg || "Không hợp lệ";
        }
      setFieldErrors(errors);
      requestAnimationFrame(() => {
        if (!mounted.current) return;
        const first = Object.keys(errors)[0];
        if (first) document.getElementById(first)?.focus();
        else errorSummary.current?.focus();
      });
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
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
  };
}
