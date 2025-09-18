// src/components/AdminSidebar.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiGrid, FiBox, FiTag, FiShoppingCart, FiBarChart2, FiUsers, FiSettings, FiLogOut, FiChevronLeft, FiList } from "react-icons/fi";

/**
 * AdminSidebar
 * - behavior & styles intentionally match MasterAdminSidebar
 * - persist collapsed state in localStorage key: "admin_sidebar_collapsed"
 * - mobile overlay + small toggle button
 */

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((s) => {
      const next = !s;
      localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const nav = [
    { to: "/admin/dashboard", label: "Dashboard", icon: FiGrid },
    { to: "/admin/products", label: "Products", icon: FiBox },
    { to: "/admin/categories", label: "Categories", icon: FiList },
    { to: "/admin/tags", label: "Tags", icon: FiTag },
    { to: "/admin/orders", label: "Orders", icon: FiShoppingCart },
    { to: "/admin/customers", label: "Customers", icon: FiUsers },
    { to: "/admin/reports", label: "Reports", icon: FiBarChart2 },
    { to: "/admin/settings", label: "Settings", icon: FiSettings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-gray-100 shadow-xl">
            <SidebarInner
              collapsed={false}
              onToggleCollapse={toggleCollapse}
              user={user}
              onLogout={handleLogout}
              locationPath={loc.pathname}
              compact={false}
              onCloseMobile={() => setMobileOpen(false)}
              nav={nav}
            />
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-100 transition-all duration-200 shadow-sm
        ${collapsed ? "w-20" : "w-72"} h-screen sticky top-0`}
      >
        <SidebarInner
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          user={user}
          onLogout={handleLogout}
          locationPath={loc.pathname}
          compact={collapsed}
          nav={nav}
        />
      </aside>

      {/* Mobile toggle */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg bg-white shadow text-gray-700 hover:bg-gray-100 transition"
          aria-label="Open admin menu"
        >
          <FiList className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

/* inner content used for both mobile + desktop to avoid duplication */
function SidebarInner({ collapsed, onToggleCollapse, user, onLogout, locationPath, compact, onCloseMobile, nav }) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 ${compact ? "justify-center" : ""}`}>
        <div className="bg-gradient-to-br from-green-600 to-teal-600 text-white rounded-lg p-2">
          <FiGrid className="w-5 h-5" />
        </div>

        {!compact && (
          <div>
            <div className="text-sm font-semibold text-gray-900">Admin Panel</div>
            <div className="text-xs text-gray-500">Sri Gopal Traders</div>
          </div>
        )}

        <div className="ml-auto">
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-gray-100 transition"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FiChevronLeft className={`w-4 h-4 text-gray-600 ${compact ? "rotate-180" : ""}`} />
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
      <div className={`px-3 py-4 border-t border-gray-100 ${compact ? "flex items-center justify-center" : ""}`}>
        {user ? (
          <div className={`flex items-center gap-3 w-full ${compact ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-3">
              {!compact && (
                <div className="truncate">
                  <div className="text-sm font-semibold text-gray-900 truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
              )}
            </div>

            {!compact ? (
              <button
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                  onLogout();
                }}
                className="px-3 py-1.5 border rounded-md text-sm text-red-600 hover:bg-red-50 transition"
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
                className="p-2 rounded-md hover:bg-gray-100 transition"
                aria-label="Logout"
              >
                <FiLogOut className="h-4 w-4 text-red-600" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Link to="/login" className="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-blue-700 transition">
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
        ${active ? "bg-gradient-to-r from-green-50 to-teal-50 text-teal-700" : "text-gray-700 hover:bg-gray-50"}`}
    >
      <div className={`flex items-center justify-center h-9 w-9 rounded-md ${active ? "bg-teal-100 text-teal-600" : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"}`}>
        <Icon className="w-5 h-5" />
      </div>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
