// src/pages/vendor/Dashboard.jsx
import React, { useEffect, useState } from "react";
import VendorSidebar from "../../components/VendorSidebar";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../lib/config";
import { Link } from "react-router-dom";

/* ---------- Inline SVG icons ---------- */
const IconBox = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 6V4.5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0117 4.5V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconTruck = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7h11v8H3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 11h-3v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="7.5" cy="18.5" r="1.5" fill="currentColor"/>
    <circle cx="18.5" cy="18.5" r="1.5" fill="currentColor"/>
  </svg>
);
const IconWarning = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="17" r="0.6" fill="currentColor"/>
  </svg>
);
const IconPlus = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconEye = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>
);

/* ---------- Component ---------- */
export default function VendorDashboard() {
  const { user } = useAuth();

  // token discovery (same logic you had)
  const tokenFromUser =
    user?.token || user?.access || user?.access_token || user?.jwt || user?.authToken || null;
  const tokenFromStorage =
    typeof window !== "undefined"
      ? window.localStorage.getItem("token") ||
        window.localStorage.getItem("access_token") ||
        window.sessionStorage.getItem("token") ||
        window.sessionStorage.getItem("access_token") ||
        null
      : null;
  const token = tokenFromUser || tokenFromStorage || null;

  // product + orders state
  const [productCount, setProductCount] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [authProblem, setAuthProblem] = useState(null);

  useEffect(() => {
    let ac = new AbortController();
    async function loadProducts() {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const res = await fetch(`${API_URL}/products/`, { signal: ac.signal });
        if (!res.ok) throw new Error(`Products request failed (${res.status})`);
        const data = await res.json();
        setProductCount(Array.isArray(data) ? data.length : data?.count ?? 0);
      } catch (err) {
        if (err.name !== "AbortError") setProductsError(err.message || String(err));
      } finally {
        setProductsLoading(false);
      }
    }
    loadProducts();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    let ac = new AbortController();
    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError(null);
      setAuthProblem(null);
      try {
        const url = `${API_URL}/orders/me?limit=50&offset=0`;
        const headers = { accept: "application/json" };
        const opts = { method: "GET", headers, signal: ac.signal };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        else opts.credentials = "include";

        const res = await fetch(url, opts);
        if (res.status === 401 || res.status === 403) {
          const json = await res.json().catch(() => null);
          const detail = json?.detail || res.statusText || `HTTP ${res.status}`;
          setAuthProblem(detail === "Not authenticated" ? "Not authenticated — please log in" : detail);
          setOrders([]);
          throw new Error(`Auth error (${res.status}): ${detail}`);
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Orders request failed (${res.status}) ${text}`);
        }
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") setOrdersError(err.message || String(err));
      } finally {
        setOrdersLoading(false);
      }
    }
    loadOrders();
    return () => ac.abort();
  }, [token]);

  // derived metrics
  const openOrdersCount = orders.filter((o) =>
    o.status ? !["delivered", "cancelled", "returned"].includes(o.status.toLowerCase()) : true
  ).length;

  // simple status -> color mapping
  function statusColor(status) {
    if (!status) return "bg-gray-100 text-gray-700";
    const s = status.toLowerCase();
    if (["placed", "pending", "confirmed"].includes(s)) return "bg-yellow-100 text-yellow-800";
    if (["shipped", "dispatched"].includes(s)) return "bg-blue-100 text-blue-800";
    if (["delivered"].includes(s)) return "bg-green-100 text-green-800";
    if (["cancelled", "returned"].includes(s)) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-700";
  }

  // initials for avatar if no avatar available
  function initials(name = "") {
    return name.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase() || "U";
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <VendorSidebar />

      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-gradient-to-br from-indigo-600 to-pink-500 w-14 h-14 flex items-center justify-center text-white text-lg font-bold shadow-lg">
              {initials(user?.name || "User")}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Welcome back, <span className="text-indigo-600">{user?.name || "Vendor"}</span></h1>
              <p className="text-sm text-gray-500 mt-1">Overview of your store performance & recent activity</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/vendor/orders" className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-indigo-600 text-white font-medium hover:brightness-105 transition">
  <IconPlus className="w-4 h-4" /> Add Order
</Link>

<Link to="/vendor/my-orders" className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border text-sm hover:shadow transition">
  <IconEye className="w-4 h-4" /> View My Orders
</Link>

          </div>
        </div>

        {/* Stats cards */}
       <div className="flex-1 grid grid-cols-1 gap-4">
    <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-5 hover:shadow-lg transition">
      <div className="w-14 h-14 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700">
        <IconBox className="w-7 h-7" />
      </div>
      <div className="flex-1">
        <div className="text-xs text-gray-500">Your Products</div>
        <div className="mt-1 text-3xl font-extrabold text-gray-900">
          {productsLoading ? <Skeleton width="4rem" height="1.2rem" /> : (productCount ?? "-")}
        </div>
        <div className="text-xs text-gray-400 mt-1">Active items in catalog</div>
      </div>
      <div className="text-sm text-gray-500">Manage ▸</div>
    </div>

    <div className="bg-white p-6 rounded-2xl shadow-md flex items-center gap-5 hover:shadow-lg transition">
      <div className="w-14 h-14 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-700">
        <IconTruck className="w-7 h-7" />
      </div>
      <div className="flex-1">
        <div className="text-xs text-gray-500">Open Orders</div>
        <div className="mt-1 text-3xl font-extrabold text-gray-900">
          {ordersLoading ? <Skeleton width="3rem" height="1.2rem" /> : openOrdersCount}
        </div>
        <div className="text-xs text-gray-400 mt-1">Pending shipments & confirmations</div>
      </div>
      <div className="text-sm text-gray-500">Orders ▸</div>
    </div>
  </div>

        {/* Action strip */}
        {/* <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
          <button className="flex-1 inline-flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-lg shadow hover:brightness-105 transition">
            <IconPlus /> Add product
            <span className="ml-auto text-sm bg-white/10 px-2 py-0.5 rounded-full text-xs">Quick</span>
          </button>
          <button className="flex-1 inline-flex items-center gap-3 px-4 py-3 bg-white border rounded-lg hover:shadow transition">
            <IconEye /> View all orders
          </button>
          <button className="flex-1 inline-flex items-center gap-3 px-4 py-3 bg-white border rounded-lg hover:shadow transition">
            <IconWarning /> Inventory settings
          </button>
        </div> */}

        {/* Recent orders */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Recent orders</h3>
              <div className="text-xs text-gray-500">Showing latest</div>
            </div>

            {ordersLoading ? (
              <div className="mt-4 space-y-3">
                <OrderSkeleton />
                <OrderSkeleton />
                <OrderSkeleton />
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-6 text-sm text-gray-500">No recent orders to show.</div>
            ) : (
              <div className="mt-4 divide-y">
                {orders.slice(0, 8).map((order) => (
                  <div key={order.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-700 font-semibold">
                        #{order.id}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">Order #{order.id}</div>
                        <div className="text-xs text-gray-500">{order.items?.length ?? 0} items — ₹{order.total_amount}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>
                        {order.status || "unknown"}
                      </div>
                      <div className="text-xs text-gray-400">{order.created_at ? formatRelative(order.created_at) : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(ordersError || authProblem) && (
              <div className="mt-4 text-xs text-red-600">
                {authProblem ? `Auth: ${authProblem}` : `Error: ${ordersError}`}
                {!token && <div className="mt-1 text-gray-600">No token found — ensure login stores token in AuthContext or localStorage.</div>}
              </div>
            )}
          </div>

          {/* Quick actions / insights */}
          <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-gray-800">Quick actions</h3>

            <div className="flex flex-col gap-2">
              <button className="w-full inline-flex items-center justify-between px-4 py-3 rounded-lg bg-white border hover:shadow transition">
                <div className="flex items-center gap-3">
                  <IconBox className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-sm font-medium">Manage catalog</div>
                    <div className="text-xs text-gray-500">Edit products & pricing</div>
                  </div>
                </div>
                <div className="text-xs text-indigo-600">Open</div>
              </button>

              <button className="w-full inline-flex items-center justify-between px-4 py-3 rounded-lg bg-white border hover:shadow transition">
                <div className="flex items-center gap-3">
                  <IconTruck className="w-5 h-5 text-yellow-600" />
                  <div>
                    <div className="text-sm font-medium">Manage orders</div>
                    <div className="text-xs text-gray-500">Track shipments & fulfill</div>
                  </div>
                </div>
                <div className="text-xs text-yellow-600">{openOrdersCount}</div>
              </button>

              
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Tip: Click <span className="font-medium text-gray-700">Create product</span> to quickly add items to your catalogue.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Small helpers & skeletons ---------- */

function formatRelative(isoString) {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch (e) {
    return isoString;
  }
}

function Skeleton({ width = "6rem", height = "1rem" }) {
  return (
    <div className="animate-pulse bg-gray-200 rounded" style={{ width, height }} />
  );
}

function OrderSkeleton() {
  return (
    <div className="py-3 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-gray-100 animate-pulse" />
        <div className="space-y-1">
          <div className="w-36 h-3 bg-gray-100 rounded animate-pulse" />
          <div className="w-24 h-2 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-16 h-6 bg-gray-100 rounded animate-pulse" />
        <div className="w-12 h-3 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

/* reuse statusColor function inside component */
function statusColor(status) {
  if (!status) return "bg-gray-100 text-gray-700";
  const s = status.toLowerCase();
  if (["placed", "pending", "confirmed"].includes(s)) return "bg-yellow-100 text-yellow-800";
  if (["shipped", "dispatched"].includes(s)) return "bg-blue-100 text-blue-800";
  if (["delivered"].includes(s)) return "bg-green-100 text-green-800";
  if (["cancelled", "returned"].includes(s)) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}
