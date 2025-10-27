// src/pages/staff/Dashboard.jsx
import React, { useEffect, useState } from "react";
import StaffSidebar from "../../components/StaffSidebar";
import { useAuth } from "../../context/AuthContext";
import { FiSun, FiMoon } from "react-icons/fi";

export default function StaffDashboard() {
  const { user } = useAuth();

  // Theme toggle (tailwind class strategy). Persists to localStorage.
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      <StaffSidebar />

      <main className="flex-1 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Staff Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Welcome, {user?.name ?? "—"}. This is your staff panel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm"
              title={isDark ? "Switch to light" : "Switch to dark"}
            >
              {isDark ? <FiSun className="w-4 h-4 text-yellow-400" /> : <FiMoon className="w-4 h-4 text-gray-600" />}
              <span className="text-xs text-gray-600 dark:text-gray-200">{isDark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-100 dark:border-slate-700 transition-colors">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Orders</h3>
            <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">--</p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-100 dark:border-slate-700 transition-colors">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Stock</h3>
            <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">--</p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-100 dark:border-slate-700 transition-colors">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Reports</h3>
            <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">--</p>
          </div>
        </div>
      </main>
    </div>
  );
}
