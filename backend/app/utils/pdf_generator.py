"""
Generates printable PDF reports.

Unicode note: reportlab's built-in fonts (Helvetica, Times, etc.) only cover
Latin glyphs, which is why Kannada text used to render as black boxes/squares.
This module bundles Noto Sans Kannada (app/fonts/NotoSansKannada-Regular.ttf,
a static Regular instance of Google's Noto Sans Kannada) and registers it with
reportlab so Kannada book titles, author names, and category names render
correctly alongside English text in every generated PDF report. If the font
file is ever missing (e.g. a stripped-down deployment), we fall back to
Helvetica so Latin text still renders rather than raising an error - though
Kannada characters won't display correctly in that fallback case.
"""
import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts")
UNICODE_FONT_NAME = "NotoSansKannada"
_font_registered = False


def _ensure_unicode_font():
    global _font_registered
    if _font_registered:
        return UNICODE_FONT_NAME if _font_registered == "ok" else "Helvetica"
    ttf_path = os.path.join(FONT_DIR, "NotoSansKannada-Regular.ttf")
    if os.path.exists(ttf_path):
        try:
            pdfmetrics.registerFont(TTFont(UNICODE_FONT_NAME, ttf_path))
            _font_registered = "ok"
            return UNICODE_FONT_NAME
        except Exception:
            pass  # fall through to Helvetica fallback below
    _font_registered = "fallback"
    return "Helvetica"


def generate_books_pdf(rows: list[dict], title: str = "Library Report", order_label: str = "") -> bytes:
    """
    rows: list of dicts with keys: serial, title, author, category, copy_number, status
    order_label: optional human-readable view mode shown in the report meta line,
    e.g. "Series Order" or "Latest Added Order".
    Returns raw PDF bytes.
    """
    font_name = _ensure_unicode_font()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        topMargin=15 * mm, bottomMargin=15 * mm, leftMargin=12 * mm, rightMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleStyle", parent=styles["Title"], fontName=font_name, fontSize=16)
    meta_style = ParagraphStyle("MetaStyle", parent=styles["Normal"], fontName=font_name, fontSize=9,
                                 textColor=colors.grey)
    cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontName=font_name, fontSize=9, leading=12)
    header_style = ParagraphStyle("Header", parent=styles["Normal"], fontName=font_name, fontSize=10,
                                   textColor=colors.white, leading=12)

    meta_text = f"Generated on {datetime.now().strftime('%d-%b-%Y %H:%M')} &nbsp;|&nbsp; Total records: {len(rows)}"
    if order_label:
        meta_text += f" &nbsp;|&nbsp; View: {order_label}"

    elements = [
        Paragraph(title, title_style),
        Paragraph(meta_text, meta_style),
        Spacer(1, 8),
    ]

    headers = ["Serial No.", "Book Title", "Author", "Category"]
    table_data = [[Paragraph(h, header_style) for h in headers]]
    for r in rows:
        table_data.append([
            Paragraph(str(r.get("serial", "")), cell_style),
            Paragraph(str(r.get("title", "")), cell_style),
            Paragraph(str(r.get("author", "")), cell_style),
            Paragraph(str(r.get("category", "")), cell_style),
        ])

    col_widths = [35 * mm, 110 * mm, 70 * mm, 55 * mm]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f8")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
