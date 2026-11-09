// Presentation labels only. Keep the original feature keys in API requests.
const labels: Record<string, string> = {
  AMT_CREDIT: "Số tiền vay",
  AMT_ANNUITY: "Số tiền trả theo kỳ",
  DAYS_BIRTH: "Ngày sinh so với ngày nộp hồ sơ",
  DAYS_EMPLOYED: "Ngày bắt đầu làm việc so với ngày nộp hồ sơ",
  NAME_CONTRACT_TYPE: "Loại khoản vay",
  OCCUPATION_TYPE: "Nghề nghiệp",
};

export function creditLabel(key: string, fallback = "Thông tin bổ sung"): string {
  return labels[key] || fallback;
}

export const creditHints: Record<string, string> = {
  AMT_CREDIT: "Theo đơn vị tiền trong hồ sơ Home Credit gốc.",
  AMT_ANNUITY: "Theo hồ sơ gốc; không tự quy đổi thành khoản trả hằng tháng.",
  DAYS_BIRTH: "Nhập số ngày âm, tính từ ngày nộp hồ sơ.",
  DAYS_EMPLOYED: "Nhập số ngày âm, tính từ ngày nộp hồ sơ; nếu thiếu thông tin, chọn Không rõ.",
};
