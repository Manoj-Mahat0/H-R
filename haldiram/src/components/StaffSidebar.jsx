// src/components/StaffSidebar.jsx
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiGrid, FiBox, FiList, FiTag, FiUsers, FiBarChart2, FiSettings, FiLogOut } from "react-icons/fi";

export default function StaffSidebar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapse() {
    setCollapsed((s) => {
      const next = !s;
      localStorage.setItem("staff_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const nav = [
    { to: "/staff/dashboard", label: "Overview", icon: FiGrid },
    { to: "/staff/orders", label: "Orders", icon: FiBox },
    { to: "/staff/stock", label: "Stock", icon: FiList },
    { to: "/staff/reports", label: "Reports", icon: FiBarChart2 },
    { to: "/staff/settings", label: "Settings", icon: FiSettings },
    { to: "/staff/profile", label: "Profile", icon: FiUsers },
  ];

  return (
    <aside className={`hidden md:flex flex-col bg-white border-r border-gray-100 transition-all duration-200 shadow-sm ${collapsed ? "w-20" : "w-72"} h-screen sticky top-0`}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-indigo-700">Staff</span>
        </div>
        <button onClick={toggleCollapse} className="text-gray-400 hover:text-gray-600">
          {collapsed ? "→" : "←"}
        </button>
      </div>
      <nav className="flex-1 py-4">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg mb-2 hover:bg-indigo-50 transition ${loc.pathname === item.to ? "bg-indigo-100 text-indigo-700" : "text-gray-700"}`}
          >
            <item.icon className="w-5 h-5" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>
      <div className="px-4 pb-4">
        <button onClick={handleLogout} className="w-full px-4 py-2 rounded bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-2">
          <FiLogOut />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
