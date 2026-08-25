from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import communications_docs  # noqa: E402
import server  # noqa: E402
from warehouse_control import build_warehouse_control  # noqa: E402
from schedule_tasks import recalc_project_progress  # noqa: E402


class FakeDailyLogHandler:
    def __init__(self, user: dict, payload: dict):
        self.user = user
        self.payload = payload
        self.status: int | None = None
        self.response: dict | None = None

    def require_project_access(self, _project_id: int) -> dict:
        return self.user

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class DailyLogMaterialActionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_server_db = server.DB_PATH
        self.original_communications_db = communications_docs.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        test_db = temp_path / "daily-log-actions.sqlite3"
        server.DB_PATH = test_db
        communications_docs.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            timestamp = server.now_ts()
            self.project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, budget, paid, spent,
                        created_at, updated_at
                    ) VALUES ('Daily report object', 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.other_project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, budget, paid, spent,
                        created_at, updated_at
                    ) VALUES ('Other object', 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.material_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price, item_kind, updated_at
                    ) VALUES (?, 'Дверные ручки', 'шт', 20, 0, 'material', ?)
                    """,
                    (self.project_id, timestamp),
                ).lastrowid
            )
            self.work_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price, item_kind, updated_at
                    ) VALUES (?, 'Установка дверей', 'шт', 10, 0, 'work', ?)
                    """,
                    (self.project_id, timestamp),
                ).lastrowid
            )
            self.other_material_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price, item_kind, updated_at
                    ) VALUES (?, 'Щебень', 'м3', 50, 0, 'material', ?)
                    """,
                    (self.other_project_id, timestamp),
                ).lastrowid
            )
            con.commit()
        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        communications_docs.DB_PATH = self.original_communications_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def create_log(self, payload: dict) -> FakeDailyLogHandler:
        handler = FakeDailyLogHandler(self.admin, payload)
        communications_docs.api_create_daily_log(
            handler, f"/api/projects/{self.project_id}/daily-logs"
        )
        return handler

    @staticmethod
    def base_payload(request_id: str) -> dict:
        return {
            "title": "Отчёт за смену",
            "work_done": "Заказал дверные ручки",
            "report_date": "2026-08-24",
            "client_request_id": request_id,
        }

    def test_confirmed_actions_create_audited_stock_moves_transactionally(self) -> None:
        payload = self.base_payload("report-request-1")
        payload["confirmed_actions"] = [
            {
                "action_type": "material_purchase",
                "estimate_item_id": self.material_id,
                "qty": 12,
                "client_action_id": "report-request-1:purchase",
            },
            {
                "action_type": "material_receipt",
                "estimate_item_id": self.material_id,
                "qty": 8,
                "client_action_id": "report-request-1:receipt",
            },
            {
                "action_type": "material_use",
                "estimate_item_id": self.material_id,
                "qty": 2.5,
                "client_action_id": "report-request-1:use",
            },
        ]

        handler = self.create_log(payload)

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        self.assertEqual(
            [action["moveType"] for action in handler.response["appliedActions"]],
            ["purchase", "receipt", "use"],
        )
        self.assertEqual(handler.response["log"]["has_applied_actions"], 1)
        list_handler = FakeDailyLogHandler(self.admin, {})
        communications_docs.api_project_daily_logs(
            list_handler, f"/api/projects/{self.project_id}/daily-logs"
        )
        self.assertEqual(list_handler.status, HTTPStatus.OK)
        self.assertEqual(list_handler.response["logs"][0]["has_applied_actions"], 1)
        with server.db() as con:
            action_rows = con.execute(
                "SELECT action_type, qty, stock_move_id FROM daily_log_actions ORDER BY id"
            ).fetchall()
            move_rows = con.execute(
                """
                SELECT move_type, qty, source_type, source_id, source_key,
                       material_title_snapshot, material_unit_snapshot
                FROM stock_moves ORDER BY id
                """
            ).fetchall()
            control = build_warehouse_control(con, self.project_id)
            progress = recalc_project_progress(con, self.project_id)

        self.assertEqual(len(action_rows), 3)
        self.assertEqual([row["move_type"] for row in move_rows], ["purchase", "receipt", "use"])
        self.assertTrue(all(row["source_type"] == "daily_log_action" for row in move_rows))
        self.assertTrue(all(str(row["source_key"]).startswith("daily_log_action:") for row in move_rows))
        self.assertTrue(all(row["source_id"] == handler.response["id"] for row in move_rows))
        self.assertTrue(all(row["material_title_snapshot"] == "Дверные ручки" for row in move_rows))
        material = next(item for item in control["materials"] if item["id"] == self.material_id)
        self.assertEqual(material["purchasedQty"], 12)
        self.assertEqual(material["receivedQty"], 8)
        self.assertEqual(material["stockBalanceQty"], 5.5)
        self.assertEqual(progress["projectProgress"], 0)

    def test_client_request_id_replay_does_not_duplicate_report_or_moves(self) -> None:
        payload = self.base_payload("report-request-retry")
        payload["confirmed_actions"] = [
            {
                "action_type": "material_purchase",
                "estimate_item_id": self.material_id,
                "qty": 20,
                "client_action_id": "report-request-retry:purchase",
            }
        ]

        first = self.create_log(payload)
        replay = self.create_log(payload)

        self.assertEqual(first.status, HTTPStatus.CREATED)
        self.assertEqual(replay.status, HTTPStatus.OK)
        self.assertTrue(replay.response["idempotentReplay"])
        self.assertEqual(replay.response["id"], first.response["id"])
        self.assertEqual(replay.response["appliedActions"], first.response["appliedActions"])
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_actions").fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM stock_moves").fetchone()[0], 1)

    def test_invalid_action_rolls_back_the_whole_report(self) -> None:
        invalid_items = (
            (self.work_id, 1, "estimate_item_not_material"),
            (self.other_material_id, 1, "estimate_item_project_mismatch"),
            (self.material_id, 0, "bad_qty"),
        )
        for index, (item_id, qty, expected_error) in enumerate(invalid_items):
            with self.subTest(expected_error=expected_error):
                payload = self.base_payload(f"invalid-request-{index}")
                payload["confirmed_actions"] = [
                    {
                        "action_type": "material_purchase",
                        "estimate_item_id": self.material_id,
                        "qty": 1,
                        "client_action_id": f"invalid-request-{index}:valid",
                    },
                    {
                        "action_type": "material_receipt",
                        "estimate_item_id": item_id,
                        "qty": qty,
                        "client_action_id": f"invalid-request-{index}:invalid",
                    },
                ]
                handler = self.create_log(payload)
                self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(handler.response["error"], expected_error)

        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_actions").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM stock_moves").fetchone()[0], 0)

    def test_material_actions_require_warehouse_permission(self) -> None:
        payload = self.base_payload("forbidden-material-action")
        payload["confirmed_actions"] = [
            {
                "action_type": "material_purchase",
                "estimate_item_id": self.material_id,
                "qty": 1,
                "client_action_id": "forbidden-material-action:purchase",
            }
        ]
        handler = FakeDailyLogHandler(
            {"id": self.admin_id, "role": "financier", "roles": []},
            payload,
        )

        communications_docs.api_create_daily_log(
            handler, f"/api/projects/{self.project_id}/daily-logs"
        )

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response["error"], "daily_log_actions_forbidden")
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM stock_moves").fetchone()[0], 0)

    def test_material_action_quantities_cannot_exceed_operational_limits(self) -> None:
        invalid_actions = (
            ([('material_purchase', 21)], 20),
            ([('material_receipt', 21)], 20),
            ([('material_use', 1)], 0),
            ([('material_purchase', 11), ('material_purchase', 10)], 9),
        )
        for index, (actions, expected_allowed) in enumerate(invalid_actions):
            with self.subTest(actions=actions):
                payload = self.base_payload(f"quantity-limit-{index}")
                payload["confirmed_actions"] = [
                    {
                        "action_type": action_type,
                        "estimate_item_id": self.material_id,
                        "qty": qty,
                        "client_action_id": f"quantity-limit-{index}:{action_index}",
                    }
                    for action_index, (action_type, qty) in enumerate(actions)
                ]
                handler = self.create_log(payload)
                self.assertEqual(handler.status, HTTPStatus.CONFLICT)
                self.assertEqual(handler.response["error"], "daily_log_action_qty_exceeds_limit")
                self.assertEqual(handler.response["allowedQty"], expected_allowed)

        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_actions").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM stock_moves").fetchone()[0], 0)

    def test_report_with_applied_actions_cannot_be_deleted_silently(self) -> None:
        payload = self.base_payload("protected-report")
        payload["confirmed_actions"] = [
            {
                "action_type": "material_purchase",
                "estimate_item_id": self.material_id,
                "qty": 5,
                "client_action_id": "protected-report:purchase",
            }
        ]
        created = self.create_log(payload)
        delete_handler = FakeDailyLogHandler(self.admin, {})

        communications_docs.api_delete_daily_log(
            delete_handler,
            f"/api/projects/{self.project_id}/daily-logs/{created.response['id']}/delete",
        )

        self.assertEqual(delete_handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(delete_handler.response["error"], "daily_log_has_applied_actions")
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM stock_moves").fetchone()[0], 1)

    def test_full_estimate_replace_is_blocked_after_report_action(self) -> None:
        payload = self.base_payload("protected-estimate")
        payload["confirmed_actions"] = [
            {
                "action_type": "material_purchase",
                "estimate_item_id": self.material_id,
                "qty": 5,
                "client_action_id": "protected-estimate:purchase",
            }
        ]
        self.create_log(payload)
        replace_handler = FakeDailyLogHandler(
            self.admin,
            {
                "replace": True,
                "items": [
                    {
                        "title": "Новая позиция",
                        "unit": "шт",
                        "planned_qty": 1,
                        "planned_price": 0,
                        "item_kind": "material",
                    }
                ],
            },
        )

        server.PMBIHandler.api_import_estimate(
            replace_handler, f"/api/projects/{self.project_id}/estimate-import"
        )

        self.assertEqual(replace_handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            replace_handler.response["error"],
            "estimate_replace_blocked_by_daily_log_actions",
        )
        with server.db() as con:
            self.assertIsNotNone(
                con.execute("SELECT id FROM estimate_items WHERE id = ?", (self.material_id,)).fetchone()
            )


if __name__ == "__main__":
    unittest.main()
