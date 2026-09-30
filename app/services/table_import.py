"""Parsing of user-supplied tables (CSV / XLSX) for batch coin import.

The parser is deliberately schema-agnostic: it returns the header row and the
data rows as strings. Mapping columns to coin fields happens in the UI.
"""

import csv
import io
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

MAX_TABLE_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_TABLE_ROWS = 1000
# An .xlsx is a zip archive: a small file can unpack to gigabytes ("zip bomb").
# Real 1000-row sheets unpack to a few MB.
MAX_XLSX_UNPACKED_BYTES = 50 * 1024 * 1024
MAX_XLSX_ENTRIES = 500
SUPPORTED_EXTENSIONS = {".csv", ".xlsx"}
CSV_ENCODINGS = ("utf-8-sig", "cp1251", "latin-1")
# Order matters on ties: prefer ";" and tab over ",".
CSV_DELIMITERS = (";", "\t", ",")


def _cell_to_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, datetime):
        return (
            value.date().isoformat() if value.time() == datetime.min.time() else value.isoformat()
        )
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()


def _decode_csv(data: bytes) -> str:
    for encoding in CSV_ENCODINGS:
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Could not decode the CSV file")


def _detect_delimiter(text: str) -> str:
    """Picks the delimiter that occurs most in the header line.

    csv.Sniffer is unreliable on European exports ("120,5" with ";" separators),
    while header names practically never contain the delimiter.
    """
    header = next((line for line in text.splitlines() if line.strip()), "")
    return max(CSV_DELIMITERS, key=header.count)


def _read_csv(data: bytes) -> list[list[str]]:
    text = _decode_csv(data)
    reader = csv.reader(io.StringIO(text), delimiter=_detect_delimiter(text))
    return [[cell.strip() for cell in row] for row in reader]


def _check_xlsx_archive(data: bytes) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
    except zipfile.BadZipFile as e:
        raise HTTPException(status_code=400, detail="Could not read the Excel file") from e
    # zipfile never unpacks more than an entry's declared size, so the sum is a real bound.
    if (
        len(entries) > MAX_XLSX_ENTRIES
        or sum(entry.file_size for entry in entries) > MAX_XLSX_UNPACKED_BYTES
    ):
        raise HTTPException(status_code=400, detail="The Excel file is too large when unpacked")


def _read_xlsx(data: bytes) -> list[list[str]]:
    # openpyxl parses XML with defusedxml when it is installed (see requirements), which
    # blocks entity-expansion ("billion laughs") and external-entity attacks.
    from openpyxl import load_workbook

    _check_xlsx_archive(data)
    try:
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Could not read the Excel file") from e
    try:
        sheet = workbook.worksheets[0]
        rows: list[list[str]] = []
        for row in sheet.iter_rows(values_only=True):
            rows.append([_cell_to_str(value) for value in row])
            # Header + limit + 1 is enough to detect "too many rows" without reading everything.
            if len(rows) > MAX_TABLE_ROWS + 1:
                break
        return rows
    finally:
        workbook.close()


def _unique_headers(raw: list[str]) -> list[str]:
    headers: list[str] = []
    seen: dict[str, int] = {}
    for index, name in enumerate(raw, start=1):
        name = name or f"Column {index}"
        count = seen.get(name, 0) + 1
        seen[name] = count
        headers.append(name if count == 1 else f"{name} ({count})")
    return headers


def parse_table(filename: str, data: bytes) -> tuple[list[str], list[list[str]]]:
    """Returns (columns, rows). Every row has exactly len(columns) cells.

    CPU-heavy: call it in a thread."""
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .csv or .xlsx")
    if len(data) > MAX_TABLE_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File is too large (max 5 MB)")

    raw_rows = _read_csv(data) if extension == ".csv" else _read_xlsx(data)
    non_empty = [row for row in raw_rows if any(cell for cell in row)]
    if not non_empty:
        raise HTTPException(status_code=400, detail="The table is empty")

    header, *body = non_empty
    if not body:
        raise HTTPException(status_code=400, detail="The table has a header but no data rows")
    if len(body) > MAX_TABLE_ROWS:
        raise HTTPException(
            status_code=400, detail=f"Too many rows (max {MAX_TABLE_ROWS} per import)"
        )

    width = max(len(header), *(len(row) for row in body))
    # Drop trailing columns that have neither a header nor any data.
    while (
        width > 0
        and not (width <= len(header) and header[width - 1])
        and not any(len(row) >= width and row[width - 1] for row in body)
    ):
        width -= 1

    columns = _unique_headers([*header, *[""] * width][:width])
    rows = [[*row, *[""] * width][:width] for row in body]
    return columns, rows
