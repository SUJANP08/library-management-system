import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Magazine, Series } from "../types";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, ToastContainer } from "../components/Toast";

const emptyForm = { series_id: "", title: "", month: "" };

export default function TarangaPage() {
  const { isAdmin } = useAuth();
  const { toasts, showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [entries, setEntries] = useState<Magazine[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Magazine | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Magazine | null>(null);

  useEffect(() => {
    api.get("/series").then((res) => {
      setSeries(res.data);
      if (res.data.length) setForm((f) => ({ ...f, series_id: res.data[0].id.toString() }));
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/magazines", { params: { search: search || undefined } })
      .then((res) => setEntries(res.data))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ series_id: series[0]?.id.toString() || "", title: "", month: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(m: Magazine) {
    setEditing(m);
    setForm({ series_id: m.series_id.toString(), title: m.title, month: m.month || "" });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/magazines/${editing.id}`, { title: form.title, month: form.month });
        showToast("Taranga updated", "success");
      } else {
        const res = await api.post("/magazines/quick-add", {
          series_id: Number(form.series_id),
          title: form.title,
          month: form.month || null,
        });
        showToast(`Taranga added as ${res.data.display_serial}`, "success");
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not save Taranga entry");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await api.delete(`/magazines/${deleteTarget.id}`);
    showToast(`"${deleteTarget.title}" deleted`, "success");
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Taranga</h2>
        <button onClick={openCreate} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          + Add Taranga
        </button>
      </div>

      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        placeholder="Search Taranga title"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        lang="kn"
      />

      {loading ? (
        <div className="text-center py-14 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((m) => (
            <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-xs">
                    {m.display_serial}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-1.5 truncate">{m.title}</h3>
                  {m.month && <p className="text-sm text-gray-500">{m.month}</p>}
                </div>
                <div className="flex gap-3 text-xs shrink-0">
                  <button onClick={() => openEdit(m)} className="text-gray-600 font-medium">Edit</button>
                  {isAdmin && (
                    <button onClick={() => setDeleteTarget(m)} className="text-red-600 font-medium">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-14">No Taranga entries yet. Tap "+ Add Taranga" to add one.</p>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{editing ? "Edit Taranga" : "Add Taranga"}</h3>
              {!editing && (
                <p className="text-xs text-gray-500 mt-1">
                  Just Title and Month — the serial number is assigned automatically.
                </p>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Series</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    value={form.series_id}
                    onChange={(e) => setForm({ ...form, series_id: e.target.value })}
                    required
                  >
                    {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Title</label>
                <input
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  lang="kn"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Month</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                  placeholder="e.g. July 2026"
                  lang="kn"
                />
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this Taranga entry?"
          message={`"${deleteTarget.title}" (${deleteTarget.display_serial}) will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
