from __future__ import annotations

import contextlib
import io
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from tools import repair_estimate_prices_from_rows as repair


ESTIMATE_ID = "abcdef1234567890"


class RepairEstimatePricesFromRowsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.database = self.root / "crm.sqlite3"
        self.estimate_dir = self.root / ESTIMATE_ID
        self.estimate_dir.mkdir()
        self.rows_json = self.estimate_dir / "rows.json"
        self.rows = [
            {
                "idx": 0,
                "name": "Работа с ошибочной импортированной ценой",
                "qty": 100,
                "unit_price": 500,
                "total": 100,
                "item_no": 1,
                "basis_code": "ГЭСН 01-01",
            },
            {
                "idx": 1,
                "name": "Строка, которая уже сходится",
                "qty": 999,
                "unit_price": 999,
                "total": 30,
                "item_no": 2,
                "basis_code": "ФССЦ 02-02",
            },
        ]
        self._write_rows(self.rows)
        (self.estimate_dir / "meta.json").write_text(
            json.dumps({"id": ESTIMATE_ID}, ensure_ascii=False),
            encoding="utf-8",
        )
        self._create_database()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _write_rows(self, rows: list[dict]) -> None:
        self.rows_json.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    def _create_database(self) -> None:
        connection = sqlite3.connect(self.database)
        connection.executescript(
            """
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                contract_no TEXT,
                description TEXT,
                budget REAL NOT NULL DEFAULT 0
            );
            CREATE TABLE project_estimates (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                source_key TEXT,
                external_id TEXT,
                title TEXT
            );
            CREATE TABLE estimate_items (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                estimate_source_id INTEGER,
                title TEXT NOT NULL,
                planned_qty REAL NOT NULL,
                planned_price REAL NOT NULL,
                article TEXT,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                entity TEXT,
                entity_id INTEGER,
                payload TEXT,
                created_at INTEGER NOT NULL
            );
            INSERT INTO projects (id, title, contract_no, description, budget)
            VALUES (7, 'Чебаркуль', 'ESTIMATE-abcdef1234567890', NULL, 1000000);
            INSERT INTO project_estimates (id, project_id, source_key, external_id, title)
            VALUES (9, 7, 'abcdef1234567890', 'abcdef1234567890', 'Исходная смета');
            INSERT INTO estimate_items (
                id, project_id, estimate_source_id, title, planned_qty, planned_price, article
            ) VALUES
                (101, 7, 9, 'Первая позиция', 5, 100, 'ГЭСН 01-01'),
                (102, 7, 9, 'Вторая позиция', 3, 10, 'ФССЦ 02-02');
            """
        )
        connection.commit()
        connection.close()

    def _prices(self, database: Path | None = None) -> list[tuple[float, float]]:
        connection = sqlite3.connect(database or self.database)
        try:
            return list(
                connection.execute(
                    "SELECT planned_qty, planned_price FROM estimate_items ORDER BY id"
                )
            )
        finally:
            connection.close()

    def test_dry_run_is_default_and_does_not_write_any_file_or_audit(self) -> None:
        source_before = self.rows_json.read_bytes()
        database_before = self.database.read_bytes()
        output = io.StringIO()

        with contextlib.redirect_stdout(output):
            exit_code = repair.main(
                [
                    "--database",
                    str(self.database),
                    "--project-id",
                    "7",
                    "--rows-json",
                    str(self.rows_json),
                ]
            )

        result = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(result["mode"], "dry-run")
        self.assertIsNone(result["backup"])
        self.assertEqual(result["totals"]["rows"], 2)
        self.assertEqual(result["totals"]["changed_rows"], 1)
        self.assertEqual(result["totals"]["crm_before"], 530)
        self.assertEqual(result["totals"]["source"], 130)
        self.assertEqual(result["totals"]["crm_after"], 130)
        self.assertEqual(result["changes"][0]["after"]["planned_price"], 20)
        self.assertEqual(self.rows_json.read_bytes(), source_before)
        self.assertEqual(self.database.read_bytes(), database_before)
        self.assertEqual(self._prices(), [(5.0, 100.0), (3.0, 10.0)])
        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0], 0)
        finally:
            connection.close()
        self.assertEqual(list(self.root.glob("*.bak")), [])

    def test_apply_backs_up_updates_only_bad_price_and_audits_before_after_source(self) -> None:
        source_before = self.rows_json.read_bytes()

        result = repair.repair_estimate_prices(
            self.database,
            7,
            self.rows_json,
            apply=True,
        )

        self.assertEqual(result["mode"], "apply")
        self.assertEqual(result["totals"]["changed_rows"], 1)
        backup = Path(result["backup"])
        self.assertTrue(backup.is_file())
        self.assertEqual(self._prices(), [(5.0, 20.0), (3.0, 10.0)])
        self.assertEqual(self._prices(backup), [(5.0, 100.0), (3.0, 10.0)])
        self.assertEqual(self.rows_json.read_bytes(), source_before)

        connection = sqlite3.connect(self.database)
        connection.row_factory = sqlite3.Row
        try:
            audits = connection.execute(
                "SELECT action, entity, entity_id, payload FROM audit_log ORDER BY id"
            ).fetchall()
        finally:
            connection.close()
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0]["action"], repair.AUDIT_ACTION)
        self.assertEqual(audits[0]["entity"], "estimate_item")
        self.assertEqual(audits[0]["entity_id"], 101)
        payload = json.loads(audits[0]["payload"])
        self.assertEqual(payload["before"]["planned_qty"], 5)
        self.assertEqual(payload["before"]["planned_price"], 100)
        self.assertEqual(payload["after"]["planned_qty"], 5)
        self.assertEqual(payload["after"]["planned_price"], 20)
        self.assertEqual(payload["source"]["kind"], "autobot_rows_json")
        self.assertEqual(payload["source"]["total"], 100)
        self.assertEqual(payload["source"]["sha256"], result["source"]["sha256"])

    def test_apply_refuses_order_or_article_mismatch_before_backup(self) -> None:
        swapped = [self.rows[1], self.rows[0]]
        self._write_rows(swapped)

        with self.assertRaisesRegex(repair.RepairError, "order/article mismatch"):
            repair.repair_estimate_prices(self.database, 7, self.rows_json, apply=True)

        self.assertEqual(self._prices(), [(5.0, 100.0), (3.0, 10.0)])
        self.assertEqual(list(self.root.glob("*.bak")), [])

    def test_apply_refuses_source_project_estimate_id_mismatch(self) -> None:
        (self.estimate_dir / "meta.json").write_text(
            json.dumps({"id": "1111111111111111"}),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(repair.RepairError, "Conflicting AutoBot estimate ids|Estimate id mismatch"):
            repair.repair_estimate_prices(self.database, 7, self.rows_json, apply=True)

        self.assertEqual(self._prices(), [(5.0, 100.0), (3.0, 10.0)])
        self.assertEqual(list(self.root.glob("*.bak")), [])

    def test_row_count_mismatch_is_rejected(self) -> None:
        self._write_rows(self.rows[:1])

        with self.assertRaisesRegex(repair.RepairError, "row count mismatch"):
            repair.repair_estimate_prices(self.database, 7, self.rows_json)

    def test_blank_source_price_and_total_are_preserved_when_crm_total_is_zero(self) -> None:
        self.rows.append(
            {
                "name": "Позиция без цены в исходнике",
                "qty": 0.046,
                "unit_price": None,
                "total": None,
                "item_no": "2.1",
                "basis_code": "ФСБЦ 03-03",
            }
        )
        self._write_rows(self.rows)
        connection = sqlite3.connect(self.database)
        try:
            connection.execute(
                """
                INSERT INTO estimate_items (
                    id, project_id, estimate_source_id, title, planned_qty, planned_price, article
                ) VALUES (103, 7, 9, 'Позиция без цены', 0.046, 0, 'ФСБЦ 03-03')
                """
            )
            connection.commit()
        finally:
            connection.close()

        result = repair.repair_estimate_prices(self.database, 7, self.rows_json)

        self.assertEqual(result["totals"]["rows"], 3)
        self.assertEqual(result["totals"]["changed_rows"], 1)
        self.assertEqual(result["totals"]["source"], 130)
        self.assertEqual(result["totals"]["crm_after"], 130)


if __name__ == "__main__":
    unittest.main()
