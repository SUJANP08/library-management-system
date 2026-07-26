"""
Library Management System - FastAPI backend entrypoint.

Run with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, SessionLocal
from app.config import settings
from app import models, auth
from app.routers import (
    auth_router, series_router, books_router, magazines_router,
    reports_router, backup_router, dashboard_router,
    sub_series_router, category_finder_router,
)

# Create all tables if they don't exist yet (for simple deployments).
# For production with evolving schema, use Alembic migrations instead.
Base.metadata.create_all(bind=engine)


def bootstrap_admin():
    """Create a default admin account on first run if no users exist yet."""
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            admin = models.User(
                username=settings.DEFAULT_ADMIN_USERNAME,
                full_name="Library Administrator",
                hashed_password=auth.get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
                role=models.UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
            print(f"[bootstrap] Created default admin user "
                  f"'{settings.DEFAULT_ADMIN_USERNAME}' - change this password immediately.")
    finally:
        db.close()


def bootstrap_default_series():
    """Seed a few example series matching the request, only if none exist.
    Admins can edit/delete/add to these freely afterwards."""
    db = SessionLocal()
    try:
        if db.query(models.Series).count() == 0:
            defaults = [
                ("A", "Kannada Story Books", models.MaterialType.BOOK),
                ("B", "Kannada Kavya & Nataka", models.MaterialType.BOOK),
                ("C", "Science Books", models.MaterialType.BOOK),
                ("G", "English Story Books", models.MaterialType.BOOK),
                ("K", "Taranga", models.MaterialType.MAGAZINE),
            ]
            for code, name, mtype in defaults:
                db.add(models.Series(code=code, name=name, material_type=mtype, next_serial=1))
            db.commit()
            print("[bootstrap] Seeded default series (A, B, C, G, K). Edit/delete anytime in Series Management.")
    finally:
        db.close()


def bootstrap_default_sub_series():
    """Seed a starter set of Sub-Series/Categories under each existing BOOK
    series, only if that series has none yet. Admins can add/edit/delete
    these freely afterwards in Series Management."""
    db = SessionLocal()
    try:
        default_categories = [
            "Kadambari", "Kavana", "Kruti", "Kathegalu", "Biography",
            "Nataka", "Prabandha", "Reference",
        ]
        book_series = db.query(models.Series).filter(models.Series.material_type == models.MaterialType.BOOK).all()
        for series in book_series:
            if db.query(models.SubSeries).filter(models.SubSeries.series_id == series.id).count() == 0:
                for name in default_categories:
                    db.add(models.SubSeries(series_id=series.id, name=name))
        db.commit()
        if book_series:
            print("[bootstrap] Seeded default Sub-Series/Categories (Kadambari, Kavana, Kruti, Kathegalu, "
                  "Biography, ...) under existing book series. Edit/delete anytime in Series Management.")
    finally:
        db.close()


app = FastAPI(
    title="Library Management System API",
    description="Central API for books, magazines, series management, reports, and backups.",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(series_router.router)
app.include_router(sub_series_router.router)
app.include_router(books_router.router)
app.include_router(magazines_router.router)
app.include_router(reports_router.router)
app.include_router(backup_router.router)
app.include_router(dashboard_router.router)
app.include_router(category_finder_router.router)


@app.on_event("startup")
def on_startup():
    bootstrap_admin()
    bootstrap_default_series()
    bootstrap_default_sub_series()


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Library Management System API",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
