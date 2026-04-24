"""
pdf_exporter.py
---------------
Optional PDF export for generated .docx files.

Strategy (in priority order):
  1. docx2pdf  — wraps MS Word COM automation on Windows / AppleScript on macOS.
                 Best quality, requires Microsoft Word to be installed.
  2. LibreOffice headless — cross-platform, no MS Word needed.
  3. Graceful failure — logs a warning and returns False so the caller can
                        continue without crashing.
"""

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ── Strategy 1: docx2pdf ─────────────────────────────────────────────────────

def _export_via_docx2pdf(docx_path: str) -> bool:
    try:
        from docx2pdf import convert  # type: ignore

        pdf_path = str(Path(docx_path).with_suffix(".pdf"))
        convert(docx_path, pdf_path)
        logger.info("PDF exported (docx2pdf): %s", pdf_path)
        return True
    except ImportError:
        logger.debug("docx2pdf not available.")
        return False
    except Exception as exc:
        logger.error("docx2pdf failed for '%s': %s", docx_path, exc)
        return False


# ── Strategy 2: LibreOffice ──────────────────────────────────────────────────

def _find_libreoffice() -> Optional[str]:
    """Return the path to the LibreOffice/soffice executable, or None."""
    candidates = [
        "soffice",
        "libreoffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]
    for candidate in candidates:
        if shutil.which(candidate):
            return candidate
        if Path(candidate).is_file():
            return candidate
    return None


def _export_via_libreoffice(docx_path: str) -> bool:
    exe = _find_libreoffice()
    if exe is None:
        logger.debug("LibreOffice not found.")
        return False

    out_dir = str(Path(docx_path).parent)
    cmd = [exe, "--headless", "--convert-to", "pdf", "--outdir", out_dir, docx_path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            pdf_name = Path(docx_path).with_suffix(".pdf").name
            logger.info("PDF exported (LibreOffice): %s", Path(out_dir) / pdf_name)
            return True
        logger.error("LibreOffice exited %d: %s", result.returncode, result.stderr.strip())
        return False
    except subprocess.TimeoutExpired:
        logger.error("LibreOffice timed out converting '%s'.", docx_path)
        return False
    except Exception as exc:
        logger.error("LibreOffice error for '%s': %s", docx_path, exc)
        return False


# ── Public API ───────────────────────────────────────────────────────────────

def export_to_pdf(docx_path: str) -> bool:
    """
    Convert *docx_path* to a PDF file in the same directory.

    Tries docx2pdf first (requires MS Word), then LibreOffice headless.
    Returns True on success, False if neither method is available or both fail.
    """
    if not Path(docx_path).exists():
        logger.error("Cannot export PDF — file not found: %s", docx_path)
        return False

    if _export_via_docx2pdf(docx_path):
        return True
    if _export_via_libreoffice(docx_path):
        return True

    logger.warning(
        "PDF export skipped for '%s'. "
        "Install 'docx2pdf' (+ MS Word) or LibreOffice to enable PDF output.",
        Path(docx_path).name,
    )
    return False
