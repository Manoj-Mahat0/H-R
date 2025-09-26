// src/pages/staff/Orders.jsx
import React, { useEffect, useState, useMemo } from "react";
import StaffSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { useNavigate } from "react-router-dom";
import { API_BASE, API_HOST } from "../../lib/config";

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
      className={`px-2 py-1 text-xs font-semibold rounded-full ${
        map[status] || "bg-gray-100 text-gray-700"
      }`}
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
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_HOST}${API_BASE}${path}`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || data?.message || "Request failed");
    return data;
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ordersData, usersData] = await Promise.all([
          apiRequest("/orders/all?limit=100&offset=0"),
          apiRequest("/users/"),
        ]);
        setOrders(ordersData || []);
        setUsers(usersData || []);
      } catch (err) {
        toast(err.message || String(err), "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const usersMap = useMemo(() => {
    const m = {};
    users.forEach((u) => (m[u.id] = u));
    return m;
  }, [users]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <StaffSidebar />
      <main className="flex-1 p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">Unassigned Orders</h1>

        {loading ? (
          <p className="text-gray-500">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500">No orders found.</p>
        ) : (
          <div className="grid gap-4">
            {orders.map((o) => {
              const customer = usersMap[o.customer_id];
              return (
                <div
                  key={o.id}
                  onClick={() =>
                    // NAVIGATE TO VENDOR MOVEMENT ROUTE (vendor id is :id)
                    // pass order id as query so movement page can preselect this order
                    navigate(`/master-admin/orders/movement/${o.vendor_id}?order=${o.id}`)
                  }
                  className="p-4 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition"
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Order #{o.id}</h2>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Customer:{" "}
                    <span className="font-medium">
                      {customer ? customer.name : `#${o.customer_id}`}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Address: {o.shipping_address || "-"}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Created: {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
                  </div>
                  <div className="font-semibold mt-2">₹{o.total_amount ?? o.total ?? 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
