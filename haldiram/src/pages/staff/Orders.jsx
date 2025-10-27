// src/pages/staff/Orders.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import StaffSidebar from "../../components/StaffSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import {
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiTruck,
  FiPackage,
  FiUser,
  FiClock,
  FiFilter,
  FiX,
  FiDownload,
  FiList,
  FiBell,
  FiBellOff,
  FiSun,
  FiMoon
} from "react-icons/fi";

function fmtCurrency(val) {
  const num = Number(val ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(num);
  } catch {
    return `₹${num.toFixed(2)}`;
  }
}

function fmtDate(d) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("en-IN"); } catch { return d; }
}

function StatusBadge({ status }) {
  const map = {
    confirmed: { text: "Confirmed", bg: "bg-emerald-50 dark:bg-emerald-900/30", textClass: "text-emerald-700 dark:text-emerald-200" },
    placed: { text: "Placed", bg: "bg-blue-50 dark:bg-blue-900/30", textClass: "text-blue-700 dark:text-blue-200" },
    pending_payment: { text: "Pending Payment", bg: "bg-yellow-50 dark:bg-yellow-900/20", textClass: "text-yellow-700 dark:text-yellow-200" },
    paid: { text: "Paid", bg: "bg-green-50 dark:bg-green-900/20", textClass: "text-green-700 dark:text-green-200" },
    cancelled: { text: "Cancelled", bg: "bg-red-50 dark:bg-red-900/20", textClass: "text-red-700 dark:text-red-200" }
  };
  const cfg = map[status] || { text: status || "—", bg: "bg-gray-50 dark:bg-slate-800", textClass: "text-gray-700 dark:text-gray-200" };
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.textClass}`}>
      <span className="w-2 h-2 rounded-full" />
      {cfg.text}
    </span>
  );
}

export default function StaffOrders() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const toast = useToast();

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

  // Data
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  // UI
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // notification sound
  const audioRef = useRef(null);
  const prevOrdersRef = useRef({});
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem("staff_orders_sound_enabled") === "true";
    } catch {
      return false;
    }
  });

  const NOTIFY_AUDIO_PATH = "/sounds/mixkit-positive-notification-951.wav";

  async function apiRequest(path, { method = "GET", body = null } = {}) {
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API_HOST}${API_BASE}${path}`, {
      method,
      headers,
      body: body && !(body instanceof FormData) ? JSON.stringify(body) : body
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(data?.detail || data?.message || `Request failed: ${res.status}`);
    return data;
  }

  // initial load for orders (and set prevOrdersRef map)
  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      try {
        setLoading(true);
        const ordersData = await apiRequest("/new-orders/?limit=2000", { method: "GET" });
        if (!mounted) return;
        const arr = Array.isArray(ordersData) ? ordersData : [];
        setOrders(arr);
        const map = {};
        arr.forEach(o => { map[o.id] = o.status; });
        prevOrdersRef.current = map;
      } catch (err) {
        toast(err.message || "Failed to load orders", "error");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // load products
  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      try {
        setProductsLoading(true);
        let data = [];
        try {
          data = await apiRequest("/products-with-stock/products", { method: "GET" });
        } catch (e) {
          data = await apiRequest("/products", { method: "GET" });
        }
        if (!mounted) return;
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        toast(err.message || "Failed to load products", "error");
      } finally {
        setProductsLoading(false);
      }
    }
    loadProducts();
    return () => { mounted = false; };
  }, [token]);

  // load users
  useEffect(() => {
    let mounted = true;
    async function loadUsers() {
      try {
        setUsersLoading(true);
        const data = await apiRequest("/users/", { method: "GET" });
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        toast(err.message || "Failed to load users", "error");
      } finally {
        setUsersLoading(false);
      }
    }
    loadUsers();
    return () => { mounted = false; };
  }, [token]);

  const usersMap = useMemo(() => {
    const map = {};
    (users || []).forEach((u) => { if (u && typeof u.id !== "undefined") map[u.id] = u; });
    return map;
  }, [users]);

  const productsMap = useMemo(() => {
    const map = {};
    (products || []).forEach((p) => { if (p && typeof p.id !== "undefined") map[p.id] = p; });
    return map;
  }, [products]);

  // Only confirmed orders shown
  const confirmedOrders = useMemo(() => (orders || []).filter(o => o.status === "confirmed"), [orders]);

  // Search
  const filtered = useMemo(() => {
    if (!query.trim()) return confirmedOrders;
    const q = query.toLowerCase();
    return confirmedOrders.filter(o =>
      String(o.id).includes(q) ||
      (String(o.vendor_id).includes(q)) ||
      (o.items && o.items.some(it => String(it.product_id).includes(q)))
    );
  }, [confirmedOrders, query]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount]);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Quick stats
  const totalOrders = confirmedOrders.length;
  const totalQty = confirmedOrders.reduce((s, o) => s + (Array.isArray(o.items) ? o.items.reduce((ss, it) => ss + (Number(it.qty) || 0), 0) : 0), 0);
  const totalValue = confirmedOrders.reduce((s, o) => s + (Number(o.total_amount || o.total || 0) || 0), 0);

  // Polling: detect any order that transitioned INTO "confirmed"
  const pollingRef = useRef(null);
  useEffect(() => {
    // create audio element
    audioRef.current = new Audio(NOTIFY_AUDIO_PATH);
    audioRef.current.load();

    async function poll() {
      try {
        const latest = await apiRequest("/new-orders/?limit=2000", { method: "GET" });
        const arr = Array.isArray(latest) ? latest : [];
        setOrders(arr);

        const prevMap = prevOrdersRef.current || {};
        const becameConfirmed = [];
        const newMap = {};
        arr.forEach(a => {
          const id = a.id;
          const prevStatus = prevMap[id];
          const currStatus = a.status;
          if ((prevStatus !== "confirmed") && String(currStatus).toLowerCase() === "confirmed") {
            becameConfirmed.push(a);
          }
          newMap[id] = currStatus;
        });

        prevOrdersRef.current = newMap;

        if (becameConfirmed.length > 0) {
          if (soundEnabled && audioRef.current) {
            try {
              audioRef.current.currentTime = 0;
              await audioRef.current.play().catch((err) => {
                console.warn("Audio play blocked:", err);
                toast("Notification sound blocked by browser. Click the bell to enable sound after interacting with the page.", "info");
              });
            } catch (e) {
              console.warn("play error", e);
            }
          }

          becameConfirmed.slice(0, 3).forEach(n => {
            toast(`Order #${n.id} is now confirmed`, "success");
          });
        }
      } catch (err) {
        console.warn("poll error", err);
      }
    }

    poll();
    pollingRef.current = setInterval(poll, 10000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [token, soundEnabled, NOTIFY_AUDIO_PATH, toast]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem("staff_orders_sound_enabled", next ? "true" : "false"); } catch {}
    if (next && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800 transition-colors">
      <StaffSidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="flex items-center justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <FiList className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Confirmed Orders
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">Showing only confirmed orders. Total: <span className="font-semibold">{totalOrders}</span></p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
              <div className="text-xs text-gray-500 dark:text-gray-300">Total Qty</div>
              <div className="font-bold text-gray-900 dark:text-gray-100">{totalQty}</div>
            </div>
            <div className="text-right mr-4">
              <div className="text-xs text-gray-500 dark:text-gray-300">Total Value</div>
              <div className="font-bold text-indigo-600 dark:text-indigo-400">{fmtCurrency(totalValue)}</div>
            </div>

            <button
              onClick={() => { toast("Export not implemented", "info"); }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700"
            >
              <FiDownload className="w-4 h-4" /> Export
            </button>

            <button
              onClick={() => toggleSound()}
              title={soundEnabled ? "Disable notifications" : "Enable notifications"}
              className="ml-3 p-2 rounded-lg border hover:shadow-sm bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
            >
              {soundEnabled ? <FiBell className="w-5 h-5 text-green-600 dark:text-green-300" /> : <FiBellOff className="w-5 h-5 text-gray-400 dark:text-gray-300" />}
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setIsDark((v) => !v)}
              title={isDark ? "Switch to light" : "Switch to dark"}
              className="ml-3 inline-flex items-center gap-2 px-3 py-1 rounded-md border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm"
            >
              {isDark ? <FiSun className="w-4 h-4 text-yellow-400" /> : <FiMoon className="w-4 h-4 text-gray-600" />}
              <span className="text-xs text-gray-600 dark:text-gray-200">{isDark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-6 transition-colors">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-300" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by order id, vendor id or product id..."
                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-300">
                  <FiX />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                <FiFilter /> Filters
              </button>
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-300 rounded-lg border bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">Showing <strong>{filtered.length}</strong></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {loading || usersLoading || productsLoading ? (
            <div className="col-span-1 bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-gray-100 dark:border-slate-700">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mx-auto" />
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mx-auto" />
                <div className="h-48 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ) : pageItems.length === 0 ? (
            <div className="col-span-1 bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-gray-100 dark:border-slate-700">
              <div className="text-gray-500 dark:text-gray-300">No confirmed orders found.</div>
            </div>
          ) : (
            <div className="col-span-1 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageItems.map((o) => {
                const qty = Array.isArray(o.items) ? o.items.reduce((s, it) => s + (Number(it.qty) || 0), 0) : 0;
                return (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/staff/orders/${o.id}`)}
                    className="cursor-pointer group bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-xl transition-shadow duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                          #{o.id}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{usersMap[o.vendor_id]?.name || `Vendor #${o.vendor_id}`}</div>
                            <StatusBadge status={o.status} />
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-300 mt-2 flex items-center gap-2">
                            <FiClock className="w-4 h-4" /> {fmtDate(o.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmtCurrency(o.total_amount)}</div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                          <FiTruck className="w-4 h-4" /> {o.vehicle_id ? `Vehicle: ${o.vehicle_id}` : "No vehicle"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-300 mt-2">{qty} qty</div>
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-3 flex items-center justify-between border-gray-100 dark:border-slate-700">
                      <div className="text-xs text-gray-500 dark:text-gray-300">View details</div>
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                        Open <FiChevronRight />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-300">Page {page} of {pageCount}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 disabled:opacity-50"
            >
              <FiChevronLeft />
            </button>
            <div className="text-sm px-3 text-gray-700 dark:text-gray-200">{page}/{pageCount}</div>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="p-2 rounded border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 disabled:opacity-50"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
