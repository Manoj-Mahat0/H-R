// src/pages/driver/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import DriverSidebar from "../../components/DriverSidebar";
import { authFetch } from "../../lib/auth";
import { useToast } from "../../components/Toast";
import { FiRefreshCw, FiDownload, FiMapPin } from "react-icons/fi";

/*
Driver dashboard page
- tries authFetch("/driver/dashboard")
- fallback to demo data if endpoint not available
*/

function fmtNumber(v) {
  if (v == null || v === "") return "-";
  return Number(v).toLocaleString();
}
function fmtCurrency(v) {
  if (v == null || v === "") return "-";
  return `₹${Number(v).toLocaleString()}`;
}
function fmtDateShort(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")].concat(
    rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] == null ? "" : String(r[h]);
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DriverDashboard() {
  const toast = useToast();
  const mounted = useRef(true);

  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(null); // driver dashboard response or demo

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        // attempt to call backend dashboard endpoint
        const res = await authFetch("/driver/dashboard", { method: "GET", signal: controller.signal });
        // if the endpoint returns null/undefined, we'll fall back
        if (!mounted.current) return;
        if (!res) throw new Error("No dashboard data");
        setData(res);
      } catch (err) {
        // fallback to example demo data (so UI shows something)
        console.warn("driver/dashboard fetch failed — using demo data", err);
        if (!mounted.current) return;
        setData({
          kpis: {
            today_deliveries: 8,
            completed: 6,
            pending: 2,
            earnings_today: 840,
          },
          recent_deliveries: [
            { id: 123, order_id: "ORD123", customer: "Ramesh", address: "Zone A, Block 4", status: "delivered", eta: null, updated_at: "2025-09-22T08:10:00", amount: 120 },
            { id: 124, order_id: "ORD124", customer: "Sita", address: "Zone B, House 7", status: "on_the_way", eta: "2025-09-22T10:30:00", updated_at: "2025-09-22T09:12:00", amount: 70 },
            { id: 125, order_id: "ORD125", customer: "Amit", address: "Zone C, Shop 5", status: "pending", eta: "2025-09-22T12:00:00", updated_at: "2025-09-22T07:45:00", amount: 100 },
          ],
          activity: [
            { id: 1, text: "Started shift", ts: "2025-09-22T07:00:00" },
            { id: 2, text: "Picked up order ORD123", ts: "2025-09-22T08:00:00" },
            { id: 3, text: "Delivered ORD123", ts: "2025-09-22T08:10:00" },
          ],
          location: { lat: 23.0, lng: 86.0 },
        });
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

  const kpis = useMemo(() => (data?.kpis ? data.kpis : { today_deliveries: 0, completed: 0, pending: 0, earnings_today: 0 }), [data]);

  const deliveries = useMemo(() => (Array.isArray(data?.recent_deliveries) ? data.recent_deliveries : []), [data]);
  const activity = useMemo(() => (Array.isArray(data?.activity) ? data.activity : []), [data]);
  const location = data?.location ?? null;

  function exportDeliveries() {
    if (!deliveries || deliveries.length === 0) {
      toast("No deliveries to export", "error");
      return;
    }
    const rows = deliveries.map((d) => ({
      id: d.id,
      order_id: d.order_id,
      customer: d.customer,
      address: d.address,
      status: d.status,
      eta: d.eta,
      updated_at: d.updated_at,
      amount: d.amount,
    }));
    downloadCSV(`driver_deliveries_${new Date().toISOString()}.csv`, rows);
    toast("CSV exported", "success");
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <DriverSidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="flex items-start justify-between mb-6 gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Driver Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Overview of your deliveries, earnings and activity.</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setRefreshKey((k) => k + 1)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-gray-50">
              <FiRefreshCw className="w-4 h-4" /> Refresh
            </button>

            <button onClick={exportDeliveries} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border hover:bg-gray-50">
              <FiDownload className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="text-xs text-gray-500">Today's deliveries</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{fmtNumber(kpis.today_deliveries)}</div>
            <div className="text-xs text-gray-400 mt-1">Assigned for today</div>
          </div>

          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="text-xs text-gray-500">Completed</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{fmtNumber(kpis.completed)}</div>
            <div className="text-xs text-gray-400 mt-1">Delivered today</div>
          </div>

          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="text-xs text-gray-500">Pending</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{fmtNumber(kpis.pending)}</div>
            <div className="text-xs text-gray-400 mt-1">Yet to deliver</div>
          </div>

          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="text-xs text-gray-500">Earnings (today)</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{fmtCurrency(kpis.earnings_today)}</div>
            <div className="text-xs text-gray-400 mt-1">Collected / earned</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* deliveries table */}
          <div className="lg:col-span-2 bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Today's deliveries</h3>
              <div className="text-xs text-gray-500">{deliveries.length} items</div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">No deliveries found.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="px-3 py-2 text-left">Order</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Address</th>
                      <th className="px-3 py-2 text-left">ETA / Updated</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y">
                    {deliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-medium">#{d.order_id}</td>
                        <td className="px-3 py-3">{d.customer}</td>
                        <td className="px-3 py-3">{d.address}</td>
                        <td className="px-3 py-3">{d.eta ? d.eta : fmtDateShort(d.updated_at)}</td>
                        <td className="px-3 py-3 text-right">₹{d.amount ?? "-"}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            d.status === "delivered" ? "bg-green-50 text-green-700" :
                            d.status === "on_the_way" ? "bg-yellow-100 text-yellow-800" :
                            "bg-gray-50 text-gray-700"
                          }`}>{d.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* right column: map + activity */}
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <h3 className="text-lg font-medium mb-3">Live location</h3>

            <div className="w-full h-48 rounded border mb-3 bg-gray-100 flex items-center justify-center text-gray-500">
              <div className="flex flex-col items-center gap-2">
                <FiMapPin className="w-7 h-7 text-indigo-600" />
                <div className="text-sm">{location ? `Lat ${location.lat}, Lng ${location.lng}` : "Location not available"}</div>
                <div className="text-xs text-gray-400">Map integration placeholder — integrate Leaflet / Google Maps here</div>
              </div>
            </div>

            <h4 className="text-sm font-medium mb-2">Recent activity</h4>
            <div className="space-y-2 text-sm text-gray-700">
              {activity.length === 0 ? <div className="text-xs text-gray-400">No recent activity.</div> : activity.map((a) => (
                <div key={a.id} className="p-2 rounded border bg-white">
                  <div className="text-xs text-gray-500">{fmtDateShort(a.ts)}</div>
                  <div className="mt-1">{a.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
