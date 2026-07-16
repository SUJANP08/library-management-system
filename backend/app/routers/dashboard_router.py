from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app import models, schemas, auth
from app.routers.books_router import _book_to_out, _book_latest_activity

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=schemas.DashboardStats)
def get_stats(db: Session = Depends(get_db), _user: models.User = Depends(auth.get_current_user)):
    total_books = db.query(func.count(models.Book.id)).scalar() or 0

    # "Recent additions" reflects the Latest Added Order: a book bubbles up
    # here when a brand-new title is catalogued OR when a new copy is added
    # to an existing title (e.g. A-12(2)), without changing its serial number.
    candidates = (
        db.query(models.Book)
        .options(joinedload(models.Book.series), joinedload(models.Book.copies))
        .order_by(models.Book.created_at.desc())
        .limit(50)
        .all()
    )
    candidates.sort(key=_book_latest_activity, reverse=True)
    recent = candidates[:8]

    return schemas.DashboardStats(
        total_books=total_books,
        recent_additions=[_book_to_out(b, order_by="latest") for b in recent],
    )
