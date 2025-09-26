import React, { useEffect, useState, useRef } from "react";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";
import { FiPlus, FiRefreshCw, FiEdit2, FiTrash2, FiFileText, FiCheck, FiX, FiSearch } from "react-icons/fi";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Naya Component: Inline Add Row
function AddLimitRow({ vendor, onSave, saving }) {
  const [form, setForm] = useState({
    limit_amount: "",
    limit_boxes: "",
    month: MONTHS[new Date().getMonth()], // Default to current month
    note: "ok",
  });

  const handleSave = () => {
    if (!form.month) {
      alert("Please select a month.");
      return;
    }
    if (!form.limit_amount && !form.limit_boxes) {
      alert("Please enter an amount or box limit.");
      return;
    }
    onSave(form);
  };

  return (
    <tr className="bg-gray-50">
      <td className="p-2 font-medium text-indigo-600">New</td>
      <td className="p-2"><input type="number" placeholder="Amount" value={form.limit_amount} onChange={e => setForm({...form, limit_amount: e.target.value})} className="w-full border rounded px-2 py-1" /></td>
      <td className="p-2"><input type="number" placeholder="Boxes" value={form.limit_boxes} onChange={e => setForm({...form, limit_boxes: e.target.value})} className="w-full border rounded px-2 py-1" /></td>
      <td className="p-2">
        <select value={form.month} onChange={e => setForm({...form, month: e.target.value})} className="w-full border rounded px-2 py-1">
          <option value="ALL">All Months</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td className="p-2"><input type="text" placeholder="Note" value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="w-full border rounded px-2 py-1" /></td>
      <td className="p-2 text-right">
        <button onClick={handleSave} disabled={saving} className="px-3 py-1 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300">
          {saving ? '...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}


export default function VendorLimits() {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [activeVendor, setActiveVendor] = useState(null);
  const [limits, setLimits] = useState([]);
  const [loadingLimits, setLoadingLimits] = useState(false);
  
  // Inline editing ke liye state
  const [editingId, setEditingId] = useState(null); 
  const [editForm, setEditForm] = useState(null);

  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const initialLoadRef = useRef(true);

  // Load Vendors
  useEffect(() => {
    (async () => {
      try {
        setLoadingVendors(true);
        const users = await authFetch("/users/");
        const vendorUsers = users.filter((u) => u.role === "vendor");
        setVendors(vendorUsers);
        setFilteredVendors(vendorUsers);

        // Auto-select first vendor on initial load
        if (initialLoadRef.current && vendorUsers.length > 0) {
            handleSelectVendor(vendorUsers[0]);
            initialLoadRef.current = false;
        }

      } catch (err) {
        toast(err.message || "Failed to load vendors", "error");
      } finally {
        setLoadingVendors(false);
      }
    })();
  }, [toast]);
  
  // Filter vendors on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredVendors(vendors);
    } else {
      setFilteredVendors(
        vendors.filter(v => 
          v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.email.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, vendors]);

  async function loadLimits(vendor) {
    if (!vendor) return;
    setLoadingLimits(true);
    try {
      const res = await authFetch(`/vendor-limits/?vendor_id=${vendor.id}`);
      setLimits(Array.isArray(res) ? res.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) : []);
    } catch (err) {
      toast(err.message || "Failed to load limits", "error");
    } finally {
      setLoadingLimits(false);
    }
  }

  const handleSelectVendor = (vendor) => {
    setActiveVendor(vendor);
    setEditingId(null); // Reset editing state
    loadLimits(vendor);
  }

  const handleStartEdit = (limit) => {
    setEditingId(limit.id);
    setEditForm({ ...limit });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  // Naya aur Edit, dono ke liye ek hi save function
  async function handleSave(formData, isEdit = false) {
    try {
      setSaving(true);
      const payload = {
        vendor_id: activeVendor.id,
        limit_amount: Number(formData.limit_amount) || 0,
        limit_boxes: Number(formData.limit_boxes) || 0,
        month: formData.month,
        note: formData.note || "ok",
      };

      if (isEdit) {
        await authFetch(`/vendor-limits/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast("Limit updated", "success");
        setEditingId(null);
      } else {
        await authFetch("/vendor-limits/", { method: "POST", body: JSON.stringify(payload) });
        toast("Limit added", "success");
      }
      loadLimits(activeVendor);
    } catch (err) {
      toast(err.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }
  
  async function handleDelete(limit) {
    try {
      await authFetch(`/vendor-limits/${limit.id}`, { method: "DELETE" });
      toast("Limit deleted", "success");
      setLimits((p) => p.filter((x) => x.id !== limit.id));
      setDeleteTarget(null);
    } catch (err) {
      toast(err.message || "Failed to delete", "error");
    }
  }

  // ... (exportCSV function remains the same)
  function exportCSV() {
    if (!limits.length) return toast("No limits to export", "error");
    const header = ["ID", "Amount", "Boxes", "Month", "Note", "Created"];
    const rows = limits.map((l) => [
      l.id, l.limit_amount ?? "", l.limit_boxes ?? "", l.month ?? "", l.note ?? "",
      new Date(l.created_at).toLocaleString(),
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor_${activeVendor.id}_limits.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <MasterAdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Vendor Limits</h1>

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 flex-1">
          {/* Left Panel: Vendor List */}
          <div className="lg:col-span-3 bg-white rounded-xl border flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Vendors</h2>
              <div className="relative mt-2">
                 <FiSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                 <input 
                   type="text" 
                   placeholder="Search vendor..."
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
                 />
               </div>
            </div>
            <div className="overflow-y-auto">
              {loadingVendors ? <p className="p-4 text-sm text-gray-500">Loading...</p> : (
                filteredVendors.map(v => (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVendor(v)}
                    className={`p-4 border-b cursor-pointer transition-colors ${activeVendor?.id === v.id ? 'bg-indigo-100' : 'hover:bg-gray-50'}`}
                  >
                    <div className="font-medium text-gray-900">{v.name}</div>
                    <div className="text-xs text-gray-500">{v.email}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Limits Management */}
          <div className="lg:col-span-7 bg-white rounded-xl border flex flex-col p-4">
            {!activeVendor ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a vendor from the left to manage their limits.
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{activeVendor.name}</h2>
                    <p className="text-sm text-gray-500">Manage limits for this vendor.</p>
                  </div>
                  <button onClick={exportCSV} className="px-3 py-1.5 rounded border text-sm flex items-center gap-2 hover:bg-gray-50">
                    <FiFileText /> Export CSV
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-gray-600 text-left">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Amount Limit</th>
                        <th className="p-2">Box Limit</th>
                        <th className="p-2">Month</th>
                        <th className="p-2">Note</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AddLimitRow vendor={activeVendor} onSave={(data) => handleSave(data, false)} saving={saving}/>
                      {loadingLimits ? (
                        <tr><td colSpan="6" className="p-4 text-center text-gray-500">Loading limits...</td></tr>
                      ) : limits.length === 0 ? (
                        <tr><td colSpan="6" className="p-4 text-center text-gray-500">No limits set for this vendor yet.</td></tr>
                      ) : (
                        limits.map(l => (
                          editingId === l.id ? (
                            // Edit Mode Row
                            <tr key={l.id} className="bg-yellow-50">
                               <td className="p-2 font-medium">{l.id}</td>
                               <td className="p-2"><input type="number" value={editForm.limit_amount} onChange={e => setEditForm({...editForm, limit_amount: e.target.value})} className="w-full border rounded px-2 py-1" /></td>
                               <td className="p-2"><input type="number" value={editForm.limit_boxes} onChange={e => setEditForm({...editForm, limit_boxes: e.target.value})} className="w-full border rounded px-2 py-1" /></td>
                               <td className="p-2">
                                  <select value={editForm.month} onChange={e => setEditForm({...editForm, month: e.target.value})} className="w-full border rounded px-2 py-1">
                                      <option value="ALL">All Months</option>
                                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                               </td>
                               <td className="p-2"><input type="text" value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} className="w-full border rounded px-2 py-1" /></td>
                               <td className="p-2 text-right flex gap-2 justify-end">
                                  <button onClick={() => handleSave(editForm, true)} disabled={saving} className="p-2 text-sm border rounded bg-green-600 text-white hover:bg-green-700"><FiCheck /></button>
                                  <button onClick={handleCancelEdit} className="p-2 text-sm border rounded hover:bg-gray-200"><FiX /></button>
                               </td>
                            </tr>
                          ) : (
                            // Display Mode Row
                            <tr key={l.id} className="border-t hover:bg-gray-50">
                              <td className="p-2 font-medium">{l.id}</td>
                              <td className="p-2">{l.limit_amount ?? "-"}</td>
                              <td className="p-2">{l.limit_boxes ?? "-"}</td>
                              <td className="p-2">{l.month}</td>
                              <td className="p-2">{l.note}</td>
                              <td className="p-2 text-right flex gap-2 justify-end">
                                <button onClick={() => handleStartEdit(l)} className="p-2 text-sm border rounded hover:bg-gray-200"><FiEdit2 /></button>
                                <button onClick={() => setDeleteTarget(l)} className="p-2 text-sm border rounded text-red-600 hover:bg-red-50"><FiTrash2 /></button>
                              </td>
                            </tr>
                          )
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Delete Modal (isko rehne denge kyunki delete ek destructive action hai) */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative z-10">
              <h3 className="text-lg font-semibold">Delete limit #{deleteTarget.id}?</h3>
              <p className="text-sm text-gray-500 mt-1">This action cannot be undone.</p>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={() => handleDelete(deleteTarget)} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}