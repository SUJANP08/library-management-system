from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/sub-series", tags=["Sub-Series / Categories"])


def _sub_series_to_out(db: Session, s: models.SubSeries) -> schemas.SubSeriesOut:
    count = db.query(func.count(models.Book.id)).filter(models.Book.sub_series_id == s.id).scalar()
    out = schemas.SubSeriesOut.model_validate(s)
    out.series_code = s.series.code if s.series else ""
    out.series_name = s.series.name if s.series else ""
    out.book_count = count or 0
    return out


@router.get("", response_model=list[schemas.SubSeriesOut])
def list_sub_series(
    series_id: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth.get_current_user),
):
    q = db.query(models.SubSeries).options(joinedload(models.SubSeries.series))
    if series_id:
        q = q.filter(models.SubSeries.series_id == series_id)
    if not include_inactive:
        q = q.filter(models.SubSeries.is_active == True)  # noqa: E712
    items = q.order_by(models.SubSeries.series_id, models.SubSeries.name).all()
    return [_sub_series_to_out(db, s) for s in items]


@router.post("", response_model=schemas.SubSeriesOut)
def create_sub_series(payload: schemas.SubSeriesCreate, db: Session = Depends(get_db),
                       _admin: models.User = Depends(auth.require_admin)):
    series = db.query(models.Series).filter(models.Series.id == payload.series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Main Series not found")

    name = payload.name.strip()
    norm = name.lower()
    clash = [s for s in series.sub_series if s.name.strip().lower() == norm]
    if clash:
        raise HTTPException(
            status_code=400,
            detail=f"Sub-Series '{name}' already exists under {series.code} — {series.name}",
        )

    sub = models.SubSeries(series_id=series.id, name=name, description=payload.description)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return _sub_series_to_out(db, sub)


@router.put("/{sub_series_id}", response_model=schemas.SubSeriesOut)
def update_sub_series(sub_series_id: int, payload: schemas.SubSeriesUpdate, db: Session = Depends(get_db),
                       _admin: models.User = Depends(auth.require_admin)):
    sub = db.query(models.SubSeries).filter(models.SubSeries.id == sub_series_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Sub-Series not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        new_name = data["name"].strip()
        norm = new_name.lower()
        clash = db.query(models.SubSeries).filter(
            models.SubSeries.series_id == sub.series_id,
            models.SubSeries.id != sub_series_id,
        ).all()
        if any(c.name.strip().lower() == norm for c in clash):
            raise HTTPException(status_code=400, detail=f"Sub-Series '{new_name}' already exists in this series")
        data["name"] = new_name
    for k, v in data.items():
        setattr(sub, k, v)
    db.commit()
    db.refresh(sub)
    return _sub_series_to_out(db, sub)


@router.delete("/{sub_series_id}")
def delete_sub_series(sub_series_id: int, force: bool = False, db: Session = Depends(get_db),
                       _admin: models.User = Depends(auth.require_admin)):
    sub = db.query(models.SubSeries).filter(models.SubSeries.id == sub_series_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Sub-Series not found")
    book_count = db.query(func.count(models.Book.id)).filter(models.Book.sub_series_id == sub_series_id).scalar()
    if book_count and not force:
        raise HTTPException(
            status_code=400,
            detail=f"{book_count} book(s) use this sub-series. Deactivate instead, or pass ?force=true to "
                   f"delete permanently (books will become uncategorized, not deleted).",
        )
    if book_count and force:
        db.query(models.Book).filter(models.Book.sub_series_id == sub_series_id).update({"sub_series_id": None})
    db.delete(sub)
    db.commit()
    return {"detail": "Sub-Series deleted"}
