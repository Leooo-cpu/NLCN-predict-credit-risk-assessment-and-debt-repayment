import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Disclaimer } from "./Disclaimer";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-brand-600 text-white" : "text-slate-200 hover:bg-slate-700"}`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-slate-900 p-4 text-white">
        <h1 className="text-lg font-semibold leading-tight">Rủi ro tín dụng</h1>
        <p className="mt-1 text-xs text-slate-400">Hệ thống hỗ trợ · Niên luận KTPM</p>
        <nav className="mt-6 space-y-1">
          <NavLink to="/" className={linkClass} end>
            Dashboard
          </NavLink>
          <NavLink to="/customers" className={linkClass}>
            Khách hàng
          </NavLink>
          <NavLink to="/loans" className={linkClass}>
            Hồ sơ vay
          </NavLink>
          <NavLink to="/risk-assessment" className={linkClass}>
            Đánh giá rủi ro
          </NavLink>
          <NavLink to="/predictions" className={linkClass}>
            Lịch sử dự đoán
          </NavLink>
          <NavLink to="/models" className={linkClass}>
            Mô hình
          </NavLink>
          {user?.role === "ADMIN" && (
            <NavLink to="/users" className={linkClass}>
              Người dùng
            </NavLink>
          )}
        </nav>
        <div className="mt-8 text-xs text-slate-400">
          <div className="font-medium text-slate-200">{user?.full_name}</div>
          <div>{user?.email}</div>
          <div className="mt-1">{user?.role}</div>
          <button
            className="mt-3 btn-ghost w-full text-slate-800"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="p-6 space-y-4">
        <Disclaimer />
        <Outlet />
      </main>
    </div>
  );
}
