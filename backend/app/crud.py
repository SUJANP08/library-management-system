"""
Core business logic that isn't just simple CRUD passthrough:
- Auto-generating the next serial number within a series.
- Detecting existing (title, author) within a series and adding a new
  copy (A-74(1), A-74(2)...) instead of a duplicate base record.
"""
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app import models, schemas


def normalize(text: str) -> str:
    """Normalize for duplicate comparison: trim + lowercase + collapse spaces.
    Works fine with Unicode/Kannada text since Python str.lower() is Unicode-aware."""
    return " ".join((text or "").strip().lower().split())


def display_serial_for_book(book: models.Book, copy_number: int = 1, total_copies: int = 1) -> str:
    """
    Builds the human-facing serial label for one physical copy of a book.

    - A book with only one copy on record shows the bare serial: "A-10".
    - A book with more than one copy shows every copy with its copy_number
      in parentheses, matching the library's own on-the-shelf copy
      notation: "A-10(1)", "A-10(2)", "A-10(3)"... This applies to ALL of
      that book's copies, including the first one - so once a second copy
      is added, the first copy's label also gains "(1)" rather than
      staying bare. A bare "A-10" next to "A-10(2)" doesn't read as
      "copy 1 of 2" the way "A-10(1)" next to "A-10(2)" does, which is what
      made a book's second (and later) copies hard to spot/recognize in
      reports.
    - Each copy's number is its own fixed copy_number, not its position
      among currently-remaining copies, so a copy keeps the same number
      for its lifetime even if an earlier copy is later deleted.
    """
    base = f"{book.series.code}-{book.base_serial}"
    if total_copies > 1:
        return f"{base}({copy_number})"
    return base


def next_available_serial(db: Session, series_id: int) -> int:
    """
    Returns the smallest positive integer not currently used as a base_serial
    within this series, across BOTH Books and Magazines (a series' numbering
    is shared between the two so "A-1, A-2, A-3..." never collides regardless
    of material type).

    This is deliberately computed fresh from the actual rows in use rather
    than from a separately-maintained counter. A separately-maintained
    "next_serial" counter only ever increases - once a number is deleted it's
    gone forever, which is exactly the reported bug (delete book #94, add a
    new book, and the series jumps straight to #95 instead of reusing #94).
    Computing the smallest unused number on every insert means a deleted
    number becomes available again immediately, with no separate "renumber"
    step required.

    For a library-scale catalog (hundreds to low thousands of records per
    series) scanning the existing serials on every insert is inexpensive.
    """
    used_books = {
        row[0] for row in db.query(models.Book.base_serial)
        .filter(models.Book.series_id == series_id).all()
    }
    used_mags = {
        row[0] for row in db.query(models.Magazine.base_serial)
        .filter(models.Magazine.series_id == series_id).all()
    }
    used = used_books | used_mags
    n = 1
    while n in used:
        n += 1
    return n


def get_or_create_taranga_series(db: Session) -> models.Series:
    """
    Resolves the single fixed Series that Taranga entries always belong to.

    Taranga doesn't get its own hardcoded series ID - series remain fully
    dynamic/admin-managed like everywhere else in the app. Instead, the
    Taranga series is identified structurally: it's the (active) Series
    whose material_type is MAGAZINE. This is exactly how Series already
    distinguishes "book" series from "magazine" series (see models.Series),
    so no schema change is needed.

    - If exactly one active magazine-type series exists, use it.
    - If more than one exists (an admin created extras in Series
      Management), prefer the one with code "K" if present, otherwise the
      oldest one - Taranga entries should keep landing in a single,
      predictable series rather than silently switching.
    - If none exists yet, auto-create the default "K - Taranga" series so
      Taranga entry keeps working without asking the user to first go set
      one up in Series Management.
    """
    candidates = (
        db.query(models.Series)
        .filter(models.Series.material_type == models.MaterialType.MAGAZINE,
                models.Series.is_active == True)  # noqa: E712
        .order_by(models.Series.created_at)
        .all()
    )
    if candidates:
        for s in candidates:
            if s.code.upper() == "K":
                return s
        return candidates[0]

    # No magazine-type series exists yet - create the default one on the fly.
    existing_k = db.query(models.Series).filter(models.Series.code == "K").first()
    if existing_k:
        # Code "K" is taken by something else (unlikely, but don't silently
        # collide with an admin-created series) - fall back to a free code.
        code = "TARANGA"
        suffix = 1
        while db.query(models.Series).filter(models.Series.code == code).first():
            suffix += 1
            code = f"TARANGA{suffix}"
    else:
        code = "K"

    series = models.Series(
        code=code, name="Taranga", material_type=models.MaterialType.MAGAZINE, next_serial=1,
    )
    db.add(series)
    db.flush()
    return series


def find_existing_book(db: Session, series_id: int, title: str, author: str):
    """Find a book with the same title+author (case/whitespace-insensitive)
    already registered in this series."""
    candidates = db.query(models.Book).filter(models.Book.series_id == series_id).all()
    norm_title, norm_author = normalize(title), normalize(author)
    for b in candidates:
        if normalize(b.title) == norm_title and normalize(b.author) == norm_author:
            return b
    return None


def resolve_sub_series(db: Session, series_id: int, sub_series_id: Optional[int],
                        sub_series_name: Optional[str]) -> Optional[int]:
    """
    Resolves the sub_series_id to store on a Book:
    - If sub_series_id is given, validate it belongs to the series and return it.
    - Else if sub_series_name is given, find-or-create a SubSeries with that name
      under the series (case/whitespace-insensitive match) and return its id.
    - Else return None (uncategorized sub-series - allowed, can be set later).
    """
    if sub_series_id:
        sub = db.query(models.SubSeries).filter(
            models.SubSeries.id == sub_series_id, models.SubSeries.series_id == series_id
        ).first()
        if not sub:
            raise HTTPException(status_code=400, detail="Sub-series does not belong to the selected series")
        return sub.id

    if sub_series_name and sub_series_name.strip():
        norm_name = normalize(sub_series_name)
        existing = db.query(models.SubSeries).filter(models.SubSeries.series_id == series_id).all()
        for s in existing:
            if normalize(s.name) == norm_name:
                return s.id
        new_sub = models.SubSeries(series_id=series_id, name=sub_series_name.strip())
        db.add(new_sub)
        db.flush()
        return new_sub.id

    return None


def create_book_or_add_copy(db: Session, payload: schemas.BookCreate) -> tuple[models.Book, bool]:
    """
    Adds a new book. If a book with the same title+author already exists in
    the chosen series, this instead adds a new copy to that existing book
    (A-74(1), A-74(2), ...) and returns (book, False).
    Otherwise creates a brand-new book with the series' next serial number
    and returns (book, True).
    """
    series = db.query(models.Series).filter(models.Series.id == payload.series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    if not series.is_active:
        raise HTTPException(status_code=400, detail="Series is inactive")

    sub_series_id = resolve_sub_series(db, payload.series_id, payload.sub_series_id, payload.sub_series_name)

    existing = find_existing_book(db, payload.series_id, payload.title, payload.author)

    if existing:
        # If the existing record has no sub-series classification yet and this
        # submission supplies one, backfill it rather than leaving it blank.
        if sub_series_id and not existing.sub_series_id:
            existing.sub_series_id = sub_series_id
            db.add(existing)
        next_copy_number = (max([c.copy_number for c in existing.copies], default=0)) + 1
        copy = models.BookCopy(book_id=existing.id, copy_number=next_copy_number)
        db.add(copy)
        db.commit()
        db.refresh(existing)
        return existing, False

    # Brand new title -> assign the smallest unused serial in this series,
    # filling any gap left by a previously deleted book/magazine instead of
    # always incrementing.
    new_serial = next_available_serial(db, series.id)
    book = models.Book(
        series_id=series.id,
        sub_series_id=sub_series_id,
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
    db.flush()  # get book.id before adding copy, and make base_serial visible to the hint recompute below

    first_copy = models.BookCopy(book_id=book.id, copy_number=1)
    db.add(first_copy)
    # next_serial is kept only as a display hint (shown in Series Management);
    # it is never read when assigning serials, so recomputing it here can't
    # reintroduce the original bug.
    series.next_serial = next_available_serial(db, series.id)
    db.add(series)
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
    (e.g. M-1, M-2, M-3...). Only title and month are required from the
    user - the series is always the fixed Taranga (magazine-type) series,
    resolved automatically via get_or_create_taranga_series so the user is
    never asked to pick one.
    """
    series = get_or_create_taranga_series(db)

    new_serial = next_available_serial(db, series.id)
    taranga = models.Magazine(
        series_id=series.id,
        base_serial=new_serial,
        title=payload.title,
        month=payload.month,
    )
    db.add(taranga)
    db.flush()
    series.next_serial = next_available_serial(db, series.id)
    db.add(series)
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

    new_serial = next_available_serial(db, series.id)
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
    db.flush()
    series.next_serial = next_available_serial(db, series.id)
    db.add(series)
    db.commit()
    db.refresh(magazine)
    return magazine, True


def close_serial_gap(db: Session, series_id: int, deleted_serial: int) -> None:
    """
    Called right after a book or magazine is deleted. Shifts every
    remaining book/magazine in the series whose base_serial is greater
    than the deleted one DOWN by one, so e.g. deleting 12 out of
    10, 11, 12, 13, 14, 15 turns the survivors into 10, 11, 12, 13, 14
    instead of leaving a permanent hole at 12 (which next_available_serial
    would otherwise only backfill the next time something new is added -
    fine for keeping numbers dense over time, but not what's wanted when
    the librarian expects the whole series to re-number immediately).

    Books and magazines share one numbering pool per series (see
    next_available_serial), so both are shifted together here to stay
    consistent and collision-free.

    Processed in ascending base_serial order, flushing one row at a time:
    each UPDATE lands on the serial the previous UPDATE just vacated (or
    the deleted book's own vacated serial, for the first one), so it never
    collides with the unique (series_id, base_serial) constraint even
    though the shift touches many rows in a single transaction.

    The caller is responsible for deleting (and flushing/committing) the
    book/magazine itself before calling this.
    """
    to_shift: list = []
    to_shift.extend(
        db.query(models.Book)
        .filter(models.Book.series_id == series_id, models.Book.base_serial > deleted_serial)
        .all()
    )
    to_shift.extend(
        db.query(models.Magazine)
        .filter(models.Magazine.series_id == series_id, models.Magazine.base_serial > deleted_serial)
        .all()
    )
    to_shift.sort(key=lambda obj: obj.base_serial)

    for obj in to_shift:
        obj.base_serial -= 1
        db.add(obj)
        db.flush()

    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if series:
        series.next_serial = next_available_serial(db, series_id)
        db.add(series)


def renumber_series(db: Session, series_id: int):
    """Utility: refresh the displayed 'next serial' hint for a series
    (Series Management shows this). Since serial assignment itself always
    computes the smallest unused number on the fly (see
    next_available_serial), this endpoint is no longer required for correct
    numbering - it's kept as a manual way to resync the hint after bulk
    imports or direct DB edits, and now correctly reports the next GAP
    rather than MAX(base_serial) + 1."""
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    series.next_serial = next_available_serial(db, series_id)
    db.commit()
    db.refresh(series)
    return series

