// src/components/MasterAdminSidebar.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../lib/auth";
import {
  FiGrid,
  FiBox,
  FiList,
  FiTag,
  FiUsers,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiChevronLeft,
  FiShoppingBag,
  FiTruck,
  FiChevronRight,
} from "react-icons/fi";

/**
 * MasterAdminSidebar with:
 *  - submenu support (children)
 *  - animated expand/collapse
 *  - keyboard navigation (arrow keys + Enter)
 *  - API-driven badges (optional; non-blocking)
 *
 * Behavior:
 *  - expanded submenu state persisted in localStorage
 *  - collapse (compact) mode still shows icons & tooltips
 *  - fetches badge counts from /admin/sidebar/counts (if available)
 */

export default function MasterAdminSidebar() {
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

  async function handleLogout(closeMobile = false) {
    try {
      if (closeMobile) setMobileOpen(false);
      if (logout && typeof logout === "function") {
        await logout();
      } else {
        try {
          localStorage.removeItem("token");
        } catch {}
      }
    } catch (err) {
      try {
        localStorage.removeItem("token");
      } catch {}
    } finally {
      try {
        navigate("/login");
      } catch {}
    }
  }

  // nav with optional children
  const nav = useMemo(
    () => [
      { to: "/dashboard", label: "Overview", icon: FiGrid },
      { to: "/master-admin/products", label: "Products", icon: FiBox },
      { to: "/master-admin/categories", label: "Categories", icon: FiList },
      { to: "/master-admin/tags", label: "Tags", icon: FiTag },
      { to: "/master-admin/stock", label: "Stock", icon: FiBox },
      {
        to: "/master-admin/orders",
        label: "Orders",
        icon: FiShoppingBag,
        children: [
          { to: "/master-admin/orders", label: "All orders", icon: FiList },
          { to: "/master-admin/orders/movement", label: "Movement", icon: FiList },
        ],
      },
      {
        to: "/master-admin/vehicles",
        label: "Vehicles",
        icon: FiTruck,
        children: [
          { to: "/master-admin/vehicles", label: "All vehicles", icon: FiTruck },
          { to: "/master-admin/vehicles/add", label: "Add vehicle", icon: FiTruck },
        ],
      },
      {
        to: "/master-admin/customers",
        label: "Users",
        icon: FiUsers,
        children: [
          { to: "/master-admin/customers", label: "All Users", icon: FiUsers },
          { to: "/master-admin/customers/add-limits", label: "Add Limits", icon: FiUsers },
          // { to: "/master-admin/customers/loyalty", label: "Loyalty", icon: FiUsers },
        ],
      },
      { to: "/master-admin/profile", label: "Profile", icon: FiUsers },
    ],
    []
  );

  const quick = useMemo(
    () => [
      { to: "/master-admin/reports", label: "Reports", icon: FiBarChart2 },
      { to: "/master-admin/settings", label: "Settings", icon: FiSettings },
    ],
    []
  );

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
              onLogout={(closeMobile = true) => handleLogout(closeMobile)}
              locationPath={loc.pathname}
              compact={false}
              onCloseMobile={() => setMobileOpen(false)}
              nav={nav}
              quick={quick}
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
          onLogout={() => handleLogout(false)}
          locationPath={loc.pathname}
          compact={collapsed}
          nav={nav}
          quick={quick}
        />
      </aside>

      {/* Mobile toggle */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg bg-white shadow text-gray-700 hover:bg-gray-100 transition"
          aria-label="Open menu"
          type="button"
        >
          <FiList className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

/* ---------------- SidebarInner ---------------- */

function SidebarInner({
  collapsed,
  onToggleCollapse,
  user,
  onLogout,
  locationPath,
  compact,
  onCloseMobile,
  nav,
  quick,
}) {
  // expanded menus persisted in localStorage as JSON array of `to` keys
  const [expanded, setExpanded] = useState(() => {
    try {
      const raw = localStorage.getItem("admin_sidebar_expanded");
      if (!raw) return {};
      const arr = JSON.parse(raw);
      const obj = {};
      (arr || []).forEach((k) => {
        obj[k] = true;
      });
      return obj;
    } catch {
      return {};
    }
  });

  const [badges, setBadges] = useState({}); // badge counts from API (optional)
  const containerRef = useRef(null);

  useEffect(() => {
    try {
      const keys = Object.keys(expanded).filter((k) => expanded[k]);
      localStorage.setItem("admin_sidebar_expanded", JSON.stringify(keys));
    } catch {}
  }, [expanded]);

  // fetch badge counts (non-blocking)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Change this endpoint to whatever your backend provides for sidebar counts
        const res = await authFetch("/admin/sidebar/counts", { method: "GET" });
        if (!mounted) return;
        // expect shape: { orders_pending: 5, returns: 2, ... } — adapt in UI below
        if (res && typeof res === "object") setBadges(res);
      } catch (err) {
        // ignore: graceful fallback to no badges
        // console.debug("sidebar badge fetch failed", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function toggleMenu(key) {
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  }

  // keyboard navigation state
  const focusable = useRef([]); // array of nodes in order
  const currentIndex = useRef(-1);

  const rebuildFocusable = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll("[data-side-focus='1']"));
    focusable.current = nodes;
  }, []);

  useEffect(() => {
    rebuildFocusable();
    // rebuild on window resize (submenu show/hide)
    const ro = new ResizeObserver(() => rebuildFocusable());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", rebuildFocusable);
    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("resize", rebuildFocusable);
    };
  }, [rebuildFocusable, expanded]);

  function focusByIndex(idx) {
    currentIndex.current = idx;
    const node = focusable.current[idx];
    if (node && typeof node.focus === "function") node.focus();
  }

  function handleKeyDown(e) {
    // only handle when focus is inside sidebar
    if (!containerRef.current || !containerRef.current.contains(document.activeElement)) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(currentIndex.current + 1, focusable.current.length - 1);
      focusByIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(currentIndex.current - 1, 0);
      focusByIndex(prev);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const node = focusable.current[currentIndex.current];
      if (!node) return;
      const submenuBtn = node.querySelector("[data-submenu-toggle='1']");
      if (submenuBtn) submenuBtn.click();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      // find closest expanded parent and collapse
      const node = focusable.current[currentIndex.current];
      if (!node) return;
      const parentKey = node.getAttribute("data-parent-key");
      if (parentKey) {
        setExpanded((s) => ({ ...s, [parentKey]: false }));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const node = focusable.current[currentIndex.current];
      if (!node) return;
      const link = node.querySelector("a");
      const btn = node.querySelector("button[data-submenu-toggle='1']");
      if (btn) btn.click();
      else if (link) link.click();
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 ${compact ? "justify-center" : ""}`}>
        <div className="bg-gradient-to-br from-white to-white text-white rounded-lg p-2">
  <img src={Logo} alt="Logo" className="h-6 w-auto" />
</div>
        {!compact && (
          <div>
            <div className="text-sm font-semibold text-gray-900">Master Admin</div>
            <div className="text-xs text-gray-500">Sri Gopal Traders</div>
          </div>
        )}

        <div className="ml-auto">
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-gray-100 transition"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            <FiChevronLeft className={`w-4 h-4 text-gray-600 ${compact ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 py-4 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {nav.map((item, idx) => {
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const active =
              locationPath === item.to ||
              (hasChildren && item.children.some((c) => locationPath === c.to || locationPath.startsWith(c.to + "/")));
            const isExpanded = !!expanded[item.to];

            // derive badge text from badges object (best-effort)
            let badgeText = null;
            if (item.to.includes("orders")) {
              // map a few common badge keys
              badgeText = badges?.orders_pending ?? badges?.orders ?? null;
            }
            if (item.to.includes("customers")) {
              badgeText = badges?.customers ?? null;
            }

            return (
              <div
                key={item.to}
                className="group"
                data-side-focus="1"
                tabIndex={-1}
                data-parent-key={hasChildren ? item.to : ""}
              >
                <div className="flex items-center justify-between">
                  <NavItem
                    to={item.to}
                    label={item.label}
                    Icon={item.icon}
                    active={active}
                    collapsed={compact}
                    onClick={() => {
                      if (onCloseMobile) onCloseMobile();
                      // after clicking a link, rebuild focusable nodes
                      setTimeout(() => rebuildFocusableIfNeeded());
                    }}
                    badge={badgeText}
                  />

                  {hasChildren && (
                    <button
                      data-submenu-toggle="1"
                      onClick={() => toggleMenu(item.to)}
                      aria-expanded={isExpanded}
                      className={`ml-1 p-1 rounded ${compact ? "hidden" : "inline-flex"} items-center justify-center text-gray-400 hover:text-gray-600`}
                      type="button"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <FiChevronRight className={`w-4 h-4 transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                  )}
                </div>

                {/* Children - animated height + opacity */}
                {hasChildren && (
                  <AnimatedSubmenu show={isExpanded && !compact}>
                    <div className="ml-12 mt-1 space-y-1">
                      {item.children.map((c) => (
                        <div key={c.to} data-side-focus="1" tabIndex={-1} data-parent-key={item.to}>
                          <SubNavItem
                            to={c.to}
                            label={c.label}
                            Icon={c.icon}
                            active={locationPath === c.to || locationPath.startsWith(c.to + "/")}
                            onClick={() => {
                              if (onCloseMobile) onCloseMobile();
                              setTimeout(() => rebuildFocusableIfNeeded());
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </AnimatedSubmenu>
                )}
              </div>
            );
          })}
        </div>

        <div className={`mt-6 pt-4 border-t border-gray-100 ${compact ? "px-1" : "px-2"}`}>
          {!compact && <div className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Quick Links</div>}
          <div className="space-y-1">
            {quick.map((q) => (
              <div key={q.to} data-side-focus="1" tabIndex={-1}>
                <NavItem
                  to={q.to}
                  label={q.label}
                  Icon={q.icon}
                  active={locationPath.startsWith(q.to)}
                  collapsed={compact}
                  onClick={() => {
                    if (onCloseMobile) onCloseMobile();
                    setTimeout(() => rebuildFocusableIfNeeded());
                  }}
                />
              </div>
            ))}
          </div>
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
                  onLogout(true);
                }}
                className="px-3 py-1.5 border rounded-md text-sm text-red-600 hover:bg-red-50 transition"
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
                className="p-2 rounded-md hover:bg-gray-100 transition"
                aria-label="Logout"
                type="button"
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

  // small helper to rebuild focusable nodes after UI changes
  function rebuildFocusableIfNeeded() {
    try {
      const root = containerRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll("[data-side-focus='1']"));
      // if length differs, set currentIndex to 0 for safety
      if (nodes.length && currentIndex.current === -1) {
        currentIndex.current = 0;
        nodes[0].focus?.();
      }
    } catch {}
  }
}

/* ---------------- Nav items & Animated submenu ---------------- */

function NavItem({ to, label, Icon, active = false, collapsed = false, onClick, badge = null }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${active ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50"}`}
    >
      <div className={`flex items-center justify-center h-9 w-9 rounded-md ${active ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"}`}>
        <Icon className="w-5 h-5" />
      </div>

      {!collapsed && (
        <div className="flex items-center justify-between w-full">
          <span className="truncate">{label}</span>
          {badge != null && (
            <span className="ml-3 inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white">
              {badge}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function SubNavItem({ to, label, Icon, active = false, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex items-center justify-center h-7 w-7 rounded-md bg-gray-100 text-gray-600">
        <Icon className="w-4 h-4" />
      </div>
      <span className="truncate text-sm">{label}</span>
    </Link>
  );
}

/**
 * AnimatedSubmenu: smoothly animates open/close using measured height & opacity
 * Props: show (boolean), children
 */
function AnimatedSubmenu({ show, children }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ height: 0, opacity: 0, overflow: "hidden" });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (show) {
      // measure height
      el.style.height = "auto";
      const h = el.scrollHeight;
      setStyle({ height: 0, opacity: 0, overflow: "hidden" });
      // force repaint
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight;
      setStyle({ height: h, opacity: 1, overflow: "hidden", transition: "height 220ms ease, opacity 180ms ease" });
      const t = setTimeout(() => setStyle({ height: "auto", opacity: 1, overflow: "visible" }), 230);
      return () => clearTimeout(t);
    } else {
      // closing: set fixed height then to 0
      const h = el.scrollHeight;
      setStyle({ height: h, opacity: 1, overflow: "hidden" });
      // force repaint
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight;
      setStyle({ height: 0, opacity: 0, overflow: "hidden", transition: "height 220ms ease, opacity 180ms ease" });
    }
  }, [show]);

  return (
    <div
      ref={ref}
      style={{
        height: style.height,
        opacity: style.opacity,
        overflow: style.overflow,
        transition: style.transition,
      }}
    >
      {children}
    </div>
  );
}
