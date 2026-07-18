import React from "react";
import type { BookOrderBy } from "../types";

interface Props {
  value: BookOrderBy;
  onChange: (value: BookOrderBy) => void;
  className?: string;
}

/**
 * Lets the user switch between:
 *  - Series Order: grouped/sorted by serial number (A-12, A-12(2), A-13, ...)
 *  - Latest Added Order: newest-added books/copies first, serial numbers unchanged
 *
 * Used on the Books list, Reports (PDF/Excel export), and anywhere else that
 * displays a book listing, so librarians can tell logical series order apart
 * from what was most recently catalogued.
 */
export default function OrderModeToggle({ value, onChange, className = "" }: Props) {
  return (
    <div className={`inline-flex rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm ${className}`}>
      <button
        type="button"
        onClick={() => onChange("series")}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          value === "series" ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-50"
        }`}
      >
        Series Order
      </button>
      <button
        type="button"
        onClick={() => onChange("latest")}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          value === "latest" ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-50"
        }`}
      >
        Latest Added
      </button>
    </div>
  );
}
