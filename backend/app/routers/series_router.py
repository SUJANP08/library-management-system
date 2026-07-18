from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas, auth, crud

router = APIRouter(prefix="/api/series", tags=["Series Management"])


def _series_to_out(db: Session, s: models.Series) -> schemas.SeriesOut:
    count = db.query(func.count(models.Book.id)).filter(models.Book.series_id == s.id).scalar()
    sub_count = db.query(func.count(models.SubSeries.id)).filter(
        models.SubSeries.series_id == s.id, models.SubSeries.is_active == True  # noqa: E712
    ).scalar()
    out = schemas.SeriesOut.model_validate(s)
    out.book_count = count or 0
    out.sub_series_count = sub_count or 0
    return out


@router.get("", response_model=list[schemas.SeriesOut])
def list_series(include_inactive: bool = False, db: Session = Depends(get_db),
                 _user: models.User = Depends(auth.get_current_user)):
    q = db.query(models.Series)
    if not include_inactive:
        q = q.filter(models.Series.is_active == True)  # noqa: E712
    series = q.order_by(models.Series.code).all()
    return [_series_to_out(db, s) for s in series]


@router.post("", response_model=schemas.SeriesOut)
def create_series(payload: schemas.SeriesCreate, db: Session = Depends(get_db),
                   _admin: models.User = Depends(auth.require_admin)):
    code = payload.code.strip().upper()
    if db.query(models.Series).filter(models.Series.code == code).first():
        raise HTTPException(status_code=400, detail=f"Series code '{code}' already exists")
    series = models.Series(
        code=code, name=payload.name, description=payload.description,
        material_type=payload.material_type, next_serial=1,
    )
    db.add(series)
    db.commit()
    db.refresh(series)
    return _series_to_out(db, series)


@router.put("/{series_id}", response_model=schemas.SeriesOut)
def update_series(series_id: int, payload: schemas.SeriesUpdate, db: Session = Depends(get_db),
                   _admin: models.User = Depends(auth.require_admin)):
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"]:
        new_code = data["code"].strip().upper()
        clash = db.query(models.Series).filter(models.Series.code == new_code,
                                                 models.Series.id != series_id).first()
        if clash:
            raise HTTPException(status_code=400, detail=f"Series code '{new_code}' already exists")
        data["code"] = new_code
    for k, v in data.items():
        setattr(series, k, v)
    db.commit()
    db.refresh(series)
    return _series_to_out(db, series)


@router.delete("/{series_id}")
def delete_series(series_id: int, force: bool = False, db: Session = Depends(get_db),
                   _admin: models.User = Depends(auth.require_admin)):
    series = db.query(models.Series).filter(models.Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    book_count = db.query(func.count(models.Book.id)).filter(models.Book.series_id == series_id).scalar()
    if book_count and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Series has {book_count} book(s). Deactivate instead, or pass ?force=true to delete permanently along with all its records."
        )
    db.delete(series)
    db.commit()
    return {"detail": "Series deleted"}


@router.post("/{series_id}/renumber", response_model=schemas.SeriesOut)
def renumber_series(series_id: int, db: Session = Depends(get_db),
                     _admin: models.User = Depends(auth.require_admin)):
    """Recalculate the next serial number from existing records
    (useful after Excel import or manual corrections)."""
    series = crud.renumber_series(db, series_id)
    return _series_to_out(db, series)
