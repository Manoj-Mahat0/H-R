// src/pages/staff/Orders.jsx
import React, { useEffect, useState, useMemo } from "react";
import StaffSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { useNavigate } from "react-router-dom";
import { API_BASE, API_HOST } from "../../lib/config";
import { authFetch } from "../../lib/auth";
import { FiUser, FiShoppingCart, FiPackage, FiSearch, FiTrash2, FiX, FiFilter } from "react-icons/fi";

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

export default function StaffOrders() {
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // "active" or "deleted"

  // small helper to normalise API urls (avoids double /api issues)
  async function apiRequest(path) {
    const headers = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const base = `${API_HOST ?? ""}${API_BASE ?? ""}`.replace(/\/$/, "");
    const suffix = String(path ?? "").replace(/^\//, "");
    const url = `${base}/${suffix}`;
    // debug: will print the exact url being requested
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
        const [ordersData, usersData] = await Promise.all([apiRequest("/new-orders/?limit=2000"), apiRequest("/users/")]);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (err) {
        toast(err.message || String(err), "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]); // token change will refetch

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

  // Filter orders based on active tab
  const filteredOrders = useMemo(() => {
    if (activeTab === "active") {
      return orders.filter(order => order.status !== "deleted");
    } else {
      return orders.filter(order => order.status === "deleted");
    }
  }, [orders, activeTab]);

  // Open delete confirmation modal
  function openDeleteModal(order) {
    setOrderToDelete(order);
    setDeleteModalOpen(true);
  }

  // Close delete confirmation modal
  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setOrderToDelete(null);
  }

  // Delete an order by changing its status to "deleted"
  async function deleteOrder() {
    if (!orderToDelete) return;
    
    const orderId = orderToDelete.id;
    setDeletingOrderId(orderId);
    closeDeleteModal();
    
    try {
      // First, get the current order details
      const order = await apiRequest(`/new-orders/${orderId}`);
      
      // Prepare the payload with the updated status
      const payload = {
        items: order.items.map(item => ({
          product_id: item.product_id,
          qty: item.qty,
          unit_price: item.unit_price,
          notes: item.notes || ""
        })),
        shipping_address: order.shipping_address,
        notes: order.notes,
        status: "deleted"
      };
      
      // Update the order status to "deleted"
      await authFetch(`/new-orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      
      // Update the local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: "deleted" }
            : order
        )
      );
      
      toast("Order status changed to deleted", "success");
    } catch (err) {
      toast(err.message || "Failed to delete order", "error");
    } finally {
      setDeletingOrderId(null);
    }
  }

  // debug logging — remove or comment out in production
  useEffect(() => {
    if (orders && orders.length) {
      console.log("[StaffOrders] sample order:", orders[0]);
    } else {
      console.log("[StaffOrders] no orders");
    }
    if (users && users.length) {
      console.log("[StaffOrders] sample user:", users[0]);
      console.log("[StaffOrders] usersMap keys:", Object.keys(usersMap).slice(0, 50));
    }
  }, [orders, users, usersMap]);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
      <StaffSidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Unassigned Master Orders</h1>
          
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "active"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Active Orders
            </button>
            <button
              onClick={() => setActiveTab("deleted")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "deleted"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Deleted Orders
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading orders...</p>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <FiFilter className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              {activeTab === "active" ? "No active orders" : "No deleted orders"}
            </h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {activeTab === "active" 
                ? "There are currently no active orders to display." 
                : "There are currently no deleted orders to display."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((o) => {
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
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={activeTab === "active" ? () => navigate(`/master-admin/orders/movement/${o.vendor_id}?order=${o.id}`) : undefined}
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

                  {activeTab === "active" && (
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent navigation to detail page
                          openDeleteModal(o);
                        }}
                        disabled={deletingOrderId === o.id || o.status === "deleted"}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm ${
                          o.status === "deleted"
                            ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            : "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/30"
                        }`}
                      >
                        {deletingOrderId === o.id ? (
                          <>
                            <div className="w-3 h-3 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></div>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <FiTrash2 className="w-4 h-4" />
                            Delete Order
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && orderToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/30" onClick={closeDeleteModal} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 z-10 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Delete Order</h3>
                <button 
                  type="button" 
                  onClick={closeDeleteModal}
                  className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4">
                <p className="text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete this order? This will change the order status to 'deleted'.
                </p>
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Order ID: <span className="font-medium text-gray-900 dark:text-gray-100">#{orderToDelete.id}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Current Status: <span className="font-medium text-gray-900 dark:text-gray-100">{orderToDelete.status}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Total Amount: <span className="font-medium text-gray-900 dark:text-gray-100">₹{orderToDelete.total_amount ?? orderToDelete.total ?? 0}</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={closeDeleteModal}
                  className="px-4 py-2 rounded border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={deleteOrder}
                  className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                >
                  Delete Order
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}