// src/pages/staff/Orders.jsx
import React, { useEffect, useState, useMemo } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { useNavigate } from "react-router-dom";
import { API_BASE, API_HOST } from "../../lib/config";
import { FiUser, FiShoppingCart, FiPackage, FiSearch } from "react-icons/fi";

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
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-full ${map[status] || "bg-gray-100 text-gray-700"}`}
    >
      {String(status || "").replaceAll("_", " ")}
    </span>
  );
}

export default function StaffOrders() {
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function apiRequest(path) {
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const base = `${API_HOST ?? ""}${API_BASE ?? ""}`.replace(/\/$/, "");
    const suffix = String(path ?? "").replace(/^\//, "");
    const url = `${base}/${suffix}`;
    // console.log("[StaffOrders] apiRequest ->", url);
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ordersData, usersData] = await Promise.all([
          apiRequest("/new-orders/?limit=2000"),
          apiRequest("/users/"),
        ]);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (err) {
        toast(err.message || String(err), "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // build users map with string keys
  const usersMap = useMemo(() => {
    const m = {};
    (users || []).forEach((u) => {
      if (u && typeof u.id !== "undefined") m[String(u.id)] = u;
    });
    return m;
  }, [users]);

  // helper: scan order object for any value that equals a known user id
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
          const v = value[k];
          const f = scan(v);
          if (f) return f;
        }
      }
      return null;
    }

    return scan(o);
  }

  // tolerant resolver for customer
  function resolveCustomer(o) {
    if (!o) return null;

    // 1) If API included full customer object, use it
    if (o.customer && typeof o.customer === "object" && o.customer.name) return o.customer;

    // 2) Common direct id fields
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
    ];
    for (const c of directCandidates) {
      if (c != null) {
        const idStr = String(typeof c === "object" && c.id ? c.id : c);
        if (usersMap[idStr]) return usersMap[idStr];
      }
    }

    // 3) Scan the entire order for any numeric/string matching a known user id
    const found = findUserIdInOrder(o);
    if (found && usersMap[found]) return usersMap[found];

    // nothing matched
    return null;
  }

  // Try resolving vendor by vendor_id (as per your note vendor_id maps to users.id)
  function resolveVendor(o) {
    if (!o) return null;
    if (o.vendor && typeof o.vendor === "object" && o.vendor.name) return o.vendor;
    if (o.vendor_id != null) {
      return usersMap[String(o.vendor_id)] || null;
    }
    // fallback: scan for any user id inside order (rare)
    const found = findUserIdInOrder(o);
    if (found && usersMap[found]) return usersMap[found];
    return null;
  }

  // debug logs to inspect shapes (remove when done)
  useEffect(() => {
    if (orders && orders.length) {
      console.log("[StaffOrders] sample order:", orders[0]);
    } else {
      console.log("[StaffOrders] no orders yet");
    }
    if (users && users.length) {
      console.log("[StaffOrders] sample user:", users[0]);
      console.log("[StaffOrders] usersMap keys:", Object.keys(usersMap).slice(0, 20));
    }
  }, [orders, users, usersMap]);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Unassigned Master Orders</h1>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No orders found.</p>
        ) : (
          <div className="grid gap-4">
            {orders.map((o) => {
              const customer = resolveCustomer(o);
              const vendor = resolveVendor(o);

              // fallback id for display
              const fallbackId =
                o.customer_id ??
                (o.customer && (typeof o.customer === "object" ? o.customer.id : o.customer)) ??
                o.user_id ??
                o.customerId ??
                o.vendor_id ??
                "-";

              // Decide final name to show: prefer customer.name, else vendor.name, else fallback
              const displayName = customer ? customer.name : vendor ? vendor.name : (fallbackId ? `#${fallbackId}` : "#(unknown)");

              return (
                <div
                  key={o.id}
                  onClick={() => navigate(`/admin/orders/movement/${o.vendor_id}?order=${o.id}`)}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order #{o.id}</h2>
                    <StatusBadge status={o.status} />
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Customer / Vendor:{" "}
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {displayName}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Address: <span className="text-gray-800 dark:text-gray-100">{o.shipping_address || "-"}</span>
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Created: {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
                  </div>

                  <div className="font-semibold mt-2 text-gray-900 dark:text-gray-100">₹{o.total_amount ?? o.total ?? 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
