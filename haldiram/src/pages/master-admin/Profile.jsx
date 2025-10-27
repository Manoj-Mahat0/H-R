import React, { useEffect, useState } from "react";
import AdminSidebar from "../../components/MasterAdminSidebar";
import { getToken } from "../../lib/auth";
import { API_HOST, API_URL } from "../../lib/config";
import { useToast } from "../../components/Toast";

const API_UPLOADS = API_HOST; // change if needed

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
    {/* overlay */}
    <div
      className="absolute inset-0 bg-black/50 dark:bg-black/70"
      onClick={onClose}
    />
    
    {/* modal box */}
    <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 z-10 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <button
          aria-label="Close modal"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✖️
        </button>
      </div>
      <div className="text-gray-700 dark:text-gray-200">{children}</div>
    </div>
  </div>
);

}

export default function MasterAdminProfilesTable() {
  const toast = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // profile selected for modal
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadProfiles() {
      setLoading(true);
      try {
        const token = getToken();
        const headers = token
          ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
          : { Accept: "application/json" };
        const res = await fetch(`${API_URL}/profile/all`, {
          method: "GET",
          headers,
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();
        if (mounted) setProfiles(data || []);
      } catch (err) {
        console.error(err);
        toast(err?.message || "Failed to load profiles", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProfiles();
    return () => (mounted = false);
  }, [toast]);

  function previewUrl(path) {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return `${API_UPLOADS}${path}`;
  }

  const filtered = profiles.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.id).includes(q) ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q)
    );
  });

  return (
  <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
    <AdminSidebar />

    <main className="flex-1 p-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">👥 All Profiles</h1>

          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, phone or id..."
              className="border rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring
                         bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
            />
            <button
              onClick={() => {
                setQuery("");
                toast("Cleared search", "info");
              }}
              className="text-sm px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100"
              title="Clear"
            >
              ✨ Clear
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-4 border-t-gray-700 dark:border-gray-600 dark:border-t-gray-300" />
            <span className="ml-3 text-sm text-gray-600 dark:text-gray-300">Loading profiles...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm table-auto">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Photo</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Address</th>
                  <th className="px-3 py-2 text-left">Aadhaar No.</th>
                  <th className="px-3 py-2 text-left">Aadhaar Front</th>
                  <th className="px-3 py-2 text-left">Aadhaar Back</th>
                  <th className="px-3 py-2 text-center">Updates</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-3 py-3 align-top text-gray-800 dark:text-gray-100">#{p.id}</td>

                    <td className="px-3 py-3 align-top">
                      {p.profile_pic ? (
                        <img
                          src={previewUrl(p.profile_pic)}
                          alt="profile"
                          className="w-12 h-12 object-cover rounded-full cursor-pointer"
                          onClick={() => setImagePreview(previewUrl(p.profile_pic))}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400">—</div>
                      )}
                    </td>

                    <td className="px-3 py-3 align-top text-gray-800 dark:text-gray-100">{p.name || "—"}</td>
                    <td className="px-3 py-3 align-top text-gray-700 dark:text-gray-200">{p.email || "—"}</td>
                    <td className="px-3 py-3 align-top text-gray-700 dark:text-gray-200">{p.phone || "—"}</td>
                    <td className="px-3 py-3 align-top text-gray-700 dark:text-gray-200">{p.role || "—"}</td>
                    <td className="px-3 py-3 align-top max-w-xs truncate text-gray-700 dark:text-gray-200">{p.address || "—"}</td>

                    {/* Aadhaar No. */}
                    <td className="px-3 py-3 align-top font-mono text-gray-700 dark:text-gray-200">{p.aadhaar_number || "—"}</td>

                    {/* Aadhaar Front */}
                    <td className="px-3 py-3 align-top">
                      {p.aadhaar_front ? (
                        <img
                          src={previewUrl(p.aadhaar_front)}
                          alt="aadhaar front"
                          className="w-16 h-10 object-contain border rounded cursor-pointer bg-white dark:bg-gray-900"
                          onClick={() => setImagePreview(previewUrl(p.aadhaar_front))}
                        />
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    {/* Aadhaar Back */}
                    <td className="px-3 py-3 align-top">
                      {p.aadhaar_back ? (
                        <img
                          src={previewUrl(p.aadhaar_back)}
                          alt="aadhaar back"
                          className="w-16 h-10 object-contain border rounded cursor-pointer bg-white dark:bg-gray-900"
                          onClick={() => setImagePreview(previewUrl(p.aadhaar_back))}
                        />
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    {/* Updates */}
                    <td className="px-3 py-3 align-top text-center text-gray-700 dark:text-gray-200">{p.profile_update_count ?? 0}</td>

                    {/* Actions */}
                    <td className="px-3 py-3 align-top text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelected(p)}
                          className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800 text-sm text-blue-700 dark:text-blue-200"
                          title="View details"
                        >
                          🔎 View
                        </button>

                        <a
                          href={previewUrl(p.profile_pic || p.aadhaar_front || p.aadhaar_back || "")}
                          target="_blank"
                          rel="noreferrer"
                          className={`px-2 py-1 rounded-md text-sm ${p.profile_pic || p.aadhaar_front || p.aadhaar_back ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-800' : 'opacity-50 cursor-not-allowed'}`}
                          onClick={(e) => { if (!(p.profile_pic || p.aadhaar_front || p.aadhaar_back)) e.preventDefault(); }}
                          title="Open first available image in new tab"
                        >
                          🖼️ Open
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-gray-400 dark:text-gray-500">
                      No profiles found — try a different search or refresh. ✨
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Profile — ${selected.name || selected.email}` : "Profile details"}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-start gap-6">
              <div>
                {selected.profile_pic ? (
                  <img src={previewUrl(selected.profile_pic)} alt="profile" className="w-28 h-28 object-cover rounded-full" />
                ) : (
                  <div className="w-28 h-28 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400">—</div>
                )}
              </div>

              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selected.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{selected.role}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{selected.email}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{selected.phone || "—"}</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Address</h4>
              <div className="text-sm text-gray-700 dark:text-gray-200">{selected.address || "—"}</div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Aadhaar</h4>
              <div className="space-y-2">
                <div className="font-mono text-sm text-gray-700 dark:text-gray-200">{selected.aadhaar_number || "—"}</div>
                <div className="flex gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100">Front</div>
                    {selected.aadhaar_front ? (
                      <img
                        src={previewUrl(selected.aadhaar_front)}
                        alt="front"
                        className="w-48 h-32 object-contain border rounded cursor-pointer bg-white dark:bg-gray-900"
                        onClick={() => setImagePreview(previewUrl(selected.aadhaar_front))}
                      />
                    ) : (
                      <div className="w-48 h-32 bg-gray-50 dark:bg-gray-700 border rounded flex items-center justify-center text-gray-300">No front</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100">Back</div>
                    {selected.aadhaar_back ? (
                      <img
                        src={previewUrl(selected.aadhaar_back)}
                        alt="back"
                        className="w-48 h-32 object-contain border rounded cursor-pointer bg-white dark:bg-gray-900"
                        onClick={() => setImagePreview(previewUrl(selected.aadhaar_back))}
                      />
                    ) : (
                      <div className="w-48 h-32 bg-gray-50 dark:bg-gray-700 border rounded flex items-center justify-center text-gray-300">No back</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Image preview modal */}
      <Modal open={!!imagePreview} onClose={() => setImagePreview(null)} title={imagePreview ? "Image preview" : ""}>
        {imagePreview && (
          <div className="w-full flex items-center justify-center">
            <img src={imagePreview} alt="preview" className="max-h-[70vh] object-contain rounded" />
          </div>
        )}
      </Modal>
    </main>
  </div>
);

}