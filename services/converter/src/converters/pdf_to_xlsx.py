"""
PDF to Excel (.xlsx) Conversion Engine.
100% Permissively Licensed (pdfplumber MIT + openpyxl MIT).
Extracts structured tables and tabular layouts from PDF pages into an editable Excel workbook.
"""

import os
from typing import List, Any
import pdfplumber
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def convert_pdf_to_xlsx(input_pdf: str, output_xlsx: str) -> str:
    """
    Converts tabular data from a PDF file into an editable Excel (.xlsx) workbook.
    """
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    header_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    body_font = Font(name="Calibri", size=11, color="1E293B")

    with pdfplumber.open(input_pdf) as pdf:
        total_pages = len(pdf.pages)
        if total_pages == 0:
            ws = wb.create_sheet(title="Sheet1")
            ws["A1"] = "Empty PDF document"
            wb.save(output_xlsx)
            return output_xlsx

        has_any_data = False

        for page_idx, page in enumerate(pdf.pages):
            sheet_title = f"Page {page_idx + 1}" if total_pages > 1 else "Sheet1"
            ws = wb.create_sheet(title=sheet_title)

            # Strategy 1: Explicit table extraction
            tables = page.extract_tables() or []
            current_row = 1

            if tables:
                has_any_data = True
                for t_idx, table in enumerate(tables):
                    if not table:
                        continue

                    # Insert table title if multiple tables on page
                    if len(tables) > 1:
                        title_cell = ws.cell(row=current_row, column=1, value=f"Table {t_idx + 1}")
                        title_cell.font = Font(name="Calibri", size=11, bold=True, italic=True)
                        current_row += 1

                    for r_idx, row in enumerate(table):
                        for c_idx, val in enumerate(row):
                            cell_val = str(val or "").strip()
                            # Try numeric conversion
                            if cell_val.replace('.', '', 1).replace('-', '', 1).isdigit():
                                try:
                                    cell_val = float(cell_val) if '.' in cell_val else int(cell_val)
                                except ValueError:
                                    pass

                            cell = ws.cell(row=current_row, column=c_idx + 1, value=cell_val)
                            cell.border = thin_border

                            if r_idx == 0:
                                cell.fill = header_fill
                                cell.font = header_font
                                cell.alignment = Alignment(horizontal="center", vertical="center")
                            else:
                                cell.font = body_font
                                if isinstance(cell_val, (int, float)):
                                    cell.alignment = Alignment(horizontal="right", vertical="center")
                                else:
                                    cell.alignment = Alignment(horizontal="left", vertical="center")

                        current_row += 1
                    current_row += 2  # spacing between tables

            # Strategy 2: If no bordered tables found, extract raw text lines
            if not tables:
                text = page.extract_text()
                if text and text.strip():
                    has_any_data = True
                    for line in text.split("\n"):
                        clean_line = line.strip()
                        if clean_line:
                            # Split by tab or 2+ consecutive spaces
                            parts = [p.strip() for p in clean_line.split("  ") if p.strip()]
                            if not parts:
                                parts = [clean_line]

                            for c_idx, part in enumerate(parts):
                                val: Any = part
                                if val.replace('.', '', 1).replace('-', '', 1).isdigit():
                                    try:
                                        val = float(val) if '.' in val else int(val)
                                    except ValueError:
                                        pass
                                c = ws.cell(row=current_row, column=c_idx + 1, value=val)
                                c.font = body_font
                            current_row += 1

            # Auto-fit column widths
            for col in ws.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    if cell.value is not None:
                        val_str = str(cell.value)
                        max_len = max(max_len, len(val_str))
                ws.column_dimensions[col_letter].width = max(10, min(max_len + 3, 50))

        if not has_any_data:
            ws = wb.create_sheet(title="Sheet1")
            ws["A1"] = "No tabular or readable text found in document"

    wb.save(output_xlsx)
    return output_xlsx
