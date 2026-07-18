"""
Generates printable PDF reports.

Rendering engine note: this used to be built with reportlab. reportlab could
have Noto Sans Kannada *registered* as a font (correct glyph outlines), but
it has no OpenType text-shaping engine (no HarfBuzz/GSUB/GPOS support).
Kannada, like other Brahmic scripts, needs shaping to (a) reorder vowel signs
(matras) around the consonants they belong to and (b) merge consonant
clusters into conjunct ligatures via the virama. Without that, reportlab just
drew each character's raw glyph in sequence - the letters were all present,
but visually jumbled/merged, which is why it looked wrong (readers described
it as looking like a different, unrelated script).

This module now builds the report as HTML/CSS and renders it with
WeasyPrint, which uses Pango for text layout - Pango in turn uses HarfBuzz to
shape text correctly for Kannada (and any other Unicode script), so titles,
authors, and category names render the same way a browser would show them.
"""
import os
from datetime import datetime
from urllib.request import pathname2url

from fastapi import HTTPException

FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts")
FONT_PATH = os.path.join(FONT_DIR, "NotoSansKannada-Regular.ttf")


def _get_html_class():
    """
    Import WeasyPrint lazily, on first actual use, instead of at module load
    time. WeasyPrint needs system libraries (Pango/cairo/gdk-pixbuf) to import
    at all - if those aren't installed, a top-level `from weasyprint import
    HTML` would raise during `import app.main`, which FastAPI loads as one
    unit at startup. That would crash the ENTIRE application - login,
    dashboard, everything - just because one optional feature (PDF export)
    had a missing system dependency. Importing here means a missing
    WeasyPrint install only breaks the PDF export endpoint, with a clear
    error message, and everything else keeps working.
    """
    try:
        from weasyprint import HTML
        return HTML
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "PDF export is unavailable: the server's PDF rendering library "
                "(WeasyPrint) is not installed correctly. Ask your administrator "
                "to run 'pip install -r requirements.txt' and ensure the required "
                "system libraries (libpango, libcairo, libgdk-pixbuf) are installed. "
                f"({e.__class__.__name__}: {e})"
            ),
        )


def _esc(value) -> str:
    """Minimal HTML-escaping for values dropped into the template."""
    return (
        str(value if value is not None else "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _font_face_css() -> str:
    if not os.path.exists(FONT_PATH):
        # Falls back to whatever sans-serif WeasyPrint finds on the system;
        # Kannada glyphs won't render correctly in that fallback case.
        return ""
    font_url = "file://" + pathname2url(FONT_PATH)
    return f"""
    @font-face {{
        font-family: "NotoSansKannada";
        src: url("{font_url}");
    }}
    """


def generate_books_pdf(rows: list[dict], title: str = "Library Report", order_label: str = "") -> bytes:
    """
    rows: list of dicts with keys: serial, title, author, category, sub_category
    order_label: optional human-readable view mode shown in the report meta line,
    e.g. "Series Order" or "Latest Added Order".
    Returns raw PDF bytes.
    """
    meta_text = f"Generated on {datetime.now().strftime('%d-%b-%Y %H:%M')} &nbsp;|&nbsp; Total records: {len(rows)}"
    if order_label:
        meta_text += f" &nbsp;|&nbsp; View: {order_label}"

    body_rows = "\n".join(
        f"""<tr>
            <td class="serial">{_esc(r.get('serial'))}</td>
            <td>{_esc(r.get('title'))}</td>
            <td>{_esc(r.get('author'))}</td>
            <td>{_esc(r.get('category'))}</td>
            <td>{_esc(r.get('sub_category', '—'))}</td>
        </tr>"""
        for r in rows
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    {_font_face_css()}
    @page {{ size: A4 landscape; margin: 15mm 12mm; }}
    * {{ box-sizing: border-box; }}
    body {{
        font-family: "NotoSansKannada", "Helvetica", "Arial", sans-serif;
        font-size: 9pt;
        color: #222222;
        margin: 0;
    }}
    h1 {{ font-size: 16pt; margin: 0 0 4px 0; }}
    p.meta {{ font-size: 9pt; color: #666666; margin: 0 0 8px 0; }}
    table {{ width: 100%; border-collapse: collapse; }}
    thead {{ display: table-header-group; }}
    tr {{ page-break-inside: avoid; }}
    th, td {{
        border: 0.5pt solid #cccccc;
        padding: 4pt 5pt;
        text-align: left;
        vertical-align: middle;
    }}
    th {{
        background: #1e3a5f;
        color: #ffffff;
    }}
    tbody tr:nth-child(even) {{ background: #f4f6f8; }}
    col.serial {{ width: 30mm; }}
    col.title  {{ width: 95mm; }}
    col.author {{ width: 60mm; }}
    col.cat    {{ width: 45mm; }}
    col.sub    {{ width: 45mm; }}
</style>
</head>
<body>
    <h1>{_esc(title)}</h1>
    <p class="meta">{meta_text}</p>
    <table>
        <colgroup>
            <col class="serial"><col class="title"><col class="author"><col class="cat"><col class="sub">
        </colgroup>
        <thead>
            <tr>
                <th>Serial No.</th>
                <th>Book Title</th>
                <th>Author</th>
                <th>Main Series</th>
                <th>Sub-Series / Category</th>
            </tr>
        </thead>
        <tbody>
            {body_rows}
        </tbody>
    </table>
</body>
</html>
"""

    HTML = _get_html_class()
    return HTML(string=html, base_url=FONT_DIR).write_pdf()
