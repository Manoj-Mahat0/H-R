// src/pages/staff/OrderDetail.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import StaffSidebar from "../../components/StaffSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import {
  FiArrowLeft,
  FiPackage,
  FiUser,
  FiClock,
  FiTruck,
  FiEdit,
  FiSearch,
  FiChevronDown,
  FiChevronUp,
  FiInfo,
  FiCalendar,
  FiPhone,
  FiMapPin,
  FiTag,
  FiDollarSign,
  FiPlus,
  FiTrash2,
  FiX,
  FiSave,
  FiCheck,
  FiSun,
  FiMoon
} from "react-icons/fi";

/**
 * OrderDetail (staff)
 * - Left: products (search + expand -> batches + Add button)
 * - Right: order details, items list
 * - Edit mode: inline edit items (qty, unit_price), remove, add product, save/cancel
 */

/* ...existing helper functions (fmtCurrency, fmtDate, getItemQty, getProductStock, stockLevelClass) remain unchanged... */

// small formatters
function fmtCurrency(val) {
  const num = Number(val ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₹${num.toFixed(2)}`;
  }
}
function fmtDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("en-IN");
  } catch {
    return d;
  }
}

// robust qty reader
function getItemQty(it) {
  if (!it) return 0;

  // common candidate keys
  const candidates = [
    "qty",
    "quantity",
    "final_qty",
    "original_qty",
    "requested_qty",
    "ordered_qty",
    "count",
    "amount",
    "units",
  ];

  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(it, k)) {
      const v = it[k];
      if (v !== null && v !== undefined && v !== "") {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
      }
    }
  }

  // infer from subtotal/unit_price
  if (it.subtotal != null && it.unit_price != null) {
    const unit = Number(it.unit_price);
    const subtotal = Number(it.subtotal);
    if (unit > 0 && Number.isFinite(subtotal)) {
      const inferred = subtotal / unit;
      if (Number.isFinite(inferred)) return Math.round(inferred);
    }
  }

  // last resort: find any sensible integer value
  for (const v of Object.values(it)) {
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n) && n >= 0 && n <= 1000000 && Math.abs(n - Math.round(n)) < 1e-6) {
      return Math.round(n);
    }
  }

  return 0;
}

// stock helpers
function getProductStock(p) {
  if (!p) return 0;
  return Number(
    p.stocklevel_quantity ??
      p.stock ??
      p.available_qty ??
      p.available ??
      p.quantity ??
      p.qty ??
      p.count ??
      p.in_stock ??
      0
  );
}
function stockLevelClass(stock) {
  if (stock <= 0) return { bg: "bg-red-500", text: "text-red-700" };
  if (stock <= 5) return { bg: "bg-orange-400", text: "text-orange-800" };
  if (stock <= 19) return { bg: "bg-yellow-400", text: "text-yellow-800" };
  if (stock <= 49) return { bg: "bg-blue-400", text: "text-blue-800" };
  return { bg: "bg-green-500", text: "text-green-800" };
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const toast = useToast();
  const mountedRef = useRef(true);

  // Theme toggle (tailwind 'class' strategy). Persists to localStorage.
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

  // data
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // left UI
  const [productSearch, setProductSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [batchesMap, setBatchesMap] = useState({});
  const [prodLoadingBatches, setProdLoadingBatches] = useState({});

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState([]); // local copy of items for editing
  const [saving, setSaving] = useState(false);

  // API helper
  async function apiRequest(path, { method = "GET", body = null } = {}) {
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API_HOST}${API_BASE}${path}`, {
      method,
      headers,
      body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) throw new Error(data?.detail || data?.message || `Request failed: ${res.status}`);
    return data;
  }

  // load order
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        setLoadingOrder(true);
        const data = await apiRequest(`/new-orders/${id}`);
        if (!mountedRef.current) return;
        setOrder(data);
        console.debug("Loaded order items:", data?.items);
      } catch (err) {
        console.error("load order", err);
        toast(err.message || "Failed to load order", "error");
      } finally {
        if (mountedRef.current) setLoadingOrder(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [id, token]);

  // load products
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingProducts(true);
        let data = [];
        try {
          data = await apiRequest("/products-with-stock/products");
        } catch (e) {
          data = await apiRequest("/products");
        }
        if (cancelled) return;
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("load products", err);
        toast(err.message || "Failed to load products", "error");
        setProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const productsMap = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => {
      if (p && typeof p.id !== "undefined") m[p.id] = p;
    });
    return m;
  }, [products]);

  const totals = useMemo(() => {
    if (!order || !Array.isArray(order.items)) return { qty: 0, subtotal: 0 };
    let qty = 0,
      subtotal = 0;
    order.items.forEach((it) => {
      const q = getItemQty(it);
      const u = Number(it.unit_price ?? 0);
      qty += q;
      subtotal += Number(it.subtotal ?? u * q);
    });
    return { qty, subtotal };
  }, [order]);

  // helper to fetch batches
  async function fetchBatches(productId) {
    if (!productId) return;
    if (batchesMap[productId]) return;
    setProdLoadingBatches((p) => ({ ...p, [productId]: true }));
    try {
      const data = await apiRequest(`/products-with-stock/stock/batches/${productId}`);
      setBatchesMap((m) => ({ ...m, [productId]: Array.isArray(data) ? data : [data] }));
    } catch (err) {
      console.warn("batches fetch", err);
      setBatchesMap((m) => ({ ...m, [productId]: [] }));
    } finally {
      setProdLoadingBatches((p) => ({ ...p, [productId]: false }));
    }
  }

  // Filtered products
  const filteredProducts = useMemo(() => {
    const s = String(productSearch || "").trim().toLowerCase();
    if (!s) return products;
    return (products || []).filter(
      (p) =>
        p.name?.toLowerCase().includes(s) ||
        String(p.id).includes(s) ||
        (p.sku && p.sku.toLowerCase().includes(s))
    );
  }, [products, productSearch]);

  // --- Edit mode helpers ---
  function enterEditMode() {
    if (!order) return;
    // clone server items into editItems with stable tempId for new ones
    const seed = (order.items || []).map((it) => ({
      tempId: `i-${it.id}`,
      id: it.id,
      product_id: it.product_id,
      qty: getItemQty(it),
      unit_price: Number(it.unit_price ?? 0),
      notes: it.notes ?? "",
    }));
    setEditItems(seed);
    setIsEditing(true);
  }

  function cancelEdits() {
    setEditItems([]);
    setIsEditing(false);
  }

  function updateEditItem(idx, patch) {
    setEditItems((rows) => {
      const copy = [...rows];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  function removeEditItem(idx) {
    setEditItems((rows) => {
      const copy = [...rows];
      copy.splice(idx, 1);
      return copy;
    });
  }

  function addProductToEdit(product) {
    if (!product) return;
    setEditItems((rows) => {
      // prevent duplicate of same product? (we allow duplicates for now)
      const row = {
        tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        product_id: product.id,
        qty: 1,
        unit_price: Number(product.price ?? product.unit_price ?? 0),
        notes: "",
      };
      return [...rows, row];
    });
  }

  function validateEditItems() {
    if (!Array.isArray(editItems) || editItems.length === 0) {
      toast("At least one item required", "error");
      return false;
    }
    for (let i = 0; i < editItems.length; i++) {
      const r = editItems[i];
      if (!r.product_id && r.product_id !== 0) {
        toast(`Product required for row ${i + 1}`, "error");
        return false;
      }
      const q = Number(r.qty);
      if (!Number.isFinite(q) || q <= 0) {
        toast(`Qty must be > 0 for row ${i + 1}`, "error");
        return false;
      }
      const up = Number(r.unit_price);
      if (!Number.isFinite(up) || up < 0) {
        toast(`Unit price must be >= 0 for row ${i + 1}`, "error");
        return false;
      }
    }
    return true;
  }

  async function submitEdits() {
    if (!order) return;
    if (!validateEditItems()) return;

    try {
      setSaving(true);

      // build items array the server expects
      const itemsPayload = editItems.map((r) => ({
        product_id: Number(r.product_id),
        qty: Number(r.qty),
        unit_price: Number(r.unit_price),
        notes: r.notes ?? "ok",
      }));

      const payload = {
        items: itemsPayload,
        // preserve address or hard-code as you asked; here we preserve shipping_address
        shipping_address: order.shipping_address ?? "",
        // hard-coded staff fields as per your request
        notes: "Staff Edit",
        status: "Processing",
      };

      const res = await apiRequest(`/new-orders/${order.id}`, {
        method: "PATCH",
        body: payload,
      });

      // server responded with updated order — replace local order, exit edit mode
      setOrder(res);
      setIsEditing(false);
      setEditItems([]);
      toast("Order updated", "success");
      console.debug("Updated order:", res);
    } catch (err) {
      console.error("submitEdits err", err);
      toast(err.message || "Failed to update order", "error");
    } finally {
      setSaving(false);
    }
  }

  // UI skeleton while loading
  if (loadingOrder || loadingProducts) {
    return (
      <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors">
        <StaffSidebar />
        <main className="flex-1 p-6 md:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/3 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-4 w-1/4 bg-gray-200 dark:bg-slate-700 rounded mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-96 bg-gray-200 dark:bg-slate-700 rounded-xl" />
              <div className="h-96 bg-gray-200 dark:bg-slate-700 rounded-xl lg:col-span-2" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors">
        <StaffSidebar />
        <main className="flex-1 p-6 md:p-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-gray-100 dark:border-slate-700">
            <div className="text-gray-500 dark:text-gray-300">Order not found.</div>
            <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 rounded bg-indigo-600 text-white">
              Go back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800 transition-colors">
      <StaffSidebar />
      <main className="flex-1 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded bg-white dark:bg-slate-800 border shadow-sm border-gray-100 dark:border-slate-700">
              <FiArrowLeft />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Order #{order.id}</h1>
              <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center gap-3 mt-1">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 font-semibold">
                  <FiClock /> {fmtDate(order.created_at)}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-semibold">
                  <FiTruck /> {String(order.status || "—").toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
              <div className="text-xs text-gray-500 dark:text-gray-300">Order Total</div>
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                <FiDollarSign className="inline mr-1" /> {fmtCurrency(order.total_amount ?? totals.subtotal)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  onClick={enterEditMode}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2"
                >
                  <FiEdit /> Edit Items
                </button>
              ) : (
                <>
                  <button
                    onClick={submitEdits}
                    disabled={saving}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</span>
                    ) : (
                      <>
                        <FiSave /> Save
                      </>
                    )}
                  </button>

                  <button
                    onClick={cancelEdits}
                    disabled={saving}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <FiX /> Cancel
                  </button>
                </>
              )}

              <button onClick={() => toast("Export not implemented", "info")} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center gap-2 border-gray-100 dark:border-slate-700">
                <FiInfo /> Export
              </button>

              {/* Theme toggle */}
              <button
                onClick={() => setIsDark((v) => !v)}
                title={isDark ? "Switch to light" : "Switch to dark"}
                className="ml-2 inline-flex items-center gap-2 px-3 py-1 rounded-md border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm"
              >
                {isDark ? <FiSun className="w-4 h-4 text-yellow-400" /> : <FiMoon className="w-4 h-4 text-gray-600" />}
                <span className="text-xs text-gray-600 dark:text-gray-200">{isDark ? "Light" : "Dark"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Products */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 lg:col-span-1 h-[75vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                  <FiPackage />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">Products</div>
                  <div className="text-sm text-gray-500 dark:text-gray-300">{products.length} items</div>
                </div>
              </div>
              <div className="w-56">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-300" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products..."
                    className="pl-10 pr-3 py-2 w-full border rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-slate-600"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="text-center text-sm text-gray-500 dark:text-gray-300 py-8">No products match search.</div>
              ) : (
                filteredProducts.map((p) => {
                  const pid = p.id;
                  const isExpanded = expandedProductId === pid;
                  const stock = getProductStock(p);
                  const stockCls = stockLevelClass(stock);

                  return (
                    <div key={pid} className="border border-gray-100 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
                          {p.image || p.image_url ? (
                            <img
                              src={String(p.image || p.image_url).startsWith("http") ? p.image || p.image_url : `${API_HOST}${p.image || p.image_url}`}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            p.name?.charAt(0) || "P"
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{p.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-300">{p.sku ? `SKU: ${p.sku}` : `ID: ${pid}`}</div>
                            </div>
                            <div className="text-right">
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${stockCls.bg} ${stockCls.text} font-semibold text-sm`}>
                                <FiTag /> {stock}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="text-sm text-green-700 dark:text-green-300 font-medium">{p.price ? fmtCurrency(p.price) : "-"}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-300">• {p.category || "—"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-gray-500 dark:text-gray-300">Updated: {fmtDate(p.updated_at ?? p.added_at ?? p.created_at)}</div>

                        <div className="flex items-center gap-2">
                          {isEditing && (
                            <button
                              onClick={() => addProductToEdit(p)}
                              className="flex items-center gap-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
                            >
                              <FiPlus /> Add
                            </button>
                          )}

                          <button
                            onClick={async () => {
                              if (isExpanded) {
                                setExpandedProductId(null);
                                return;
                              }
                              setExpandedProductId(pid);
                              await fetchBatches(pid);
                            }}
                            className="flex items-center gap-2 text-sm px-3 py-1 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                          >
                            {isExpanded ? (
                              <>
                                <FiChevronUp /> Hide
                              </>
                            ) : (
                              <>
                                <FiChevronDown /> Details
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                          {prodLoadingBatches[pid] ? (
                            <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                              Loading batches...
                            </div>
                          ) : batchesMap[pid] && batchesMap[pid].length > 0 ? (
                            <div className="space-y-2">
                              {batchesMap[pid].map((b) => (
                                <div key={b.id ?? b.batch_no} className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-indigo-900 dark:text-indigo-200">Batch: {b.batch_no || "N/A"}</div>
                                    <div className="text-sm text-indigo-800 dark:text-indigo-100 font-semibold">Qty: {b.quantity ?? "N/A"}</div>
                                  </div>
                                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 flex gap-4">
                                    <div className="flex items-center gap-1"><FiCalendar /> Expires: {fmtDate(b.expire_date)}</div>
                                    <div className="flex items-center gap-1"><FiClock /> Added: {fmtDate(b.added_at ?? b.added)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-300">No batch information available.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Order details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                    <FiPackage />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">Order Items</div>
                    <div className="text-sm text-gray-500 dark:text-gray-300">{order.items?.length || 0} items • Total qty: {totals.qty}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => toast("Export not implemented", "info")} className="px-3 py-2 rounded-lg bg-indigo-600 text-white flex items-center gap-2">
                    <FiInfo /> Export
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-2">
                {/* editing: show editItems; otherwise show order.items */}
                {isEditing ? (
                  editItems.length > 0 ? (
                    editItems.map((it, idx) => {
                      const prod = productsMap[it.product_id];
                      const name = prod?.name || `Product #${it.product_id}`;
                      const img = prod?.image || prod?.image_url || null;
                      const qty = Number(it.qty || 0);
                      const unit = Number(it.unit_price || 0);
                      const subtotal = qty * unit;
                      const stock = getProductStock(prod);

                      return (
                        <div key={it.tempId ?? `r-${idx}`} className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-100 dark:border-slate-700">
                          <div className="w-20 h-20 rounded-md bg-gray-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                            {img ? <img src={String(img).startsWith("http") ? img : `${API_HOST}${img}`} alt={name} className="w-full h-full object-cover" /> : <FiPackage className="text-gray-400 dark:text-slate-400" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">{name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">{prod?.sku ? `SKU: ${prod.sku}` : `ID: ${it.product_id}`}</div>
                                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Available: {typeof prod?.stocklevel_quantity !== "undefined" ? prod.stocklevel_quantity : stock}</div>
                                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Notes: <input value={it.notes ?? ""} onChange={(e) => updateEditItem(idx, { notes: e.target.value })} className="ml-2 px-2 py-1 border rounded text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100" /></div>
                              </div>

                              <div className="text-right ml-4 flex flex-col gap-2 items-end">
                                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtCurrency(subtotal)}</div>

                                <div className="flex items-center gap-2">
                                  <input type="number" min="1" value={it.qty} onChange={(e) => updateEditItem(idx, { qty: e.target.value === "" ? "" : Number(e.target.value) })} className="w-20 px-2 py-1 border rounded bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100" />
                                  <div className="text-sm text-gray-500 dark:text-gray-300">×</div>
                                  <input type="number" min="0" value={it.unit_price} onChange={(e) => updateEditItem(idx, { unit_price: e.target.value === "" ? "" : Number(e.target.value) })} className="w-28 px-2 py-1 border rounded bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100" />
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                  <button onClick={() => removeEditItem(idx)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg dark:text-red-400">
                                    <FiTrash2 />
                                  </button>
                                  <div className="text-xs text-gray-400 dark:text-gray-300">Item ID: {it.id ?? "-"}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-300 p-4">No items in edit list. Add a product from the left.</div>
                  )
                ) : Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((it) => {
                    const prod = productsMap[it.product_id];
                    const name = prod?.name || `Product #${it.product_id}`;
                    const img = prod?.image || prod?.image_url || null;
                    const qty = getItemQty(it);
                    const unit = Number(it.unit_price ?? 0);
                    const subtotal = Number(it.subtotal ?? qty * unit);
                    const stock = getProductStock(prod);

                    return (
                      <div key={it.id} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-700">
                        <div className="w-20 h-20 rounded-md bg-gray-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
                          {img ? <img src={String(img).startsWith("http") ? img : `${API_HOST}${img}`} alt={name} className="w-full h-full object-cover" /> : <FiPackage className="text-gray-400 dark:text-slate-400" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <div className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">{name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">{prod?.sku ? `SKU: ${prod.sku}` : `ID: ${it.product_id}`}</div>
                              {it.notes && <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Notes: {it.notes}</div>}
                            </div>

                            <div className="text-right ml-4">
                              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtCurrency(subtotal)}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-300">{qty} × {fmtCurrency(unit)}</div>
                              <div className="text-xs text-gray-400 dark:text-gray-300">Available: {typeof prod?.stocklevel_quantity !== "undefined" ? prod.stocklevel_quantity : stock}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-300 p-4">No items in this order.</div>
                )}
              </div>

              {/* order summary */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-300">Subtotal</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(totals.subtotal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 dark:text-gray-300">Total qty</div>
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{totals.qty}</div>
                </div>
              </div>
            </div>

            {/* Customer / Shipping / Vehicle */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start transition-colors">
              <div className="col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-300">
                    <FiUser />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{order.customer_name || "—"}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-300">{order.customer_email || order.customer_phone || "—"}</div>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-xs text-gray-500 dark:text-gray-300">Shipping Address</div>
                  <div className="text-sm text-gray-800 dark:text-gray-100 font-medium">{order.shipping_address || "—"}</div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-gray-500 dark:text-gray-300">Order Notes</div>
                  <div className="text-sm text-gray-700 dark:text-gray-200">{order.notes || "-"}</div>
                </div>
              </div>

              <div className="col-span-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-700 dark:text-green-200"><FiTruck /></div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vehicle</div>
                      <div className="text-xs text-gray-500 dark:text-gray-300">Assignment</div>
                    </div>
                  </div>
                  <div>
                    {order.vehicle_id ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-semibold">Assigned</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 font-semibold">Unassigned</span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-800 dark:text-gray-100 font-medium">
                  {order.vehicle_id ? `Vehicle #${order.vehicle_id}` : "Not assigned"}
                </div>
                {order.driver_name && <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">{order.driver_name}</div>}
                {order.driver_mobile && <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 flex items-center gap-2"><FiPhone /> {order.driver_mobile}</div>}
                {order.vehicle_details && <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{order.vehicle_details}</div>}

                {(order.vehicle_lat || order.vehicle_lng) && (
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-300 flex items-center gap-2">
                    <FiMapPin /> {order.vehicle_lat ?? "-"}, {order.vehicle_lng ?? "-"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
