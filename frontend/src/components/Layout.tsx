import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SidebarContent } from "./SidebarContent";
import { Disclaimer } from "./Disclaimer";

export function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef("");
  const main = useRef<HTMLElement>(null);
  const priorLocation = useRef(location.pathname);
  function close() {
    drawer.current?.close();
  }
  useEffect(() => {
    if (location.pathname !== priorLocation.current) {
      drawer.current?.close();
      main.current?.focus();
      priorLocation.current = location.pathname;
    }
  }, [location.pathname]);
  useEffect(() => {
    const element = drawer.current;
    return () => {
      if (element?.open)
        document.body.style.overflow = previousOverflow.current;
    };
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) drawer.current?.close();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const navigation = (
    <SidebarContent
      onNavigate={close}
      onLogout={() => {
        close();
        logout();
        navigate("/login");
      }}
    />
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)]">
      <a className="skip-link" href="#main-content">
        Chuyển đến nội dung chính
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-slate-900 p-5 text-white lg:flex">
        {navigation}
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
          <span className="text-sm font-semibold text-brand-900">
            CR / Rủi ro tín dụng
          </span>
          <button
            ref={trigger}
            type="button"
            className="btn-secondary"
            aria-haspopup="dialog"
            aria-controls="navigation-drawer"
            onClick={() => {
              previousOverflow.current = document.body.style.overflow;
              document.body.style.overflow = "hidden";
              drawer.current?.showModal();
            }}
          >
            ☰ <span>Menu</span>
          </button>
        </div>
        <main
          ref={main}
          id="main-content"
          tabIndex={-1}
          className="mx-auto min-w-0 max-w-screen-2xl space-y-6 p-4 pb-10 sm:p-6 lg:p-8"
        >
          <Disclaimer />
          <Outlet />
        </main>
        <footer className="border-t border-line px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
          Hệ thống hỗ trợ đánh giá rủi ro tín dụng · Niên luận KTPM
        </footer>
      </div>
      <dialog
        ref={drawer}
        id="navigation-drawer"
        aria-label="Menu điều hướng"
        className="m-0 h-dvh max-h-none w-80 max-w-full border-0 bg-slate-900 p-5 text-white"
        onClose={() => {
          document.body.style.overflow = previousOverflow.current;
          if (
            drawer.current?.contains(document.activeElement) ||
            document.activeElement === document.body
          )
            trigger.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "a[href], button:not(:disabled)",
            ),
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (
            event.target === drawer.current &&
            event.clientX >= drawer.current.getBoundingClientRect().right
          )
            close();
        }}
      >
        <div className="flex min-h-full flex-col">
          <button
            type="button"
            autoFocus
            className="btn mb-4 self-end border border-slate-600 text-white"
            onClick={close}
          >
            Đóng menu ×
          </button>
          {navigation}
        </div>
      </dialog>
    </div>
  );
}
