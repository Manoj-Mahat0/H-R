// src/pages/vendor/Orders.jsx
import React, { useEffect, useMemo, useState } from "react";
import VendorSidebar from "../../components/VendorSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";

const API_UPLOADS = "http://127.0.0.1:8000";

function fmtINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

export default function VendorOrders() {
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [cartMap, setCartMap] = useState({});
  const [placing, setPlacing] = useState(false);
  const [addingMap, setAddingMap] = useState({});

  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");

  // debounce search for better UX
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // load products
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
        const msg = err && err.message ? err.message : "Failed to load products";
        toast(msg, "error");
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [toast]);

  const categories = useMemo(
    () =>
      [...new Set(products.flatMap((p) => (p.category || "").split(",").map((c) => c.trim()).filter(Boolean)))],
    [products]
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const okQ = !debouncedQuery || (p.name || "").toLowerCase().includes(debouncedQuery) || (p.sku || "").toLowerCase().includes(debouncedQuery);
      const okC = !categoryFilter || (p.category || "").toLowerCase().includes(categoryFilter.toLowerCase());
      return okQ && okC;
    });
  }, [products, debouncedQuery, categoryFilter]);

  // cart helpers
  function addToCartLocal(product, qty = 1) {
    setCartMap((m) => {
      const existing = m[product.id];
      const nextQty = existing ? existing.qty + qty : qty;
      return { ...m, [product.id]: { product, qty: nextQty } };
    });
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

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((s, it) => s + (Number(it.product.price) || 0) * Number(it.qty || 0), 0);
    const gst = Math.round(subtotal * 0.18); // example 18% GST
    const total = subtotal + gst;
    return { subtotal, gst, total };
  }, [cartItems]);

  // async wrapper for adding with per-button state
  async function handleAddToCart(product, qty = 1) {
    setAddingMap((m) => ({ ...m, [product.id]: true }));
    try {
      // Example: optimistic UI + optional server call
      addToCartLocal(product, qty);

      // If you want to inform server about cart-add, uncomment and edit below:
      // await authFetch('/cart/add/', { method: 'POST', body: JSON.stringify({ product_id: product.id, qty }), headers: { 'Content-Type': 'application/json' } });

      toast(`${product.name} added`, "success");
    } catch (err) {
      console.error('add to cart failed', err);
      toast('Failed to add item', 'error');
    } finally {
      setAddingMap((m) => {
        const copy = { ...m };
        delete copy[product.id];
        return copy;
      });
    }
  }

  // place order
  async function placeOrder() {
    if (cartItems.length === 0) return toast('Cart is empty', 'error');
    if (!shippingAddress || !shippingAddress.trim()) return toast('Please enter a shipping address', 'error');

    const items = cartItems.map((it) => ({ product_id: it.product.id, qty: Number(it.qty), unit_price: Number(it.product.price) || 0 }));
    const payload = { items, shipping_address: shippingAddress, notes: notes || "" };

    try {
      setPlacing(true);
      const res = await authFetch('/orders/', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      toast('Order placed', 'success');
      setCartMap({});
      setShippingAddress('');
      setNotes('');
      if (res?.id) toast(`Order #${res.id} created`, 'success');
    } catch (err) {
      console.error('place order err', err);
      toast('Failed to place order', 'error');
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
            <h1 className="text-2xl font-bold text-gray-900">Create Coustomer Order</h1>
            <p className="text-sm text-gray-600 mt-1">Pick items, adjust quantities, and place an order.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products by name or SKU"
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 w-72"
              />
              {debouncedQuery && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="text-sm text-gray-600">{products.length} products</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* product list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-4">
              {loadingProducts ? (
                <div className="col-span-full text-center py-12">Loading products…</div>
              ) : filtered.length === 0 ? (
                <div className="col-span-full text-center py-12 text-sm text-gray-500">No products found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((p) => (
                    <div key={p.id} className="bg-white rounded-lg overflow-hidden border hover:shadow-lg transition-shadow">
                      <div className="h-40 w-full bg-gray-100 flex items-center justify-center overflow-hidden">
                        {p.image_url ? (
                          <img src={`${API_UPLOADS}${p.image_url}`} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-sm text-gray-400">No image</div>
                        )}
                      </div>

                      <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900 line-clamp-2">{p.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{p.sku} • {p.category}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{fmtINR(p.price)}</div>
                            <div className="text-xs text-gray-400">/ unit</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`qty-${p.id}`);
                                const curr = el ? Number(el.value) || 1 : 1;
                                const next = Math.max(1, curr - 1);
                                if (el) el.value = next; else {};
                              }}
                              className="px-2 py-1 border rounded"
                            >-</button>

                            <input id={`qty-${p.id}`} type="number" min="1" defaultValue={1} className="w-16 px-2 py-1 rounded border text-sm text-center" />

                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`qty-${p.id}`);
                                const curr = el ? Number(el.value) || 1 : 1;
                                const next = curr + 1;
                                if (el) el.value = next;
                              }}
                              className="px-2 py-1 border rounded"
                            >+</button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const el = document.getElementById(`qty-${p.id}`);
                                const qty = el ? Number(el.value) || 1 : 1;
                                await handleAddToCart(p, qty);
                              }}
                              disabled={!!addingMap[p.id]}
                              className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
                            >
                              {addingMap[p.id] ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <div className="text-lg font-bold">{fmtINR(totals.total)}</div>
              </div>

              <div className="mt-4 max-h-64 overflow-auto space-y-3">
                {cartItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No items in cart.</div>
                ) : (
                  cartItems.map((it) => (
                    <div key={it.product.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded overflow-hidden bg-gray-100">
                          {it.product.image_url ? (
                            <img src={`${API_UPLOADS}${it.product.image_url}`} alt={it.product.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{it.product.name}</div>
                          <div className="text-xs text-gray-500">{fmtINR(it.product.price)} • {it.product.sku}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(it.product.id, Number(it.qty) - 1)} className="px-2 py-1 border rounded">-</button>
                        <input type="number" min="1" value={it.qty} onChange={(e) => updateQty(it.product.id, Number(e.target.value) || 1)} className="w-16 px-2 py-1 rounded border text-sm text-center" />
                        <button onClick={() => updateQty(it.product.id, Number(it.qty) + 1)} className="px-2 py-1 border rounded">+</button>
                        <button type="button" onClick={() => removeFromCart(it.product.id)} className="text-xs text-red-600">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 border-t pt-3 text-sm text-gray-700 space-y-2">
                <div className="flex items-center justify-between"><span>Subtotal</span><span>{fmtINR(totals.subtotal)}</span></div>
                <div className="flex items-center justify-between"><span>GST (18%)</span><span>{fmtINR(totals.gst)}</span></div>
                <div className="flex items-center justify-between font-semibold text-gray-900"><span>Total</span><span>{fmtINR(totals.total)}</span></div>
              </div>

              <div className="mt-4">
                <label className="block text-xs text-gray-600">Shipping address</label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter shipping address"
                  className="mt-1 w-full px-3 py-2 rounded border border-gray-200 text-sm"
                />
              </div>

              <div className="mt-3">
                <label className="block text-xs text-gray-600">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes for this order" rows={3} className="mt-1 w-full px-3 py-2 rounded border border-gray-200 text-sm" />
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={placeOrder} disabled={placing || cartItems.length === 0} className="flex-1 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">{placing ? 'Placing...' : 'Place order'}</button>
                <button type="button" onClick={() => { if (cartItems.length === 0) return; if (confirm('Clear cart?')) setCartMap({}); }} className="px-3 py-2 rounded-md bg-white border">Clear</button>
              </div>

              <div className="mt-3 text-xs text-gray-500">Tip: use + / - to adjust quantity quickly.</div>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              <p>Images served from backend at <code className="text-xs bg-gray-100 px-1 rounded">http://127.0.0.1:8000/uploads/...</code></p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
