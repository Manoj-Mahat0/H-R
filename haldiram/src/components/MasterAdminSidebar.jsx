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
  FiTrash2,
  FiPackage,
  FiX, // Added for closing drawer
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
 *
 * Dark mode: uses tailwind `dark:` classes. Ensure `darkMode: 'class'` in tailwind.config.js
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
        navigate("/");
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
          { to: "/master-admin/new-orders", label: "New orders", icon: FiList },
          { to: "/master-admin/orders/deleted", label: "Deleted orders", icon: FiTrash2 },
          // { to: "/master-admin/orders/movement", label: "Movement", icon: FiList },
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
          { to: "/master-admin/attandance", label: "Attendance", icon: FiUsers },
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
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 shadow-xl">
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
        className={`hidden md:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-all duration-200 shadow-sm
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
          className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
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
        const res = await authFetch("/admin/sidebar/counts", { method: "GET" });
        if (!mounted) return;
        if (res && typeof res === "object") setBadges(res);
      } catch (err) {
        // ignore: graceful fallback to no badges
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

  // State for stock by product drawer
  const [stockDrawerOpen, setStockDrawerOpen] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Fetch stock data by product
  const fetchStockByProduct = async () => {
    if (!stockDrawerOpen) return;
    
    setLoadingStock(true);
    try {
      // Fetch products first
      const productsResponse = await authFetch("/api/v2/products/", { method: "GET" });
      const products = Array.isArray(productsResponse) ? productsResponse : [];
      
      // Fetch stock data
      const stockResponse = await authFetch("/api/v2/stock/", { method: "GET" });
      const stockList = Array.isArray(stockResponse) ? stockResponse : [];
      
      // Group stock by product
      const stockMap = {};
      stockList.forEach(stock => {
        if (!stockMap[stock.product_id]) {
          stockMap[stock.product_id] = 0;
        }
        stockMap[stock.product_id] += stock.quantity;
      });
      
      // Combine product info with stock quantities
      const stockWithProducts = products.map(product => ({
        ...product,
        stock_quantity: stockMap[product.id] || 0
      })).filter(product => product.stock_quantity > 0) // Only show products with stock
      .sort((a, b) => b.stock_quantity - a.stock_quantity); // Sort by stock quantity descending
      
      setStockData(stockWithProducts);
    } catch (error) {
      console.error("Failed to fetch stock data:", error);
    } finally {
      setLoadingStock(false);
    }
  };

  // Toggle stock drawer and fetch data when opening
  const toggleStockDrawer = () => {
    const newState = !stockDrawerOpen;
    setStockDrawerOpen(newState);
    if (newState) {
      fetchStockByProduct();
    }
  };

  return (
    <div className="h-full flex flex-col text-gray-800 dark:text-gray-200" ref={containerRef}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800 ${compact ? "justify-center" : ""}`}>
        <div className="rounded-lg p-2 bg-white dark:bg-gray-900">
          <img src={Logo} alt="Logo" className="h-6 w-auto" />
        </div>
        {!compact && (
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Master Admin</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Sri Gopal Traders</div>
          </div>
        )}

        <div className="ml-auto">
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
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const active =
              locationPath === item.to ||
              (hasChildren && item.children.some((c) => locationPath === c.to || locationPath.startsWith(c.to + "/")));
            const isExpanded = !!expanded[item.to];

            let badgeText = null;
            if (item.to.includes("orders")) {
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
                      setTimeout(() => rebuildFocusableIfNeeded());
                    }}
                    badge={badgeText}
                  />

                  {hasChildren && (
                    <button
                      data-submenu-toggle="1"
                      onClick={() => toggleMenu(item.to)}
                      aria-expanded={isExpanded}
                      className={`ml-1 p-1 rounded ${compact ? "hidden" : "inline-flex"} items-center justify-center text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200`}
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

        <div className={`mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 ${compact ? "px-1" : "px-2"}`}>
          {!compact && <div className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase px-2 mb-2">Quick Links</div>}
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
            
            {/* Stock by Product Link */}
            <div data-side-focus="1" tabIndex={-1}>
              <button
                onClick={toggleStockDrawer}
                className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left ${
                  stockDrawerOpen
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 dark:from-indigo-900/30 dark:to-blue-900/30 dark:text-indigo-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                title={compact ? "Stock by Product" : undefined}
              >
                <div className={`flex items-center justify-center h-9 w-9 rounded-md ${
                  stockDrawerOpen 
                    ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300" 
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                }`}>
                  <FiPackage className="w-5 h-5" />
                </div>
                {!compact && <span className="truncate">Stock by Product</span>}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className={`px-3 py-4 border-t border-gray-100 dark:border-gray-800 ${compact ? "flex items-center justify-center" : ""}`}>
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
                className="px-3 py-1.5 border rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
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

      {/* Stock by Product Drawer */}
      <StockByProductDrawer 
        isOpen={stockDrawerOpen} 
        onClose={() => setStockDrawerOpen(false)} 
        stockData={stockData} 
        loading={loadingStock} 
      />
    </div>
  );

  // small helper to rebuild focusable nodes after UI changes
  function rebuildFocusableIfNeeded() {
    try {
      const root = containerRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll("[data-side-focus='1']"));
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
        ${active
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 dark:from-indigo-900/30 dark:to-blue-900/30 dark:text-indigo-300"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
    >
      <div className={`flex items-center justify-center h-9 w-9 rounded-md ${active ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"}`}>
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
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex items-center justify-center h-7 w-7 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
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

// Stock Drawer Component
function StockByProductDrawer({ isOpen, onClose, stockData, loading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Stock by Product</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-md bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : stockData.length === 0 ? (
            <div className="text-center py-8">
              <FiPackage className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No stock data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stockData.map((product) => (
                <div 
                  key={product.id} 
                  className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{product.product_name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{product.product_code}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                      {product.stock_quantity}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Plant: {product.plant_name}</span>
                    <span className="text-gray-500 dark:text-gray-400">Category: {product.main_category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
