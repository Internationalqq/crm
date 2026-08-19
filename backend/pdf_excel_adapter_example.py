"""Minimal integration example for an existing Excel parser.

Run:
    python backend/pdf_excel_adapter_example.py path/to/file.pdf

In a real project, keep the body of ``parse_excel`` and replace only its
input loading line with ``read_excel_like``.
"""

from __future__ import annotations

import sys
from pathlib import Path

from pdf_excel_adapter import read_excel_like


def parse_excel(file_path: str | Path):
    """Drop-in boundary: both xlsx and scanned PDF become the same DataFrame."""
    table = read_excel_like(file_path)

    # Existing parser goes here. Examples:
    # rows = table.fillna("").astype(str).values.tolist()
    # return my_existing_parser(rows)
    return table


def process_file(file_path: str | Path):
    """Standard file-processing entry point used by an HTTP worker/CLI."""
    return parse_excel(file_path)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python backend/pdf_excel_adapter_example.py FILE.(xlsx|xls|pdf)")
    dataframe = process_file(sys.argv[1])
    print(dataframe.to_string(index=False, header=False))
