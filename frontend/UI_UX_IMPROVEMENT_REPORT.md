# Báo cáo nâng cấp Frontend UI/UX

Ngày thực hiện: 08/11/2026. Phạm vi: các màn hình đang được App.tsx định tuyến.
Skill áp dụng: frontend-ui-engineering.

## 1. Tổng quan thay đổi

Đã triển khai trực tiếp giao diện mới: sidebar xanh thương hiệu, drawer mobile/tablet, bố cục thống kê, header trang, biểu mẫu, bảng dữ liệu, phân trang và các trạng thái tương tác đồng nhất.

Giữ nguyên backend, API client, endpoint/payload/response contract, mô hình ML, công thức/giá trị dự đoán, auth context, role guards và route aliases. Không thêm thư viện UI hoặc dependency runtime/dev vào package.json; chỉ bổ sung script typecheck. Prettier chạy tạm thời qua npm exec, không cài vào dự án. Axe chỉ được inject trong phiên kiểm thử, không nằm trong ứng dụng.

### Cơ sở thiết kế và phạm vi

Tham chiếu nội bộ là các màn hình Dashboard, danh sách hồ sơ, form và Models hiện hữu trong source review; không có bộ thiết kế bên ngoài được cung cấp. Hợp đồng thiết kế:

- Công việc chính: tra cứu hồ sơ, nhập đúng định nghĩa đầu vào, đọc kết quả và lịch sử.
- Hành động chính: tìm hồ sơ / đánh giá và lưu; giữ đầy đủ thao tác hiện có.
- Màu: giữ brand blue; nền slate sáng, surface trắng, chữ slate đậm; trạng thái có chữ giải thích.
- Mật độ: bảng ưu tiên khả năng quét; form ưu tiên nhãn/hướng dẫn; không thêm hero, gradient hoặc biểu đồ diễn giải nghiệp vụ mới.
- Trạng thái: loading, error + retry cho đọc dữ liệu, empty, success, disabled/pending.
- Responsive: mobile một cột; tablet dùng drawer; desktop sidebar ổn định, bảng cuộn trong vùng riêng.

## 2. File đã chỉnh sửa / bổ sung

### File hiện có đã sửa

- package.json: thêm npm run typecheck.
- tailwind.config.js, src/index.css: semantic tokens, typography, spacing, controls và trạng thái.
- src/App.tsx: lazy loading theo route và Suspense; giữ guard và route.
- src/components/Layout.tsx: responsive shell, drawer, focus và skip link.
- src/components/Disclaimer.tsx: trình bày cảnh báo dễ đọc.
- src/components/Loading.tsx, Pager.tsx, Toast.tsx: trạng thái truy cập được, responsive, context ổn định.
- src/components/CreditCaseForm.tsx, CasePredictionCard.tsx: form/đơn vị/lỗi/khóa thao tác và kết quả có focus.
- src/pages/CreditDashboardPage.tsx.
- src/pages/CreditCaseListPage.tsx.
- src/pages/CreditCaseDetailPage.tsx.
- src/pages/CreditCaseHistoryPage.tsx.
- src/pages/CreditAssessmentPage.tsx.
- src/pages/UsersPage.tsx.
- src/pages/ModelsPage.tsx.
- src/pages/LoginPage.tsx.

### File mới

- src/components/UI.tsx: PageHeader, FormField, SearchInput, DataTable, EmptyState, ErrorState.
- src/components/SidebarContent.tsx: nội dung điều hướng dùng chung.
- src/hooks/useReadRequest.ts: latest-read-wins và mounted guard cho thao tác ghi.
- src/hooks/useCreditCaseForm.ts: state, validation hiện có và quy trình lưu/chấm điểm.
- src/hooks/useFormErrors.ts: trình bày lỗi constraint có sẵn của trình duyệt.
- src/hooks/useUsersPage.ts: request/state/thao tác quản lý người dùng.
- tests/ui-audit.browser.js: suite Playwright dùng API giả lập.
- test-results/ui-audit.json, supplementary-checks.json: kết quả kiểm chứng.
- test-results/dashboard-desktop.png, assessment-mobile.png: ảnh production preview.
- UI_UX_IMPROVEMENT_REPORT.md: báo cáo này.

Các chẩn đoán tự sinh bởi công cụ trình duyệt được lưu ở test-results/tool-diagnostics, không phải source ứng dụng.

### Bảo toàn working tree

Đã chạy git status trước khi sửa. Những mục có sẵn: frontend/tsconfig.json, .agents/, skills-lock.json.
Không chỉnh sửa/hoàn tác chúng. SHA-256 của tsconfig trước và sau đều là:

`4F3770871FFB92807F41AF9724A826C7792A40B9FD8515EB780A0B48F975041D`

Không commit hoặc push.

## 3. Đối chiếu review ban đầu

Trong bảng, “đã sửa” chỉ xác nhận triển khai và bằng chứng nêu ở cột cuối; kiểm thử API là giả lập.

| Vấn đề ban đầu | File chỉnh sửa | Cách khắc phục | Trạng thái | Cách kiểm chứng |
|---|---|---|---|---|
| Sidebar cố định 240px ở mọi màn hình | Layout, SidebarContent | Drawer dưới 1024px; sidebar 224/256px trên desktop | Đã sửa | 5 kích thước; mở/đóng, Escape, focus trap |
| Grid thiếu min-w-0, nội dung dễ đẩy rộng trang | Layout, index.css, các trang active | minmax(0,1fr), min-w-0, ngắt từ tiêu đề dài | Đã sửa | 55 tổ hợp không tràn ngang |
| Dashboard luôn 3 cột | CreditDashboardPage | 1 cột mobile, 2 cột tablet, 3 cột desktop rộng | Đã sửa | 320/375/768/1024/1440px |
| Users luôn 2 cột | UsersPage | 1 cột mặc định, 2 cột từ xl | Đã sửa | Responsive và ảnh/DOM |
| Bảng Models/Users thiếu vùng cuộn | UI, ModelsPage, UsersPage | DataTable có vùng cuộn và tên truy cập | Đã sửa | Không overflow trang, axe |
| Toolbar/nút/Pager dễ chật | index.css, Pager, trang active | Flex wrap, pager xếp dọc ở mobile | Đã sửa | 55 tổ hợp |
| JSX/API/state viết quá dày | CreditCase*, useCreditCaseForm, useUsersPage | Format; tách form controller, bảng và summary | Đã sửa | Typecheck/build, đối chiếu source |
| Nhúng page tạo hồ sơ gây hai tiêu đề cấp trang | CreditAssessmentPage, CreditCaseDetailPage | CreditCaseCreateContent riêng với page wrapper | Đã sửa | Tab nhập mới có đúng 1 h1 |
| CSS thiếu token ngữ nghĩa, focus/disabled không đồng nhất | tailwind.config, index.css | Token surface/canvas/ink/muted/line, trạng thái control chung | Đã sửa | Build, axe và kiểm tra ảnh |
| Users chưa có pending/khóa thao tác ghi | useUsersPage, UsersPage | Ref lock đồng bộ, pending theo tài khoản, fieldset disabled | Đã sửa | Double-submit chỉ 1 POST; toggle chỉ 1 PUT |
| Form lỗi ở cuối, thiếu liên kết trường | useCreditCaseForm, CreditCaseForm, UI | Native constraint + aria-invalid/describedby; map server loc; focus lỗi | Đã sửa | Native invalid và lỗi server 422 giả lập |
| Field tên vẫn sửa được khi gửi | CreditCaseForm | Fieldset khóa toàn bộ đầu vào lúc submit | Đã sửa | DOM disabled và gửi liên tiếp |
| History hiện empty khi đang tải | CreditCaseHistoryPage | Loading ngay lần đầu, empty chỉ sau response | Đã sửa | Mạng giả lập chậm |
| Dashboard/Models/danh sách thiếu lỗi tại chỗ/retry | Dashboard, Models, List, History, Detail, UI | ErrorState + retry đọc; không retry ghi tự động | Đã sửa | Lỗi 500 và retry giả lập |
| Empty tìm kiếm lẫn với chưa có dữ liệu | CreditCaseListPage, History, Users | Dựa trên bộ lọc đã áp dụng; nội dung riêng | Đã sửa | Empty dataset và no-match |
| Response cũ ghi đè dữ liệu mới | useReadRequest, trang active | AbortController; response/catch/finally chỉ cập nhật khi chưa abort | Đã sửa | Query old chậm 700ms, new nhanh 50ms |
| Input chỉ có placeholder | UI, Login, Users, List, History | Label hiển thị và kết nối input | Đã sửa | Kiểm tra DOM và axe |
| Toast/Loading thiếu live region | Toast, Loading | status/alert phù hợp, error toast có nút đóng và không tự mất | Đã sửa | Axe, DOM, thao tác thông báo |
| Heading dùng tên hệ thống làm h1, thiếu skip link | Layout, PageHeader, các trang | Tên hệ thống là text; h1 từng trang; skip link đến main | Đã sửa | Mỗi màn hình có 1 h1, axe |
| Chọn kết quả chưa thông báo/focus | CasePredictionCard, History, Detail | Focus heading kết quả khi người dùng chọn hoặc chấm điểm | Đã sửa | activeElement là tiêu đề kết quả |
| Bảng thiếu tên/ngữ cảnh thao tác | DataTable, các bảng active | caption, scope, tiêu đề thao tác và tên nút cụ thể | Đã sửa | Axe và kiểm tra semantic |
| Models phụ thuộc Toast Context không ổn định | Toast, ModelsPage | useCallback/useMemo; effect đọc phụ thuộc load ổn định, tách toast khỏi tải Models | Đã sửa | Toast hết hạn không refetch; lỗi không loop |
| Import tất cả trang trực tiếp | App | React.lazy/Suspense theo route | Đã sửa | Production chunk output |
| Lịch sử chi tiết render toàn bộ | CreditCaseDetailPage | Giữ thứ tự và API; chưa thêm virtualization khi chưa có bằng chứng cần | Giữ nguyên có chủ đích | Không benchmark lịch sử lớn |
| Không có script typecheck/lint/test riêng | package, tests | Thêm typecheck và browser suite; không thêm linter chưa có config | Một phần | Typecheck/build/suite qua; lint chưa có |
| 8 trang cũ chưa được router dùng | Không sửa | Giữ nguyên file/route hiện tại | Bảo toàn | Git diff không có các file cũ |

## 4. Cải tiến UI/UX bổ sung

- Icon menu SVG đồng nhất, active navigation có nền/chữ rõ, tài khoản và đăng xuất ở cuối sidebar.
- Chỉ số tabular-nums dễ so sánh; nhãn/giá trị/metadata có phân cấp.
- Gộp họ tên và email trong ô tài khoản nhưng giữ mọi thông tin và thao tác.
- Mô hình có thông tin ACTIVE, Cross Validation và registry tách rõ, giữ toàn bộ chỉ số/công thức/nội dung nghiệp vụ.
- Chi tiết hồ sơ và kết quả dùng definition list; phân biệt nhãn gốc, đầu vào thay đổi và dự đoán đã lưu.
- Đơn vị lấy từ schema hiện tại; không tự chuyển tiền sang VND, không thêm ngưỡng validation.
- Toast thành công tự đóng sau 6 giây; toast lỗi tồn tại đến khi đóng; cả hai có nhãn chữ, không chỉ dựa vào màu.
- Sửa lỗi phát hiện khi QA production: lớp toast động bị Tailwind loại bỏ; đã dùng class tường minh và kiểm chứng nền toast không trong suốt.

## 5. Responsive

Đã kiểm tra 11 màn hình × 5 chiều rộng = 55 tổ hợp, cộng trang login ở 5 chiều rộng.

- 320/375px: một cột, padding gọn, field/nút đủ rộng, drawer có focus trap.
- 768px: drawer để dành chiều rộng nội dung; form có thể chia hai cột; card thống kê 2 cột.
- 1024px: sidebar 224px; vùng main minmax(0,1fr).
- 1440px: sidebar 256px; dashboard 3 cột; Users bảng/form 2 cột.
- Bảng giữ cấu trúc bảng và cuộn ngang nội bộ; không ẩn cột hoặc bỏ thao tác.
- Pager xếp dọc khi thiếu chiều rộng.
- Kết quả đo documentElement.scrollWidth không vượt innerWidth trong các tổ hợp kiểm tra.

Dữ liệu thử gồm các giá trị/chuỗi đại diện, không phải toàn bộ dữ liệu thật.

## 6. Accessibility

Đã triển khai heading/landmark/label semantic, skip link, focus-visible, live region, field error description, table caption/scope và reduced-motion.

Drawer dùng dialog native, Escape, focus ban đầu, vòng Tab/Shift+Tab tường minh, trả focus sau đóng, khóa cuộn nền và khôi phục cuộn. Đóng khi chọn trang và khi chuyển sang breakpoint desktop.

Axe-core 4.10.3 chạy với wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa:

- 11 màn hình active.
- Drawer mobile đang mở.
- Login.
- Toast thành công đang hiển thị.
- Tổng 14 lượt, 0 violation tự động.

Đã phát hiện và sửa một thuộc tính ARIA bị cấm trên vùng toast, cùng lỗi Shift+Tab thoát vòng focus. Chưa kiểm tra bằng NVDA/VoiceOver; không tuyên bố chứng nhận tuân thủ WCAG hoàn toàn.

## 7. React, request handling và bundle

- Toast callbacks/context value ổn định; timer cleanup khi unmount, ID tăng dần tránh trùng Date.now.
- useReadRequest hủy request đọc trước và khi unmount; không cập nhật màn hình bằng response đã abort.
- Submit ghi có khóa ref đồng bộ; UI state pending riêng. Không tự động retry POST/PUT.
- Kết quả ghi chỉ cập nhật UI khi còn mounted; quy trình lưu đầu vào rồi chấm điểm vẫn giữ nguyên.
- Khi thao tác Users hoàn tất, reload theo bộ lọc mới nhất thay vì closure bộ lọc cũ.
- Không bổ sung global store, memo hàng loạt hoặc virtualization.

### So sánh production build

| Chỉ số | Trước | Sau |
|---|---:|---:|
| JS entry | 269,50 kB | 249,00 kB |
| JS entry gzip | 88,85 kB | 84,59 kB |
| CSS | 20,27 kB | 34,39 kB |
| CSS gzip | 4,16 kB | 6,28 kB |

JS entry giảm khoảng 7,6%; các màn hình còn lại tải theo route. Tổng JS của tất cả chunk tăng theo phạm vi UI/UX mới; không diễn giải việc giảm entry thành giảm tổng dung lượng toàn ứng dụng. CSS tăng do hệ thống trạng thái/responsive mới và Tailwind vẫn quét source các trang cũ được giữ nguyên. Chưa có phép đo thực tế LCP/INP hoặc React Profiler với dữ liệu thật.

## 8. Kết quả kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| npm run typecheck | PASS |
| npm run build | PASS, Vite 6.4.4 |
| git diff --check | PASS |
| Prettier trên file source đã sửa | Đã chạy, không tác động tsconfig hoặc 8 trang cũ |
| ESLint | Không chạy: dự án không có cấu hình/script/dependency linter |
| Browser suite chính | 110 kiểm tra qua |
| Kiểm tra bổ sung | 7 kiểm tra qua |
| Responsive | 55 tổ hợp + login ở 5 kích thước |
| Axe | 14 lượt, 0 violation tự động |
| Runtime | Không có uncaught JavaScript error trong suite |
| Network errors | Có 500/422 chủ động giả lập để kiểm thử error state; không coi là lỗi runtime ngoài dự kiến |
| Payload đánh giá | Đối chiếu inputs + expected_revision; một PUT lưu rồi một POST score |
| Chỉ lưu thông tin | Một PUT, không POST score |
| Double-submit Users | Một POST, role OFFICER giữ nguyên |
| Khóa tài khoản liên tiếp | Một PUT |
| Auth/permissions | Login/logout, OFFICER bị chặn Users, role cũ bị chặn writer route — API giả lập |
| Route aliases | /loans/new, /home-credit, /loans/:id/edit, /loans/:id/result giữ hành vi |
| Lỗi form | Native invalid + lỗi loc server 422 có focus/description; request thất bại giữ dữ liệu |
| Backend thật | Chưa kiểm chứng trong suite ban đầu; nhận định ban đầu về việc backend không chạy chưa đủ bằng chứng. Kiểm tra Docker sau đó xác nhận backend đang healthy. |

### Chạy lại

1. Trong frontend chạy `npm run typecheck`, `npm run build`.
2. Chạy `npm run preview -- --host 0.0.0.0 --port 5173`.
3. Dùng Playwright MCP `browser_run_code_unsafe` với filename trỏ đến `frontend/tests/ui-audit.browser.js`. File là biểu thức async function nhận page, không phải suite của @playwright/test; không cần cài dependency trình duyệt vào app.
4. Suite intercept toàn bộ /api/, chỉ ghi dữ liệu giả lập, không gọi backend thật. Cần mạng để lấy axe từ CDN trong môi trường kiểm thử.
5. Xem `test-results/ui-audit.json`, `supplementary-checks.json` và ảnh desktop/mobile. Bảy kiểm tra bổ sung được thực hiện trực tiếp trong phiên Playwright, chưa gộp vào suite chính.

Ảnh production đã được xem thủ công để kiểm tra phân cấp, spacing, sidebar, form mobile và vị trí bảng.

## 9. Chưa giải quyết / giới hạn

- Chưa chạy E2E với backend/database/ML thật. Phiên kiểm thử ban đầu dùng API giả lập; Docker CLI không có trong PATH của sandbox. Kiểm tra sau đó qua Docker Desktop xác nhận backend ở cổng 8000 đang healthy. Kiểm thử mock không chứng minh tính tương thích runtime của backend.
- Chưa kiểm tra Safari/iOS/Firefox hoặc thiết bị vật lý; bằng chứng hiện tại là Chromium.
- Chưa kiểm tra screen reader thủ công và các tác vụ WCAG cần đánh giá con người.
- Chưa benchmark danh sách lịch sử cực lớn, thiết bị yếu, LCP/INP hoặc hiệu năng mạng thực tế.
- Lint chưa có hạ tầng sẵn; đã có typecheck/build và formatter, không gọi chúng là lint.
- Giữ nguyên 8 trang legacy: CustomersPage, DashboardPage, HomeCreditPage, LoanDetailPage, LoanFormPage, LoansPage, PredictionHistoryPage, RiskAssessmentResultPage. Nợ kỹ thuật modal/chart/row-click trong các trang đó chưa được sửa hoặc kích hoạt lại.
- Không thêm confirmation dialog: không có luồng xác nhận mới được yêu cầu trong nghiệp vụ hiện tại.

## 10. Đề xuất tiếp theo — chưa triển khai

- Chạy cùng suite tình huống với backend và tài khoản thử nghiệm thật trong môi trường riêng.
- Kiểm tra NVDA/VoiceOver và Safari trên iPhone.
- Tích hợp Playwright/axe vào CI khi thống nhất công cụ và dependency test.
- Đo LCP/INP/React Profiler trên dữ liệu thật trước khi quyết định virtualization hoặc memoization thêm.
- Quyết định riêng về lưu trữ/migration 8 trang legacy; không xóa trong đợt này.

## 11. Cập nhật dịch vụ localhost:3000 sau phản hồi người dùng

Cổng 3000 ban đầu vẫn chạy container credit-risk-frontend từ image cũ, trả CSS index-CTbCT40e.css. Bản nâng cấp trước đó mới được build và kiểm thử bằng preview cổng 5173, chưa được cập nhật vào container này.

Đã chạy Docker Compose up -d --build --no-deps frontend qua Docker Desktop, chỉ recreate frontend. Backend/database/ML không được khởi động lại. Không sửa Dockerfile hoặc cấu hình dịch vụ.

Kiểm tra trực tiếp http://localhost:3000/login, không intercept API: HTTP 200; tiêu đề “Đăng nhập hệ thống”; label Email/Mật khẩu; CSS index-pEnEn97x.css và JS index-BnINuw6I.js. Xác nhận giao diện mới đã được phục vụ trên đúng URL người dùng sử dụng. Chưa chạy đăng nhập và toàn bộ E2E với backend thật.

Build Docker dùng Vite 6.4.5 do Dockerfile hiện hữu chạy npm install với dependency ranges, còn kiểm thử local dùng Vite 6.4.4. Số liệu bundle ở mục 7 là build local; entry Docker là 256,71 kB (gzip 87,33 kB). Đề xuất riêng về sau: dùng lockfile/npm ci để build tái lập; chưa thay đổi trong lần xử lý này.
