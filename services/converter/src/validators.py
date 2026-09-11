"""
Document upload validation, file signature verification, and security sanitization.
"""

import os
from typing import Tuple, Optional

SUPPORTED_OPERATIONS = {
    "pdf-to-word": {
        "source_exts": [".pdf"],
        "target_ext": ".docx",
        "mime_types": ["application/pdf"],
        "magic_header": b"%PDF-",
        "target_mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    "pdf-to-excel": {
        "source_exts": [".pdf"],
        "target_ext": ".xlsx",
        "mime_types": ["application/pdf"],
        "magic_header": b"%PDF-",
        "target_mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    "pdf-to-powerpoint": {
        "source_exts": [".pdf"],
        "target_ext": ".pptx",
        "mime_types": ["application/pdf"],
        "magic_header": b"%PDF-",
        "target_mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
    "word-to-pdf": {
        "source_exts": [".docx", ".doc"],
        "target_ext": ".pdf",
        "mime_types": [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "application/octet-stream",
        ],
        "target_mime": "application/pdf",
    },
    "excel-to-pdf": {
        "source_exts": [".xlsx", ".xls"],
        "target_ext": ".pdf",
        "mime_types": [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/octet-stream",
        ],
        "target_mime": "application/pdf",
    },
    "powerpoint-to-pdf": {
        "source_exts": [".pptx", ".ppt"],
        "target_ext": ".pdf",
        "mime_types": [
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint",
            "application/octet-stream",
        ],
        "target_mime": "application/pdf",
    },
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB default


def validate_conversion_request(
    file_bytes: bytes,
    original_filename: str,
    operation: str,
    max_size: int = MAX_FILE_SIZE_BYTES,
) -> Tuple[bool, Optional[str]]:
    """
    Validates that:
    1. Operation is supported.
    2. File size is within limits.
    3. File extension matches the expected source format.
    4. Magic bytes match expected document signatures.
    """
    if operation not in SUPPORTED_OPERATIONS:
        return False, f"Unsupported operation '{operation}'."

    config = SUPPORTED_OPERATIONS[operation]

    # File size check
    if len(file_bytes) == 0:
        return False, "Uploaded file is empty (0 bytes)."
    if len(file_bytes) > max_size:
        return False, f"File size exceeds the limit of {max_size // (1024 * 1024)}MB."

    # Extension check
    _, ext = os.path.splitext(original_filename.lower())
    if ext not in config["source_exts"]:
        expected = ", ".join(config["source_exts"])
        return False, f"Invalid file extension '{ext}'. Expected one of: {expected}."

    # Signature / Magic header check
    if "magic_header" in config:
        expected_header = config["magic_header"]
        if not file_bytes.startswith(expected_header):
            return False, "File content does not match expected PDF signature (%PDF-)."

    # Office OpenXML check (.docx, .xlsx, .pptx are ZIP containers starting with PK\x03\x04)
    if ext in [".docx", ".xlsx", ".pptx"]:
        if not file_bytes.startswith(b"PK\x03\x04"):
            return False, f"File content does not match expected OpenXML (ZIP) signature for {ext}."

    return True, None


def validate_pdf_unlock_request(
    file_bytes: bytes,
    original_filename: str,
    max_size: int = MAX_FILE_SIZE_BYTES,
) -> Tuple[bool, Optional[str]]:
    """
    Validates that:
    1. Uploaded file is non-empty.
    2. File size is within safe limits (default 50MB).
    3. File extension is .pdf.
    4. Magic bytes match PDF header (%PDF-).
    """
    if len(file_bytes) == 0:
        return False, "Uploaded file is empty (0 bytes)."
    if len(file_bytes) > max_size:
        return False, f"File size exceeds the limit of {max_size // (1024 * 1024)}MB."

    _, ext = os.path.splitext(original_filename.lower())
    if ext != ".pdf":
        return False, f"Invalid file extension '{ext}'. Expected .pdf file."

    if not file_bytes.startswith(b"%PDF-"):
        return False, "File content does not match expected PDF signature (%PDF-)."

    return True, None

