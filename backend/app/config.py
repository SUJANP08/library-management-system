"""
Application configuration.
Reads from environment variables / .env file so nothing sensitive is hardcoded.
"""
import json
import os

from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    # Local default stays SQLite so `uvicorn app.main:app` still works with
    # zero configuration. On Render (or any container host) set DATABASE_URL
    # to a managed Postgres URL - the container filesystem is ephemeral and
    # a SQLite file written there is destroyed on every restart/redeploy.
    #   e.g. DATABASE_URL=postgresql://user:pass@host:5432/library
    DATABASE_URL: str = Field(default="sqlite:///./library.db")

    # JWT auth
    SECRET_KEY: str = Field(default="CHANGE_ME_IN_PRODUCTION_super_secret_key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours

    # Default admin bootstrap (created on first run if no users exist)
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"

    # File storage
    BACKUP_DIR: str = "./backups"
    UPLOAD_DIR: str = "./uploads"

    # CORS. Accepts a comma-separated list ("https://a.netlify.app,https://b.com"),
    # a JSON array, or "*". Stored as a string rather than list[str] because
    # pydantic-settings JSON-parses complex-typed env vars *before* validation
    # runs, which made a plain comma-separated value crash the app at boot.
    CORS_ORIGINS: str = "*"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        """
        Managed Postgres providers (Render included) hand out URLs starting
        with `postgres://`, a scheme SQLAlchemy 2.x no longer recognises -
        it raises `Can't load plugin: sqlalchemy.dialects:postgres` at
        startup. Normalise to the explicit psycopg2 dialect so the exact
        string copied out of the Render dashboard works unedited.
        """
        if not isinstance(v, str):
            return v
        v = v.strip()
        if v.startswith("postgres://"):
            v = "postgresql+psycopg2://" + v[len("postgres://"):]
        elif v.startswith("postgresql://"):
            v = "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def on_container_host(self) -> bool:
        """
        True when running on a PaaS whose filesystem is ephemeral. Used to
        distinguish "SQLite on a laptop" (perfectly durable) from "SQLite
        on Render" (data destroyed on every restart).
        """
        return bool(
            os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("DYNO")
        )

    @property
    def storage_is_durable(self) -> bool:
        """False only in the configuration that actually loses data."""
        return not (self.is_sqlite and self.on_container_host)

    @property
    def db_backend(self) -> str:
        """Short, non-sensitive label for logs and the health endpoint."""
        if self.is_sqlite:
            return "sqlite"
        if self.DATABASE_URL.startswith("postgresql"):
            return "postgresql"
        return self.DATABASE_URL.split("://", 1)[0] or "unknown"

    @property
    def cors_origins_list(self) -> list[str]:
        raw = (self.CORS_ORIGINS or "*").strip()
        if raw.startswith("["):
            try:
                return [str(o).strip() for o in json.loads(raw) if str(o).strip()]
            except (ValueError, TypeError):
                pass
        return [o.strip() for o in raw.split(",") if o.strip()] or ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
