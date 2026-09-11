"""
PDF to Word (.docx) Conversion Engine.
100% Permissively Licensed (pdfplumber MIT + python-docx MIT + Pillow HPND).
Extracts text flow, headings, tables, and images into an editable Word document.
"""

import os
import io
import shutil
import subprocess
import tempfile
from typing import List, Dict, Any
import pdfplumber
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from PIL import Image


def _has_libreoffice() -> bool:
    """Checks if headless soffice / libreoffice is installed and available in PATH."""
    return shutil.which("soffice") is not None or shutil.which("libreoffice") is not None


def _convert_with_libreoffice(input_pdf: str, output_docx: str) -> bool:
    """Attempts conversion via LibreOffice writer_pdf_import if available."""
    soffice_cmd = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice_cmd:
        return False

    out_dir = os.path.dirname(output_docx)
    try:
        proc = subprocess.run(
            [
                soffice_cmd,
                "--headless",
                "--infilter=writer_pdf_import",
                "--convert-to",
                "docx",
                "--outdir",
                out_dir,
                input_pdf,
            ],
            capture_output=True,
            timeout=45,
        )
        base_name = os.path.splitext(os.path.basename(input_pdf))[0]
        gen_path = os.path.join(out_dir, f"{base_name}.docx")
        if proc.returncode == 0 and os.path.exists(gen_path):
            if gen_path != output_docx:
                shutil.move(gen_path, output_docx)
            return True
    except Exception:
        pass
    return False


def convert_pdf_to_docx(input_pdf: str, output_docx: str) -> str:
    """
    Converts a PDF file into an editable Word (.docx) document.
    Uses native Python reconstruction pipeline with fallback to LibreOffice.
    """
    # 1. If LibreOffice headless is present, try high-fidelity import
    if _has_libreoffice() and _convert_with_libreoffice(input_pdf, output_docx):
        if os.path.exists(output_docx) and os.path.getsize(output_docx) > 0:
            return output_docx

    # 2. Native Python reconstruction pipeline
    doc = Document()

    # Set standard 0.75 inch margins
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    with pdfplumber.open(input_pdf) as pdf:
        total_pages = len(pdf.pages)
        if total_pages == 0:
            doc.add_paragraph("Empty PDF document.")
            doc.save(output_docx)
            return output_docx

        for page_idx, page in enumerate(pdf.pages):
            if page_idx > 0:
                doc.add_page_break()

            # Detect tables on page
            tables = page.extract_tables() or []
            table_bboxes = []
            try:
                for tbl_obj in page.find_tables():
                    table_bboxes.append(tbl_obj.bbox)
            except Exception:
                pass

            def inside_any_table(top: float, bottom: float) -> bool:
                for (x0, y0, x1, y1) in table_bboxes:
                    if y0 - 2 <= top and bottom <= y1 + 2:
                        return True
                return False

            # Extract words and group into lines/paragraphs
            words = page.extract_words(
                extra_attrs=["size", "fontname"],
                keep_blank_chars=False,
            )

            # Group words by vertical line position (within 3.5pt tolerance)
            lines: List[List[Dict[str, Any]]] = []
            current_line: List[Dict[str, Any]] = []
            last_top = -1.0

            sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
            for w in sorted_words:
                if inside_any_table(w["top"], w["bottom"]):
                    continue  # Table content handled separately

                if last_top < 0 or abs(w["top"] - last_top) < 3.5:
                    current_line.append(w)
                    last_top = w["top"]
                else:
                    if current_line:
                        lines.append(current_line)
                    current_line = [w]
                    last_top = w["top"]

            if current_line:
                lines.append(current_line)

            # Write text lines as paragraphs
            for line in lines:
                line_words = sorted(line, key=lambda w: w["x0"])
                line_text = " ".join(w["text"] for w in line_words).strip()
                if not line_text:
                    continue

                avg_size = sum(w.get("size", 10.0) for w in line_words) / len(line_words)
                is_bold = any(
                    "bold" in str(w.get("fontname", "")).lower() or "black" in str(w.get("fontname", "")).lower()
                    for w in line_words
                )

                if avg_size >= 16.0:
                    p = doc.add_heading(line_text, level=1)
                elif avg_size >= 13.0:
                    p = doc.add_heading(line_text, level=2)
                else:
                    p = doc.add_paragraph()
                    run = p.add_run(line_text)
                    run.font.size = Pt(max(8.0, min(14.0, avg_size)))
                    run.bold = is_bold
                    run.font.color.rgb = RGBColor(15, 23, 42)

            # Insert extracted tables
            for tbl in tables:
                if not tbl or len(tbl) == 0:
                    continue
                num_rows = len(tbl)
                num_cols = max(len(row) for row in tbl if row)
                if num_cols == 0:
                    continue

                table_elem = doc.add_table(rows=num_rows, cols=num_cols)
                table_elem.style = "Table Grid"

                for r_idx, row in enumerate(tbl):
                    for c_idx, cell_value in enumerate(row):
                        if c_idx < num_cols:
                            cell = table_elem.cell(r_idx, c_idx)
                            text_str = str(cell_value or "").strip()
                            cell.text = text_str
                            # Format header row
                            if r_idx == 0:
                                shading_elm = parse_xml(r'<w:shd {} w:fill="F1F5F9"/>'.format(nsdecls('w')))
                                cell._tc.get_or_add_tcPr().append(shading_elm)
                                for p in cell.paragraphs:
                                    for run in p.runs:
                                        run.bold = True
                                        run.font.color.rgb = RGBColor(15, 23, 42)

                doc.add_paragraph()  # spacing after table

            # Insert embedded images if present
            try:
                for img_dict in page.images:
                    stream = img_dict.get("stream")
                    if stream:
                        raw_bytes = stream.get_rawdata()
                        if raw_bytes and len(raw_bytes) > 200:
                            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_f:
                                tmp_f_path = tmp_f.name
                                try:
                                    img_pil = Image.open(io.BytesIO(raw_bytes))
                                    # Skip tiny decorative icons/spacers
                                    if img_pil.width >= 32 and img_pil.height >= 32:
                                        img_pil.save(tmp_f_path, format="PNG")
                                        # Calculate reasonable display width (max 6 inches)
                                        w_in = min(6.0, max(1.5, img_pil.width / 150.0))
                                        doc.add_picture(tmp_f_path, width=Inches(w_in))
                                        doc.add_paragraph()
                                except Exception:
                                    pass
                                finally:
                                    if os.path.exists(tmp_f_path):
                                        try:
                                            os.remove(tmp_f_path)
                                        except Exception:
                                            pass
            except Exception:
                pass

    doc.save(output_docx)
    return output_docx
