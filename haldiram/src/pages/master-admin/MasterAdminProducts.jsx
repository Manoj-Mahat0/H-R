// src/pages/master-admin/MasterAdminProducts.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AdminSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import { getToken } from "../../lib/auth";
import {
  FiBox,
  FiEye,
  FiEyeOff,
  FiEdit3,
  FiTrash2,
  FiSearch,
  FiPlus,
  FiImage,
  FiList,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";

/* ---------- helpers ---------- */
function formatIN(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ---------- expiry helpers ----------
function daysBetween(dateA, dateB = new Date()) {
  try {
    const a = new Date(dateA);
    const b = new Date(dateB);
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((utcA - utcB) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function expiryClassesForDays(daysLeft) {
  // returns { bar, bg, text, border, label, neutral }
  if (daysLeft == null) {
    return {
      bar: "bg-gray-300 dark:bg-gray-500",
      bg: "bg-gray-50 dark:bg-gray-800",
      text: "text-gray-600 dark:text-gray-300",
      border: "border-gray-100 dark:border-gray-700",
      label: "Unknown",
      neutral: true,
    };
  }

  if (daysLeft < 0) {
    return {
      bar: "bg-red-600 dark:bg-red-500",
      bg: "bg-red-50 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-100 dark:border-red-800",
      label: "Expired",
      neutral: false,
    };
  }

  if (daysLeft <= 7) {
    return {
      bar: "bg-red-400 dark:bg-red-500",
      bg: "bg-red-50 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-100 dark:border-red-800",
      label: `Expiring soon (${daysLeft}d)`,
      neutral: false,
    };
  }

  if (daysLeft <= 30) {
    return {
      bar: "bg-orange-400 dark:bg-orange-500",
      bg: "bg-orange-50 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-300",
      border: "border-orange-100 dark:border-orange-800",
      label: `Expiring in ${daysLeft}d`,
      neutral: false,
    };
  }

  if (daysLeft <= 90) {
    return {
      bar: "bg-amber-400 dark:bg-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-100 dark:border-amber-800",
      label: `~${Math.ceil(daysLeft / 30)}m left`,
      neutral: false,
    };
  }

  if (daysLeft <= 180) {
    return {
      bar: "bg-blue-400 dark:bg-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-100 dark:border-blue-800",
      label: `~${Math.ceil(daysLeft / 30)}m left`,
      neutral: false,
    };
  }

  return {
    bar: "bg-emerald-400 dark:bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-100 dark:border-emerald-800",
    label: `Good (${Math.ceil(daysLeft / 30)}m)`,
    neutral: false,
  };
}



/* ---------- MultiSelectDropdown ---------- */
function MultiSelectDropdown({ options = [], selected = [], onChange, placeholder = "Select", search = true }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggleId(id) {
    const arr = Array.isArray(selected) ? [...selected] : [];
    const idx = arr.indexOf(id);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(id);
    onChange(arr);
  }

  const filteredOptions = q ? options.filter((o) => (o.name || "").toLowerCase().includes(q.toLowerCase())) : options;

  const selectedNames = options.filter((o) => selected.includes(o.id)).map((o) => o.name);
  const label =
    selectedNames.length === 0 ? placeholder : selectedNames.length <= 3 ? selectedNames.join(", ") : `${selectedNames.length} selected`;

  return (
  <div className="relative" ref={ref}>
    <button
      type="button"
      onClick={() => setOpen((s) => !s)}
      className="w-full text-left px-3 py-2 border rounded bg-white dark:bg-gray-800 flex items-center justify-between text-sm
                 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-100
                 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-indigo-500 transition-colors"
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <div className="truncate">{label}</div>
      <div className="ml-2 text-gray-400 dark:text-gray-300">▾</div>
    </button>

    {open && (
      <div
        className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-64 overflow-auto
                   ring-1 ring-black/5 dark:ring-white/5 transition-colors"
        role="dialog"
        aria-modal="false"
      >
        <div className="p-2">
          {search && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full px-2 py-1 border rounded mb-2 text-sm
                         bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700
                         text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-indigo-500 transition-colors"
              placeholder="Search..."
              aria-label="Search options"
            />
          )}

          {filteredOptions.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-2">No options</div>
          ) : (
            filteredOptions.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={() => toggleId(opt.id)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900
                             focus:ring-2 focus:ring-blue-400 dark:focus:ring-indigo-500 transition-colors"
                  aria-label={`Toggle ${opt.name}`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-100">{opt.name}</span>
              </label>
            ))
          )}
        </div>
      </div>
    )}
  </div>
);

}

/* ---------- ProductRow with Active Toggle (updated for clearer stock-age colors) ---------- */
function ProductRow({
  p,
  onEdit,
  onDelete,
  onToggleActive,
  busyToggleId,
  onOpenBatches,
  tagsById,
  latestBatchTsByProductId,
  isSelected,
  onToggleSelect,
}) {
  const isBusy = busyToggleId === p.id;
  const isActive = Boolean(p.active);

  const latestTs =
    latestBatchTsByProductId?.[Number(p.id)] ??
    (p.created_at ? Date.parse(p.created_at) : null);

  const monthsOld = (() => {
    if (!latestTs || !Number.isFinite(latestTs)) return null;
    const ms = Date.now() - latestTs;
    const months = ms / (1000 * 60 * 60 * 24 * 30);
    return months;
  })();

  const ageClasses = (() => {
  if (monthsOld == null) {
    return {
      bg: "bg-gray-50 dark:bg-gray-800",
      text: "text-gray-600 dark:text-gray-300",
      border: "border-gray-200 dark:border-gray-700",
      bar: "bg-gray-300 dark:bg-gray-500",
      label: "Unknown",
    };
  }
  if (monthsOld < 3) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-100 dark:border-emerald-800",
      bar: "bg-emerald-400 dark:bg-emerald-500",
      label: "<3m",
    };
  }
  if (monthsOld < 6) {
    return {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-100 dark:border-blue-800",
      bar: "bg-blue-400 dark:bg-blue-500",
      label: "<6m",
    };
  }
  if (monthsOld < 9) {
    return {
      bg: "bg-amber-50 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-100 dark:border-amber-800",
      bar: "bg-amber-400 dark:bg-amber-500",
      label: "<9m",
    };
  }
  if (monthsOld < 12) {
    return {
      bg: "bg-orange-50 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-300",
      border: "border-orange-100 dark:border-orange-800",
      bar: "bg-orange-400 dark:bg-orange-500",
      label: "<12m",
    };
  }
  return {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-100 dark:border-red-800",
    bar: "bg-red-400 dark:bg-red-500",
    label: "≥12m",
  };
})();


  const stockValue = p.stocklevel_quantity ?? p.stock_quantity ?? 0;

  const productTagIds = Array.isArray(p.tag_ids)
    ? p.tag_ids
    : Array.isArray(p.tags)
    ? p.tags.map((t) => (typeof t === "object" ? (t.id ?? t) : t))
    : [];

  const productTagNames = (productTagIds || []).map((id) => tagsById?.[id]).filter(Boolean);

  return (
  <tr className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
    <td className="px-4 py-4 whitespace-nowrap text-sm">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(p.id)}
        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600"
      />
    </td>
    <td className="px-4 py-4 align-top">
      <div className="flex items-center gap-2">
        <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border ${
            isActive
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
              : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{p.sku}</div>
      {productTagNames.length > 0 && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {productTagNames.slice(0, 3).map((name) => (
            <span
              key={name}
              className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
            >
              {name}
            </span>
          ))}
          {productTagNames.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">
              +{productTagNames.length - 3}
            </span>
          )}
        </div>
      )}
    </td>

    <td className="px-4 py-4 align-top text-sm text-gray-600 dark:text-gray-300">{p.category}</td>

    {/* Stock cell */}
    <td className="px-4 py-4 align-top text-sm">
      <div
        className={`inline-flex items-center gap-2 px-2 py-1 rounded border ${ageClasses.bg} ${ageClasses.border}`}
        title={
          monthsOld == null
            ? "Unknown stock age"
            : `${monthsOld.toFixed(1)} mo old • since ${
                latestTs ? new Date(latestTs).toLocaleDateString() : "-"
              }`
        }
      >
        <span className={`inline-block w-1 h-6 rounded mr-1 ${ageClasses.bar}`} />
        <span className={`text-[11px] font-semibold ${ageClasses.text}`}>{stockValue}</span>
        <span
          className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${ageClasses.bg} ${ageClasses.text} ${ageClasses.border}`}
        >
          {ageClasses.label}
        </span>
      </div>
    </td>

    <td className="px-4 py-4 align-top text-sm font-semibold text-gray-900 dark:text-gray-100">
      ₹{p.price}
    </td>

    <td className="px-4 py-4 align-top text-sm text-gray-600 dark:text-gray-300">{p.gst_rate}%</td>

    <td className="px-4 py-4 align-top text-right">
      <div className="inline-flex gap-2 items-center">
        <button
          onClick={() => onOpenBatches(p)}
          className="p-2 rounded-md border bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600"
          title="View batches"
          aria-label={`View batches for ${p.name}`}
        >
          <FiList className="text-gray-600 dark:text-gray-300" />
        </button>

        <button
          onClick={() => onEdit(p)}
          className="p-2 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-800/40"
          title="Edit"
          aria-label={`Edit ${p.name}`}
        >
          <FiEdit3 />
        </button>

        <button
          onClick={() => onDelete(p)}
          className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/40"
          title="Delete"
          aria-label={`Delete ${p.name}`}
        >
          <FiTrash2 />
        </button>
      </div>
    </td>
  </tr>
);

}

/* ---------- Main component (API switched to products-with-stock) ---------- */
export default function MasterAdminProducts() {
  const { token } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [stockMax, setStockMax] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name | category | price | gst_rate | stock
  const [sortDir, setSortDir] = useState("asc"); // asc | desc
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    weight: "",
    min_quantity: "",
    max_quantity: "",
    price: "",
    gst_rate: "",
    category_ids: [],
    tag_ids: [],
    description: "",
    file: null,
    initial_quantity: "",
    stocklevel_quantity: "",
    unit: "box",
    expire_date: "",
  });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Batch deletion state
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [busyToggleId, setBusyToggleId] = useState(null);

  const [batches, setBatches] = useState([]);
  const [batchesDrawer, setBatchesDrawer] = useState({ open: false, product: null, list: [], loading: false });

  const drawerFormRef = useRef(null);
  const tagsById = useMemo(() => {
    const map = {};
    (tags || []).forEach((t) => {
      if (t && (t.id != null)) map[t.id] = t.name || String(t.id);
    });
    return map;
  }, [tags]);
  const latestBatchTsByProductId = useMemo(() => {
    const map = {};
    (batches || []).forEach((b) => {
      const pid = Number(b.product_id);
      const ts = new Date(b.added_at || b.created_at || b.expire_date || 0).getTime();
      if (!Number.isFinite(ts)) return;
      if (!map[pid] || ts > map[pid]) map[pid] = ts;
    });
    return map;
  }, [batches]);

  // normalize helper: robustly extract ids from product for categories/tags
  function getProductIds(p, kind = "category") {
    // kind = "category" -> look for category_ids or categories
    if (!p) return [];
    const arr =
      kind === "category"
        ? p.category_ids ?? p.categories ?? []
        : p.tag_ids ?? p.tags ?? [];
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => {
      if (x == null) return x;
      if (typeof x === "object") return x.id ?? x.value ?? x._id ?? null;
      // For tags, if we have a string that's not a number, try to find the corresponding ID
      if (kind === "tag" && typeof x === "string" && !/^\d+$/.test(x)) {
        // Find the tag ID by name
        const tag = tags.find(t => t.name === x);
        return tag ? tag.id : null;
      }
      return x;
    }).filter((v) => v != null).map((v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v));
  }

  // generic apiRequest uses configured HOST + BASE
  async function apiRequest(path, { method = "GET", body = null, raw = false } = {}) {
    const headers = {};
    const localToken = token || getToken();
    if (localToken) headers["Authorization"] = `Bearer ${localToken}`;

    const isForm = typeof FormData !== "undefined" && body instanceof FormData;

    if (!isForm && !raw) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch(`${API_HOST}${API_BASE}${path}`, {
        method,
        headers,
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      const err = new Error("Network error");
      err.body = networkErr;
      throw err;
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const msg = data?.detail || data?.message || data || res.statusText || `Request failed: ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  /* ---------- load products ---------- */
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await apiRequest("/products-with-stock/products", { method: "GET" });
        if (!mounted) return;
        setProducts(Array.isArray(data) ? data.map((d) => ({ ...d, active: d.active ?? true })) : []);
      } catch (err) {
        console.error(err);
        toast(err.message || "Failed to load products", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [token]);

  /* ---------- load categories + tags ---------- */
  useEffect(() => {
    let mounted = true;
    async function loadMeta() {
      try {
        setMetaLoading(true);
        const cats = await apiRequest("/categories/", { method: "GET" });
        const tgs = await apiRequest("/tags/", { method: "GET" });
        if (!mounted) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setTags(Array.isArray(tgs) ? tgs : []);
      } catch (err) {
        console.error(err);
        toast(err.message || "Failed to load categories/tags", "error");
      } finally {
        if (mounted) setMetaLoading(false);
      }
    }
    loadMeta();
    return () => (mounted = false);
  }, [token]);

  /* ---------- load global batches ---------- */
  useEffect(() => {
    let mounted = true;
    async function loadBatches() {
      try {
        const res = await apiRequest("/products-with-stock/stock?only_active=true&limit=200", { method: "GET" });
        if (!mounted) return;
        setBatches(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("batches load err", err);
        setBatches([]);
      }
    }
    loadBatches();
    return () => (mounted = false);
  }, [token]);

  // Reset to first page when filters/sorts change
  useEffect(() => {
    setPage(1);
  }, [query, selectedCategoryIds, selectedTagIds, priceMin, priceMax, stockMin, stockMax, sortBy, sortDir]);

  // compute domains but clamp sensible values
  function getDomain(values, fallbackMax) {
    const nums = values.filter((v) => Number.isFinite(v));
    if (nums.length === 0) return { min: 0, max: fallbackMax };
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    // clamp negative mins to 0 for display (stock shouldn't be negative in UI)
    return { min: Math.max(0, Math.floor(min)), max: Math.max(Math.ceil(max), fallbackMax) };
  }

  const priceDomain = useMemo(() => {
    const values = products.map((p) => Number(p.price ?? 0)).filter((n) => !Number.isNaN(n));
    const { min, max } = getDomain(values, 1000);
    return { min, max };
  }, [products]);

  const stockDomain = useMemo(() => {
    const values = products.map((p) => Number(p.stocklevel_quantity ?? p.stock_quantity ?? 0)).filter((n) => !Number.isNaN(n));
    const { min, max } = getDomain(values, 100);
    return { min, max };
  }, [products]);

  // FILTERING: use robust id extraction
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      // search
      if (q) {
        const hit =
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q));
        if (!hit) return false;
      }

      // category chips (normalized)
      if (selectedCategoryIds.length > 0) {
        const catIds = getProductIds(p, "category");
        const intersects = catIds.some((id) => selectedCategoryIds.includes(id));
        if (!intersects) return false;
      }

      // tag chips
      if (selectedTagIds.length > 0) {
        const tagIds = getProductIds(p, "tag");
        const intersects = tagIds.some((id) => selectedTagIds.includes(id));
        if (!intersects) return false;
      }

      // price range
      const priceNum = Number(p.price ?? 0);
      if (priceMin !== "" && priceNum < Number(priceMin)) return false;
      if (priceMax !== "" && priceNum > Number(priceMax)) return false;

      // stock range
      const stockNum = Number(p.stocklevel_quantity ?? p.stock_quantity ?? 0);
      if (stockMin !== "" && stockNum < Number(stockMin)) return false;
      if (stockMax !== "" && stockNum > Number(stockMax)) return false;

      return true;
    });
  }, [products, query, selectedCategoryIds, selectedTagIds, priceMin, priceMax, stockMin, stockMax]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va;
      let vb;
      if (sortBy === "name") {
        va = (a.name || "").toLowerCase();
        vb = (b.name || "").toLowerCase();
      } else if (sortBy === "category") {
        va = (a.category || "").toLowerCase();
        vb = (b.category || "").toLowerCase();
      } else if (sortBy === "price") {
        va = Number(a.price ?? 0);
        vb = Number(b.price ?? 0);
      } else if (sortBy === "gst_rate") {
        va = Number(a.gst_rate ?? 0);
        vb = Number(b.gst_rate ?? 0);
      } else if (sortBy === "stock") {
        va = Number(a.stocklevel_quantity ?? a.stock_quantity ?? 0);
        vb = Number(b.stocklevel_quantity ?? b.stock_quantity ?? 0);
      } else {
        va = 0;
        vb = 0;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function toggleCategoryFilter(id) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleTagFilter(id) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearAllFilters() {
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setPriceMin("");
    setPriceMax("");
    setStockMin("");
    setStockMax("");
    setQuery("");
  }

  function openAdd() {
    setEditing(null);
    setForm({
      sku: "",
      name: "",
      weight: "",
      min_quantity: "",
      max_quantity: "",
      price: "",
      gst_rate: "",
      category_ids: [],
      tag_ids: [],
      description: "",
      file: null,
      initial_quantity: "",
      stocklevel_quantity: "",
      unit: "box",
      expire_date: "",
    });
    setPreviewUrl(null);
    setShowDrawer(true);
    setTimeout(() => drawerFormRef.current?.focus?.(), 50);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      sku: p.sku ?? "",
      name: p.name ?? "",
      weight: p.weight ? String(p.weight) : "",
      min_quantity: p.min_quantity ? String(p.min_quantity) : "",
      max_quantity: p.max_quantity ? String(p.max_quantity) : "",
      price: p.price ? String(p.price) : "",
      gst_rate: p.gst_rate ? String(p.gst_rate) : "",
      category_ids: Array.isArray(p.category_ids) ? p.category_ids : getProductIds(p, "category"),
      tag_ids: Array.isArray(p.tag_ids) ? p.tag_ids : getProductIds(p, "tag"),
      description: p.description ?? "",
      file: null,
      initial_quantity: "",
      stocklevel_quantity: p.stocklevel_quantity ?? p.stock_quantity ?? "",
      unit: p.unit ?? "box",
      expire_date: "",
    });
    setPreviewUrl(p.image_url ? (p.image_url.startsWith("http") ? p.image_url : `${API_HOST}${p.image_url}`) : null);
    setShowDrawer(true);
    setTimeout(() => drawerFormRef.current?.focus?.(), 50);
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setForm((s) => ({ ...s, file: f }));
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  /* ---------- Save (create or update) ---------- */
  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.sku.trim()) {
      toast("Name and Product ID are required", "error");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("sku", form.sku);
      fd.append("name", form.name);
      if (form.weight !== "") fd.append("weight", form.weight);
      if (form.min_quantity !== "") fd.append("min_quantity", form.min_quantity);
      if (form.max_quantity !== "") fd.append("max_quantity", form.max_quantity);
      if (form.price !== "") fd.append("price", form.price);
      if (form.gst_rate !== "") fd.append("gst_rate", form.gst_rate);
      fd.append("description", form.description || "");
      if (form.category_ids && form.category_ids.length) fd.append("category_ids", JSON.stringify(form.category_ids));
      if (form.tag_ids && form.tag_ids.length) fd.append("tag_ids", JSON.stringify(form.tag_ids));
      if (form.file) fd.append("file", form.file);

      if (!editing) {
        if (form.initial_quantity !== "") fd.append("initial_quantity", form.initial_quantity);
        fd.append("unit", form.unit || "box");
        if (form.expire_date) {
          const exp = String(form.expire_date);
          const expStr = exp.includes("T") ? exp : `${exp}T00:00:00`;
          fd.append("expire_date", expStr);
        }
        const response = await apiRequest("/products-with-stock/create", { method: "POST", body: fd });
        setProducts((prev) => [response, ...prev]);
        toast("Product created", "success");
      } else {
        if (form.stocklevel_quantity !== "") fd.append("stocklevel_quantity", form.stocklevel_quantity);
        const response = await apiRequest(`/products-with-stock/products/${editing.id}`, { method: "PATCH", body: fd });
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? response : p)));
        toast("Product updated", "success");
      }

      setShowDrawer(false);
      setPreviewUrl(null);

      try {
        const res = await apiRequest("/products-with-stock/stock?only_active=true&limit=200", { method: "GET" });
        setBatches(Array.isArray(res) ? res : []);
      } catch {}
    } catch (err) {
      console.error("save err", err);
      const msg = err.body?.detail || err.body?.message || err.message || "Request failed";
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Delete (hard) ---------- */
  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/products-with-stock/products/${deleteTarget.id}?hard=true`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast("Product deleted", "success");
      setDeleteTarget(null);
    } catch (err) {
      console.error("delete err", err);
      toast(err.body?.detail || err.message || "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  /* ---------- Toggle active ---------- */
  async function handleToggleActive(p) {
    if (!p?.id) return;
    setBusyToggleId(p.id);
    try {
      const action = p.active ? "deactivate" : "activate";
      const res = await apiRequest(`/products-with-stock/products/${p.id}/${action}`, { method: "POST" });

      const newActive =
        typeof res.active === "boolean"
          ? res.active
          : (res.status === "activated" || res.status === "deactivated") ? (res.status === "activated") : !p.active;

      setProducts((prev) => prev.map((it) => (it.id === p.id ? { ...it, active: newActive } : it)));
      toast(newActive ? "Product activated" : "Product deactivated", "success");
    } catch (err) {
      console.error("toggle active err", err);
      toast(err.body?.detail || err.message || "Failed to change state", "error");
    } finally {
      setBusyToggleId(null);
    }
  }

  /* ---------- Batch Selection Functions ---------- */
  const toggleSelectOne = (productId) => {
    setSelectedProductIds((prevSelected) =>
      prevSelected.includes(productId)
        ? prevSelected.filter((id) => id !== productId) // Deselect
        : [...prevSelected, productId] // Select
    );
  };

  const toggleSelectAll = () => {
    const allCurrentIds = paginated.map((p) => p.id);
    const allSelected = selectedProductIds.length === allCurrentIds.length && allCurrentIds.length > 0;

    setSelectedProductIds((prevSelected) =>
      allSelected
        ? [] // Deselect all if all are currently selected
        : allCurrentIds // Select all if not all are selected
    );
  };

  /* ---------- Batch Delete ---------- */
  async function handleBatchDelete() {
    if (selectedProductIds.length === 0) return;

    if (window.confirm(`Are you sure you want to delete ${selectedProductIds.length} products? This action cannot be undone.`)) {
      setBatchDeleting(true);
      try {
        // Delete each product sequentially to avoid overwhelming the server
        for (const productId of selectedProductIds) {
          await apiRequest(`/products-with-stock/products/${productId}?hard=true`, { method: "DELETE" });
        }
        
        // Update the products state to remove deleted products
        setProducts((prev) => prev.filter((p) => !selectedProductIds.includes(p.id)));
        
        // Clear selection
        setSelectedProductIds([]);
        
        toast(`${selectedProductIds.length} products deleted successfully`, "success");
      } catch (err) {
        console.error("batch delete err", err);
        toast(err.body?.detail || err.message || "Failed to delete products", "error");
      } finally {
        setBatchDeleting(false);
      }
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /* ---------- Batches drawer actions ---------- */
  function openBatchesDrawer(product) {
    const list = batches.filter((b) => Number(b.product_id) === Number(product.id));
    setBatchesDrawer({ open: true, product, list, loading: false });
  }

  function closeBatchesDrawer() {
    setBatchesDrawer({ open: false, product: null, list: [], loading: false });
  }

  async function createBatchForProduct(payload) {
    try {
      const res = await apiRequest("/products-with-stock/stock/batches", { method: "POST", body: payload });
      setBatchesDrawer((s) => ({ ...s, list: [...s.list, res] }));
      setBatches((prev) => [...prev, res]);
      toast("Batch created", "success");
    } catch (err) {
      console.error("create batch err", err);
      toast(err.body?.detail || err.message || "Failed to create batch", "error");
    }
  }

  async function patchBatch(batchId, body) {
    try {
      const res = await apiRequest(`/products-with-stock/stock/batches/${batchId}`, { method: "PATCH", body });
      setBatchesDrawer((s) => ({ ...s, list: s.list.map((b) => (b.id === res.id ? res : b)) }));
      setBatches((prev) => prev.map((b) => (b.id === res.id ? res : b)));
      toast("Batch updated", "success");
    } catch (err) {
      console.error("patch batch err", err);
      toast(err.body?.detail || err.message || "Failed to update batch", "error");
    }
  }

  async function deactivateBatch(batchId) {
    if (!window.confirm("Deactivate this batch?")) return;
    await patchBatch(batchId, { active: false });
  }

  // small memoized callbacks for passing to rows
  const openEditCb = useCallback((p) => openEdit(p), []);
  const openBatchesCb = useCallback((p) => openBatchesDrawer(p), [batches]);
  const onDeleteCb = useCallback((prod) => setDeleteTarget(prod), []);

  return (
  <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
    <AdminSidebar />

    <div className="flex-1 p-6 md:p-8">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
            <FiBox className="text-indigo-600 dark:text-indigo-300 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Products</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your product inventory and catalog</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, sku or category"
              className="w-72 pl-4 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <div className="absolute right-3 top-2 text-gray-400 dark:text-gray-400">
              <FiSearch />
            </div>
          </div>

          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <FiPlus />
            <span>Add product</span>
          </button>

          <button
            onClick={async () => {
              try {
                setLoading(true);
                const [prods, bts] = await Promise.all([
                  apiRequest("/products-with-stock/products", { method: "GET" }),
                  apiRequest("/products-with-stock/stock?only_active=true&limit=200", { method: "GET" }),
                ]);
                setProducts(Array.isArray(prods) ? prods : []);
                setBatches(Array.isArray(bts) ? bts : []);
                toast("Refreshed", "success");
              } catch (err) {
                toast(err?.message || "Refresh failed", "error");
              } finally {
                setLoading(false);
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </div>

      {/* Inline filters */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 transition-colors">
        <div className="flex flex-col gap-3">
          {/* Legend for stock age colors */}
          <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 flex-wrap">
            <span className="text-gray-500 dark:text-gray-400">Stock age:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-400 border border-emerald-300" /> &lt;3m
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-400 border border-blue-300" /> &lt;6m
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 border border-amber-300" /> &lt;9m
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-400 border border-orange-300" /> &lt;12m
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-400 border border-red-300" /> ≥12m
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-300">{filtered.length} matching products</div>
            {/* <button onClick={clearAllFilters} className="text-xs px-3 py-1.5 rounded border">Clear filters</button> */}
          </div>
        </div>
      </div>

      {/* table card */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        {/* Batch delete button */}
        {selectedProductIds.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {selectedProductIds.length} product{selectedProductIds.length !== 1 ? 's' : ''} selected
            </div>
            <button
              onClick={handleBatchDelete}
              disabled={batchDeleting}
              className={`px-3 py-1.5 text-sm rounded-md text-white transition-colors ${
                batchDeleting 
                  ? 'bg-red-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {batchDeleting ? 'Deleting...' : `Delete (${selectedProductIds.length})`}
            </button>
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
          <thead className="bg-white dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">
                <input
                  type="checkbox"
                  // This checkbox is checked if the number of selected items equals the number of items on the current page
                  checked={paginated.length > 0 && selectedProductIds.length === paginated.length}
                  // This is true if some, but not all, items on the page are selected
                  ref={el => {
                    if (el) {
                      el.indeterminate = selectedProductIds.length > 0 && selectedProductIds.length < paginated.length;
                    }
                  }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600"
                />
              </th>
              <th
                onClick={() => toggleSort("name")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 cursor-pointer select-none"
              >
                Product {sortBy === "name" && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </th>
              <th
                onClick={() => toggleSort("category")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 cursor-pointer select-none"
              >
                Category {sortBy === "category" && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </th>
              <th
                onClick={() => toggleSort("stock")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 cursor-pointer select-none"
              >
                Stock {sortBy === "stock" && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </th>
              <th
                onClick={() => toggleSort("price")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 cursor-pointer select-none"
              >
                Price {sortBy === "price" && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </th>
              <th
                onClick={() => toggleSort("gst_rate")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 cursor-pointer select-none"
              >
                GST {sortBy === "gst_rate" && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300">Actions</th>
            </tr>
          </thead>

          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800">
                  <td className="px-4 py-6">
                    <div className="h-14 w-14 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-48 animate-pulse" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32 mt-2 animate-pulse" />
                  </td>
                  <td className="px-4 py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  </td>
                  <td className="px-4 py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  </td>
                  <td className="px-4 py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  </td>
                  <td className="px-4 py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  </td>
                  <td className="px-4 py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-16 animate-pulse" />
                  </td>
                  <td className="px-4 py-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" />
                  </td>
                  <td className="px-4 py-6 text-right">
                    <div className="flex gap-2 justify-end">
                      <div className="h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  </td>
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No products found.
                </td>
              </tr>
            ) : (
              paginated.map((p) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  onEdit={openEditCb}
                  onDelete={onDeleteCb}
                  onToggleActive={handleToggleActive}
                  busyToggleId={busyToggleId}
                  onOpenBatches={openBatchesCb}
                  tagsById={tagsById}
                  latestBatchTsByProductId={latestBatchTsByProductId}
                  isSelected={selectedProductIds.includes(p.id)}
                  onToggleSelect={toggleSelectOne}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Page {currentPage} of {totalPages} • {totalItems} items</div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 text-sm rounded border disabled:opacity-50 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              >
                Prev
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 text-sm rounded border disabled:opacity-50 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer: add/edit */}
      {showDrawer && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => { setShowDrawer(false); setPreviewUrl(null); }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-gray-800 shadow-xl border-l border-gray-100 dark:border-gray-700 flex flex-col transition-colors">
            <form onSubmit={handleSave} className="flex flex-col h-full" role="dialog" aria-modal="true">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing ? "Edit product" : "Add product"}</h3>
                <button type="button" onClick={() => { setShowDrawer(false); setPreviewUrl(null); }} className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Close drawer">
                  <FiX className="text-gray-700 dark:text-gray-200" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300">Product ID</label>
                    <input
                      ref={drawerFormRef}
                      value={form.sku}
                      onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                      placeholder="Product ID"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300">Name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                      placeholder="Product name"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Price (₹)</label>
                      <input
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                        type="number"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">GST Rate (%)</label>
                      <input
                        value={form.gst_rate}
                        onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                        type="number"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Weight (g)</label>
                      <input
                        value={form.weight}
                        onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                        type="number"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Image</label>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 w-full text-sm text-gray-700 dark:text-gray-200" required={!editing} />
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="w-40 h-28 rounded overflow-hidden border border-gray-100 dark:border-gray-700">
                      <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">Categories</label>
                      <MultiSelectDropdown
                        options={categories}
                        selected={form.category_ids}
                        onChange={(arr) => setForm((f) => ({ ...f, category_ids: arr }))}
                        placeholder="Choose categories"
                      />
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{form.category_ids.length === 0 ? "No categories selected" : `${form.category_ids.length} selected`}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">Tags</label>
                      <MultiSelectDropdown
                        options={tags}
                        selected={form.tag_ids}
                        onChange={(arr) => setForm((f) => ({ ...f, tag_ids: arr }))}
                        placeholder="Choose tags"
                      />
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{form.tag_ids.length === 0 ? "No tags selected" : `${form.tag_ids.length} selected`}</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                      rows="3"
                      required
                    />
                  </div>

                  {!editing ? (
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Initial quantity</label>
                      <input
                        value={form.initial_quantity}
                        onChange={(e) => setForm((f) => ({ ...f, initial_quantity: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                        type="number"
                      />
                      <div className="text-xs text-gray-500 dark:text-gray-400">This will create initial batch for product when created.</div>

                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">Unit: <span className="font-medium">box</span></div>
                      <div className="mt-3">
                        <label className="text-sm text-gray-600 dark:text-gray-300">Expire date</label>
                        <input
                          value={form.expire_date}
                          onChange={(e) => setForm((f) => ({ ...f, expire_date: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                          type="date"
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400">Will be sent as YYYY-MM-DDT00:00:00</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-300">Stock-level quantity</label>
                      <input
                        value={form.stocklevel_quantity}
                        onChange={(e) => setForm((f) => ({ ...f, stocklevel_quantity: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                        type="number"
                      />
                      <div className="text-xs text-gray-500 dark:text-gray-400">Adjust product's stock level on save (server will handle diff).</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t bg-white dark:bg-gray-800 px-5 py-3 flex items-center justify-end gap-3 border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => { setShowDrawer(false); setPreviewUrl(null); }} className="px-4 py-2 rounded-md border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100" disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60" disabled={saving}>
                  {saving ? (editing ? "Saving..." : "Creating...") : editing ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-sm p-6 z-10 transition-colors">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete product</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <span className="font-medium text-gray-900 dark:text-gray-100">{deleteTarget.name}</span>?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-md border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100" disabled={deleting}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirmed} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60" disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batches Drawer */}
      {batchesDrawer.open && batchesDrawer.product && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={closeBatchesDrawer} />
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-gray-800 shadow-xl border-l border-gray-100 dark:border-gray-700 flex flex-col transition-colors">
            <div className="px-5 py-4 border-b flex items-center justify-between border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Batches — {batchesDrawer.product.name}</h3>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Product ID: {batchesDrawer.product.id} • Current stock: {batchesDrawer.product.stocklevel_quantity ?? batchesDrawer.product.stock_quantity ?? 0}
                </div>
              </div>
              <button type="button" onClick={closeBatchesDrawer} className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Close batches drawer">
                <FiX className="text-gray-700 dark:text-gray-200" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div className="border rounded p-3 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Active batches</div>
                </div>

                <div className="space-y-3 max-h-64 overflow-auto">
                  {batchesDrawer.list.length === 0 ? (
                    <div className="text-xs text-gray-400 dark:text-gray-400">No active batches.</div>
                  ) : (
                    batchesDrawer.list.map((b) => {
                      const daysLeft = b.expire_date ? daysBetween(b.expire_date) : null;
                      const cls = expiryClassesForDays(daysLeft);

                      return (
<div
    key={b.id}
    className={`flex items-start justify-between gap-3 p-2 rounded ${cls.bg} border ${cls.neutral ? "border-gray-100 dark:border-gray-700" : cls.border}`}
  >                          <div className="flex items-start gap-3">
                            <div className={`w-1.5 h-12 rounded ${cls.bar} mt-1`} />

                            <div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Qty: {b.quantity} {b.unit || ""}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Expiry: {b.expire_date ? formatIN(b.expire_date) : "-"}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Added: {b.added_at ? formatIN(b.added_at) : "-"}</div>
                              {b.notes && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Notes: {b.notes}</div>}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className={`text-sm font-semibold ${cls.text}`}>
                              {daysLeft == null ? "-" : daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="border rounded p-3 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700">
                <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Add More Stock</div>
                <CreateBatchForm product={batchesDrawer.product} onCreate={(payload) => createBatchForProduct(payload)} />
              </div>
            </div>

            <div className="border-t bg-white dark:bg-gray-800 px-5 py-3 flex items-center justify-end border-gray-100 dark:border-gray-700">
              <button onClick={closeBatchesDrawer} className="px-4 py-2 rounded border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

}

/* ---------- CreateBatchForm component ---------- */
function CreateBatchForm({ product, onCreate }) {
  const [batchNo, setBatchNo] = useState(() => `init-${product?.id || "x"}-${Math.random().toString(36).slice(2, 8)}`);
  const [quantity, setQuantity] = useState("");
  const [unit] = useState("box");
  const [expireDate, setExpireDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e) {
    e?.preventDefault();
    if (!product || !product.id) {
      toast("No product selected", "error");
      return;
    }
    if (quantity === "" || Number.isNaN(Number(quantity))) {
      toast("Enter valid quantity", "error");
      return;
    }
    const payload = {
      product_id: product.id,
      batch_no: batchNo,
      quantity: Number(quantity),
      unit: unit,
      expire_date: expireDate ? new Date(expireDate).toISOString() : null,
      notes: notes || "",
    };
    try {
      setBusy(true);
      await onCreate(payload);
      setBatchNo(`init-${product.id}-${Math.random().toString(36).slice(2, 8)}`);
      setQuantity("");
      setExpireDate("");
      setNotes("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2">
      <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="px-3 py-2 border rounded" placeholder="Quantity" type="number" />
      <input value={unit} disabled className="px-3 py-2 border rounded bg-gray-50 text-gray-600" placeholder="Unit" />
      <input value={expireDate} onChange={(e) => setExpireDate(e.target.value)} className="px-3 py-2 border rounded" placeholder="Expiry date" type="date" />
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={busy} className="px-3 py-1 rounded bg-indigo-600 text-white">{busy ? "Creating..." : "Create"}</button>
      </div>
    </form>
  );
}

/* ---------- RangeSliders component (price & stock) ---------- */
function RangeSliders({
  priceDomain,
  stockDomain,
  priceMin,
  priceMax,
  stockMin,
  stockMax,
  setPriceMin,
  setPriceMax,
  setStockMin,
  setStockMax,
}) {
  const [pMin, setPMin] = useState(priceMin === "" ? priceDomain.min : Number(priceMin));
  const [pMax, setPMax] = useState(priceMax === "" ? priceDomain.max : Number(priceMax));
  const [sMin, setSMin] = useState(stockMin === "" ? stockDomain.min : Number(stockMin));
  const [sMax, setSMax] = useState(stockMax === "" ? stockDomain.max : Number(stockMax));

  useEffect(() => {
    setPMin(priceMin === "" ? priceDomain.min : Number(priceMin));
  }, [priceMin, priceDomain.min]);
  useEffect(() => {
    setPMax(priceMax === "" ? priceDomain.max : Number(priceMax));
  }, [priceMax, priceDomain.max]);
  useEffect(() => {
    setSMin(stockMin === "" ? stockDomain.min : Number(stockMin));
  }, [stockMin, stockDomain.min]);
  useEffect(() => {
    setSMax(stockMax === "" ? stockDomain.max : Number(stockMax));
  }, [stockMax, stockDomain.max]);

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  return (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Price Filter */}
    <div className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 transition-colors">
      <div className="flex items-center justify-between mb-2 text-xs text-gray-600 dark:text-gray-300">
        <span>Price</span>
        <span>
          ₹{pMin} - ₹{pMax}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={priceDomain.min}
          max={priceDomain.max}
          value={pMin}
          onChange={(e) => setPMin(clamp(Number(e.target.value), priceDomain.min, pMax))}
          className="w-full"
        />
        <input
          type="range"
          min={priceDomain.min}
          max={priceDomain.max}
          value={pMax}
          onChange={(e) => setPMax(clamp(Number(e.target.value), pMin, priceDomain.max))}
          className="w-full"
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          onClick={() => {
            setPMin(priceDomain.min);
            setPMax(priceDomain.max);
            setPriceMin("");
            setPriceMax("");
          }}
        >
          Reset
        </button>
        <button
          className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
          onClick={() => {
            setPriceMin(String(pMin));
            setPriceMax(String(pMax));
          }}
        >
          Apply
        </button>
      </div>
    </div>

    {/* Stock Filter */}
    <div className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 transition-colors">
      <div className="flex items-center justify-between mb-2 text-xs text-gray-600 dark:text-gray-300">
        <span>Stock</span>
        <span>
          {sMin} - {sMax}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={stockDomain.min}
          max={stockDomain.max}
          value={sMin}
          onChange={(e) => setSMin(clamp(Number(e.target.value), stockDomain.min, sMax))}
          className="w-full"
        />
        <input
          type="range"
          min={stockDomain.min}
          max={stockDomain.max}
          value={sMax}
          onChange={(e) => setSMax(clamp(Number(e.target.value), sMin, stockDomain.max))}
          className="w-full"
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          onClick={() => {
            setSMin(stockDomain.min);
            setSMax(stockDomain.max);
            setStockMin("");
            setStockMax("");
          }}
        >
          Reset
        </button>
        <button
          className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
          onClick={() => {
            setStockMin(String(sMin));
            setStockMax(String(sMax));
          }}
        >
          Apply
        </button>
      </div>
    </div>
  </div>
);

}
