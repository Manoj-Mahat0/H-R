// src/pages/master-admin/MasterAdminProducts.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import MasterAdminSidebar from "../../components/AdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import { getToken } from "../../lib/auth";
import { FiBox, FiEye, FiEyeOff, FiEdit3, FiTrash2, FiSearch, FiPlus, FiImage } from "react-icons/fi";

/* ---------- MultiSelectDropdown (same as before) ---------- */
function MultiSelectDropdown({ options = [], selected = [], onChange, placeholder = "Select" }) {
  const [open, setOpen] = useState(false);
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

  const selectedNames = options.filter((o) => selected.includes(o.id)).map((o) => o.name);
  const label =
    selectedNames.length === 0 ? placeholder : selectedNames.length <= 3 ? selectedNames.join(", ") : `${selectedNames.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full text-left px-3 py-2 border rounded bg-white flex items-center justify-between text-sm"
      >
        <div className="truncate text-gray-700">{label}</div>
        <div className="ml-2 text-gray-400">▾</div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-56 overflow-auto">
          <div className="p-2">
            {options.length === 0 ? (
              <div className="text-sm text-gray-500">No options</div>
            ) : (
              options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    onChange={() => toggleId(opt.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{opt.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- ProductRow: Eye icon used as active/inactive toggle; removed standalone View button ---------- */
function ProductRow({ p, onEdit, onDelete, onToggleActive, busyToggleId }) {
  const isBusy = busyToggleId === p.id;
  return (
    <tr>
      <td className="px-4 py-4 whitespace-nowrap align-top">
        <div className="h-14 w-14 rounded-md overflow-hidden bg-gray-50 flex items-center justify-center border">
          {p.image_url ? (
            <img
              src={p.image_url.startsWith("http") ? p.image_url : `${API_HOST}${p.image_url}`}
              alt={p.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-gray-300">
              <FiImage size={20} />
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <div className="font-medium text-gray-900">{p.name}</div>
        <div className="text-xs text-gray-500 mt-1">{p.sku}</div>
      </td>

      <td className="px-4 py-4 align-top text-sm text-gray-600">{p.category}</td>

      <td className="px-4 py-4 align-top text-sm font-semibold text-gray-900">₹{p.price}</td>

      <td className="px-4 py-4 align-top">
        <span
          className={`px-2 py-1 rounded-md text-xs font-medium ${((p.max_quantity ?? 0) <= 5) ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {p.max_quantity ?? 0} pcs
        </span>
      </td>

      <td className="px-4 py-4 align-top text-right">
        <div className="inline-flex gap-2 items-center">
          {/* Eye icon used for active/inactive */}
          <button
            onClick={() => onToggleActive(p)}
            className={`p-2 rounded-md transition ${p.active ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
            disabled={isBusy}
            title={isBusy ? "Working..." : p.active ? "Mark as inactive (hide)" : "Mark as active (show)"}
          >
            {isBusy ? "..." : p.active ? <FiEye /> : <FiEyeOff />}
          </button>

          <button onClick={() => onEdit(p)} className="p-2 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100" title="Edit">
            <FiEdit3 />
          </button>

          <button onClick={() => onDelete(p)} className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100" title="Delete">
            <FiTrash2 />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ---------- Main component (unchanged logic, only UI uses updated ProductRow) ---------- */
export default function MasterAdminProducts() {
  const { token } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    weight: "",
    min_quantity: "",
    max_quantity: "",
    price: "",
    category_ids: [],
    tag_ids: [],
    description: "",
    file: null,
  });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [busyToggleId, setBusyToggleId] = useState(null);

  const modalFormRef = useRef(null);

  async function apiRequest(path, { method = "GET", body = null } = {}) {
    const headers = {};
    const localToken = token || getToken();
    if (localToken) headers["Authorization"] = `Bearer ${localToken}`;

    const isForm = typeof FormData !== "undefined" && body instanceof FormData;

    if (!isForm) headers["Content-Type"] = "application/json";

    const res = await fetch(`${API_HOST}${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const err = new Error(data?.detail || data?.message || `Request failed: ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  // load products
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await apiRequest("/products/", { method: "GET" });
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

  // load categories + tags
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

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, query]);

  function openAdd() {
    setEditing(null);
    setForm({
      sku: "",
      name: "",
      weight: "",
      min_quantity: "",
      max_quantity: "",
      price: "",
      category_ids: [],
      tag_ids: [],
      description: "",
      file: null,
    });
    setPreviewUrl(null);
    setShowModal(true);
    setTimeout(() => modalFormRef.current?.focus?.(), 50);
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
      category_ids: Array.isArray(p.category_ids) ? p.category_ids : [],
      tag_ids: Array.isArray(p.tag_ids) ? p.tag_ids : [],
      description: p.description ?? "",
      file: null,
    });
    setPreviewUrl(p.image_url ? (p.image_url.startsWith("http") ? p.image_url : `${API_HOST}${p.image_url}`) : null);
    setShowModal(true);
    setTimeout(() => modalFormRef.current?.focus?.(), 50);
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

  function toggleId(listKey, id) {
    setForm((f) => {
      const arr = Array.isArray(f[listKey]) ? [...f[listKey]] : [];
      const idx = arr.indexOf(id);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(id);
      return { ...f, [listKey]: arr };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.sku.trim()) {
      toast("Name and SKU are required", "error");
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
      fd.append("description", form.description || "");
      if (form.category_ids && form.category_ids.length) fd.append("category_ids", JSON.stringify(form.category_ids));
      if (form.tag_ids && form.tag_ids.length) fd.append("tag_ids", JSON.stringify(form.tag_ids));
      if (form.file) fd.append("file", form.file);

      let response = null;
      if (editing && editing.id) {
        response = await apiRequest(`/products/${editing.id}`, { method: "PATCH", body: fd });
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? response : p)));
        toast("Product updated", "success");
      } else {
        response = await apiRequest("/products/", { method: "POST", body: fd });
        setProducts((prev) => [response, ...prev]);
        toast("Product created", "success");
      }

      setShowModal(false);
      setPreviewUrl(null);
    } catch (err) {
      console.error("save err", err);
      const msg = err.body?.detail || err.body?.message || err.message || "Request failed";
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/products/${deleteTarget.id}?hard=true`, { method: "DELETE" });
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

  async function handleToggleActive(p) {
    if (!p?.id) return;
    setBusyToggleId(p.id);
    try {
      const action = p.active ? "deactivate" : "activate";
      const res = await apiRequest(`/products/${p.id}/${action}`, { method: "POST" });
      const newActive = res?.status === "activated";
      setProducts((prev) => prev.map((it) => (it.id === p.id ? { ...it, active: newActive } : it)));
      toast(res?.status === "activated" ? "Product activated" : "Product deactivated", "success");
    } catch (err) {
      console.error("toggle active err", err);
      toast(err.body?.detail || err.message || "Failed to change state", "error");
    } finally {
      setBusyToggleId(null);
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <MasterAdminSidebar />

      <div className="flex-1 p-6 md:p-8">
        {/* header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
    <div className="bg-indigo-50 p-3 rounded-lg">
      <FiBox className="text-indigo-600 w-6 h-6" />
    </div>
    <div>
      <h1 className="text-xl font-bold text-gray-900">Products</h1>
      <p className="text-sm text-gray-500">Manage your product inventory and catalog</p>
    </div>
  </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, sku or category"
                className="w-72 pl-4 pr-10 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute right-3 top-2 text-gray-400">
                <FiSearch />
              </div>
            </div>

            <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-blue-700">
              <FiPlus />
              <span>Add product</span>
            </button>
          </div>
        </div>

        {/* table card */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Image</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                // skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-6">
                      <div className="h-14 w-14 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-6">
                      <div className="h-4 bg-gray-100 rounded w-48 animate-pulse" />
                      <div className="h-3 bg-gray-100 rounded w-32 mt-2 animate-pulse" />
                    </td>
                    <td className="px-4 py-6">
                      <div className="h-4 bg-gray-100 rounded w-24 animate-pulse" />
                    </td>
                    <td className="px-4 py-6">
                      <div className="h-4 bg-gray-100 rounded w-20 animate-pulse" />
                    </td>
                    <td className="px-4 py-6">
                      <div className="h-5 bg-gray-100 rounded w-16 animate-pulse" />
                    </td>
                    <td className="px-4 py-6 text-right">
                      <div className="flex gap-2 justify-end">
                        <div className="h-8 w-8 bg-gray-100 rounded animate-pulse" />
                        <div className="h-8 w-8 bg-gray-100 rounded animate-pulse" />
                        <div className="h-8 w-8 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <ProductRow key={p.id} p={p} onEdit={openEdit} onDelete={(prod) => setDeleteTarget(prod)} onToggleActive={handleToggleActive} busyToggleId={busyToggleId} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* add/edit modal (unchanged) */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center pt-6 md:pt-0 px-4">
            <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowModal(false)} />

            <div className="relative z-10 w-full max-w-3xl mx-auto">
              <form onSubmit={handleSave} className="bg-white rounded-lg shadow-lg w-full flex flex-col overflow-hidden" role="dialog" aria-modal="true">
                {/* header */}
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold">{editing ? "Edit product" : "Add product"}</h3>
                </div>

                {/* body */}
                <div className="px-6 py-4 overflow-auto" style={{ maxHeight: "70vh" }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">SKU</label>
                      <input
                        ref={modalFormRef}
                        value={form.sku}
                        onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded"
                        placeholder="SKU"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Name</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded"
                        placeholder="Product name"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Price (₹)</label>
                      <input
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded"
                        type="number"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Weight (g)</label>
                      <input
                        value={form.weight}
                        onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded"
                        type="number"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Min quantity</label>
                      <input
                        value={form.min_quantity}
                        onChange={(e) => setForm((f) => ({ ...f, min_quantity: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded"
                        type="number"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Max quantity</label>
                      <input
                        value={form.max_quantity}
                        onChange={(e) => setForm((f) => ({ ...f, max_quantity: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border rounded"
                        type="number"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-600 block mb-1">Categories</label>
                          <MultiSelectDropdown options={categories} selected={form.category_ids} onChange={(arr) => setForm((f) => ({ ...f, category_ids: arr }))} placeholder="Choose categories" />
                          <div className="mt-2 text-xs text-gray-500">{form.category_ids.length === 0 ? "No categories selected" : `${form.category_ids.length} selected`}</div>
                        </div>

                        <div>
                          <label className="text-sm text-gray-600 block mb-1">Tags</label>
                          <MultiSelectDropdown options={tags} selected={form.tag_ids} onChange={(arr) => setForm((f) => ({ ...f, tag_ids: arr }))} placeholder="Choose tags" />
                          <div className="mt-2 text-xs text-gray-500">{form.tag_ids.length === 0 ? "No tags selected" : `${form.tag_ids.length} selected`}</div>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm text-gray-600">Description</label>
                      <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded" rows="3" />
                    </div>

                    <div>
                      <label className="text-sm text-gray-600">Image</label>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 w-full" />
                      {previewUrl && (
                        <div className="mt-2 w-40 h-28 rounded overflow-hidden border">
                          <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* sticky footer with actions */}
                <div className="border-t bg-white px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex-1 text-left text-xs text-gray-500 sm:text-right sm:flex-none">
                    <span className="hidden sm:inline-block">{editing ? "Editing product" : "Creating new product"}</span>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => { setShowModal(false); setPreviewUrl(null); }} className="px-4 py-2 rounded-md border bg-white" disabled={saving}>
                      Cancel
                    </button>

                    <button type="submit" className="px-4 py-2 rounded-md bg-green-600 text-white disabled:opacity-60" disabled={saving}>
                      {saving ? (editing ? "Saving..." : "Creating...") : editing ? "Save" : "Create"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* delete confirm modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-30" onClick={() => setDeleteTarget(null)} />
            <div className="relative bg-white rounded-lg shadow-lg w-full max-w-sm p-6 z-10">
              <h3 className="text-lg font-semibold text-gray-900">Delete product</h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.name}</span>?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-md border bg-white" disabled={deleting}>
                  Cancel
                </button>
                <button onClick={handleDeleteConfirmed} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60" disabled={deleting}>
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
