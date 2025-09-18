// src/pages/admin/Dashboard.jsx
import React from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { useAuth } from "../../context/AuthContext";

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back, {user?.name}. This is your admin panel.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Orders</h3>
            <p className="text-2xl font-bold mt-2">128</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Reports</h3>
            <p className="text-2xl font-bold mt-2">42</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Vendors</h3>
            <p className="text-2xl font-bold mt-2">16</p>
          </div>
        </div>
      </main>
    </div>
  );
}
