// src/pages/Dashboard.jsx
import React from "react";
import MasterAdminSidebar from "../components/MasterAdminSidebar";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, logout } = useAuth();

  const stats = [
    { title: "Total Customers", value: "1,234", delta: "+12% from last month" },
    { title: "Products in Stock", value: "567", delta: "+5% from last month" },
    { title: "Monthly Revenue", value: "₹2.5M", delta: "+18% from last month" },
    { title: "Orders This Month", value: "89", delta: "+8% from last month" },
  ];

  const quickActions = [
    { title: "Add Product", desc: "Add a new product", to: "/dashboard/products" },
    { title: "View Orders", desc: "Check and manage orders", to: "/dashboard/orders" },
    { title: "Analytics", desc: "View business analytics", to: "/dashboard/reports" },
    { title: "Settings", desc: "Manage account settings", to: "/dashboard/settings" },
  ];

  const recentOrders = [
    { id: "#1001", title: "Haldiram Namkeen Mix", price: "₹450", time: "2 hours ago" },
    { id: "#1000", title: "Haldiram Sweets Box", price: "₹320", time: "1 day ago" },
  ];

  const lowStock = [{ name: "Haldiram Sweets", qty: 5 }];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <MasterAdminSidebar />

      {/* Content */}
      <div className="flex-1 p-6 md:p-8">
        {/* Topbar */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600">
              Welcome back! Here's what's happening with your business.
            </p>
          </div>

          {/* <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              Signed in as{" "}
              <span className="font-semibold text-gray-900">{user?.name || "Admin"}</span>
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm rounded-md bg-red-50 text-red-600 hover:bg-red-100"
            >
              Logout
            </button>
          </div> */}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div
              key={s.title}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
            >
              <div className="text-sm text-gray-500">{s.title}</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="mt-1 text-xs text-green-600">{s.delta}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <h3 className="mt-8 text-lg font-semibold text-gray-900">Quick Actions</h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <Link
              key={a.title}
              to={a.to}
              className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition"
            >
              <div className="font-semibold text-gray-900">{a.title}</div>
              <div className="text-sm text-gray-500">{a.desc}</div>
            </Link>
          ))}
        </div>

        {/* Recent Orders + Low Stock */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h4 className="text-lg font-semibold text-gray-900">Recent Orders</h4>
            <div className="mt-4 space-y-3">
              {recentOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between p-3 rounded-md bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-gray-800">
                      {o.id} — {o.title}
                    </div>
                    <div className="text-sm text-gray-500">{o.time}</div>
                  </div>
                  <div className="font-semibold text-gray-900">{o.price}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h4 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h4>
            <div className="mt-4 space-y-3">
              {lowStock.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between p-4 rounded-md bg-red-50"
                >
                  <div>
                    <div className="font-medium text-red-700">{p.name}</div>
                    <div className="text-sm text-red-600">
                      Only {p.qty} units left
                    </div>
                  </div>
                  <button className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                    Restock
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
