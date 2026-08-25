import sqlite3
import sys
import unittest
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from schedule_tasks import (  # noqa: E402
    api_update_production_schedule,
    api_project_section_schedule_forecast,
    api_update_section_schedule_override,
    build_production_schedule_payload,
    build_section_schedule_forecast,
    calculate_schedule_work_duration,
    production_replace_links,
)
import schedule_tasks as schedule_module  # noqa: E402


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
        CREATE TABLE production_schedule_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            generation_key TEXT NOT NULL,
            title TEXT NOT NULL,
            planned_qty REAL,
            unit TEXT NOT NULL DEFAULT '',
            people_count INTEGER NOT NULL DEFAULT 1,
            shift_count INTEGER NOT NULL DEFAULT 1,
            brigade_count INTEGER NOT NULL DEFAULT 1,
            labor_hours_total REAL,
            auto_duration_days REAL NOT NULL DEFAULT 1,
            manual_duration_days REAL,
            placement_mode TEXT NOT NULL DEFAULT 'auto',
            position INTEGER NOT NULL DEFAULT 0,
            origin TEXT NOT NULL DEFAULT 'auto',
            status TEXT NOT NULL DEFAULT 'needs_review',
            color TEXT NOT NULL DEFAULT 'slate',
            template_key TEXT,
            source_signature TEXT,
            source_link_count INTEGER NOT NULL DEFAULT 0,
            source_links_snapshot TEXT NOT NULL DEFAULT '[]',
            manual_fields TEXT NOT NULL DEFAULT '[]',
            created_by INTEGER,
            updated_by INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE (project_id, generation_key)
        );
        CREATE TABLE production_schedule_operation_estimate_links (
            operation_id INTEGER NOT NULL,
            estimate_item_id INTEGER NOT NULL,
            link_role TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (operation_id, estimate_item_id, link_role)
        );
        CREATE TABLE production_schedule_operation_slot_overrides (
            operation_id INTEGER NOT NULL,
            slot_number INTEGER NOT NULL,
            is_filled INTEGER NOT NULL,
            updated_by INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (operation_id, slot_number)
        );
        CREATE TABLE production_schedule_migration_state (
            project_id INTEGER PRIMARY KEY,
            legacy_migrated_at INTEGER NOT NULL
        );
        CREATE TABLE production_schedule_suppressed_keys (
            project_id INTEGER NOT NULL,
            generation_key TEXT NOT NULL,
            created_by INTEGER,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (project_id, generation_key)
        );
        CREATE TABLE production_schedule_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            signature TEXT NOT NULL,
            payload TEXT NOT NULL,
            source_project_id INTEGER,
            created_by INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE (signature, name)
        );
        INSERT INTO projects (id, title) VALUES (1, 'Объект');
        INSERT INTO estimate_items VALUES
            (10, 1, 'Работа 1', 'шт', 1, 'work', 'Раздел', NULL, NULL, 18, 1),
            (11, 1, 'Работа 2', 'шт', 1, 'work', 'Раздел', NULL, NULL, 18, 2);
        """
    )
    return con


def seed_chebarkul_estimate(con: sqlite3.Connection, *, project_id: int = 25, factor: float = 1.0, first_id: int = 1000) -> None:
    con.execute("DELETE FROM estimate_items")
    con.execute("DELETE FROM projects")
    con.execute("INSERT INTO projects (id, title) VALUES (?, 'ЧБ')", (project_id,))
    rows = [
        (first_id + 0, project_id, 'Ремонт бетонной отмостки толщиной 15 см', 'м2', 256 * factor, 'work', 'Смета ЧБ', 'ТЭСНр69-01-016-02', None, None, None),
        (first_id + 1, project_id, 'Смеси бетонные класс B15', 'м3', 38.4 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-04.1.02.01-0006', None, None, None),
        (first_id + 2, project_id, 'Щебень 20-40 мм', 'м3', 25.6 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-02.2.05.04-2090', None, None, None),
        (first_id + 3, project_id, 'Армирование подстилающих слоев', 'т', .56 * factor, 'work', 'Смета ЧБ', 'ГЭСН06-03-004-14', None, None, None),
        (first_id + 4, project_id, 'Сетка стальная сварная', 'м2', 280 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-08.1.02.17-0081', None, None, None),
        (first_id + 5, project_id, 'Гидроизоляция обмазочная мастикой', 'м2', 76.8 * factor, 'work', 'Смета ЧБ', 'ТЭСН08-01-003-10', None, None, None),
        (first_id + 6, project_id, 'Мастика бутилкаучуковая', 'кг', 42.7 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-14.5.04.01-0001', None, None, None),
        (first_id + 7, project_id, 'Устройство швов в бетоне', 'м', 85 * factor, 'work', 'Смета ЧБ', 'ГЭСН27-06-007-02', None, None, None),
        (first_id + 8, project_id, 'Гидроизоляция швов полиуретановым герметиком', 'м', 85 * factor, 'work', 'Смета ЧБ', 'ТЭСН46-08-022-01', None, None, None),
        (first_id + 9, project_id, 'Герметик для швов', 'кг', 16.5 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-14.5.04.01-0011', None, None, None),
        (first_id + 10, project_id, 'Устройство козырьков на металлических кронштейнах', 'м2', 23.4 * factor, 'work', 'Смета ЧБ', 'ГЭСН12-01-045-01', None, None, None),
        (first_id + 11, project_id, 'Металлоконструкции прочие', 'т', .16 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-07.2.07.12-0031', None, None, None),
        (first_id + 12, project_id, 'Панель из поликарбоната', 'м2', 23.4 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-11.3.03.19-0318', None, None, None),
        (first_id + 13, project_id, 'Ремонт штукатурки фасадов', 'м2', 24.7 * factor, 'work', 'Смета ЧБ', 'ТЭСНр61-02-001-01', None, None, None),
        (first_id + 14, project_id, 'Окраска фасадов акриловыми составами', 'м2', 24.7 * factor, 'work', 'Смета ЧБ', 'ГЭСН15-04-019-05', None, None, None),
        (first_id + 15, project_id, 'Краска акрилатная', 'т', .046 * factor, 'material', 'Смета ЧБ', 'ФСБЦ-14.3.02.01-0111', None, None, None),
    ]
    con.executemany(
        """
        INSERT INTO estimate_items (
            id, project_id, title, unit, planned_qty, item_kind, section_title,
            article, notes, labor_hours_total, default_crew_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


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

        second_operation_id = baseline["items"][1]["id"]
        con.executemany(
            "INSERT INTO production_schedule_operation_slot_overrides (operation_id, slot_number, is_filled, created_at, updated_at) VALUES (?, ?, ?, 1, 1)",
            [(second_operation_id, 5, 0), (second_operation_id, 6, 0), (second_operation_id, 1, 1)],
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

    def test_chebarkul_template_matches_pdf_and_is_idempotent(self):
        con = production_connection()
        seed_chebarkul_estimate(con)

        first = build_production_schedule_payload(con, 25)
        second = build_production_schedule_payload(con, 25)

        self.assertEqual(first["generation"]["mode"], "template")
        self.assertEqual(len(first["items"]), 15)
        self.assertEqual([item["durationDays"] for item in first["items"]], [2, 2, 3, 2, 3, 3, 7, 2, 2, 2, 2, 2, 2, 2, 2])
        self.assertEqual(first["autoDayCount"], 38)
        self.assertEqual([item["id"] for item in first["items"]], [item["id"] for item in second["items"]])
        self.assertIsNone(first["items"][0]["plannedQty"])
        self.assertIsNone(first["items"][13]["plannedQty"])
        self.assertEqual(first["items"][7]["unit"], "кг")
        self.assertEqual(first["items"][0]["status"], "outside_estimate")
        self.assertEqual(first["items"][6]["status"], "linked")
        self.assertEqual(first["items"][10]["status"], "needs_review")
        self.assertTrue(all(item["color"] in {"slate", "blue", "teal", "green", "violet", "rose"} for item in first["items"]))
        con.close()

    def test_chebarkul_productivity_scales_and_rounds_to_half_day(self):
        con = production_connection()
        seed_chebarkul_estimate(con, factor=1.25)

        schedule = build_production_schedule_payload(con, 25)

        self.assertEqual(schedule["items"][1]["durationDays"], 2.5)
        self.assertEqual(schedule["items"][2]["durationDays"], 4)
        self.assertEqual(schedule["items"][6]["durationDays"], 9)
        self.assertEqual(schedule["autoDayCount"], 47)
        con.close()

    def test_unknown_material_does_not_create_operation(self):
        con = production_connection()
        con.execute("DELETE FROM estimate_items")
        con.execute("INSERT INTO estimate_items VALUES (20, 1, 'Неизвестный материал', 'шт', 5, 'material', 'Раздел', NULL, NULL, NULL, NULL)")

        schedule = build_production_schedule_payload(con, 1)

        self.assertEqual(schedule["items"], [])
        self.assertEqual(len(schedule["estimateOptions"]), 1)
        con.close()

    def test_saved_schedule_template_is_consumed_by_future_matching_estimate(self):
        con = production_connection()
        source = build_production_schedule_payload(con, 1)
        operations = []
        for index, item in enumerate(source["items"], start=1):
            operations.append(
                {
                    "title": f"Шаблонная операция {index}",
                    "unit": item["unit"],
                    "plannedQty": item["plannedQty"],
                    "peopleCount": item["peopleCount"],
                    "shiftCount": 1,
                    "brigadeCount": 1,
                    "autoDays": item["autoDays"],
                    "durationDays": 1.5 if index == 1 else item["durationDays"],
                    "color": "blue",
                    "links": item["links"],
                }
            )
        con.execute(
            "INSERT INTO production_schedule_templates (name, signature, payload, source_project_id, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1)",
            ("Проверенный шаблон", source["generation"]["sourceSignature"], json.dumps({"scope": "schedule", "operations": operations}, ensure_ascii=False)),
        )
        con.execute("INSERT INTO projects (id, title) VALUES (2, 'Следующий объект')")
        con.executemany(
            "INSERT INTO estimate_items VALUES (?, 2, ?, 'шт', ?, 'work', 'Раздел', NULL, NULL, ?, ?)",
            [(20, 'Работа 1', 2, 36, 1), (21, 'Работа 2', 2, 36, 2)],
        )

        schedule = build_production_schedule_payload(con, 2)

        self.assertEqual(schedule["generation"]["mode"], "saved_template")
        self.assertEqual([item["title"] for item in schedule["items"]], ["Шаблонная операция 1", "Шаблонная операция 2"])
        self.assertEqual([item["durationDays"] for item in schedule["items"]], [3, 2])
        con.close()

    def test_saved_template_does_not_guess_between_duplicate_article_and_title(self):
        con = production_connection()
        con.executescript(
            """
            ALTER TABLE estimate_items ADD COLUMN estimate_source_id INTEGER;
            ALTER TABLE estimate_items ADD COLUMN source_item_key TEXT;
            CREATE TABLE project_estimates (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                source_type TEXT NOT NULL,
                source_key TEXT NOT NULL
            );
            INSERT INTO projects (id, title) VALUES (2, 'Новый объект');
            INSERT INTO project_estimates VALUES (100, 2, 'estimate', 'source-a');
            INSERT INTO project_estimates VALUES (101, 2, 'estimate', 'source-b');
            INSERT INTO project_estimates VALUES (102, 2, 'estimate', 'source-c');
            INSERT INTO estimate_items (
                id, project_id, title, unit, planned_qty, item_kind,
                section_title, article, labor_hours_total, default_crew_size,
                estimate_source_id, source_item_key
            ) VALUES
                (20, 2, 'Одинаковая работа', 'м2', 10, 'work', 'Раздел А', 'DUP-01', 9, 1, 100, 'row-a'),
                (21, 2, 'Одинаковая работа', 'м2', 10, 'work', 'Раздел Б', 'DUP-01', 9, 1, 101, 'row-b'),
                (22, 2, 'Одинаковая работа', 'м2', 10, 'material', 'Раздел В', 'DUP-01', NULL, NULL, 102, 'row-c');
            """
        )
        payload = {
            "scope": "schedule",
            "operations": [
                {
                    "title": "Точно сопоставленная",
                    "plannedQty": 10,
                    "unit": "м2",
                    "durationDays": 1,
                    "links": [
                        {
                            "role": "work_basis",
                            "title": "Одинаковая работа",
                            "article": "DUP-01",
                            "sectionTitle": "Раздел Б",
                            "estimateSourceKey": "source-b",
                            "estimateSourceType": "estimate",
                            "sourceItemKey": "row-b",
                            "plannedQty": 10,
                        }
                    ],
                },
                {
                    "title": "Неоднозначная",
                    "plannedQty": 10,
                    "unit": "м2",
                    "durationDays": 1,
                    "links": [
                        {
                            "role": "work_basis",
                            "title": "Одинаковая работа",
                            "article": "DUP-01",
                            "plannedQty": 10,
                        }
                    ],
                },
            ],
        }
        con.execute(
            """
            INSERT INTO production_schedule_templates (
                name, signature, payload, source_project_id, created_at, updated_at
            ) VALUES ('Дубликаты', 'duplicate-signature', ?, 1, 1, 1)
            """,
            (json.dumps(payload, ensure_ascii=False),),
        )

        rows = schedule_module.production_estimate_rows(con, 2)
        result = schedule_module.build_saved_template_seeds(
            con, "duplicate-signature", rows, 2
        )

        self.assertIsNotNone(result)
        seeds, _ = result
        self.assertEqual(seeds[0]["links"], [(21, "work_basis")])
        self.assertEqual(seeds[0]["status"], "linked")
        self.assertEqual(seeds[1]["links"], [])
        self.assertEqual(seeds[1]["status"], "needs_review")
        con.close()

    def test_suppressed_generated_operation_does_not_reappear(self):
        con = production_connection()
        schedule = build_production_schedule_payload(con, 1)
        removed = schedule["items"][0]
        con.execute(
            "INSERT INTO production_schedule_suppressed_keys (project_id, generation_key, created_at) VALUES (1, ?, 1)",
            (removed["generationKey"],),
        )
        con.execute("DELETE FROM production_schedule_operations WHERE id = ?", (removed["id"],))

        refreshed = build_production_schedule_payload(con, 1)

        self.assertEqual(len(refreshed["items"]), 1)
        self.assertNotIn(removed["generationKey"], {item["generationKey"] for item in refreshed["items"]})
        con.close()

    def test_manual_links_are_not_reinserted_during_sync(self):
        con = production_connection()
        schedule = build_production_schedule_payload(con, 1)
        operation_id = schedule["items"][0]["id"]
        con.execute("DELETE FROM production_schedule_operation_estimate_links WHERE operation_id = ?", (operation_id,))
        con.execute("UPDATE production_schedule_operations SET manual_fields = '[\"links\"]' WHERE id = ?", (operation_id,))

        refreshed = build_production_schedule_payload(con, 1)
        operation = next(item for item in refreshed["items"] if item["id"] == operation_id)

        self.assertEqual(operation["links"], [])
        self.assertEqual(operation["status"], "stale")
        con.close()

    def test_operation_survives_deleted_estimate_as_stale_snapshot(self):
        con = production_connection()
        schedule = build_production_schedule_payload(con, 1)
        operation = schedule["items"][0]
        con.execute("DELETE FROM production_schedule_operation_estimate_links WHERE estimate_item_id = 10")
        con.execute("DELETE FROM estimate_items WHERE id = 10")

        refreshed = build_production_schedule_payload(con, 1)
        stale = next(item for item in refreshed["items"] if item["id"] == operation["id"])

        self.assertEqual(stale["status"], "stale")
        self.assertEqual(stale["links"], [])
        self.assertEqual(stale["sourceLinkSnapshots"][0]["estimateItemId"], 10)
        self.assertTrue(stale["sourceLinkSnapshots"][0]["title"])
        con.close()

    def test_manual_placement_is_explicit_and_does_not_drift(self):
        con = production_connection()
        schedule = build_production_schedule_payload(con, 1)
        first_id = schedule["items"][0]["id"]
        second_id = schedule["items"][1]["id"]
        con.execute("UPDATE production_schedule_operations SET placement_mode = 'manual' WHERE id = ?", (second_id,))
        con.executemany(
            "INSERT INTO production_schedule_operation_slot_overrides (operation_id, slot_number, is_filled, created_at, updated_at) VALUES (?, ?, 1, 1, 1)",
            [(second_id, 1), (second_id, 2)],
        )
        con.execute("UPDATE production_schedule_operations SET manual_duration_days = 4 WHERE id = ?", (first_id,))

        refreshed = build_production_schedule_payload(con, 1)
        second = next(item for item in refreshed["items"] if item["id"] == second_id)

        self.assertEqual(second["autoFilledSlots"], [9, 10])
        self.assertEqual(second["filledSlots"], [1, 2])
        self.assertEqual(second["placementMode"], "manual")
        con.close()

    def test_cross_project_operation_link_is_rejected(self):
        con = production_connection()
        schedule = build_production_schedule_payload(con, 1)
        operation_id = schedule["items"][0]["id"]
        con.execute("INSERT INTO projects (id, title) VALUES (2, 'Чужой объект')")
        con.execute("INSERT INTO estimate_items VALUES (20, 2, 'Чужая работа', 'шт', 1, 'work', 'Раздел', NULL, NULL, 9, 1)")

        with self.assertRaises(ValueError):
            production_replace_links(con, 1, operation_id, [(20, "work_basis")])
        con.close()

    def test_operation_api_add_update_cell_reorder_and_delete(self):
        con = production_connection()
        con.executescript(
            """
            ALTER TABLE projects ADD COLUMN internal_schedule_status TEXT DEFAULT 'draft';
            ALTER TABLE projects ADD COLUMN internal_schedule_version INTEGER DEFAULT 1;
            ALTER TABLE projects ADD COLUMN internal_schedule_approved_at INTEGER;
            ALTER TABLE projects ADD COLUMN customer_schedule_status TEXT DEFAULT 'draft';
            ALTER TABLE projects ADD COLUMN customer_schedule_version INTEGER DEFAULT 1;
            ALTER TABLE projects ADD COLUMN customer_schedule_approved_at INTEGER;
            ALTER TABLE projects ADD COLUMN updated_at INTEGER;
            CREATE TABLE audit_log (
                user_id INTEGER,
                action TEXT,
                entity TEXT,
                entity_id INTEGER,
                payload TEXT,
                created_at INTEGER
            );
            """
        )

        class SharedConnection:
            def __enter__(self):
                return con

            def __exit__(self, exc_type, exc_value, traceback):
                if exc_type is None:
                    con.commit()
                else:
                    con.rollback()
                return False

        class Handler:
            def __init__(self, payload):
                self.payload = payload
                self.status = None
                self.response = None

            def require_project_access(self, project_id):
                return {"id": 7, "login": "admin", "role": "admin", "roles": []}

            def read_json(self):
                return self.payload

            def send_json(self, status, response):
                self.status = int(status)
                self.response = response

        original_db = schedule_module.db
        schedule_module.db = lambda: SharedConnection()
        try:
            added = Handler(
                {
                    "action": "add_operation",
                    "title": "Ручная операция",
                    "planned_qty": None,
                    "unit": "шт",
                    "duration_days": 1.5,
                    "links": [{"estimate_item_id": 10, "role": "manual_reference"}],
                    "color": "blue",
                }
            )
            api_update_production_schedule(added, "/api/projects/1/production-schedule")
            self.assertEqual(added.status, 200)
            manual = next(item for item in added.response["items"] if item["origin"] == "manual")
            self.assertIsNone(manual["plannedQty"])

            generated = next(item for item in added.response["items"] if item["origin"] == "auto")
            split = Handler({"action": "split_operation", "operation_id": generated["id"]})
            api_update_production_schedule(split, "/api/projects/1/production-schedule")
            self.assertEqual(split.status, 200)
            split_first = next(item for item in split.response["items"] if item["id"] == generated["id"])
            self.assertEqual(split_first["autoDays"], 1)
            self.assertEqual(split_first["durationDays"], 1)
            split_row = con.execute("SELECT labor_hours_total FROM production_schedule_operations WHERE id = ?", (generated["id"],)).fetchone()
            self.assertEqual(split_row["labor_hours_total"], 9)

            saved = Handler({"action": "save_template", "operation_id": generated["id"], "name": "Этап работы"})
            api_update_production_schedule(saved, "/api/projects/1/production-schedule")
            self.assertEqual(saved.status, 200)
            saved_payload = json.loads(con.execute("SELECT payload FROM production_schedule_templates WHERE name = 'Этап работы'").fetchone()["payload"])
            self.assertEqual(saved_payload["scope"], "operation")
            self.assertEqual(saved_payload["operations"][0]["durationDays"], 1)

            con.execute("UPDATE production_schedule_operations SET status = 'stale' WHERE id = ?", (manual["id"],))
            updated = Handler(
                {
                    "action": "update_operation",
                    "operation_id": manual["id"],
                    "title": "Ручная операция 2",
                    "people_count": 2,
                    "linked_estimate_item_ids": [10],
                }
            )
            api_update_production_schedule(updated, "/api/projects/1/production-schedule")
            self.assertEqual(updated.status, 200)
            changed = next(item for item in updated.response["items"] if item["id"] == manual["id"])
            self.assertEqual(changed["title"], "Ручная операция 2")
            self.assertEqual(changed["peopleCount"], 2)
            self.assertEqual(changed["status"], "needs_review")
            self.assertEqual(changed["links"][0]["role"], "manual_reference")

            cell = Handler({"action": "set_cell", "operation_id": manual["id"], "slot_number": 1, "is_filled": True})
            api_update_production_schedule(cell, "/api/projects/1/production-schedule")
            self.assertEqual(cell.status, 200)
            changed = next(item for item in cell.response["items"] if item["id"] == manual["id"])
            self.assertEqual(changed["placementMode"], "manual")
            self.assertIn(1, changed["filledSlots"])

            reordered = Handler({"action": "reorder_operations", "operation_ids": [manual["id"]]})
            api_update_production_schedule(reordered, "/api/projects/1/production-schedule")
            self.assertEqual(reordered.status, 200)
            self.assertEqual(reordered.response["items"][0]["id"], manual["id"])

            deleted = Handler({"action": "delete_operation", "operation_id": manual["id"]})
            api_update_production_schedule(deleted, "/api/projects/1/production-schedule")
            self.assertEqual(deleted.status, 200)
            self.assertNotIn(manual["id"], {item["id"] for item in deleted.response["items"]})
        finally:
            schedule_module.db = original_db
            con.close()

    def test_graph_respects_manual_item_kind_override(self):
        con = production_connection()
        con.executescript(
            """
            ALTER TABLE projects ADD COLUMN started_at TEXT;
            ALTER TABLE projects ADD COLUMN internal_schedule_status TEXT DEFAULT 'draft';
            ALTER TABLE projects ADD COLUMN internal_schedule_version INTEGER DEFAULT 1;
            ALTER TABLE projects ADD COLUMN internal_schedule_approved_at INTEGER;
            ALTER TABLE projects ADD COLUMN customer_schedule_status TEXT DEFAULT 'draft';
            ALTER TABLE projects ADD COLUMN customer_schedule_version INTEGER DEFAULT 1;
            ALTER TABLE projects ADD COLUMN customer_schedule_approved_at INTEGER;
            ALTER TABLE projects ADD COLUMN updated_at INTEGER;
            ALTER TABLE estimate_items ADD COLUMN item_kind_override TEXT;
            ALTER TABLE estimate_items ADD COLUMN is_completed INTEGER DEFAULT 0;
            ALTER TABLE estimate_items ADD COLUMN actual_qty REAL DEFAULT 0;
            ALTER TABLE work_schedule_overrides ADD COLUMN updated_by INTEGER;
            ALTER TABLE work_schedule_overrides ADD COLUMN created_at INTEGER;
            ALTER TABLE work_schedule_overrides ADD COLUMN updated_at INTEGER;
            CREATE TABLE audit_log (
                user_id INTEGER,
                action TEXT,
                entity TEXT,
                entity_id INTEGER,
                payload TEXT,
                created_at INTEGER
            );
            UPDATE estimate_items SET item_kind = 'material';
            UPDATE estimate_items SET item_kind_override = 'work' WHERE id = 10;
            """
        )

        class SharedConnection:
            def __enter__(self):
                return con

            def __exit__(self, exc_type, exc_value, traceback):
                if exc_type is None:
                    con.commit()
                return False

        class Handler:
            def __init__(self, payload):
                self.payload = payload
                self.status = None
                self.response = None

            def require_project_access(self, project_id):
                return {"id": 7, "login": "admin", "role": "admin", "roles": []}

            def read_json(self):
                return self.payload

            def send_json(self, status, response):
                self.status = int(status)
                self.response = response

        original_db = schedule_module.db
        schedule_module.db = lambda: SharedConnection()
        try:
            forecast = Handler({})
            api_project_section_schedule_forecast(forecast, "/api/projects/1/section-schedule-forecast")
            self.assertEqual(forecast.status, 200)
            graph_ids = [item["id"] for section in forecast.response["sections"] for item in section["items"]]
            self.assertEqual(graph_ids, [10])

            override = Handler({"item_id": 10, "duration_days": 1.5})
            api_update_section_schedule_override(override, "/api/projects/1/section-schedule-override")
            self.assertEqual(override.status, 200, override.response)
            saved = con.execute(
                "SELECT duration_days FROM work_schedule_overrides WHERE project_id = 1 AND estimate_item_id = 10 AND schedule_context = 'graph'"
            ).fetchone()
            self.assertEqual(saved["duration_days"], 1.5)
        finally:
            schedule_module.db = original_db
            con.close()


if __name__ == "__main__":
    unittest.main()
