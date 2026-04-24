"""
excel_reader.py
---------------
Reads rows from an Excel file and returns them as a list of dicts.
Handles missing values and optional column-level validation.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd

logger = logging.getLogger(__name__)


def read_excel(
    file_path: str,
    required_columns: Optional[List[str]] = None,
    sheet_name: Union[int, str] = 0,
) -> List[Dict[str, Any]]:
    """
    Read an Excel file and return each row as a dict keyed by column header.

    Parameters
    ----------
    file_path        : Path to the .xlsx / .xls / .xlsm file.
    required_columns : Column names that must be non-empty; rows missing any
                       of these are skipped with a warning.
    sheet_name       : Sheet index (0-based) or name. Defaults to first sheet.

    Returns
    -------
    List of row dicts with all values cast to str.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Excel file not found: {file_path}")

    try:
        df = pd.read_excel(path, sheet_name=sheet_name, dtype=str)
    except Exception as exc:
        raise RuntimeError(f"Failed to read '{file_path}': {exc}") from exc

    # Normalise: strip whitespace, convert NaN → ""
    df = df.fillna("").apply(lambda col: col.str.strip() if col.dtype == object else col)

    total_rows = len(df)

    # Drop rows where every column is empty
    df = df[df.apply(lambda row: any(str(v).strip() for v in row), axis=1)]
    empty_dropped = total_rows - len(df)
    if empty_dropped:
        logger.warning("Skipped %d fully-empty row(s).", empty_dropped)

    # Drop rows missing required columns
    if required_columns:
        for col in required_columns:
            if col not in df.columns:
                logger.warning("Required column '%s' not found in Excel.", col)
                continue
            before = len(df)
            df = df[df[col].str.strip() != ""]
            dropped = before - len(df)
            if dropped:
                logger.warning(
                    "Skipped %d row(s) with empty required column '%s'.", dropped, col
                )

    records = df.to_dict(orient="records")
    logger.info("Read %d usable row(s) from '%s'.", len(records), path.name)
    return records


def get_column_names(file_path: str, sheet_name: Union[int, str] = 0) -> List[str]:
    """Return just the column headers from the first row of an Excel sheet."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Excel file not found: {file_path}")
    df = pd.read_excel(path, sheet_name=sheet_name, nrows=0)
    return list(df.columns)
