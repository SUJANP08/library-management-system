import React, { useEffect, useState } from "react";
import { api, downloadBlob } from "../api/client";
import type { BookOrderBy, Series, SubSeries } from "../types";
import { useAuth } from "../context/AuthContext";
import OrderModeToggle from "../components/OrderModeToggle";
import { IconReport, IconDownload, IconUpload } from "../components/Icons";

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const [series, setSeries] = useState<Series[]>([]);
  const [subSeriesOptions, setSubSeriesOptions] = useState<SubSeries[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [subSeriesId, setSubSeriesId] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [orderBy, setOrderBy] = useState<BookOrderBy>("series");
  const [generating, setGenerating] = useState<"pdf" | "excel" | null>(null);

  const [importSeriesId, setImportSeriesId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get("/series").then((res) => setSeries(res.data));
  }, []);

  useEffect(() => {
    if (!seriesId) { setSubSeriesOptions([]); setSubSeriesId(""); return; }
    api.get("/sub-series", { params: { series_id: seriesId } }).then((res) => setSubSeriesOptions(res.data));
  }, [seriesId]);

  async function handleExport(format: "pdf" | "excel") {
    setGenerating(format);
    try {
      const res = await api.get(`/reports/books/${format}`, {
        params: {
          series_id: seriesId || undefined,
          sub_series_id: subSeriesId || undefined,
          author: authorFilter || undefined,
          order_by: orderBy,
        },
        responseType: "blob",
      });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const seriesLabel = series.find((s) => s.id.toString() === seriesId)?.code || "All";
      const orderSuffix = orderBy === "latest" ? "_LatestAdded" : "";
      downloadBlob(res.data, `Library_Report_${seriesLabel}${orderSuffix}.${ext}`);
    } finally {
      setGenerating(null);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !importSeriesId) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", importFile);
    try {
      const res = await api.post("/reports/import/excel", formData, {
        params: { series_id: importSeriesId },
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data);
    } catch (err: any) {
      setImportResult({ errors: [err?.response?.data?.detail || "Import failed"] });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <IconReport className="w-5 h-5" />
          </span>
          Reports
        </h2>
        <p className="page-subtitle">Export printable catalogues or bulk-import books from Excel.</p>
      </div>

      <div className="card card-pad space-y-4">
        <div>
          <h3 className="section-title">Generate Printable Report</h3>
          <p className="text-xs text-stone-500 mt-1">
            Includes Serial Number, Book Title, Author, Main Series, and Sub-Series / Category for the selected
            scope (or the entire library).
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <select className="select-field" value={seriesId} onChange={(e) => { setSeriesId(e.target.value); setSubSeriesId(""); }}>
            <option value="">All Main Series</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <select
            className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
            value={subSeriesId}
            onChange={(e) => setSubSeriesId(e.target.value)}
            disabled={!seriesId}
          >
            <option value="">{seriesId ? "All Sub-Series" : "Select a Main Series first"}</option>
            {subSeriesOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            className="input-field"
            placeholder="Filter by author (optional)"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            lang="kn"
          />
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div>
            <p className="text-xs font-semibold text-stone-600">Row order</p>
            <p className="text-[11px] text-stone-400">
              {orderBy === "series"
                ? "Grouped by serial number (e.g. A-12, A-12(2), A-13)."
                : "Newest copies first, so recently added books are easy to spot."}
            </p>
          </div>
          <OrderModeToggle value={orderBy} onChange={setOrderBy} />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleExport("pdf")}
            disabled={generating !== null}
            className="btn-danger flex-1"
          >
            <IconDownload className="w-4 h-4" /> {generating === "pdf" ? "Generating..." : "Download PDF"}
          </button>
          <button
            onClick={() => handleExport("excel")}
            disabled={generating !== null}
            className="btn flex-1 bg-emerald-600 text-white shadow-soft hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <IconDownload className="w-4 h-4" /> {generating === "excel" ? "Generating..." : "Download Excel"}
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="card card-pad space-y-4">
          <div>
            <h3 className="section-title">Bulk Import from Excel</h3>
            <p className="text-xs text-stone-500 mt-1">
              Upload an .xlsx file with columns: Title, Author, Language, Publisher, Year, ISBN, Notes,
              Sub Series (optional — matched or created automatically). Duplicate title+author pairs are
              automatically added as additional copies.
            </p>
          </div>
          <form onSubmit={handleImport} className="space-y-3">
            <select className="select-field" value={importSeriesId}
                    onChange={(e) => setImportSeriesId(e.target.value)} required>
              <option value="">Select target Main Series...</option>
              {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-semibold hover:file:bg-brand-100"
              required
            />
            <button type="submit" disabled={importing} className="btn-primary w-full">
              <IconUpload className="w-4 h-4" /> {importing ? "Importing..." : "Import"}
            </button>
          </form>
          {importResult && (
            <div className="text-xs bg-stone-50 rounded-lg p-3 space-y-1">
              {importResult.new_books_created !== undefined && (
                <>
                  <p>✅ New books created: {importResult.new_books_created}</p>
                  <p>➕ Additional copies added: {importResult.additional_copies_added}</p>
                </>
              )}
              {importResult.errors?.length > 0 && (
                <div className="text-red-600">
                  <p className="font-medium">Errors:</p>
                  {importResult.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
