import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CategorySuggestionResponse, ExactMatch, CategorySuggestion, ModelStatus } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast, ToastContainer } from "../components/Toast";
import {
  IconWand, IconSearch, IconCheckCircle, IconInfo, IconArrowRight, IconSparkle, IconLayers,
} from "../components/Icons";

export default function CategoryFinderPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toasts, showToast } = useToast();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [result, setResult] = useState<CategorySuggestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [retraining, setRetraining] = useState(false);

  function loadStatus() {
    api.get("/category-finder/status").then((res) => setModelStatus(res.data)).catch(() => {});
  }
  useEffect(loadStatus, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get("/category-finder/suggest", { params: { title, author: author || undefined } });
      setResult(res.data);
    } catch (err: any) {
      setResult(null);
      showToast(err?.response?.data?.detail || "Could not find a category — please try again", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRetrain() {
    setRetraining(true);
    try {
      const res = await api.post("/category-finder/retrain");
      setModelStatus(res.data);
      showToast("Model retrained on the latest catalog", "success");
      if (searched && title.trim()) handleSearch({ preventDefault() {} } as React.FormEvent);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Could not retrain model", "error");
    } finally {
      setRetraining(false);
    }
  }

  function useClassification(seriesId: number, subSeriesId?: number | null) {
    const params = new URLSearchParams({ action: "add", series_id: String(seriesId), title, author });
    if (subSeriesId) params.set("sub_series_id", String(subSeriesId));
    navigate(`/books?${params.toString()}`);
  }

  function createNewSeries() {
    navigate("/series?action=create");
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} />

      <div className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center">
              <IconWand className="w-5 h-5" />
            </span>
            Category Finder
          </h2>
          <p className="page-subtitle">
            Book Classification Assistant — enter a title (and author) to find or predict the right Main Series / Sub-Series.
          </p>
        </div>
      </div>

      {modelStatus && (
        <div className="card card-pad flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${modelStatus.active ? "bg-emerald-500" : "bg-stone-300"}`} />
            <div>
              <p className="text-sm font-semibold text-stone-800">
                {modelStatus.active ? "ML model active" : "ML model not active yet"}
              </p>
              <p className="text-xs text-stone-500">
                {modelStatus.active
                  ? `Trained on ${modelStatus.trained_on_books} of ${modelStatus.total_books} catalogued book(s) across ${modelStatus.classes} categories. Predictions improve as you catalogue more books.`
                  : `Catalogue at least ${modelStatus.min_books_required} books across 2+ categories to activate ML predictions. Currently ${modelStatus.total_books} book(s) catalogued — using title-similarity matching for now.`}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button onClick={handleRetrain} disabled={retraining} className="btn-secondary btn-sm shrink-0">
              {retraining ? "Retraining..." : "Retrain Model"}
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSearch} className="card card-pad space-y-3.5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <div>
            <label className="field-label">Book Title</label>
            <input
              autoFocus
              className="input-field"
              placeholder="e.g. Malgudi Days"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              lang="kn"
              required
            />
          </div>
          <div>
            <label className="field-label">Author (optional)</label>
            <input
              className="input-field"
              placeholder="e.g. R. K. Narayan"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              lang="kn"
            />
          </div>
        </div>
        <button type="submit" disabled={loading || !title.trim()} className="btn-accent w-full sm:w-auto">
          <IconSearch className="w-4 h-4" />
          {loading ? "Searching..." : "Find Category"}
        </button>
      </form>

      {loading && <div className="empty-state">Analyzing existing library data…</div>}

      {!loading && searched && result && (
        <div className="space-y-4 animate-fade-in">
          {result.exact_match ? (
            <ExactMatchCard match={result.exact_match} />
          ) : (
            <>
              {result.recommend_new_category ? (
                <div className="card card-pad bg-accent-50/60 border-accent-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <IconSparkle className="w-5 h-5 text-accent-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-accent-900">
                      This title doesn't closely match anything already catalogued
                      {result.suggestions.length > 0 ? " with strong confidence" : ""}. It's likely a good candidate
                      for a <strong>new Main Series or Sub-Series</strong> rather than forcing it into an existing one.
                    </p>
                  </div>
                  <button onClick={createNewSeries} className="btn-accent btn-sm">
                    <IconLayers className="w-3.5 h-3.5" /> Create a New Main Series
                  </button>
                </div>
              ) : (
                <div className="card card-pad bg-brand-50/60 border-brand-100 flex items-start gap-3">
                  <IconInfo className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-brand-800">
                    No exact match found in the library yet.{" "}
                    {result.ml_active
                      ? "Based on the ML model trained on your catalog, here are the best classification suggestions —"
                      : "Based on similar existing titles, here are the best classification suggestions —"}{" "}
                    you can always pick a different one manually when adding the book.
                  </p>
                </div>
              )}

              {result.suggestions.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="section-title">Suggested Classifications</h3>
                  {result.suggestions.map((s, i) => (
                    <SuggestionCard key={i} s={s} onUse={() => useClassification(s.series_id, s.sub_series_id)} />
                  ))}
                </div>
              )}

              {result.suggestions.length === 0 && !result.recommend_new_category && (
                <div className="empty-state">
                  <IconSparkle className="w-8 h-8 text-stone-300" />
                  No strong matches found in existing data yet. Please classify this book manually on the Add Book screen.
                </div>
              )}

              {result.similar_titles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="section-title">Similar Existing Titles</h3>
                  <div className="card divide-y divide-stone-100">
                    {result.similar_titles.map((m) => (
                      <div key={m.book_id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-800 truncate">{m.title}</p>
                          <p className="text-xs text-stone-500">{m.author}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="serial-chip">{m.display_serial}</span>
                          <span className="badge-gray">{m.series_code}{m.sub_series_name ? ` / ${m.sub_series_name}` : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="text-center pt-1">
            <button
              onClick={() => navigate(`/books?action=add&title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`)}
              className="text-sm text-brand-600 font-medium hover:underline"
            >
              Or classify manually on the Add Book screen →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExactMatchCard({ match }: { match: ExactMatch }) {
  return (
    <div className="card card-pad border-emerald-200 bg-emerald-50/50 space-y-2 animate-fade-in">
      <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
        <IconCheckCircle className="w-5 h-5" />
        Already catalogued — here's its current classification
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="serial-chip">{match.display_serial}</span>
        <span className="font-semibold text-stone-800">{match.title}</span>
        <span className="text-stone-500 text-sm">by {match.author}</span>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <span className="badge-brand">Main Series: {match.series_code} — {match.series_name}</span>
        {match.sub_series_name && <span className="badge-accent">Sub-Series: {match.sub_series_name}</span>}
      </div>
    </div>
  );
}

function SuggestionCard({ s, onUse }: { s: CategorySuggestion; onUse: () => void }) {
  const pct = Math.round(s.confidence * 100);
  return (
    <div className="card card-pad card-hover space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="badge-brand">{s.series_code} — {s.series_name}</span>
            {s.sub_series_name && <span className="badge-accent">{s.sub_series_name}</span>}
          </div>
          <p className="text-xs text-stone-500 mt-2">{s.reason}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-brand-700">{pct}%</div>
          <div className="text-[10px] text-stone-400 uppercase tracking-wide">confidence</div>
        </div>
      </div>
      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <button onClick={onUse} className="btn-secondary btn-sm w-full sm:w-auto">
        Use this classification <IconArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
