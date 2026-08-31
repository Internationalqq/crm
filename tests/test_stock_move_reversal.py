from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402
import warehouse as warehouse_module  # noqa: E402
from warehouse_control import build_warehouse_control  # noqa: E402


class FakeStockMoveHandler:
    def __init__(self, user: dict, payload: dict | None = None):
        self.user = user
        self.payload = payload or {}
        self.status: int | None = None
        self.response: dict | None = None

    def require_project_access(self, _project_id: int) -> dict:
        return self.user

    def require_role(self, _roles: set[str]) -> dict:
        return self.user

    def can_access_project(self, _user: dict, _project_id: int) -> bool:
        return True

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class StockMoveReversalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_db_path = server.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR
        self.original_warehouse_data_dir = warehouse_module.DATA_DIR
        self.original_warehouse_db_path = warehouse_module.DB_PATH
        server.DB_PATH = temp_path / "stock-move-reversal.sqlite3"
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        warehouse_module.DATA_DIR = temp_path
        warehouse_module.DB_PATH = server.DB_PATH
        server.init_db()

        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            timestamp = server.now_ts()
            self.project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, budget, paid, spent,
                        created_at, updated_at
                    ) VALUES ('Reversal object', 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.material_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price,
                        item_kind, section_title, updated_at
                    ) VALUES (?, 'Мастика', 'кг', 42, 0, 'material', 'Материалы', ?)
                    """,
                    (self.project_id, timestamp),
                ).lastrowid
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price, comment,
                    created_by, created_at, source_type,
                    material_title_snapshot, material_unit_snapshot
                ) VALUES (?, ?, 'receipt', 42, 0, 'Привезено на объект', ?, ?, 'manual', 'Мастика', 'кг')
                """,
                (self.project_id, self.material_id, self.admin_id, timestamp),
            )
            self.use_move_id = int(
                con.execute(
                    """
                    INSERT INTO stock_moves (
                        project_id, estimate_item_id, move_type, qty, price, comment,
                        created_by, created_at, source_type,
                        material_title_snapshot, material_unit_snapshot
                    ) VALUES (?, ?, 'use', 42, 0, 'Ошибочный расход', ?, ?, 'manual', 'Мастика', 'кг')
                    """,
                    (self.project_id, self.material_id, self.admin_id, timestamp + 1),
                ).lastrowid
            )
            con.commit()
        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_db_path
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        warehouse_module.DATA_DIR = self.original_warehouse_data_dir
        warehouse_module.DB_PATH = self.original_warehouse_db_path
        gc.collect()
        self.temp_dir.cleanup()

    def reverse(self, move_id: int, reason: str = "Ошибка ввода") -> FakeStockMoveHandler:
        handler = FakeStockMoveHandler(self.admin, {"reason": reason})
        server.PMBIHandler.api_reverse_stock_move(
            handler,
            f"/api/projects/{self.project_id}/stock-moves/{move_id}/reverse",
        )
        return handler

    def material_state(self) -> dict:
        with server.db() as con:
            payload = build_warehouse_control(con, self.project_id)
        return next(
            item for item in payload["materials"] if item["id"] == self.material_id
        )

    def test_reversal_restores_balance_without_deleting_history(self) -> None:
        before = self.material_state()
        self.assertEqual(before["manualUsedQty"], 42)
        self.assertEqual(before["stockBalanceQty"], 0)
        original_before = next(
            move
            for move in self.reverse_payload()["movements"]
            if move["id"] == self.use_move_id
        )
        self.assertTrue(original_before["isReversible"])

        reversed_move = self.reverse(self.use_move_id)

        self.assertEqual(reversed_move.status, HTTPStatus.CREATED)
        self.assertFalse(reversed_move.response["idempotentReplay"])
        self.assertEqual(reversed_move.response["reversedStockMoveId"], self.use_move_id)
        material = next(
            item
            for item in reversed_move.response["materials"]
            if item["id"] == self.material_id
        )
        self.assertEqual(material["manualUsedQty"], 0)
        self.assertEqual(material["stockBalanceQty"], 42)
        original_payload = next(
            move
            for move in reversed_move.response["movements"]
            if move["id"] == self.use_move_id
        )
        reversal_payload = next(
            move
            for move in reversed_move.response["movements"]
            if move["id"] == reversed_move.response["id"]
        )
        self.assertTrue(original_payload["isReversed"])
        self.assertFalse(reversal_payload["isReversed"])
        self.assertEqual(reversal_payload["qty"], -42)

        with server.db() as con:
            moves = con.execute(
                """
                SELECT id, move_type, qty, source_type, source_id, source_key
                FROM stock_moves WHERE project_id = ? ORDER BY id
                """,
                (self.project_id,),
            ).fetchall()
            audit_count = int(
                con.execute(
                    "SELECT COUNT(*) FROM audit_log WHERE action = 'reverse_stock_move'"
                ).fetchone()[0]
            )

        self.assertEqual(len(moves), 3, "Сторно должно дописывать историю, а не удалять расход")
        self.assertEqual(float(moves[1]["qty"]), 42)
        self.assertEqual(str(moves[2]["move_type"]), "use")
        self.assertEqual(float(moves[2]["qty"]), -42)
        self.assertEqual(str(moves[2]["source_type"]), "stock_move_reversal")
        self.assertEqual(int(moves[2]["source_id"]), self.use_move_id)
        self.assertEqual(
            str(moves[2]["source_key"]), f"stock_move_reversal:{self.use_move_id}"
        )
        self.assertEqual(audit_count, 1)

    def test_retry_is_idempotent_and_does_not_change_restored_balance(self) -> None:
        first = self.reverse(self.use_move_id)
        replay = self.reverse(self.use_move_id, "Повторная отправка с телефона")

        self.assertEqual(first.status, HTTPStatus.CREATED)
        self.assertEqual(replay.status, HTTPStatus.OK)
        self.assertTrue(replay.response["idempotentReplay"])
        self.assertEqual(replay.response["id"], first.response["id"])
        self.assertEqual(self.material_state()["stockBalanceQty"], 42)

        with server.db() as con:
            reversal_count = int(
                con.execute(
                    """
                    SELECT COUNT(*) FROM stock_moves
                    WHERE project_id = ? AND source_type = 'stock_move_reversal'
                      AND source_id = ?
                    """,
                    (self.project_id, self.use_move_id),
                ).fetchone()[0]
            )
            audit_count = int(
                con.execute(
                    "SELECT COUNT(*) FROM audit_log WHERE action = 'reverse_stock_move'"
                ).fetchone()[0]
            )

        self.assertEqual(reversal_count, 1)
        self.assertEqual(audit_count, 1)

    def test_reversal_move_cannot_be_reversed_again(self) -> None:
        first = self.reverse(self.use_move_id)
        reversal_id = int(first.response["id"])

        reverse_the_reversal = self.reverse(reversal_id)

        self.assertEqual(reverse_the_reversal.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            reverse_the_reversal.response["error"], "stock_move_not_reversible"
        )
        self.assertEqual(self.material_state()["stockBalanceQty"], 42)
        with server.db() as con:
            self.assertEqual(
                int(
                    con.execute(
                        "SELECT COUNT(*) FROM stock_moves WHERE project_id = ?",
                        (self.project_id,),
                    ).fetchone()[0]
                ),
                3,
            )

    def test_central_warehouse_return_is_typed_and_cannot_be_reversed(self) -> None:
        with server.db() as con:
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price, comment,
                    created_by, created_at, source_type,
                    material_title_snapshot, material_unit_snapshot
                ) VALUES (?, ?, 'receipt', 10, 0, 'Дополнительный приход', ?, ?, 'manual', 'Мастика', 'кг')
                """,
                (self.project_id, self.material_id, self.admin_id, server.now_ts() + 2),
            )
            con.commit()

        returned = FakeStockMoveHandler(
            self.admin,
            {
                "mode": "return",
                "project_id": self.project_id,
                "estimate_item_id": self.material_id,
                "qty": 10,
            },
        )
        warehouse_module.api_warehouse_receipt(returned)

        self.assertEqual(returned.status, HTTPStatus.CREATED)
        warehouse_item_id = int(returned.response["warehouseItem"]["id"])
        with server.db() as con:
            move = con.execute(
                """
                SELECT * FROM stock_moves
                WHERE project_id = ? AND estimate_item_id = ?
                  AND source_type = 'warehouse_return_from_project'
                ORDER BY id DESC LIMIT 1
                """,
                (self.project_id, self.material_id),
            ).fetchone()
            warehouse_qty_before = float(
                con.execute(
                    "SELECT qty FROM warehouse_items WHERE id = ?", (warehouse_item_id,)
                ).fetchone()[0]
            )
        self.assertIsNotNone(move)

        movement = next(
            item
            for item in self.reverse_payload()["movements"]
            if item["id"] == int(move["id"])
        )
        self.assertEqual(movement["sourceType"], "warehouse_return_from_project")
        self.assertFalse(movement["isReversible"])

        blocked = self.reverse(int(move["id"]))

        self.assertEqual(blocked.status, HTTPStatus.CONFLICT)
        self.assertEqual(blocked.response["error"], "stock_move_not_reversible")
        with server.db() as con:
            warehouse_qty_after = float(
                con.execute(
                    "SELECT qty FROM warehouse_items WHERE id = ?", (warehouse_item_id,)
                ).fetchone()[0]
            )
            reversal_count = int(
                con.execute(
                    """
                    SELECT COUNT(*) FROM stock_moves
                    WHERE source_type = 'stock_move_reversal' AND source_id = ?
                    """,
                    (int(move["id"]),),
                ).fetchone()[0]
            )
        self.assertEqual(warehouse_qty_after, warehouse_qty_before)
        self.assertEqual(reversal_count, 0)

    def test_legacy_warehouse_return_signature_is_hidden_and_rejected(self) -> None:
        with server.db() as con:
            legacy_move_id = int(
                con.execute(
                    """
                    INSERT INTO stock_moves (
                        project_id, estimate_item_id, move_type, qty, price, comment,
                        created_by, created_at, source_type,
                        material_title_snapshot, material_unit_snapshot
                    ) VALUES (?, ?, 'use', 5, 0, 'Произведен возврат на склад: Мастика — 5 кг', ?, ?, 'manual', 'Мастика', 'кг')
                    """,
                    (self.project_id, self.material_id, self.admin_id, server.now_ts() + 3),
                ).lastrowid
            )
            con.commit()

        movement = next(
            item
            for item in self.reverse_payload()["movements"]
            if item["id"] == legacy_move_id
        )
        self.assertEqual(movement["sourceType"], "warehouse_return_from_project")
        self.assertFalse(movement["isReversible"])

        blocked = self.reverse(legacy_move_id)

        self.assertEqual(blocked.status, HTTPStatus.CONFLICT)
        self.assertEqual(blocked.response["error"], "stock_move_not_reversible")
        with server.db() as con:
            self.assertEqual(
                int(
                    con.execute(
                        """
                        SELECT COUNT(*) FROM stock_moves
                        WHERE source_type = 'stock_move_reversal' AND source_id = ?
                        """,
                        (legacy_move_id,),
                    ).fetchone()[0]
                ),
                0,
            )

    def reverse_payload(self) -> dict:
        with server.db() as con:
            return build_warehouse_control(con, self.project_id)


if __name__ == "__main__":
    unittest.main()
