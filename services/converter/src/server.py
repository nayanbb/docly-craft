"""
Docly Open-Source Document Conversion Microservice.
Provides secure, isolated REST API for converting PDF <-> Office formats.
100% Permissively Licensed (MIT / Apache 2.0 / BSD / MPL 2.0).
"""

import os
import uuid
import time
import asyncio
import logging
import tempfile
import io
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException, Request
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pypdf

from src.validators import (
    validate_conversion_request,
    validate_pdf_unlock_request,
    SUPPORTED_OPERATIONS,
    MAX_FILE_SIZE_BYTES,
)
from src.cleanup import cleanup_path
from src.converters import (
    convert_pdf_to_docx,
    convert_pdf_to_xlsx,
    convert_pdf_to_pptx,
    convert_office_to_pdf,
)

# Logging configuration: safe metadata only (NEVER log document contents)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [docly_converter] %(message)s",
)
logger = logging.getLogger("docly_converter")

app = FastAPI(
    title="Docly Document Conversion Engine",
    description="Self-hosted open-source document conversion microservice for Docly",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONVERTER_SECRET = os.getenv("CONVERTER_SECRET", "").strip()
MAX_CONCURRENT_CONVERSIONS = int(os.getenv("MAX_CONCURRENT_CONVERSIONS", "5"))
CONVERSION_TIMEOUT_SECONDS = int(os.getenv("CONVERSION_TIMEOUT_SECONDS", "60"))

# Semaphore to prevent server CPU/memory exhaustion
conversion_semaphore = asyncio.Semaphore(MAX_CONCURRENT_CONVERSIONS)


def _resolve_operation(
    operation: Optional[str] = None,
    source_format: Optional[str] = None,
    target_format: Optional[str] = None,
) -> Optional[str]:
    """Resolves conversion operation from operation string or format pair."""
    if operation and operation.strip() in SUPPORTED_OPERATIONS:
        return operation.strip()

    if source_format and target_format:
        s = source_format.strip().lower().lstrip(".")
        t = target_format.strip().lower().lstrip(".")
        pair_map = {
            ("pdf", "docx"): "pdf-to-word",
            ("pdf", "doc"): "pdf-to-word",
            ("pdf", "word"): "pdf-to-word",
            ("pdf", "xlsx"): "pdf-to-excel",
            ("pdf", "xls"): "pdf-to-excel",
            ("pdf", "excel"): "pdf-to-excel",
            ("pdf", "pptx"): "pdf-to-powerpoint",
            ("pdf", "ppt"): "pdf-to-powerpoint",
            ("pdf", "powerpoint"): "pdf-to-powerpoint",
            ("docx", "pdf"): "word-to-pdf",
            ("doc", "pdf"): "word-to-pdf",
            ("xlsx", "pdf"): "excel-to-pdf",
            ("xls", "pdf"): "excel-to-pdf",
            ("pptx", "pdf"): "powerpoint-to-pdf",
            ("ppt", "pdf"): "powerpoint-to-pdf",
        }
        return pair_map.get((s, t))

    return None


@app.get("/")
async def root_index():
    """
    Docly Converter Microservice Root Index.
    """
    return {
        "service": "Docly Document Conversion Engine",
        "status": "ready",
        "version": "1.0.0",
        "docs_url": "/docs",
        "health_url": "/health",
        "notice": "This endpoint is the isolated Docly Office Conversion Microservice. The Docly web application frontend is served by the main TanStack Start deployment.",
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint reporting engine status.
    """
    # Check if office to pdf engine is available (LibreOffice or Windows Office)
    office_engine_ready = False
    try:
        from src.converters.office_to_pdf import _find_soffice
        if _find_soffice() is not None or os.name == "nt":
            office_engine_ready = True
    except Exception:
        office_engine_ready = False

    return {
        "status": "ok",
        "engines": {
            "pdf_to_docx": True,
            "pdf_to_pptx": True,
            "pdf_to_xlsx": True,
            "office_to_pdf": office_engine_ready,
        },
        "version": "1.0.0",
    }


@app.get("/capabilities")
async def capabilities():
    """
    Returns supported conversion operations and operational limits.
    """
    return {
        "supported_operations": list(SUPPORTED_OPERATIONS.keys()),
        "max_file_size_bytes": MAX_FILE_SIZE_BYTES,
        "concurrency_limit": MAX_CONCURRENT_CONVERSIONS,
        "timeout_seconds": CONVERSION_TIMEOUT_SECONDS,
    }


@app.post("/convert")
async def convert_document(
    file: UploadFile = File(...),
    operation: Optional[str] = Form(None),
    source_format: Optional[str] = Form(None),
    target_format: Optional[str] = Form(None),
    x_converter_secret: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """
    Converts an uploaded document between PDF and Office formats.
    """
    req_id = uuid.uuid4().hex[:8]
    start_time = time.time()

    # 1. Optional Secret Authentication
    if CONVERTER_SECRET:
        token = ""
        if x_converter_secret:
            token = x_converter_secret.strip()
        elif authorization and authorization.startswith("Bearer "):
            token = authorization.split("Bearer ", 1)[1].strip()

        if token != CONVERTER_SECRET:
            logger.warning(f"[{req_id}] Unauthorized conversion attempt.")
            raise HTTPException(status_code=401, detail="Unauthorized: invalid converter secret.")

    # 2. Resolve Operation
    resolved_op = _resolve_operation(operation, source_format, target_format)
    if not resolved_op:
        logger.warning(f"[{req_id}] Unsupported conversion request: op={operation}, src={source_format}, tgt={target_format}")
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported or missing conversion operation. Supported: {list(SUPPORTED_OPERATIONS.keys())}",
        )

    # 3. Read uploaded bytes safely
    try:
        file_bytes = await file.read()
    except Exception as e:
        logger.error(f"[{req_id}] Failed to read upload stream: {e}")
        raise HTTPException(status_code=400, detail="Failed to read uploaded file payload.")

    # 4. Validate file size, extension, and magic bytes
    original_filename = file.filename or f"document{SUPPORTED_OPERATIONS[resolved_op]['source_exts'][0]}"
    valid, err_msg = validate_conversion_request(file_bytes, original_filename, resolved_op)
    if not valid:
        logger.warning(f"[{req_id}] Validation failed for {resolved_op} ({len(file_bytes)} bytes): {err_msg}")
        raise HTTPException(status_code=400, detail=err_msg)

    # 5. Acquire concurrency semaphore
    if conversion_semaphore.locked():
        logger.info(f"[{req_id}] Concurrency limit reached ({MAX_CONCURRENT_CONVERSIONS}). Queuing request...")

    async with conversion_semaphore:
        temp_dir = tempfile.mkdtemp(prefix="docly_conv_")
        try:
            op_config = SUPPORTED_OPERATIONS[resolved_op]
            source_ext = os.path.splitext(original_filename)[1].lower()
            if not source_ext:
                source_ext = op_config["source_exts"][0]

            random_id = uuid.uuid4().hex
            input_path = os.path.join(temp_dir, f"input_{random_id}{source_ext}")
            target_ext = op_config["target_ext"]
            output_path = os.path.join(temp_dir, f"output_{random_id}{target_ext}")

            # Write input file to isolated sandbox
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            # Define sync conversion worker
            def run_sync_conversion() -> str:
                if resolved_op == "pdf-to-word":
                    return convert_pdf_to_docx(input_path, output_path)
                elif resolved_op == "pdf-to-excel":
                    return convert_pdf_to_xlsx(input_path, output_path)
                elif resolved_op == "pdf-to-powerpoint":
                    return convert_pdf_to_pptx(input_path, output_path)
                elif resolved_op in ["word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"]:
                    return convert_office_to_pdf(input_path, output_path)
                else:
                    raise ValueError(f"No converter implemented for {resolved_op}")

            # Execute with strict timeout protection
            loop = asyncio.get_running_loop()
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(None, run_sync_conversion),
                    timeout=CONVERSION_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                logger.error(f"[{req_id}] Conversion timed out after {CONVERSION_TIMEOUT_SECONDS}s ({resolved_op})")
                raise HTTPException(
                    status_code=504,
                    detail=f"Conversion timed out. The document may be too large or complex for the {CONVERSION_TIMEOUT_SECONDS}s limit.",
                )

            # Verify output file exists and is non-empty
            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                logger.error(f"[{req_id}] Converter engine produced empty or missing output file.")
                raise HTTPException(status_code=500, detail="Conversion engine failed to produce valid output.")

            with open(output_path, "rb") as out_f:
                output_bytes = out_f.read()

            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(
                f"[{req_id}] Success: op={resolved_op}, in_bytes={len(file_bytes)}, out_bytes={len(output_bytes)}, time={duration_ms}ms"
            )

            base_original = os.path.splitext(os.path.basename(original_filename))[0]
            output_filename = f"{base_original}{target_ext}"
            target_mime = op_config["target_mime"]

            return Response(
                content=output_bytes,
                media_type=target_mime,
                headers={
                    "Content-Disposition": f'attachment; filename="{output_filename}"',
                    "X-Converted-By": "docly-self-hosted",
                    "X-Conversion-Time-Ms": str(duration_ms),
                },
            )
        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"[{req_id}] Conversion exception: {err}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Document conversion failed: {str(err)}",
            )
        finally:
            # Unconditional cleanup of all temporary data
            cleanup_path(temp_dir)


@app.post("/pdf/unlock")
@app.post("/unlock")
async def unlock_pdf_document(
    file: UploadFile = File(...),
    password: Optional[str] = Form(""),
    x_converter_secret: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """
    Authenticates and decrypts a password-protected PDF document.
    Permanently removes encryption dictionary (/Encrypt) and outputs a genuine unencrypted PDF.
    Preserves all pages, vector shapes, fonts, images, and document geometry.
    Never logs passwords or document contents.
    """
    req_id = uuid.uuid4().hex[:8]
    start_time = time.time()

    # 1. Secret authentication if enabled
    if CONVERTER_SECRET:
        token = ""
        if x_converter_secret:
            token = x_converter_secret.strip()
        elif authorization and authorization.startswith("Bearer "):
            token = authorization.split("Bearer ", 1)[1].strip()

        if token != CONVERTER_SECRET:
            logger.warning(f"[{req_id}] Unauthorized unlock attempt.")
            raise HTTPException(status_code=401, detail="Unauthorized: invalid converter secret.")

    # 2. Read bytes safely
    try:
        file_bytes = await file.read()
    except Exception as e:
        logger.error(f"[{req_id}] Failed to read upload stream: {e}")
        raise HTTPException(status_code=400, detail="Failed to read uploaded file payload.")

    original_filename = file.filename or "document.pdf"
    valid, err_msg = validate_pdf_unlock_request(file_bytes, original_filename)
    if not valid:
        logger.warning(f"[{req_id}] Unlock validation failed: {err_msg}")
        raise HTTPException(status_code=400, detail=err_msg or "Invalid or corrupted PDF file.")

    temp_dir = tempfile.mkdtemp(prefix="docly_unlock_")
    try:
        input_stream = io.BytesIO(file_bytes)
        try:
            reader = pypdf.PdfReader(input_stream)
        except Exception as e:
            logger.warning(f"[{req_id}] Failed to parse PDF: {e}")
            raise HTTPException(
                status_code=400,
                detail="Unable to unlock this PDF. Please try again with a valid PDF and password.",
            )

        if not reader.is_encrypted:
            # Document is already unlocked / not password protected.
            # Handle gracefully by re-saving clean unencrypted document.
            page_count = len(reader.pages)
            writer = pypdf.PdfWriter()
            writer.append(reader)
            out_stream = io.BytesIO()
            writer.write(out_stream)
            output_bytes = out_stream.getvalue()
        else:
            supplied_pass = password or ""
            decrypt_res = reader.decrypt(supplied_pass)
            # 0 means decryption failed (incorrect password)
            if decrypt_res == 0:
                logger.info(f"[{req_id}] Decryption failed: incorrect password.")
                raise HTTPException(
                    status_code=401,
                    detail="Incorrect PDF password. Please enter the correct password.",
                )

            # Decryption succeeded: clone document into unencrypted PdfWriter
            writer = pypdf.PdfWriter()
            writer.append(reader)
            out_stream = io.BytesIO()
            writer.write(out_stream)
            output_bytes = out_stream.getvalue()
            page_count = len(reader.pages)

        # Programmatically verify output has no encryption
        try:
            verify_reader = pypdf.PdfReader(io.BytesIO(output_bytes))
            if verify_reader.is_encrypted:
                logger.error(f"[{req_id}] Output PDF unexpectedly retained encryption flag.")
                raise HTTPException(
                    status_code=500,
                    detail="Unable to unlock this PDF. Please try again with a valid PDF and password.",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[{req_id}] Output verification failed: {e}")
            raise HTTPException(
                status_code=500,
                detail="Unable to unlock this PDF. Please try again with a valid PDF and password.",
            )

        duration_ms = int((time.time() - start_time) * 1000)
        logger.info(
            f"[{req_id}] PDF unlock success: pages={page_count}, out_bytes={len(output_bytes)}, time={duration_ms}ms"
        )

        base_name = os.path.splitext(os.path.basename(original_filename))[0]
        output_filename = f"{base_name}-unlocked.pdf"

        return Response(
            content=output_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{output_filename}"',
                "X-Page-Count": str(page_count),
                "X-Decrypted-By": "docly-self-hosted",
                "X-Unlock-Time-Ms": str(duration_ms),
            },
        )
    finally:
        cleanup_path(temp_dir)

