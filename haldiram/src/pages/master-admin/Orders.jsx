// src/pages/master-admin/Orders.jsx
import React, { useEffect, useState, useMemo } from "react";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";

// Helper to show vendor info
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

export default function MasterAdminOrders() {
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

  // Load orders
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

  // Load users (for vendor info)
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

  // Map userId to user
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.id] = u; });
    return map;
  }, [users]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <MasterAdminSidebar />
      <main className="flex-1 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">All Vendor Orders</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading || usersLoading ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">No orders found.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-4">{o.id}</td>
                    <td className="px-4 py-4"><VendorCell vendorId={o.vendor_id} usersMap={usersMap} /></td>
                    <td className="px-4 py-4">{o.status}</td>
                    <td className="px-4 py-4">{o.created_at ? new Date(o.created_at).toLocaleString() : ""}</td>
                    <td className="px-4 py-4">₹{o.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
