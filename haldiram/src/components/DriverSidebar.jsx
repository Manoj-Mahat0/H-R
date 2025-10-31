// src/components/DriverSidebar.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../assets/logo.png";
import {
  FiPackage,
  FiShoppingBag,
  FiDatabase,
  FiUser,
  FiBarChart2,
  FiLogOut,
  FiChevronLeft,
  FiList,
  FiSun,
  FiMoon,
} from "react-icons/fi";

/**
 * DriverSidebar (dark/light friendly)
 * - Collapsible (persisted key: "vendor_sidebar_collapsed")
 * - Mobile overlay + toggle button
 * - Theme toggle (persisted to "site_theme")
 * - Shows user info + logout
 */
export default function DriverSidebar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("site_theme") || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const saved = localStorage.getItem("vendor_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  // apply persisted theme on mount
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  function toggleCollapse() {
    setCollapsed((s) => {
      const next = !s;
      localStorage.setItem("vendor_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function handleLogout(closeMobile = false) {
    try {
      if (closeMobile) setMobileOpen(false);
      if (logout && typeof logout === "function") {
        await logout();
      } else {
        try { localStorage.removeItem("token"); } catch {}
      }
    } catch (err) {
      try { localStorage.removeItem("token"); } catch {}
    } finally {
      try { navigate("/"); } catch {}
    }
  }

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try { localStorage.setItem("site_theme", next); } catch {}
      if (next === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return next;
    });
  }

  const nav = [
    { to: "/driver/dashboard", label: "Overview", icon: FiBarChart2 },
    { to: "/driver/profile", label: "Profile", icon: FiUser },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-xl">
            <SidebarInner
              collapsed={false}
              onToggleCollapse={toggleCollapse}
              user={user}
              onLogout={(closeMobile = true) => handleLogout(closeMobile)}
              locationPath={loc.pathname}
              compact={false}
              onCloseMobile={() => setMobileOpen(false)}
              nav={nav}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside
        className={`hidden md:flex flex-col transition-all duration-200 ${collapsed ? "w-20" : "w-72"} h-screen sticky top-0
          bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-sm`}
      >
        <SidebarInner
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          user={user}
          onLogout={() => handleLogout(false)}
          locationPath={loc.pathname}
          compact={collapsed}
          nav={nav}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </aside>

      {/* Mobile toggle */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          aria-label="Open driver menu"
          type="button"
        >
          <FiList className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

function SidebarInner({ collapsed, onToggleCollapse, user, onLogout, locationPath, compact, onCloseMobile, nav, theme, onToggleTheme }) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b ${compact ? "justify-center" : ""} border-gray-100 dark:border-gray-800`}>
        <Link to="/" className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${compact ? "bg-transparent" : "bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700"}`}>
            <img src={Logo} alt="Sri Gopal Traders logo" className={`${compact ? "h-6 w-6" : "h-6 w-auto"}`} loading="lazy" />
          </div>
        </Link>

        {!compact && (
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Driver Panel</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Sri Gopal Traders</div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle */}
          {/* <button
            onClick={onToggleTheme}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            type="button"
          >
            {theme === "dark" ? <FiSun className="w-4 h-4 text-yellow-400" /> : <FiMoon className="w-4 h-4 text-gray-600" />}
          </button> */}

          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            <FiChevronLeft className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${compact ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 py-4 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {nav.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              Icon={item.icon}
              active={locationPath === item.to || locationPath.startsWith(item.to + "/")}
              collapsed={compact}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className={`px-3 py-4 border-t ${compact ? "flex items-center justify-center" : ""} border-gray-100 dark:border-gray-800`}>
        {user ? (
          <div className={`flex items-center gap-3 w-full ${compact ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-3">
              {!compact && (
                <div className="truncate">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                </div>
              )}
            </div>

            {!compact ? (
              <button
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                  onLogout(true);
                }}
                className="px-3 py-1.5 border rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition"
                type="button"
              >
                <FiLogOut className="inline w-4 h-4 mr-1" /> Logout
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                  onLogout(true);
                }}
                title="Logout"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                aria-label="Logout"
                type="button"
              >
                <FiLogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Link to="/login" className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ to, label, Icon, active = false, collapsed = false }) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${active ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-purple-700 dark:from-indigo-900 dark:to-purple-800 dark:text-purple-300" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
    >
      <div className={`flex items-center justify-center h-9 w-9 rounded-md ${active ? "bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"}`}>
        <Icon className="w-5 h-5" />
      </div>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
