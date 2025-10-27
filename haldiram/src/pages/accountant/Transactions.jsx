// src/pages/accountant/Transactions.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import AccountantSidebar from "../../components/AccountantSidebar";
import { getToken } from "../../lib/auth"; // read token directly (we call the exact URL)
import { useToast } from "../../components/Toast";
import { FiRefreshCw, FiSearch, FiDownload, FiEye } from "react-icons/fi";
import { API_URL } from '../../lib/config.js';

/**
 * Transactions page — ONLY uses:
 * GET ${API_URL}/purchase-orders/admin/pending/verify?limit=100
 *
 * No other API calls are made.
 */

const API_ENDPOINT = `${API_URL}/purchase-orders/admin/pending/verify?limit=100`;

function fmtDate(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")].concat(
    rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] == null ? "" : String(r[h]);
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountantTransactions() {
  const toast = useToast();
  const mounted = useRef(true);

  const [orders, setOrders] = useState([]); // list from the endpoint (results array)
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // UI
  const [query, setQuery] = useState("");
  const [selectedPo, setSelectedPo] = useState(null);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const token = getToken();
        if (!token) throw new Error("No auth token found (please login).");

        const res = await fetch(API_ENDPOINT, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          let msg = `Request failed: ${res.status}`;
          try {
            const parsed = txt ? JSON.parse(txt) : null;
            msg = parsed?.detail || parsed?.message || msg;
          } catch {}
          throw new Error(msg);
        }

        const data = await res.json();
        // response shape: { count, results: [ { ... } ] }
        const arr = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        if (!mounted.current) return;
        setOrders(arr);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed load pending verify", err);
          toast(err?.message || "Failed to load purchase orders", "error");
          setOrders([]);
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    }

    load();
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [refreshKey, toast]);

  // derive display list (search by id, vendor_id, product_id)
  const displayList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((po) => {
      if (String(po.id).includes(q)) return true;
      if (String(po.vendor_id ?? "").toLowerCase().includes(q)) return true;
      if (po.items && Array.isArray(po.items)) {
        for (const it of po.items) {
          if (String(it.product_id).includes(q)) return true;
          if (String(it.qty).includes(q)) return true;
        }
      }
      if (String(po.status ?? "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [orders, query]);

  function exportCSV() {
    if (!displayList || displayList.length === 0) {
      toast("Nothing to export", "error");
      return;
    }
    // Flatten PO -> rows with product entries
    const rows = [];
    for (const po of displayList) {
      if (!po.items || po.items.length === 0) {
        rows.push({
          po_id: po.id,
          vendor_id: po.vendor_id,
          status: po.status,
          total: po.total,
          item_product_id: "",
          item_qty: "",
          created_at: po.created_at,
          expected_date: po.expected_date,
        });
      } else {
        for (const it of po.items) {
          rows.push({
            po_id: po.id,
            vendor_id: po.vendor_id,
            status: po.status,
            total: po.total,
            item_product_id: it.product_id,
            item_qty: it.qty,
            created_at: po.created_at,
            expected_date: po.expected_date,
          });
        }
      }
    }
    downloadCSV(`pending_verify_pos_${new Date().toISOString()}.csv`, rows);
    toast("CSV downloaded", "success");
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AccountantSidebar />

      <main className="flex-1 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Pending Purchase Orders — Verify</h1>
            <p className="text-sm text-gray-600 mt-1">Data loaded from the single endpoint: <code>{API_ENDPOINT}</code></p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search PO id, vendor, product id, status..."
                className="pl-10 pr-4 py-2 rounded-lg border bg-white"
              />
            </div>

            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-gray-50"
            >
              <FiRefreshCw className="w-4 h-4" /> Refresh
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-gray-50"
            >
              <FiDownload className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-md bg-gray-50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">PO ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {displayList.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">No pending POs to verify.</td>
                    </tr>
                  ) : (
                    displayList.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">#{po.id}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{po.vendor_id}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            po.status === "pending_payment" ? "bg-yellow-100 text-yellow-800" : "bg-gray-50 text-gray-700"
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">₹{po.total ?? "-"}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{fmtDate(po.created_at)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {po.items && po.items.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {po.items.map((it) => (
                                <div key={it.id ?? `${po.id}-${it.product_id}`} className="text-xs px-2 py-1 rounded bg-gray-50 border">
                                  {it.product_id}:{it.qty}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No items</span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => { setSelectedPo(po); }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm"
                            title="View details (local payload only)"
                          >
                            <FiEye className="w-4 h-4" /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Note: This page only calls the single endpoint shown above. No other API calls are performed.
        </div>
      </main>

      {/* Details modal — uses only the payload we already have (no extra API calls) */}
      {selectedPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedPo(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 z-10 overflow-auto max-h-[90vh]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">PO #{selectedPo.id}</h3>
                <div className="text-xs text-gray-500">Vendor: {selectedPo.vendor_id}</div>
              </div>
              <button onClick={() => setSelectedPo(null)} className="text-gray-500">Close</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><strong>Status:</strong> {selectedPo.status}</div>
              <div><strong>Total:</strong> ₹{selectedPo.total ?? "-"}</div>
              <div><strong>Created:</strong> {fmtDate(selectedPo.created_at)}</div>
              <div><strong>Expected:</strong> {fmtDate(selectedPo.expected_date)}</div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Items</h4>
              {Array.isArray(selectedPo.items) && selectedPo.items.length > 0 ? (
                <div className="space-y-2">
                  {selectedPo.items.map((it) => (
                    <div key={it.id ?? `${selectedPo.id}-${it.product_id}`} className="p-3 rounded border bg-gray-50 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">Product ID: {it.product_id}</div>
                        <div className="text-xs text-gray-500">Qty: {it.qty}</div>
                      </div>
                      <div className="text-xs text-gray-500">Item id: {it.id ?? "-"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No items available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
