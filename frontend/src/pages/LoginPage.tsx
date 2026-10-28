import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import type { Role } from "../types";

export function LoginPage() {
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("officer@credit-risk.local");
  const [password, setPassword] = useState("Officer@123456");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("CREDIT_OFFICER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Đăng nhập thành công");
        navigate("/");
      } else {
        await register({ email, password, full_name: fullName, role });
        toast.success("Đăng ký thành công, hãy đăng nhập");
        setMode("login");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Hỗ trợ đánh giá rủi ro tín dụng</h1>
          <p className="text-sm text-slate-500">Niên luận KTPM · Dữ liệu mô phỏng</p>
        </div>
        {mode === "register" && (
          <>
            <input className="input" placeholder="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="CREDIT_OFFICER">Cán bộ tín dụng</option>
              <option value="RISK_VIEWER">Người xem rủi ro</option>
            </select>
          </>
        )}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"}
        </button>
        <button type="button" className="text-sm text-brand-600" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </button>
        <p className="text-xs text-slate-500">
          Demo: admin@credit-risk.local / Admin@123456 · officer@credit-risk.local / Officer@123456 · viewer@credit-risk.local / Viewer@123456
        </p>
      </form>
    </div>
  );
}
