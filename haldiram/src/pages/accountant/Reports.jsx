// src/pages/accountant/Reports.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AccountantSidebar from "../../components/AccountantSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import {
  FiSearch,
  FiDownload,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiCopy,
  FiList,
  FiPackage,
  FiClock
} from "react-icons/fi";

/**
 * Accountant Reports (row-wise view)
 * - Shows only orders with status === "Processing"
 * - Item preview shows: product name, GST rate, and unit price (prefers item.unit_price then product.price)
 * - Invoice modal JSON includes description (product name), gst_rate and unit_price
 *
 * Dark mode: toggles `document.documentElement.classList` "dark". Expects Tailwind `darkMode: "class"`.
 */

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

export default function AccountantReports() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Invoice modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceJsonString, setInvoiceJsonString] = useState("");
  const [invoiceOrderId, setInvoiceOrderId] = useState(null);

  // theme initialization (runtime class)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch (e) {}
  }, []);

  function toggleTheme() {
    try {
      const next = !document.documentElement.classList.contains("dark");
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch (e) {}
  }

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

  // Load orders
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingOrders(true);
      try {
        const data = await apiRequest("/new-orders/?limit=2000", { method: "GET" });
        if (!mounted) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("orders load", err);
        toast(err.message || "Failed to load orders", "error");
        setOrders([]);
      } finally {
        if (mounted) setLoadingOrders(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]); // eslint-disable-line

  // Load users
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingUsers(true);
      try {
        const data = await apiRequest("/users/", { method: "GET" });
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("users load", err);
        toast(err.message || "Failed to load users", "error");
        setUsers([]);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]); // eslint-disable-line

  // Load products
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingProducts(true);
      try {
        const data = await apiRequest("/products/", { method: "GET" });
        if (!mounted) return;
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("products load", err);
        toast(err.message || "Failed to load products", "error");
        setProducts([]);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]); // eslint-disable-line

  const usersMap = useMemo(() => {
    const m = {};
    (users || []).forEach(u => { if (u && typeof u.id !== "undefined") m[u.id] = u; });
    return m;
  }, [users]);

  const productsMap = useMemo(() => {
    const m = {};
    (products || []).forEach(p => { if (p && typeof p.id !== "undefined") m[p.id] = p; });
    return m;
  }, [products]);

  // only processing orders (case-insensitive)
  const processingOrders = useMemo(() => (orders || []).filter(o => String(o.status || "").toLowerCase() === "processing"), [orders]);

  // filter/search
  const filtered = useMemo(() => {
    if (!query.trim()) return processingOrders;
    const q = query.trim().toLowerCase();
    return processingOrders.filter(o => {
      if (String(o.id).includes(q)) return true;
      if (String(o.vendor_id).includes(q)) return true;
      if ((o.shipping_address || "").toLowerCase().includes(q)) return true;
      if (Array.isArray(o.items) && o.items.some(it => String(it.product_id).includes(q) || String(it.notes || "").toLowerCase().includes(q))) return true;
      return false;
    });
  }, [processingOrders, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount]);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => {
    const totalOrders = filtered.length;
    const totalQty = filtered.reduce((s, o) => s + (Array.isArray(o.items) ? o.items.reduce((ss, it) => ss + (Number(it.qty) || 0), 0) : 0), 0);
    const totalValue = filtered.reduce((s, o) => s + (Number(o.total_amount || o.total || 0) || 0), 0);
    return { totalOrders, totalQty, totalValue };
  }, [filtered]);

  // Build invoice JSON (includes product name, gst_rate, unit_price)
  const buildInvoiceJson = useCallback((order) => {
    if (!order) return null;
    const invoiceId = `INV-${new Date().toISOString().slice(0,10)}-${order.id}`;
    const items = (Array.isArray(order.items) ? order.items : []).map(it => {
      const p = productsMap[it.product_id] || {};
      const unitPrice = Number(it.unit_price ?? p.price ?? 0);
      const qty = Number(it.qty ?? 0);
      const subtotal = Number(it.subtotal ?? (unitPrice * qty));
      return {
        item_id: it.id,
        product_id: it.product_id,
        sku: p.sku ?? null,
        description: p.name ?? `Product #${it.product_id}`,
        qty,
        unit_price: unitPrice,
        subtotal,
        gst_rate: p.gst_rate ?? null,
        notes: it.notes ?? ""
      };
    });

    const taxable = items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    const totalTax = items.reduce((s, i) => {
      const rate = Number(i.gst_rate ?? 0);
      return s + ((Number(i.subtotal) || 0) * rate / 100);
    }, 0);

    return {
      invoice_id: invoiceId,
      order_id: order.id,
      invoice_date: new Date(order.created_at || Date.now()).toISOString(),
      currency: "INR",
      vendor: { id: order.vendor_id, name: usersMap[order.vendor_id]?.name ?? `Vendor #${order.vendor_id}` },
      customer: {
        id: order.customer_id ?? null,
        name: order.customer_name ?? null,
        shipping_address: order.shipping_address ?? null,
        phone: order.customer_phone ?? null,
        email: order.customer_email ?? null
      },
      items,
      tax_summary: { taxable_value: Number(taxable.toFixed(2)), total_tax: Number(totalTax.toFixed(2)) },
      shipping: 0,
      discount_total: 0,
      total_amount: Number((taxable + totalTax).toFixed(2)),
      notes: order.notes ?? "Staff generated invoice",
      meta: { vehicle_id: order.vehicle_id ?? null, source: "accountant_reports_modal" }
    };
  }, [productsMap, usersMap]);

  function openInvoiceModal(order) {
    const payload = buildInvoiceJson(order);
    const pretty = JSON.stringify(payload, null, 2);
    setInvoiceJsonString(pretty);
    setInvoiceOrderId(order.id);
    setInvoiceModalOpen(true);
  }

  async function copyInvoiceJson() {
    try {
      await navigator.clipboard.writeText(invoiceJsonString);
      toast("JSON copied to clipboard", "success");
    } catch (err) {
      console.error("copy failed", err);
      toast("Failed to copy JSON", "error");
    }
  }

  function downloadInvoiceJson() {
    const blob = new Blob([invoiceJsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-order-${invoiceOrderId || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Download started", "success");
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800 transition-colors">
      <AccountantSidebar />
      <main className="flex-1 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <FiList className="w-7 h-7 text-indigo-600" /> Accountant Reports
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">Showing only orders with <strong>Processing</strong> status.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Processing Orders</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{totals.totalOrders}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Qty</div>
              <div className="text-lg font-bold text-indigo-600">{totals.totalQty}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Value</div>
              <div className="text-lg font-bold text-green-600">{fmtCurrency(totals.totalValue)}</div>
            </div>

            <button onClick={() => toast("Export CSV not changed", "info")} className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">
              <FiDownload className="w-4 h-4" /> Export CSV
            </button>

            
          </div>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-4 mb-6 flex items-center gap-4 transition-colors">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order id, vendor id, product id, address or notes..."
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* List (row-wise) */}
        <div className="space-y-4">
          {(loadingOrders || loadingUsers || loadingProducts) ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center transition-colors">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mx-auto" />
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mx-auto" />
                <div className="h-40 bg-gray-200 dark:bg-slate-700 rounded mt-6" />
              </div>
            </div>
          ) : pageItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center transition-colors">
              <div className="text-gray-500 dark:text-gray-300">No processing orders found.</div>
            </div>
          ) : (
            pageItems.map(o => {
              const qty = Array.isArray(o.items) ? o.items.reduce((s, it) => s + (Number(it.qty) || 0), 0) : 0;
              const vendor = usersMap[o.vendor_id];
              return (
                <div key={o.id} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-lg transition-shadow duration-150 flex flex-col md:flex-row md:items-center gap-4">
                  {/* Left: basic info */}
                  <div className="flex items-center gap-4 min-w-0 md:flex-1">
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                      #{o.id}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{vendor?.name || `Vendor #${o.vendor_id}`}</div>
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-50 dark:bg-yellow-600/20 text-yellow-800 dark:text-yellow-200 font-semibold">{o.status}</span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-300 mt-1 flex items-center gap-3">
                        <div className="flex items-center gap-1"><FiClock /> <span>{fmtDate(o.created_at)}</span></div>
                        <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-400">• {o.items?.length ?? 0} items</div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-300 mt-2 truncate">{o.shipping_address ?? "-"}</div>
                    </div>
                  </div>

                  {/* Middle: items preview (shows name, gst_rate, and unit price) */}
                  <div className="flex-1 overflow-x-auto">
                    <div className="flex gap-3 items-center">
                      {Array.isArray(o.items) && o.items.length > 0 ? (
                        o.items.map(it => {
                          const p = productsMap[it.product_id] || {};
                          const unitPrice = Number(it.unit_price ?? p.price ?? 0);
                          return (
                            <div key={it.id} className="min-w-[180px] bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-700 rounded-lg p-3 transition-colors">
                              <div className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">{p.name ?? `Product #${it.product_id}`}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">SKU: {p.sku ?? "-"}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">GST: <span className="font-semibold">{p.gst_rate ?? "—"}%</span></div>
                              <div className="text-sm font-semibold mt-2 text-gray-900 dark:text-gray-100">{it.qty} × {fmtCurrency(unitPrice)}</div>
                              <div className="text-xs text-gray-400 dark:text-gray-300 mt-1">{fmtCurrency(it.subtotal ?? (unitPrice * (Number(it.qty)||0)))}</div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-300">No items</div>
                      )}
                    </div>
                  </div>

                  {/* Right: totals & actions */}
                  <div className="flex flex-col items-end gap-3 md:items-end">
                    <div className="text-right">
                      <div className="text-sm font-bold text-indigo-600">{fmtCurrency(o.total_amount ?? o.total ?? 0)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-300">Qty: <span className="font-semibold text-gray-900 dark:text-gray-100">{qty}</span></div>
                      <div className="text-xs text-gray-400 dark:text-gray-300 mt-1">Vehicle: {o.vehicle_id ?? "—"}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => openInvoiceModal(o)} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm">Invoice</button>
                      <button onClick={() => navigate(`/staff/orders/${o.id}`)} className="px-3 py-1 border rounded-lg text-sm bg-white dark:bg-slate-700">Details</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-300">Page {page} of {pageCount}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded border disabled:opacity-50"><FiChevronLeft /></button>
            <div className="px-3 text-sm">{page}/{pageCount}</div>
            <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="p-2 rounded border disabled:opacity-50"><FiChevronRight /></button>
          </div>
        </div>
      </main>

      {/* Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setInvoiceModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden transition-colors">
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                  <FiPackage />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">Invoice JSON Preview</div>
                  <div className="text-sm text-gray-500 dark:text-gray-300">Order #{invoiceOrderId}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyInvoiceJson} className="px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center gap-2"><FiCopy /> Copy</button>
                <button onClick={downloadInvoiceJson} className="px-3 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2"><FiDownload /> Download</button>
                <button onClick={() => setInvoiceModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"><FiX /></button>
              </div>
            </div>

            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">This JSON is generated from the order and products data (includes product name & gst_rate when available). You can POST this JSON to your invoice API.</div>
              <pre className="max-h-[60vh] overflow-auto bg-gray-900 text-gray-100 p-4 rounded-lg text-sm">
                {invoiceJsonString}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
