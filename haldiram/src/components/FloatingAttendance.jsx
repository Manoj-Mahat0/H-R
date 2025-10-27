// FloatingActionsWithPunchToast.jsx
import React, { useState, useRef } from "react";
import { FiMessageCircle, FiClock, FiX } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import ChatFloating from "./Chat"; // match the chat component you provided
import { API_URL } from '../lib/config.js';

const FAB_SIZE = 56; // px
const GAP = 12; // px between FABs
const TOAST_LIFETIME = 4500;

export default function FloatingActionsWithPunchToast({ day }) {
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const [punchOpen, setPunchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(1);

  // Configure where attendance FAB should be hidden
  const HIDE_ATTENDANCE_ON = ["/security/dashboard", "/security/attendance/:day"];
  const path = location.pathname || "";

  // convert pattern -> regex, support "*" and ":param"
  const patternToRegex = (pattern) => {
    const speciallyEscaped = pattern.replace(/([.+^${}()|[\]\\])/g, "\\$1");
    const withWildcard = speciallyEscaped.replace(/\*/g, ".*");
    const finalRegex = withWildcard.replace(/:([^\/]+)/g, "[^/]+");
    return new RegExp(`^${finalRegex}$`);
  };

  const hideAttendance = HIDE_ATTENDANCE_ON.some((pattern) => {
    try {
      const re = patternToRegex(pattern);
      return re.test(path);
    } catch {
      return pattern === path;
    }
  });

  // Toast helper
  const pushToast = (message, type = "info") => {
    const id = toastIdRef.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_LIFETIME);
  };

  // Geolocation helper
  const getLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const handlePunch = async (type) => {
    if (!isAuthenticated) {
      alert("You must be logged in to punch attendance");
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const url = `${API_URL}/attendance/punch-${type}`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to punch attendance");
      }

      const data = await res.json();
      setMessage(data.message);
      setType(type);
      setShowToast(true);
      fetchStatus(); // Refresh status after successful punch
    } catch (err) {
      console.error("Attendance punch error:", err);
      setMessage(err.message || "Failed to punch attendance");
      setType("error");
      setShowToast(true);
    }
  };

  const closeAll = () => {
    setPunchOpen(false);
    setChatOpen(false);
  };

  return (
    <>
      {/* backdrop + blur when any panel open */}
      {(punchOpen || chatOpen) && (
        <div
          className="fixed inset-0 z-[48] bg-black/20 dark:bg-black/40 backdrop-blur-sm"
          onClick={closeAll}
          aria-hidden="true"
        />
      )}

      {/* container that keeps FABs perfectly stacked */}
      <div className="fixed right-6 bottom-6 z-50" style={{ pointerEvents: "none" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            gap: `${GAP}px`,
            alignItems: "flex-end",
          }}
        >
          {/* Chat panel (rendered only when open) */}
          {chatOpen && (
            <div className="mb-3" style={{ pointerEvents: "auto" }}>
              <ChatFloating onClose={() => setChatOpen(false)} />
            </div>
          )}

          {/* Punch modal (rendered only when punchOpen) */}
          {punchOpen && (
            <div
              className="mb-3 flex justify-end"
              style={{ pointerEvents: "auto" }}
              onClick={() => setPunchOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 ring-1 ring-gray-100 dark:ring-gray-700"
                style={{ width: 360, maxWidth: "92vw", minWidth: 280 }}
                role="dialog"
                aria-modal="true"
                aria-label="Attendance punch dialog"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Attendance Punch</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{day ?? "Today"}</div>
                  </div>
                  <button
                    onClick={() => setPunchOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label="Close attendance dialog"
                  >
                    <FiX className="text-gray-700 dark:text-gray-200" />
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <button
                    disabled={busy}
                    onClick={() => punch("in")}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {busy ? "Processing..." : "Punch In"}
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => punch("out")}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    {busy ? "Processing..." : "Punch Out"}
                  </button>
                </div>

                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Location is fetched from your browser. Allow location permission when prompted.
                </div>
              </div>
            </div>
          )}

          {/* FAB stack (pointer events enabled only on buttons) */}
          <div
            style={{
              alignItems: "flex-end",
              display: "flex",
              flexDirection: "column-reverse",
              gap: `${GAP}px`,
            }}
            className="pointer-events-auto"
          >
            {/* Chat FAB (always visible) */}
            <button
              onClick={() => {
                setChatOpen((v) => !v);
                if (!chatOpen) setPunchOpen(false);
              }}
              aria-label="Open Chat"
              title="Chat"
              style={{
                width: FAB_SIZE,
                height: FAB_SIZE,
                borderRadius: 9999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              className="bg-blue-600 dark:bg-blue-500 text-white shadow-lg ring-1 ring-blue-200 dark:ring-blue-900 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
            >
              <FiMessageCircle size={22} />
            </button>

            {/* Attendance FAB (conditionally hidden on configured paths) */}
            {!hideAttendance && (
              <button
                onClick={() => {
                  setPunchOpen((v) => !v);
                  if (!punchOpen) setChatOpen(false);
                }}
                aria-label="Open Attendance"
                title="Attendance"
                style={{
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  borderRadius: 9999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                className="bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg ring-1 ring-emerald-200 dark:ring-emerald-900 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-300"
              >
                <FiClock size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOASTS (top-right) */}
      <div className="fixed top-6 right-6 z-60 flex flex-col items-end gap-3" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-[320px] w-full rounded-lg px-4 py-2 shadow-lg text-sm ring-1
              ${t.type === "success" ? "bg-green-50 ring-green-200 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
              ${t.type === "error" ? "bg-red-50 ring-red-200 text-red-800 dark:bg-red-900 dark:text-red-100" : ""}
              ${t.type === "info" ? "bg-blue-50 ring-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-100" : ""}
            `}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">{t.message}</div>
              <button
                onClick={() => setToasts((curr) => curr.filter((x) => x.id !== t.id))}
                aria-label="Dismiss toast"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FiX className="text-gray-600 dark:text-gray-200" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
