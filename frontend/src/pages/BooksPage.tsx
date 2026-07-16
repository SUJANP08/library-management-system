import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Book, BookOrderBy, PaginatedBooks, Series } from "../types";
import { useAuth } from "../context/AuthContext";
import BookFormModal from "../components/BookFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, ToastContainer } from "../components/Toast";
import OrderModeToggle from "../components/OrderModeToggle";

export default function BooksPage() {
  const { isAdmin } = useAuth();
  const { toasts, showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<PaginatedBooks | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [search, setSearch] = useState("");
  const [seriesFilter, setSeriesFilter] = useState<string>("");
  const [orderBy, setOrderBy] = useState<BookOrderBy>("series");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    api.get("/series").then((res) => setSeries(res.data));
  }, []);

  // Quick Action from Dashboard: ?action=add opens the Add Book form directly
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setEditingBook(null);
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/books", {
        params: {
          search: search || undefined,
          series_id: seriesFilter || undefined,
          order_by: orderBy,
          page,
          page_size: 15,
        },
      })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [search, seriesFilter, orderBy, page]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce typing/voice input
    return () => clearTimeout(t);
  }, [load]);

  function requestDelete(book: Book) {
    setDeleteError("");
    setDeleteTarget(book);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/books/${deleteTarget.id}`);
      setDeleteTarget(null);
      showToast(`"${deleteTarget.title}" deleted`, "success");
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Could not delete this book";
      setDeleteError(detail);
    }
  }

  async function handleAddCopy(book: Book) {
    await api.post("/books/add-copy", { book_id: book.id });
    showToast("Copy added", "success");
    load();
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Books</h2>
        <button
          onClick={() => { setEditingBook(null); setShowForm(true); }}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
        >
          + Add Book
        </button>
      </div>

      {/* Search & filter - inputs work natively with Gboard voice typing & handwriting */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          placeholder="Search by title, author, or serial (e.g. A-74)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          lang="kn"
          inputMode="search"
        />
        <select
          className="border border-gray-200 rounded-lg px-3 py-2.5 bg-white shadow-sm sm:w-56 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          value={seriesFilter}
          onChange={(e) => { setSeriesFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Series</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          {orderBy === "series"
            ? "Grouped by serial number (e.g. A-12, A-12(2), A-13)."
            : "Newest additions first — serial numbers are unchanged."}
        </p>
        <OrderModeToggle value={orderBy} onChange={(v) => { setOrderBy(v); setPage(1); }} />
      </div>

      {loading ? (
        <div className="text-center py-14 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          <div className="space-y-2.5">
            {data?.items.map((book) => (
              <div key={book.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-xs">
                        {book.display_serial}
                      </span>
                      <span className="text-[10px] text-gray-400">{book.series_name}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-1.5 truncate">{book.title}</h3>
                    <p className="text-sm text-gray-500">{book.author}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {book.total_copies} cop{book.total_copies === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === book.id ? null : book.id)}
                    className="text-brand-600 text-xs font-medium shrink-0"
                  >
                    {expanded === book.id ? "Hide" : "Details"}
                  </button>
                </div>

                {expanded === book.id && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
                    {book.copies.map((c) => (
                      <div key={c.id} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="font-mono">{c.display_serial}</span>
                        <div className="flex items-center gap-2">
                          {orderBy === "latest" && c.created_at && (
                            <span className="text-[10px] text-gray-400">
                              Added {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            c.status === "available" ? "bg-green-100 text-green-700" :
                            c.status === "issued" ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>{c.status}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 pt-2 text-xs">
                      <button onClick={() => handleAddCopy(book)} className="text-brand-600 font-medium">
                        + Add Copy
                      </button>
                      <button onClick={() => { setEditingBook(book); setShowForm(true); }} className="text-gray-600 font-medium">
                        Edit
                      </button>
                      {isAdmin && (
                        <button onClick={() => requestDelete(book)} className="text-red-600 font-medium">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {data?.items.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-14">No books found. Try a different search, or add a new book.</p>
            )}
          </div>

          {data && data.total > data.page_size && (
            <div className="flex justify-center items-center gap-3 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-xs text-gray-500">
                Page {data.page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <button
                disabled={page >= Math.ceil(data.total / data.page_size)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <BookFormModal
          series={series}
          editingBook={editingBook}
          onClose={() => setShowForm(false)}
          onSaved={(message) => { setShowForm(false); load(); if (message) showToast(message, "success"); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this book?"
          message={
            deleteError
              ? deleteError
              : `"${deleteTarget.title}" (${deleteTarget.display_serial}) and all its copies will be permanently removed.`
          }
          confirmLabel={deleteError ? "OK" : "Delete"}
          danger
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
          onConfirm={deleteError ? () => { setDeleteTarget(null); setDeleteError(""); } : confirmDelete}
        />
      )}
    </div>
  );
}
