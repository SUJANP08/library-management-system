from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas, auth, crud

router = APIRouter(prefix="/api/magazines", tags=["Taranga"])


@router.get("/taranga-series", response_model=schemas.SeriesOut)
def get_taranga_series(db: Session = Depends(get_db),
                        _user: models.User = Depends(auth.get_current_user)):
    """
    Returns the single fixed Series that Taranga entries always belong to
    (auto-created if it doesn't exist yet). Lets the frontend show which
    series a new Taranga entry will land in without offering a picker.
    """
    series = crud.get_or_create_taranga_series(db)
    db.commit()
    db.refresh(series)
    from app.routers.series_router import _series_to_out
    return _series_to_out(db, series)


def _mag_to_out(m: models.Magazine) -> schemas.MagazineOut:
    out = schemas.MagazineOut.model_validate(m)
    out.series_code = m.series.code
    out.display_serial = f"{m.series.code}-{m.base_serial}"
    out.issue_count = len(m.issues)
    out.issues = [schemas.MagazineIssueOut.model_validate(i) for i in m.issues]
    return out


@router.get("", response_model=list[schemas.MagazineOut])
def list_magazines(
    search: Optional[str] = None,
    series_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth.get_current_user),
):
    q = db.query(models.Magazine).options(joinedload(models.Magazine.series), joinedload(models.Magazine.issues))
    if series_id:
        q = q.filter(models.Magazine.series_id == series_id)
    if search:
        q = q.filter(models.Magazine.title.ilike(f"%{search}%"))
    magazines = q.order_by(models.Magazine.series_id, models.Magazine.base_serial).all()
    return [_mag_to_out(m) for m in magazines]


@router.post("/quick-add", response_model=schemas.MagazineOut)
def quick_add_taranga(payload: schemas.TarangaCreate, db: Session = Depends(get_db),
                       _user: models.User = Depends(auth.get_current_user)):
    """
    Simplified Taranga entry: only title and month are required. The series
    is always the fixed Taranga series, resolved automatically (never asked
    of the user - see crud.get_or_create_taranga_series). Every submission
    is assigned a brand-new serial number automatically - no manual
    numbering, no dedup with existing titles.
    """
    taranga = crud.create_taranga(db, payload)
    return _mag_to_out(taranga)


@router.post("", response_model=schemas.MagazineOut)
def create_magazine(payload: schemas.MagazineCreate, db: Session = Depends(get_db),
                     _user: models.User = Depends(auth.get_current_user)):
    magazine, _ = crud.create_magazine_or_next_issue(db, payload)
    return _mag_to_out(magazine)


@router.put("/{magazine_id}", response_model=schemas.MagazineOut)
def update_magazine(magazine_id: int, payload: schemas.MagazineUpdate, db: Session = Depends(get_db),
                     _user: models.User = Depends(auth.get_current_user)):
    magazine = db.query(models.Magazine).filter(models.Magazine.id == magazine_id).first()
    if not magazine:
        raise HTTPException(status_code=404, detail="Taranga not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(magazine, k, v)
    db.commit()
    db.refresh(magazine)
    return _mag_to_out(magazine)


@router.delete("/{magazine_id}")
def delete_magazine(magazine_id: int, db: Session = Depends(get_db),
                     _admin: models.User = Depends(auth.require_admin)):
    magazine = db.query(models.Magazine).filter(models.Magazine.id == magazine_id).first()
    if not magazine:
        raise HTTPException(status_code=404, detail="Taranga not found")
    db.delete(magazine)
    db.commit()
    return {"detail": "Magazine deleted"}


@router.post("/issues", response_model=schemas.MagazineOut)
def add_issue(payload: schemas.MagazineIssueCreate, db: Session = Depends(get_db),
              _user: models.User = Depends(auth.get_current_user)):
    magazine = db.query(models.Magazine).filter(models.Magazine.id == payload.magazine_id).first()
    if not magazine:
        raise HTTPException(status_code=404, detail="Taranga not found")
    issue = models.MagazineIssue(
        magazine_id=magazine.id,
        issue_number=payload.issue_number,
        issue_period=payload.issue_period,
        remarks=payload.remarks,
    )
    if payload.received_date:
        issue.received_date = payload.received_date
    db.add(issue)
    db.commit()
    db.refresh(magazine)
    return _mag_to_out(magazine)


@router.delete("/issues/{issue_id}")
def delete_issue(issue_id: int, db: Session = Depends(get_db),
                  _admin: models.User = Depends(auth.require_admin)):
    issue = db.query(models.MagazineIssue).filter(models.MagazineIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    db.delete(issue)
    db.commit()
    return {"detail": "Issue deleted"}
