// src/pages/master-admin/Customers.jsx
import React, { useEffect, useMemo, useState } from "react";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";

/**
 * Customers (Users) admin page
 * - Fetches /api/users/
 * - Supports create (POST /api/users/), update (PUT /api/users/:id -> only role/password),
 *   block (PATCH /api/users/:id/block), activate (PATCH /api/users/:id/activate),
 *   delete (DELETE /api/users/:id)
 *
 * Expects useAuth() to expose { token } and useToast() to show messages.
 */

// const API_HOST = "http://127.0.0.1:8000";
const API_HOST = "http://127.0.0.1:8000";

const API_BASE = "/api";

const ALL_ROLES = [
//   { value: "master_admin", label: "Master Admin" },
  { value: "admin", label: "Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "vendor", label: "Vendor" },
  { value: "staff", label: "Staff" },
  { value: "driver", label: "Driver" },
];

function UserCard({ user, onEdit, onBlock, onActivate, onDelete }) {
  return (
    <div className="bg-white p-3 rounded-lg shadow-sm flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-gray-900">{user.name}</div>
        <div className="text-xs text-gray-500">{user.email}</div>
        <div className="text-xs text-gray-500 mt-1">
          Role: <span className="font-medium">{user.role}</span>
        </div>
        <div className="text-xs mt-1">
          Status:{" "}
          {user.active ? (
            <span className="text-green-600 font-medium">Active</span>
          ) : (
            <span className="text-red-600 font-medium">Blocked</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          {user.active ? (
            <button
              onClick={() => onBlock(user)}
              className="px-2 py-1 text-xs rounded bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
            >
              Block
            </button>
          ) : (
            <button
              onClick={() => onActivate(user)}
              className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100"
            >
              Activate
            </button>
          )}

          <button
            onClick={() => onEdit(user)}
            className="px-2 py-1 text-xs rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            Edit
          </button>

          <button
            onClick={() => onDelete(user)}
            className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MasterAdminCustomers() {
  const { token } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "admin" });

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ role: "admin", password: "" });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // central API request that adds Authorization header from token
  async function apiRequest(path, { method = "GET", body = null } = {}) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";

    const res = await fetch(`${API_HOST}${API_BASE}${path}`, {
      method,
      headers,
      body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const err = new Error(data?.detail || data?.message || res.statusText || "Request failed");
      err.body = data;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // load users
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await apiRequest("/users/", { method: "GET" });
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("load users err", err);
        toast(err.body?.detail || err.message || "Failed to load users", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, [token]); // reload when token changes

  // grouping by roles (all roles present individually)
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? users
      : users.filter((u) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));

    return {
    //   master_admin: filtered.filter((u) => u.role === "master_admin"),
      admin: filtered.filter((u) => u.role === "admin"),
      accountant: filtered.filter((u) => u.role === "accountant"),
      vendor: filtered.filter((u) => u.role === "vendor"),
      staff: filtered.filter((u) => u.role === "staff"),
      driver: filtered.filter((u) => u.role === "driver"),
    };
  }, [users, query]);

  // create user
  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast("Please complete name, email and password", "error");
      return;
    }
    try {
      const payload = {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
      };
      const created = await apiRequest("/users/", { method: "POST", body: payload });
      setUsers((s) => [created, ...s]);
      toast("User created", "success");
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", role: "admin" });
    } catch (err) {
      console.error("create err", err);
      toast(err.body?.detail || err.message || "Create failed", "error");
    }
  }

  // open edit modal
  function openEdit(u) {
    setEditTarget(u);
    setEditForm({ role: u.role || "admin", password: "" });
  }

  // save edit (only password & role)
  async function handleEditSave(e) {
    e.preventDefault();
    if (!editTarget) return;
    try {
      const payload = { role: editForm.role };
      if (editForm.password && editForm.password.trim()) payload.password = editForm.password;

      const updated = await apiRequest(`/users/${editTarget.id}`, { method: "PUT", body: payload });
      setUsers((s) => s.map((it) => (it.id === updated.id ? updated : it)));
      toast("User updated", "success");
      setEditTarget(null);
      setEditForm({ role: "admin", password: "" });
    } catch (err) {
      console.error("edit err", err);
      toast(err.body?.detail || err.message || "Update failed", "error");
    }
  }

  // block user
  async function handleBlock(u) {
    try {
      await apiRequest(`/users/${u.id}/block`, { method: "PATCH" });
      setUsers((s) => s.map((it) => (it.id === u.id ? { ...it, active: false } : it)));
      toast("User blocked", "success");
    } catch (err) {
      console.error("block err", err);
      toast(err.body?.detail || err.message || "Block failed", "error");
    }
  }

  // activate user
  async function handleActivate(u) {
    try {
      await apiRequest(`/users/${u.id}/activate`, { method: "PATCH" });
      setUsers((s) => s.map((it) => (it.id === u.id ? { ...it, active: true } : it)));
      toast("User activated", "success");
    } catch (err) {
      console.error("activate err", err);
      toast(err.body?.detail || err.message || "Activate failed", "error");
    }
  }

  // delete user
  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/users/${deleteTarget.id}`, { method: "DELETE" });
      setUsers((s) => s.filter((it) => it.id !== deleteTarget.id));
      toast("User deleted", "success");
      setDeleteTarget(null);
    } catch (err) {
      console.error("delete err", err);
      toast(err.body?.detail || err.message || "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  // simple column wrapper with fixed height + internal scroll
  function Column({ title, list, emptyMessage }) {
    return (
      <div className="flex-1 min-w-[260px]">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[60vh]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">{title}</div>
              <div className="text-xs text-gray-500">{list.length} items</div>
            </div>
          </div>

          <div className="p-4 overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {list.length === 0 ? (
              <div className="text-sm text-gray-500">{emptyMessage}</div>
            ) : (
              <div className="space-y-3">
                {list.map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    onEdit={openEdit}
                    onBlock={handleBlock}
                    onActivate={handleActivate}
                    onDelete={(usr) => setDeleteTarget(usr)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <MasterAdminSidebar />

      <div className="flex-1 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Customers / Users</h2>
            <p className="text-sm text-gray-600 mt-1">Manage users by role. Master admin separated.</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users by name or email"
              className="w-64 px-4 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-blue-700">
              + Add user
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* <Column title="Master Admins" list={grouped.master_admin} emptyMessage="No master admins found." /> */}
          <Column title="Admins" list={grouped.admin} emptyMessage="No admins found." />
          <Column title="Accountants" list={grouped.accountant} emptyMessage="No accountants found." />
          <Column title="Vendors" list={grouped.vendor} emptyMessage="No vendors found." />
          <Column title="Staff" list={grouped.staff} emptyMessage="No staff found." />
          <Column title="Drivers" list={grouped.driver} emptyMessage="No drivers found." />
        </div>

        {/* create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowCreate(false)} />
            <form onSubmit={handleCreate} className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 z-10">
              <h3 className="text-lg font-semibold">Create user</h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <input value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded" />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded" />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Password</label>
                  <input type="password" value={createForm.password} onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded" />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Role</label>
                  <select value={createForm.role} onChange={(e) => setCreateForm((s) => ({ ...s, role: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded bg-white">
                    {ALL_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md border">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-green-600 text-white">Create</button>
              </div>
            </form>
          </div>
        )}

        {/* edit modal */}
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-30" onClick={() => setEditTarget(null)} />
            <form onSubmit={handleEditSave} className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 z-10">
              <h3 className="text-lg font-semibold">Edit user</h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <input value={editTarget.name} disabled className="mt-1 w-full px-3 py-2 border rounded bg-gray-50" />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <input value={editTarget.email} disabled className="mt-1 w-full px-3 py-2 border rounded bg-gray-50" />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Role</label>
                  <select value={editForm.role} onChange={(e) => setEditForm((s) => ({ ...s, role: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded bg-white">
                    {ALL_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-600">Password (leave blank to keep)</label>
                  <input type="password" value={editForm.password} onChange={(e) => setEditForm((s) => ({ ...s, password: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded" />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 rounded-md border">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-green-600 text-white">Save</button>
              </div>
            </form>
          </div>
        )}

        {/* delete modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-30" onClick={() => setDeleteTarget(null)} />
            <div className="relative bg-white rounded-lg shadow-lg w-full max-w-sm p-6 z-10">
              <h3 className="text-lg font-semibold text-gray-900">Delete user</h3>
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
