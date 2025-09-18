// src/pages/master-admin/Categories.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import MasterAdminSidebar from "../../components/AdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";

/* Polished Categories UI
   - header with icon, title, subtitle
   - search left, Add Category button right
   - list rows with icon, name + description, actions (View/Edit/Delete)
   - skeleton loading and modals
   - keeps existing endpoints/logic
*/

function IconCategory(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7h7l2 2h9v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconEye(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEdit(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      <path d="M12 20h9" />
    </svg>
  );
}

function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function MasterAdminCategories() {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await authFetch("/categories/", { method: "GET" });
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        toast(err?.message || "Failed to load categories", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [toast]);

  function openAdd() {
    setEditing(null);
    setName("");
    setDesc("");
    setShowModal(true);
    setTimeout(() => inputRef.current?.focus?.(), 30);
  }

  function openEdit(cat) {
    setEditing(cat);
    setName(cat.name || "");
    setDesc(cat.description || "");
    setShowModal(true);
    setTimeout(() => inputRef.current?.focus?.(), 30);
  }

  async function save(e) {
    e?.preventDefault();
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await authFetch(`/categories/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
        });
        setItems((prev) => prev.map((it) => (it.id === editing.id ? updated : it)));
        toast("Category updated", "success");
      } else {
        const created = await authFetch("/categories/", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
        });
        setItems((prev) => [created, ...prev]);
        toast("Category created", "success");
      }
      setShowModal(false);
    } catch (err) {
      toast(err?.message || "Request failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authFetch(`/categories/${deleteTarget.id}?hard=true`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id));
      toast("Category deleted", "success");
      setDeleteTarget(null);
    } catch (err) {
      toast(err?.message || "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const term = (query || "").trim().toLowerCase();
    if (!term) return items;
    return items.filter((it) => (it.name || "").toLowerCase().includes(term) || (it.description || "").toLowerCase().includes(term));
  }, [items, query]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <MasterAdminSidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 rounded-lg p-3">
              <IconCategory className="text-indigo-700" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Categories</h2>
              <p className="text-sm text-gray-600 mt-1">Manage product categories used in the catalog.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories"
                className="w-64 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Search categories"
              />
            </div>

            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-900 text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <span className="inline-flex items-center p-1 rounded-full bg-white/10">
                <IconPlus />
              </span>
              Add Category
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* header (desktop) */}
          <div className="hidden md:grid grid-cols-[1fr_120px] items-center px-6 py-3 border-b border-gray-100 text-sm text-gray-500">
            <div className="font-medium">Name</div>
            <div className="text-right pr-4">Actions</div>
          </div>

          {/* content */}
          <div>
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-gray-50 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No categories found. Click{" "}
                <button onClick={openAdd} className="text-indigo-600 underline">Add Category</button> to create one.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px] items-start md:items-center gap-3 px-4 md:px-6 py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-11 h-11 rounded-md bg-indigo-50 flex items-center justify-center">
                          <IconCategory className="text-indigo-700" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{c.description || "No description"}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => toast("View action — implement as needed", "info")}
                        className="p-2 rounded-md bg-blue-50 hover:bg-blue-100 focus:outline-none"
                        aria-label={`View ${c.name}`}
                      >
                        <IconEye className="text-blue-600" />
                      </button>

                      <button
                        onClick={() => openEdit(c)}
                        className="p-2 rounded-md bg-yellow-50 hover:bg-yellow-100 focus:outline-none"
                        aria-label={`Edit ${c.name}`}
                      >
                        <IconEdit className="text-yellow-600" />
                      </button>

                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-2 rounded-md bg-red-50 hover:bg-red-100 focus:outline-none"
                        aria-label={`Delete ${c.name}`}
                      >
                        <IconTrash className="text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-3 text-sm text-gray-600">
            Showing {filtered.length} of {items.length} categories
          </div>
        </div>
      </main>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowModal(false)} />
          <form onSubmit={save} className="relative z-10 bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold">{editing ? "Edit category" : "Add category"}</h3>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm text-gray-600 block">Name</label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. Namkeen"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 block">Description</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  rows="2"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border bg-white" disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-md bg-indigo-900 text-white" disabled={saving}>
                {saving ? (editing ? "Saving..." : "Creating...") : editing ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete category</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget.name}</span>? This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-md border bg-white" disabled={deleting}>
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-md bg-red-600 text-white" disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
