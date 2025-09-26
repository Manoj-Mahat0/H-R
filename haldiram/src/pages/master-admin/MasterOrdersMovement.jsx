// src/pages/staff/Orders.jsx
import React, { useEffect, useState } from "react";
import StaffSidebar from "../../components/MasterAdminSidebar"; // restored
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_HOST, API_BASE } from "../../lib/config";

export default function StaffOrders() {
  const { token } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    try {
      setLoading(true);
      const headers = { accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_HOST}${API_BASE}/orders/all?offset=0`, {
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "Request failed");
      }

      const confirmed = (data || []).filter((o) => o.status === "confirmed");
      setOrders(confirmed);
    } catch (err) {
      toast(err.message || String(err), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <StaffSidebar />

      <main className="flex-1 p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">Confirmed Orders</h1>

        {loading ? (
          <p className="text-gray-500">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500">No confirmed orders found.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div
                key={o.id}
                className="p-4 bg-white border rounded-lg shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-lg font-semibold">Order #{o.id}</div>
                    <div className="text-sm text-gray-600">
                      Created:{" "}
                      {o.created_at
                        ? new Date(o.created_at).toLocaleString()
                        : "-"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">₹{o.total_amount ?? 0}</div>
                    <div className="text-sm text-gray-500">
                      Items: {Array.isArray(o.items) ? o.items.length : 0}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mt-2">
                  Address: {o.shipping_address || "-"}
                </div>

                {o.notes && (
                  <div className="text-sm text-gray-500 mt-1">Notes: {o.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
