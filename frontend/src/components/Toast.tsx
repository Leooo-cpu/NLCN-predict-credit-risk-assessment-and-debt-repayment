import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}
const ToastContext = createContext<{
  success: (message: string) => void;
  error: (message: string) => void;
} | null>(null);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const sequence = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);
  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach(clearTimeout);
      active.clear();
    };
  }, []);
  const push = useCallback(
    (type: Toast["type"], message: string) => {
      const id = ++sequence.current;
      setItems((previous) => [...previous, { id, type, message }]);
      if (type === "success")
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), 6000),
        );
    },
    [dismiss],
  );
  const success = useCallback(
    (message: string) => push("success", message),
    [push],
  );
  const error = useCallback(
    (message: string) => push("error", message),
    [push],
  );
  const value = useMemo(() => ({ success, error }), [success, error]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-label="Thông báo">
        {items.map((item) => (
          <div
            key={item.id}
            className={
              item.type === "success"
                ? "toast toast-success"
                : "toast toast-error"
            }
          >
            <p role={item.type === "error" ? "alert" : "status"}>
              <strong>
                {item.type === "success" ? "Thành công" : "Có lỗi xảy ra"}
              </strong>
              <span className="block mt-1">{item.message}</span>
            </p>
            <button
              type="button"
              className="toast-close"
              aria-label="Đóng thông báo"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("Toast missing");
  return context;
}
