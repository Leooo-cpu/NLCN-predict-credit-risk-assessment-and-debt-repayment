export function money(value?: number | string | null) {
  const n = Number(value || 0);
  return n.toLocaleString("vi-VN") + " ₫";
}

export function pct(value?: number | string | null) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function riskLabel(level?: string | null) {
  if (level === "LOW_RISK") return "Rủi ro thấp";
  if (level === "MEDIUM_RISK") return "Rủi ro trung bình";
  if (level === "HIGH_RISK") return "Rủi ro cao";
  return "Chưa đánh giá";
}

export function riskClass(level?: string | null) {
  if (level === "LOW_RISK") return "bg-emerald-100 text-emerald-800";
  if (level === "MEDIUM_RISK") return "bg-amber-100 text-amber-800";
  if (level === "HIGH_RISK") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export const PURPOSE_OPTIONS = [
  { value: "TIEU_DUNG", label: "Tiêu dùng" },
  { value: "MUA_NHA", label: "Mua nhà" },
  { value: "MUA_XE", label: "Mua xe" },
  { value: "GIAO_DUC", label: "Giáo dục" },
  { value: "HOP_TAC_KINH_DOANH", label: "Hợp tác / kinh doanh" },
];

export const CREDIT_OPTIONS = [
  { value: "GOOD", label: "Tốt" },
  { value: "FAIR", label: "Trung bình" },
  { value: "POOR", label: "Kém" },
];
