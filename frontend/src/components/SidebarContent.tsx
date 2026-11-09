import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
const links = [
  {
    to: "/",
    label: "Tổng quan",
    path: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  },
  {
    to: "/customers",
    label: "Khách hàng",
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    to: "/loans",
    label: "Hồ sơ và dự đoán",
    path: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  },
  {
    to: "/risk-assessment",
    label: "Đánh giá rủi ro",
    writer: true,
    path: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM8 12l3 3 5-6",
  },
  {
    to: "/predictions",
    label: "Lịch sử dự đoán",
    path: "M3 12a9 9 0 1 0 3-6.7M3 3v5h5M12 7v5l3 2",
  },
  {
    to: "/models",
    label: "Mô hình",
    path: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  },
  {
    to: "/users",
    label: "Người dùng",
    admin: true,
    path: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3M9 18h6",
  },
];
export function SidebarContent({
  onNavigate,
  onLogout,
}: {
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const { user } = useAuth();
  const writer = user?.role === "ADMIN" || user?.role === "OFFICER";
  return (
    <>
      <div className="border-b border-slate-700 pb-6">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold"
            aria-hidden="true"
          >
            CR
          </span>
          <div>
            <p className="font-semibold text-white">Rủi ro tín dụng</p>
            <p className="mt-1 text-xs text-slate-300">Home Credit · KTPM</p>
          </div>
        </div>
      </div>
      <nav aria-label="Điều hướng chính" className="mt-6 flex-1 space-y-1">
        {links
          .filter(
            (link) =>
              (!link.writer || writer) &&
              (!link.admin || user?.role === "ADMIN"),
          )
          .map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-active" : ""}`
              }
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={link.path} />
              </svg>
              <span>{link.label}</span>
            </NavLink>
          ))}
      </nav>
      <div className="mt-8 min-w-0 border-t border-slate-700 pt-5">
        <p className="break-words text-sm font-semibold text-white">
          {user?.full_name}
        </p>
        <p className="mt-1 break-all text-xs text-slate-300">{user?.email}</p>
        <p className="mt-3 text-xs font-medium text-slate-300">{user?.role}</p>
        <button
          type="button"
          className="mt-4 btn w-full border border-slate-600 text-slate-100 hover:bg-slate-800"
          onClick={onLogout}
        >
          Đăng xuất
        </button>
      </div>
    </>
  );
}
