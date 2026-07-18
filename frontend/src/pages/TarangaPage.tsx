import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Magazine, Series } from "../types";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, ToastContainer } from "../components/Toast";
import { IconPlus, IconSearch, IconNewspaper, IconEdit, IconTrash, IconX } from "../components/Icons";

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

      <div className="page-header">
        <div>
          <h2 className="page-title">Taranga</h2>
          <p className="page-subtitle">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <IconPlus className="w-4 h-4" /> Add Taranga
        </button>
      </div>

      <div className="card card-pad">
        <div className="relative">
          <IconSearch className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-10"
            placeholder="Search Taranga title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            lang="kn"
          />
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((m) => (
            <div key={m.id} className="card card-hover card-pad">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <span className="serial-chip">{m.display_serial}</span>
                  <h3 className="font-semibold text-stone-900 mt-1.5 truncate">{m.title}</h3>
                  {m.month && <p className="text-sm text-stone-500">{m.month}</p>}
                </div>
                <div className="flex gap-3 text-xs shrink-0">
                  <button onClick={() => openEdit(m)} className="text-stone-600 font-semibold flex items-center gap-1">
                    <IconEdit className="w-3.5 h-3.5" /> Edit
                  </button>
                  {isAdmin && (
                    <button onClick={() => setDeleteTarget(m)} className="text-red-600 font-semibold flex items-center gap-1">
                      <IconTrash className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="empty-state">
              <IconNewspaper className="w-8 h-8 text-stone-300" />
              No Taranga entries yet. Tap "Add Taranga" to add one.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-panel p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-stone-900 text-lg">{editing ? "Edit Taranga" : "Add Taranga"}</h3>
                {!editing && (
                  <p className="text-xs text-stone-500 mt-1">
                    Just Title and Month — the serial number is assigned automatically.
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn shrink-0">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <div>
                  <label className="field-label">Series</label>
                  <select
                    className="select-field"
                    value={form.series_id}
                    onChange={(e) => setForm({ ...form, series_id: e.target.value })}
                    required
                  >
                    {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="field-label">Title</label>
                <input
                  autoFocus
                  className="input-field"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  lang="kn"
                  required
                />
              </div>
              <div>
                <label className="field-label">Month</label>
                <input
                  className="input-field"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                  placeholder="e.g. July 2026"
                  lang="kn"
                />
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
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
