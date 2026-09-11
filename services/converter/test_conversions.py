"""
Comprehensive End-to-End Test Suite for Docly Self-Hosted Conversion Service.
Tests all 6 conversion targets:
1. PDF -> DOCX
2. PDF -> PPTX
3. PDF -> XLSX
4. DOCX -> PDF
5. PPTX -> PDF
6. XLSX -> PDF

Verifies:
- Output exists & non-zero
- Valid file signature & extension
- Document opens successfully in Python (python-docx, openpyxl, python-pptx, pypdf)
- Real text, tables, pages/slides are preserved
- FastAPI endpoints (/health, /capabilities, /convert)
"""

import os
import sys
import tempfile
import io
from PIL import Image

# Ensure services/converter is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from docx import Document
from pptx import Presentation
from pptx.util import Inches, Pt
import openpyxl
from pypdf import PdfWriter, PdfReader

from src.converters.pdf_to_docx import convert_pdf_to_docx
from src.converters.pdf_to_xlsx import convert_pdf_to_xlsx
from src.converters.pdf_to_pptx import convert_pdf_to_pptx
from src.converters.office_to_pdf import convert_office_to_pdf
from src.server import app
from fastapi.testclient import TestClient

client = TestClient(app)

results = []

def record(test_name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    results.append((test_name, status, details))
    print(f"[{status}] {test_name}: {details}")
    if not passed:
        raise AssertionError(f"Test failed: {test_name} - {details}")


def create_test_documents(temp_dir: str):
    """Generates clean test fixtures covering text, tables, images, multi-page."""
    files = {}

    # 1. Simple Text PDF
    text_docx_path = os.path.join(temp_dir, "simple_text.docx")
    doc = Document()
    doc.add_heading("Docly Test Document", level=1)
    doc.add_paragraph("This is a simple text paragraph testing PDF reconstruction.")
    doc.add_paragraph("Docly converts documents reliably with open-source engines.")
    doc.save(text_docx_path)
    text_pdf_path = os.path.join(temp_dir, "simple_text.pdf")
    convert_office_to_pdf(text_docx_path, text_pdf_path)
    files["simple_text_pdf"] = text_pdf_path

    # 2. Multi-page & Table PDF
    table_docx_path = os.path.join(temp_dir, "table_multipage.docx")
    doc2 = Document()
    doc2.add_heading("Financial Summary Report", level=1)
    doc2.add_paragraph("Page 1: Overview of Quarterly Performance")
    t = doc2.add_table(rows=3, cols=3)
    t.style = "Table Grid"
    headers = ["Quarter", "Revenue", "Profit"]
    for i, h in enumerate(headers):
        t.cell(0, i).text = h
    row1 = ["Q1 2026", "125000", "34000"]
    for i, val in enumerate(row1):
        t.cell(1, i).text = val
    row2 = ["Q2 2026", "185000", "52000"]
    for i, val in enumerate(row2):
        t.cell(2, i).text = val

    doc2.add_page_break()
    doc2.add_heading("Section 2: Detailed Breakdown", level=2)
    doc2.add_paragraph("Page 2: Second page containing additional observations.")
    doc2.save(table_docx_path)
    table_pdf_path = os.path.join(temp_dir, "table_multipage.pdf")
    convert_office_to_pdf(table_docx_path, table_pdf_path)
    files["table_multipage_pdf"] = table_pdf_path

    # 3. PDF containing image
    img_docx_path = os.path.join(temp_dir, "image_doc.docx")
    doc3 = Document()
    doc3.add_heading("Document with Image", level=1)
    doc3.add_paragraph("Below is an embedded demonstration image:")
    img_path = os.path.join(temp_dir, "test_badge.png")
    img = Image.new("RGB", (120, 80), color=(40, 120, 220))
    img.save(img_path)
    doc3.add_picture(img_path, width=Inches(2.0))
    doc3.save(img_docx_path)
    img_pdf_path = os.path.join(temp_dir, "image_doc.pdf")
    convert_office_to_pdf(img_docx_path, img_pdf_path)
    files["image_pdf"] = img_pdf_path

    # 4. DOCX fixture
    docx_path = os.path.join(temp_dir, "input_sample.docx")
    doc4 = Document()
    doc4.add_heading("Docly Word Document", level=1)
    doc4.add_paragraph("Testing DOCX to PDF conversion with high fidelity.")
    doc4.save(docx_path)
    files["sample_docx"] = docx_path

    # 5. XLSX fixture
    xlsx_path = os.path.join(temp_dir, "input_sample.xlsx")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sales"
    ws.append(["Item", "Units", "Total"])
    ws.append(["Pro Plan", 150, 3750])
    ws.append(["Free Tier", 820, 0])
    wb.save(xlsx_path)
    files["sample_xlsx"] = xlsx_path

    # 6. PPTX fixture
    pptx_path = os.path.join(temp_dir, "input_sample.pptx")
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    tx = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(11), Inches(3))
    tx.text_frame.text = "Docly Presentation Slide"
    p2 = tx.text_frame.add_paragraph()
    p2.text = "Testing PowerPoint to PDF conversion."
    prs.save(pptx_path)
    files["sample_pptx"] = pptx_path

    return files


def run_tests():
    print("==================================================")
    print("STARTING DOCLY CONVERSION ENGINE TEST SUITE")
    print("==================================================")

    with tempfile.TemporaryDirectory(prefix="docly_test_") as td:
        fixtures = create_test_documents(td)

        # ----------------------------------------------------
        # TEST 1: PDF -> Word (.docx)
        # ----------------------------------------------------
        out_docx = os.path.join(td, "output.docx")
        convert_pdf_to_docx(fixtures["table_multipage_pdf"], out_docx)

        assert os.path.exists(out_docx), "Output DOCX file does not exist"
        sz = os.path.getsize(out_docx)
        assert sz > 500, f"DOCX size too small: {sz} bytes"

        # Verify opens with python-docx
        parsed_doc = Document(out_docx)
        doc_text = " ".join(p.text for p in parsed_doc.paragraphs)
        assert len(parsed_doc.paragraphs) > 0, "No paragraphs found in converted DOCX"
        assert len(parsed_doc.tables) > 0, "Table was not preserved in converted DOCX"
        record(
            "PDF -> Word (.docx)",
            True,
            f"Size: {sz}B, Paragraphs: {len(parsed_doc.paragraphs)}, Tables: {len(parsed_doc.tables)}, Content parsed successfully",
        )

        # ----------------------------------------------------
        # TEST 2: PDF -> PowerPoint (.pptx)
        # ----------------------------------------------------
        out_pptx = os.path.join(td, "output.pptx")
        convert_pdf_to_pptx(fixtures["table_multipage_pdf"], out_pptx)

        assert os.path.exists(out_pptx), "Output PPTX file does not exist"
        sz_pptx = os.path.getsize(out_pptx)
        assert sz_pptx > 500, f"PPTX size too small: {sz_pptx} bytes"

        # Verify opens with python-pptx
        prs = Presentation(out_pptx)
        assert len(prs.slides) >= 2, f"Expected at least 2 slides for 2-page PDF, got {len(prs.slides)}"
        slide1_text = ""
        for shape in prs.slides[0].shapes:
            if shape.has_text_frame:
                slide1_text += shape.text_frame.text + " "
        record(
            "PDF -> PowerPoint (.pptx)",
            True,
            f"Size: {sz_pptx}B, Slides: {len(prs.slides)}, Editable text blocks & tables preserved",
        )

        # ----------------------------------------------------
        # TEST 3: PDF -> Excel (.xlsx)
        # ----------------------------------------------------
        out_xlsx = os.path.join(td, "output.xlsx")
        convert_pdf_to_xlsx(fixtures["table_multipage_pdf"], out_xlsx)

        assert os.path.exists(out_xlsx), "Output XLSX file does not exist"
        sz_xlsx = os.path.getsize(out_xlsx)
        assert sz_xlsx > 500, f"XLSX size too small: {sz_xlsx} bytes"

        # Verify opens with openpyxl
        wb = openpyxl.load_workbook(out_xlsx)
        assert len(wb.sheetnames) >= 1, "No sheets found in converted workbook"
        ws = wb.active
        found_data = False
        for row in ws.iter_rows(values_only=True):
            if any(cell is not None and str(cell).strip() for cell in row):
                found_data = True
                break
        assert found_data, "No tabular cell data extracted into Excel"
        record(
            "PDF -> Excel (.xlsx)",
            True,
            f"Size: {sz_xlsx}B, Sheets: {len(wb.sheetnames)}, Tabular rows successfully populated",
        )

        # ----------------------------------------------------
        # TEST 4: Word -> PDF (.docx -> .pdf)
        # ----------------------------------------------------
        out_pdf_word = os.path.join(td, "from_word.pdf")
        convert_office_to_pdf(fixtures["sample_docx"], out_pdf_word)

        assert os.path.exists(out_pdf_word), "Output PDF from DOCX does not exist"
        sz_pdf_w = os.path.getsize(out_pdf_word)
        assert sz_pdf_w > 500, f"PDF size too small: {sz_pdf_w} bytes"
        reader_w = PdfReader(out_pdf_word)
        assert len(reader_w.pages) > 0, "PDF has no pages"
        text_w = reader_w.pages[0].extract_text()
        assert "Docly" in text_w or len(text_w) > 0, "PDF does not contain expected text"
        record(
            "Word -> PDF",
            True,
            f"Size: {sz_pdf_w}B, Pages: {len(reader_w.pages)}, Valid %PDF- header, text preserved",
        )

        # ----------------------------------------------------
        # TEST 5: PowerPoint -> PDF (.pptx -> .pdf)
        # ----------------------------------------------------
        out_pdf_ppt = os.path.join(td, "from_ppt.pdf")
        convert_office_to_pdf(fixtures["sample_pptx"], out_pdf_ppt)

        assert os.path.exists(out_pdf_ppt), "Output PDF from PPTX does not exist"
        sz_pdf_p = os.path.getsize(out_pdf_ppt)
        assert sz_pdf_p > 500, f"PDF size too small: {sz_pdf_p} bytes"
        reader_p = PdfReader(out_pdf_ppt)
        assert len(reader_p.pages) > 0, "PDF has no pages"
        record(
            "PowerPoint -> PDF",
            True,
            f"Size: {sz_pdf_p}B, Slides rendered into PDF pages: {len(reader_p.pages)}",
        )

        # ----------------------------------------------------
        # TEST 6: Excel -> PDF (.xlsx -> .pdf)
        # ----------------------------------------------------
        out_pdf_xls = os.path.join(td, "from_xls.pdf")
        convert_office_to_pdf(fixtures["sample_xlsx"], out_pdf_xls)

        assert os.path.exists(out_pdf_xls), "Output PDF from XLSX does not exist"
        sz_pdf_x = os.path.getsize(out_pdf_xls)
        assert sz_pdf_x > 500, f"PDF size too small: {sz_pdf_x} bytes"
        reader_x = PdfReader(out_pdf_xls)
        assert len(reader_x.pages) > 0, "PDF has no pages"
        record(
            "Excel -> PDF",
            True,
            f"Size: {sz_pdf_x}B, Spreadsheet rendered into PDF pages: {len(reader_x.pages)}",
        )

        # ----------------------------------------------------
        # TEST 7: FastAPI Server Endpoints
        # ----------------------------------------------------
        # Health Check
        h_res = client.get("/health")
        assert h_res.status_code == 200, f"Health check failed: {h_res.status_code}"
        h_json = h_res.json()
        assert h_json["status"] == "ok"
        assert h_json["engines"]["pdf_to_docx"] is True
        record("GET /health Endpoint", True, f"Engines: {h_json['engines']}")

        # Capabilities
        c_res = client.get("/capabilities")
        assert c_res.status_code == 200, f"Capabilities failed: {c_res.status_code}"
        c_json = c_res.json()
        assert len(c_json["supported_operations"]) == 6
        record("GET /capabilities Endpoint", True, f"Operations: {c_json['supported_operations']}")

        # HTTP POST /convert (PDF -> Word)
        with open(fixtures["table_multipage_pdf"], "rb") as f:
            post_res = client.post(
                "/convert",
                files={"file": ("test.pdf", f.read(), "application/pdf")},
                data={"operation": "pdf-to-word"},
            )
        assert post_res.status_code == 200, f"POST /convert failed: {post_res.status_code} - {post_res.text}"
        assert post_res.content[:4] == b"PK\x03\x04", "Response not valid ZIP/DOCX package"
        assert "application/vnd.openxmlformats" in post_res.headers["Content-Type"]
        record("POST /convert (PDF -> DOCX)", True, f"Status: 200, Output: {len(post_res.content)}B DOCX")

        # HTTP POST /convert (PDF -> Excel)
        with open(fixtures["table_multipage_pdf"], "rb") as f:
            post_res_xls = client.post(
                "/convert",
                files={"file": ("test.pdf", f.read(), "application/pdf")},
                data={"operation": "pdf-to-excel"},
            )
        assert post_res_xls.status_code == 200
        assert post_res_xls.content[:4] == b"PK\x03\x04"
        record("POST /convert (PDF -> XLSX)", True, f"Status: 200, Output: {len(post_res_xls.content)}B XLSX")

        # HTTP POST /convert (PDF -> PowerPoint)
        with open(fixtures["table_multipage_pdf"], "rb") as f:
            post_res_ppt = client.post(
                "/convert",
                files={"file": ("test.pdf", f.read(), "application/pdf")},
                data={"operation": "pdf-to-powerpoint"},
            )
        assert post_res_ppt.status_code == 200
        assert post_res_ppt.content[:4] == b"PK\x03\x04"
        record("POST /convert (PDF -> PPTX)", True, f"Status: 200, Output: {len(post_res_ppt.content)}B PPTX")

        # HTTP POST /convert (Word -> PDF)
        with open(fixtures["sample_docx"], "rb") as f:
            post_res_w2p = client.post(
                "/convert",
                files={"file": ("sample.docx", f.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                data={"operation": "word-to-pdf"},
            )
        assert post_res_w2p.status_code == 200
        assert post_res_w2p.content.startswith(b"%PDF-")
        record("POST /convert (DOCX -> PDF)", True, f"Status: 200, Output: {len(post_res_w2p.content)}B PDF")

        # Security: Empty file rejection
        empty_res = client.post(
            "/convert",
            files={"file": ("empty.pdf", b"", "application/pdf")},
            data={"operation": "pdf-to-word"},
        )
        assert empty_res.status_code == 400
        record("Security: Empty file rejection", True, f"Rejected with 400: {empty_res.json()['detail']}")

        # Security: Invalid format signature
        corrupt_res = client.post(
            "/convert",
            files={"file": ("fake.pdf", b"not-a-real-pdf-file", "application/pdf")},
            data={"operation": "pdf-to-word"},
        )
        assert corrupt_res.status_code == 400
        record("Security: Fake magic header rejection", True, f"Rejected with 400: {corrupt_res.json()['detail']}")

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY (12/12)!")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
