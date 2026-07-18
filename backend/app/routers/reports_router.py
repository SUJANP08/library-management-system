import io
import re
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
import openpyxl

from app.database import get_db
from app import models, schemas, auth, crud
from app.utils.pdf_generator import generate_books_pdf
from app.utils.excel_generator import generate_books_excel

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _collect_rows(db: Session, series_id: Optional[int], series_code: Optional[str],
                   sub_series_id: Optional[int],
                   author: Optional[str], search: Optional[str],
                   order_by: str = "series") -> tuple[list[dict], str]:
    q = db.query(models.Book).options(
        joinedload(models.Book.series), joinedload(models.Book.sub_series), joinedload(models.Book.copies)
    )
    report_title = "Library Report - All Series"

    if series_id:
        q = q.filter(models.Book.series_id == series_id)
        series = db.query(models.Series).filter(models.Series.id == series_id).first()
        if series:
            report_title = f"Library Report - {series.code} ({series.name})"
    if series_code:
        q = q.join(models.Series).filter(models.Series.code == series_code.upper())
        report_title = f"Library Report - {series_code.upper()}"
    if sub_series_id:
        q = q.filter(models.Book.sub_series_id == sub_series_id)
        sub = db.query(models.SubSeries).filter(models.SubSeries.id == sub_series_id).first()
        if sub:
            report_title += f" / {sub.name}"
    if author:
        q = q.filter(models.Book.author.ilike(f"%{author}%"))
    if search:
        like = f"%{search}%"
        q = q.filter((models.Book.title.ilike(like)) | (models.Book.author.ilike(like)))

    books = q.all()

    # One row per physical copy. In Series Order, each book's copies stay
    # grouped under its serial number (A-12, A-12(2), A-13, ...). In Latest
    # Added Order, rows are sorted purely by when each copy was added,
    # newest first - so a freshly added copy of an older book (e.g. a new
    # A-12(2)) rises to the top instead of being buried right after A-12,
    # without ever changing the serial numbering scheme.
    rows = []
    for b in books:
        for c in b.copies:
            rows.append({
                "serial": crud.display_serial_for_book(b, c.copy_number),
                "title": b.title,
                "author": b.author,
                "category": b.series.name,
                "sub_category": b.sub_series.name if b.sub_series else "—",
                "_series_key": (b.series_id, b.base_serial, c.copy_number),
                "_latest_key": c.created_at or b.created_at,
            })

    if order_by == "latest":
        rows.sort(key=lambda r: r["_latest_key"], reverse=True)
    else:
        rows.sort(key=lambda r: r["_series_key"])

    for r in rows:
        r.pop("_series_key", None)
        r.pop("_latest_key", None)

    return rows, report_title


ORDER_LABELS = {"series": "Series Order", "latest": "Latest Added Order"}


def _content_disposition(filename: str) -> str:
    """
    Build a Content-Disposition header that survives non-ASCII (e.g. Kannada)
    report titles. HTTP header values must be Latin-1 encodable, so a filename
    containing Kannada characters raised a UnicodeEncodeError and crashed the
    download (both PDF and Excel) before any bytes were sent. We now send an
    ASCII-safe fallback name plus the proper RFC 5987/6266 filename* parameter
    with the real Unicode name, so browsers save the file with the correct
    (Kannada) name while older clients still get a sane ASCII fallback.
    """
    ascii_fallback = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("_") or "report"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


@router.get("/books/pdf")
def export_books_pdf(
    series_id: Optional[int] = None, series_code: Optional[str] = None,
    sub_series_id: Optional[int] = None,
    author: Optional[str] = None, search: Optional[str] = None,
    order_by: str = Query(
        "series", pattern="^(series|latest)$",
        description="'series' groups by serial number; 'latest' shows newest-added copies first.",
    ),
    db: Session = Depends(get_db), _user: models.User = Depends(auth.get_current_user),
):
    rows, title = _collect_rows(db, series_id, series_code, sub_series_id, author, search, order_by)
    pdf_bytes = generate_books_pdf(rows, title, order_label=ORDER_LABELS[order_by])
    filename = title.replace(" ", "_").replace("(", "").replace(")", "") + ".pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": _content_disposition(filename)},
    )


@router.get("/books/excel")
def export_books_excel(
    series_id: Optional[int] = None, series_code: Optional[str] = None,
    sub_series_id: Optional[int] = None,
    author: Optional[str] = None, search: Optional[str] = None,
    order_by: str = Query(
        "series", pattern="^(series|latest)$",
        description="'series' groups by serial number; 'latest' shows newest-added copies first.",
    ),
    db: Session = Depends(get_db), _user: models.User = Depends(auth.get_current_user),
):
    rows, title = _collect_rows(db, series_id, series_code, sub_series_id, author, search, order_by)
    xlsx_bytes = generate_books_excel(rows, title, order_label=ORDER_LABELS[order_by])
    filename = title.replace(" ", "_").replace("(", "").replace(")", "") + ".xlsx"
    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": _content_disposition(filename)},
    )


@router.post("/import/excel")
async def import_books_excel(
    series_id: int = Query(..., description="Series to import these rows into"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    """
    Bulk import books from an Excel file into the given series.
    Expected columns (header row, any order): Title, Author, Language, Publisher, Year, ISBN, Notes, Sub Series (optional)
    Duplicate (title, author) pairs are automatically added as additional copies.
    """
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read Excel file. Please upload a valid .xlsx file.")

    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    header = [str(h).strip().lower() if h else "" for h in next(rows_iter)]

    def col(name):
        return header.index(name) if name in header else None

    idx_title, idx_author = col("title"), col("author")
    idx_lang, idx_pub, idx_year, idx_isbn, idx_notes = (
        col("language"), col("publisher"), col("year"), col("isbn"), col("notes"))
    idx_subseries = col("sub series") if col("sub series") is not None else (
        col("sub-series") if col("sub-series") is not None else col("category"))

    if idx_title is None or idx_author is None:
        raise HTTPException(status_code=400, detail="Excel file must have 'Title' and 'Author' columns")

    created, copies_added, errors = 0, 0, []
    for row_num, row in enumerate(rows_iter, start=2):
        if not row or not row[idx_title]:
            continue
        try:
            payload = schemas.BookCreate(
                series_id=series_id,
                sub_series_name=str(row[idx_subseries]).strip() if idx_subseries is not None and row[idx_subseries] else None,
                title=str(row[idx_title]).strip(),
                author=str(row[idx_author]).strip() if idx_author is not None and row[idx_author] else "Unknown",
                language=str(row[idx_lang]).strip() if idx_lang is not None and row[idx_lang] else None,
                publisher=str(row[idx_pub]).strip() if idx_pub is not None and row[idx_pub] else None,
                year_published=int(row[idx_year]) if idx_year is not None and row[idx_year] else None,
                isbn=str(row[idx_isbn]).strip() if idx_isbn is not None and row[idx_isbn] else None,
                notes=str(row[idx_notes]).strip() if idx_notes is not None and row[idx_notes] else None,
            )
            _, was_new = crud.create_book_or_add_copy(db, payload)
            created += 1 if was_new else 0
            copies_added += 0 if was_new else 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    return {
        "new_books_created": created,
        "additional_copies_added": copies_added,
        "errors": errors,
    }
