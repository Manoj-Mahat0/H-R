// src/pages/master-admin/EditOrderItems.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import {
    FiSearch,
    FiX,
    FiPlus,
    FiTrash2,
    FiPackage,
    FiCalendar,
    FiUser,
    FiTruck,
    FiShoppingCart,
    FiEye,
    FiEyeOff,
    FiInfo,
    FiClock,
    FiPhone,
    FiArrowLeft,
    FiSave
} from "react-icons/fi";

/**
 * EditOrderItems - Dedicated page for editing order items
 *
 * Features:
 * - Edit order items with product selection
 * - View product batches and stock levels
 * - Vehicle selection for order confirmation
 * - Save changes or confirm order with vehicle
 *
 * Images removed: placeholders / initials used instead of loading external images.
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
    try {
        return new Date(d).toLocaleString("en-IN");
    } catch {
        return d;
    }
}

// --- STOCK HELPERS ---
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
    if (stock <= 0) return { bg: "bg-red-500", ring: "ring-red-200", text: "text-red-700" };
    if (stock <= 5) return { bg: "bg-orange-500", ring: "ring-orange-200", text: "text-orange-700" };
    if (stock <= 19) return { bg: "bg-yellow-500", ring: "ring-yellow-200", text: "text-yellow-700" };
    if (stock <= 49) return { bg: "bg-blue-500", ring: "ring-blue-200", text: "text-blue-700" };
    if (stock <= 99) return { bg: "bg-green-500", ring: "ring-green-200", text: "text-green-700" };
    return { bg: "bg-emerald-500", ring: "ring-emerald-200", text: "text-emerald-700" };
}

// Modern Stock Indicator Component
function StockIndicator({ stock, size = "md" }) {
    const config = stockLevelClass(stock);
    const sizeClasses = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-6 h-6"
    };

    return (
        <div className="flex items-center gap-2">
            <div className={`${sizeClasses[size]} ${config.bg} rounded-full ${config.ring} ring-2 shadow-sm`} />
            <span className={`text-sm font-medium ${config.text}`}>{stock}</span>
        </div>
    );
}

// --- NEW: item qty helper (centralized) ---
function getItemQty(it) {
    if (!it) return 0;
    // prefer the explicit 'qty' field from backend, then fallbacks
    return Number(it.qty ?? it.final_qty ?? it.original_qty ?? it.quantity ?? 0) || 0;
}

export default function AdminEditOrderItems() {
    const { id: orderId } = useParams();
    const { token } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const mountedRef = useRef(true);

    // --- State ---
    const [order, setOrder] = useState(null);
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edit state
    const [editRows, setEditRows] = useState([]);
    const [editReason, setEditReason] = useState("");
    const [editSaving, setEditSaving] = useState(false);
    const [editErrors, setEditErrors] = useState({});
    const [editSaveProgress, setEditSaveProgress] = useState(0);

    // Product details
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [productDetailsMap, setProductDetailsMap] = useState({});
    const [batchesMap, setBatchesMap] = useState({});
    const [productSearch, setProductSearch] = useState("");

    // Vehicle selection state
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [confirmNotes, setConfirmNotes] = useState("");
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [confirming, setConfirming] = useState(false);

    // --- API helper ---
    async function apiRequest(path, opts = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const fetchOpts = { method: opts.method || "GET", headers };
  if (opts.body != null) {
    if (!(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      fetchOpts.body = JSON.stringify(opts.body);
    } else {
      fetchOpts.body = opts.body;
    }
  }

  // normalize and build full URL
  const base = `${API_HOST ?? ""}${API_BASE ?? ""}`.replace(/\/$/, "");
  const suffix = String(path ?? "").replace(/^\//, "");
  const url = `${base}/${suffix}`;
  console.log("[apiRequest] ->", fetchOpts.method, url, { body: opts.body });

  const res = await fetch(url, fetchOpts);

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && (data.detail || data.message || data.error)) || (typeof data === "string" ? data : `Request failed: ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.raw = data;
    throw err;
  }
  return data;
}

    async function fetchBatches(productId) {
        if (batchesMap[productId]) return;
        try {
            const data = await apiRequest(`/products-with-stock/stock/batches/${productId}`);
            setBatchesMap(m => ({ ...m, [productId]: Array.isArray(data) ? data : [data] }));
        } catch (e) {
            console.error("batches load", e);
            setBatchesMap(m => ({ ...m, [productId]: [] }));
        }
    }

    async function fetchProductDetails(productId) {
        if (!productId) return null;
        if (productDetailsMap[productId]) return productDetailsMap[productId];
        try {
            const data = await apiRequest(`/products-with-stock/products/${productId}`);
            setProductDetailsMap((m) => ({ ...m, [productId]: data }));
            return data;
        } catch (err) {
            console.warn("fetchProductDetails", err);
            return null;
        }
    }

    // --- Initial load ---
    useEffect(() => {
        mountedRef.current = true;
        (async () => {
            try {
                setLoading(true);
                const [orderData, usersData, productsData] = await Promise.all([
                    apiRequest(`/new-orders/${orderId}`),
                    apiRequest("/users/"),
                    apiRequest("/products-with-stock/products"),
                ]);
                if (!mountedRef.current) return;

                setOrder(orderData);
                setUsers(Array.isArray(usersData) ? usersData : []);
                setProducts(Array.isArray(productsData) ? productsData : []);

                // Initialize edit rows — use getItemQty so qty shows correctly
                if (orderData && Array.isArray(orderData.items)) {
                    const rows = orderData.items.map((it) => ({
                        id: it.id,
                        product_id: it.product_id != null ? Number(it.product_id) : "",
                        qty: getItemQty(it), // ← prefer qty (backend)
                        unit_price: Number(it.unit_price ?? 0),
                        tempId: `r-${it.id}`,
                    }));
                    setEditRows(rows);
                }
            } catch (err) {
                console.error("load error", err);
                toast(err.message || "Failed to load data", "error");
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        })();
        return () => { mountedRef.current = false; };
    }, [orderId, token]);

    // Maps for quick lookup
    const usersMap = useMemo(() => {
        const m = {};
        (users || []).forEach((u) => { if (u && typeof u.id !== "undefined") m[u.id] = u; });
        return m;
    }, [users]);

    const productsMap = useMemo(() => {
        const m = {};
        (products || []).forEach((p) => { if (p && typeof p.id !== "undefined") m[p.id] = p; });
        return m;
    }, [products]);

    // Calculate order weight — use getItemQty for robust reading
    const orderWeight = useMemo(() => {
        if (!editRows.length) return 0;
        return editRows.reduce((total, item) => {
            return total + Number(item.qty ?? 0);
        }, 0);
    }, [editRows]);

    // --- Fetch vehicles ---
    async function fetchVehicles() {
const path = `/vehicles?available=true`; // or "/vehicles/?me_only=true" to match your backend
console.log("[fetchVehicles] path:", path, "API_BASE:", API_BASE, "API_HOST:", API_HOST);
const data = await apiRequest(path);  const url = `${API_BASE.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  console.log("[fetchVehicles] requesting:", url);

  try {
    const data = await apiRequest(path); // or apiRequest(url) depending on your wrapper
    setVehicles(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("fetch vehicles error", err);
    // handle 404 specifically (show empty set instead of crash)
    if (err.response?.status === 404) {
      setVehicles([]); // no vehicles found
    } else {
      // optional: set an error state to show a message in the UI
      setVehicles([]);
      setVehiclesError(err);
    }
  } finally {
    setLoadingVehicles(false);
  }
}


    // Load vehicles on mount
    useEffect(() => {
        fetchVehicles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Edit helpers ---
    function addEmptyRow() {
        setEditRows((r) => [...r, { tempId: `t-${Date.now()}-${Math.random()}`, product_id: "", qty: 1, unit_price: 0 }]);
    }

    function updateRow(idx, patch) {
        setEditRows((r) => {
            const copy = [...r];
            copy[idx] = { ...copy[idx], ...patch };
            return copy;
        });
    }

    function removeRow(idx) {
        setEditRows((r) => {
            const copy = [...r];
            copy.splice(idx, 1);
            return copy;
        });
    }

    function validateEdit() {
        const errs = {};
        if (!Array.isArray(editRows) || editRows.length === 0) errs.global = "At least one item required.";
        editRows.forEach((row, i) => {
            if (!row.product_id && row.product_id !== 0) errs[`row_${i}`] = "Product required";
            if (!Number.isFinite(Number(row.qty)) || Number(row.qty) <= 0) errs[`row_qty_${i}`] = "Qty must be > 0";
            if (!Number.isFinite(Number(row.unit_price)) || Number(row.unit_price) < 0) errs[`row_price_${i}`] = "Unit price must be >= 0";
            const p = productsMap[row.product_id];
            if (p && typeof p.stocklevel_quantity !== "undefined") {
                if (Number(row.qty) > Number(p.stocklevel_quantity)) {
                    errs[`row_qty_${i}`] = `Exceeds stock (${p.stocklevel_quantity})`;
                }
            }
        });
        setEditErrors(errs);
        return Object.keys(errs).length === 0;
    }

    // New helper: safely add or fill a row with a product and return the row index
    async function addOrFillRowWithProduct(product) {
        // product is either product object or id
        const pid = product && typeof product === "object" ? product.id : Number(product);
        // Find first empty product slot
        let newIndex = -1;
        setEditRows((rows) => {
            const copy = [...rows];
            const emptyIndex = copy.findIndex(r => !r.product_id && r.product_id !== 0);
            if (emptyIndex === -1) {
                // append new
                const newRow = {
                    tempId: `t-${Date.now()}-${Math.random()}`,
                    product_id: pid,
                    qty: 1,
                    unit_price: 0
                };
                copy.push(newRow);
                newIndex = copy.length - 1;
            } else {
                copy[emptyIndex] = { ...copy[emptyIndex], product_id: pid, qty: copy[emptyIndex].qty || 1 };
                newIndex = emptyIndex;
            }
            return copy;
        });

        // After state has been enqueued, fetch details and set price
        try {
            const basic = products.find((pp) => Number(pp.id) === Number(pid));
            if (basic && (basic.price ?? basic.unit_price)) {
                // set unit_price from basic product
                setEditRows((rows) => {
                    const copy = [...rows];
                    if (newIndex >= 0 && newIndex < copy.length) {
                        copy[newIndex] = { ...copy[newIndex], unit_price: basic.price ?? basic.unit_price };
                    }
                    return copy;
                });
            }
            const details = await fetchProductDetails(pid).catch(() => null);
            if (details && typeof details.price !== "undefined") {
                setEditRows((rows) => {
                    const copy = [...rows];
                    if (newIndex >= 0 && newIndex < copy.length) {
                        copy[newIndex] = { ...copy[newIndex], unit_price: details.price };
                    }
                    return copy;
                });
            }
            // Preload batches
            fetchBatches(pid).catch(() => { });
        } catch (e) {
            console.warn("addOrFillRowWithProduct error", e);
        }

        return newIndex;
    }

    async function submitEdit({ closeOnSuccess = true } = {}) {
        if (!validateEdit()) { toast("Fix validation errors", "error"); return; }
        if (!order) return;

        setEditSaving(true);
        setEditSaveProgress(5);

        let progressInterval = null;
        try {
            progressInterval = setInterval(() => {
                setEditSaveProgress((p) => {
                    const delta = p < 60 ? 6 : p < 85 ? 3 : 1;
                    const next = Math.min(p + delta, 90);
                    return next;
                });
            }, 400);

            const itemsPayload = editRows.map((r) => ({
                product_id: Number(r.product_id),
                qty: Number(r.qty),
                unit_price: Number(r.unit_price),
            }));
            const payload = { items: itemsPayload, reason: editReason || "Admin edit" };

            const res = await apiRequest(`/new-orders/${order.id}`, { method: "PATCH", body: payload });
            setEditSaveProgress(98);

            toast(res?.message || res?.status || "Order updated", "success");

            // Refresh order data
            try {
                const orderData = await apiRequest(`/new-orders/${order.id}`);
                setOrder(orderData);
                // also re-init editRows from fresh order data (keep consistent)
                if (orderData && Array.isArray(orderData.items)) {
                    const rows = orderData.items.map((it) => ({
                        id: it.id,
                        product_id: it.product_id != null ? Number(it.product_id) : "",
                        qty: getItemQty(it),
                        unit_price: Number(it.unit_price ?? 0),
                        tempId: `r-${it.id}`,
                    }));
                    setEditRows(rows);
                }
            } catch (err) {
                console.warn("refresh after edit failed", err);
            }

            setEditSaveProgress(100);

            if (closeOnSuccess) {
                // small delay for UX
                await new Promise((r) => setTimeout(r, 300));
                navigate(-1);
            } else {
                await new Promise((r) => setTimeout(r, 400));
                setEditSaveProgress(0);
            }
        } catch (err) {
            console.error("submitEdit err", err);
            toast(err.message || "Failed to update items", "error");
            setEditSaveProgress(100);
            await new Promise((r) => setTimeout(r, 400));
            setEditSaveProgress(0);
        } finally {
            if (progressInterval) clearInterval(progressInterval);
            setEditSaving(false);
        }
    }

    // --- Confirm order with vehicle (PATCH vehicle then PATCH order with hardcoded status/notes) ---
    async function confirmOrderWithVehicle() {
        if (!order || !selectedVehicle) return;

        try {
            setConfirming(true);

            // 1) PATCH vehicle endpoint (expects raw vehicle id in body).
            await apiRequest(`/new-orders/${order.id}/vehicle`, {
                method: "PATCH",
                body: Number(selectedVehicle.id),
            });

            // 2) Now also PATCH the order to set status: "confirmed" and notes: "ok"
            // Build items payload from editRows (match server shape)
            const itemsPayload = (Array.isArray(editRows) ? editRows : []).map(r => ({
                product_id: Number(r.product_id),
                qty: Number(r.qty),
                unit_price: Number(r.unit_price),
                // if the server expects per-item notes, include it; else remove this line
                notes: r.notes ?? "ok",
            }));

            const orderPayload = {
                items: itemsPayload,
                shipping_address: order.shipping_address ?? "",
                // Hard-code notes and status per your request
                notes: "ok",
                status: "confirmed",
            };

            const res = await apiRequest(`/new-orders/${order.id}`, {
                method: "PATCH",
                body: orderPayload,
            });

            toast(`Order ${order.id} confirmed and updated`, "success");
            // optionally refresh order or navigate back
            navigate(-1);
        } catch (err) {
            console.error("confirm order error", err);
            toast(err?.message || "Failed to confirm order", "error");
        } finally {
            setConfirming(false);
        }
    }

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products;
        const search = productSearch.toLowerCase();
        return products.filter(p =>
            p.name?.toLowerCase().includes(search) ||
            String(p.id).includes(search) ||
            p.sku?.toLowerCase().includes(search)
        );
    }, [products, productSearch]);

    if (loading) {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <MasterAdminSidebar />
      <main className="flex-1 p-8">
        <div className="animate-pulse space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
            <div className="h-8 w-1/3 bg-gray-200 rounded-lg mb-4 dark:bg-gray-700" />
            <div className="h-4 w-1/4 bg-gray-200 rounded mb-6 dark:bg-gray-700" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-64 bg-gray-200 rounded-xl dark:bg-gray-700" />
              <div className="h-64 bg-gray-200 rounded-xl dark:bg-gray-700" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

if (!order) {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <MasterAdminSidebar />
      <main className="flex-1 p-8">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center dark:bg-gray-800 dark:border dark:border-gray-700">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-700">
            <FiPackage className="w-8 h-8 text-gray-400 dark:text-gray-300" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2 dark:text-white">Order Not Found</h2>
          <p className="text-gray-500 mb-6 dark:text-gray-400">
            The order you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Go Back
          </button>
        </div>
      </main>
    </div>
  );
}


    const vendorUser = usersMap[order.vendor_id] || usersMap[order.customer_id];
    const customer = usersMap[order.customer_id];

    return (
  <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
    <MasterAdminSidebar />
    <main className="flex-1 p-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition-all duration-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-700"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-white">
                Edit Order #{order.id}
              </h1>
              <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <FiUser className="w-4 h-4" />
                  {vendorUser ? `Vendor: ${vendorUser.name}` : `Order ID: ${order.id}`}
                </div>
                <div className="flex items-center gap-2">
                  <FiShoppingCart className="w-4 h-4" />
                  Items: {editRows.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
        {/* LEFT: Product Stocks Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <FiPackage className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Main Stocks</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{products.length} products available</p>
              </div>
            </div>
            <div className="w-64">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-300" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4">
              {filteredProducts.map((p) => {
                const pid = p.id;
                const isExpanded = expandedProductId === pid;
                const stockQty = typeof p.stocklevel_quantity !== "undefined" ? p.stocklevel_quantity : getProductStock(p);
                const batches = batchesMap[pid] ?? null;
                const initial = (p.name && p.name.charAt(0)) || "P";

                return (
                  <div
                    key={pid}
                    className="border border-gray-200 rounded-xl p-4 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-all duration-200 dark:from-gray-800 dark:to-gray-800 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold text-sm">
                          <div className="text-lg font-bold">{initial}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 truncate text-lg dark:text-white">{p.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">ID: {pid} • SKU: {p.sku || 'N/A'}</div>
                          {p.price && (
                            <div className="text-sm font-medium text-green-600">₹{p.price}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StockIndicator stock={stockQty} size="md" />
                        <button
                          onClick={async () => {
                            await addOrFillRowWithProduct(p).catch(() => {});
                          }}
                          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (isExpanded) {
                          setExpandedProductId(null);
                          return;
                        }
                        setExpandedProductId(pid);
                        await fetchBatches(pid);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-150 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                      {isExpanded ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      {isExpanded ? "Hide Batches" : "Show Batches"}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        {batches === null ? (
                          <div className="flex items-center justify-center py-6 text-sm text-gray-500 dark:text-gray-400">
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
                            Loading batch information...
                          </div>
                        ) : batches.length === 0 ? (
                          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                            <FiInfo className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                            No batch data available
                          </div>
                        ) : (
                          batches.map((b) => (
                            <div key={b.id ?? b.batch_no ?? `${pid}-${Math.random()}`} className="bg-white rounded-lg p-3 border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  Batch: {b.batch_no || "N/A"}
                                </div>
                                <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold dark:bg-blue-900 dark:text-blue-200">
                                  Qty: {b.quantity ?? "N/A"}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                  <FiCalendar className="w-4 h-4 text-red-500" />
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Expires</div>
                                    <div className="font-medium">{fmtDate(b.expire_date)}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FiClock className="w-4 h-4 text-green-500" />
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Added</div>
                                    <div className="font-medium">{fmtDate(b.added_at ?? b.added)}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Edit Form + Vehicles */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <FiShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Order Items</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{editRows.length} items • Weight: {orderWeight} units</p>
              </div>
            </div>
            <button
              onClick={addEmptyRow}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors duration-200"
            >
              <FiPlus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {editErrors?.global && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 mb-4 dark:bg-red-900 dark:border-red-700 dark:text-red-200">
                {editErrors.global}
              </div>
            )}

            <div className="space-y-4 mb-6">
              {editRows.map((row, idx) => {
                const prod = productsMap[row.product_id];
                const qty = Number(row.qty || 0);
                const unit = Number(row.unit_price || 0);
                const subtotal = qty * unit;
                const stock = getProductStock(prod);
                const name = prod ? prod.name : `Product #${row.product_id}`;
                const initial = (name && name.charAt(0)) || "P";

                return (
                  <div key={row.id ?? row.tempId ?? idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 dark:bg-gray-900 dark:border-gray-700">
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-12 md:col-span-6">
                        <div className="flex gap-3 items-start">
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center dark:from-gray-700 dark:to-gray-700">
                            <FiPackage className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="text-xs text-gray-600 dark:text-gray-400">Product</label>
                            <select
                              value={row.product_id ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                updateRow(idx, { product_id: val });
                                const basic = products.find((pp) => Number(pp.id) === Number(val));
                                if (basic && (basic.price ?? basic.unit_price)) {
                                  updateRow(idx, { unit_price: basic.price ?? basic.unit_price });
                                }
                                fetchProductDetails(val).then((details) => {
                                  if (details && typeof details.price !== "undefined") {
                                    updateRow(idx, { unit_price: details.price });
                                  }
                                }).catch(() => {});
                                fetchBatches(val).catch(() => {});
                              }}
                              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            >
                              <option value="">— choose product —</option>
                              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` • ${p.sku}` : ''}</option>)}
                            </select>
                            {editErrors[`row_${idx}`] && <div className="text-xs text-red-600 mt-1">{editErrors[`row_${idx}`]}</div>}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-4 md:col-span-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Qty</label>
                        <input
                          type="number"
                          min="0"
                          value={row.qty}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") updateRow(idx, { qty: "" });
                            else {
                              const n = Number(v);
                              updateRow(idx, { qty: Number.isFinite(n) ? n : 0 });
                            }
                          }}
                          className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm ${editErrors[`row_qty_${idx}`] ? "border-red-500" : "border-gray-200"} bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700`}
                        />
                        {editErrors[`row_qty_${idx}`] && <div className="text-xs text-red-600 mt-1">{editErrors[`row_qty_${idx}`]}</div>}
                      </div>

                      <div className="col-span-4 md:col-span-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Unit Price</label>
                        <input
                          type="number"
                          value={row.unit_price ?? ""}
                          readOnly
                          onChange={(e) => {
                            const v = e.target.value;
                            updateRow(idx, { unit_price: v === "" ? "" : Number(v) });
                          }}
                          className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
                        />
                      </div>

                      <div className="col-span-4 md:col-span-2 flex flex-col items-end gap-2">
                        <div className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(subtotal)}</div>
                        <button
                          onClick={() => removeRow(idx)}
                          disabled={editSaving}
                          className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors duration-150 dark:hover:bg-red-900"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vehicles Section */}
            <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Available Vehicles</h4>
                <button
                  onClick={fetchVehicles}
                  disabled={loadingVehicles}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  {loadingVehicles ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {loadingVehicles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                  <span className="text-gray-600 dark:text-gray-300">Loading vehicles...</span>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-700">
                    <FiTruck className="w-8 h-8 text-gray-400 dark:text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2 dark:text-white">No Vehicles Available</h3>
                  <p className="text-gray-500 dark:text-gray-400">No vehicles are currently available for delivery.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicles.map((vehicle) => {
                    const isSelected = selectedVehicle?.id === vehicle.id;
                    const hasCapacity = (vehicle.capacity_weight ?? 0) >= orderWeight;
                    const capacityPercentage = Math.min((orderWeight / (vehicle.capacity_weight || 1)) * 100, 100);

                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => hasCapacity && setSelectedVehicle(vehicle)}
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${isSelected
                          ? "border-green-500 bg-green-50 dark:bg-green-900"
                          : hasCapacity
                            ? "border-gray-200 hover:border-green-300 dark:border-gray-700"
                            : "border-red-200 bg-red-50 cursor-not-allowed opacity-60 dark:bg-red-900"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? "bg-green-500" : hasCapacity ? "bg-blue-500" : "bg-red-500"}`}>
                              <FiTruck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">{vehicle.vehicle_number}</h4>
                              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                  <FiPhone className="w-3 h-3" />
                                  {vehicle.driver_mobile}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${hasCapacity ? "text-green-600" : "text-red-600"} dark:text-white`}>
                              {vehicle.capacity_weight ?? '-'} {vehicle.capacity_unit ?? ''}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Capacity</div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="font-medium">Selected for delivery</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 z-50 dark:bg-gray-900 dark:border-gray-700">
        {/* Progress bar */}
        {editSaving && (
          <div className="mb-3">
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden dark:bg-gray-700">
              <div
                className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-blue-500 to-green-500"
                style={{ width: `${Math.min(Math.max(editSaveProgress || 0, 0), 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Saving changes — {Math.round(editSaveProgress || 0)}%</div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <FiShoppingCart className="w-4 h-4 text-gray-500 dark:text-gray-300" />
              <span className="font-medium">Items: <span className="text-gray-900 dark:text-white">{editRows.length}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <FiPackage className="w-4 h-4 text-gray-500 dark:text-gray-300" />
              <span className="font-medium">Total Qty: <span className="text-gray-900 dark:text-white">{editRows.reduce((s, r) => s + Number(r.qty || 0), 0)}</span></span>
            </div>
            <div className="text-lg font-bold text-green-600 dark:text-green-300">
              {fmtCurrency(editRows.reduce((s, r) => s + (Number(r.qty || 0) * Number(r.unit_price || 0)), 0))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Reason for editing..."
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-64 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
            />

            <button
              onClick={() => navigate(-1)}
              disabled={editSaving}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-white hover:shadow-sm transition-all duration-150 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FiX className="w-4 h-4" />
              Cancel
            </button>

            <button
              onClick={() => submitEdit({ closeOnSuccess: false })}
              disabled={editSaving || editRows.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-150 ${editSaving || editRows.length === 0 ? "bg-gray-400 text-white cursor-not-allowed" : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"}`}
            >
              {editSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>

            <button
              onClick={async () => {
                if (!selectedVehicle) {
                  toast("Please select a vehicle first", "error");
                  return;
                }
                await confirmOrderWithVehicle();
              }}
              disabled={!selectedVehicle || confirming}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-150 ${(!selectedVehicle || confirming) ? "bg-gray-400 text-white cursor-not-allowed" : "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"}`}
            >
              {confirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <FiTruck className="w-4 h-4" />
                  Confirm Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
);

}
