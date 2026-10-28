export function Loading({ label = "Đang tải..." }: { label?: string }) {
  return <div className="py-10 text-center text-slate-500">{label}</div>;
}
