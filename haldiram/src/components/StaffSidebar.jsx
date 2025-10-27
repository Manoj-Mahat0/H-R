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
  FiSun,
  FiMoon,
} from "react-icons/fi";

export default function StaffSidebar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("site_theme") || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const saved = localStorage.getItem("staff_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  // apply persisted theme on mount / change
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  function toggleCollapse() {
    setCollapsed((s) => {
      const next = !s;
      localStorage.setItem("staff_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  function handleLogout() {
    if (logout) logout();
    navigate("/login");
  }

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("site_theme", next);
      } catch {}
      if (next === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return next;
    });
  }

  const nav = [
    { to: "/staff/dashboard", label: "Overview", icon: FiGrid },
    { to: "/staff/orders", label: "Orders", icon: FiBox },
    // { to: "/staff/stock", label: "Stock", icon: FiList },
    // { to: "/staff/reports", label: "Reports", icon: FiBarChart2 },
    // { to: "/staff/settings", label: "Settings", icon: FiSettings },
    { to: "/staff/profile", label: "Profile", icon: FiUsers },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col transition-all duration-200
        ${collapsed ? "w-20" : "w-72"} h-screen sticky top-0
        bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-sm`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <Link to="/" className="flex items-center gap-2">
          <div
            className={`rounded-lg p-2 ${
              collapsed
                ? "bg-transparent"
                : "bg-gradient-to-br from-white to-white dark:from-gray-800 dark:to-gray-800"
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
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Staff Panel
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Sri Gopal Traders
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle */}
          {/* <button
            onClick={toggleTheme}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            type="button"
          >
            {theme === "dark" ? (
              <FiSun className="w-4 h-4 text-yellow-400" />
            ) : (
              <FiMoon className="w-4 h-4 text-gray-600" />
            )}
          </button> */}

          <button
            onClick={toggleCollapse}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            <FiChevronLeft
              className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${
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
            const IconComp = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${active
                    ? "bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
              >
                <div
                  className={`flex items-center justify-center h-9 w-9 rounded-md ${
                    active
                      ? "bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                  }`}
                >
                  <IconComp className="w-5 h-5" />
                </div>

                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div
        className={`px-3 py-4 border-t border-gray-100 dark:border-gray-800 ${
          collapsed ? "flex items-center justify-center" : ""
        }`}
      >
        {user ? (
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition ${
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
