"""PDF -> Excel-like table adapter.

The adapter deliberately returns a rectangular ``list[list[str]]`` and a
``pandas.DataFrame`` with ``header=None`` semantics.  That makes the result
usable by parsers which already consume ``openpyxl``/``pandas`` rows.

Pipeline:
    1. Try vector/text table extraction with pdfplumber.
    2. If the page is a scan, render it with PyMuPDF, deskew and detect the
       visible grid with OpenCV.
    3. OCR each detected cell.  If no reliable grid is present, OCR words and
       reconstruct rows/columns from their coordinates.

Tesseract itself is an external executable; see ``README`` in the module
docstring below and the project requirements for the Python packages.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


class PdfExcelAdapterError(RuntimeError):
    """Raised when a PDF cannot be converted to a usable table."""


@dataclass(slots=True)
class PdfTableResult:
    """Extraction result shared by all downstream parsers."""

    rows: list[list[str]]
    method: str
    pages: int

    def to_dataframe(self):
        """Return the same shape as ``pandas.read_excel(..., header=None)``."""
        try:
            import pandas as pd
        except ImportError as error:  # pragma: no cover - dependency error
            raise PdfExcelAdapterError("Установите зависимость pandas") from error
        return pd.DataFrame(self.rows)


def _clean_cell(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()


def _normalize_rows(rows: Iterable[Sequence[Any]]) -> list[list[str]]:
    """Make rows rectangular while keeping empty cells significant."""
    normalized = [[_clean_cell(cell) for cell in row] for row in rows]
    normalized = [row for row in normalized if any(row)]
    if not normalized:
        return []
    width = max(len(row) for row in normalized)
    result: list[list[str]] = []
    for row in normalized:
        padded = row + [""] * (width - len(row))
        # Trailing empty OCR columns are noise; internal empty cells are not.
        while padded and not padded[-1]:
            padded.pop()
        result.append(padded)
    return result


def _table_score(rows: Sequence[Sequence[Any]]) -> tuple[int, int, int]:
    clean = _normalize_rows(rows)
    if not clean:
        return (0, 0, 0)
    non_empty = sum(bool(cell) for row in clean for cell in row)
    width = max(len(row) for row in clean)
    return (non_empty, len(clean), width)


def _group_consecutive(values: Iterable[int], max_gap: int = 2) -> list[int]:
    values = sorted(set(int(value) for value in values))
    if not values:
        return []
    groups: list[list[int]] = [[values[0]]]
    for value in values[1:]:
        if value - groups[-1][-1] <= max_gap:
            groups[-1].append(value)
        else:
            groups.append([value])
    return [int(round(sum(group) / len(group))) for group in groups]


def _deskew(image, cv2):
    """Rotate a scanned page by the dominant text angle."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    inverted = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    points = cv2.findNonZero(inverted)
    if points is None or len(points) < 50:
        return image
    angle = cv2.minAreaRect(points)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    if abs(angle) < 0.15 or abs(angle) > 12:
        return image
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


class PdfExcelAdapter:
    """Convert a text PDF or scanned PDF table into Excel-like rows."""

    def __init__(
        self,
        *,
        languages: str = "rus+eng",
        dpi: int = 300,
        ocr_psm: int = 6,
        min_grid_lines: int = 3,
    ) -> None:
        self.languages = languages
        self.dpi = dpi
        self.ocr_psm = ocr_psm
        self.min_grid_lines = min_grid_lines

    def extract(self, source: str | Path | bytes | bytearray) -> PdfTableResult:
        raw, display_name = self._read_source(source)
        native_pages = self._extract_native_pages(raw)
        native_rows = _normalize_rows(row for page in native_pages for row in page)
        if self._is_usable(native_rows):
            return PdfTableResult(native_rows, "pdfplumber", len(native_pages))

        ocr_rows, page_count = self._extract_ocr(raw)
        if not ocr_rows:
            raise PdfExcelAdapterError(
                f"Не удалось распознать таблицу в PDF: {display_name}. "
                "Проверьте качество скана и установку Tesseract."
            )
        return PdfTableResult(ocr_rows, "ocr", page_count)

    @staticmethod
    def _read_source(source: str | Path | bytes | bytearray) -> tuple[bytes, str]:
        if isinstance(source, (bytes, bytearray)):
            return bytes(source), "<bytes>"
        path = Path(source)
        try:
            return path.read_bytes(), str(path)
        except OSError as error:
            raise PdfExcelAdapterError(f"Не удалось прочитать PDF: {path}") from error

    @staticmethod
    def _is_usable(rows: Sequence[Sequence[str]]) -> bool:
        if not rows:
            return False
        non_empty = sum(bool(cell) for row in rows for cell in row)
        width = max(len(row) for row in rows)
        # A label/value form may be only two columns; a real table needs at
        # least two populated rows and at least two cells overall.
        return len(rows) >= 2 and width >= 2 and non_empty >= 3

    def _extract_native_pages(self, raw: bytes) -> list[list[list[str]]]:
        try:
            import pdfplumber
        except ImportError:
            return []

        settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "snap_tolerance": 5,
            "join_tolerance": 5,
            "intersection_tolerance": 8,
            "text_x_tolerance": 2,
            "text_y_tolerance": 2,
        }
        pages: list[list[list[str]]] = []
        try:
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                for page in pdf.pages:
                    candidates = page.extract_tables(table_settings=settings) or []
                    best = max(candidates, key=_table_score, default=[])
                    rows = _normalize_rows(best)
                    pages.append(rows)
        except Exception:
            # A malformed/non-text PDF should continue to the OCR path.
            return []
        return pages

    def _extract_ocr(self, raw: bytes) -> tuple[list[list[str]], int]:
        try:
            import cv2
            import fitz  # PyMuPDF
            import numpy as np
            import pytesseract
        except ImportError as error:
            raise PdfExcelAdapterError(
                "Для OCR установите pymupdf, opencv-python-headless, "
                "numpy, pillow и pytesseract"
            ) from error

        try:
            pdf = fitz.open(stream=raw, filetype="pdf")
        except Exception as error:
            raise PdfExcelAdapterError("PDF повреждён или имеет неподдерживаемый формат") from error

        all_rows: list[list[str]] = []
        page_count = len(pdf)
        try:
            for page in pdf:
                scale = self.dpi / 72.0
                pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
                    pixmap.height, pixmap.width, pixmap.n
                )
                if pixmap.n == 4:
                    image = cv2.cvtColor(image, cv2.COLOR_RGBA2BGR)
                else:
                    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
                image = _deskew(image, cv2)
                try:
                    page_rows = self._ocr_grid_page(image, cv2, np, pytesseract)
                except Exception as error:
                    raise PdfExcelAdapterError(
                        "Tesseract не смог выполнить OCR. Установите Tesseract OCR "
                        "и языковые данные rus и eng."
                    ) from error
                if not self._is_usable(page_rows):
                    try:
                        page_rows = self._ocr_layout_page(image, pytesseract)
                    except PdfExcelAdapterError:
                        raise
                    except Exception as error:
                        raise PdfExcelAdapterError(
                            "Tesseract не смог выполнить OCR. Установите Tesseract OCR "
                            "и языковые данные rus и eng."
                        ) from error
                all_rows.extend(page_rows)
        finally:
            pdf.close()
        return _normalize_rows(all_rows), page_count

    def _ocr_grid_page(self, image, cv2, np, pytesseract) -> list[list[str]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 11
        )
        height, width = binary.shape[:2]
        horizontal_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (max(20, width // 35), 1)
        )
        vertical_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (1, max(20, height // 35))
        )
        horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
        vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)
        h_projection = np.sum(horizontal > 0, axis=1)
        v_projection = np.sum(vertical > 0, axis=0)
        h_lines = _group_consecutive(
            np.where(h_projection >= max(40, int(width * 0.12)))[0], max_gap=4
        )
        v_lines = _group_consecutive(
            np.where(v_projection >= max(40, int(height * 0.12)))[0], max_gap=4
        )
        if len(h_lines) < self.min_grid_lines or len(v_lines) < self.min_grid_lines:
            return []

        rows: list[list[str]] = []
        for top, bottom in zip(h_lines, h_lines[1:]):
            if bottom - top < 8:
                continue
            row: list[str] = []
            for left, right in zip(v_lines, v_lines[1:]):
                if right - left < 8:
                    row.append("")
                    continue
                margin_x = max(3, min(12, (right - left) // 20))
                margin_y = max(3, min(10, (bottom - top) // 12))
                crop = gray[top + margin_y : bottom - margin_y, left + margin_x : right - margin_x]
                if crop.size == 0:
                    row.append("")
                    continue
                crop = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
                text = pytesseract.image_to_string(
                    crop,
                    lang=self.languages,
                    config=f"--psm {self.ocr_psm}",
                )
                row.append(_clean_cell(text))
            rows.append(row)
        return _normalize_rows(rows)

    def _ocr_layout_page(self, image, pytesseract) -> list[list[str]]:
        """OCR a borderless/partly broken table using token coordinates."""
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self.languages,
                config=f"--psm {self.ocr_psm}",
                output_type=pytesseract.Output.DICT,
            )
        except Exception as error:
            raise PdfExcelAdapterError(
                "Tesseract не смог выполнить OCR. Установите Tesseract OCR "
                "и языковые данные rus и eng."
            ) from error

        tokens: list[dict[str, float | str]] = []
        for index, raw_text in enumerate(data.get("text", [])):
            text = _clean_cell(raw_text)
            try:
                confidence = float(data.get("conf", ["-1"])[index])
            except (TypeError, ValueError, IndexError):
                confidence = -1
            if not text or confidence < 10:
                continue
            tokens.append(
                {
                    "text": text,
                    "left": float(data["left"][index]),
                    "top": float(data["top"][index]),
                    "width": float(data["width"][index]),
                    "height": float(data["height"][index]),
                }
            )
        if not tokens:
            return []

        median_height = sorted(float(token["height"]) for token in tokens)[len(tokens) // 2]
        row_tolerance = max(10.0, median_height * 0.75)
        rows: list[list[dict[str, float | str]]] = []
        for token in sorted(tokens, key=lambda item: (float(item["top"]), float(item["left"]))):
            center_y = float(token["top"]) + float(token["height"]) / 2
            target = next(
                (row for row in reversed(rows) if abs(center_y - self._row_center(row)) <= row_tolerance),
                None,
            )
            if target is None:
                rows.append([token])
            else:
                target.append(token)

        rows.sort(key=self._row_center)
        typical_gap = max(18.0, median_height * 1.7)
        row_cells: list[list[tuple[float, str]]] = []
        for row in rows:
            row.sort(key=lambda item: float(item["left"]))
            cells: list[tuple[float, str]] = []
            current_text: list[str] = []
            current_left = float(row[0]["left"])
            current_right = current_left
            for token in row:
                left = float(token["left"])
                gap = left - current_right
                if current_text and gap > typical_gap:
                    cells.append((current_left, " ".join(current_text)))
                    current_text = []
                    current_left = left
                current_text.append(str(token["text"]))
                current_right = max(current_right, left + float(token["width"]))
            if current_text:
                cells.append((current_left, " ".join(current_text)))
            row_cells.append(cells)

        anchors = sorted(left for cells in row_cells for left, _ in cells)
        columns: list[float] = []
        for anchor in anchors:
            if not columns or anchor - columns[-1] > max(24.0, median_height * 2.2):
                columns.append(anchor)
            else:
                columns[-1] = (columns[-1] + anchor) / 2

        result: list[list[str]] = []
        for cells in row_cells:
            row = [""] * len(columns)
            for left, text in cells:
                column = min(range(len(columns)), key=lambda index: abs(columns[index] - left))
                row[column] = f"{row[column]} {text}".strip()
            result.append(row)
        return _normalize_rows(result)

    @staticmethod
    def _row_center(row: Sequence[dict[str, float | str]]) -> float:
        return sum(float(token["top"]) + float(token["height"]) / 2 for token in row) / len(row)


def read_excel_like(source: str | Path | bytes | bytearray, **adapter_options):
    """Read ``.xlsx/.xls/.pdf`` into a DataFrame with no header row.

    This is the drop-in boundary for an existing ``parse_excel`` function:
    replace ``pd.read_excel(file_path)`` with this helper and leave the parser
    working with the resulting DataFrame.
    """
    suffix = "" if isinstance(source, (bytes, bytearray)) else Path(source).suffix.lower()
    if suffix == ".pdf":
        return PdfExcelAdapter(**adapter_options).extract(source).to_dataframe()
    try:
        import pandas as pd
    except ImportError as error:  # pragma: no cover - dependency error
        raise PdfExcelAdapterError("Установите зависимость pandas") from error
    return pd.read_excel(source, header=None)


def pdf_to_xlsx(source: str | Path | bytes | bytearray, destination: str | Path, **adapter_options) -> Path:
    """Materialize the adapter result as a real ``.xlsx`` for legacy code."""
    result = PdfExcelAdapter(**adapter_options).extract(source)
    try:
        from openpyxl import Workbook
    except ImportError as error:  # pragma: no cover - dependency error
        raise PdfExcelAdapterError("Установите зависимость openpyxl") from error
    workbook = Workbook()
    sheet = workbook.active
    for row_index, row in enumerate(result.rows, start=1):
        for column_index, value in enumerate(row, start=1):
            sheet.cell(row=row_index, column=column_index, value=value)
    target = Path(destination)
    target.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(target)
    return target
