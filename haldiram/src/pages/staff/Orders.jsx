// src/pages/staff/Orders.jsx
import React, { useEffect, useState, useMemo } from "react";
import StaffSidebar from "../../components/StaffSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";

function VendorCell({ vendorId, usersMap }) {
  const user = usersMap[vendorId];
  if (!user) return <span className="text-gray-400">#{vendorId}</span>;
  return (
    <span>
      <span className="font-medium">{user.name}</span>
      <span className="text-xs text-gray-500 ml-1">({user.email})</span>
    </span>
  );
}

export default function StaffOrders() {
  // All state hooks must be defined before any logic that uses them
  const [editOrder, setEditOrder] = useState(null);
  const [editQty, setEditQty] = useState(0);
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [productStocks, setProductStocks] = useState({});

  // Fetch stock info for products in the order when editOrder changes
  useEffect(() => {
    async function fetchStocks() {
      if (!editOrder || !Array.isArray(editOrder.items)) return;
      const stocks = {};
      for (const item of editOrder.items) {
        try {
          const stock = await apiRequest(`/stock/product/${item.product_id}`);
          stocks[item.product_id] = stock.quantity;
        } catch {
          stocks[item.product_id] = null;
        }
      }
      setProductStocks(stocks);
    }
    fetchStocks();
  }, [editOrder]);

  useEffect(() => {
    if (editOrder) {
      const totalQty = Array.isArray(editOrder.items) ? editOrder.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0) : 0;
      setEditQty(totalQty);
      setEditStatus(editOrder.status);
    }
  }, [editOrder]);

  async function handleUpdate() {
    if (!editOrder) return;
    setSaving(true);
    try {
      const payload = {
        items: editOrder.items.map((it) => ({ ...it, qty: editQty })),
        status: editStatus,
      };
      await apiRequest(`/vendor/admin/orders/${editOrder.id}`, { method: "PATCH", body: payload });
      toast("Order updated", "success");
      setEditOrder(null);
    } catch (err) {
      toast(err.message || "Failed to update order", "error");
    } finally {
      setSaving(false);
    }
  }
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  async function apiRequest(path, { method = "GET", body = null } = {}) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API_HOST}${API_BASE}${path}`, {
      method,
      headers,
      body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(data?.detail || data?.message || `Request failed: ${res.status}`);
    return data;
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await apiRequest("/vendor/admin/orders", { method: "GET" });
        if (!mounted) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        toast(err.message || "Failed to load orders", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token]);

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
    users.forEach((u) => { map[u.id] = u; });
    return map;
  }, [users]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <StaffSidebar />
      <main className="flex-1 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">All Vendor Orders</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading || usersLoading ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">No orders found.</td></tr>
              ) : (
                orders.map((o) => {
                  const totalQty = Array.isArray(o.items) ? o.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0) : 0;
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-4">{o.id}</td>
                      <td className="px-4 py-4"><VendorCell vendorId={o.vendor_id} usersMap={usersMap} /></td>
                      <td className="px-4 py-4">{totalQty}</td>
                      <td className="px-4 py-4">{o.status}</td>
                      <td className="px-4 py-4">{o.created_at ? new Date(o.created_at).toLocaleString() : ""}</td>
                      <td className="px-4 py-4">₹{o.total}</td>
                      <td className="px-4 py-4">
                        <button onClick={() => setEditOrder(o)} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Edit</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
      {/* Edit modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Order #{editOrder.id}</h3>
            {Array.isArray(editOrder.items) && editOrder.items.map((item, idx) => (
              <div key={item.product_id} className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Product #{item.product_id}
                  {productStocks[item.product_id] !== undefined && (
                    <span className="ml-2 text-xs text-gray-500">Available: {productStocks[item.product_id] ?? "N/A"}</span>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={e => setEditQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            ))}
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="placed">Placed</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleUpdate} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white font-semibold">
                {saving ? "Saving..." : "Update"}
              </button>
              <button onClick={() => setEditOrder(null)} className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
