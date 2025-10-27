import React, { useEffect, useMemo, useState } from "react";
import VendorSidebar from "../../components/VendorSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";

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

  // controlled qty map
  const [qtyMap, setQtyMap] = useState({});
  function setQtyFor(id, v) {
    const n = Math.max(1, Number(v) || 1);
    setQtyMap((s) => ({ ...s, [id]: n }));
  }
  function qtyFor(id) {
    return qtyMap[id] ?? 1;
  }

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

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
    const gst = Math.round(subtotal * 0);
    const total = subtotal + gst;
    return { subtotal, gst, total };
  }, [cartItems]);

  async function handleAddToCart(product, qty = 1) {
    setAddingMap((m) => ({ ...m, [product.id]: true }));
    try {
      addToCartLocal(product, qty);
      toast(`${product.name} added`, "success");
    } catch (err) {
      console.error("add to cart failed", err);
      toast("Failed to add item", "error");
    } finally {
      setAddingMap((m) => {
        const copy = { ...m };
        delete copy[product.id];
        return copy;
      });
    }
  }

  async function placeOrder() {
    if (cartItems.length === 0) return toast("Cart is empty", "error");
    if (!shippingAddress || !shippingAddress.trim()) return toast("Please enter a shipping address", "error");

    const items = cartItems.map((it) => ({ product_id: it.product.id, qty: Number(it.qty), unit_price: Number(it.product.price) || 0 }));
    const payload = { items, shipping_address: shippingAddress, notes: notes || "" };

    try {
      setPlacing(true);
      const res = await authFetch("/new-orders/", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      toast("Order placed", "success");
      setCartMap({});
      setShippingAddress("");
      setNotes("");
      if (res?.id) toast(`Order #${res.id} created`, "success");
    } catch (err) {
      console.error("place order err", err);
      toast("Failed to place order", "error");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Page background: adapt to dark/light and keep consistent spacing */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-colors" aria-hidden />

      <VendorSidebar />

      <main className="flex-1 p-6 md:p-10 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Create Customer Order</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Modern, compact, and mobile-friendly ordering experience.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products by name or SKU"
                className="px-4 py-2 rounded-2xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-80 dark:bg-slate-800 dark:border-slate-700 dark:placeholder-slate-500 dark:focus:ring-indigo-600 text-slate-900 dark:text-slate-100"
              />
              {debouncedQuery && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">✕</button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* left: product list */}
          <div className="lg:pr-4">
            <div className="space-y-4">
              {loadingProducts ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading products…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">No products found</div>
              ) : (
                filtered.map((p) => (
                  <article key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{p.name}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-400 mt-1">{p.sku}</div>
                          </div>

                          <div className="hidden sm:flex flex-wrap gap-1">
                            {(p.category || '').split(',').filter(Boolean).slice(0, 3).map((cat) => (
                              <span key={cat} className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{cat.trim()}</span>
                            ))}
                          </div>
                        </div>

                        {p.description ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-2">{p.description}</div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right w-20">
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(p.price)}</div>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <label htmlFor={`qty-${p.id}`} className="sr-only">Quantity for {p.name}</label>
                          <input
                            id={`qty-${p.id}`}
                            type="number"
                            min="1"
                            value={qtyFor(p.id)}
                            onChange={(e) => setQtyFor(p.id, e.target.value)}
                            className="w-12 px-2 py-1 rounded-lg border text-xs text-center bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="pl-2">
                          <button
                            onClick={async () => {
                              const qty = qtyFor(p.id);
                              await handleAddToCart(p, qty);
                            }}
                            disabled={!!addingMap[p.id]}
                            className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm shadow hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-60"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          {/* right: cart */}
          <aside className="lg:pl-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg sticky top-6 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cart</div>
                  <div className="text-xs text-slate-400 dark:text-slate-400">{cartItems.length} items</div>
                </div>

                <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{fmtINR(totals.total)}</div>
              </div>

              <div className="mt-4 space-y-3 max-h-[60vh] overflow-auto">
                {cartItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <div className="text-sm font-medium">Your cart is empty</div>
                    <div className="text-xs mt-2">Search and add items to start an order</div>
                  </div>
                ) : (
                  cartItems.map((it) => (
                    <div key={it.product.id} className="flex items-start gap-3 p-3 border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{it.product.name}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-400">{fmtINR(it.product.price)} • {it.product.sku}</div>
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <input type="number" min="1" value={it.qty} onChange={(e) => updateQty(it.product.id, Number(e.target.value) || 1)} className="w-12 px-2 py-1 rounded-lg border text-sm text-center bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => removeFromCart(it.product.id)} className="text-xs text-red-600 dark:text-red-400">Remove</button>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtINR((Number(it.product.price)||0)*Number(it.qty))}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400">Shipping address</label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="House, Street, City"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="mt-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400">Notes (optional)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes for this order" className="mt-1 w-full px-3 py-1 rounded-xl border border-slate-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={placeOrder} disabled={placing || cartItems.length === 0} className="flex-1 px-4 py-2 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60">
                  {placing ? 'Placing...' : 'Place order'}
                </button>
                <button type="button" onClick={() => { if (cartItems.length === 0) return; if (confirm('Clear cart?')) { setCartMap({}); setQtyMap({}); } }} className="px-4 py-2 rounded-2xl bg-white border dark:bg-slate-800 dark:border-slate-700">
                  Clear
                </button>
              </div>

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
