import sqlite3
import sys
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from schedule_tasks import (  # noqa: E402
    build_production_schedule_payload,
    build_section_schedule_forecast,
    calculate_schedule_work_duration,
)


def production_connection() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.executescript(
        """
        CREATE TABLE projects (id INTEGER PRIMARY KEY, title TEXT);
        CREATE TABLE estimate_items (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            unit TEXT NOT NULL,
            planned_qty REAL NOT NULL,
            item_kind TEXT,
            section_title TEXT,
            article TEXT,
            notes TEXT,
            labor_hours_total REAL,
            default_crew_size INTEGER
        );
        CREATE TABLE work_schedule_overrides (
            project_id INTEGER NOT NULL,
            estimate_item_id INTEGER NOT NULL,
            schedule_context TEXT NOT NULL,
            duration_days REAL,
            crew_size INTEGER,
            PRIMARY KEY (project_id, estimate_item_id, schedule_context)
        );
        CREATE TABLE production_schedule_cell_overrides (
            project_id INTEGER NOT NULL,
            estimate_item_id INTEGER NOT NULL,
            day_number INTEGER NOT NULL,
            is_filled INTEGER NOT NULL,
            PRIMARY KEY (project_id, estimate_item_id, day_number)
        );
        CREATE TABLE production_schedule_slot_overrides (
            project_id INTEGER NOT NULL,
            estimate_item_id INTEGER NOT NULL,
            slot_number INTEGER NOT NULL,
            is_filled INTEGER NOT NULL,
            PRIMARY KEY (project_id, estimate_item_id, slot_number)
        );
        INSERT INTO projects (id, title) VALUES (1, 'Объект');
        INSERT INTO estimate_items VALUES
            (10, 1, 'Работа 1', 'шт', 1, 'work', 'Раздел', NULL, NULL, 18, 1),
            (11, 1, 'Работа 2', 'шт', 1, 'work', 'Раздел', NULL, NULL, 18, 2);
        """
    )
    return con


class ProductionScheduleTests(unittest.TestCase):
    def test_reference_uses_nine_hour_person_day(self):
        samples = [
            (85.69, 5, 2),
            (35.32, 5, 1),
            (231.76, 8, 4),
            (550.52, 8, 8),
            (197.94, 6, 4),
            (76.63, 5, 2),
            (6.67, 4, 1),
        ]
        for labor_hours, crew_size, expected_days in samples:
            result = calculate_schedule_work_duration(
                {
                    "title": "Работа из референса",
                    "unit": "шт",
                    "planned_qty": 1,
                    "labor_hours_total": labor_hours,
                    "default_crew_size": crew_size,
                }
            )
            self.assertEqual(result["shift_hours"], 9)
            self.assertEqual(result["duration_days"], expected_days)

    def test_section_forecast_uses_shared_work_durations_and_graph_override(self):
        project = {"id": 7}
        works = [
            {
                "id": 1,
                "title": "Первая работа",
                "unit": "шт",
                "planned_qty": 1,
                "item_kind": "work",
                "section_title": "Раздел 1",
                "actual_qty": 0,
                "is_completed": 0,
                "labor_hours_total": 18,
                "default_crew_size": 1,
            },
            {
                "id": 2,
                "title": "Вторая работа",
                "unit": "шт",
                "planned_qty": 1,
                "item_kind": "work",
                "section_title": "Раздел 1",
                "actual_qty": 0,
                "is_completed": 0,
                "labor_hours_total": 18,
                "default_crew_size": 2,
            },
        ]
        forecast = build_section_schedule_forecast(
            project,
            works,
            date(2026, 1, 1),
            overrides={1: {"duration_days": 4}},
        )
        section = forecast["sections"][0]
        self.assertEqual([item["durationDays"] for item in section["items"]], [4, 1])
        self.assertEqual([item["autoDays"] for item in section["items"]], [2, 1])
        self.assertEqual(section["estimatedDays"], 5)
        self.assertEqual(forecast["totalDays"], 5)

    def test_production_schedule_is_sequential_then_applies_independent_cells(self):
        con = production_connection()
        con.execute(
            "INSERT INTO work_schedule_overrides VALUES (1, 10, 'graph', 8, NULL)"
        )
        baseline = build_production_schedule_payload(con, 1)
        self.assertEqual(baseline["autoDayCount"], 3)
        self.assertEqual(baseline["items"][0]["autoFilledSlots"], [1, 2, 3, 4])
        self.assertEqual(baseline["items"][1]["autoFilledSlots"], [5, 6])

        con.executemany(
            "INSERT INTO production_schedule_slot_overrides VALUES (?, ?, ?, ?)",
            [(1, 11, 5, 0), (1, 11, 6, 0), (1, 11, 1, 1)],
        )
        edited = build_production_schedule_payload(con, 1)
        self.assertEqual(edited["items"][1]["filledSlots"], [1])
        self.assertEqual(edited["items"][1]["effectiveDays"], 0.5)
        self.assertEqual(edited["items"][0]["durationDays"], 2)
        con.close()

    def test_graph_forecast_keeps_half_day_override(self):
        project = {"id": 7}
        works = [
            {
                "id": 1,
                "title": "Работа 1",
                "unit": "шт",
                "planned_qty": 1,
                "item_kind": "work",
                "section_title": "Раздел",
                "actual_qty": 0,
                "is_completed": 0,
                "labor_hours_total": 18,
                "default_crew_size": 1,
            },
            {
                "id": 2,
                "title": "Работа 2",
                "unit": "шт",
                "planned_qty": 1,
                "item_kind": "work",
                "section_title": "Раздел",
                "actual_qty": 0,
                "is_completed": 0,
                "labor_hours_total": 18,
                "default_crew_size": 2,
            },
        ]
        forecast = build_section_schedule_forecast(
            project,
            works,
            date(2026, 1, 1),
            overrides={1: {"duration_days": 0.5}},
        )
        self.assertEqual([item["durationDays"] for item in forecast["sections"][0]["items"]], [0.5, 1.0])
        self.assertEqual(forecast["sections"][0]["estimatedDays"], 1.5)
        self.assertEqual(forecast["totalDays"], 2)

    def test_production_duration_override_is_separate_from_graph_override(self):
        con = production_connection()
        con.executemany(
            "INSERT INTO work_schedule_overrides VALUES (?, ?, ?, ?, ?)",
            [
                (1, 10, "graph", 8, None),
                (1, 10, "production", 4, None),
            ],
        )
        schedule = build_production_schedule_payload(con, 1)
        self.assertEqual(schedule["items"][0]["durationDays"], 4)
        self.assertEqual(schedule["items"][0]["autoDays"], 2)
        self.assertTrue(schedule["items"][0]["isDurationOverridden"])
        self.assertEqual(schedule["items"][1]["autoFilledSlots"], [9, 10])
        self.assertEqual(schedule["autoDayCount"], 5)
        con.close()

    def test_half_day_duration_starts_next_work_in_next_half_slot(self):
        con = production_connection()
        con.execute(
            "INSERT INTO work_schedule_overrides VALUES (1, 10, 'production', 1.5, NULL)"
        )
        schedule = build_production_schedule_payload(con, 1)
        self.assertEqual(schedule["items"][0]["durationDays"], 1.5)
        self.assertEqual(schedule["items"][0]["autoFilledSlots"], [1, 2, 3])
        self.assertEqual(schedule["items"][1]["autoFilledSlots"], [4, 5])
        self.assertEqual(schedule["autoDayCount"], 3)
        con.close()


if __name__ == "__main__":
    unittest.main()
