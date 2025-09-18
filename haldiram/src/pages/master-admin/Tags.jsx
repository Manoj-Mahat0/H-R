// src/pages/master-admin/Tags.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";

/* Table-style Tags UI inspired by provided design.
   - header with icon, title, subtitle
   - search left, Add Tag button right
   - table rows with icon, name + subtitle (description), created/updated, actions
   - modal for add/edit and delete confirm
   - uses tailwind utility classes */

function IconTag(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Tag outline */}
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-7 7-9-9z" />
      {/* Hole in tag */}
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Pencil body */}
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconTrash(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Lid */}
      <polyline points="3 6 5 6 21 6" />
      {/* Bin body */}
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      {/* Trash lines */}
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}


function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

export default function MasterAdminTags() {
  const { user } = useAuth();
  const toast = useToast();

  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await authFetch("/tags/", { method: "GET" });
        if (!mounted) return;
        setTags(Array.isArray(data) ? data : []);
      } catch (err) {
        toast(err?.message || "Failed to load tags", "error");
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
    setDescription("");
    setShowModal(true);
    setTimeout(() => inputRef.current?.focus?.(), 40);
  }

  function openEdit(t) {
    setEditing(t);
    setName(t.name || "");
    setDescription(t.description || "");
    setShowModal(true);
    setTimeout(() => inputRef.current?.focus?.(), 40);
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
        const updated = await authFetch(`/tags/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: name.trim(), description: description.trim() }),
        });
        setTags((prev) => prev.map((it) => (it.id === editing.id ? updated : it)));
        toast("Tag updated", "success");
      } else {
        const created = await authFetch("/tags/", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: description.trim() }),
        });
        setTags((prev) => [created, ...prev]);
        toast("Tag created", "success");
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
      await authFetch(`/tags/${deleteTarget.id}?hard=true`, { method: "DELETE" });
      setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast("Tag deleted", "success");
      setDeleteTarget(null);
    } catch (err) {
      toast(err?.message || "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const term = (q || "").trim().toLowerCase();
    if (!term) return tags;
    return tags.filter((t) => (t.name || "").toLowerCase().includes(term) || (t.description || "").toLowerCase().includes(term));
  }, [tags, q]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <MasterAdminSidebar />

      <main className="flex-1 p-8">
        {/* header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-green-100 rounded-lg p-3">
                <IconTag className="text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
                <p className="text-sm text-gray-500 mt-1">Manage tags used across the application</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tags..."
                className="w-64 px-4 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                aria-label="Search tags"
              />
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-900 text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <span className="inline-flex items-center p-1 rounded-full bg-white/10">
                <IconPlus />
              </span>
              Add Tag
            </button>
          </div>
        </div>

        {/* table card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* table header */}
          <div className="hidden md:grid grid-cols-[1fr_160px_160px_120px] gap-0 items-center px-6 py-3 border-b border-gray-100 text-sm text-gray-500">
            <div className="font-medium">Name</div>

            <div className="text-right pr-4">Actions</div>
          </div>

          {/* list */}
          <div>
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-gray-50 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No tags found. Click <button onClick={openAdd} className="text-indigo-600 underline">Add Tag</button> to create one.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((t) => (
                  <div key={t.id} className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_120px] items-start md:items-center gap-3 px-4 md:px-6 py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-11 h-11 rounded-md bg-green-50 flex items-center justify-center">
                          <IconTag className="text-green-600" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{t.description || "Default"}</div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 text-center">{formatDate(t.created_at || t.created)}</div>
                    <div className="text-sm text-gray-600 text-center">{formatDate(t.updated_at || t.updated)}</div>

                    <div className="flex items-center justify-end gap-3">
  {/* View */}
  

  {/* Edit */}
  <button
    onClick={() => openEdit(t)}
    className="p-2 rounded-md bg-yellow-100 hover:bg-yellow-200 focus:outline-none"
    aria-label={`Edit ${t.name}`}
  >
    <IconEdit className="text-yellow-600" />
  </button>

  {/* Delete */}
  <button
    onClick={() => setDeleteTarget(t)}
    className="p-2 rounded-md bg-red-100 hover:bg-red-200 focus:outline-none"
    aria-label={`Delete ${t.name}`}
  >
    <IconTrash className="text-red-600" />
  </button>
</div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* footer count */}
          <div className="px-6 py-3 text-sm text-gray-600">
            Showing {filtered.length} of {tags.length} tags
          </div>
        </div>
      </main>

      {/* add/edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowModal(false)} />
          <form onSubmit={save} className="relative z-10 bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold">{editing ? "Edit Tag" : "Add Tag"}</h3>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm text-gray-600 block">Name</label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. Spicy"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Short description (optional)"
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

      {/* delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete tag</h3>
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
