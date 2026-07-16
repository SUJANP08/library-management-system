import React, { useCallback, useEffect, useState } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error";
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return { toasts, showToast };
}

export function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[92%] max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl shadow-lg px-4 py-3 text-sm font-medium text-white flex items-center gap-2 ${
            t.type === "success" ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          <span>{t.type === "success" ? "✅" : "⚠️"}</span>
          <span className="flex-1">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
