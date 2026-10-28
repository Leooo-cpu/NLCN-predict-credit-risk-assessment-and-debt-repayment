FEATURE_LABELS = {
    "age": "Tuổi khách hàng",
    "monthly_income": "Thu nhập hàng tháng",
    "years_employed": "Thời gian làm việc",
    "requested_amount": "Số tiền vay đề nghị",
    "term_months": "Thời hạn vay (tháng)",
    "current_debt": "Tổng dư nợ hiện tại",
    "existing_loans": "Số khoản vay đang có",
    "late_payments": "Số lần chậm thanh toán",
    "dti": "Tỷ lệ nợ trên thu nhập (DTI)",
    "loan_to_income": "Tỷ lệ khoản vay trên thu nhập",
    "debt_burden": "Gánh nặng nợ (dư nợ + khoản vay mới)",
    "occupation": "Nghề nghiệp",
    "credit_history": "Lịch sử tín dụng",
    "purpose": "Mục đích vay",
}

CREDIT_HISTORY_VI = {"GOOD": "tốt", "FAIR": "trung bình", "POOR": "kém"}
PURPOSE_VI = {
    "TIEU_DUNG": "tiêu dùng",
    "MUA_NHA": "mua nhà",
    "MUA_XE": "mua xe",
    "GIAO_DUC": "giáo dục",
    "HOP_TAC_KINH_DOANH": "hợp tác / kinh doanh",
}


def human_feature_name(name: str) -> str:
    for key, label in FEATURE_LABELS.items():
        if name.startswith(key) or key in name:
            return label
    return name


def impact_description(feature: str, value, shap_value: float) -> str:
    direction = "làm tăng rủi ro vỡ nợ" if shap_value > 0 else "làm giảm rủi ro vỡ nợ"
    label = human_feature_name(feature)
    pretty_value = value
    if "credit_history" in feature:
        pretty_value = CREDIT_HISTORY_VI.get(str(value), value)
    if "purpose" in feature:
        pretty_value = PURPOSE_VI.get(str(value), value)
    return f"{label} = {pretty_value} {direction}."
