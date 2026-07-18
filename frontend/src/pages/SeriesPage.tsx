import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Series, SubSeries } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast, ToastContainer } from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  IconPlus, IconLayers, IconEdit, IconTrash, IconX, IconFolder, IconChevronDown,
} from "../components/Icons";

const emptyForm = { code: "", name: "", description: "", material_type: "book" as const };

export default function SeriesPage() {
  const { isAdmin } = useAuth();
  const { toasts, showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [series, setSeries] = useState<Series[]>([]);
  const [subSeriesBySeries, setSubSeriesBySeries] = useState<Record<number, SubSeries[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Series | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [subForm, setSubForm] = useState<{ seriesId: number | null; name: string; editingId: number | null }>({
    seriesId: null, name: "", editingId: null,
  });
  const [subDeleteTarget, setSubDeleteTarget] = useState<SubSeries | null>(null);
  const [subDeleteError, setSubDeleteError] = useState("");

  function load() {
    setLoading(true);
    api.get("/series", { params: { include_inactive: true } })
      .then((res) => setSeries(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    if (searchParams.get("action") === "create") {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function loadSubSeries(seriesId: number) {
    api.get("/sub-series", { params: { series_id: seriesId, include_inactive: true } })
      .then((res) => setSubSeriesBySeries((prev) => ({ ...prev, [seriesId]: res.data })));
  }

  function toggleExpand(s: Series) {
    if (expanded === s.id) {
      setExpanded(null);
      return;
    }
    setExpanded(s.id);
    if (!subSeriesBySeries[s.id]) loadSubSeries(s.id);
  }

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
        showToast("Series updated", "success");
      } else {
        await api.post("/series", form);
        showToast("Series created", "success");
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      setError(
        detail ? String(detail)
        : status ? `Server error (${status}). Please try again.`
        : "Could not reach the server. Check your connection or that the backend is running."
      );
    }
  }

  function requestDelete(s: Series) {
    setDeleteError("");
    setDeleteTarget(s);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/series/${deleteTarget.id}`);
      showToast("Series deleted", "success");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setDeleteError(detail || "Could not delete series");
    }
  }

  async function forceDeleteSeries() {
    if (!deleteTarget) return;
    await api.delete(`/series/${deleteTarget.id}`, { params: { force: true } });
    showToast("Series and all its records deleted", "success");
    setDeleteTarget(null);
    load();
  }

  async function toggleActive(s: Series) {
    await api.put(`/series/${s.id}`, { is_active: !s.is_active });
    load();
  }

  // ---------- Sub-Series / Category handlers ----------
  function openAddSub(seriesId: number) {
    setSubForm({ seriesId, name: "", editingId: null });
  }

  function openEditSub(seriesId: number, sub: SubSeries) {
    setSubForm({ seriesId, name: sub.name, editingId: sub.id });
  }

  async function handleSubSubmit(e: React.FormEvent, seriesId: number) {
    e.preventDefault();
    if (!subForm.name.trim()) return;
    try {
      if (subForm.editingId) {
        await api.put(`/sub-series/${subForm.editingId}`, { name: subForm.name.trim() });
        showToast("Sub-Series updated", "success");
      } else {
        await api.post("/sub-series", { series_id: seriesId, name: subForm.name.trim() });
        showToast("Sub-Series added", "success");
      }
      setSubForm({ seriesId: null, name: "", editingId: null });
      loadSubSeries(seriesId);
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Could not save sub-series", "error");
    }
  }

  async function confirmSubDelete() {
    if (!subDeleteTarget) return;
    try {
      await api.delete(`/sub-series/${subDeleteTarget.id}`);
      showToast("Sub-Series deleted", "success");
      loadSubSeries(subDeleteTarget.series_id);
      setSubDeleteTarget(null);
      load();
    } catch (err: any) {
      setSubDeleteError(err?.response?.data?.detail || "Could not delete sub-series");
    }
  }

  async function forceSubDelete() {
    if (!subDeleteTarget) return;
    await api.delete(`/sub-series/${subDeleteTarget.id}`, { params: { force: true } });
    showToast("Sub-Series deleted (its books are now uncategorized)", "success");
    loadSubSeries(subDeleteTarget.series_id);
    setSubDeleteTarget(null);
    load();
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} />

      <div className="page-header">
        <div>
          <h2 className="page-title">Series Management</h2>
          <p className="page-subtitle">
            Main Series (A, B, C…) each hold their own Sub-Series / Categories (Kadambari, Kavana, Biography…).
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <IconPlus className="w-4 h-4" /> New Main Series
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3.5">
          {series.map((s) => (
            <div key={s.id} className={`card ${s.is_active ? "" : "opacity-60 border-red-200"}`}>
              <div className="card-pad">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="serial-chip text-sm">{s.code}</span>
                      <span className="badge-gray uppercase">
                        {s.material_type === "magazine" ? "Tarangano" : s.material_type}
                      </span>
                      {!s.is_active && <span className="badge-red">INACTIVE</span>}
                    </div>
                    <h3 className="font-bold text-stone-800 mt-1.5">{s.name}</h3>
                    {s.description && <p className="text-xs text-stone-500 mt-0.5">{s.description}</p>}
                    <p className="text-xs text-stone-400 mt-1.5">
                      {s.book_count} record(s) • {s.sub_series_count} sub-series • next serial: {s.next_serial}
                    </p>
                  </div>
                  <button onClick={() => toggleExpand(s)} className="icon-btn shrink-0">
                    <IconChevronDown className={`w-4 h-4 transition-transform ${expanded === s.id ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {isAdmin && (
                  <div className="flex gap-4 mt-3 text-xs">
                    <button onClick={() => openEdit(s)} className="text-brand-600 font-semibold flex items-center gap-1">
                      <IconEdit className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => toggleActive(s)} className="text-amber-600 font-semibold">
                      {s.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => requestDelete(s)} className="text-red-600 font-semibold flex items-center gap-1">
                      <IconTrash className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>

              {expanded === s.id && (
                <div className="border-t border-stone-100 px-4 sm:px-5 py-4 space-y-3 bg-stone-50/60 rounded-b-2xl animate-fade-in">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wide flex items-center gap-1.5">
                      <IconFolder className="w-3.5 h-3.5" /> Sub-Series / Categories
                    </p>
                    {isAdmin && subForm.seriesId !== s.id && (
                      <button onClick={() => openAddSub(s.id)} className="text-xs text-brand-600 font-semibold flex items-center gap-1">
                        <IconPlus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(subSeriesBySeries[s.id] || []).map((sub) => (
                      <div key={sub.id} className="group inline-flex items-center gap-1.5 badge-brand !text-xs !px-2.5 !py-1">
                        {subForm.editingId === sub.id ? (
                          <form onSubmit={(e) => handleSubSubmit(e, s.id)} className="flex items-center gap-1">
                            <input
                              autoFocus
                              className="border border-brand-300 rounded px-1.5 py-0.5 text-xs w-28"
                              value={subForm.name}
                              onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                              lang="kn"
                            />
                            <button type="submit" className="text-brand-700 font-bold">✓</button>
                            <button type="button" onClick={() => setSubForm({ seriesId: null, name: "", editingId: null })}>
                              <IconX className="w-3 h-3" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <span>{sub.name}</span>
                            <span className="text-brand-400">({sub.book_count})</span>
                            {isAdmin && (
                              <span className="hidden group-hover:inline-flex items-center gap-1 ml-0.5">
                                <button onClick={() => openEditSub(s.id, sub)} className="text-brand-500 hover:text-brand-800">
                                  <IconEdit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => { setSubDeleteError(""); setSubDeleteTarget(sub); }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <IconTrash className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {(subSeriesBySeries[s.id] || []).length === 0 && (
                      <p className="text-xs text-stone-400">No sub-series yet under {s.code}.</p>
                    )}
                  </div>

                  {isAdmin && subForm.seriesId === s.id && !subForm.editingId && (
                    <form onSubmit={(e) => handleSubSubmit(e, s.id)} className="flex gap-2 pt-1">
                      <input
                        autoFocus
                        className="input-field !py-1.5 !text-sm flex-1"
                        placeholder="e.g. Kadambari, Kavana, Biography"
                        value={subForm.name}
                        onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                        lang="kn"
                      />
                      <button type="submit" className="btn-primary btn-sm">Add</button>
                      <button
                        type="button"
                        onClick={() => setSubForm({ seriesId: null, name: "", editingId: null })}
                        className="btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
          {series.length === 0 && (
            <div className="empty-state col-span-full">
              <IconLayers className="w-8 h-8 text-stone-300" /> No series yet.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-800">{editing ? "Edit Main Series" : "New Main Series"}</h3>
              <button onClick={() => setShowForm(false)} className="icon-btn"><IconX className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="field-label">Series Code (e.g. A, B, G, J)</label>
                <input
                  className="input-field uppercase"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className="field-label">Series Name</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Kannada Story Books"
                  lang="kn"
                  required
                />
              </div>
              <div>
                <label className="field-label">Material Type</label>
                <select
                  className="select-field"
                  value={form.material_type}
                  onChange={(e) => setForm({ ...form, material_type: e.target.value as any })}
                >
                  <option value="book">Book</option>
                  <option value="magazine">Tarangano (Taranga Series)</option>
                  <option value="other">Other (future material)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Description (optional)</label>
                <textarea
                  className="textarea-field"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this Main Series?"
          message={
            deleteError
              ? deleteError
              : `"${deleteTarget.code} — ${deleteTarget.name}" will be permanently removed if it has no books.`
          }
          confirmLabel={deleteError?.includes("force=true") ? "Delete Everything" : deleteError ? "OK" : "Delete"}
          danger
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
          onConfirm={
            deleteError?.includes("force=true")
              ? forceDeleteSeries
              : deleteError
              ? () => { setDeleteTarget(null); setDeleteError(""); }
              : confirmDelete
          }
        />
      )}

      {subDeleteTarget && (
        <ConfirmDialog
          title="Delete this Sub-Series?"
          message={
            subDeleteError
              ? subDeleteError
              : `"${subDeleteTarget.name}" will be removed. Books using it can be reassigned afterwards.`
          }
          confirmLabel={subDeleteError?.includes("force=true") ? "Delete Anyway" : subDeleteError ? "OK" : "Delete"}
          danger
          onCancel={() => { setSubDeleteTarget(null); setSubDeleteError(""); }}
          onConfirm={
            subDeleteError?.includes("force=true")
              ? forceSubDelete
              : subDeleteError
              ? () => { setSubDeleteTarget(null); setSubDeleteError(""); }
              : confirmSubDelete
          }
        />
      )}
    </div>
  );
}
