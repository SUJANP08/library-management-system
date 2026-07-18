"""
Generates Excel (.xlsx) reports. openpyxl handles Unicode/Kannada text natively
since XLSX stores strings as UTF-8/shared strings - no special font handling needed.
"""
import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def generate_books_excel(rows: list[dict], title: str = "Library Report", order_label: str = "") -> bytes:
    """
    rows: list of dicts with keys: serial, title, author, category, copy_number, status
    order_label: optional human-readable view mode shown in the meta row,
    e.g. "Series Order" or "Latest Added Order".
    Returns raw XLSX bytes.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Library Report"

    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    title_font = Font(bold=True, size=14)
    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    ws.merge_cells("A1:D1")
    ws["A1"] = title
    ws["A1"].font = title_font

    meta_text = f"Generated on {datetime.now().strftime('%d-%b-%Y %H:%M')} | Total records: {len(rows)}"
    if order_label:
        meta_text += f" | View: {order_label}"

    ws.merge_cells("A2:D2")
    ws["A2"] = meta_text
    ws["A2"].font = Font(italic=True, size=9, color="666666")

    headers = ["Serial Number", "Book Title", "Author", "Sub-Series / Category"]
    header_row = 4
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=header_row, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border

    for row_idx, r in enumerate(rows, start=header_row + 1):
        values = [
            r.get("serial", ""), r.get("title", ""), r.get("author", ""),
            r.get("sub_category", "—"),
        ]
        for col_idx, val in enumerate(values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.border = border
            cell.alignment = Alignment(vertical="center", wrap_text=(col_idx in (2, 3)))
        if (row_idx - header_row) % 2 == 0:
            for col_idx in range(1, len(headers) + 1):
                ws.cell(row=row_idx, column=col_idx).fill = PatternFill(
                    start_color="F4F6F8", end_color="F4F6F8", fill_type="solid")

    widths = [16, 46, 28, 28]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws.freeze_panes = f"A{header_row + 1}"

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()


def generate_generic_excel(sheet_name: str, headers: list[str], rows: list[list]) -> bytes:
    """Generic exporter used for full data backups / raw table exports."""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    for row in rows:
        ws.append(row)
    for i in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(i)].width = 20
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()
