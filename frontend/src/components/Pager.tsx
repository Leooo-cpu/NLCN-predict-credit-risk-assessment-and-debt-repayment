export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        Trang {page}/{pages} · {total} bản ghi
      </span>
      <div className="space-x-2">
        <button className="btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Trước
        </button>
        <button className="btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Sau
        </button>
      </div>
    </div>
  );
}
