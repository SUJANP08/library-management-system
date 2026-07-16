"""
Application configuration.
Reads from environment variables / .env file so nothing sensitive is hardcoded.
"""
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Database: defaults to local SQLite file, can be pointed at Postgres via env var
    #   e.g. DATABASE_URL=postgresql://user:pass@localhost:5432/library
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

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
