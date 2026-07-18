import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Book, Series, SubSeries, CategorySuggestionResponse } from "../types";
import { IconWand, IconCheckCircle, IconX } from "./Icons";

interface Props {
  series: Series[];
  editingBook: Book | null;
  initial?: { series_id?: string; sub_series_id?: string; title?: string; author?: string };
  onClose: () => void;
  onSaved: (message?: string) => void;
}

const NEW_SUB_SERIES = "__new__";

export default function BookFormModal({ series, editingBook, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    series_id: editingBook?.series_id?.toString() || initial?.series_id || (series[0]?.id.toString() ?? ""),
    title: editingBook?.title || initial?.title || "",
    author: editingBook?.author || initial?.author || "",
  });
  const [subSeriesList, setSubSeriesList] = useState<SubSeries[]>([]);
  const [subSeriesId, setSubSeriesId] = useState<string>(
    editingBook?.sub_series_id?.toString() || initial?.sub_series_id || ""
  );
  const [newSubSeriesName, setNewSubSeriesName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [suggestion, setSuggestion] = useState<CategorySuggestionResponse | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!form.series_id) return;
    api.get("/sub-series", { params: { series_id: form.series_id } }).then((res) => setSubSeriesList(res.data));
  }, [form.series_id]);

  // If arriving from Category Finder with a sub_series_id, ensure it's selectable
  // even before the sub-series list for the (possibly just-switched) series loads.
  useEffect(() => {
    if (initial?.sub_series_id) setSubSeriesId(initial.sub_series_id);
  }, [initial?.sub_series_id]);

  const selectedSeries = useMemo(
    () => series.find((s) => s.id.toString() === form.series_id),
    [series, form.series_id]
  );

  async function handleSuggest() {
    if (!form.title.trim()) return;
    setSuggesting(true);
    setShowSuggestions(true);
    try {
      const res = await api.get("/category-finder/suggest", {
        params: { title: form.title, author: form.author || undefined },
      });
      setSuggestion(res.data);
    } finally {
      setSuggesting(false);
    }
  }

  function applySuggestion(seriesId: number, subSeriesIdVal?: number | null) {
    setForm((f) => ({ ...f, series_id: seriesId.toString() }));
    setSubSeriesId(subSeriesIdVal ? subSeriesIdVal.toString() : "");
    setShowSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload: any = { ...form, series_id: Number(form.series_id) };
    if (subSeriesId === NEW_SUB_SERIES) {
      if (newSubSeriesName.trim()) payload.sub_series_name = newSubSeriesName.trim();
    } else if (subSeriesId) {
      payload.sub_series_id = Number(subSeriesId);
    }

    try {
      if (editingBook) {
        await api.put(`/books/${editingBook.id}`, payload);
        onSaved("Book updated");
      } else {
        const res = await api.post("/books", payload);
        const book: Book = res.data;
        if (book.total_copies > 1) {
          onSaved(
            `"${book.title}" already existed — added as copy ${book.copies[book.copies.length - 1]?.display_serial}`
          );
        } else {
          onSaved(`Book added as ${book.display_serial}`);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not save book");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-stone-900 text-lg">{editingBook ? "Edit Book" : "Add Book"}</h3>
            {!editingBook && (
              <p className="text-xs text-stone-500 mt-1">
                If this title and author already exist in the series, it's automatically added as another copy — no duplicate entries.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="icon-btn shrink-0">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Title</label>
            <div className="flex gap-2">
              <input
                autoFocus
                className="input-field"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                lang="kn"
                required
              />
              <button
                type="button"
                onClick={handleSuggest}
                disabled={!form.title.trim() || suggesting}
                title="Suggest Main Series / Sub-Series based on existing library data"
                className="btn-accent px-3 shrink-0 disabled:opacity-40"
              >
                <IconWand className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Author</label>
            <input
              className="input-field"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              lang="kn"
              required
            />
          </div>

          {showSuggestions && (
            <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-3.5 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-accent-700 flex items-center gap-1.5">
                  <IconWand className="w-3.5 h-3.5" /> Category Finder
                </p>
                <button type="button" onClick={() => setShowSuggestions(false)} className="text-accent-500">
                  <IconX className="w-3.5 h-3.5" />
                </button>
              </div>
              {suggesting && <p className="text-xs text-stone-500">Analyzing existing library data…</p>}
              {!suggesting && suggestion?.exact_match && (
                <div className="text-xs bg-white rounded-lg p-2.5 space-y-1">
                  <p className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <IconCheckCircle className="w-3.5 h-3.5" /> Already catalogued as {suggestion.exact_match.display_serial}
                  </p>
                  <button
                    type="button"
                    className="badge-brand"
                    onClick={() => applySuggestion(suggestion.exact_match!.series_id, suggestion.exact_match!.sub_series_id)}
                  >
                    Use: {suggestion.exact_match.series_code}
                    {suggestion.exact_match.sub_series_name ? ` / ${suggestion.exact_match.sub_series_name}` : ""}
                  </button>
                </div>
              )}
              {!suggesting && !suggestion?.exact_match && suggestion?.recommend_new_category && (
                <p className="text-xs text-accent-700 bg-white rounded-lg p-2.5">
                  This doesn't closely match anything catalogued yet — consider creating a new Main Series or
                  Sub-Series for it instead of forcing an existing one.
                  {(suggestion?.suggestions.length ?? 0) === 0 ? "" : " Lower-confidence options below, just in case:"}
                </p>
              )}
              {!suggesting && !suggestion?.exact_match && (suggestion?.suggestions.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  {suggestion!.suggestions.slice(0, 3).map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => applySuggestion(s.series_id, s.sub_series_id)}
                      className="w-full text-left bg-white rounded-lg px-2.5 py-2 text-xs hover:bg-brand-50 transition-colors flex items-center justify-between gap-2"
                    >
                      <span>
                        <span className="font-semibold text-stone-800">{s.series_code} — {s.series_name}</span>
                        {s.sub_series_name && <span className="text-stone-500"> / {s.sub_series_name}</span>}
                      </span>
                      <span className="badge-accent shrink-0">{Math.round(s.confidence * 100)}%</span>
                    </button>
                  ))}
                </div>
              )}
              {!suggesting && !suggestion?.exact_match && !suggestion?.recommend_new_category
                && (suggestion?.suggestions.length ?? 0) === 0 && (
                <p className="text-xs text-stone-500">No strong match yet — choose a classification manually below.</p>
              )}
              {!suggesting && suggestion && !suggestion.exact_match && (
                <p className="text-[10px] text-accent-400">
                  {suggestion.ml_active
                    ? `ML model trained on ${suggestion.trained_on_books} catalogued book(s)`
                    : "Using title-similarity matching — ML activates once more books are catalogued"}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="field-label">Main Series</label>
            <select
              className="select-field"
              value={form.series_id}
              onChange={(e) => { setForm({ ...form, series_id: e.target.value }); setSubSeriesId(""); }}
              disabled={!!editingBook}
              required
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Sub-Series / Category</label>
            <select
              className="select-field"
              value={subSeriesId}
              onChange={(e) => setSubSeriesId(e.target.value)}
            >
              <option value="">— Uncategorized —</option>
              {subSeriesList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value={NEW_SUB_SERIES}>+ Add new sub-series…</option>
            </select>
            {subSeriesId === NEW_SUB_SERIES && (
              <input
                autoFocus
                className="input-field mt-2"
                placeholder={`New sub-series under ${selectedSeries?.code ?? ""}, e.g. Kadambari`}
                value={newSubSeriesName}
                onChange={(e) => setNewSubSeriesName(e.target.value)}
                lang="kn"
              />
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
