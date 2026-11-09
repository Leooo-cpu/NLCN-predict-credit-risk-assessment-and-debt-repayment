export function Pager({
  page,
  pageSize,
  total,
  onPage,
  disabled = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Phân trang" className="pager">
      <p aria-live="polite">
        Trang <strong>{page}</strong> / {pages} ·{" "}
        {total.toLocaleString("vi-VN")} bản ghi
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Trước
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Sau →
        </button>
      </div>
    </nav>
  );
}
