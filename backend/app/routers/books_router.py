from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.database import get_db
from app import models, schemas, auth, crud

router = APIRouter(prefix="/api/books", tags=["Books"])


def _book_latest_activity(book: models.Book):
    """Most recent 'added' timestamp for this book: the newest copy's
    created_at if any copies exist, otherwise the book's own created_at.
    Powers the 'Latest Added Order' view so that adding a new copy to an
    existing book (e.g. A-12(2)) surfaces that book as recently active,
    without touching its serial number."""
    copy_dates = [c.created_at for c in book.copies if c.created_at]
    if copy_dates:
        return max(copy_dates)
    return book.created_at


def _book_to_out(book: models.Book, order_by: str = "series") -> schemas.BookOut:
    out = schemas.BookOut.model_validate(book)
    out.series_code = book.series.code
    out.series_name = book.series.name
    out.sub_series_name = book.sub_series.name if book.sub_series else None
    out.total_copies = len(book.copies)
    out.display_serial = f"{book.series.code}-{book.base_serial}"
    copies = list(book.copies)
    if order_by == "latest":
        copies.sort(key=lambda c: c.created_at or book.created_at, reverse=True)
    else:
        copies.sort(key=lambda c: c.copy_number)
    copies_out = []
    for c in copies:
        co = schemas.BookCopyOut.model_validate(c)
        co.display_serial = crud.display_serial_for_book(book, c.copy_number)
        copies_out.append(co)
    out.copies = copies_out
    out.latest_activity = _book_latest_activity(book)
    return out


@router.get("", response_model=schemas.PaginatedBooks)
def list_books(
    search: Optional[str] = Query(None, description="Search title, author, or serial (e.g. 'A-74')"),
    series_id: Optional[int] = None,
    series_code: Optional[str] = None,
    sub_series_id: Optional[int] = None,
    author: Optional[str] = None,
    language: Optional[str] = None,
    order_by: str = Query(
        "series",
        pattern="^(series|latest)$",
        description=(
            "'series' groups/sorts by serial number (e.g. A-12, A-12(2), A-13). "
            "'latest' shows the newest-added books/copies first; serial numbers are unchanged."
        ),
    ),
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth.get_current_user),
):
    q = db.query(models.Book).options(
        joinedload(models.Book.series), joinedload(models.Book.sub_series), joinedload(models.Book.copies)
    )

    if series_id:
        q = q.filter(models.Book.series_id == series_id)
    if series_code:
        q = q.join(models.Series).filter(models.Series.code == series_code.upper())
    if sub_series_id:
        q = q.filter(models.Book.sub_series_id == sub_series_id)
    if author:
        q = q.filter(models.Book.author.ilike(f"%{author}%"))
    if language:
        q = q.filter(models.Book.language.ilike(f"%{language}%"))
    if search:
        like = f"%{search}%"
        # Support searching a combined serial like "A-74" by splitting on '-'
        serial_filter = None
        if "-" in search:
            code_part, _, num_part = search.partition("-")
            num_part = num_part.split("(")[0].strip()
            if num_part.isdigit():
                serial_filter = (
                    func.upper(models.Series.code) == code_part.strip().upper()
                ) & (models.Book.base_serial == int(num_part))
        q = q.join(models.Series).outerjoin(models.SubSeries)
        conditions = [models.Book.title.ilike(like), models.Book.author.ilike(like),
                      models.SubSeries.name.ilike(like)]
        if serial_filter is not None:
            conditions.append(serial_filter)
        q = q.filter(or_(*conditions))

    # Fetch all matching books (unpaginated) so we can sort by either the
    # logical series order or "latest added" order. "Latest added" depends
    # on each book's copies and can't be expressed as a simple column
    # order_by, but library-scale datasets make sorting in Python fine.
    all_books = q.distinct().all()

    if order_by == "latest":
        all_books.sort(key=_book_latest_activity, reverse=True)
    else:
        all_books.sort(key=lambda b: (b.series_id, b.base_serial))

    total = len(all_books)
    start = (page - 1) * page_size
    books = all_books[start:start + page_size]

    return schemas.PaginatedBooks(
        total=total, page=page, page_size=page_size,
        items=[_book_to_out(b, order_by=order_by) for b in books],
    )


@router.get("/{book_id}", response_model=schemas.BookOut)
def get_book(book_id: int, db: Session = Depends(get_db),
             _user: models.User = Depends(auth.get_current_user)):
    book = db.query(models.Book).options(
        joinedload(models.Book.series), joinedload(models.Book.sub_series), joinedload(models.Book.copies)
    ).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _book_to_out(book)


@router.post("", response_model=schemas.BookOut)
def create_book(payload: schemas.BookCreate, db: Session = Depends(get_db),
                 _user: models.User = Depends(auth.get_current_user)):
    """
    Adds a new book. If title+author already exist in this series, this
    automatically registers it as an additional copy (A-74(2), A-74(3)...)
    of the existing record instead of creating a duplicate entry.
    """
    book, was_new = crud.create_book_or_add_copy(db, payload)
    result = _book_to_out(book)
    return result


@router.post("/add-copy", response_model=schemas.BookOut)
def add_copy(payload: schemas.AddCopyRequest, db: Session = Depends(get_db),
             _user: models.User = Depends(auth.get_current_user)):
    """Explicitly add another physical copy to an existing book record."""
    book = crud.add_copy_to_book(db, payload.book_id, payload.acquired_date, payload.remarks)
    return _book_to_out(book)


@router.put("/{book_id}", response_model=schemas.BookOut)
def update_book(book_id: int, payload: schemas.BookUpdate, db: Session = Depends(get_db),
                 _user: models.User = Depends(auth.get_current_user)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    data = payload.model_dump(exclude_unset=True)
    sub_series_name = data.pop("sub_series_name", None)
    if "sub_series_id" in data or sub_series_name:
        resolved = crud.resolve_sub_series(db, book.series_id, data.pop("sub_series_id", None), sub_series_name)
        book.sub_series_id = resolved
    for k, v in data.items():
        setattr(book, k, v)
    db.commit()
    db.refresh(book)
    return _book_to_out(book)


@router.delete("/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db),
                 _admin: models.User = Depends(auth.require_admin)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    issued_copies = [c for c in book.copies if c.status == models.CopyStatus.ISSUED]
    if issued_copies:
        issued_serials = ", ".join(crud.display_serial_for_book(book, c.copy_number) for c in issued_copies)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {issued_serials} still marked as issued. Mark the copy as returned/available first."
        )
    db.delete(book)
    db.commit()
    return {"detail": "Book (and all its copies) deleted"}


@router.delete("/{book_id}/copies/{copy_id}")
def delete_copy(book_id: int, copy_id: int, db: Session = Depends(get_db),
                 _admin: models.User = Depends(auth.require_admin)):
    copy = db.query(models.BookCopy).filter(
        models.BookCopy.id == copy_id, models.BookCopy.book_id == book_id).first()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")
    db.delete(copy)
    db.commit()
    return {"detail": "Copy deleted"}


@router.put("/{book_id}/copies/{copy_id}", response_model=schemas.BookCopyOut)
def update_copy(book_id: int, copy_id: int, payload: schemas.BookCopyUpdate,
                 db: Session = Depends(get_db), _user: models.User = Depends(auth.get_current_user)):
    copy = db.query(models.BookCopy).filter(
        models.BookCopy.id == copy_id, models.BookCopy.book_id == book_id).first()
    if not copy:
        raise HTTPException(status_code=404, detail="Copy not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(copy, k, v)
    db.commit()
    db.refresh(copy)
    out = schemas.BookCopyOut.model_validate(copy)
    out.display_serial = crud.display_serial_for_book(copy.book, copy.copy_number)
    return out
