import { useId, type ReactNode, type InputHTMLAttributes } from "react";
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <p className="eyebrow">QUẢN LÝ TÍN DỤNG</p>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </header>
  );
}
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={htmlFor + "-hint"} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={htmlFor + "-error"} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function SearchInput({
  label = "Tìm kiếm",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 sm:max-w-md">
      <label className="field-label mb-2 block" htmlFor={id}>
        {label}
      </label>
      <input {...props} id={id} type="search" className="input" />
    </div>
  );
}
export function DataTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
export function EmptyState({
  title = "Chưa có dữ liệu",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-mark" aria-hidden="true">
        —
      </span>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state">
      <div role="alert">
        <p className="font-semibold">Không thể hoàn tất yêu cầu</p>
        <p className="mt-1 text-sm break-words">{message}</p>
      </div>
      {retry && (
        <button type="button" className="btn-secondary mt-3" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
