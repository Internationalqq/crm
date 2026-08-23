from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from warehouse_control import (  # noqa: E402
    build_warehouse_control,
    create_work_fact,
    ensure_warehouse_control_schema,
    reverse_work_fact,
    upsert_work_material_norm,
)


class WarehouseControlTests(unittest.TestCase):
    def setUp(self) -> None:
        self.con = sqlite3.connect(":memory:")
        self.con.row_factory = sqlite3.Row
        self.con.execute("PRAGMA foreign_keys = ON")
        self.con.executescript(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT,
                first_name TEXT,
                last_name TEXT
            );
            CREATE TABLE projects (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
            CREATE TABLE estimate_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                unit TEXT NOT NULL,
                planned_qty REAL NOT NULL,
                actual_qty REAL NOT NULL DEFAULT 0,
                is_completed INTEGER NOT NULL DEFAULT 0,
                planned_price REAL NOT NULL DEFAULT 0,
                item_kind TEXT NOT NULL DEFAULT 'material',
                section_title TEXT,
                updated_at INTEGER
            );
            CREATE TABLE stock_moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                move_type TEXT NOT NULL CHECK(move_type IN ('purchase','receipt','use','writeoff')),
                qty REAL NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                comment TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            );
            INSERT INTO users VALUES (1, 'Пётр Петров', 'Пётр', 'Петров');
            INSERT INTO projects VALUES (10, 'Объект');
            INSERT INTO estimate_items (
                id, project_id, title, unit, planned_qty, planned_price,
                item_kind, section_title
            ) VALUES
                (101, 10, 'Укладка плитки', 'м2', 100, 500, 'work', 'Полы'),
                (201, 10, 'Плитка', 'м2', 100, 900, 'material', 'Полы'),
                (202, 10, 'Клей', 'кг', 400, 50, 'material', 'Полы');
            INSERT INTO stock_moves (
                project_id, estimate_item_id, move_type, qty, price, comment, created_by, created_at
            ) VALUES
                (10, 201, 'receipt', 100, 900, 'Приход плитки', 1, 50),
                (10, 202, 'receipt', 400, 50, 'Приход клея', 1, 50);
            """
        )
        ensure_warehouse_control_schema(self.con)

    def tearDown(self) -> None:
        self.con.close()

    def add_norms(self) -> None:
        upsert_work_material_norm(self.con, 10, 101, 201, 1.0, 0.0, True, 1, 100)
        upsert_work_material_norm(self.con, 10, 101, 202, 4.0, 5.0, True, 1, 100)

    def test_work_fact_creates_normative_stock_moves_and_updates_progress(self) -> None:
        self.add_norms()
        fact, created = create_work_fact(
            self.con, 10, 101, "2026-08-21", 30, "Уложено за день", "fact-test-0001", 1, 200
        )
        payload = build_warehouse_control(self.con, 10)

        self.assertTrue(created)
        self.assertEqual(fact["entry_kind"], "fact")
        work = payload["works"][0]
        self.assertEqual(work["factQty"], 30)
        self.assertEqual(work["remainingQty"], 70)
        tile = next(item for item in payload["materials"] if item["id"] == 201)
        glue = next(item for item in payload["materials"] if item["id"] == 202)
        self.assertEqual(tile["factUsedQty"], 30)
        self.assertEqual(tile["stockBalanceQty"], 70)
        self.assertEqual(glue["factUsedQty"], 126)
        self.assertEqual(glue["stockBalanceQty"], 274)
        self.assertEqual(payload["summary"]["materialsCount"], 2)
        self.assertEqual(payload["summary"]["fullyReceivedMaterials"], 2)
        tile_move = next(
            move
            for move in payload["movements"]
            if move["materialItemId"] == 201 and move["sourceType"] == "work_fact"
        )
        self.assertEqual(tile_move["moveType"], "use")
        self.assertEqual(tile_move["qty"], 30)
        self.assertEqual(tile_move["materialTitle"], "Плитка")
        estimate = self.con.execute("SELECT actual_qty, is_completed FROM estimate_items WHERE id = 101").fetchone()
        self.assertEqual(tuple(estimate), (30, 0))

    def test_idempotency_prevents_double_stock_deduction(self) -> None:
        self.add_norms()
        first, created_first = create_work_fact(
            self.con, 10, 101, "2026-08-21", 30, "", "fact-test-0002", 1, 200
        )
        second, created_second = create_work_fact(
            self.con, 10, 101, "2026-08-21", 30, "", "fact-test-0002", 1, 201
        )

        self.assertTrue(created_first)
        self.assertFalse(created_second)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(
            self.con.execute("SELECT COUNT(*) FROM stock_moves WHERE source_type = 'work_fact'").fetchone()[0],
            2,
        )

    def test_idempotency_key_cannot_be_reused_for_different_fact(self) -> None:
        self.add_norms()
        fact, _ = create_work_fact(
            self.con, 10, 101, "2026-08-21", 30, "", "fact-test-collision", 1, 200
        )

        with self.assertRaisesRegex(ValueError, "work_fact_idempotency_conflict"):
            create_work_fact(
                self.con, 10, 101, "2026-08-21", 31, "", "fact-test-collision", 1, 201
            )
        with self.assertRaisesRegex(ValueError, "work_fact_idempotency_conflict"):
            reverse_work_fact(
                self.con, 10, int(fact["id"]), "input error", "fact-test-collision", 1, 202
            )

    def test_purchase_without_receipt_is_not_physical_stock(self) -> None:
        self.con.execute(
            "INSERT INTO stock_moves (project_id, estimate_item_id, move_type, qty, created_by, created_at) "
            "VALUES (10, 201, 'purchase', 50, 1, 80)"
        )
        self.con.execute("DELETE FROM stock_moves WHERE estimate_item_id = 201 AND move_type = 'receipt'")

        tile = next(
            item for item in build_warehouse_control(self.con, 10)["materials"] if item["id"] == 201
        )

        self.assertEqual(tile["purchasedQty"], 50)
        self.assertEqual(tile["receivedQty"], 0)
        self.assertEqual(tile["stockBalanceQty"], 0)
        self.assertFalse(tile["hasReceipt"])

    def test_reversal_restores_stock_and_is_an_immutable_separate_record(self) -> None:
        self.add_norms()
        fact, _ = create_work_fact(
            self.con, 10, 101, "2026-08-21", 30, "", "fact-test-0003", 1, 200
        )
        reversal, created = reverse_work_fact(
            self.con, 10, int(fact["id"]), "Ошибка ввода", "reverse-test-0003", 1, 300
        )
        payload = build_warehouse_control(self.con, 10)

        self.assertTrue(created)
        self.assertEqual(reversal["entry_kind"], "reversal")
        self.assertEqual(payload["works"][0]["factQty"], 0)
        tile = next(item for item in payload["materials"] if item["id"] == 201)
        self.assertEqual(tile["factUsedQty"], 0)
        self.assertEqual(tile["stockBalanceQty"], 100)
        with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable"):
            self.con.execute("UPDATE project_work_facts SET quantity = 1 WHERE id = ?", (fact["id"],))

    def test_insufficient_receipt_is_recorded_as_unaccounted_consumption(self) -> None:
        upsert_work_material_norm(self.con, 10, 101, 201, 1.0, 0.0, True, 1, 100)
        create_work_fact(
            self.con, 10, 101, "2026-08-21", 130, "Дополнительный объём", "fact-test-0004", 1, 200
        )
        payload = build_warehouse_control(self.con, 10)

        work = payload["works"][0]
        tile = next(item for item in payload["materials"] if item["id"] == 201)
        self.assertEqual(work["overrunQty"], 30)
        self.assertEqual(tile["stockQty"], 0)
        self.assertEqual(tile["stockBalanceQty"], -30)
        self.assertEqual(tile["unaccountedQty"], 30)
        self.assertEqual(payload["summary"]["riskMaterials"], 1)
        self.assertEqual(payload["summary"]["overrunWorks"], 1)

    def test_norm_change_does_not_rewrite_old_fact_snapshot(self) -> None:
        upsert_work_material_norm(self.con, 10, 101, 201, 1.0, 0.0, True, 1, 100)
        first, _ = create_work_fact(
            self.con, 10, 101, "2026-08-20", 10, "", "fact-test-0005", 1, 200
        )
        upsert_work_material_norm(self.con, 10, 101, 201, 1.2, 0.0, True, 1, 300)
        create_work_fact(
            self.con, 10, 101, "2026-08-21", 10, "", "fact-test-0006", 1, 400
        )

        old_line = self.con.execute(
            "SELECT qty_per_work_unit, expected_qty FROM project_work_fact_materials WHERE fact_id = ?",
            (first["id"],),
        ).fetchone()
        payload = build_warehouse_control(self.con, 10)
        tile = next(item for item in payload["materials"] if item["id"] == 201)
        self.assertEqual(tuple(old_line), (1, 10))
        self.assertEqual(tile["factUsedQty"], 22)

    def test_fact_requires_an_active_norm(self) -> None:
        with self.assertRaisesRegex(ValueError, "work_material_norms_required"):
            create_work_fact(
                self.con, 10, 101, "2026-08-21", 10, "", "fact-test-0007", 1, 200
            )

    def test_estimate_replacement_preserves_fact_history(self) -> None:
        upsert_work_material_norm(self.con, 10, 101, 201, 1.0, 0.0, True, 1, 100)
        fact, _ = create_work_fact(
            self.con, 10, 101, "2026-08-21", 10, "", "fact-test-0008", 1, 200
        )
        self.con.execute("DELETE FROM estimate_items WHERE project_id = 10")

        preserved = self.con.execute("SELECT * FROM project_work_facts WHERE id = ?", (fact["id"],)).fetchone()
        line = self.con.execute("SELECT * FROM project_work_fact_materials WHERE fact_id = ?", (fact["id"],)).fetchone()
        movement = next(
            move
            for move in build_warehouse_control(self.con, 10)["movements"]
            if move["sourceType"] == "work_fact"
        )
        self.assertIsNotNone(preserved)
        self.assertIsNone(preserved["work_item_id"])
        self.assertEqual(preserved["work_title_snapshot"], "Укладка плитки")
        self.assertIsNone(line["material_item_id"])
        self.assertEqual(line["material_title_snapshot"], "Плитка")
        self.assertIsNone(movement["materialItemId"])
        self.assertEqual(movement["materialTitle"], "Плитка")
        self.assertEqual(movement["materialUnit"], "м2")
    def test_fact_relations_cannot_be_rebound(self) -> None:
        self.add_norms()
        fact, _ = create_work_fact(
            self.con, 10, 101, "2026-08-21", 10, "", "fact-test-rebind", 1, 200
        )
        line = self.con.execute(
            "SELECT * FROM project_work_fact_materials WHERE fact_id = ? ORDER BY id LIMIT 1",
            (fact["id"],),
        ).fetchone()

        with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable"):
            self.con.execute(
                "UPDATE project_work_facts SET work_item_id = 202 WHERE id = ?",
                (fact["id"],),
            )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable"):
            self.con.execute(
                "UPDATE project_work_fact_materials SET material_item_id = 202 WHERE id = ?",
                (line["id"],),
            )


if __name__ == "__main__":
    unittest.main()
