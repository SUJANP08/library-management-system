"""
Core business logic that isn't just simple CRUD passthrough:
- Auto-generating the next serial number within a series.
- Detecting existing (title, author) within a series and adding a new
  copy (A-74(2), A-74(3)...) instead of a duplicate base record.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app import models, schemas


def normalize(text: str) -> str:
    """Normalize for duplicate comparison: trim + lowercase + collapse spaces.
    Works fine with Unicode/Kannada text since Python str.lower() is Unicode-aware."""
    return " ".join((text or "").strip().lower().split())


def display_serial_for_book(book: models.Book, copy_number: int = 1) -> str:
    base = f"{book.series.code}-{book.base_serial}"
    if copy_number > 1:
        return f"{base}({copy_number})"
    return base


def find_existing_book(db: Session, series_id: int, title: str, author: str):
    """Find a book with the same title+author (case/whitespace-insensitive)
    already registered in this series."""
    candidates = db.query(models.Book).filter(models.Book.series_id == series_id).all()
    norm_title, norm_author = normalize(title), normalize(author)
    for b in candidates:
        if normalize(b.title) == norm_title and normalize(b.author) == norm_author:
            return b
    return None


def create_book_or_add_copy(db: Session, payload: schemas.BookCreate) -> tuple[models.Book, bool]:
    """
    Adds a new book. If a book with the same title+author already exists in
    the chosen series, this instead adds a new copy to that existing book
    (A-74(2), A-74(3), ...) and returns (book, False).
    Otherwise creates a brand-new book with the series' next serial number
    and returns (book, True).
    """
    series = db.query(models.Series).filter(models.Series.id == payload.series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    if not series.is_active:
        raise HTTPException(status_code=400, detail="Series is inactive")

    existing = find_existing_book(db, payload.series_id, payload.title, payload.author)

    if existing:
        next_copy_number = (max([c.copy_number for c in existing.copies], default=0)) + 1
        copy = models.BookCopy(book_id=existing.id, copy_number=next_copy_number)
        db.add(copy)
        db.commit()
        db.refresh(existing)
        return existing, False

    # Brand new title -> assign next serial in series
    new_serial = series.next_serial
    book = models.Book(
        series_id=series.id,
        base_serial=new_serial,
        title=payload.title,
        author=payload.author,
        language=payload.language,
        publisher=payload.publisher,
        year_published=payload.year_published,
        isbn=payload.isbn,
        notes=payload.notes,
    )
    db.add(book)
    series.next_serial = new_serial + 1
    db.add(series)
    db.flush()  # get book.id before adding copy

    first_copy = models.BookCopy(book_id=book.id, copy_number=1)
    db.add(first_copy)
    db.commit()
    db.refresh(book)
    return book, True


def add_copy_to_book(db: Session, book_id: int, acquired_date=None, remarks: str = None) -> models.Book:
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    next_copy_number = (max([c.copy_number for c in book.copies], default=0)) + 1
    copy = models.BookCopy(book_id=book.id, copy_number=next_copy_number, remarks=remarks)
    if acquired_date:
        copy.acquired_date = acquired_date
    db.add(copy)
    db.commit()
    db.refresh(book)
    return book


def create_taranga(db: Session, payload: schemas.TarangaCreate) -> models.Magazine:
    """
    Quick-entry Taranga creation. Unlike books, every submission gets its
    own brand-new serial number in the series - there is no dedup/merge by
    title, since each physical Taranga issue is catalogued separately
    (e.g. M-1, M-2, M-3...). Only series, title, and month are required.
    """
    series = db.query(models.Series).filter(models.Series.id == payload.series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    if not series.is_active:
        raise HTTPException(status_code=400, detail="Series is inactive")

    new_serial = series.next_serial
    taranga = models.Magazine(
        series_id=series.id,
        base_serial=new_serial,
        title=payload.title,
        month=payload.month,
    )
    db.add(taranga)
    series.next_serial = new_serial + 1
    db.commit()
    db.refresh(taranga)
    return taranga


def create_magazine_or_next_issue(db: Session, payload: schemas.MagazineCreate):
    """Same pattern as books: unique (series, title) gets a serial; adding
    an existing title again is treated as registering the magazine title
    once (issues are tracked separately via MagazineIssue)."""
    series = db.query(models.Series).filter(models.Series.id == payload.series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    norm_title = normalize(payload.title)
    existing = None
    for m in db.query(models.Magazine).filter(models.Magazine.series_id == payload.series_id).all():
        if normalize(m.title) == norm_title:
            existing = m
            break
    if existing:
        return existing, False

    new_serial = series.next_serial
    magazine = models.Magazine(
        series_id=series.id,
        base_serial=new_serial,
        title=payload.title,
        month=payload.month,
        publisher=payload.publisher,
        language=payload.language,
        frequency=payload.frequency,
        notes=payload.notes,
    )
    db.add(magazine)
    series.next_serial = new_serial + 1
    db.commit()
    db.refresh(magazine)
    return magazine, True


def renumber_series(db: Session, series_id: int):
    """Utility: recompute next_serial based on max base_serial currently in
    use (useful after bulk import or manual DB edits)."""
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    max_book = db.query(func.max(models.Book.base_serial)).filter(
        models.Book.series_id == series_id).scalar() or 0
    max_mag = db.query(func.max(models.Magazine.base_serial)).filter(
        models.Magazine.series_id == series_id).scalar() or 0
    series.next_serial = max(max_book, max_mag) + 1
    db.commit()
    db.refresh(series)
    return series
