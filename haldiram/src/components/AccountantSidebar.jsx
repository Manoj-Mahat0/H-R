
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiHome, FiTrendingUp, FiFileText, FiUsers, FiUser, FiLogOut, FiChevronLeft, FiList
} from "react-icons/fi";
import { clearAuth } from "../lib/auth";
import Logo from "../assets/logo.png";

export default function AccountantSidebar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("accountant_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((s) => {
      const next = !s;
      localStorage.setItem("accountant_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  function handleLogout() {
    clearAuth();
    if (logout) logout();
    navigate("/login");
  }

  const nav = [
    { to: "/accountant/dashboard", label: "Dashboard", icon: FiHome },
    { to: "/accountant/transactions", label: "Transactions", icon: FiTrendingUp },
    { to: "/accountant/reports", label: "Reports", icon: FiFileText },
    { to: "/accountant/vendors", label: "Vendors", icon: FiUsers },
    { to: "/accountant/profile", label: "Profile", icon: FiUser },
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
          aria-label="Open accountant menu"
        >
          <FiList className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

function SidebarInner({ collapsed, onToggleCollapse, user, onLogout, locationPath, compact, onCloseMobile, nav }) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 ${compact ? "justify-center" : ""}`}>
        <Link to="/" className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${compact ? "bg-transparent" : "bg-gradient-to-br from-white to-white"}`}>
                    <img
                      src={Logo}
                      alt="Sri Gopal Traders logo"
                      className={`${compact ? "h-6 w-6" : "h-6 w-auto"}`}
                      loading="lazy"
                    />
                  </div>
                </Link>
        {!compact && (
          <div>
            <div className="text-sm font-semibold text-gray-900">Accountant Panel</div>
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
        ${active ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}
    >
      <div className={`flex items-center justify-center h-9 w-9 rounded-md ${active ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"}`}>
        <Icon className="w-5 h-5" />
      </div>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
