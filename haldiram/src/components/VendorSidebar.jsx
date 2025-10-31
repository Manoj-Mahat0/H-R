// src/components/VendorSidebar.jsx
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
 * VendorSidebar (dark/light friendly + persistent theme + stored user fallback)
 * - Collapsible persisted at "vendor_sidebar_collapsed"
 * - Theme persisted at "site_theme"
 * - Reads user from AuthContext or from localStorage("user") as fallback
 * - Mobile overlay + toggle
 */
export default function VendorSidebar() {
  const { user: ctxUser, logout } = useAuth();
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
  const [storedUser, setStoredUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("vendor_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  // apply persisted theme on mount/change
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  // load fallback user from localStorage (if AuthContext user missing)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setStoredUser(JSON.parse(raw));
    } catch {
      setStoredUser(null);
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((s) => {
      const next = !s;
      localStorage.setItem("vendor_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
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

  const nav = [
    { to: "/vendor/dashboard", label: "Overview", icon: FiBarChart2 },
    { to: "/vendor/orders", label: "Orders", icon: FiShoppingBag },
    { to: "/vendor/my-orders", label: "My Orders", icon: FiBarChart2 },
    { to: "/vendor/profile", label: "Profile", icon: FiUser },
  ];

  // final user to display: prefer context user, fallback to storedUser
  const displayUser = ctxUser || storedUser;

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
              user={displayUser}
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
          user={displayUser}
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
          aria-label="Open vendor menu"
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
          <div className={`rounded-lg p-2 ${compact ? "bg-transparent" : "bg-gradient-to-br from-white to-white dark:from-gray-800 dark:to-gray-800"}`}>
            <img src={Logo} alt="Sri Gopal Traders logo" className={`${compact ? "h-6 w-6" : "h-6 w-auto"}`} loading="lazy" />
          </div>
        </Link>

        {!compact && (
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vendor Panel</div>
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
          {nav.map((item) => {
            const active = locationPath === item.to || locationPath.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${active ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-purple-700 dark:from-indigo-900 dark:to-purple-800 dark:text-purple-300" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
              >
                <div className={`flex items-center justify-center h-9 w-9 rounded-md ${active ? "bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                {!compact && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
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
                  onLogout();
                }}
                className="px-3 py-1.5 border rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 transition"
              >
                <FiLogOut className="inline w-4 h-4 mr-1" /> Logout
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                  onLogout();
                }}
                title="Logout"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                aria-label="Logout"
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
