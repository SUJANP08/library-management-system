"""
Core database schema.

Design notes
------------
- Series: dynamically managed by admins (A, B, C, G, ... or any future code).
  Each series has its own auto-incrementing serial counter, independent of
  other series, so "A-1, A-2, A-3..." and "G-1, G-2..." grow separately.
- Book: one row per unique (series, title, author). Holds the "base serial"
  number, e.g. 74 for A-74.
- BookCopy: one row per physical copy of a Book. copy_number 1, 2, 3...
  Display format is "A-74" for the first copy and "A-74(2)", "A-74(3)"
  for additional copies, matching the requested numbering scheme.
- Magazine / MagazineIssue mirrors the same pattern for periodicals, with
  issue tracking (issue number + issue date/period) instead of copies.
- Everything is Unicode (UTF-8) by default in both SQLite and Postgres,
  so Kannada and other scripts are stored/retrieved without extra config.
"""
import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, ForeignKey, Boolean,
    Enum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship

from app.database import Base


class MaterialType(str, enum.Enum):
    BOOK = "book"
    MAGAZINE = "magazine"
    OTHER = "other"  # future-proof: any new material type without a schema change


class CopyStatus(str, enum.Enum):
    AVAILABLE = "available"
    ISSUED = "issued"
    LOST = "lost"
    DAMAGED = "damaged"
    WITHDRAWN = "withdrawn"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    STAFF = "staff"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STAFF, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Series(Base):
    """
    Dynamic series/category, e.g.:
      A = Kannada Story Books
      B = Kannada Kavya & Nataka
      C = Science Books
      G = English Story Books
    Admins can add/edit/delete these at any time; the code never hardcodes them.
    """
    __tablename__ = "series"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)  # "A", "B", "G", "AA"...
    name = Column(String(255), nullable=False)  # "Kannada Story Books"
    description = Column(Text, nullable=True)
    material_type = Column(Enum(MaterialType), default=MaterialType.BOOK, nullable=False)
    next_serial = Column(Integer, default=1, nullable=False)  # next base serial to assign
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    books = relationship("Book", back_populates="series", cascade="all, delete-orphan")
    magazines = relationship("Magazine", back_populates="series", cascade="all, delete-orphan")


class Book(Base):
    """
    One row per unique (series, title, author) combination.
    Physical copies live in BookCopy.
    """
    __tablename__ = "books"
    __table_args__ = (
        UniqueConstraint("series_id", "base_serial", name="uq_series_serial"),
        Index("ix_book_title_author", "title", "author"),
    )

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id"), nullable=False)
    base_serial = Column(Integer, nullable=False)  # e.g. 74 -> "A-74"

    title = Column(String(500), nullable=False)
    author = Column(String(300), nullable=False)
    language = Column(String(50), nullable=True)          # Kannada, English, Hindi...
    publisher = Column(String(300), nullable=True)
    year_published = Column(Integer, nullable=True)
    isbn = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="books")
    copies = relationship("BookCopy", back_populates="book", cascade="all, delete-orphan",
                           order_by="BookCopy.copy_number")


class BookCopy(Base):
    """
    A single physical copy of a Book.
    copy_number 1 -> displayed as "A-74"
    copy_number 2 -> displayed as "A-74(2)"
    copy_number 3 -> displayed as "A-74(3)"
    """
    __tablename__ = "book_copies"
    __table_args__ = (
        UniqueConstraint("book_id", "copy_number", name="uq_book_copy_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    copy_number = Column(Integer, nullable=False, default=1)
    status = Column(Enum(CopyStatus), default=CopyStatus.AVAILABLE, nullable=False)
    acquired_date = Column(Date, default=date.today)
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book", back_populates="copies")


class Magazine(Base):
    """
    A magazine/periodical title within a series (e.g. series could be a
    dedicated 'Magazines' series, or reuse category series like admins wish).
    """
    __tablename__ = "magazines"
    __table_args__ = (
        UniqueConstraint("series_id", "base_serial", name="uq_mag_series_serial"),
    )

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id"), nullable=False)
    base_serial = Column(Integer, nullable=False)

    title = Column(String(500), nullable=False)
    month = Column(String(50), nullable=True)  # e.g. "July 2026" - the primary field for quick Taranga entry
    publisher = Column(String(300), nullable=True)  # kept in DB for future use, not shown in simplified UI
    language = Column(String(50), nullable=True)     # kept in DB for future use, not shown in simplified UI
    frequency = Column(String(50), nullable=True)    # kept in DB for future use, not shown in simplified UI
    notes = Column(Text, nullable=True)               # kept in DB for future use, not shown in simplified UI

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="magazines")
    issues = relationship("MagazineIssue", back_populates="magazine", cascade="all, delete-orphan",
                           order_by="MagazineIssue.id")


class MagazineIssue(Base):
    """A single tracked issue of a magazine."""
    __tablename__ = "magazine_issues"

    id = Column(Integer, primary_key=True, index=True)
    magazine_id = Column(Integer, ForeignKey("magazines.id"), nullable=False)
    issue_number = Column(String(50), nullable=True)   # e.g. "Vol 12 No 4"
    issue_period = Column(String(50), nullable=True)   # e.g. "July 2026"
    received_date = Column(Date, default=date.today)
    status = Column(Enum(CopyStatus), default=CopyStatus.AVAILABLE, nullable=False)
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    magazine = relationship("Magazine", back_populates="issues")


class BackupLog(Base):
    __tablename__ = "backup_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    created_by = Column(String(100), nullable=True)
    record_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
