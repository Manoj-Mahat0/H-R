// src/pages/staff/Dashboard.jsx
import React from "react";
import StaffSidebar from "../../components/StaffSidebar";
import { useAuth } from "../../context/AuthContext";

export default function StaffDashboard() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen bg-gray-50">
      <StaffSidebar />
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-gray-800">Staff Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome, {user?.name}. This is your staff panel.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Orders</h3>
            <p className="text-2xl font-bold mt-2">--</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Stock</h3>
            <p className="text-2xl font-bold mt-2">--</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Reports</h3>
            <p className="text-2xl font-bold mt-2">--</p>
          </div>
        </div>
      </main>
    </div>
  );
}
