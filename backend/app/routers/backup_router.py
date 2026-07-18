import io
import json
import os
import shutil
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, auth

router = APIRouter(prefix="/api/backup", tags=["Backup & Restore"])


def _serialize_table(rows, exclude=("hashed_password",)):
    result = []
    for row in rows:
        d = {}
        for c in row.__table__.columns:
            if c.name in exclude:
                continue
            val = getattr(row, c.name)
            if isinstance(val, datetime):
                val = val.isoformat()
            elif hasattr(val, "value"):  # Enum
                val = val.value
            elif hasattr(val, "isoformat"):  # date
                val = val.isoformat()
            d[c.name] = val
        result.append(d)
    return result


@router.get("/export")
def export_backup(db: Session = Depends(get_db), admin: models.User = Depends(auth.require_admin)):
    """
    Full JSON export of all library data (series, books, copies, magazines,
    issues). User accounts/passwords are excluded for security.
    """
    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "exported_by": admin.username,
        "version": "1.1",
        "series": _serialize_table(db.query(models.Series).all()),
        "sub_series": _serialize_table(db.query(models.SubSeries).all()),
        "books": _serialize_table(db.query(models.Book).all()),
        "book_copies": _serialize_table(db.query(models.BookCopy).all()),
        "magazines": _serialize_table(db.query(models.Magazine).all()),
        "magazine_issues": _serialize_table(db.query(models.MagazineIssue).all()),
    }

    os.makedirs(settings.BACKUP_DIR, exist_ok=True)
    filename = f"library_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = os.path.join(settings.BACKUP_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    log = models.BackupLog(
        filename=filename, created_by=admin.username,
        record_count=len(data["books"]) + len(data["magazines"]),
    )
    db.add(log)
    db.commit()

    buffer = io.BytesIO(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
    return StreamingResponse(
        buffer, media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    wipe_existing: bool = False,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    """
    Restore data from a previously exported JSON backup.
    wipe_existing=True clears current series/books/magazines before restoring
    (use with caution). Default False merges/inserts by id where possible.
    """
    content = await file.read()
    try:
        data = json.loads(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid backup file (must be JSON produced by /backup/export)")

    required_keys = {"series", "books", "book_copies"}
    if not required_keys.issubset(data.keys()):
        raise HTTPException(status_code=400, detail="Backup file is missing required sections")

    if wipe_existing:
        db.query(models.MagazineIssue).delete()
        db.query(models.Magazine).delete()
        db.query(models.BookCopy).delete()
        db.query(models.Book).delete()
        db.query(models.SubSeries).delete()
        db.query(models.Series).delete()
        db.commit()

    series_id_map = {}
    for s in data.get("series", []):
        old_id = s.pop("id", None)
        existing = db.query(models.Series).filter(models.Series.code == s["code"]).first()
        if existing:
            for k, v in s.items():
                if k not in ("created_at", "updated_at"):
                    setattr(existing, k, v)
            series_id_map[old_id] = existing.id
        else:
            new_series = models.Series(**{k: v for k, v in s.items() if k not in ("created_at", "updated_at")})
            db.add(new_series)
            db.flush()
            series_id_map[old_id] = new_series.id
    db.commit()

    sub_series_id_map = {}
    for ss in data.get("sub_series", []):
        old_id = ss.pop("id", None)
        ss["series_id"] = series_id_map.get(ss["series_id"], ss["series_id"])
        existing = db.query(models.SubSeries).filter(
            models.SubSeries.series_id == ss["series_id"], models.SubSeries.name == ss["name"]
        ).first()
        if existing:
            sub_series_id_map[old_id] = existing.id
        else:
            clean = {k: v for k, v in ss.items() if k not in ("created_at", "updated_at")}
            new_sub = models.SubSeries(**clean)
            db.add(new_sub)
            db.flush()
            sub_series_id_map[old_id] = new_sub.id
    db.commit()

    book_id_map = {}
    for b in data.get("books", []):
        old_id = b.pop("id", None)
        b["series_id"] = series_id_map.get(b["series_id"], b["series_id"])
        if b.get("sub_series_id") is not None:
            b["sub_series_id"] = sub_series_id_map.get(b["sub_series_id"], b["sub_series_id"])
        clean = {k: v for k, v in b.items() if k not in ("created_at", "updated_at")}
        new_book = models.Book(**clean)
        db.add(new_book)
        db.flush()
        book_id_map[old_id] = new_book.id
    db.commit()

    for c in data.get("book_copies", []):
        c.pop("id", None)
        c["book_id"] = book_id_map.get(c["book_id"], c["book_id"])
        clean = {k: v for k, v in c.items() if k != "created_at"}
        db.add(models.BookCopy(**clean))
    db.commit()

    mag_id_map = {}
    for m in data.get("magazines", []):
        old_id = m.pop("id", None)
        m["series_id"] = series_id_map.get(m["series_id"], m["series_id"])
        clean = {k: v for k, v in m.items() if k not in ("created_at", "updated_at")}
        new_mag = models.Magazine(**clean)
        db.add(new_mag)
        db.flush()
        mag_id_map[old_id] = new_mag.id
    db.commit()

    for i in data.get("magazine_issues", []):
        i.pop("id", None)
        i["magazine_id"] = mag_id_map.get(i["magazine_id"], i["magazine_id"])
        clean = {k: v for k, v in i.items() if k != "created_at"}
        db.add(models.MagazineIssue(**clean))
    db.commit()

    return {
        "detail": "Backup restored successfully",
        "series_restored": len(series_id_map),
        "sub_series_restored": len(sub_series_id_map),
        "books_restored": len(book_id_map),
        "magazines_restored": len(mag_id_map),
    }


@router.get("/history")
def backup_history(db: Session = Depends(get_db), _admin: models.User = Depends(auth.require_admin)):
    logs = db.query(models.BackupLog).order_by(models.BackupLog.created_at.desc()).all()
    return [
        {"id": l.id, "filename": l.filename, "created_by": l.created_by,
         "record_count": l.record_count, "created_at": l.created_at.isoformat()}
        for l in logs
    ]


@router.get("/download-sqlite")
def download_sqlite_file(_admin: models.User = Depends(auth.require_admin)):
    """Raw SQLite file download - only works when DATABASE_URL is sqlite:///..."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise HTTPException(status_code=400, detail="Raw file backup is only available for SQLite databases. Use /backup/export for Postgres.")
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
    os.makedirs(settings.BACKUP_DIR, exist_ok=True)
    snapshot = os.path.join(settings.BACKUP_DIR, f"library_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
    shutil.copy2(db_path, snapshot)
    return FileResponse(snapshot, filename=os.path.basename(snapshot), media_type="application/octet-stream")
