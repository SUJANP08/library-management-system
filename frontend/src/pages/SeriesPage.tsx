import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Series } from "../types";
import { useAuth } from "../context/AuthContext";

const emptyForm = { code: "", name: "", description: "", material_type: "book" as const };

export default function SeriesPage() {
  const { isAdmin } = useAuth();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Series | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api.get("/series", { params: { include_inactive: true } })
      .then((res) => setSeries(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(s: Series) {
    setEditing(s);
    setForm({ code: s.code, name: s.name, description: s.description || "", material_type: s.material_type as any });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.put(`/series/${editing.id}`, form);
      } else {
        await api.post("/series", form);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not save series");
    }
  }

  async function handleDelete(s: Series) {
    if (!confirm(`Delete series "${s.code} — ${s.name}"? This cannot be undone if it has no books.`)) return;
    try {
      await api.delete(`/series/${s.id}`);
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.includes("force=true")) {
        if (confirm(`${detail}\n\nDelete permanently along with all its books/magazines?`)) {
          await api.delete(`/series/${s.id}`, { params: { force: true } });
          load();
        }
      } else {
        alert(detail || "Could not delete series");
      }
    }
  }

  async function toggleActive(s: Series) {
    await api.put(`/series/${s.id}`, { is_active: !s.is_active });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Series Management</h2>
        {isAdmin && (
          <button onClick={openCreate} className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + New Series
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Series define serial-number prefixes (e.g. A = Kannada Story Books, M = Tarangano). Add as many as needed — J, K, L, and beyond — without any code changes.
      </p>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {series.map((s) => (
            <div key={s.id} className={`bg-white rounded-xl shadow-sm border p-4 ${s.is_active ? "border-gray-100" : "border-red-200 opacity-60"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-sm">
                      {s.code}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                      {s.material_type === "magazine" ? "Tarangano" : s.material_type}
                    </span>
                    {!s.is_active && <span className="text-[10px] text-red-500 font-semibold">INACTIVE</span>}
                  </div>
                  <h3 className="font-semibold text-gray-800 mt-1">{s.name}</h3>
                  {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {s.book_count} record(s) • next serial: {s.next_serial}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-3 text-xs">
                  <button onClick={() => openEdit(s)} className="text-brand-600 font-medium">Edit</button>
                  <button onClick={() => toggleActive(s)} className="text-amber-600 font-medium">
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleDelete(s)} className="text-red-600 font-medium">Delete</button>
                </div>
              )}
            </div>
          ))}
          {series.length === 0 && <p className="text-sm text-gray-400">No series yet.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <h3 className="font-bold text-gray-800">{editing ? "Edit Series" : "New Series"}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Series Code (e.g. A, B, G, J)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 uppercase"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Series Name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Kannada Story Books"
                  lang="kn"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Material Type</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                  value={form.material_type}
                  onChange={(e) => setForm({ ...form, material_type: e.target.value as any })}
                >
                  <option value="book">Book</option>
                  <option value="magazine">Tarangano (Taranga Series)</option>
                  <option value="other">Other (future material)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-brand-600 text-white rounded-lg py-2.5 text-sm font-medium">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
