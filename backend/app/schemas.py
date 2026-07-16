"""
Pydantic schemas used for request validation and response serialization.
Kept separate from ORM models (app.models) as per FastAPI best practice.
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

from app.models import MaterialType, CopyStatus, UserRole


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.STAFF


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: Optional[str] = None
    role: UserRole
    is_active: bool


# ---------- Series ----------
class SeriesCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=10, description="e.g. A, B, G, AA")
    name: str
    description: Optional[str] = None
    material_type: MaterialType = MaterialType.BOOK


class SeriesUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    material_type: Optional[MaterialType] = None
    is_active: Optional[bool] = None


class SeriesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    description: Optional[str] = None
    material_type: MaterialType
    next_serial: int
    is_active: bool
    book_count: Optional[int] = 0


# ---------- Book Copies ----------
class BookCopyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    copy_number: int
    status: CopyStatus
    acquired_date: Optional[date] = None
    remarks: Optional[str] = None
    display_serial: str = ""
    created_at: Optional[datetime] = None


class BookCopyUpdate(BaseModel):
    status: Optional[CopyStatus] = None
    remarks: Optional[str] = None
    acquired_date: Optional[date] = None


# ---------- Books ----------
class BookCreate(BaseModel):
    series_id: int
    title: str
    author: str
    language: Optional[str] = None
    publisher: Optional[str] = None
    year_published: Optional[int] = None
    isbn: Optional[str] = None
    notes: Optional[str] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    language: Optional[str] = None
    publisher: Optional[str] = None
    year_published: Optional[int] = None
    isbn: Optional[str] = None
    notes: Optional[str] = None


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    series_id: int
    series_code: str = ""
    series_name: str = ""
    base_serial: int
    title: str
    author: str
    language: Optional[str] = None
    publisher: Optional[str] = None
    year_published: Optional[int] = None
    isbn: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    copies: List[BookCopyOut] = []
    total_copies: int = 0
    display_serial: str = ""  # base display e.g. "A-74"
    latest_activity: Optional[datetime] = None  # created_at of the newest copy (or the book itself if no copies)


class AddCopyRequest(BaseModel):
    """Used when the same title+author already exists in a series and the
    user wants to add another physical copy (A-74(2), A-74(3), ...)."""
    book_id: int
    acquired_date: Optional[date] = None
    remarks: Optional[str] = None


# ---------- Taranga (Magazines) ----------
class TarangaCreate(BaseModel):
    """Simplified quick-entry: only Series + Title + Month are required.
    Every submission gets its own brand-new serial number - no dedup/merge,
    unlike books. Other fields (publisher, language, frequency, notes) are
    kept in the database for future use but are never required here."""
    series_id: int
    title: str
    month: Optional[str] = None


class MagazineCreate(BaseModel):
    # Retained for API completeness / future advanced use; the UI only
    # ever sends series_id, title, and month via TarangaCreate above.
    series_id: int
    title: str
    month: Optional[str] = None
    publisher: Optional[str] = None
    language: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None


class MagazineUpdate(BaseModel):
    title: Optional[str] = None
    month: Optional[str] = None
    publisher: Optional[str] = None
    language: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None


class MagazineIssueCreate(BaseModel):
    magazine_id: int
    issue_number: Optional[str] = None
    issue_period: Optional[str] = None
    received_date: Optional[date] = None
    remarks: Optional[str] = None


class MagazineIssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_number: Optional[str] = None
    issue_period: Optional[str] = None
    received_date: Optional[date] = None
    status: CopyStatus
    remarks: Optional[str] = None


class MagazineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    series_id: int
    series_code: str = ""
    base_serial: int
    title: str
    month: Optional[str] = None
    publisher: Optional[str] = None
    language: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None
    display_serial: str = ""
    issues: List[MagazineIssueOut] = []
    issue_count: int = 0


# ---------- Dashboard ----------
class DashboardStats(BaseModel):
    total_books: int
    recent_additions: List[BookOut]


# ---------- Pagination wrapper ----------
class PaginatedBooks(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[BookOut]
