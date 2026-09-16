from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

connect_args = {}
engine_kwargs = {}

if settings.is_sqlite:
    # Needed for SQLite + FastAPI's threaded request handling
    connect_args = {"check_same_thread": False}
else:
    # Managed Postgres instances (Render, Neon, Supabase, ...) drop idle
    # connections after a few minutes, and free-tier hosts idle the whole
    # service out. Without pre-ping the first request after an idle period
    # fails with "server closed the connection unexpectedly"; pre-ping
    # transparently discards the dead connection and opens a fresh one.
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 300,   # recycle connections older than 5 min
        "pool_size": 5,
        "max_overflow": 5,
    }

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
