// src/pages/security/SecurityDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
    ChevronLeft, ChevronRight, CalendarCheck, Loader2, AlertTriangle, 
    ClipboardPen, Send, UserRoundCheck, UserRoundX, X, User 
} from "lucide-react"; // <-- Added new icons
import { authFetch } from "../lib/auth"; // <-- use your auth wrapper

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SecurityDashboard() {
  const navigate = useNavigate();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [loading, setLoading] = useState(false);
  const [attendance, setAttendance] = useState([]); // raw list from /all
  const [error, setError] = useState(null);

  // Modal state for Manual Punch
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalUsers, setModalUsers] = useState([]);
  const [formUserId, setFormUserId] = useState("");
  const [formType, setFormType] = useState("in"); // 'in' or 'out'
  const [formNote, setFormNote] = useState("Security Punch In");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState(null); // { type: 'success'|'error', text: '' }

  // load attendance (extracted so we can call it after punch)
  const loadAttendance = useCallback(async () => {
    let mounted = true;
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch("/attendance/all?page=1&per_page=2000", { method: "GET" });
      if (!mounted) return;
      setAttendance(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchAllAttendance Error:", err?.body ?? err?.message ?? err);
      const msg = err?.body?.detail || err?.message || "Failed to load attendance";
      if (mounted) setError(msg);
    } finally {
      if (mounted) setLoading(false);
    }
    // return () => (mounted = false); // Removed return from inner async function
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Map counts per date key 'YYYY-MM-DD'
  const countsByDate = useMemo(() => {
    const map = {};
    for (const rec of attendance) {
      const ts = rec.timestamp_ist ?? rec.timestamp_utc ?? "";
      const dateKey = typeof ts === "string" && ts.length >= 10 ? ts.slice(0, 10) : null;
      if (!dateKey) continue;
      map[dateKey] = (map[dateKey] || 0) + 1;
    }
    return map;
  }, [attendance]);

  // calendar helpers
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay(); // 0..6 (Sun=0, Sat=6)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const grid = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  const handlePrev = () => {
    setViewMonth((vm) => {
      if (vm === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return vm - 1;
    });
  };
  const handleNext = () => {
    setViewMonth((vm) => {
      if (vm === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return vm + 1;
    });
  };

  const monthLabel = firstOfMonth.toLocaleString(undefined, { month: "long", year: "numeric" });

  const onDateClick = (d) => {
    if (!d) return;
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const key = `${viewYear}-${mm}-${dd}`;
    navigate(`/security/attendance/${key}`);
  };

  // Open modal and fetch users for selection (security + staff)
  const openManualPunchModal = useCallback(async () => {
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setModalUsers([]);
    setFormUserId("");
    setFormType("in");
    setFormNote("Security Punch In");
    setFormMessage(null);

    try {
      const users = await authFetch("/users/", { method: "GET" });
      // filter only security and staff, and active
      const allowed = (Array.isArray(users) ? users : []).filter((u) => (u.role === "security" || u.role === "staff") && u.active);
      setModalUsers(allowed);
      if (allowed.length > 0) setFormUserId(String(allowed[0].id));
    } catch (e) {
      console.error("Failed to load users for manual punch", e);
      setModalError(e?.message || "Failed to load users");
    } finally {
      setModalLoading(false);
    }
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setModalUsers([]);
    setModalError(null);
    setFormUserId("");
    setFormNote("Security Punch In");
    setFormType("in");
    setFormSubmitting(false);
    setFormMessage(null);
  };

  // Submit punch-in/out
  const submitPunch = async () => {
    if (!formUserId) {
      setFormMessage({ type: "error", text: "Please select a user." });
      return;
    }
    setFormSubmitting(true);
    setFormMessage(null);
    try {
      const endpoint = formType === "in" ? "/attendance/punch-in" : "/attendance/punch-out";
      const body = { for_user_id: Number(formUserId), note: formNote || "" };
      const result = await authFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      setFormMessage({ type: "success", text: `Success! Punch ${formType === 'in' ? 'In' : 'Out'} recorded for ${modalUsers.find(u => String(u.id) === formUserId)?.name || 'user'}.` });

      // refresh attendance list so calendar updates
      await loadAttendance();

    } catch (e) {
      console.error("Punch error:", e);
      const msg = e?.body?.detail || e?.message || "Request failed";
      setFormMessage({ type: "error", text: msg });
    } finally {
      setFormSubmitting(false);
    }
  };

  // when the radio type changes, update the hard-coded note automatically
  useEffect(() => {
    if (formType === "in") setFormNote("Security Punch In");
    else setFormNote("Security Punch Out");
  }, [formType]);


  // --- COMPONENT RENDER ---

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header and Navigation */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CalendarCheck className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">Attendance Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Security log overview. Click a date to inspect records.</p>
            </div>
          </div>

          {/* Calendar Navigation + Manual Punch */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white p-1 rounded-full shadow-md border border-slate-200">
              <button
                onClick={handlePrev}
                aria-label="Previous month"
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors duration-150"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-3 py-1 font-semibold text-indigo-700 select-none">{monthLabel}</div>
              <button
                onClick={handleNext}
                aria-label="Next month"
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors duration-150"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={openManualPunchModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700 transition-colors"
            >
              <ClipboardPen className="w-5 h-5" />
              Manual Punch
            </button>
          </div>
        </div>

        {/* Calendar Grid Container (Unchanged) */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
          {loading ? (
            <div className="text-center py-12 text-indigo-500 flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p>Loading attendance records...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600 flex flex-col items-center bg-red-50 rounded-lg p-4">
              <AlertTriangle className="w-8 h-8 mb-3" />
              <p className="font-semibold">Error: {String(error)}</p>
              <p className="text-sm text-red-500 mt-1">Could not fetch data from the server.</p>
            </div>
          ) : (
            <>
              {/* Day Labels */}
              <div className="grid grid-cols-7 text-xs sm:text-sm text-slate-600 font-medium tracking-wider uppercase border-b pb-2 mb-3">
                {DAYS.map((d) => (
                  <div key={d} className="text-center">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-3">
                {grid.map((d, i) => {
                  if (d === null) return <div key={`blank-${i}`} className="h-24 sm:h-28" aria-hidden="true" />;

                  const mm = String(viewMonth + 1).padStart(2, "0");
                  const dd = String(d).padStart(2, "0");
                  const key = `${viewYear}-${mm}-${dd}`;
                  const count = countsByDate[key] || 0;
                  const isToday = key === new Date().toISOString().slice(0, 10);

                  let cardClass = "bg-white border-slate-200 text-slate-400 cursor-not-allowed";
                  let countElement = null;

                  if (count > 0) {
                    cardClass = "bg-indigo-50 border-indigo-200 hover:bg-indigo-100 active:bg-indigo-200 transition-all duration-150 ease-in-out cursor-pointer";
                    countElement =
                      count >= 5 ? (
                        <div className="text-white bg-indigo-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">
                          {count}
                        </div>
                      ) : (
                        <div className="text-indigo-600 font-semibold text-base">{count}</div>
                      );
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => onDateClick(d)}
                      disabled={!count}
                      className={`relative h-24 sm:h-28 p-3 text-left rounded-xl border-2 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-300 ${cardClass} ${
                        isToday ? "ring-2 ring-indigo-400 border-indigo-500" : ""
                      }`}
                    >
                      <div className={`text-xl font-bold ${count > 0 ? "text-slate-800" : "text-slate-400"}`}>{d}</div>

                      <div className="absolute bottom-3 right-3">{countElement}</div>

                      <div className="text-xs mt-1 sm:mt-2 absolute bottom-3 left-3">
                        {count > 0 ? (
                          <span className="font-medium text-indigo-700">
                            {count} {count > 1 ? "Records" : "Record"}
                          </span>
                        ) : (
                          <span className="text-slate-400">No Logs</span>
                        )}
                      </div>

                      {isToday && (
                        <span className="absolute top-0.5 right-0.5 text-xs bg-indigo-500 text-white font-semibold rounded-br-lg rounded-tl-lg px-2 py-0.5 shadow-md">
                          Today
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL: Manual Punch (UPDATED UI/UX) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl p-6 border border-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 border-b pb-3">
              <div className="flex items-center gap-3">
                <ClipboardPen className="w-6 h-6 text-violet-600" />
                <h3 className="text-xl font-bold text-slate-800">Manual Punch Entry</h3>
              </div>
              <button 
                onClick={closeModal} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {modalLoading ? (
                <div className="p-6 text-center text-sm text-violet-500 flex flex-col items-center">
                    <Loader2 className="w-5 h-5 animate-spin mb-2" />
                    Loading users...
                </div>
              ) : modalError ? (
                <div className="p-4 text-sm bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Error loading users: {modalError}
                </div>
              ) : modalUsers.length === 0 ? (
                <div className="p-4 text-sm bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                    No active security or staff users available for manual punch.
                </div>
              ) : (
                <form 
                    onSubmit={(e) => { e.preventDefault(); submitPunch(); }}
                    className="space-y-5"
                >
                  {/* User Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                        <User className="w-4 h-4 text-slate-500" />
                        Select User
                    </label>
                    <select
                      value={formUserId}
                      onChange={(e) => setFormUserId(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors shadow-sm"
                      required
                      disabled={formSubmitting}
                    >
                      <option value="" disabled>-- Select a Security/Staff User --</option>
                      {modalUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Punch Type Radio */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Punch Type</label>
                    <div className="flex items-center gap-4">
                      
                      {/* Punch In */}
                      <label 
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors w-1/2 justify-center ${
                            formType === "in" ? "bg-green-50 border-green-500 shadow-lg text-green-700" : "bg-white border-slate-200 text-slate-600 hover:border-green-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value="in"
                          checked={formType === "in"}
                          onChange={() => setFormType("in")}
                          className="hidden"
                          disabled={formSubmitting}
                        />
                        <UserRoundCheck className="w-5 h-5" />
                        <span className="font-semibold">Punch In</span>
                      </label>
                      
                      {/* Punch Out */}
                      <label 
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors w-1/2 justify-center ${
                            formType === "out" ? "bg-red-50 border-red-500 shadow-lg text-red-700" : "bg-white border-slate-200 text-slate-600 hover:border-red-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value="out"
                          checked={formType === "out"}
                          onChange={() => setFormType("out")}
                          className="hidden"
                          disabled={formSubmitting}
                        />
                        <UserRoundX className="w-5 h-5" />
                        <span className="font-semibold">Punch Out</span>
                      </label>
                    </div>
                  </div>

                  {/* Hard-coded note (read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        System Note
                    </label>
                    <input
                      type="text"
                      value={formNote}
                      readOnly
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 cursor-not-allowed text-slate-600"
                    />
                    <div className="text-xs text-slate-400 mt-1">This note is automatically set and cannot be changed.</div>
                  </div>

                  {/* Form Message */}
                  {formMessage && (
                    <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${formMessage.type === "error" ? "bg-red-100 text-red-800 border border-red-300" : "bg-emerald-100 text-emerald-800 border border-emerald-300"}`}>
                      {formMessage.type === "error" ? <AlertTriangle className="w-4 h-4" /> : <CalendarCheck className="w-4 h-4" />}
                      {formMessage.text}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 justify-end pt-2">
                    <button 
                      type="button"
                      onClick={closeModal} 
                      className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium bg-white hover:bg-slate-50 transition"
                      disabled={formSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={formSubmitting || !formUserId}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold shadow-md hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {formSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                        </>
                      ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Submit Punch {formType === "in" ? "In" : "Out"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}