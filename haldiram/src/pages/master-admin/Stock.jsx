// src/pages/master-admin/Stock.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";
import { FiBox, FiRefreshCw, FiCheckCircle, FiRepeat } from "react-icons/fi";

const API_UPLOADS = "https://be.haldiram.globalinfosofts.com";

function fmtNumber(v) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString();
}

export default function MasterAdminStock() {
  const toast = useToast();
  const mounted = useRef(true);

  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // product_id -> status response
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [stockModal, setStockModal] = useState({
    open: false,
    product: null,
    mode: "adjust",
    qty: 0,
  });
  const [stockBusy, setStockBusy] = useState(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    async function loadAll() {
      setLoading(true);
      try {
        // 1) products
        const prods = await authFetch("/products/", {
          method: "GET",
          signal: controller.signal,
        });
        if (!mounted.current) return;
        const allProducts = Array.isArray(prods) ? prods : [];
        setProducts(allProducts);

        // 2) stocks
        try {
          const st = await authFetch("/stock/", {
            method: "GET",
            signal: controller.signal,
          });
          if (!mounted.current) return;
          setStocks(Array.isArray(st) ? st : []);
        } catch (err) {
          console.warn("stock fetch failed", err);
          if (mounted.current) setStocks([]);
        }

        // 3) per-product status (uses your endpoint /stock/product/{id}/status)
        // fetch in parallel but resiliently using Promise.allSettled
        try {
          const ids = allProducts.map((p) => p.id);
          const calls = ids.map((id) =>
            authFetch(`/stock/product/${id}/status`, {
              method: "GET",
              signal: controller.signal,
            }).then(
              (res) => ({ id, ok: true, res }),
              (err) => ({ id, ok: false, err })
            )
          );
          const settled = await Promise.all(calls);
          if (!mounted.current) return;
          const map = {};
          for (const s of settled) {
            if (s && s.ok && s.res) {
              // s.res is the API response for that product, e.g.
              // { product_id, sku, product_name, quantity, min_quantity, max_quantity, status, note }
              map[s.id] = s.res;
            } else {
              // leave undefined or set fallback
              map[s.id] = undefined;
            }
          }
          setStatusMap(map);
        } catch (err) {
          console.warn("per-product status fetch failed", err);
          if (mounted.current) setStatusMap({});
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("loadAll error", err);
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

  // stock map
  const stockMap = useMemo(() => {
    const m = {};
    for (const s of stocks) {
      m[s.product_id] = s.quantity;
    }
    return m;
  }, [stocks]);

  const totals = useMemo(() => {
    const count = products.length;
    const totalStock = products.reduce((s, p) => s + (Number(stockMap[p.id]) || 0), 0);
    return { count, totalStock };
  }, [products, stockMap]);

  const statusCounts = useMemo(() => {
    let under = 0, over = 0;
    for (const pid of Object.keys(statusMap)) {
      const st = statusMap[pid];
      if (!st) continue;
      if (String(st.status).toUpperCase() === "UNDER") under++;
      else if (String(st.status).toUpperCase() === "OVER") over++;
    }
    const ok = Math.max(0, products.length - (under + over));
    return { under, over, ok };
  }, [statusMap, products]);

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
      const res = await authFetch("/stock/adjust", { method: "POST", body: JSON.stringify(payload) });
      toast(res?.status === "adjusted" ? `Adjusted — new qty ${res.quantity}` : "Adjusted", "success");
      setRefreshKey((k) => k + 1);
      closeStockModal();
    } catch (err) {
      console.error("adjust err", err);
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
      const res = await authFetch("/stock/correct", { method: "POST", body: JSON.stringify(payload) });
      toast(res?.status === "corrected" ? `Corrected: from ${res.from} → ${res.to}` : "Corrected", "success");
      setRefreshKey((k) => k + 1);
      closeStockModal();
    } catch (err) {
      console.error("correct err", err);
      toast(err?.message || "Failed to correct stock", "error");
    } finally {
      setStockBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <MasterAdminSidebar />

      <main className="flex-1 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-3 rounded-lg">
              <FiBox className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage stock quantities (Adjust / Correct)</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 text-right">
              <div>Products: <span className="font-medium text-gray-900">{totals.count}</span></div>
              <div>Total stock: <span className="font-medium text-gray-900">{fmtNumber(totals.totalStock)}</span></div>
            </div>

            <div className="text-sm text-gray-600 flex gap-2">
              <div className="px-2 py-1 rounded bg-red-50 text-red-700 text-xs">Under: {statusCounts.under}</div>
              <div className="px-2 py-1 rounded bg-green-50 text-green-700 text-xs">OK: {statusCounts.ok}</div>
              <div className="px-2 py-1 rounded bg-yellow-50 text-yellow-800 text-xs">Over: {statusCounts.over}</div>
            </div>

            <button onClick={() => setRefreshKey(k => k + 1)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm hover:bg-gray-50">
              <FiRefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-md bg-gray-50 animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Price</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Min / Max</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {products.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">No products.</td></tr>
                  ) : (
                    products.map(p => {
                      const qty = Number(stockMap[p.id] || 0);
                      const st = statusMap[p.id]; // may be undefined
                      // prefer API fields when available
                      const min = st?.min_quantity ?? p?.min_stock ?? p?.reorder_min ?? null;
                      const max = st?.max_quantity ?? p?.max_stock ?? p?.reorder_max ?? null;
                      const statusLabel = st?.status ? String(st.status).toUpperCase() : "OK";
                      const delta = st?.delta ?? null;
                      const note = st?.note ?? null;

                      let pillClass = "bg-green-50 text-green-700";
                      if (statusLabel === "UNDER") pillClass = "bg-red-50 text-red-700";
                      else if (statusLabel === "OVER") pillClass = "bg-yellow-50 text-yellow-800";

                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-md bg-gray-100 overflow-hidden flex items-center justify-center border">
                                {p.image_url ? <img src={`${API_UPLOADS}${p.image_url}`} alt={p.name} className="h-full w-full object-cover" /> : <div className="text-xs text-gray-400">No image</div>}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.sku || `#${p.id}`}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600">{p.category || "-"}</td>
                          <td className="px-4 py-4 text-sm text-gray-900">₹{fmtNumber(p.price)}</td>
                          <td className="px-4 py-4 text-center text-sm text-gray-700">{fmtNumber(qty)}</td>

                          <td className="px-4 py-4 text-center text-sm text-gray-600">
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
                            {delta != null && <div className="text-xs text-gray-400 mt-1">Δ {fmtNumber(delta)}</div>}
                            {note && <div className="text-xs text-gray-400 mt-1">{note}</div>}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button onClick={() => openStockModal(p, "adjust")} className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-yellow-50 text-yellow-800 text-sm hover:bg-yellow-100"><FiRepeat className="w-4 h-4" /></button>
                              <button onClick={() => openStockModal(p, "correct")} className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-green-50 text-green-700 text-sm hover:bg-green-100"><FiCheckCircle className="w-4 h-4" /></button>
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

      {/* Modal */}
      {stockModal.open && stockModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeStockModal} />
          <form onSubmit={stockModal.mode === "adjust" ? doAdjust : doCorrect} className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{stockModal.mode === "adjust" ? "Adjust stock" : "Correct stock"}</h3>
                <div className="text-xs text-gray-500 mt-1">{stockModal.product.name} • SKU: {stockModal.product.sku || `#${stockModal.product.id}`}</div>
              </div>
              <button type="button" onClick={closeStockModal} className="text-gray-500">Close</button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-sm text-gray-700">
                {stockModal.mode === "adjust" ? "Quantity to add/remove (use negative to reduce)" : "Set quantity to (absolute)"}
              </label>
              <input type="number" value={stockModal.qty} onChange={(e) => setStockModal(s => ({ ...s, qty: e.target.value }))} className="w-full px-3 py-2 rounded border" />
              <div className="text-xs text-gray-500">Current quantity: <span className="font-medium">{fmtNumber(stockMap[stockModal.product.id])}</span></div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeStockModal} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" disabled={stockBusy} className="px-4 py-2 rounded bg-green-600 text-white">
                {stockBusy ? (stockModal.mode === "adjust" ? "Adjusting..." : "Correcting...") : (stockModal.mode === "adjust" ? "Adjust" : "Correct")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
