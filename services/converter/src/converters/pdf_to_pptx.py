"""
PDF to PowerPoint (.pptx) Conversion Engine.
100% Permissively Licensed (pdfplumber MIT + python-pptx MIT + Pillow HPND).
Reconstructs PDF pages into editable PowerPoint slides with text blocks, tables, and images.
"""

import os
import io
import tempfile
from typing import List, Dict, Any, Tuple
import pdfplumber
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from PIL import Image


def convert_pdf_to_pptx(input_pdf: str, output_pptx: str) -> str:
    """
    Converts a PDF document into an editable PowerPoint (.pptx) presentation.
    Each PDF page becomes a slide containing editable text boxes, native tables, and images.
    """
    prs = Presentation()
    # Remove default blank slide size to configure based on input
    prs.slide_width = Inches(13.333)  # Standard 16:9 widescreen
    prs.slide_height = Inches(7.5)

    blank_slide_layout = prs.slide_layouts[6]  # Blank layout

    with pdfplumber.open(input_pdf) as pdf:
        total_pages = len(pdf.pages)
        if total_pages == 0:
            slide = prs.slides.add_slide(blank_slide_layout)
            txBox = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(11), Inches(2))
            tf = txBox.text_frame
            tf.text = "Empty PDF document."
            prs.save(output_pptx)
            return output_pptx

        for page_idx, page in enumerate(pdf.pages):
            slide = prs.slides.add_slide(blank_slide_layout)

            pdf_w = float(page.width or 612.0)
            pdf_h = float(page.height or 792.0)

            # Scale factors from PDF points to PPTX inches
            scale_x = (13.333 * 72.0) / pdf_w
            scale_y = (7.5 * 72.0) / pdf_h
            # Maintain uniform scale where reasonable, with margin
            scale = min(scale_x, scale_y) * 0.90
            offset_x = (13.333 * 72.0 - (pdf_w * scale)) / 2.0
            offset_y = (7.5 * 72.0 - (pdf_h * scale)) / 2.0

            def to_pt_x(x: float) -> Pt:
                return Pt(offset_x + (x * scale))

            def to_pt_y(y: float) -> Pt:
                return Pt(offset_y + (y * scale))

            def to_pt_w(w: float) -> Pt:
                return Pt(max(w * scale, 10.0))

            def to_pt_h(h: float) -> Pt:
                return Pt(max(h * scale, 10.0))

            # 1. Detect Tables on Page
            tables = page.extract_tables() or []
            table_bboxes: List[Tuple[float, float, float, float]] = []
            try:
                for tbl_obj in page.find_tables():
                    table_bboxes.append(tbl_obj.bbox)
            except Exception:
                pass

            def inside_any_table(top: float, bottom: float) -> bool:
                for (x0, y0, x1, y1) in table_bboxes:
                    if y0 - 3 <= top and bottom <= y1 + 3:
                        return True
                return False

            # 2. Extract and Insert Native PowerPoint Tables
            for tbl_idx, tbl in enumerate(tables):
                if not tbl or len(tbl) == 0:
                    continue
                num_rows = len(tbl)
                num_cols = max(len(row) for row in tbl if row)
                if num_cols == 0:
                    continue

                # Estimate table coordinates
                if tbl_idx < len(table_bboxes):
                    tx0, ty0, tx1, ty1 = table_bboxes[tbl_idx]
                    t_left = to_pt_x(tx0)
                    t_top = to_pt_y(ty0)
                    t_width = to_pt_w(tx1 - tx0)
                    t_height = to_pt_h(ty1 - ty0)
                else:
                    t_left = Inches(1.0)
                    t_top = Inches(2.0 + tbl_idx * 2.0)
                    t_width = Inches(11.0)
                    t_height = Inches(min(num_rows * 0.4, 4.0))

                shape = slide.shapes.add_table(num_rows, num_cols, t_left, t_top, t_width, t_height)
                ppt_table = shape.table

                for r_idx, row in enumerate(tbl):
                    for c_idx, cell_value in enumerate(row):
                        if c_idx < num_cols:
                            cell = ppt_table.cell(r_idx, c_idx)
                            cell_text = str(cell_value or "").strip()
                            cell.text = cell_text
                            for paragraph in cell.text_frame.paragraphs:
                                paragraph.font.size = Pt(10)
                                if r_idx == 0:
                                    paragraph.font.bold = True
                                    paragraph.font.color.rgb = RGBColor(15, 23, 42)

            # 3. Extract Words and Group into Text Boxes
            words = page.extract_words(
                extra_attrs=["size", "fontname"],
                keep_blank_chars=False,
            )

            lines: List[List[Dict[str, Any]]] = []
            current_line: List[Dict[str, Any]] = []
            last_top = -1.0

            sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
            for w in sorted_words:
                if inside_any_table(w["top"], w["bottom"]):
                    continue

                if last_top < 0 or abs(w["top"] - last_top) < 4.0:
                    current_line.append(w)
                    last_top = w["top"]
                else:
                    if current_line:
                        lines.append(current_line)
                    current_line = [w]
                    last_top = w["top"]

            if current_line:
                lines.append(current_line)

            # Group adjacent lines into paragraph blocks
            blocks: List[List[List[Dict[str, Any]]]] = []
            current_block: List[List[Dict[str, Any]]] = []
            last_line_bottom = -1.0

            for line in lines:
                line_top = min(w["top"] for w in line)
                line_bottom = max(w["bottom"] for w in line)

                if last_line_bottom < 0 or (line_top - last_line_bottom) < 14.0:
                    current_block.append(line)
                    last_line_bottom = line_bottom
                else:
                    if current_block:
                        blocks.append(current_block)
                    current_block = [line]
                    last_line_bottom = line_bottom

            if current_block:
                blocks.append(current_block)

            # Add each text block as an editable PowerPoint text box
            for block in blocks:
                block_words = [w for line in block for w in line]
                if not block_words:
                    continue

                b_x0 = min(w["x0"] for w in block_words)
                b_y0 = min(w["top"] for w in block_words)
                b_x1 = max(w["x1"] for w in block_words)
                b_y1 = max(w["bottom"] for w in block_words)

                box_left = to_pt_x(b_x0)
                box_top = to_pt_y(b_y0)
                box_width = to_pt_w(max(b_x1 - b_x0, 60.0))
                box_height = to_pt_h(max(b_y1 - b_y0, 20.0))

                txBox = slide.shapes.add_textbox(box_left, box_top, box_width, box_height)
                tf = txBox.text_frame
                tf.word_wrap = True

                for line_idx, line in enumerate(block):
                    line_words = sorted(line, key=lambda w: w["x0"])
                    line_text = " ".join(w["text"] for w in line_words).strip()
                    if not line_text:
                        continue

                    if line_idx == 0:
                        p = tf.paragraphs[0]
                    else:
                        p = tf.add_paragraph()

                    p.text = line_text

                    avg_size = sum(w.get("size", 11.0) for w in line_words) / len(line_words)
                    is_bold = any(
                        "bold" in str(w.get("fontname", "")).lower() or "black" in str(w.get("fontname", "")).lower()
                        for w in line_words
                    )

                    # Scale font appropriately for slide presentation
                    slide_font_size = max(10.0, min(36.0, avg_size * 1.1))
                    p.font.size = Pt(slide_font_size)
                    p.font.bold = is_bold
                    p.font.color.rgb = RGBColor(30, 41, 59)

            # 4. Extract Images if Present
            try:
                for img_dict in page.images:
                    stream = img_dict.get("stream")
                    if stream:
                        raw_bytes = stream.get_rawdata()
                        if raw_bytes and len(raw_bytes) > 100:
                            img_x0 = float(img_dict.get("x0", 0))
                            img_top = float(img_dict.get("top", 0))
                            img_w = float(img_dict.get("width", 100))
                            img_h = float(img_dict.get("height", 100))

                            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_img:
                                tmp_img_path = tmp_img.name
                                try:
                                    img_pil = Image.open(io.BytesIO(raw_bytes))
                                    img_pil.save(tmp_img_path, format="PNG")
                                    slide.shapes.add_picture(
                                        tmp_img_path,
                                        to_pt_x(img_x0),
                                        to_pt_y(img_top),
                                        to_pt_w(img_w),
                                        to_pt_h(img_h),
                                    )
                                except Exception:
                                    pass
                                finally:
                                    if os.path.exists(tmp_img_path):
                                        try:
                                            os.remove(tmp_img_path)
                                        except Exception:
                                            pass
            except Exception:
                pass

    prs.save(output_pptx)
    return output_pptx
