// src/pages/admin/DeletedOrders.jsx
import React, { useEffect, useState, useMemo } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import { authFetch } from "../../lib/auth";
import { FiUser, FiShoppingCart, FiPackage, FiTrash2, FiRefreshCw } from "react-icons/fi";

function StatusBadge({ status }) {
  const map = {
    placed: "bg-indigo-100 text-indigo-700",
    confirmed: "bg-blue-100 text-blue-700",
    processing: "bg-yellow-100 text-yellow-700",
    shipped: "bg-orange-100 text-orange-700",
    received: "bg-green-100 text-green-700",
    payment_checked: "bg-green-200 text-green-800",
    cancelled: "bg-red-100 text-red-700",
    returned: "bg-red-200 text-red-800",
    deleted: "bg-red-100 text-red-700",
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {String(status || "").replaceAll("_", " ")}
    </span>
  );
}

export default function AdminDeletedOrders() {
  const { token } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // small helper to normalise API urls (avoids double /api issues)
  async function apiRequest(path) {
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const base = `${API_HOST ?? ""}${API_BASE ?? ""}`.replace(/\/$/, "");
    const suffix = String(path ?? "").replace(/^\//, "");
    const url = `${base}/${suffix}`;
    const res = await fetch(url, { headers });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = await res.text().catch(() => null);
    }
    if (!res.ok) {
      const message = data?.detail || data?.message || (typeof data === "string" ? data : "Request failed");
      throw new Error(message);
    }
    return data;
  }

  async function loadOrders() {
    try {
      setLoading(true);
      const [ordersData, usersData] = await Promise.all([
        apiRequest("/new-orders/?limit=2000"),
        apiRequest("/users/")
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      toast(err.message || String(err), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [token]);

  async function refreshOrders() {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }

  // build users map with string keys to avoid number/string mismatch
  const usersMap = useMemo(() => {
    const m = {};
    (users || []).forEach((u) => {
      if (u && typeof u.id !== "undefined") m[String(u.id)] = u;
    });
    return m;
  }, [users]);

  // scan any nested value for a match against known user ids
  function findUserIdInOrder(o) {
    if (!o || users.length === 0) return null;
    const userIds = new Set(users.map((u) => String(u.id)));

    function scan(value) {
      if (value == null) return null;
      if (typeof value === "number" || typeof value === "string") {
        const s = String(value);
        if (userIds.has(s)) return s;
        return null;
      }
      if (Array.isArray(value)) {
        for (const it of value) {
          const f = scan(it);
          if (f) return f;
        }
      } else if (typeof value === "object") {
        for (const k of Object.keys(value)) {
          const f = scan(value[k]);
          if (f) return f;
        }
      }
      return null;
    }

    return scan(o);
  }

  // tolerant resolver for customer; if not found, we'll later fallback to vendor
  function resolveCustomer(o) {
    if (!o) return null;

    // prefer embedded customer object
    if (o.customer && typeof o.customer === "object" && o.customer.name) return o.customer;

    // common id-like fields
    const directCandidates = [
      o.customer_id,
      o.customer,
      o.user_id,
      o.customerId,
      o.customerID,
      o.created_by,
      o.created_by_id,
      o.userId,
      o.user_id,
      o.client_id,
      o.clientId,
    ];
    for (const c of directCandidates) {
      if (c != null) {
        const idStr = String(typeof c === "object" && c.id ? c.id : c);
        if (usersMap[idStr]) return usersMap[idStr];
      }
    }

    // scan full order for any value that matches a user id
    const found = findUserIdInOrder(o);
    if (found && usersMap[found]) return usersMap[found];

    return null;
  }

  // resolve vendor by vendor_id if needed (per your note vendor_id maps to users.id)
  function resolveVendor(o) {
    if (!o) return null;
    if (o.vendor && typeof o.vendor === "object" && o.vendor.name) return o.vendor;
    if (o.vendor_id != null) {
      return usersMap[String(o.vendor_id)] || null;
    }
    // as last resort scan for any user id in the order
    const found = findUserIdInOrder(o);
    if (found && usersMap[found]) return usersMap[found];
    return null;
  }

  // Filter to show only deleted orders
  const deletedOrders = useMemo(() => {
    return orders.filter(order => order.status === "deleted");
  }, [orders]);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deleted Orders</h1>
          <button
            onClick={refreshOrders}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FiRefreshCw className={`w-4 h-4 text-gray-700 dark:text-gray-200 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading deleted orders...</p>
        ) : deletedOrders.length === 0 ? (
          <div className="text-center py-12">
            <FiTrash2 className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No deleted orders
            </h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              There are currently no deleted orders to display.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {deletedOrders.map((o) => {
              const customer = resolveCustomer(o);
              const vendor = resolveVendor(o);

              // fallback id to show if neither customer nor vendor resolve
              const fallbackId =
                o.customer_id ??
                (o.customer && (typeof o.customer === "object" ? o.customer.id : o.customer)) ??
                o.user_id ??
                o.customerId ??
                o.vendor_id ??
                "-";

              // choose display name: prefer customer, else vendor, else fallback
              const displayName = customer ? customer.name : vendor ? vendor.name : (fallbackId ? `#${fallbackId}` : "#(unknown)");

              return (
                <div
                  key={o.id}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order #{o.id}</h2>
                    <StatusBadge status={o.status} />
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Customer:{" "}
                    <span className="font-medium text-gray-800 dark:text-gray-100">{displayName}</span>
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Address: <span className="text-gray-800 dark:text-gray-100">{o.shipping_address || "-"}</span>
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Created: {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">₹{o.total_amount ?? o.total ?? 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {o.items?.length || 0} items
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                      Deleted
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}