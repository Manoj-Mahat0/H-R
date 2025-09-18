// src/components/Toast.jsx
import React, { createContext, useContext, useState } from "react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  function addToast(message, type = "success", ttl = 3000) {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s, { id, message, type }]);
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), ttl);
  }

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm px-4 py-2 rounded shadow text-sm text-white ${
              t.type === "error" ? "bg-red-600" : "bg-green-600"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const add = useContext(ToastContext);
  if (!add) throw new Error("useToast must be used inside ToastProvider");
  return add;
}
