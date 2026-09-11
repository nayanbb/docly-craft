"""
Office to PDF Conversion Engine.
Converts Word (.docx, .doc), Excel (.xlsx, .xls), and PowerPoint (.pptx, .ppt) to PDF.
Uses LibreOffice Headless (MPL 2.0) in containerized environments with native Microsoft Office
automation fallback on Windows host.
"""

import os
import shutil
import subprocess
import logging
import tempfile
from typing import Optional

logger = logging.getLogger("docly_converter")


def _find_soffice() -> Optional[str]:
    """Locates the LibreOffice or OpenOffice headless executable."""
    cmd = shutil.which("soffice") or shutil.which("libreoffice")
    if cmd:
        return cmd

    # Common standard installation paths
    candidates = [
        # Linux
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
        "/usr/local/bin/soffice",
        # Windows
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        r"C:\Program Files\OpenOffice 4\program\soffice.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _convert_with_libreoffice(input_path: str, output_pdf: str, timeout: int = 60) -> bool:
    """Converts an office document to PDF using headless LibreOffice."""
    soffice = _find_soffice()
    if not soffice:
        return False

    out_dir = os.path.dirname(output_pdf)
    profile_dir = "/tmp/libreoffice_profile" if os.name != "nt" else os.path.join(tempfile.gettempdir(), "lo_profile")
    try:
        proc = subprocess.run(
            [
                soffice,
                "--headless",
                f"-env:UserInstallation=file://{profile_dir}",
                "--convert-to",
                "pdf",
                "--outdir",
                out_dir,
                input_path,
            ],
            capture_output=True,
            timeout=timeout,
        )
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        generated_pdf = os.path.join(out_dir, f"{base_name}.pdf")

        if proc.returncode == 0 and os.path.exists(generated_pdf) and os.path.getsize(generated_pdf) > 0:
            if generated_pdf != output_pdf:
                shutil.move(generated_pdf, output_pdf)
            return True
        else:
            stderr = proc.stderr.decode("utf-8", errors="ignore")
            logger.warning(f"LibreOffice conversion exited with code {proc.returncode}: {stderr}")
    except Exception as e:
        logger.warning(f"LibreOffice conversion error: {e}")

    return False


def _convert_with_windows_office(input_path: str, output_pdf: str, timeout: int = 60) -> bool:
    """
    On Windows host, converts Word/Excel/PowerPoint using PowerShell COM automation
    if native Microsoft Office is installed.
    """
    if os.name != "nt":
        return False

    ext = os.path.splitext(input_path)[1].lower()
    in_abs = os.path.abspath(input_path).replace("'", "''")
    out_abs = os.path.abspath(output_pdf).replace("'", "''")

    ps_script = ""
    if ext in [".docx", ".doc"]:
        ps_script = f"""
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {{
    $doc = $word.Documents.Open('{in_abs}')
    $doc.SaveAs([ref]'{out_abs}', [ref]17) # 17 = wdFormatPDF
    $doc.Close([ref]$false)
}} finally {{
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}}
"""
    elif ext in [".xlsx", ".xls"]:
        ps_script = f"""
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {{
    $wb = $excel.Workbooks.Open('{in_abs}')
    $wb.ExportAsFixedFormat(0, '{out_abs}') # 0 = xlTypePDF
    $wb.Close($false)
}} finally {{
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}}
"""
    elif ext in [".pptx", ".ppt"]:
        ps_script = f"""
$ppt = New-Object -ComObject PowerPoint.Application
try {{
    $pres = $ppt.Presentations.Open('{in_abs}', [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    $pres.SaveAs('{out_abs}', 32) # 32 = ppSaveAsPDF
    $pres.Close()
}} finally {{
    $ppt.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
}}
"""
    else:
        return False

    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
            capture_output=True,
            timeout=timeout,
        )
        if proc.returncode == 0 and os.path.exists(output_pdf) and os.path.getsize(output_pdf) > 0:
            return True
        else:
            stderr = proc.stderr.decode("utf-8", errors="ignore")
            logger.warning(f"Windows Office COM automation failed: {stderr}")
    except Exception as e:
        logger.warning(f"Windows Office COM automation exception: {e}")

    return False


def convert_office_to_pdf(input_path: str, output_pdf: str) -> str:
    """
    Converts an Office document (DOCX, XLSX, PPTX, DOC, XLS, PPT) to PDF.
    First tries headless LibreOffice (standard in Docker container / Linux).
    Falls back to Windows Office automation if running locally on Windows.
    """
    # 1. Try LibreOffice headless
    if _convert_with_libreoffice(input_path, output_pdf):
        return output_pdf

    # 2. Try Windows native Microsoft Office
    if _convert_with_windows_office(input_path, output_pdf):
        return output_pdf

    raise RuntimeError(
        "Office to PDF conversion engine unavailable. Ensure LibreOffice headless or Microsoft Office is installed."
    )
