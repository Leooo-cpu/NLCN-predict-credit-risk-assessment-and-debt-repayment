import { useUsersPage } from "../hooks/useUsersPage";
import { Loading } from "../components/Loading";
import { Pager } from "../components/Pager";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  PageHeader,
  SearchInput,
} from "../components/UI";
import type { User } from "../types";
export function UsersPage() {
  const {
    validation,
    q,
    setQ,
    applied,
    form,
    setForm,
    creating,
    pending,
    createError,
    submitted,
    data,
    loading,
    error,
    load,
    onSubmit,
    toggle,
  } = useUsersPage();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý người dùng"
        description="Tra cứu tài khoản và quản lý quyền hoạt động của nhân viên."
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="card space-y-5" aria-label="Danh sách người dùng">
          <form
            className="toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              if (loading && submitted.current === q) return;
              submitted.current = q;
              void load(1, q);
            }}
          >
            <SearchInput
              label="Email hoặc họ tên"
              placeholder="Tìm người dùng"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
            <button className="btn-secondary">Tìm kiếm</button>
          </form>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} retry={() => load(applied.page)} />
          ) : (
            data && (
              <>
                {!data.items.length ? (
                  <EmptyState
                    title={
                      applied.q
                        ? "Không tìm thấy người dùng"
                        : "Chưa có người dùng"
                    }
                    description={
                      applied.q
                        ? "Thử email hoặc họ tên khác."
                        : "Các tài khoản sẽ xuất hiện tại đây."
                    }
                  />
                ) : (
                  <UsersTable
                    items={data.items}
                    pending={pending}
                    toggle={toggle}
                  />
                )}
                <Pager
                  page={applied.page}
                  pageSize={8}
                  total={data.total}
                  onPage={load}
                />
              </>
            )
          )}
        </section>
        <form
          className="card space-y-5"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          aria-busy={creating}
          onInvalid={validation.onInvalid}
        >
          <div>
            <h2>Tạo tài khoản nhân viên</h2>
            <p className="mt-2 field-hint">
              Tài khoản mới có vai trò OFFICER. Không thể tạo thêm Admin.
            </p>
          </div>
          <fieldset className="min-w-0 space-y-4" disabled={creating}>
            <legend className="sr-only">Thông tin tài khoản mới</legend>
            <FormField
              label="Họ tên"
              htmlFor="user-name"
              error={validation.errors["user-name"]}
            >
              <input
                id="user-name"
                {...validation.attributes("user-name")}
                className="input"
                autoComplete="name"
                required
                value={form.full_name}
                onChange={(event) => {
                  validation.clear("user-name");
                  setForm({ ...form, full_name: event.target.value });
                }}
              />
            </FormField>
            <FormField
              label="Email"
              htmlFor="user-email"
              error={validation.errors["user-email"]}
            >
              <input
                id="user-email"
                {...validation.attributes("user-email")}
                className="input"
                autoComplete="email"
                type="email"
                required
                value={form.email}
                onChange={(event) => {
                  validation.clear("user-email");
                  setForm({ ...form, email: event.target.value });
                }}
              />
            </FormField>
            <FormField
              label="Mật khẩu"
              htmlFor="user-password"
              error={validation.errors["user-password"]}
            >
              <input
                id="user-password"
                {...validation.attributes("user-password")}
                className="input"
                autoComplete="new-password"
                type="password"
                required
                value={form.password}
                onChange={(event) => {
                  validation.clear("user-password");
                  setForm({ ...form, password: event.target.value });
                }}
              />
            </FormField>
          </fieldset>
          {createError && <ErrorState message={createError} />}
          <button className="btn-primary w-full" disabled={creating}>
            {creating ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
          </button>
        </form>
      </div>
    </div>
  );
}

function UsersTable({
  items,
  pending,
  toggle,
}: {
  items: User[];
  pending: number[];
  toggle: (user: User) => Promise<void>;
}) {
  return (
    <DataTable label="Tài khoản người dùng">
      <table className="table">
        <caption>Danh sách tài khoản người dùng</caption>
        <thead>
          <tr>
            <th scope="col">Họ tên / Email</th>
            <th scope="col">Vai trò</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((user) => (
            <tr key={user.id}>
              <td className="min-w-48">
                <p className="font-medium">{user.full_name}</p>
                <p className="mt-1 break-all text-sm text-muted">
                  {user.email}
                </p>
              </td>
              <td>
                <span className="badge">{user.role}</span>
              </td>
              <td>
                <span
                  className={
                    user.is_active ? "text-emerald-800" : "text-slate-600"
                  }
                >
                  {user.is_active ? "Hoạt động" : "Khóa"}
                </span>
              </td>
              <td>
                {user.role === "ADMIN" ? (
                  <span className="text-xs text-muted">Admin được bảo vệ</span>
                ) : user.role === "OFFICER" ? (
                  <button
                    type="button"
                    disabled={pending.includes(user.id)}
                    className={
                      user.is_active
                        ? "btn-danger whitespace-nowrap"
                        : "btn-secondary whitespace-nowrap"
                    }
                    aria-label={`${user.is_active ? "Khóa" : "Mở khóa"} tài khoản ${user.full_name}`}
                    onClick={() => {
                      void toggle(user);
                    }}
                  >
                    {pending.includes(user.id)
                      ? "Đang xử lý…"
                      : user.is_active
                        ? "Khóa"
                        : "Mở khóa"}
                  </button>
                ) : (
                  <span className="text-xs text-muted">
                    Vai trò đã ngừng sử dụng
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}
