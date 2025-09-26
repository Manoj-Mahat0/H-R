// src/pages/master-admin/Vehicles.jsx
import React, { useEffect, useRef, useState } from "react";
import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";
import { FiPlus, FiEdit3, FiTrash2, FiToggleLeft, FiToggleRight } from "react-icons/fi";

/**
 * MasterAdmin Vehicles page
 *
 * - Fetches: GET /api/vehicles/?me_only=true
 * - Create:   POST /api/vehicles/
 * - Update:   PATCH /api/vehicles/{id}
 * - Delete:   DELETE /api/vehicles/{id}
 *
 * Form fields:
 *  - driver_mobile (string)
 *  - vehicle_number (string)
 *  - lat (number)
 *  - lng (number)
 *  - capacity_weight (number | null)
 *  - capacity_unit (string) e.g. "kg"
 *  - details (string)
 *  - active (boolean)
 */

function fmtDate(ts) {
  if (!ts) return "-";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function emptyVehicle() {
  return {
    driver_mobile: "",
    vehicle_number: "",
    lat: "",
    lng: "",
    capacity_weight: "",
    capacity_unit: "kg",
    details: "",
    active: true,
  };
}

export default function MasterAdminVehicles() {
  const toast = useToast();
  const mounted = useRef(true);

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  // modal state
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null); // vehicle object when editing
  const [form, setForm] = useState(emptyVehicle());
  const [saving, setSaving] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    mounted.current = true;
    async function load() {
      setLoading(true);
      try {
        // me_only=true as you requested
        const data = await authFetch("/vehicles/?me_only=true", { method: "GET" });
        if (!mounted.current) return;
        setVehicles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("load vehicles", err);
        toast(err?.message || "Failed to load vehicles", "error");
      } finally {
        if (mounted.current) setLoading(false);
      }
    }
    load();
    return () => { mounted.current = false; };
  }, [fetchKey, toast]);

  function openAdd() {
    setEditing(null);
    setForm(emptyVehicle());
    setOpenForm(true);
  }

  function openEdit(v) {
    setEditing(v);
    setForm({
      driver_mobile: v.driver_mobile ?? "",
      vehicle_number: v.vehicle_number ?? "",
      lat: typeof v.lat !== "undefined" && v.lat !== null ? v.lat : "",
      lng: typeof v.lng !== "undefined" && v.lng !== null ? v.lng : "",
      capacity_weight: typeof v.capacity_weight !== "undefined" && v.capacity_weight !== null ? v.capacity_weight : "",
      capacity_unit: v.capacity_unit ?? "kg",
      details: v.details ?? "",
      active: !!v.active,
    });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditing(null);
    setForm(emptyVehicle());
  }

  function validateForm() {
    // minimal validation
    if (!form.vehicle_number || !form.vehicle_number.trim()) return "Vehicle number is required";
    if (!form.driver_mobile || !/^\d{6,15}$/.test(form.driver_mobile)) return "Driver mobile is required (6-15 digits)";
    // lat/lng optional but if provided must be numbers
    if (form.lat !== "" && Number.isNaN(Number(form.lat))) return "Latitude must be a number";
    if (form.lng !== "" && Number.isNaN(Number(form.lng))) return "Longitude must be a number";
    if (form.capacity_weight !== "" && Number.isNaN(Number(form.capacity_weight))) return "Capacity weight must be a number";
    return null;
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    const err = validateForm();
    if (err) return toast(err, "error");

    const payload = {
      driver_mobile: String(form.driver_mobile).trim(),
      vehicle_number: String(form.vehicle_number).trim(),
      lat: form.lat === "" ? null : Number(form.lat),
      lng: form.lng === "" ? null : Number(form.lng),
      capacity_weight: form.capacity_weight === "" ? null : Number(form.capacity_weight),
      capacity_unit: form.capacity_unit || "kg",
      details: form.details || "",
      active: !!form.active,
    };

    try {
      setSaving(true);
      if (editing) {
        await authFetch(`/vehicles/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast("Vehicle updated", "success");
      } else {
        await authFetch("/vehicles/", { method: "POST", body: JSON.stringify(payload) });
        toast("Vehicle added", "success");
      }
      // refresh
      setFetchKey((k) => k + 1);
      closeForm();
    } catch (err) {
      console.error("save vehicle", err);
      toast(err?.message || "Failed to save vehicle", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(v) {
    const payload = {
      driver_mobile: v.driver_mobile,
      vehicle_number: v.vehicle_number,
      lat: v.lat,
      lng: v.lng,
      details: v.details,
      capacity_weight: v.capacity_weight,
      capacity_unit: v.capacity_unit,
      active: !v.active,
    };
    try {
      await authFetch(`/vehicles/${v.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast(!v.active ? "Activated" : "Deactivated", "success");
      setFetchKey((k) => k + 1);
    } catch (err) {
      console.error("toggle active", err);
      toast(err?.message || "Failed to update vehicle", "error");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authFetch(`/vehicles/${deleteTarget.id}`, { method: "DELETE" });
      toast("Vehicle deleted", "success");
      setFetchKey((k) => k + 1);
      setDeleteTarget(null);
    } catch (err) {
      console.error("delete vehicle", err);
      toast(err?.message || "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <MasterAdminSidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Vehicles</h1>
            <p className="text-sm text-gray-500">Manage vehicles — add, edit, activate/deactivate or delete.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFetchKey((k) => k + 1)}
              className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
            >
              Refresh
            </button>

            
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              <div className="h-6 bg-gray-100 rounded animate-pulse" />
              <div className="h-6 bg-gray-100 rounded animate-pulse" />
              <div className="h-6 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Driver mobile</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Location (lat,lng)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Created</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-100">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">No vehicles yet.</td>
                  </tr>
                ) : vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-medium">{v.vehicle_number}</div>
                      <div className="text-xs text-gray-500">ID: {v.id} • {v.details || "-"}</div>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">{v.driver_mobile}</td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {v.capacity_weight ? `${v.capacity_weight} ${v.capacity_unit || "kg"}` : "-"}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {typeof v.lat !== "undefined" && v.lat !== null ? `${v.lat}, ${v.lng}` : "-"}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      <button
                        onClick={() => handleToggleActive(v)}
                        className="inline-flex items-center gap-2 px-2 py-1 rounded text-sm border"
                        title={v.active ? "Deactivate" : "Activate"}
                      >
                        {v.active ? <FiToggleRight className="w-5 h-5 text-green-600" /> : <FiToggleLeft className="w-5 h-5 text-gray-400" />}
                        <span className="text-xs">{v.active ? "Active" : "Inactive"}</span>
                      </button>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500">{fmtDate(v.created_at)}</td>

                    
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      
    </div>
  );
}
