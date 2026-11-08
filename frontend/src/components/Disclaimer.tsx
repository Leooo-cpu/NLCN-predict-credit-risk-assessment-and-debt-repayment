export function Disclaimer() {
  return (
    <aside
      aria-label="Lưu ý sử dụng kết quả"
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
    >
      <span aria-hidden="true" className="mt-0.5 font-bold">
        ⓘ
      </span>
      <p>
        Kết quả chỉ mang tính hỗ trợ đánh giá rủi ro, không thay thế quyết định
        cấp tín dụng thực tế.{" "}
        <span className="font-medium">
          Dữ liệu và mô hình Home Credit. Kết quả thể hiện rủi ro gặp khó khăn
          thanh toán.
        </span>
      </p>
    </aside>
  );
}
