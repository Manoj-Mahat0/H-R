// src/components/StaffSidebar.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../assets/logo.png";
import {
  FiGrid,
  FiBox,
  FiList,
  FiUsers,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiChevronLeft,
} from "react-icons/fi";

export default function StaffSidebar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("staff_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

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
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-gray-100 transition-all duration-200 shadow-sm
      ${collapsed ? "w-20" : "w-72"} h-screen sticky top-0`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <Link to="/" className="flex items-center gap-2">
          <div
            className={`rounded-lg p-2 ${
              collapsed
                ? "bg-transparent"
                : "bg-gradient-to-br from-white to-white"
            }`}
          >
            <img
              src={Logo}
              alt="Sri Gopal Traders logo"
              className={`${collapsed ? "h-6 w-6" : "h-6 w-auto"}`}
              loading="lazy"
            />
          </div>
        </Link>

        {!collapsed && (
          <div>
            <div className="text-sm font-semibold text-gray-900">Staff Panel</div>
            <div className="text-xs text-gray-500">Sri Gopal Traders</div>
          </div>
        )}

        <div className="ml-auto">
          <button
            onClick={toggleCollapse}
            className="p-1 rounded-md hover:bg-gray-100 transition"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FiChevronLeft
              className={`w-4 h-4 text-gray-600 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <div className="space-y-1">
          {nav.map((item) => {
            const active =
              loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${
                    active
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <item.icon className="w-5 h-5" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div
        className={`px-3 py-4 border-t border-gray-100 ${
          collapsed ? "flex items-center justify-center" : ""
        }`}
      >
        {user ? (
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition ${
              collapsed ? "justify-center p-2" : "px-3 py-1.5 border"
            }`}
          >
            <FiLogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        ) : (
          <Link
            to="/login"
            className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition"
          >
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
