#!/usr/bin/env python3
"""
One-way data migration: existing SQLite `library.db` -> PostgreSQL.

Run from the `backend/` directory:

    # 1. See what is in the source file (reads only, changes nothing)
    python -m scripts.migrate_sqlite_to_postgres --counts --source library.db

    # 2. Rehearse the migration - validates and converts every row,
    #    then rolls back without committing anything
    DATABASE_URL="postgresql://..." python -m scripts.migrate_sqlite_to_postgres \
        --source library.db --dry-run

    # 3. Do it for real
    DATABASE_URL="postgresql://..." python -m scripts.migrate_sqlite_to_postgres \
        --source library.db

Safety properties
-----------------
* The SQLite file is opened READ-ONLY. It is never written to or deleted.
* The whole migration runs in ONE transaction. Any error rolls back
  everything - there is no half-migrated state.
* By default it refuses to run if the target already holds library data,
  so a second accidental run cannot duplicate or clobber rows. Override
  deliberately with --force.
* Primary keys are preserved exactly, so every foreign key relationship
  (book -> series, copy -> book, issue -> magazine, sub-series -> series)
  survives untouched.
* Postgres identity sequences are reset afterwards. Skipping this is the
  classic post-migration bug: rows import fine, then the very next book
  someone adds fails with "duplicate key value violates unique constraint"
  because the sequence still thinks it is at 1.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, create_engine, inspect, text
from sqlalchemy.orm import Session

# Import the app's own metadata so the target schema is guaranteed to match
# the live models - no hand-maintained duplicate schema to drift out of sync.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings          # noqa: E402
from app.database import Base            # noqa: E402
from app import models                   # noqa: E402  (registers all tables on Base)

# Parent-before-child. Every table's foreign keys point only at tables
# already listed above it, so inserts never hit a missing-reference error.
TABLE_ORDER = [
    "users",
    "series",
    "sub_series",
    "books",
    "book_copies",
    "magazines",
    "magazine_issues",
    "login_logs",
    "backup_logs",
]


def log(msg: str = "") -> None:
    print(msg, flush=True)


# ----------------------------------------------------------------------
# Value coercion: SQLite is loosely typed, Postgres is not
# ----------------------------------------------------------------------
def coerce_value(value, column):
    """
    Convert one raw SQLite value into something Postgres will accept for
    this column. SQLite happily stores dates as TEXT, booleans as 0/1 and
    enums as bare strings; Postgres rejects all three.
    """
    if value is None:
        return None

    col_type = column.type

    # Enum columns. SQLAlchemy's Enum() persists the member NAME
    # ("ADMIN", "BOOK", "AVAILABLE"), which is what the SQLite file
    # contains. Older rows or hand-edited data may hold the VALUE
    # ("admin", "book") instead, so try both before giving up.
    if isinstance(col_type, SAEnum) and col_type.enum_class is not None:
        enum_cls = col_type.enum_class
        if isinstance(value, enum_cls):
            return value
        if isinstance(value, str):
            try:
                return enum_cls[value]           # by name: "ADMIN"
            except KeyError:
                pass
            try:
                return enum_cls(value)           # by value: "admin"
            except ValueError:
                raise ValueError(
                    f"Value {value!r} in column {column.name!r} is not a valid "
                    f"{enum_cls.__name__} (expected one of "
                    f"{[m.name for m in enum_cls]})"
                )
        return value

    # DateTime columns: SQLite hands back "2026-07-18 16:49:23.193323"
    if isinstance(col_type, DateTime):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value

    # Date columns: SQLite hands back "2026-07-26"
    if isinstance(col_type, Date):
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value[:10])
        return value

    # Boolean columns: SQLite stores 1 / 0
    if isinstance(col_type, Boolean):
        if isinstance(value, bool):
            return value
        return bool(value)

    return value


# ----------------------------------------------------------------------
# Source inspection
# ----------------------------------------------------------------------
def open_sqlite_readonly(path: str) -> sqlite3.Connection:
    if not os.path.exists(path):
        raise SystemExit(f"ERROR: SQLite file not found: {path}")
    # file: URI with mode=ro guarantees the source is never modified.
    uri = f"file:{os.path.abspath(path)}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def sqlite_table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    return {r["name"] for r in rows}


def sqlite_column_names(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r["name"] for r in conn.execute(f'PRAGMA table_info("{table}")')}


def report_counts(conn: sqlite3.Connection) -> dict[str, int]:
    present = sqlite_table_names(conn)
    counts: dict[str, int] = {}
    for table in TABLE_ORDER:
        if table not in present:
            counts[table] = -1
            continue
        counts[table] = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    return counts


def print_counts(title: str, counts: dict[str, int]) -> None:
    log(f"\n{title}")
    log("-" * 46)
    total = 0
    for table, n in counts.items():
        if n < 0:
            log(f"  {table:<22} (table not present)")
        else:
            log(f"  {table:<22} {n:>8}")
            total += n
    log("-" * 46)
    log(f"  {'TOTAL ROWS':<22} {total:>8}\n")


# ----------------------------------------------------------------------
# Target inspection
# ----------------------------------------------------------------------
def target_counts(session: Session) -> dict[str, int]:
    counts = {}
    existing = set(inspect(session.get_bind()).get_table_names())
    for table in TABLE_ORDER:
        if table not in existing:
            counts[table] = -1
            continue
        counts[table] = session.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar() or 0
    return counts


def reset_sequences(session: Session) -> None:
    """
    Realign each table's identity sequence with the highest id actually
    present, so the next INSERT gets a free id instead of colliding.
    """
    for table in TABLE_ORDER:
        session.execute(text(f"""
            SELECT setval(
                pg_get_serial_sequence('"{table}"', 'id'),
                COALESCE((SELECT MAX(id) FROM "{table}"), 0) + 1,
                false
            )
            WHERE pg_get_serial_sequence('"{table}"', 'id') IS NOT NULL
        """))
    log("  Identity sequences realigned to MAX(id) + 1.")


# ----------------------------------------------------------------------
# Migration
# ----------------------------------------------------------------------
def migrate(source_path: str, target_url: str, dry_run: bool, force: bool) -> int:
    sqlite_conn = open_sqlite_readonly(source_path)
    src_counts = report_counts(sqlite_conn)
    print_counts(f"SOURCE  {source_path}", src_counts)

    if sum(n for n in src_counts.values() if n > 0) == 0:
        log("WARNING: the source database contains no rows at all.")
        if not force:
            log("Nothing to migrate. Re-run with --force if this is expected.")
            return 1

    if target_url.startswith("sqlite"):
        raise SystemExit(
            "ERROR: target DATABASE_URL still points at SQLite.\n"
            "       Set DATABASE_URL to your Postgres connection string first."
        )

    engine = create_engine(target_url, pool_pre_ping=True)
    log(f"TARGET  {engine.url.render_as_string(hide_password=True)}")

    # Create any missing tables using the app's own models, so the target
    # schema is identical to what the running app expects.
    Base.metadata.create_all(bind=engine)
    log("  Target schema verified / created.\n")

    with Session(engine) as session:
        tgt_before = target_counts(session)
        occupied = {t: n for t, n in tgt_before.items() if n > 0}
        # A lone bootstrap admin row is expected (the app seeds it on first
        # boot) and must not block the migration.
        meaningful = {t: n for t, n in occupied.items() if t != "users"}
        if meaningful and not force:
            print_counts("TARGET already contains data", tgt_before)
            log("ERROR: refusing to migrate into a non-empty database.")
            log("       Existing rows could be duplicated or collide on primary key.")
            log("       Review the target, then re-run with --force if you are sure.")
            return 1

        total_inserted = 0
        try:
            for table_name in TABLE_ORDER:
                if src_counts.get(table_name, -1) < 0:
                    log(f"  {table_name:<22} skipped (not in source)")
                    continue

                table = Base.metadata.tables[table_name]
                src_cols = sqlite_column_names(sqlite_conn, table_name)
                # Only migrate columns that exist on BOTH sides. A column
                # added to the models after this .db file was written (e.g.
                # users.mobile_number) simply takes its default.
                shared = [c for c in table.columns if c.name in src_cols]
                dropped = [c.name for c in table.columns if c.name not in src_cols]

                rows = sqlite_conn.execute(f'SELECT * FROM "{table_name}"').fetchall()
                if not rows:
                    log(f"  {table_name:<22} 0 rows")
                    continue

                payload = []
                for row in rows:
                    payload.append({
                        col.name: coerce_value(row[col.name], col)
                        for col in shared
                    })

                session.execute(table.insert(), payload)
                total_inserted += len(payload)
                note = f"  (defaulted: {', '.join(dropped)})" if dropped else ""
                log(f"  {table_name:<22} {len(payload):>8} rows{note}")

            if dry_run:
                session.rollback()
                log(f"\nDRY RUN complete - {total_inserted} rows validated and converted "
                    f"successfully, then rolled back. Nothing was written.")
                return 0

            reset_sequences(session)
            session.commit()
            log(f"\nMigration committed: {total_inserted} rows.")

        except Exception:
            session.rollback()
            log("\nERROR: migration failed and was rolled back in full. "
                "The target database is unchanged.")
            raise

        # Post-commit verification against the source
        tgt_after = target_counts(session)
        print_counts("TARGET after migration", tgt_after)

        mismatches = []
        for table in TABLE_ORDER:
            s = src_counts.get(table, -1)
            if s < 0:
                continue
            t = tgt_after.get(table, 0)
            before = tgt_before.get(table, 0) if tgt_before.get(table, 0) > 0 else 0
            if t - before != s:
                mismatches.append(f"{table}: source {s}, target gained {t - before}")

        if mismatches:
            log("WARNING: row counts do not line up:")
            for m in mismatches:
                log(f"  - {m}")
            return 1

        log("Row counts match the source exactly. Migration verified.")

    sqlite_conn.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate library data from SQLite to PostgreSQL."
    )
    parser.add_argument("--source", default="library.db",
                        help="Path to the SQLite file (default: library.db)")
    parser.add_argument("--target", default=None,
                        help="Target DB URL (default: DATABASE_URL from env/.env)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Convert and validate every row, then roll back.")
    parser.add_argument("--force", action="store_true",
                        help="Proceed even if the target already contains data.")
    parser.add_argument("--counts", action="store_true",
                        help="Only print source row counts and exit.")
    args = parser.parse_args()

    if args.counts:
        conn = open_sqlite_readonly(args.source)
        print_counts(f"SOURCE  {args.source}", report_counts(conn))
        conn.close()
        return 0

    target_url = args.target or settings.DATABASE_URL
    return migrate(args.source, target_url, args.dry_run, args.force)


if __name__ == "__main__":
    raise SystemExit(main())
