import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import { ErrorState, FormField } from "../components/UI";
import { useMounted } from "../hooks/useReadRequest";
import { useFormErrors } from "../hooks/useFormErrors";
import type { Role } from "../types";
const demoAccounts = [
  { label: "Admin", email: "admin@credit-risk.com", password: "Admin@123456" },
  {
    label: "Officer",
    email: "officer@credit-risk.com",
    password: "Officer@123456",
  },
];
export function LoginPage() {
  const validation = useFormErrors();
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const mounted = useMounted();
  const lock = useRef(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("officer@credit-risk.com");
  const [password, setPassword] = useState("Officer@123456");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("OFFICER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim().toLowerCase(), password);
        toast.success("Đăng nhập thành công");
        navigate("/");
      } else {
        await register({ email, password, full_name: fullName, role });
        if (mounted.current) {
          toast.success("Đăng ký thành công, hãy đăng nhập");
          setMode("login");
        }
      }
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      lock.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600 font-bold text-white"
          >
            CR
          </span>
          <div>
            <p className="font-semibold text-brand-900">Rủi ro tín dụng</p>
            <p className="text-xs text-muted">Home Credit · Niên luận KTPM</p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className="card space-y-5"
          aria-busy={loading}
          onInvalid={validation.onInvalid}
        >
          <div>
            <h1 className="text-2xl">
              {mode === "login" ? "Đăng nhập hệ thống" : "Đăng ký tài khoản"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Hỗ trợ đánh giá rủi ro tín dụng
            </p>
          </div>
          <fieldset className="min-w-0 space-y-4" disabled={loading}>
            <legend className="sr-only">
              Thông tin {mode === "login" ? "đăng nhập" : "đăng ký"}
            </legend>
            {mode === "register" && (
              <>
                <FormField
                  label="Họ tên"
                  htmlFor="full-name"
                  error={validation.errors["full-name"]}
                >
                  <input
                    id="full-name"
                    {...validation.attributes("full-name")}
                    className="input"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => {
                      validation.clear("full-name");
                      setFullName(event.target.value);
                    }}
                    required
                  />
                </FormField>
                <FormField label="Vai trò" htmlFor="role">
                  <select
                    id="role"
                    className="input"
                    value={role}
                    onChange={(event) => setRole(event.target.value as Role)}
                  >
                    <option value="OFFICER">Cán bộ tín dụng</option>
                  </select>
                </FormField>
              </>
            )}
            <FormField
              label="Email"
              htmlFor="email"
              error={validation.errors["email"]}
            >
              <input
                id="email"
                {...validation.attributes("email")}
                className="input"
                autoComplete="username"
                type="email"
                value={email}
                onChange={(event) => {
                  validation.clear("email");
                  setEmail(event.target.value);
                }}
                required
              />
            </FormField>
            <FormField
              label="Mật khẩu"
              htmlFor="password"
              error={validation.errors["password"]}
            >
              <input
                id="password"
                {...validation.attributes("password")}
                className="input"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                type="password"
                value={password}
                onChange={(event) => {
                  validation.clear("password");
                  setPassword(event.target.value);
                }}
                required
              />
            </FormField>
          </fieldset>
          {error && <ErrorState message={error} />}
          <button className="btn-primary w-full" disabled={loading}>
            {loading
              ? "Đang xử lý…"
              : mode === "login"
                ? "Đăng nhập"
                : "Đăng ký"}
          </button>
          <button
            type="button"
            className="text-link text-sm"
            disabled={loading}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login"
              ? "Chưa có tài khoản? Đăng ký"
              : "Đã có tài khoản? Đăng nhập"}
          </button>
          {mode === "login" && (
            <div className="space-y-3 border-t border-line pt-4">
              <p className="field-hint">
                Điền nhanh tài khoản demo, sau đó bấm Đăng nhập:
              </p>
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="btn-ghost w-full flex-wrap text-left"
                  disabled={loading}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError("");
                  }}
                >
                  <span>{account.label}:</span>
                  <span className="break-all font-normal">{account.email}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
