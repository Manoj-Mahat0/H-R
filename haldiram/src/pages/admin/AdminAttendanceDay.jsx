import React, { useEffect, useState, useMemo, useCallback } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { authFetch } from "../../lib/auth";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from '../../lib/config.js';

/* ---- Inline icons ---- */
const IconBack = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconUser = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const IconClock = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
    <path d="M12 7v5l3 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconClear = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---- network helper ---- */
async function fetchAttendanceIso(iso) {
  if (!iso) return null;
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  try {
    const token = localStorage.getItem("access_token");
    const url = `${API_URL}/attendance/admin/by-date?day=${iso}`;
    const res = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || `Request failed ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.error("AttendanceDay fetch error", e);
    throw e;
  }
}

/* ---- helpers ---- */
const fmtLocal = (ts) => {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
};

const secondsToHHMM = (s) => {
  if (!s || s <= 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export default function AdminAttendanceDay() {
  const { day } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!day) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setData(null);
    setSelectedUserId(null);
    fetchAttendanceIso(day)
      .then((j) => {
        if (!mounted) return;
        setData(j);
        const first = Array.isArray(j?.users) && j.users.length > 0 ? j.users[0].user_id : null;
        setSelectedUserId(first);
      })
      .catch((e) => {
        console.error("AttendanceDay fetch error", e);
        if (mounted) setError(e?.message || "Failed to load");
      })
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, [day]);

  const usersList = useMemo(() => {
    if (!data || !Array.isArray(data.users)) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter((u) => (u.user_name || "").toLowerCase().includes(q) || String(u.user_id).includes(q));
  }, [data, filter]);

  const selectedUser = useMemo(() => {
    if (!data || !Array.isArray(data.users) || !selectedUserId) return null;
    return data.users.find((u) => u.user_id === selectedUserId) ?? null;
  }, [data, selectedUserId]);

  const onKeyLeftList = useCallback(
    (e) => {
      if (!usersList || usersList.length === 0) return;
      const idx = usersList.findIndex((u) => u.user_id === selectedUserId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(usersList.length - 1, Math.max(0, idx + 1));
        setSelectedUserId(usersList[next].user_id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(0, idx - 1);
        setSelectedUserId(usersList[prev].user_id);
      }
    },
    [usersList, selectedUserId]
  );

  return (
  <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 transition-colors">
    <AdminSidebar />
    <main className="flex-1 p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100">
            Attendance — <span className="text-indigo-600 dark:text-indigo-300">{day}</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            Click a user on the left to see detailed intervals on the right.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/master-admin/attendance")}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm text-sm hover:shadow transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500"
          >
            <IconBack /> Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="col-span-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-md overflow-hidden transition-colors">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search by name or ID"
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500 transition-colors"
              />
              {filter && (
                <button
                  onClick={() => setFilter("")}
                  aria-label="Clear filter"
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <IconClear className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="ml-2 text-sm text-slate-500 dark:text-gray-400">
              Total: <span className="font-medium text-slate-700 dark:text-gray-100">{data?.count ?? (data?.users?.length ?? 0)}</span>
            </div>
          </div>

          <div
            className="max-h-[72vh] overflow-auto"
            role="list"
            tabIndex={0}
            onKeyDown={onKeyLeftList}
          >
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-gray-400">Loading users...</div>
            ) : error ? (
              <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : usersList.length === 0 ? (
              <div className="p-4 text-sm text-slate-600 dark:text-gray-400">No users</div>
            ) : (
              usersList.map((u) => {
                const active = u.user_id === selectedUserId;
                const initials = (u.user_name || "U").slice(0, 1).toUpperCase();
                const activeHue = Math.min(220, Math.floor((u.total_seconds || 0) / 60));

                return (
                  <button
                    key={u.user_id}
                    onClick={() => setSelectedUserId(u.user_id)}
                    className={
                      `w-full text-left p-3 border-b flex items-start gap-3 transition-colors focus:outline-none ` +
                      (active
                        ? "bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800"
                        : "bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700")
                    }
                    aria-pressed={active}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, hsl(${activeHue} 80% 50%), hsl(${(activeHue + 40) % 360} 70% 45%))`,
                        color: "white",
                      }}
                    >
                      <span className="font-semibold">{initials}</span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{u.user_name || "Unknown"}</div>
                          <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">ID: {u.user_id ?? "-"}</div>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-gray-400 text-right">
                          <div className="font-medium text-indigo-600 dark:text-indigo-300">{secondsToHHMM(u.total_seconds)}</div>
                          <div className="text-xs text-slate-400 dark:text-gray-500">{u.intervals?.length ?? 0} intervals</div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="text-xs text-slate-400 dark:text-gray-500">
                          First: <span className="text-slate-700 dark:text-gray-100 font-medium">{fmtLocal(u.first_in_ist)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-md p-5 min-h-[60vh] transition-colors">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-indigo-600 border-slate-200 dark:border-gray-600" />
            </div>
          ) : error ? (
            <div className="p-4 text-red-600 dark:text-red-400">{error}</div>
          ) : !selectedUser ? (
            <div className="p-6 text-slate-600 dark:text-gray-400">Select a user on the left to view details.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)", color: "white" }}
                  >
                    <span className="font-bold text-xl">{(selectedUser.user_name || "U").slice(0, 1).toUpperCase()}</span>
                  </div>

                  <div>
                    <div className="text-xl font-bold text-slate-900 dark:text-gray-100">{selectedUser.user_name}</div>
                    <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                      ID: <span className="font-medium text-slate-700 dark:text-gray-100">{selectedUser.user_id}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 rounded">Total {secondsToHHMM(selectedUser.total_seconds)}</span>
                      <span className="px-2 py-1 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 rounded">{(selectedUser.intervals || []).length} intervals</span>
                    </div>
                  </div>
                </div>

                <div className="text-right text-sm text-slate-600 dark:text-gray-300">
                  <div>First in: <span className="font-medium text-slate-800 dark:text-gray-100">{fmtLocal(selectedUser.first_in_ist)}</span></div>
                  <div className="mt-1">Last out: <span className="font-medium text-slate-800 dark:text-gray-100">{fmtLocal(selectedUser.last_out_ist)}</span></div>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm font-medium text-slate-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-gray-700 px-2 py-1 rounded">
                    <IconClock /> Intervals ({(selectedUser.intervals || []).length})
                  </span>
                </div>

                {Array.isArray(selectedUser.intervals) && selectedUser.intervals.length > 0 ? (
                  <div className="space-y-3">
                    {selectedUser.intervals.map((iv, idx) => (
                      <div
                        key={`${selectedUser.user_id}-${iv.in_id ?? idx}`}
                        className="p-3 border rounded bg-gradient-to-r from-white to-slate-50 dark:from-gray-800 dark:to-gray-800 flex items-start justify-between gap-4 transition-colors"
                      >
                        <div>
                          <div className="text-sm text-slate-800 dark:text-gray-100 font-medium">In</div>
                          <div className="text-sm text-slate-600 dark:text-gray-400">{fmtLocal(iv.in_ts_ist)}</div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm text-slate-800 dark:text-gray-100 font-medium">Out</div>
                          <div className="text-sm text-slate-600 dark:text-gray-400">{fmtLocal(iv.out_ts_ist)}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-500 dark:text-gray-400">Duration</div>
                          <div className="font-semibold text-indigo-600 dark:text-indigo-300">{iv.duration_seconds ? secondsToHHMM(iv.duration_seconds) : "-"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-slate-600 dark:text-gray-400">No intervals recorded for this user.</div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  </div>
);

}
