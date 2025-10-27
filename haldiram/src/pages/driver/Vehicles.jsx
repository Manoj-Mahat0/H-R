// src/pages/driver/Vehicles.jsx
import React, { useEffect, useRef, useState } from "react";
import DriverSidebar from "../../components/DriverSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";
import { FiRefreshCw, FiPlus, FiCheckCircle, FiXCircle, FiEdit2, FiTrash2 } from "react-icons/fi";

function fmtDate(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function DriverVehicles() {
  const toast = useToast();
  const mounted = useRef(true);

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch (e) {
      // ignore
    }
  }, []);

  function toggleTheme() {
    try {
      const next = !document.documentElement.classList.contains("dark");
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch (e) {}
  }

  // add modal
  const [addModal, setAddModal] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  // add form
  const [driverMobile, setDriverMobile] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [details, setDetails] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [capacityWeight, setCapacityWeight] = useState("");
  const [capacityUnit, setCapacityUnit] = useState("kg");

  // edit modal
  const [editModal, setEditModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        // NOTE: request only current user's vehicles
        const res = await authFetch("/vehicles/?me_only=true", { method: "GET", signal: controller.signal });
        if (!mounted.current) return;
        setVehicles(Array.isArray(res) ? res : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load vehicles", err);
          toast(err?.message || "Failed to load vehicles", "error");
          setVehicles([]);
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    }

    load();
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [refreshKey, toast]);

  // add vehicle
  async function addVehicle(e) {
    e?.preventDefault();
    try {
      setSavingAdd(true);
      const payload = {
        driver_mobile: driverMobile,
        vehicle_number: vehicleNumber,
        details,
        lat: lat ? Number(lat) : 0,
        lng: lng ? Number(lng) : 0,
        capacity_weight: capacityWeight ? Number(capacityWeight) : null,
        capacity_unit: capacityUnit || "kg",
      };
      const res = await authFetch("/vehicles/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast(`Vehicle ${res.vehicle_number ?? res.vehicle_number} added`, "success");
      setAddModal(false);
      // reset add form
      setDriverMobile(""); setVehicleNumber(""); setDetails(""); setLat(""); setLng("");
      setCapacityWeight(""); setCapacityUnit("kg");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to add vehicle", err);
      toast(err?.message || "Failed to add vehicle", "error");
    } finally {
      setSavingAdd(false);
    }
  }

  // open edit modal with prefilled vehicle
  function openEdit(v) {
    setEditingVehicle({ ...v }); // clone
    setEditModal(true);
  }

  // submit edit (PATCH)
  async function saveEdit(e) {
    e?.preventDefault();
    if (!editingVehicle) return;
    try {
      setSavingEdit(true);
      const id = editingVehicle.id;
      const payload = {
        driver_mobile: editingVehicle.driver_mobile,
        vehicle_number: editingVehicle.vehicle_number,
        details: editingVehicle.details,
        lat: editingVehicle.lat !== undefined ? Number(editingVehicle.lat) : 0,
        lng: editingVehicle.lng !== undefined ? Number(editingVehicle.lng) : 0,
        capacity_weight: editingVehicle.capacity_weight !== undefined && editingVehicle.capacity_weight !== null
          ? Number(editingVehicle.capacity_weight)
          : null,
        capacity_unit: editingVehicle.capacity_unit || "kg",
        active: editingVehicle.active,
      };
      const res = await authFetch(`/vehicles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast(`Vehicle ${res.vehicle_number} updated`, "success");
      setEditModal(false);
      setEditingVehicle(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to update vehicle", err);
      toast(err?.message || "Failed to update vehicle", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  // toggle active (PATCH single field - include other required fields per API)
  async function toggleActive(v) {
    const id = v.id;
    const newActive = !v.active;
    try {
      // optimistic UI: update locally immediately
      setVehicles((prev) => prev.map((x) => (x.id === id ? { ...x, active: newActive } : x)));
      const payload = {
        driver_mobile: v.driver_mobile,
        vehicle_number: v.vehicle_number,
        lat: v.lat,
        lng: v.lng,
        details: v.details,
        capacity_weight: v.capacity_weight !== undefined ? v.capacity_weight : null,
        capacity_unit: v.capacity_unit || "kg",
        active: newActive,
      };
      await authFetch(`/vehicles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast(`${newActive ? "Activated" : "Deactivated"} vehicle ${v.vehicle_number}`, "success");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to toggle active", err);
      toast(err?.message || "Failed to change active state", "error");
      // revert UI on error
      setVehicles((prev) => prev.map((x) => (x.id === id ? { ...x, active: v.active } : x)));
    }
  }

  // delete vehicle (DELETE)
  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const id = deleteTarget.id;
      const res = await authFetch(`/vehicles/${id}`, { method: "DELETE" });
      // your API returns { status: "deactivated", vehicle_id }
      toast(res?.status === "deactivated" ? `Vehicle ${id} deactivated` : "Vehicle deleted", "success");
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to delete vehicle", err);
      toast(err?.message || "Failed to delete vehicle", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      <DriverSidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vehicles</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Manage and view your vehicles.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-100"
              title="Refresh"
            >
              <FiRefreshCw className="w-4 h-4" /> Refresh
            </button>

            <button
              onClick={() => setAddModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white"
            >
              <FiPlus className="w-4 h-4" /> Add Vehicle
            </button>

            <button
              onClick={() => toggleTheme()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-100"
              title="Toggle theme"
            >
              Theme
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 dark:bg-slate-700 animate-pulse rounded" />
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-300">No vehicles found.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-white dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Vehicle</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Driver mobile</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Details</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Capacity</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Location</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-300">Active</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300">Updated</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">#{v.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{v.vehicle_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{v.driver_mobile}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{v.details}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{v.capacity_weight ?? "-"} {v.capacity_unit ?? ""}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">Lat: {v.lat}, Lng: {v.lng}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleActive(v)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                            v.active ? "bg-green-50 text-green-700 dark:bg-green-800/20 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-800/20 dark:text-red-300"
                          }`}
                          title={v.active ? "Deactivate" : "Activate"}
                        >
                          {v.active ? <FiCheckCircle className="w-4 h-4" /> : <FiXCircle className="w-4 h-4" />}
                          <span className="sr-only">{v.active ? "Active" : "Inactive"}</span>
                          <span>{v.active ? "Active" : "Inactive"}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{fmtDate(v.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => openEdit(v)} className="px-2 py-1 rounded border text-sm inline-flex items-center gap-2 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100">
                            <FiEdit2 className="w-4 h-4" /> Edit
                          </button>
                          <button onClick={() => setDeleteTarget(v)} className="px-2 py-1 rounded border text-sm text-red-600 inline-flex items-center gap-2 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                            <FiTrash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddModal(false)} />
          <form onSubmit={addVehicle} className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-6 z-10 transition-colors">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Vehicle</h3>

            <div className="space-y-3 text-gray-800 dark:text-gray-200">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300">Driver Mobile</label>
                <input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" required />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300">Vehicle Number</label>
                <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" required />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300">Details</label>
                <input value={details} onChange={(e) => setDetails(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Latitude</label>
                  <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Longitude</label>
                  <input value={lng} onChange={(e) => setLng(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Capacity (weight)</label>
                  <input value={capacityWeight} onChange={(e) => setCapacityWeight(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" placeholder="e.g. 150" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Capacity unit</label>
                  <select value={capacityUnit} onChange={(e) => setCapacityUnit(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100">
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                    <option value="ltr">ltr</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setAddModal(false)} className="px-4 py-2 rounded border bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100">Cancel</button>
              <button type="submit" disabled={savingAdd} className="px-4 py-2 rounded bg-indigo-600 text-white">{savingAdd ? "Saving..." : "Add"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editModal && editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setEditModal(false); setEditingVehicle(null); }} />
          <form onSubmit={saveEdit} className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-6 z-10 transition-colors">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Vehicle #{editingVehicle.id}</h3>

            <div className="space-y-3 text-gray-800 dark:text-gray-200">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300">Driver Mobile</label>
                <input value={editingVehicle.driver_mobile} onChange={(e) => setEditingVehicle((s) => ({ ...s, driver_mobile: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" required />
              </div>

              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300">Vehicle Number</label>
                <input value={editingVehicle.vehicle_number} onChange={(e) => setEditingVehicle((s) => ({ ...s, vehicle_number: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" required />
              </div>

              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-300">Details</label>
                <input value={editingVehicle.details} onChange={(e) => setEditingVehicle((s) => ({ ...s, details: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Latitude</label>
                  <input value={editingVehicle.lat} onChange={(e) => setEditingVehicle((s) => ({ ...s, lat: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Longitude</label>
                  <input value={editingVehicle.lng} onChange={(e) => setEditingVehicle((s) => ({ ...s, lng: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Capacity (weight)</label>
                  <input
                    value={editingVehicle.capacity_weight ?? ""}
                    onChange={(e) => setEditingVehicle((s) => ({ ...s, capacity_weight: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g. 150"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300">Capacity unit</label>
                  <select value={editingVehicle.capacity_unit ?? "kg"} onChange={(e) => setEditingVehicle((s) => ({ ...s, capacity_unit: e.target.value }))} className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100">
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                    <option value="ltr">ltr</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <input type="checkbox" checked={!!editingVehicle.active} onChange={(e) => setEditingVehicle((s) => ({ ...s, active: !!e.target.checked }))} />
                  <span className="text-sm"> Active</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setEditModal(false); setEditingVehicle(null); }} className="px-4 py-2 rounded border bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100">Cancel</button>
              <button type="submit" disabled={savingEdit} className="px-4 py-2 rounded bg-indigo-600 text-white">{savingEdit ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6 z-10 transition-colors">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Delete vehicle #{deleteTarget.id}?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">This will deactivate or remove the vehicle. Are you sure?</p>

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded border bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="px-4 py-2 rounded bg-red-600 text-white">{deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
