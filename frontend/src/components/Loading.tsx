export function Loading({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-busy="true">
      <span className="text-sm text-slate-600">{label}</span>
      <div aria-hidden="true" className="mt-4 space-y-3">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-5 w-4/5" />
      </div>
    </div>
  );
}
