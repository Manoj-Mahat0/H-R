// MasterAdminAttendance.jsx
import React, { useMemo, useState, useEffect } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { useNavigate } from "react-router-dom";
import { API_HOST } from '../../lib/config.js';

/* Inline icons (no external dependency) */
function IconCalendar({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconPrev({ className = "w-4 h-4" }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconNext({ className = "w-4 h-4" }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function monthIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

/* Helper to call API: local fetch on localhost, otherwise use global authFetch if present */
async function apiGet(path) {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) {
    // If path already starts with /api, call local host
    const url = path.startsWith("http") ? path : `${API_HOST}${path}`;
    const token = localStorage.getItem("access_token");
    const res = await fetch(url, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      const err = new Error(txt || `Request failed ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  } else {
    // production: try to use authFetch global helper (matches your other pages)
    if (typeof authFetch === "function") {
      return await authFetch(path, { method: "GET" });
    }
    // fallback to same-origin fetch
    const res = await fetch(path, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      const err = new Error(txt || `Request failed ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
}

export default function AdminAttendance() {
  const today = new Date();
  const navigate = useNavigate();

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [counts, setCounts] = useState({}); // { '2025-09-01': 3, ... }
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthError, setMonthError] = useState(null);

  // build calendar matrix for current cursor month
  const monthMatrix = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const startWeekday = start.getDay(); // 0 Sun .. 6 Sat

    const days = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= end.getDate(); d++) days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (days.length % 7 !== 0) days.push(null);

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, [cursor]);

  function prevMonth() { setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1)); }
  function nextMonth() { setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1)); }

  function openDay(d) {
    if (!d) return;
    const iso = isoDate(d);
    navigate(`/admin/attendance/${iso}`);
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Fetch month counts when cursor changes
  useEffect(() => {
    let mounted = true;
    async function loadMonthCounts() {
      setLoadingMonth(true);
      setMonthError(null);
      setCounts({});
      const month = monthIso(cursor); // YYYY-MM
      try {
        // 1) Try month-summary endpoint first
        //    Expected response (example): { month: "2025-09", counts: { "2025-09-01": 3, ... } }
        const summaryPath = `/api/attendance/admin/by-month?month=${month}`;
        try {
          const summary = await apiGet(summaryPath);
          if (!mounted) return;
          // If the summary contains counts object, use it
          if (summary && typeof summary.counts === "object") {
            setCounts(summary.counts || {});
            setLoadingMonth(false);
            return;
          }
          // if response shape differs but has data, try to transform it
          // e.g., array of { day: '2025-09-01', count: 3 }
          if (Array.isArray(summary)) {
            const map = {};
            for (const item of summary) {
              if (item.day) map[item.day] = item.count ?? 0;
            }
            setCounts(map);
            setLoadingMonth(false);
            return;
          }
          // otherwise, fallthrough to per-day fetch
        } catch (err) {
          // if 404 or not implemented, fallback to per-day calls
          // console.info("Month summary not available, falling back to per-day fetch", err);
        }

        // 2) Fallback: fetch each day's /by-date endpoint and read `count`
        // Build list of day ISO strings for the month
        const days = [];
        const start = startOfMonth(cursor);
        const end = endOfMonth(cursor);
        for (let d = 1; d <= end.getDate(); d++) {
          const cur = new Date(cursor.getFullYear(), cursor.getMonth(), d);
          days.push(isoDate(cur));
        }

        // Fetch in batches to avoid overwhelming server
        const batchSize = 6;
        const resultMap = {};
        for (let i = 0; i < days.length; i += batchSize) {
          const batch = days.slice(i, i + batchSize);
          const promises = batch.map((dayIso) =>
            apiGet(`/api/attendance/admin/by-date?day=${dayIso}`)
              .then((j) => {
                resultMap[dayIso] = j?.count ?? 0;
              })
              .catch((e) => {
                // on error set 0 and continue
                resultMap[dayIso] = 0;
              })
          );
          // wait for batch
          // eslint-disable-next-line no-await-in-loop
          await Promise.all(promises);
          if (!mounted) return;
          // update partial counts so the UI can show progressive data
          setCounts((prev) => ({ ...prev, ...resultMap }));
        }
      } catch (e) {
        if (!mounted) return;
        setMonthError(e?.message || "Failed to load month counts");
      } finally {
        if (mounted) setLoadingMonth(false);
      }
    }

    loadMonthCounts();
    return () => {
      mounted = false;
    };
  }, [cursor]);

  return (
  <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
    <AdminSidebar />

    <main className="flex-1 p-6 md:p-8">
      {/* header */}
      <div className="mb-4 flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-600 to-emerald-400 text-white shadow-sm">
            <IconCalendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-gray-100">
              Attendance — Calendar
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Click a date to open the day details page.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm hover:shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600"
            aria-label="Previous month"
          >
            <IconPrev />
          </button>

          <div className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium text-slate-700 dark:text-gray-100 flex items-center gap-2">
            {loadingMonth ? <span className="text-xs text-slate-400 dark:text-gray-400">Loading month...</span> : null}
            {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>

          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm hover:shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600"
            aria-label="Next month"
          >
            <IconNext />
          </button>
        </div>
      </div>

      {/* actions */}
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/master-admin/attendance")}
          className="px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          All attendance
        </button>

        <button
          onClick={() => alert("CSV export not wired yet")}
          className="px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Export CSV
        </button>

        <div className="ml-auto text-xs text-slate-500 dark:text-gray-400">Tip: keyboard focus + Enter opens a day.</div>
      </div>

      {/* calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 transition-colors">
        <div className="grid grid-cols-7 gap-2 mb-3">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="text-center text-xs font-semibold text-slate-600 dark:text-gray-300">
              <div className="py-2 rounded-md bg-slate-50 dark:bg-gray-700/40">{w}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-3">
          {monthMatrix.map((week, wi) =>
            week.map((day, di) => {
              if (!day) {
                return <div key={`empty-${wi}-${di}`} className="h-24 rounded-md bg-transparent" />;
              }

              const key = isoDate(day);
              const isToday = isoDate(day) === isoDate(new Date());
              const badgeCount = counts[key] ?? 0;

              return (
                <button
                  key={key}
                  onClick={() => openDay(day)}
                  className={
                    "relative h-24 p-3 rounded-lg border flex flex-col justify-between text-left transition transform hover:-translate-y-0.5 hover:shadow-md focus:outline-none " +
                    "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 " +
                    "focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500"
                  }
                  aria-label={`Open attendance for ${day.toDateString()}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{day.getDate()}</div>
                      <div className="text-xs text-slate-400 dark:text-gray-400 mt-0.5">
                        {day.toLocaleString(undefined, { weekday: "short" })}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div
                        className={
                          "min-w-[30px] h-7 px-2 rounded-full text-xs font-medium flex items-center justify-center transition-colors " +
                          (badgeCount > 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-slate-50 text-slate-500 border border-slate-100 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-700")
                        }
                        title={loadingMonth ? "loading counts..." : `${badgeCount} present`}
                      >
                        {loadingMonth && !(key in counts) ? (
                          <span className="inline-block animate-pulse w-3 h-3 rounded-full bg-slate-300 dark:bg-gray-500" />
                        ) : (
                          badgeCount
                        )}
                      </div>

                      {isToday ? <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow" /> : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-gray-400">Open details</div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-gray-600" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {monthError ? (
          <div className="mt-3 text-xs text-red-600 dark:text-red-400">Month counts: {String(monthError)}</div>
        ) : null}
      </div>
    </main>
  </div>
);

}
