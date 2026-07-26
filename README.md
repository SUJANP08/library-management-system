# Library Management System

A mobile-first, multilingual Library Management Web Application for an entire
library — books, magazines, and any future material types — built with:

- **Frontend:** React + TypeScript + Tailwind CSS (mobile-first, Android-friendly)
- **Backend:** FastAPI (Python)
- **Database:** SQLite by default, PostgreSQL supported for larger deployments
- **Auth:** JWT-based login with Admin / Staff roles
- **Reports:** Printable PDF and Excel exports
- **Deployment:** Docker & Docker Compose

---

## 1. Core Features

- **Taranga (periodicals) module** — a deliberately simple, quick-entry
  workflow for magazines/periodicals. Adding a Taranga entry only requires
  **Series, Title, and Month** — the serial number (e.g. `M-1`, `M-2`) is
  assigned automatically, same numbering engine as books. Every entry gets
  its own fresh serial (no title de-duplication, since each physical issue
  is catalogued separately).
- **Simplified Book entry** — adding/editing a book only asks for **Series,
  Title, and Author**. Extra fields (language, publisher, year, ISBN, notes)
  still exist in the database schema for future use, just hidden from the
  day-to-day data-entry form.
- **Dynamic Series Management** — admins create/edit/delete series (A, B, C,
  G, and any future J, K, L...) entirely through the UI. No code changes ever
  required to add a new category.
- **Automatic serial numbering** — adding a book to a series automatically
  assigns the next number in that series (e.g. `A-74`).
- **Automatic duplicate/copy detection** — adding a book with the same title
  + author already present in a series registers it as an additional copy
  instead of a duplicate record: `A-74`, then once a second copy exists,
  every copy is labelled with its copy number - `A-74(1)`, `A-74(2)`, ...
- **Delete Book** with a confirmation dialog, automatic list refresh, and a
  success toast. Deletion is blocked with a clear message if any copy of the
  book is currently marked "issued" — return it first, then delete.
- **Full CRUD** for books, copies, series, and Taranga entries, with search
  and filter by title, author, series/category, or serial number.
- **Minimal, focused Dashboard** — a single Total Books stat, a Recently
  Added Books list, and Quick Actions (Add Book, Add Taranga, Generate
  Report).
- **PDF & Excel report generation** for any series/category/author, with
  columns Serial Number, Book Title, Author, Category.
- **Excel bulk import** of books into a chosen series.
- **Backup & Restore** — full JSON export/import of all library data (admin
  only), plus raw SQLite file download when using SQLite.
- **Kannada & multilingual Unicode support** throughout — data entry, search,
  and Excel export all handle Unicode natively; PDF export supports Kannada
  glyphs once a Noto Sans Kannada font file is added (see §6).
- **Mobile-first, Android-friendly UI** — large tap targets, bottom
  navigation on phones, and plain `<input>`/`<textarea>` fields (with
  `lang="kn"`) that work naturally with Gboard's built-in voice typing and
  handwriting input — no special integration code is needed, since Gboard
  types directly into any standard text field.

---

## 2. Project Structure

```
library-management-system/
├── backend/                 FastAPI application
│   ├── app/
│   │   ├── main.py          App entrypoint, startup bootstrap
│   │   ├── config.py        Settings (env vars)
│   │   ├── database.py      SQLAlchemy engine/session
│   │   ├── models.py        ORM models / schema
│   │   ├── schemas.py       Pydantic request/response models
│   │   ├── auth.py          JWT auth, password hashing
│   │   ├── crud.py          Serial-numbering & copy-detection logic
│   │   ├── routers/         API endpoints (series, books, magazines, ...)
│   │   ├── utils/           PDF & Excel generators
│   │   └── fonts/           Place NotoSansKannada-Regular.ttf here
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 React + TypeScript + Tailwind app
│   ├── src/
│   │   ├── pages/            Dashboard, Books, Taranga, Series, Reports, Settings, Login
│   │   ├── components/       Layout, forms, protected route
│   │   ├── context/          Auth context
│   │   ├── api/               Axios client
│   │   └── types/             Shared TS types
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── docker-compose.yml
└── README.md
```

---

## 3. Quick Start with Docker (recommended)

Requires Docker and Docker Compose installed.

```bash
cd library-management-system
docker compose up --build -d
```

This starts three containers:

| Service  | URL                     | Notes                              |
|----------|-------------------------|-------------------------------------|
| frontend | http://localhost        | React app served by nginx           |
| backend  | http://localhost:8000   | FastAPI, docs at /docs              |
| db       | localhost:5432          | PostgreSQL                          |

Default login: **admin / admin123** — change this immediately after first
login via Settings → User Management (create a new admin, then remove/disable
the default one), or set `DEFAULT_ADMIN_PASSWORD` before first startup.

To stop: `docker compose down` (add `-v` to also wipe the database volume).

---

## 4. Manual / Local Development Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # edit as needed (SECRET_KEY, DB, etc.)

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API docs (Swagger UI): http://localhost:8000/docs
- On first run, a default admin user and a starter set of series
  (A, B, C, G, M) are created automatically. Edit/remove them anytime.
- By default this uses SQLite (`library.db` file, zero configuration). To use
  PostgreSQL instead, install Postgres, create a database, and set
  `DATABASE_URL=postgresql://user:pass@host:5432/dbname` in `.env`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- Opens at http://localhost:5173
- The Vite dev server proxies `/api/*` to `http://localhost:8000` (see
  `vite.config.ts`) so the backend must be running first.
- For production build: `npm run build` (outputs to `dist/`), then serve
  `dist/` with any static file server or the provided nginx Dockerfile.

---

## 5. Authentication & Roles

- **Admin** — full access: manage series, users, delete records, import/
  restore data.
- **Staff** — add/edit books, magazines, issues, copies; generate reports;
  cannot delete series or manage users.

Create additional users from Settings → User Management (admin only), or via
the API: `POST /api/auth/users`.

---

## 6. Kannada / Unicode Support Details

- **Database & API:** UTF-8 end-to-end (SQLite and PostgreSQL both store
  Unicode natively); no configuration needed.
- **Excel export/import:** openpyxl handles Unicode text natively — Kannada
  titles/authors round-trip correctly.
- **PDF export:** reportlab's built-in fonts don't include Kannada glyphs. To
  enable Kannada rendering in PDFs:
  1. Download `NotoSansKannada-Regular.ttf` (Google Fonts, open license).
  2. Place it at `backend/app/fonts/NotoSansKannada-Regular.ttf`.
  3. Restart the backend — PDF export automatically detects and uses it.
  Without the font file, PDF export still works for Latin-script data;
  Kannada glyphs may appear as blank boxes until the font is added.
- **UI input:** All text fields use `lang="kn"` and standard HTML inputs, so
  Android's Gboard keyboard offers Kannada script, voice typing, and
  handwriting input automatically — no extra integration required.

---

## 7. Report Columns

Generated PDF/Excel reports include, per copy:

Serial Number | Book Title | Author | Category

Filter by series/category and/or author before generating from the Reports
page, or call the API directly:

```
GET /api/reports/books/pdf?series_id=1
GET /api/reports/books/excel?series_code=A&author=Kuvempu
```

---

## 8. Backup & Restore

- **Export:** Settings → Backup → Download Backup (admin only). Produces a
  timestamped JSON file containing all series, books, copies, magazines, and
  issues (passwords are never included).
- **Restore:** Settings → Restore → upload a previously exported JSON file.
  Choose "Erase existing data" for a full replace, or leave unchecked to
  merge/insert.
- **Raw SQLite backup:** `GET /api/backup/download-sqlite` (admin only, SQLite
  deployments only) downloads the live `.db` file directly.
- Automate periodic backups by calling `GET /api/backup/export` from a cron
  job with an admin token.

---

## 9. Extending the System

- **New series/categories:** just add them from Series Management — no code
  changes.
- **New material types beyond books/magazines:** the `material_type` field on
  Series accepts `book`, `magazine`, or `other`; the same numbering engine
  (`A-1`, `A-2`, ...) applies to any future type. To fully model a new
  material's extra fields, add a table similar to `Book`/`Magazine` in
  `models.py` and a matching router — the series/serial-numbering
  infrastructure is reused as-is.
- **Alembic migrations:** the project ships with `Base.metadata.create_all()`
  for simplicity. For evolving production schemas, initialize Alembic
  (`alembic init alembic`) and generate migrations from `app.models.Base`.

---

## 10. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./library.db` | DB connection string |
| `SECRET_KEY` | *(placeholder)* | JWT signing key — **change in production** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | Login session length |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Bootstrap admin username |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Bootstrap admin password |
| `BACKUP_DIR` | `./backups` | Where backup files are written |
| `UPLOAD_DIR` | `./uploads` | Reserved for future file uploads |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` (relative) | Set only if backend is on a different domain |

---

## 11. Security Notes for Production

- Change `SECRET_KEY` and the default admin password before going live.
- Put the app behind HTTPS (e.g. via a reverse proxy like Caddy/Traefik in
  front of the provided nginx container).
- Restrict `CORS_ORIGINS` in `backend/app/config.py` to your real frontend
  domain instead of `*`.
- Take regular backups (see §8) and store them off-server.
