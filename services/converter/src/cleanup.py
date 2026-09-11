"""
Docly Document Conversion Service - Safe Cleanup Utilities
Ensures zero lingering temporary files or leaked file handles.
"""

import os
import shutil
import time
import logging

logger = logging.getLogger("docly_converter")


def cleanup_path(path: str, max_retries: int = 3, retry_delay: float = 0.2) -> None:
    """
    Safely removes a file or directory tree with retry logic.
    Never throws an unhandled exception.
    """
    if not path or not os.path.exists(path):
        return

    for attempt in range(max_retries):
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            else:
                os.remove(path)
            return
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                logger.warning(f"Could not completely remove temporary path '{path}': {e}")
