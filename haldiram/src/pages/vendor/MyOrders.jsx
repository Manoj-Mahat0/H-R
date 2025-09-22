// src/pages/vendor/MyOrders.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import VendorSidebar from "../../components/VendorSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";

const API_UPLOADS = "https://be.haldiram.globalinfosofts.com";

function StatusBadge({ status }) {
  const map = {
    placed: "bg-indigo-50 text-indigo-700",
    pending_payment: "bg-yellow-50 text-yellow-800",
    paid: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${
        map[status] || "bg-gray-50 text-gray-700"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d || "-";
  }
}

export default function VendorMyOrders() {
  const toast = useToast();
  const mounted = useRef(true);

  const [orders, setOrders] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [statusModal, setStatusModal] = useState({ open: false, data: null });
  const [busy, setBusy] = useState({}); // { orderId: { regen, check } }


  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    async function fetchProducts() {
      try {
        const cached = sessionStorage.getItem("products_cache_v1");
        if (cached) {
          setProductsMap(
            JSON.parse(cached).reduce((m, p) => ((m[p.id] = p), m), {})
          );
          return;
        }
        const data = await authFetch("/products/", {
          method: "GET",
          signal: controller.signal,
        });
        if (!mounted.current) return;
        const map = (Array.isArray(data) ? data : []).reduce(
          (m, p) => ((m[p.id] = p), m),
          {}
        );
        setProductsMap(map);
        try {
          sessionStorage.setItem(
            "products_cache_v1",
            JSON.stringify(Array.isArray(data) ? data : [])
          );
        } catch {}
      } catch (err) {
        if (err.name !== "AbortError") console.error("products fetch", err);
      }
    }

    async function fetchOrders() {
      setLoading(true);
      try {
        const data = await authFetch("/vendor/orders/me", {
          method: "GET",
          signal: controller.signal,
        });
        if (!mounted.current) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("orders fetch", err);
          toast(err?.message || "Failed to load orders", "error");
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    }

    fetchProducts();
    fetchOrders();

    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [refreshKey, toast]);

  // Auto check payment status for pending_payment orders
  useEffect(() => {
    async function autoCheckPaymentStatus() {
      const pendingOrders = orders.filter((o) => o.status === "pending_payment");
      for (const o of pendingOrders) {
        try {
          const res = await authFetch(`/vendor/orders/${o.id}/payment-status`, { method: "GET" });
          if (res?.updated_status && res.updated_status !== o.status) {
            setRefreshKey((k) => k + 1);
            toast(`Order #${o.id} payment status updated: ${res.updated_status}`, "success");
          }
        } catch (err) {
          // ignore errors for auto check
        }
      }
    }
    if (orders && orders.length > 0) {
      autoCheckPaymentStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const totals = useMemo(() => {
    const count = orders.length;
    const amount = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    return { count, amount };
  }, [orders]);

  function setBusyFor(id, kind, val) {
    setBusy((b) => ({ ...(b || {}), [id]: { ...(b[id] || {}), [kind]: val } }));
  }

  async function handleRegenerate(orderId) {
    try {
      setBusyFor(orderId, "regen", true);
      const res = await authFetch(`/vendor/orders/${orderId}/regenerate-payment`, {
        method: "POST",
        body: "",
      });
      toast("Payment link created", "success");
      if (res?.redirectUrl) {
        window.open(res.redirectUrl, "_blank", "noopener,noreferrer");
      } else {
        setStatusModal({ open: true, data: res });
      }
    } catch (err) {
      console.error("regenerate", err);
      toast(err?.message || "Failed to regenerate payment", "error");
    } finally {
      setBusyFor(orderId, "regen", false);
    }
  }

  async function handleCheckStatus(orderId) {
    try {
      setBusyFor(orderId, "check", true);
      const res = await authFetch(`/vendor/orders/${orderId}/payment-status`, {
        method: "GET",
      });
      setStatusModal({ open: true, data: res });
      if (res?.updated_status) {
        setRefreshKey((k) => k + 1);
        toast(`Order status: ${res.updated_status}`, "success");
      }
    } catch (err) {
      console.error("check status", err);
      toast(err?.message || "Failed to check payment status", "error");
    } finally {
      setBusyFor(orderId, "check", false);
    }
  }

  function prodName(id) {
    const p = productsMap?.[id];
    return p ? `${p.name}` : `#${id}`;
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <VendorSidebar />

      <main className="flex-1 p-6 md:p-10">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage orders you placed as vendor
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">Orders</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals.count}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total amount</div>
              <div className="text-lg font-semibold text-gray-900">
                ₹{totals.amount}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="px-4 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="p-6 rounded-lg bg-white border text-center text-gray-500">
              Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="p-6 rounded-lg bg-white border text-center text-gray-500">
              No orders yet.
            </div>
          ) : (
            orders.map((o) => (
              <article
                key={o.id}
                className="bg-white border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
                      #{o.id}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Order #{o.id}
                        </h3>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Created: {fmtDate(o.created_at)} · Expected:{" "}
                        {fmtDate(o.expected_date)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-700">
                    <div>
                      Total: <span className="font-semibold">₹{o.total}</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {Array.isArray(o.items) && o.items.length > 0 ? (
                        o.items.map((it) => (
                          <li
                            key={it.id || `${o.id}-${it.product_id}`}
                            className="text-sm text-gray-600"
                          >
                            <span className="font-medium">
                              {prodName(it.product_id)}
                            </span>{" "}
                            — Qty: {it.qty}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500">No items</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const w = window.open("", "_blank", "noopener,noreferrer");
                      w.document.write(`<pre>${JSON.stringify(o, null, 2)}</pre>`);
                    }}
                    className="px-3 py-2 rounded-md bg-white border text-sm hover:bg-gray-50"
                  >
                    View
                  </button>

                  {o.status === "pending_payment" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRegenerate(o.id)}
                        disabled={busy[o.id]?.regen}
                        className="px-3 py-2 rounded-md bg-yellow-600 text-white text-sm hover:bg-yellow-700 disabled:opacity-60"
                      >
                        {busy[o.id]?.regen ? "Processing…" : "Pay"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCheckStatus(o.id)}
                        disabled={busy[o.id]?.check}
                        className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {busy[o.id]?.check ? "Checking…" : "Check status"}
                      </button>
                    </>
                  )}

                  {o.status === "placed" && (
                    <div className="px-3 py-2 rounded-md bg-gray-50 text-sm text-gray-600 text-center">
                      Placed
                    </div>
                  )}
                  {o.status === "paid" && (
                    <div className="px-3 py-2 rounded-md bg-green-50 text-sm text-green-700 text-center">
                      Paid
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {statusModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setStatusModal({ open: false, data: null })}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Payment status — PO #{statusModal.data?.po_id}
                </h3>
                <div className="text-sm text-gray-500 mt-1">
                  Gateway: {statusModal.data?.merchantOrderId || "-"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={
                    statusModal.data?.updated_status ||
                    (statusModal.data?.gateway_state
                      ? statusModal.data.gateway_state.toLowerCase()
                      : "unknown")
                  }
                />
                <button
                  type="button"
                  onClick={() => setStatusModal({ open: false, data: null })}
                  className="text-sm text-gray-500"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="text-sm text-gray-600">
                <div>
                  <strong>Gateway state:</strong>{" "}
                  {statusModal.data?.gateway_state || "-"}
                </div>
                <div className="mt-2">
                  <strong>Updated status:</strong>{" "}
                  {statusModal.data?.updated_status || "-"}
                </div>
              </div>

              <details className="bg-gray-50 p-3 rounded text-xs text-gray-700">
                <summary className="cursor-pointer font-medium">
                  Raw gateway payload (click to expand)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto text-xs">
                  {JSON.stringify(statusModal.data?.gateway_raw || {}, null, 2)}
                </pre>
              </details>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusModal({ open: false, data: null })}
                className="px-3 py-2 rounded-md border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
