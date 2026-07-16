import React, { useState } from "react";
import { api } from "../api/client";
import type { Book, Series } from "../types";

interface Props {
  series: Series[];
  editingBook: Book | null;
  onClose: () => void;
  onSaved: (message?: string) => void;
}

export default function BookFormModal({ series, editingBook, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    series_id: editingBook?.series_id?.toString() || (series[0]?.id.toString() ?? ""),
    title: editingBook?.title || "",
    author: editingBook?.author || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = { ...form, series_id: Number(form.series_id) };
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
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{editingBook ? "Edit Book" : "Add Book"}</h3>
          {!editingBook && (
            <p className="text-xs text-gray-500 mt-1">
              If this title and author already exist in the series, it's automatically added as another copy — no duplicate entries.
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Series</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              value={form.series_id}
              onChange={(e) => setForm({ ...form, series_id: e.target.value })}
              disabled={!!editingBook}
              required
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
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
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Author</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              lang="kn"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
