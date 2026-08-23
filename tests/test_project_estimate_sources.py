import sqlite3
import sys
from datetime import date
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from project_estimates import (
    ensure_project_estimates_schema,
    estimate_source_descriptor,
    list_project_estimates,
    source_item_key,
    upsert_project_estimate,
)
from schedule_tasks import build_section_schedule_forecast


def connection() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE TABLE projects (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
        CREATE TABLE estimate_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            unit TEXT NOT NULL,
            planned_qty REAL NOT NULL,
            planned_price REAL NOT NULL DEFAULT 0,
            item_kind TEXT NOT NULL DEFAULT 'material',
            section_title TEXT
        );
        INSERT INTO users VALUES (7);
        INSERT INTO projects VALUES (10, 'Объект');
        """
    )
    return con


def test_schema_backfills_legacy_rows_without_losing_items() -> None:
    con = connection()
    con.execute(
        "INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price) VALUES (10, 'Кирпич', 'шт', 100, 12)"
    )

    ensure_project_estimates_schema(con)

    item = con.execute("SELECT estimate_source_id, is_deleted FROM estimate_items").fetchone()
    source = con.execute("SELECT * FROM project_estimates WHERE id = ?", (item["estimate_source_id"],)).fetchone()
    assert item["is_deleted"] == 0
    assert source["source_type"] == "legacy"
    assert source["title"] == "Ранее загруженная смета"


def test_two_tender_files_become_two_estimates_and_remain_idempotent() -> None:
    con = connection()
    ensure_project_estimates_schema(con)
    default = {
        "sourceType": "tender",
        "sourceKey": "tender:123",
        "externalId": "123",
        "tenderId": "123",
        "title": "Тендер 123",
    }
    first = {"title": "Монтаж", "unit": "м2", "sourceFile": "/tmp/ЛСР 01.xlsx", "section": "Раздел 1"}
    second = {"title": "Монтаж", "unit": "м2", "sourceFile": "/tmp/ЛСР 02.xlsx", "section": "Раздел 1"}

    first_descriptor = estimate_source_descriptor(default, first, project_id=10)
    second_descriptor = estimate_source_descriptor(default, second, project_id=10)
    assert first_descriptor["source_key"] != second_descriptor["source_key"]
    assert first_descriptor["file_name"] == "ЛСР 01.xlsx"

    first_source = upsert_project_estimate(con, 10, first_descriptor, 7)
    same_first_source = upsert_project_estimate(con, 10, first_descriptor, 7)
    second_source = upsert_project_estimate(con, 10, second_descriptor, 7)
    assert first_source["id"] == same_first_source["id"]
    assert first_source["id"] != second_source["id"]

    for index, (source, item) in enumerate(((first_source, first), (second_source, second)), start=1):
        con.execute(
            """
            INSERT INTO estimate_items (
                project_id, estimate_source_id, source_item_key, title, unit,
                planned_qty, planned_price, item_kind, section_title
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (10, source["id"], source_item_key(item, index), item["title"], item["unit"], 5, 100, "work", item["section"]),
        )

    estimates = list_project_estimates(con, 10)
    assert [row["fileName"] for row in estimates] == ["ЛСР 01.xlsx", "ЛСР 02.xlsx"]
    assert [row["workCount"] for row in estimates] == [1, 1]


def test_schedule_keeps_same_section_names_separate_by_estimate_file() -> None:
    rows = [
        {
            "id": 1,
            "title": "Монтаж перегородок",
            "unit": "м2",
            "planned_qty": 10,
            "section_title": "Раздел 1",
            "actual_qty": 0,
            "is_completed": 0,
            "estimate_source_id": 11,
            "estimate_source_type": "tender",
            "estimate_source_key": "file-a",
            "estimate_tender_id": "123",
            "estimate_title": "ЛСР 01",
            "estimate_file_name": "ЛСР 01.xlsx",
        },
        {
            "id": 2,
            "title": "Монтаж перегородок",
            "unit": "м2",
            "planned_qty": 20,
            "section_title": "Раздел 1",
            "actual_qty": 0,
            "is_completed": 0,
            "estimate_source_id": 12,
            "estimate_source_type": "tender",
            "estimate_source_key": "file-b",
            "estimate_tender_id": "123",
            "estimate_title": "ЛСР 02",
            "estimate_file_name": "ЛСР 02.xlsx",
        },
    ]

    result = build_section_schedule_forecast({"id": 10}, rows, date(2026, 8, 21))

    assert len(result["sections"]) == 2
    assert {section["estimateFileName"] for section in result["sections"]} == {"ЛСР 01.xlsx", "ЛСР 02.xlsx"}
    assert len({section["sectionId"] for section in result["sections"]}) == 2
