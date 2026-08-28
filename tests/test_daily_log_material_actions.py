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
                        project_id, title, unit, planned_qty, planned_price, item_kind,
                        section_title, updated_at
                    ) VALUES (?, 'Облицовка стен', 'м2', 70, 0, 'work', 'Отделка', ?)
                    """,
                    (self.project_id, timestamp),
                ).lastrowid
            )
            self.scaled_work_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price, item_kind,
                        section_title, updated_at
                    ) VALUES (?, 'Монтаж кабеля', '10 м', 7, 0, 'work', 'Электрика', ?)
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

    def work_payload(
        self,
        request_id: str,
        *,
        mode: str,
        value: float,
        item_id: int | None = None,
        value_key: str = "input_value",
    ) -> dict:
        payload = self.base_payload(request_id)
        payload["work_done"] = "Выполнена часть работ"
        action = {
            "action_type": "work_progress",
            "estimate_item_id": item_id or self.work_id,
            "quantity_mode": mode,
            "client_action_id": f"{request_id}:work",
        }
        action[value_key] = value
        payload["confirmed_actions"] = [action]
        return payload

    def test_work_progress_delta_records_40_of_70_and_fractional_progress(self) -> None:
        handler = self.create_log(
            self.work_payload("work-delta-40", mode="delta_qty", value=40)
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        work_action = next(
            action for action in handler.response["appliedActions"]
            if action["kind"] == "work"
        )
        self.assertEqual(work_action["type"], "work_progress")
        self.assertEqual(work_action["quantityMode"], "delta_qty")
        self.assertEqual(work_action["qty"], 40)
        self.assertEqual(work_action["actualBefore"], 0)
        self.assertEqual(work_action["actualAfter"], 40)
        self.assertEqual(work_action["plannedQty"], 70)
        self.assertEqual(handler.response["log"]["has_applied_actions"], 1)

        list_handler = FakeDailyLogHandler(self.admin, {})
        communications_docs.api_project_daily_logs(
            list_handler, f"/api/projects/{self.project_id}/daily-logs"
        )
        self.assertEqual(list_handler.status, HTTPStatus.OK)
        self.assertEqual(list_handler.response["logs"][0]["has_applied_actions"], 1)

        with server.db() as con:
            estimate = con.execute(
                "SELECT actual_qty, is_completed FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()
            journal = con.execute(
                """
                SELECT quantity_mode, input_value, qty, actual_before, actual_after,
                       planned_qty_snapshot, work_unit_snapshot
                FROM daily_log_work_actions
                """
            ).fetchone()
            progress = recalc_project_progress(con, self.project_id, "Отделка")
            audit_count = con.execute(
                "SELECT COUNT(*) FROM audit_log WHERE action = 'apply_daily_log_work_action'"
            ).fetchone()[0]

        self.assertEqual(float(estimate["actual_qty"]), 40)
        self.assertEqual(int(estimate["is_completed"]), 0)
        self.assertEqual(journal["quantity_mode"], "delta_qty")
        self.assertEqual(float(journal["input_value"]), 40)
        self.assertEqual(float(journal["qty"]), 40)
        self.assertEqual(float(journal["actual_before"]), 0)
        self.assertEqual(float(journal["actual_after"]), 40)
        self.assertEqual(float(journal["planned_qty_snapshot"]), 70)
        self.assertEqual(progress["section"]["percent"], 57)
        self.assertEqual(audit_count, 1)

    def test_work_progress_target_percent_converts_to_physical_quantity(self) -> None:
        handler = self.create_log(
            self.work_payload("work-target-percent", mode="target_percent", value=40)
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        action = next(item for item in handler.response["appliedActions"] if item["kind"] == "work")
        self.assertEqual(action["inputValue"], 40)
        self.assertAlmostEqual(action["qty"], 28)
        self.assertAlmostEqual(action["actualAfter"], 28)
        with server.db() as con:
            row = con.execute(
                "SELECT actual_qty, is_completed FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()
        self.assertAlmostEqual(float(row["actual_qty"]), 28)
        self.assertEqual(int(row["is_completed"]), 0)

    def test_work_progress_marks_item_complete_exactly_at_plan(self) -> None:
        first = self.create_log(
            self.work_payload("work-complete-partial", mode="delta_qty", value=40)
        )
        complete = self.create_log(
            self.work_payload("work-complete-target", mode="target_percent", value=100)
        )

        self.assertEqual(first.status, HTTPStatus.CREATED)
        self.assertEqual(complete.status, HTTPStatus.CREATED)
        action = next(item for item in complete.response["appliedActions"] if item["kind"] == "work")
        self.assertEqual(action["qty"], 30)
        self.assertEqual(action["actualBefore"], 40)
        self.assertEqual(action["actualAfter"], 70)
        with server.db() as con:
            row = con.execute(
                "SELECT actual_qty, is_completed FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()
        self.assertEqual(float(row["actual_qty"]), 70)
        self.assertEqual(int(row["is_completed"]), 1)

    def test_work_progress_accumulates_and_target_qty_applies_only_difference(self) -> None:
        first = self.create_log(
            self.work_payload("work-accumulate-1", mode="delta_qty", value=40)
        )
        second = self.create_log(
            self.work_payload("work-accumulate-2", mode="delta_qty", value=20)
        )
        target = self.create_log(
            self.work_payload(
                "work-accumulate-target",
                mode="target_qty",
                value=65,
                value_key="qty",
            )
        )

        self.assertEqual(first.status, HTTPStatus.CREATED)
        self.assertEqual(second.status, HTTPStatus.CREATED)
        self.assertEqual(target.status, HTTPStatus.CREATED)
        target_action = next(item for item in target.response["appliedActions"] if item["kind"] == "work")
        self.assertEqual(target_action["inputValue"], 65)
        self.assertEqual(target_action["qty"], 5)
        self.assertEqual(target_action["actualBefore"], 60)
        self.assertEqual(target_action["actualAfter"], 65)
        with server.db() as con:
            actual = con.execute(
                "SELECT actual_qty FROM estimate_items WHERE id = ?", (self.work_id,)
            ).fetchone()[0]
            rows = con.execute(
                "SELECT actual_before, actual_after FROM daily_log_work_actions ORDER BY id"
            ).fetchall()
        self.assertEqual(float(actual), 65)
        self.assertEqual(
            [(float(row["actual_before"]), float(row["actual_after"])) for row in rows],
            [(0, 40), (40, 60), (60, 65)],
        )

    def test_work_progress_limits_and_non_increasing_target_are_atomic(self) -> None:
        first = self.create_log(
            self.work_payload("work-limit-base", mode="delta_qty", value=40)
        )
        too_much = self.create_log(
            self.work_payload("work-limit-over", mode="delta_qty", value=31)
        )
        lower_target = self.create_log(
            self.work_payload("work-limit-lower", mode="target_qty", value=35)
        )
        bad_percent = self.create_log(
            self.work_payload("work-limit-percent", mode="target_percent", value=101)
        )

        self.assertEqual(first.status, HTTPStatus.CREATED)
        self.assertEqual(too_much.status, HTTPStatus.CONFLICT)
        self.assertEqual(too_much.response["error"], "daily_log_work_action_qty_exceeds_limit")
        self.assertEqual(too_much.response["allowedQty"], 30)
        self.assertEqual(lower_target.status, HTTPStatus.CONFLICT)
        self.assertEqual(lower_target.response["error"], "daily_log_work_action_no_positive_delta")
        self.assertEqual(bad_percent.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(bad_percent.response["error"], "bad_work_percent")
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_work_actions").fetchone()[0], 1)
            self.assertEqual(
                float(con.execute("SELECT actual_qty FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()[0]),
                40,
            )

    def test_work_progress_request_replay_is_idempotent(self) -> None:
        payload = self.work_payload("work-replay", mode="delta_qty", value=40)
        first = self.create_log(payload)
        replay = self.create_log(payload)
        duplicate_payload = self.work_payload(
            "work-replay-other-request", mode="delta_qty", value=1
        )
        duplicate_payload["confirmed_actions"][0]["client_action_id"] = "work-replay:work"
        duplicate = self.create_log(duplicate_payload)

        self.assertEqual(first.status, HTTPStatus.CREATED)
        self.assertEqual(replay.status, HTTPStatus.OK)
        self.assertTrue(replay.response["idempotentReplay"])
        self.assertEqual(replay.response["appliedActions"], first.response["appliedActions"])
        self.assertEqual(duplicate.status, HTTPStatus.CONFLICT)
        self.assertEqual(duplicate.response["error"], "client_action_already_applied")
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_work_actions").fetchone()[0], 1)
            self.assertEqual(
                float(con.execute("SELECT actual_qty FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()[0]),
                40,
            )

    def test_work_permission_and_mixed_action_failure_roll_back_everything(self) -> None:
        forbidden_payload = self.base_payload("mixed-forbidden")
        forbidden_payload["confirmed_actions"] = [
            {
                "action_type": "material_purchase",
                "estimate_item_id": self.material_id,
                "qty": 5,
                "client_action_id": "mixed-forbidden:material",
            },
            {
                "action_type": "work_progress",
                "estimate_item_id": self.work_id,
                "quantity_mode": "delta_qty",
                "input_value": 10,
                "client_action_id": "mixed-forbidden:work",
            },
        ]
        forbidden = FakeDailyLogHandler(
            {"id": self.admin_id, "role": "purchaser", "roles": []},
            forbidden_payload,
        )
        communications_docs.api_create_daily_log(
            forbidden, f"/api/projects/{self.project_id}/daily-logs"
        )
        self.assertEqual(forbidden.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(forbidden.response["error"], "daily_log_work_actions_forbidden")

        invalid_payload = self.base_payload("mixed-invalid")
        invalid_payload["confirmed_actions"] = [
            {
                "action_type": "material_purchase",
                "estimate_item_id": self.material_id,
                "qty": 5,
                "client_action_id": "mixed-invalid:material",
            },
            {
                "action_type": "work_progress",
                "estimate_item_id": self.work_id,
                "quantity_mode": "delta_qty",
                "input_value": 71,
                "client_action_id": "mixed-invalid:work",
            },
        ]
        invalid = self.create_log(invalid_payload)
        self.assertEqual(invalid.status, HTTPStatus.CONFLICT)
        self.assertEqual(invalid.response["error"], "daily_log_work_action_qty_exceeds_limit")

        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_actions").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_work_actions").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM stock_moves").fetchone()[0], 0)
            self.assertEqual(
                float(con.execute("SELECT actual_qty FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()[0]),
                0,
            )

    def test_scaled_work_unit_uses_physical_plan(self) -> None:
        handler = self.create_log(
            self.work_payload(
                "work-scaled-unit",
                mode="delta_qty",
                value=40,
                value_key="value",
                item_id=self.scaled_work_id,
            )
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        action = next(item for item in handler.response["appliedActions"] if item["kind"] == "work")
        self.assertEqual(action["qty"], 40)
        self.assertEqual(action["actualAfter"], 40)
        self.assertEqual(action["plannedQty"], 70)
        self.assertEqual(action["unit"], "м")
        with server.db() as con:
            row = con.execute(
                "SELECT actual_qty, is_completed FROM estimate_items WHERE id = ?",
                (self.scaled_work_id,),
            ).fetchone()
        self.assertEqual(float(row["actual_qty"]), 40)
        self.assertEqual(int(row["is_completed"]), 0)

    def test_report_with_work_progress_cannot_be_deleted_silently(self) -> None:
        created = self.create_log(
            self.work_payload("protected-work-report", mode="delta_qty", value=10)
        )
        delete_handler = FakeDailyLogHandler(self.admin, {})

        communications_docs.api_delete_daily_log(
            delete_handler,
            f"/api/projects/{self.project_id}/daily-logs/{created.response['id']}/delete",
        )

        self.assertEqual(delete_handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(delete_handler.response["error"], "daily_log_has_applied_actions")
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_work_actions").fetchone()[0], 1)
            self.assertEqual(
                float(con.execute("SELECT actual_qty FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()[0]),
                10,
            )

    def test_full_estimate_replace_is_blocked_after_work_progress(self) -> None:
        self.create_log(
            self.work_payload("protected-work-estimate", mode="delta_qty", value=10)
        )
        with server.db() as con:
            work_row = con.execute(
                "SELECT * FROM estimate_items WHERE id = ?", (self.work_id,)
            ).fetchone()
            activity = server.estimate_position_kind_change_activity(
                con, self.project_id, self.work_id, work_row, "work"
            )
        self.assertIn(
            "daily_log_work_actions",
            {item["code"] for item in activity},
        )
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
        self.assertEqual(replace_handler.response["actionCount"], 1)
        with server.db() as con:
            self.assertIsNotNone(
                con.execute("SELECT id FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()
            )

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
