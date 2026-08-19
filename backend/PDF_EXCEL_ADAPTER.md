# PDF -> Excel adapter

## Схема

```text
file.xlsx -------------------------> read_excel_like() -> DataFrame(header=None)
file.pdf -> pdfplumber
             (fallback for scan)
             PyMuPDF -> deskew -> OpenCV grid -> Tesseract OCR
             -----------------------------------------------> rows/cells
```

`pdfplumber` используется первым для PDF с текстовым слоем: его `extract_tables()`
возвращает структуру `table -> row -> cell`. Для скана страница рендерится
в 300 DPI, выравнивается, границы сетки группируются с допуском в несколько
пикселей, а затем каждая ячейка распознаётся отдельно. При повреждённой или
отсутствующей сетке используется запасной режим по координатам OCR-слов.

## Установка

```bash
pip install -r requirements.txt
```

Для OCR дополнительно нужен сам Tesseract (это не Python-пакет): установите
его и добавьте каталог в PATH. Нужны языковые данные `rus` и `eng`.

## Подключение

```python
from pdf_excel_adapter import read_excel_like


def parse_excel(file_path):
    table = read_excel_like(file_path)
    rows = table.fillna("").astype(str).values.tolist()
    return my_existing_parser(rows)
```

Если старый код требует именно файл `.xlsx`:

```python
from pdf_excel_adapter import pdf_to_xlsx

pdf_to_xlsx("scan.pdf", "work/scan_converted.xlsx")
```

В `backend/finance.py` PDF уже подключён к `parse_finance_pdf_invoice`, после
чего используется прежняя логика поиска наименования, контрагента и суммы.
