import React, { useEffect, useState } from "react";
import { api, downloadBlob } from "../api/client";
import type { BookOrderBy, Series } from "../types";
import { useAuth } from "../context/AuthContext";
import OrderModeToggle from "../components/OrderModeToggle";

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const [series, setSeries] = useState<Series[]>([]);
  const [seriesId, setSeriesId] = useState("");
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

  async function handleExport(format: "pdf" | "excel") {
    setGenerating(format);
    try {
      const res = await api.get(`/reports/books/${format}`, {
        params: { series_id: seriesId || undefined, author: authorFilter || undefined, order_by: orderBy },
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
      <h2 className="text-xl font-bold text-gray-900">Reports</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">Generate Printable Report</h3>
        <p className="text-xs text-gray-500">
          Includes Serial Number, Book Title, Author, and Category for the selected series (or all series).
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <select className="border border-gray-300 rounded-lg px-3 py-2.5" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
            <option value="">All Series</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <input
            className="border border-gray-300 rounded-lg px-3 py-2.5"
            placeholder="Filter by author (optional)"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            lang="kn"
          />
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div>
            <p className="text-xs font-medium text-gray-600">Row order</p>
            <p className="text-[11px] text-gray-400">
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
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-60"
          >
            {generating === "pdf" ? "Generating..." : "📄 Download PDF"}
          </button>
          <button
            onClick={() => handleExport("excel")}
            disabled={generating !== null}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-60"
          >
            {generating === "excel" ? "Generating..." : "📊 Download Excel"}
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Bulk Import from Excel</h3>
          <p className="text-xs text-gray-500">
            Upload an .xlsx file with columns: Title, Author, Language, Publisher, Year, ISBN, Notes.
            Duplicate title+author pairs are automatically added as additional copies.
          </p>
          <form onSubmit={handleImport} className="space-y-3">
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5" value={importSeriesId}
                    onChange={(e) => setImportSeriesId(e.target.value)} required>
              <option value="">Select target series...</option>
              {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
              required
            />
            <button type="submit" disabled={importing} className="w-full bg-brand-600 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-60">
              {importing ? "Importing..." : "Import"}
            </button>
          </form>
          {importResult && (
            <div className="text-xs bg-gray-50 rounded-lg p-3 space-y-1">
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
