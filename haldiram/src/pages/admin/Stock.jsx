// src/pages/master-admin/Stock.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";
import {
  FiBox,
  FiRefreshCw,
  FiCheckCircle,
  FiRepeat,
  FiSearch,
  FiX,
  FiPlus,
  FiTrash2,
  FiList,
} from "react-icons/fi";

import { API_HOST } from '../../lib/config.js';

const API_UPLOADS = API_HOST;

function fmtNumber(v) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString();
}

/** helper to normalise tags from product record (supports p.tags array or p.tag string) */
function normaliseTags(p) {
  if (!p) return [];
  if (Array.isArray(p.tags)) return p.tags.filter(Boolean).map(String);
  if (typeof p.tag === "string" && p.tag.trim()) {
    // common case single string with commas
    return p.tag.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (typeof p.tags === "string" && p.tags.trim()) {
    return p.tags.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (typeof p.tags_string === "string" && p.tags_string.trim()) {
    return p.tags_string.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// generate slug-like short from product name
function slugifyName(name) {
  if (!name) return "prod";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20); // keep it short
}

// current date as YYYYMMDD
function yyyymmdd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// random 4 char alphanumeric suffix
function randSuffix(len = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function AdminStock() {
  const toast = useToast();
  const mounted = useRef(true);

  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]); // active batch records
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [stockModal, setStockModal] = useState({
    open: false,
    product: null,
    mode: "adjust",
    qty: 0,
  });
  const [stockBusy, setStockBusy] = useState(false);

  // Batches modal for a specific product
  const [batchesModal, setBatchesModal] = useState({
    open: false,
    product: null,
    list: [],
    loading: false,
  });

  // create batch form state
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [newBatch, setNewBatch] = useState({
    batch_no: "",
    quantity: "",
    unit: "pcs",
    expire_date: "",
    notes: "ok",
  });

  // Search state
  const [search, setSearch] = useState("");

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    async function loadAll() {
      setLoading(true);
      try {
        const prods = await authFetch("/products/", {
          method: "GET",
          signal: controller.signal,
        });
        if (!mounted.current) return;
        const allProducts = Array.isArray(prods) ? prods : [];
        setProducts(allProducts);

        // fetch all active batches (you can optionally pass only_active=true)
        try {
          const st = await authFetch("/stock/?only_active=true", {
            method: "GET",
            signal: controller.signal,
          });
          if (!mounted.current) return;
          setBatches(Array.isArray(st) ? st : []);
        } catch (err) {
          // fallback to empty batches
          if (mounted.current) setBatches([]);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          toast(err?.message || "Failed to load products", "error");
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    }

    loadAll();

    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [refreshKey, toast]);

  // stockMap now derived from batches by summing quantities per product
  const stockMap = useMemo(() => {
    const m = {};
    for (const b of batches) {
      const pid = b.product_id;
      const q = Number(b.quantity) || 0;
      if (!m[pid]) m[pid] = 0;
      m[pid] += q;
    }
    return m;
  }, [batches]);

  const totals = useMemo(() => {
    const count = products.length;
    const totalStock = products.reduce(
      (s, p) => s + (Number(stockMap[p.id]) || 0),
      0
    );
    return { count, totalStock };
  }, [products, stockMap]);

  // Simple status calculation using product min/max fields if available
  const statusCounts = useMemo(() => {
    let under = 0,
      over = 0;
    for (const p of products) {
      const qty = Number(stockMap[p.id] || 0);
      const min = p?.min_quantity ?? p?.min_stock ?? p?.reorder_min ?? null;
      const max = p?.max_quantity ?? p?.max_stock ?? p?.reorder_max ?? null;
      if (min != null && qty < Number(min)) under++;
      else if (max != null && qty > Number(max)) over++;
    }
    const ok = Math.max(0, products.length - (under + over));
    return { under, over, ok };
  }, [products, stockMap]);

  // filtered products (by search). now includes tags in the search string (TAGS)
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const tagsArr = normaliseTags(p);
      const tagsStr = tagsArr.join(" ").toLowerCase();
      return (
        name.includes(q) || sku.includes(q) || cat.includes(q) || tagsStr.includes(q)
      );
    });
  }, [products, search]);

  function openStockModal(product, mode = "adjust") {
    setStockModal({ open: true, product, mode, qty: 0 });
  }
  function closeStockModal() {
    setStockModal({ open: false, product: null, mode: "adjust", qty: 0 });
  }

  async function doAdjust(e) {
    e?.preventDefault();
    if (!stockModal.product) return;
    const payload = {
      product_id: stockModal.product.id,
      qty: Number(stockModal.qty),
      reason: "Adjusted via UI",
      received_date: new Date().toISOString(),
      expiry_date: new Date().toISOString(),
    };
    try {
      setStockBusy(true);
      const res = await authFetch("/stock/adjust", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast(
        res?.status === "adjusted"
          ? `Adjusted — new qty ${res.quantity}`
          : "Adjusted",
        "success"
      );
      setRefreshKey((k) => k + 1);
      closeStockModal();
    } catch (err) {
      toast(err?.message || "Failed to adjust stock", "error");
    } finally {
      setStockBusy(false);
    }
  }

  async function doCorrect(e) {
    e?.preventDefault();
    if (!stockModal.product) return;
    const payload = {
      product_id: stockModal.product.id,
      quantity: Number(stockModal.qty),
      reason: "Corrected via UI",
      received_date: new Date().toISOString(),
      expiry_date: new Date().toISOString(),
    };
    try {
      setStockBusy(true);
      const res = await authFetch("/stock/correct", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast(
        res?.status === "corrected"
          ? `Corrected: from ${res.from} → ${res.to}`
          : "Corrected",
        "success"
      );
      setRefreshKey((k) => k + 1);
      closeStockModal();
    } catch (err) {
      toast(err?.message || "Failed to correct stock", "error");
    } finally {
      setStockBusy(false);
    }
  }

  // helper to generate a batch_no given product
  function generateBatchNoForProduct(product) {
    const namePart = slugifyName(product?.name || `prod${product?.id || ""}`);
    const datePart = yyyymmdd(new Date());
    const suffix = randSuffix(4);
    return `${namePart}-${datePart}-${suffix}`;
  }

  // Batches modal actions (NO AUTO-CREATE)
  async function openBatchesModal(product) {
    setBatchesModal((s) => ({ ...s, open: true, product, loading: true, list: [] }));

    try {
      // fetch batches for this product (only_active true)
      const res = await authFetch(`/stock/?product_id=${product.id}&only_active=true`, {
        method: "GET",
      });
      const list = Array.isArray(res) ? res : [];

      // set newBatch defaults (hide notes, disable unit by default)
      const defaultBatchNo = generateBatchNoForProduct(product);
      setNewBatch({
        batch_no: defaultBatchNo,
        quantity: "",
        unit: "pcs",
        expire_date: "",
        notes: "ok", // default hidden note value
      });

      // IMPORTANT: do NOT auto-create here. just show fetched list (even if empty).
      setBatchesModal({ open: true, product, loading: false, list });
    } catch (err) {
      toast(err?.message || "Failed to load batches", "error");
      setBatchesModal({ open: true, product, loading: false, list: [] });
    }
  }

  function closeBatchesModal() {
    setBatchesModal({ open: false, product: null, loading: false, list: [] });
    // reset new batch form
    setNewBatch({ batch_no: "", quantity: "", unit: "pcs", expire_date: "", notes: "ok" });
  }

  async function createBatchForProduct(e) {
    e?.preventDefault();
    if (!batchesModal.product) return;

    // compute or ensure a batch_no
    const batchNo = newBatch.batch_no && String(newBatch.batch_no).trim() ? String(newBatch.batch_no).trim() : generateBatchNoForProduct(batchesModal.product);

    // fetch current list to make sure batch_no won't clash with an active batch
    const existingResp = await authFetch(`/stock/?product_id=${batchesModal.product.id}&only_active=true`, { method: "GET" });
    const existingList = Array.isArray(existingResp) ? existingResp : [];
    const clash = existingList.find((b) => (b.batch_no || "").toLowerCase() === batchNo.toLowerCase());
    if (clash) {
      toast("A batch with the generated batch_no already exists for this product. Generating a new suffix.", "warning");
      // regenerate batchNo with a new suffix and set it (but continue; user can re-submit)
      const newBatchNo = `${slugifyName(batchesModal.product.name)}-${yyyymmdd()}-${randSuffix(4)}`;
      setNewBatch((s) => ({ ...s, batch_no: newBatchNo }));
      return;
    }

    const payload = {
      product_id: batchesModal.product.id,
      batch_no: batchNo,
      quantity: Number(newBatch.quantity || 0),
      unit: "pcs", // unit fixed to pcs
      expire_date: newBatch.expire_date ? new Date(newBatch.expire_date).toISOString() : new Date().toISOString(),
      notes: "ok", // note hidden + default ok
    };

    // minimal validation
    if (!payload.quantity && payload.quantity !== 0) {
      toast("Enter a valid quantity (0 or more).", "error");
      return;
    }

    try {
      setCreatingBatch(true);
      const res = await authFetch("/stock/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast("Batch created", "success");
      // refresh global batches and modal list
      setRefreshKey((k) => k + 1);
      setBatchesModal((s) => ({ ...s, list: [...s.list, res] }));
      setNewBatch({ batch_no: generateBatchNoForProduct(batchesModal.product), quantity: "", unit: "pcs", expire_date: "", notes: "ok" });
    } catch (err) {
      toast(err?.message || "Failed to create batch", "error");
    } finally {
      setCreatingBatch(false);
    }
  }

  async function deactivateBatch(batchId) {
    if (!window.confirm("Deactivate this batch?")) return;
    try {
      await authFetch(`/stock/${batchId}`, {
        method: "DELETE",
      });
      toast("Batch deactivated", "success");
      // refresh global batches and modal list
      setRefreshKey((k) => k + 1);
      setBatchesModal((s) => ({ ...s, list: s.list.filter((b) => b.id !== batchId) }));
    } catch (err) {
      toast(err?.message || "Failed to deactivate batch", "error");
    }
  }

  // Keep a background effect to update global batches when refreshKey changes
  useEffect(() => {
    let cancelled = false;
    async function refreshBatches() {
      try {
        const res = await authFetch("/stock/?only_active=true", { method: "GET" });
        if (!cancelled) setBatches(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setBatches([]);
      }
    }
    refreshBatches();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

 return (
  <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
    <AdminSidebar />

    <main className="flex-1 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
            <FiBox className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Stock management
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Manage stock quantities (Adjust / Correct) and batches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, category or tag..."
              className="pl-9 pr-8 py-2 w-64 rounded-lg border bg-white dark:bg-gray-800 text-sm placeholder-gray-400 dark:placeholder-gray-500 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400"
              aria-label="Search products"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Clear search"
                type="button"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-sm text-gray-500 text-right dark:text-gray-300">
            <div>
              Products: <span className="font-medium text-gray-900 dark:text-gray-100">{totals.count}</span>
            </div>
            <div>
              Total stock: <span className="font-medium text-gray-900 dark:text-gray-100">{fmtNumber(totals.totalStock)}</span>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-300 flex gap-2">
            <div className="px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs">Under: {statusCounts.under}</div>
            <div className="px-2 py-1 rounded bg-green-50 dark:bg-emerald-900/10 text-green-700 dark:text-emerald-300 text-xs">OK: {statusCounts.ok}</div>
            <div className="px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-300 text-xs">Over: {statusCounts.over}</div>
          </div>

          <button onClick={() => setRefreshKey((k) => k + 1)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            <FiRefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-200" /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-md bg-gray-50 dark:bg-gray-700 animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-white dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Price</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300">Stock</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300">Min / Max</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300">Actions</th>
                </tr>
              </thead>

              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No products found.</td></tr>
                ) : (
                  filteredProducts.map(p => {
                    const qty = Number(stockMap[p.id] || 0);

                    const min = p?.min_quantity ?? p?.min_stock ?? p?.reorder_min ?? null;
                    const max = p?.max_quantity ?? p?.max_stock ?? p?.reorder_max ?? null;
                    let statusLabel = "OK";
                    if (min != null && qty < Number(min)) statusLabel = "UNDER";
                    else if (max != null && qty > Number(max)) statusLabel = "OVER";

                    const tags = normaliseTags(p); // TAGS array

                    let pillClass = "bg-green-50 text-green-700 dark:bg-emerald-900/10 dark:text-emerald-300";
                    if (statusLabel === "UNDER") pillClass = "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300";
                    else if (statusLabel === "OVER") pillClass = "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/10 dark:text-yellow-300";

                    // make initials placeholder from name (since images removed)
                    const initials = (p.name || "").trim().slice(0, 1).toUpperCase() || "-";

                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {/* placeholder instead of image */}
                            <div className="h-12 w-12 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center border dark:border-gray-600 text-gray-600 dark:text-gray-200 font-medium">
                              {initials}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{p.sku || `#${p.id}`}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{p.category || "-"}</td>

                        {/* TAGS column - show small badges if tags exist */}
                        <td className="px-4 py-4">
                          {tags.length === 0 ? <div className="text-xs text-gray-400 dark:text-gray-500">-</div> : (
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 6).map((t, i) => (
                                <div key={i} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-gray-700 dark:text-gray-200">
                                  {t}
                                </div>
                              ))}
                              {tags.length > 6 && <div className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-gray-500 dark:text-gray-400">+{tags.length - 6}</div>}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">₹{fmtNumber(p.price)}</td>
                        <td className="px-4 py-4 text-center text-sm text-gray-700 dark:text-gray-200">{fmtNumber(qty)}</td>

                        <td className="px-4 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                          {min == null && max == null ? "-" : (
                            <div className="text-xs">
                              <div>Min: {min == null ? "-" : fmtNumber(min)}</div>
                              <div>Max: {max == null ? "-" : fmtNumber(max)}</div>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${pillClass}`}>
                            <span className="capitalize">{statusLabel}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button onClick={() => openBatchesModal(p)} title="View batches" className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                              <FiList className="w-4 h-4 text-gray-700 dark:text-gray-200" /> Batches
                            </button>
                            <button onClick={() => openStockModal(p, "adjust")} className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-300 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-800/20">
                              <FiRepeat className="w-4 h-4" />
                            </button>
                            <button onClick={() => openStockModal(p, "correct")} className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-green-50 dark:bg-emerald-900/10 text-green-700 dark:text-emerald-300 text-sm hover:bg-green-100 dark:hover:bg-emerald-800/20">
                              <FiCheckCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>

    {/* Adjust/Correct Modal */}
    {stockModal.open && stockModal.product && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/30" onClick={closeStockModal} />
        <form onSubmit={stockModal.mode === "adjust" ? doAdjust : doCorrect} className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 z-10 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stockModal.mode === "adjust" ? "Adjust stock" : "Correct stock"}</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stockModal.product.name} • SKU: {stockModal.product.sku || `#${stockModal.product.id}`}</div>
            </div>
            <button type="button" onClick={closeStockModal} className="text-gray-500 dark:text-gray-300">Close</button>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              {stockModal.mode === "adjust" ? "Quantity to add/remove (use negative to reduce)" : "Set quantity to (absolute)"}
            </label>
            <input type="number" value={stockModal.qty} onChange={(e) => setStockModal(s => ({ ...s, qty: e.target.value }))} className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100" />
            <div className="text-xs text-gray-500 dark:text-gray-400">Current quantity: <span className="font-medium">{fmtNumber(stockMap[stockModal.product.id])}</span></div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={closeStockModal} className="px-4 py-2 rounded border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">Cancel</button>
            <button type="submit" disabled={stockBusy} className="px-4 py-2 rounded bg-green-600 text-white">
              {stockBusy ? (stockModal.mode === "adjust" ? "Adjusting..." : "Correcting...") : (stockModal.mode === "adjust" ? "Adjust" : "Correct")}
            </button>
          </div>
        </form>
      </div>
    )}

    {/* Batches Modal */}
    {batchesModal.open && batchesModal.product && (
      <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16">
        <div className="absolute inset-0 bg-black/30" onClick={closeBatchesModal} />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 z-10 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Batches — {batchesModal.product.name}</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Product ID: {batchesModal.product.id} • Current stock: {fmtNumber(stockMap[batchesModal.product.id])}</div>
            </div>
            <button type="button" onClick={closeBatchesModal} className="text-gray-500 dark:text-gray-300">Close</button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* create batch */}
            <form onSubmit={createBatchForProduct} className="space-y-3 border rounded p-3 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Create new batch</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">POST /api/stock/</div>
              </div>

              <input
                type="text"
                placeholder="Batch no (auto-generated)"
                value={newBatch.batch_no}
                onChange={(e) => setNewBatch((s) => ({ ...s, batch_no: e.target.value }))}
                className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              />

              <input
                type="number"
                placeholder="Quantity"
                value={newBatch.quantity}
                onChange={(e) => setNewBatch((s) => ({ ...s, quantity: e.target.value }))}
                className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              />

              {/* unit is fixed to pcs and disabled */}
              <input
                type="text"
                placeholder="Unit"
                value={"pcs"}
                disabled
                className="w-full px-3 py-2 rounded border bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
              />

              <input
                type="date"
                placeholder="Expiry date"
                value={newBatch.expire_date}
                onChange={(e) => setNewBatch((s) => ({ ...s, expire_date: e.target.value }))}
                className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              />

              <div className="text-xs text-gray-400 dark:text-gray-500">Notes are hidden and default to "ok".</div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewBatch({ batch_no: generateBatchNoForProduct(batchesModal.product), quantity: "", unit: "pcs", expire_date: "", notes: "ok" })} className="px-3 py-1 rounded border text-sm bg-white dark:bg-gray-900">Reset</button>
                <button type="submit" disabled={creatingBatch} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">
                  {creatingBatch ? "Creating..." : <><FiPlus className="inline mr-2" /> Create</>}
                </button>
              </div>
            </form>

            {/* batches list */}
            <div className="border rounded p-3 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Active batches</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">GET /api/stock/?product_id=..&only_active=true</div>
              </div>

              {batchesModal.loading ? (
                <div className="space-y-2">
                  <div className="h-6 bg-gray-50 dark:bg-gray-700 animate-pulse rounded" />
                  <div className="h-6 bg-gray-50 dark:bg-gray-700 animate-pulse rounded" />
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-auto">
                  {batchesModal.list.length === 0 ? (
                    <div className="text-xs text-gray-400 dark:text-gray-500">No active batches.</div>
                  ) : (
                    batchesModal.list.map((b) => (
                      <div key={b.id} className="flex items-start justify-between gap-3 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          <div className="font-medium">{b.batch_no || `#${b.id}`}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">Qty: {fmtNumber(b.quantity)} {b.unit || ""}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{b.expire_date ? new Date(b.expire_date).toLocaleDateString() : "-"}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-gray-400 dark:text-gray-500">Added: {b.added_at ? new Date(b.added_at).toLocaleString() : "-"}</div>
                          <button onClick={() => deactivateBatch(b.id)} className="inline-flex items-center gap-2 px-2 py-1 rounded border text-sm hover:bg-red-50 dark:hover:bg-red-800/20">
                            <FiTrash2 className="w-4 h-4 text-red-600" /> Deactivate
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={closeBatchesModal} className="px-4 py-2 rounded border bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">Done</button>
          </div>
        </div>
      </div>
    )}
  </div>
);



}
