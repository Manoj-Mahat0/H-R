// src/pages/vendor/Dashboard.jsx
import React from "react";
import VendorSidebar from "../../components/VendorSidebar";
import { useAuth } from "../../context/AuthContext";

export default function VendorDashboard() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <VendorSidebar />

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Vendor Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome, {user?.name}. Manage your products and orders here.</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-3 py-2 rounded-md bg-white border text-sm">Import</button>
            <button className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm">New product</button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Your Products</h3>
            <p className="text-2xl font-bold mt-2">24</p>
            <p className="text-xs text-gray-500 mt-1">Active items</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Open Orders</h3>
            <p className="text-2xl font-bold mt-2">7</p>
            <p className="text-xs text-gray-500 mt-1">Pending shipments</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-700">Low stock</h3>
            <p className="text-2xl font-bold mt-2">3</p>
            <p className="text-xs text-gray-500 mt-1">Items below threshold</p>
          </div>
        </div>

        {/* Recent orders / quick list */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700">Recent orders</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">Order #P1023</div>
                  <div className="text-xs text-gray-500">2 items — ₹240</div>
                </div>
                <div className="text-xs text-gray-500">2h ago</div>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">Order #P1019</div>
                  <div className="text-xs text-gray-500">1 item — ₹120</div>
                </div>
                <div className="text-xs text-gray-500">8h ago</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700">Quick actions</h3>
            <div className="mt-3 flex flex-col gap-3">
              <button className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm">Create new product</button>
              <button className="px-3 py-2 rounded-md bg-white border text-sm">View all orders</button>
              <button className="px-3 py-2 rounded-md bg-white border text-sm">Update inventory</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
