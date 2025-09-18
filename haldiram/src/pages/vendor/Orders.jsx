// src/pages/vendor/Orders.jsx
import React, { useEffect, useMemo, useState } from "react";
import VendorSidebar from "../../components/VendorSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";

/**
 * Vendor Orders page — async-safe, no page reloads.
 *
 * - All network actions use async/await.
 * - Buttons that shouldn't submit have type="button".
 * - No <form> wrapper that can cause submit/reload.
 */

const API_UPLOADS = "https://be.haldiram.globalinfosoft.co";

export default function VendorOrders() {
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [cartMap, setCartMap] = useState({});
  const [placing, setPlacing] = useState(false);
  const [expectedDate, setExpectedDate] = useState(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 3);
    return dt.toISOString().slice(0, 16);
  });

  // load products (async)
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoadingProducts(true);
        const data = await authFetch("/products/", { method: "GET" });
        if (!mounted) return;
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("fetch products err", err);
        const msg = err?.message || (err?.body ? JSON.stringify(err.body) : "Failed to load products");
        toast(msg, "error");
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const okQ = !q || (p.name || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q);
      const okC = !categoryFilter || (p.category || "").toLowerCase().includes(categoryFilter.toLowerCase());
      return okQ && okC;
    });
  }, [products, query, categoryFilter]);

  // cart helpers (synchronous — no reload)
  function addToCart(product, qty = 1) {
    setCartMap((m) => {
      const existing = m[product.id];
      const nextQty = existing ? existing.qty + qty : qty;
      return { ...m, [product.id]: { product, qty: nextQty } };
    });
    toast(`${product.name} added to cart`, "success");
  }

  function updateQty(productId, qty) {
    setCartMap((m) => {
      if (!m[productId]) return m;
      if (qty <= 0) {
        const copy = { ...m };
        delete copy[productId];
        return copy;
      }
      return { ...m, [productId]: { ...m[productId], qty } };
    });
  }

  function removeFromCart(productId) {
    setCartMap((m) => {
      const copy = { ...m };
      const name = copy[productId]?.product?.name;
      delete copy[productId];
      if (name) toast(`${name} removed`, "info");
      return copy;
    });
  }

  const cartItems = useMemo(() => Object.values(cartMap), [cartMap]);
  const total = useMemo(
    () => cartItems.reduce((s, it) => s + (Number(it.product.price) || 0) * Number(it.qty || 0), 0),
    [cartItems]
  );

  // place order (async) — stringify payload because auth.js expects string for JSON bodies
  async function placeOrder() {
    if (cartItems.length === 0) {
      toast("Cart is empty", "error");
      return;
    }

    const items = cartItems.map((it) => ({ product_id: it.product.id, qty: Number(it.qty) }));
    let expIso;
    try {
      const dt = new Date(expectedDate);
      expIso = dt.toISOString();
    } catch {
      toast("Invalid expected date", "error");
      return;
    }

    const payload = { items, expected_date: expIso };

    try {
      setPlacing(true);
      // IMPORTANT: auth.js expects a JSON string (or FormData). We pass a string.
      const res = await authFetch("/vendor/orders", { method: "POST", body: JSON.stringify(payload) });
      toast("Order placed successfully", "success");
      setCartMap({});
      if (res?.id) toast(`Order #${res.id} created`, "success");
    } catch (err) {
      console.error("place order err", err);
      let friendly = "Failed to place order";
      if (err) {
        if (typeof err.message === "string" && err.message.trim()) friendly = err.message;
        else if (err.body) {
          try {
            const d = err.body.detail;
            if (Array.isArray(d)) friendly = d.map((x) => x.msg || JSON.stringify(x)).join("; ");
            else if (typeof err.body === "string") friendly = err.body;
            else friendly = JSON.stringify(err.body);
          } catch {
            friendly = String(err);
          }
        } else {
          friendly = String(err);
        }
      }
      toast(friendly, "error");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <VendorSidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Vendor Order</h1>
            <p className="text-sm text-gray-600 mt-1">Select products and quantities to place an order.</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by name or SKU"
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="">All categories</option>
              {[...new Set(products.flatMap((p) => (p.category || "").split(",").map((c) => c.trim()).filter(Boolean)))].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* product list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loadingProducts ? (
                  <div className="col-span-full text-center py-8">Loading products…</div>
                ) : filtered.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-sm text-gray-500">No products found.</div>
                ) : (
                  filtered.map((p) => (
                    <div key={p.id} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                      <div className="h-36 w-full bg-gray-100 flex items-center justify-center overflow-hidden">
                        {p.image_url ? (
                          <img src={`${API_UPLOADS}${p.image_url}`} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-sm text-gray-400">No image</div>
                        )}
                      </div>

                      <div className="p-3">
                        <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.sku} • {p.category}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-lg font-bold">₹{p.price}</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              defaultValue={1}
                              id={`qty-${p.id}`}
                              className="w-16 px-2 py-1 rounded border border-gray-200 text-sm"
                            />
                            {/* ensure type="button" to avoid implicit submit */}
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`qty-${p.id}`);
                                const qty = el ? Number(el.value) || 1 : 1;
                                addToCart(p, qty);
                              }}
                              className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* cart panel */}
          <div>
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Cart</div>
                  <div className="text-xs text-gray-500">{cartItems.length} items</div>
                </div>
                <div className="text-lg font-bold">₹{total}</div>
              </div>

              <div className="mt-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No items in cart.</div>
                ) : (
                  cartItems.map((it) => (
                    <div key={it.product.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded overflow-hidden bg-gray-100">
                          {it.product.image_url ? (
                            <img src={`${API_UPLOADS}${it.product.image_url}`} alt={it.product.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{it.product.name}</div>
                          <div className="text-xs text-gray-500">₹{it.product.price} • {it.product.sku}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={it.qty}
                          onChange={(e) => updateQty(it.product.id, Number(e.target.value) || 1)}
                          className="w-16 px-2 py-1 rounded border border-gray-200 text-sm"
                        />
                        <button type="button" onClick={() => removeFromCart(it.product.id)} className="text-xs text-red-600">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4">
                <label className="block text-xs text-gray-600">Expected date</label>
                <input
                  type="datetime-local"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded border border-gray-200 text-sm"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={placing || cartItems.length === 0}
                  className="flex-1 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {placing ? "Placing..." : "Place order"}
                </button>
                <button type="button" onClick={() => setCartMap({})} className="px-3 py-2 rounded-md bg-white border">Clear</button>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              <p><strong>Tip:</strong> use the Qty input next to a product before adding.</p>
              <p className="mt-2">Images served from backend at <code className="text-xs bg-gray-100 px-1 rounded">https://be.haldiram.globalinfosoft.co/uploads/...</code></p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
