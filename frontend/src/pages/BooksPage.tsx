import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Book, BookOrderBy, PaginatedBooks, Series, SubSeries } from "../types";
import { useAuth } from "../context/AuthContext";
import BookFormModal from "../components/BookFormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, ToastContainer } from "../components/Toast";
import OrderModeToggle from "../components/OrderModeToggle";
import { IconPlus, IconSearch, IconBook, IconEdit, IconTrash, IconChevronDown } from "../components/Icons";

export default function BooksPage() {
  const { isAdmin } = useAuth();
  const { toasts, showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<PaginatedBooks | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [subSeriesOptions, setSubSeriesOptions] = useState<SubSeries[]>([]);
  const [search, setSearch] = useState("");
  const [seriesFilter, setSeriesFilter] = useState<string>("");
  const [subSeriesFilter, setSubSeriesFilter] = useState<string>("");
  const [orderBy, setOrderBy] = useState<BookOrderBy>("series");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [formInitial, setFormInitial] = useState<any>(undefined);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    api.get("/series").then((res) => setSeries(res.data));
  }, []);

  useEffect(() => {
    if (!seriesFilter) { setSubSeriesOptions([]); setSubSeriesFilter(""); return; }
    api.get("/sub-series", { params: { series_id: seriesFilter } }).then((res) => setSubSeriesOptions(res.data));
  }, [seriesFilter]);

  // Quick Action from Dashboard / Category Finder: ?action=add opens the Add Book
  // form directly, optionally pre-filled with series_id, sub_series_id, title, author.
  useEffect(() => {
    if (isAdmin && searchParams.get("action") === "add") {
      setEditingBook(null);
      setFormInitial({
        series_id: searchParams.get("series_id") || undefined,
        sub_series_id: searchParams.get("sub_series_id") || undefined,
        title: searchParams.get("title") || undefined,
        author: searchParams.get("author") || undefined,
      });
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, isAdmin]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/books", {
        params: {
          search: search || undefined,
          series_id: seriesFilter || undefined,
          sub_series_id: subSeriesFilter || undefined,
          order_by: orderBy,
          page,
          page_size: 15,
        },
      })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [search, seriesFilter, subSeriesFilter, orderBy, page]);

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

      <div className="page-header">
        <div>
          <h2 className="page-title">Books</h2>
          <p className="page-subtitle">{data ? `${data.total} record${data.total === 1 ? "" : "s"}` : "Loading…"}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingBook(null); setFormInitial(undefined); setShowForm(true); }}
            className="btn-primary"
          >
            <IconPlus className="w-4 h-4" /> Add Book
          </button>
        )}
      </div>

      {/* Search & filter - inputs work natively with Gboard voice typing & handwriting */}
      <div className="card card-pad space-y-3">
        <div className="relative">
          <IconSearch className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-10"
            placeholder="Search by title, author, category, or serial (e.g. A-74)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            lang="kn"
            inputMode="search"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <select
            className="select-field"
            value={seriesFilter}
            onChange={(e) => { setSeriesFilter(e.target.value); setSubSeriesFilter(""); setPage(1); }}
          >
            <option value="">All Main Series</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
          <select
            className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
            value={subSeriesFilter}
            onChange={(e) => { setSubSeriesFilter(e.target.value); setPage(1); }}
            disabled={!seriesFilter}
          >
            <option value="">{seriesFilter ? "All Sub-Series" : "Select a Main Series first"}</option>
            {subSeriesOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-stone-500">
          {orderBy === "series"
            ? "Grouped by serial number (e.g. A-12, A-12(1), A-12(2), A-13)."
            : "Newest additions first — serial numbers are unchanged."}
        </p>
        <OrderModeToggle value={orderBy} onChange={(v) => { setOrderBy(v); setPage(1); }} />
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          <div className="space-y-2.5">
            {data?.items.map((book) => (
              <div key={book.id} className="card card-hover card-pad">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="serial-chip">{book.display_serial}</span>
                      <span className="badge-gray">{book.series_name}</span>
                      {book.sub_series_name && <span className="badge-accent">{book.sub_series_name}</span>}
                    </div>
                    <h3 className="font-semibold text-stone-900 mt-1.5 truncate">{book.title}</h3>
                    <p className="text-sm text-stone-500">{book.author}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {book.total_copies} cop{book.total_copies === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === book.id ? null : book.id)}
                    className="icon-btn shrink-0"
                  >
                    <IconChevronDown className={`w-4 h-4 transition-transform ${expanded === book.id ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {expanded === book.id && (
                  <div className="mt-3 border-t border-stone-100 pt-3 space-y-1.5 animate-fade-in">
                    {book.copies.map((c) => (
                      <div key={c.id} className="flex justify-between items-center text-xs bg-stone-50 rounded-lg px-2.5 py-1.5">
                        <span className="font-mono">{c.display_serial}</span>
                        <div className="flex items-center gap-2">
                          {orderBy === "latest" && c.created_at && (
                            <span className="text-[10px] text-stone-400">
                              Added {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          )}
                          <span className={
                            c.status === "available" ? "badge-green" :
                            c.status === "issued" ? "badge-amber" : "badge-red"
                          }>{c.status}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 pt-2 text-xs">
                      {isAdmin && (
                        <>
                          <button onClick={() => handleAddCopy(book)} className="text-brand-600 font-semibold flex items-center gap-1">
                            <IconPlus className="w-3.5 h-3.5" /> Add Copy
                          </button>
                          <button
                            onClick={() => { setEditingBook(book); setFormInitial(undefined); setShowForm(true); }}
                            className="text-stone-600 font-semibold flex items-center gap-1"
                          >
                            <IconEdit className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => requestDelete(book)} className="text-red-600 font-semibold flex items-center gap-1">
                            <IconTrash className="w-3.5 h-3.5" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {data?.items.length === 0 && (
              <div className="empty-state">
                <IconBook className="w-8 h-8 text-stone-300" />
                No books found. Try a different search, or add a new book.
              </div>
            )}
          </div>

          {data && data.total > data.page_size && (
            <div className="flex justify-center items-center gap-3 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary btn-sm disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-xs text-stone-500 font-medium">
                Page {data.page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <button
                disabled={page >= Math.ceil(data.total / data.page_size)}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary btn-sm disabled:opacity-40"
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
          initial={formInitial}
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
