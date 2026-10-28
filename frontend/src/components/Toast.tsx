import { createContext, useContext, useState } from "react";

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

  const push = (type: Toast["type"], message: string) => {
    const id = Date.now();
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 4000);
  };

  return (
    <ToastContext.Provider value={{ success: (m) => push("success", m), error: (m) => push("error", m) }}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg px-4 py-2 text-sm text-white shadow ${
              item.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("Toast missing");
  return ctx;
}
