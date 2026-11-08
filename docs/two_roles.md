# Hai vai trò hoạt động

- ADMIN: giữ quyền quản trị người dùng, mô hình và nghiệp vụ.
- OFFICER: nhập/sửa hồ sơ khách hàng, chạy dự đoán và xem lịch sử; không quản trị người dùng.
- Khách hàng là bản ghi nghiệp vụ, không phải tài khoản đăng nhập.

Trang đăng nhập chỉ có hai tài khoản demo `admin@credit-risk.com` và `officer@credit-risk.com`.
Tự đăng ký chỉ cho phép OFFICER. API quản lý người dùng chỉ chấp nhận ADMIN/OFFICER;
API từ chối VIEWER, RISK_VIEWER và tên cũ CREDIT_OFFICER khi tạo/đổi vai trò.

## Database đang có dữ liệu

Dự án dùng `init_db()` khi khởi động, trước đây chưa có Alembic. Luồng này nay gọi
`app.migrations.apply_migrations()` trong transaction và lưu phiên bản
`20261108_two_active_roles` ở `schema_migrations`. PostgreSQL có advisory lock để
tránh hai worker áp dụng đồng thời. Migration chạy kể cả `SEED_ON_STARTUP=false`.

- Chuyển CREDIT_OFFICER thành OFFICER, giữ ID, email, mật khẩu băm và trạng thái.
- Đặt `is_active=false` cho mọi tài khoản VIEWER/RISK_VIEWER, gồm tài khoản demo
  `viewer@credit-risk.com` hoặc `viewer@credit-risk.local` nếu có.
- Giữ nguyên vai trò Viewer trên bản ghi cũ để đọc lịch sử, không đổi thành ADMIN/OFFICER.
- Không xóa tài khoản, audit log, hồ sơ, kết quả, database hoặc volume.
- CHECK constraint chỉ cho ADMIN/OFFICER hoạt động; vai trò Viewer cũ chỉ được giữ khi đã khóa.
- Backend kiểm tra trạng thái và vai trò trong database trên mọi request, gồm `/api/auth/me`.
  Token Viewer phát trước migration cũng bị từ chối. JWT của Officer cũ tiếp tục dùng
  quyền hiện tại trong database, không lấy quyền từ role claim cũ.
- Quản lý người dùng vẫn xem được tài khoản lịch sử nhưng không có nút mở khóa;
  API cũng từ chối mở khóa/chuyển vai trò của tài khoản đã ngừng sử dụng.

Trong PowerShell tại thư mục repo, cập nhật dịch vụ bằng:

```powershell
docker compose up -d --build backend frontend
docker compose exec -T postgres psql -U credit_user -d credit_risk -c "SELECT id,email,role,is_active FROM users ORDER BY id; SELECT version FROM schema_migrations;"
```

Giữ nguyên volume; không dùng `down -v`. Backend seed chỉ tạo Admin/Officer khi thiếu,
không tạo lại Viewer và không đặt lại mật khẩu tài khoản hiện có.

## Kiểm thử

```powershell
docker compose run --rm --no-deps -e ML_INTEGRATION_URL=http://ml-service:8001 -v "${PWD}/backend/tests:/app/tests:ro" backend pytest -q tests
```

Các kiểm thử dùng SQLite riêng; integration test dùng ML đang chạy để tạo hồ sơ,
dự đoán và đọc lại lịch sử trong database kiểm thử, không tạo dữ liệu thử trong PostgreSQL chính.
Kiểm thử bao gồm migration lặp lại, giữ thông tin tài khoản/audit log, chặn token Viewer,
từ chối gán vai trò cũ qua API, quyền tạo hồ sơ/dự đoán của Officer và chặn người chưa đăng nhập.

## Kết quả xác minh ngày 08/11/2026

- Toàn bộ 30 kiểm thử backend đạt; bao gồm hai integration test với ML thật và SQLite riêng.
- TypeScript `tsc --noEmit` và Docker build backend/frontend đạt.
- API thật: Admin đăng nhập/me/danh sách hồ sơ/quản lý người dùng HTTP 200.
- API thật: Officer đăng nhập trả OFFICER, me/danh sách hồ sơ HTTP 200; quản lý người dùng HTTP 403.
- Token Viewer được cấp trước cập nhật: me HTTP 200 trước migration, me và danh sách hồ sơ HTTP 401 sau migration.
- Viewer đăng nhập mới HTTP 401; tạo/tự đăng ký/gán VIEWER hoặc RISK_VIEWER đều HTTP 400; mở khóa Viewer HTTP 400.
- Chưa đăng nhập: xem hồ sơ/chạy score HTTP 401; UI chuyển trang đánh giá về đăng nhập.
- UI: không có nút demo Viewer; biểu mẫu quản lý người dùng chỉ có ADMIN/OFFICER; Officer mở được biểu mẫu đánh giá và không có menu quản lý người dùng.
- Database thật: Admin ID 1 giữ ADMIN; nhân viên ID 2 chuyển OFFICER; Viewer ID 3 giữ RISK_VIEWER và is_active=false.
- So sánh trước/sau: ID/email/mật khẩu băm không đổi, giữ 307.511 hồ sơ, 2 dự đoán, số audit log không giảm.
- Đã áp dụng Docker mới, không thay model hoặc chạy lại đánh giá Test.

## Các tệp thay đổi

- [backend/app/core/roles.py](../backend/app/core/roles.py)
- [backend/app/database.py](../backend/app/database.py)
- [backend/app/dependencies.py](../backend/app/dependencies.py)
- [backend/app/migrations.py](../backend/app/migrations.py)
- [backend/app/models/user.py](../backend/app/models/user.py)
- [backend/app/routers/auth.py](../backend/app/routers/auth.py)
- [backend/app/routers/credit_cases.py](../backend/app/routers/credit_cases.py)
- [backend/app/routers/customers.py](../backend/app/routers/customers.py)
- [backend/app/routers/dashboard.py](../backend/app/routers/dashboard.py)
- [backend/app/routers/home_credit.py](../backend/app/routers/home_credit.py)
- [backend/app/routers/loans.py](../backend/app/routers/loans.py)
- [backend/app/routers/models.py](../backend/app/routers/models.py)
- [backend/app/routers/users.py](../backend/app/routers/users.py)
- [backend/app/schemas/auth.py](../backend/app/schemas/auth.py)
- [backend/app/seed.py](../backend/app/seed.py)
- [backend/tests/conftest.py](../backend/tests/conftest.py)
- [backend/tests/test_credit_cases.py](../backend/tests/test_credit_cases.py)
- [backend/tests/test_customers_and_rbac.py](../backend/tests/test_customers_and_rbac.py)
- [backend/tests/test_demo_accounts.py](../backend/tests/test_demo_accounts.py)
- [backend/tests/test_home_credit.py](../backend/tests/test_home_credit.py)
- [backend/tests/test_two_roles.py](../backend/tests/test_two_roles.py)
- [database/init.sql](../database/init.sql)
- [database/seed.sql](../database/seed.sql)
- [docs/api.md](api.md)
- [docs/architecture.md](architecture.md)
- [docs/bao-cao-nien-luan.md](bao-cao-nien-luan.md)
- [docs/home_credit_customer_flow.md](home_credit_customer_flow.md)
- [docs/home_credit_release.md](home_credit_release.md)
- [docs/two_roles.md](two_roles.md)
- [frontend/src/App.tsx](../frontend/src/App.tsx)
- [frontend/src/components/Layout.tsx](../frontend/src/components/Layout.tsx)
- [frontend/src/pages/CreditCaseDetailPage.tsx](../frontend/src/pages/CreditCaseDetailPage.tsx)
- [frontend/src/pages/CreditCaseListPage.tsx](../frontend/src/pages/CreditCaseListPage.tsx)
- [frontend/src/pages/CustomersPage.tsx](../frontend/src/pages/CustomersPage.tsx)
- [frontend/src/pages/LoanDetailPage.tsx](../frontend/src/pages/LoanDetailPage.tsx)
- [frontend/src/pages/LoansPage.tsx](../frontend/src/pages/LoansPage.tsx)
- [frontend/src/pages/LoginPage.tsx](../frontend/src/pages/LoginPage.tsx)
- [frontend/src/pages/RiskAssessmentResultPage.tsx](../frontend/src/pages/RiskAssessmentResultPage.tsx)
- [frontend/src/pages/UsersPage.tsx](../frontend/src/pages/UsersPage.tsx)
- [frontend/src/types.ts](../frontend/src/types.ts)
- [README.md](../README.md)
