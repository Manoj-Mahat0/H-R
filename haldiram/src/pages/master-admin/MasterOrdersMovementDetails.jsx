import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import {
    FiSearch,
    FiDownload,
    FiClipboard,
    FiEdit2,
    FiX,
    FiPlus,
    FiTrash2,
    FiPackage,
    FiCalendar,
    FiUser,
    FiTruck,
    FiDollarSign,
    FiShoppingCart,
    FiEye,
    FiEyeOff,
    FiInfo,
    FiClock,
    FiMapPin,
    FiPhone,
    FiMail
} from "react-icons/fi";

/**
 * MasterOrdersMovementDetails - Modern UI Version
 *
 * - Loads orders (/orders/all), users (/users/), and products-with-stock (/products-with-stock/products)
 * - Shows one order details (by route id or query ?order=)
 * - Vendor previous orders drawer (GET /orders/vendor/:vendorId)
 * - Admin Edit Items modal (PATCH /orders/:id/items)
 *
 * Note: this component keeps hook order stable.
 */

function StatusBadge({ status }) {
    const map = {
        placed: { bg: "bg-gradient-to-r from-indigo-500 to-purple-600", text: "text-white", dot: "bg-white" },
        confirmed: { bg: "bg-gradient-to-r from-blue-500 to-cyan-600", text: "text-white", dot: "bg-white" },
        processing: { bg: "bg-gradient-to-r from-yellow-500 to-orange-500", text: "text-white", dot: "bg-white" },
        shipped: { bg: "bg-gradient-to-r from-orange-500 to-red-500", text: "text-white", dot: "bg-white" },
        received: { bg: "bg-gradient-to-r from-green-500 to-emerald-600", text: "text-white", dot: "bg-white" },
        cancelled: { bg: "bg-gradient-to-r from-red-500 to-pink-600", text: "text-white", dot: "bg-white" },
        returned: { bg: "bg-gradient-to-r from-red-600 to-rose-700", text: "text-white", dot: "bg-white" },
    };
    const config = map[String(status || "").toLowerCase()] || { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" };
    const label = String(status || "").replaceAll("_", " ").toUpperCase();

    return (
        <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full ${config.bg} ${config.text} shadow-lg`}>
            <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`}></span>
            {label}
        </span>
    );
}

function useQuery() {
    const { search } = useLocation();
    return new URLSearchParams(search);
}

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

export default function MasterOrdersMovementDetails() {
    const { id: routeId } = useParams();
    const query = useQuery();
    const queryOrderId = query.get("order");
    const { token } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const mountedRef = useRef(true);

    // --- hooks (keep order stable) ---
    const [order, setOrder] = useState(null);
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [vendorOrders, setVendorOrders] = useState([]);
    const [vendorOrdersOpen, setVendorOrdersOpen] = useState(false);
    const [vendorOrdersLoading, setVendorOrdersLoading] = useState(false);
    const [vendorSearch, setVendorSearch] = useState("");

    const [refreshKey, setRefreshKey] = useState(0);
    const [confirming, setConfirming] = useState(false);
    const [expandedVendorOrder, setExpandedVendorOrder] = useState(null);
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [productDetailsMap, setProductDetailsMap] = useState({});
    const [batchesMap, setBatchesMap] = useState({});

    // Vehicle selection state
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
    const [confirmNotes, setConfirmNotes] = useState("");
    const [loadingVehicles, setLoadingVehicles] = useState(false);

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
        const res = await fetch(`${API_HOST}${API_BASE}${path}`, fetchOpts);
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }
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

    function stockExpiryColor(product) {
        const stock = getProductStock(product);
        const batches = Array.isArray(product?.batches) ? product.batches : [];
        let nearestDays = Infinity;
        const now = new Date();

        batches.forEach((b) => {
            if (b && b.expire_date) {
                const d = new Date(b.expire_date);
                const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                if (diffDays < nearestDays) nearestDays = diffDays;
            }
        });

        if (Number.isFinite(nearestDays) && nearestDays <= 7) return { className: "bg-red-500", reason: `Expires in ${nearestDays} day(s)` };
        if (Number.isFinite(nearestDays) && nearestDays <= 30) return { className: "bg-orange-500", reason: `Expires in ${nearestDays} day(s)` };

        const stockConfig = stockLevelClass(stock);
        return { className: stockConfig.bg, reason: `Stock: ${stock}` };
    }

    // --- initial load ---
    useEffect(() => {
        mountedRef.current = true;
        (async () => {
            try {
                setLoading(true);
                const [ordersData, usersData, productsData] = await Promise.all([
                    apiRequest("/orders/all?limit=500&offset=0"),
                    apiRequest("/users/"),
                    apiRequest("/products-with-stock/products"),
                ]);
                if (!mountedRef.current) return;
                setUsers(Array.isArray(usersData) ? usersData : []);
                setProducts(Array.isArray(productsData) ? productsData : []);

                const ordersArray = Array.isArray(ordersData) ? ordersData : [];
                let found = null;
                if (queryOrderId) found = ordersArray.find((o) => Number(o?.id) === Number(queryOrderId));
                if (!found && routeId) found = ordersArray.find((o) => Number(o?.id) === Number(routeId));
                if (!found && routeId) found = ordersArray.find((o) => Number(o?.vendor_id) === Number(routeId) || Number(o?.customer_id) === Number(routeId));
                setOrder(found || null);
            } catch (err) {
                console.error("load error", err);
                toast(err.message || "Failed to load data", "error");
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        })();
        return () => { mountedRef.current = false; };
    }, [routeId, queryOrderId, token, refreshKey]);

    // maps for quick lookup
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

    const vendorId = (order && (order.vendor_id ?? order.customer_id)) ?? null;
    const vendorUser = vendorId ? usersMap[vendorId] : null;
    const customer = usersMap ? usersMap[order?.customer_id] : null;

    // load vendor previous orders
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!vendorId) { setVendorOrders([]); return; }
            try {
                setVendorOrdersLoading(true);
                const data = await apiRequest(`/orders/vendor/${vendorId}?limit=100&offset=0`);
                if (cancelled) return;
                setVendorOrders(Array.isArray(data) ? data : []);
            } catch (err) {
                console.warn("vendor orders load", err);
                setVendorOrders([]);
            } finally {
                if (!cancelled) setVendorOrdersLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [vendorId, token]);

    // order totals
    const totals = useMemo(() => {
        if (!order || !Array.isArray(order.items)) return { qty: 0, subtotal: 0 };
        let qty = 0, subtotal = 0;
        order.items.forEach((it) => {
            const q = Number(it.final_qty ?? it.original_qty ?? 0);
            const u = Number(it.unit_price ?? 0);
            qty += q;
            subtotal += Number(it.subtotal ?? u * q);
        });
        return { qty, subtotal };
    }, [order]);

    // --- Fetch vehicles ---
    async function fetchVehicles() {
        try {
            setLoadingVehicles(true);
            const data = await apiRequest("/vehicles/?me_only=true");
            setVehicles(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("fetch vehicles error", err);
            toast("Failed to load vehicles", "error");
            setVehicles([]);
        } finally {
            setLoadingVehicles(false);
        }
    }

    // Calculate total order weight (assuming each item has weight or using quantity as proxy)
    const orderWeight = useMemo(() => {
        if (!order) return 0;
        // agar totals.qty already aa raha hai toh directly wahi le lo
        if (totals?.qty != null) {
            return Number(totals.qty) || 0;
        }

        // fallback: items se calculate
        if (Array.isArray(order.items)) {
            return order.items.reduce((total, item) => {
                return total + Number(item.final_qty ?? item.original_qty ?? 0);
            }, 0);
        }

        return 0;
    }, [order, totals]);


    // --- Confirm order with vehicle selection ---
    async function confirmOrder() {
        if (!order) return;

        // Load vehicles and open selection modal
        await fetchVehicles();
        setVehicleModalOpen(true);
    }

    // --- Actually confirm order with selected vehicle ---
    async function confirmOrderWithVehicle() {
        if (!order || !selectedVehicle) return;

        try {
            setConfirming(true);
            const payload = {
                vehicle_id: selectedVehicle.id,
                notes: confirmNotes || "Order confirmed"
            };

            const res = await apiRequest(`/orders/${order.id}/confirm`, {
                method: "POST",
                body: payload
            });

            const newStatus = res?.status || "confirmed";
            const returnedId = res?.order_id ?? order.id;
            const vehicleId = res?.vehicle_id;

            setOrder((o) => ({ ...o, status: newStatus, id: returnedId, vehicle_id: vehicleId }));
            toast(`Order ${returnedId} confirmed with vehicle ${selectedVehicle.vehicle_number}`, "success");

            // Close modal and reset state
            setVehicleModalOpen(false);
            setSelectedVehicle(null);
            setConfirmNotes("");

        } catch (err) {
            console.error("confirm order error", err);
            toast(err.message || "Failed to confirm order", "error");
        } finally {
            setConfirming(false);
        }
    }

    // vendor drawer filtering
    const filteredVendorOrders = useMemo(() => {
        if (!vendorSearch) return vendorOrders || [];
        const s = vendorSearch.trim().toLowerCase();
        return (vendorOrders || []).filter((o) => {
            return String(o.id).includes(s) ||
                String(o.customer_id).includes(s) ||
                (o.status || "").toLowerCase().includes(s) ||
                (o.created_at || "").toLowerCase().includes(s);
        });
    }, [vendorOrders, vendorSearch]);

    // export order JSON
    function downloadJSON() {
        if (!order) return;
        const blob = new Blob([JSON.stringify(order, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `order-${order.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // --- render ---
    if (loading) {
        return (
            <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100">
                <MasterAdminSidebar />
                <main className="flex-1 p-8">
                    <div className="animate-pulse space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm p-6">
                            <div className="h-8 w-1/3 bg-gray-200 rounded-lg mb-4" />
                            <div className="h-4 w-1/4 bg-gray-200 rounded mb-6" />
                            <div className="grid grid-cols-3 gap-4">
                                <div className="h-32 bg-gray-200 rounded-xl" />
                                <div className="h-32 bg-gray-200 rounded-xl" />
                                <div className="h-32 bg-gray-200 rounded-xl" />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100">
                <MasterAdminSidebar />
                <main className="flex-1 p-8">
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiPackage className="w-8 h-8 text-gray-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
                        <p className="text-gray-500 mb-6">The order you're looking for doesn't exist or has been removed.</p>
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
                        >
                            Go Back
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100">
            <MasterAdminSidebar />
            <main className="flex-1 p-8">
                {/* Modern Header Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition-all duration-200 hover:shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back
                            </button>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-bold text-gray-900">
                                        Order #{order.id}
                                    </h1>
                                    <StatusBadge status={order.status} />
                                </div>
                                <div className="flex items-center gap-6 text-sm text-gray-500">
                                    <div className="flex items-center gap-2">
                                        <FiCalendar className="w-4 h-4" />
                                        Created: {fmtDate(order.created_at)}
                                    </div>
                                    {vendorUser && (
                                        <div className="flex items-center gap-2">
                                            <FiUser className="w-4 h-4" />
                                            Vendor: {vendorUser.name}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <FiDollarSign className="w-4 h-4" />
                                        Total: {fmtCurrency(order.total_amount ?? order.total ?? totals.subtotal)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={confirmOrder}
                                disabled={confirming || order.status !== "placed"}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${confirming || order.status !== "placed"
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl"
                                    }`}
                            >
                                {confirming ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Confirming...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Confirm Order
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => setVendorOrdersOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                <FiClipboard className="w-4 h-4" />
                                Previous Orders
                            </button>


                        </div>
                    </div>
                </div>

                {/* Main Content Grid - 2 Equal Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT: Product Batches Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                                    <FiPackage className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">Main Stocks</h3>
                                    <p className="text-sm text-gray-500">{products.length} products available</p>
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                                {Array.isArray(products) && products.length > 0 ? (
                                    products.map((p) => {
                                        const pid = p.id;
                                        const isExpanded = expandedProductId === pid;
                                        const stockQty = typeof p.stocklevel_quantity !== "undefined" ? p.stocklevel_quantity : getProductStock(p);
                                        const batches = batchesMap[pid] ?? null;

                                        return (
                                            <div key={pid} className="border border-gray-200 rounded-xl p-5 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-all duration-200">
                                                <div className="flex items-center justify-between gap-3 mb-4">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold text-sm">
                                                            {p.image || p.image_url ? (
                                                                <img
                                                                    src={String(p.image || p.image_url).startsWith("http") ? p.image || p.image_url : `${API_HOST}${p.image || p.image_url}`}
                                                                    alt={p.name || "Product"}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = "none"; // hide broken image
                                                                        e.currentTarget.parentElement.textContent = p.name?.charAt(0) || "P";
                                                                    }}
                                                                />
                                                            ) : (
                                                                p.name?.charAt(0) || "P"
                                                            )}
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-semibold text-gray-900 truncate text-lg">{p.name}</div>
                                                            <div className="text-sm text-gray-500">ID: {pid} • SKU: {p.sku || 'N/A'}</div>
                                                            {p.price && (
                                                                <div className="text-sm font-medium text-green-600">₹{p.price}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <StockIndicator stock={stockQty} size="md" />
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
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors duration-150"
                                                >
                                                    {isExpanded ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                                    {isExpanded ? "Hide Batch Details" : "Show Batch Details"}
                                                </button>

                                                {isExpanded && (
                                                    <div className="mt-4 space-y-3">
                                                        {batches === null ? (
                                                            <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                                                                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
                                                                Loading batch information...
                                                            </div>
                                                        ) : batches.length === 0 ? (
                                                            <div className="text-center py-6 text-sm text-gray-500">
                                                                <FiInfo className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                                                                No batch data available for this product
                                                            </div>
                                                        ) : (
                                                            batches.map((b) => (
                                                                <div key={b.id ?? b.batch_no ?? `${pid}-${Math.random()}`} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="font-semibold text-gray-900">
                                                                            Batch: {b.batch_no || "N/A"}
                                                                        </div>
                                                                        <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold">
                                                                            Qty: {b.quantity ?? "N/A"}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                                                                        <div className="flex items-center gap-2">
                                                                            <FiCalendar className="w-4 h-4 text-red-500" />
                                                                            <div>
                                                                                <div className="text-xs text-gray-500">Expires</div>
                                                                                <div className="font-medium">{fmtDate(b.expire_date)}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <FiClock className="w-4 h-4 text-green-500" />
                                                                            <div>
                                                                                <div className="text-xs text-gray-500">Added</div>
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
                                    })
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <FiPackage className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                        <p className="text-lg font-medium">No products available</p>
                                        <p className="text-sm">Products will appear here once loaded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Order Items */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                        <FiShoppingCart className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900">Customer Order Items</h2>
                                        <p className="text-sm text-gray-500">{order.items?.length || 0} items • Total qty: {totals.qty}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/master-admin/orders/${order.id}/edit-items`)}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                                >
                                    <FiEdit2 className="w-4 h-4" />
                                    Edit Items
                                </button>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto pr-2">
                                {Array.isArray(order.items) && order.items.length > 0 ? (
                                    <div className="space-y-4">
                                        {order.items.map((it) => {
                                            const prod = productsMap[it.product_id];
                                            const qty = Number(it.final_qty ?? it.original_qty ?? 0);
                                            const unit = Number(it.unit_price ?? 0);
                                            const subtotal = Number(it.subtotal ?? unit * qty);
                                            const stock = getProductStock(prod);

                                            const imgUrl = prod?.image || prod?.image_url;
                                            const imgSrc = imgUrl ? (String(imgUrl).startsWith("http") ? String(imgUrl) : `${API_HOST}${String(imgUrl)}`) : null;

                                            return (
                                                <div key={it.id} className="flex items-center gap-4 bg-gradient-to-r from-gray-50 to-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                                                    <div className="w-20 h-20 shrink-0">
                                                        {imgSrc ? (
                                                            <img src={imgSrc} alt={prod?.name} className="w-20 h-20 object-cover rounded-xl shadow-sm" />
                                                        ) : (
                                                            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center">
                                                                <FiPackage className="w-8 h-8 text-gray-500" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <h3 className="font-semibold text-lg text-gray-900 truncate">{prod ? prod.name : `Product #${it.product_id}`}</h3>
                                                                    <StockIndicator stock={stock} size="sm" />
                                                                </div>
                                                                <div className="text-sm text-gray-500 mb-2">
                                                                    {prod?.sku ? `SKU: ${prod.sku}` : `ID: ${it.product_id}`}
                                                                    {prod && (
                                                                        <span className="ml-3 px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
                                                                            Available: {typeof prod.stocklevel_quantity !== "undefined" ? prod.stocklevel_quantity : stock}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-400">Item ID: {it.id}</div>
                                                            </div>

                                                            <div className="text-right ml-4">
                                                                <div className="text-xl font-bold text-gray-900 mb-1">{fmtCurrency(subtotal)}</div>
                                                                <div className="text-sm text-gray-500 mb-1">
                                                                    {qty} × {fmtCurrency(unit)}
                                                                </div>
                                                                <div className="text-xs text-gray-400">per unit</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-16">
                                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FiShoppingCart className="w-10 h-10 text-gray-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Items in Order</h3>
                                        <p className="text-gray-500">This order doesn't have any items yet.</p>
                                        <button
                                            onClick={() => navigate(`/master-admin/orders/${order.id}/edit-items`)}
                                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
                                        >
                                            Add Items
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Order Total & Summary */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <div className="space-y-4">
                                    {/* Vendor & Customer Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {vendorUser && (
                                            <div className="bg-purple-50 rounded-xl p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FiUser className="w-4 h-4 text-purple-600" />
                                                    <span className="text-sm font-medium text-purple-900">Vendor</span>
                                                </div>
                                                <div className="text-sm text-purple-800 font-semibold">{vendorUser.name}</div>
                                                <div className="text-xs text-purple-600">ID: {vendorId}</div>
                                            </div>
                                        )}
                                        {customer && (
                                            <div className="bg-blue-50 rounded-xl p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FiUser className="w-4 h-4 text-blue-600" />
                                                    <span className="text-sm font-medium text-blue-900">Customer</span>
                                                </div>
                                                <div className="text-sm text-blue-800 font-semibold">{customer.name}</div>
                                                <div className="text-xs text-blue-600">ID: {customer.id}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Order Total */}
                                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                        <div>
                                            <div className="text-lg font-semibold text-green-900">Order Total</div>
                                            <div className="text-sm text-green-600">Including all items</div>
                                        </div>
                                        <div className="text-3xl font-bold text-green-700">
                                            {fmtCurrency(order.total_amount ?? order.total ?? totals.subtotal)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vendor Previous Orders Drawer */}
                {vendorOrdersOpen && (
                    <div className="fixed inset-0 z-50 flex">
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setVendorOrdersOpen(false)}
                        />
                        <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6">
                                <div className="flex items-center justify-between">
                                    <div className="text-white">
                                        <h3 className="text-xl font-semibold">Previous Orders</h3>
                                        <p className="text-indigo-100 mt-1">
                                            {vendorUser?.name ? `${vendorUser.name} • ` : ""}Vendor #{vendorId}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setVendorOrdersOpen(false)}
                                        className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors duration-200"
                                    >
                                        <FiX className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Search */}
                                <div className="mt-4 relative">
                                    <FiSearch className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={vendorSearch}
                                        onChange={(e) => setVendorSearch(e.target.value)}
                                        placeholder="Search orders..."
                                        className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/60 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 h-full overflow-y-auto">
                                {vendorOrdersLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : filteredVendorOrders.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FiClipboard className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Previous Orders</h3>
                                        <p className="text-gray-500">This vendor doesn't have any previous orders.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredVendorOrders
                                            .filter((o) => o.id !== order.id)
                                            .map((o) => {
                                                const isExpanded = expandedVendorOrder === o.id;
                                                return (
                                                    <div
                                                        key={o.id}
                                                        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all duration-200"
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <h4 className="font-semibold text-gray-900">Order #{o.id}</h4>
                                                                    <StatusBadge status={o.status} />
                                                                </div>
                                                                <div className="text-sm text-gray-500 mb-2">
                                                                    {fmtDate(o.created_at)}
                                                                </div>
                                                                <div className="text-lg font-semibold text-gray-900">
                                                                    {fmtCurrency(o.total_amount ?? o.total ?? 0)}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => setExpandedVendorOrder(isExpanded ? null : o.id)}
                                                                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-150"
                                                            >
                                                                {isExpanded ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                                                {isExpanded ? "Hide" : "Details"}
                                                            </button>
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="mt-4 pt-4 border-t border-gray-100">
                                                                {Array.isArray(o.items) && o.items.length > 0 ? (
                                                                    <div className="space-y-3">
                                                                        {o.items.map((it) => {
                                                                            const p = productsMap[it.product_id];
                                                                            const name = p ? p.name : `Product #${it.product_id}`;
                                                                            const qty = Number(it.final_qty ?? it.original_qty ?? 0);
                                                                            const unit = Number(it.unit_price ?? 0);
                                                                            const subtotal = Number(it.subtotal ?? qty * unit);

                                                                            return (
                                                                                <div key={it.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                                                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                                                                                        {name.charAt(0)}
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="font-medium text-gray-900 truncate">{name}</div>
                                                                                        <div className="text-sm text-gray-500">
                                                                                            {qty} × {fmtCurrency(unit)}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="font-semibold text-gray-900">
                                                                                        {fmtCurrency(subtotal)}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-gray-500 text-center py-4">No items</div>
                                                                )}
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
                )}

            </main>

            {/* Vehicle Selection Modal */}
            {vehicleModalOpen && (
                <div className="fixed inset-0 z-70 flex items-center justify-center px-4 py-6">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => { if (!confirming) setVehicleModalOpen(false); }}
                    />

                    <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6">
                            <div className="flex items-center justify-between">
                                <div className="text-white">
                                    <h3 className="text-xl font-semibold">Select Vehicle for Order Confirmation</h3>
                                    <p className="text-green-100 mt-1">Order #{order.id} • Weight: {orderWeight} Box</p>
                                </div>
                                <button
                                    onClick={() => { if (!confirming) setVehicleModalOpen(false); }}
                                    disabled={confirming}
                                    className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors duration-200"
                                >
                                    <FiX className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingVehicles ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                                    <span className="text-gray-600">Loading available vehicles...</span>
                                </div>
                            ) : vehicles.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FiTruck className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Vehicles Available</h3>
                                    <p className="text-gray-500">No vehicles are currently available for delivery.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {vehicles.map((vehicle) => {
                                        const isSelected = selectedVehicle?.id === vehicle.id;
                                        const hasCapacity = (vehicle.capacity_weight ?? 0) >= (orderWeight ?? 0);
                                        const capacityPercentage = Math.min(((orderWeight ?? 0) / (vehicle.capacity_weight || 1)) * 100, 100);

                                        return (
                                            <div
                                                key={vehicle.id}
                                                onClick={() => hasCapacity && setSelectedVehicle(vehicle)}
                                                className={`border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 ${isSelected
                                                    ? "border-green-500 bg-green-50 shadow-lg"
                                                    : hasCapacity
                                                        ? "border-gray-200 hover:border-green-300 hover:shadow-md"
                                                        : "border-red-200 bg-red-50 cursor-not-allowed opacity-60"
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? "bg-green-500" : hasCapacity ? "bg-blue-500" : "bg-red-500"}`}>
                                                            <FiTruck className="w-6 h-6 text-white" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-lg text-gray-900">{vehicle.vehicle_number}</h4>
                                                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                                                <div className="flex items-center gap-1">
                                                                    <FiPhone className="w-4 h-4" />
                                                                    {vehicle.driver_mobile}
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <FiMapPin className="w-4 h-4" />
                                                                    {vehicle.lat ?? '-'}, {vehicle.lng ?? '-'}
                                                                </div>
                                                            </div>
                                                            {vehicle.details && <p className="text-sm text-gray-500 mt-1">{vehicle.details}</p>}
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className={`text-lg font-bold ${hasCapacity ? "text-green-600" : "text-red-600"}`}>
                                                            {vehicle.capacity_weight ?? '-'} {vehicle.capacity_unit ?? ''}
                                                        </div>
                                                        <div className="text-sm text-gray-500 mb-2">Capacity</div>

                                                        <div className="w-32">
                                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                                <span>Usage</span>
                                                                <span>{Math.round(capacityPercentage)}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className={`h-2 rounded-full transition-all duration-300 ${capacityPercentage > 100 ? "bg-red-500" : capacityPercentage > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                                                                    style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {!hasCapacity && <div className="text-xs text-red-600 mt-1 font-medium">Insufficient capacity</div>}
                                                    </div>
                                                </div>

                                                {isSelected && (
                                                    <div className="mt-4 pt-4 border-t border-green-200">
                                                        <div className="flex items-center gap-2 text-green-700">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    {selectedVehicle ? (
                                        <div className="flex items-center gap-2 text-green-600">
                                            <FiTruck className="w-4 h-4" />
                                            <span>Vehicle {selectedVehicle.vehicle_number} selected</span>
                                        </div>
                                    ) : (
                                        <span>Please select a vehicle to continue</span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setVehicleModalOpen(false)}
                                        disabled={confirming}
                                        className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-white hover:shadow-sm transition-all duration-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmOrderWithVehicle}
                                        disabled={!selectedVehicle || confirming}
                                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${!selectedVehicle || confirming
                                            ? "bg-gray-400 text-white cursor-not-allowed"
                                            : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl"
                                            }`}
                                    >
                                        {confirming ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                                                Confirming Order...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Confirm Order
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}