import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Book, Series, SubSeries } from "../types";
import { IconX } from "./Icons";

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

  useEffect(() => {
    if (!form.series_id) return;
    api.get("/sub-series", { params: { series_id: form.series_id } }).then((res) => setSubSeriesList(res.data));
  }, [form.series_id]);

  // If arriving with a pre-filled sub_series_id (e.g. a Quick Action deep
  // link), ensure it's selectable even before the sub-series list for the
  // (possibly just-switched) series loads.
  useEffect(() => {
    if (initial?.sub_series_id) setSubSeriesId(initial.sub_series_id);
  }, [initial?.sub_series_id]);

  const selectedSeries = useMemo(
    () => series.find((s) => s.id.toString() === form.series_id),
    [series, form.series_id]
  );

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
            <label className="field-label">Author</label>
            <input
              className="input-field"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              lang="kn"
              required
            />
          </div>

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
