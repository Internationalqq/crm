from __future__ import annotations

import gc
import json
import sys
import tempfile
import unittest
import urllib.parse
from http import HTTPStatus
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import schedule_tasks  # noqa: E402
import server  # noqa: E402


class FakeBulkCompleteHandler:
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


class ProjectSectionBulkCompleteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_server_db = server.DB_PATH
        self.original_schedule_db = schedule_tasks.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        test_db = temp_path / "section-bulk-complete.sqlite3"
        server.DB_PATH = test_db
        schedule_tasks.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        timestamp = server.now_ts()
        self.fixture_timestamp = timestamp
        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            self.project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, created_at, updated_at
                    ) VALUES ('Bulk object', '', '', 'active', ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.other_project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, created_at, updated_at
                    ) VALUES ('Other object', '', '', 'active', ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.stage_id = int(
                con.execute(
                    """
                    INSERT INTO work_stages (
                        project_id, title, position, stage_kind, status_code,
                        progress, is_client_visible, depends_on_materials,
                        created_at, updated_at
                    ) VALUES (?, 'Section A', 1, 'section', 'in_progress', 23, 1, 0, ?, ?)
                    """,
                    (self.project_id, timestamp, timestamp),
                ).lastrowid
            )
            self.other_stage_id = int(
                con.execute(
                    """
                    INSERT INTO work_stages (
                        project_id, title, position, stage_kind, status_code,
                        progress, is_client_visible, depends_on_materials,
                        created_at, updated_at
                    ) VALUES (?, 'Section B', 2, 'section', 'in_progress', 41, 1, 0, ?, ?)
                    """,
                    (self.project_id, timestamp, timestamp),
                ).lastrowid
            )
            # The production handler supports deployments where project tasks are
            # linked to a work stage.  Keep such a task in the fixture so an
            # explicit work-item bulk request cannot silently close it.
            con.execute("ALTER TABLE tasks ADD COLUMN stage_id INTEGER")
            self.task_id = int(
                con.execute(
                    """
                    INSERT INTO tasks (
                        project_id, title, status, priority, created_by,
                        created_at, updated_at, completed_at, stage_id
                    ) VALUES (?, 'Hidden section task', 'open', 'normal', ?, ?, ?, NULL, ?)
                    """,
                    (self.project_id, self.admin_id, timestamp, timestamp, self.stage_id),
                ).lastrowid
            )

            def add_item(
                project_id: int,
                title: str,
                kind: str,
                section: str,
                qty: float,
                procurement_status: str,
                *,
                stage_id: int | None = None,
                completed: int = 0,
                actual_qty: float = 0,
            ) -> int:
                return int(
                    con.execute(
                        """
                        INSERT INTO estimate_items (
                            project_id, title, unit, planned_qty, planned_price,
                            stage_id, item_kind, section_title, procurement_status,
                            is_completed, actual_qty, updated_at
                        ) VALUES (?, ?, 'unit', ?, 0, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            project_id,
                            title,
                            qty,
                            stage_id,
                            kind,
                            section,
                            procurement_status,
                            completed,
                            actual_qty,
                            timestamp,
                        ),
                    ).lastrowid
                )

            self.work_id = add_item(
                self.project_id,
                "Work A",
                "work",
                "Section A",
                10,
                "work-procurement-must-stay",
                stage_id=self.stage_id,
            )
            self.completed_work_id = add_item(
                self.project_id,
                "Work A already done",
                "work",
                "Section A",
                3,
                "completed-work-procurement-must-stay",
                stage_id=self.stage_id,
                completed=1,
                actual_qty=3,
            )
            self.material_id = add_item(
                self.project_id,
                "Material A",
                "material",
                "Section A",
                5,
                "Buy",
                stage_id=self.stage_id,
            )
            self.other_section_work_id = add_item(
                self.project_id,
                "Work B",
                "work",
                "Section B",
                7,
                "other-section-procurement",
                stage_id=self.other_stage_id,
            )
            self.foreign_work_id = add_item(
                self.other_project_id,
                "Foreign work",
                "work",
                "Section A",
                9,
                "foreign-procurement",
            )
            con.commit()

        self.admin = {
            "id": self.admin_id,
            "role": "admin",
            "roles": [],
            "permissions": server.default_permissions_for_role("admin"),
        }

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        schedule_tasks.DB_PATH = self.original_schedule_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def call(self, payload: dict, section: str = "Section A") -> FakeBulkCompleteHandler:
        handler = FakeBulkCompleteHandler(self.admin, payload)
        encoded_section = urllib.parse.quote(section, safe="")
        schedule_tasks.api_project_section_bulk_complete(
            handler,
            f"/api/projects/{self.project_id}/sections/{encoded_section}/bulk-complete",
        )
        return handler

    def item_state(self, item_id: int) -> tuple[int, float, str]:
        with server.db() as con:
            row = con.execute(
                "SELECT is_completed, actual_qty, procurement_status FROM estimate_items WHERE id = ?",
                (item_id,),
            ).fetchone()
        return int(row["is_completed"]), float(row["actual_qty"]), str(row["procurement_status"])

    def test_explicit_work_bulk_changes_only_changed_work_rows(self) -> None:
        handler = self.call(
            {
                "itemKind": "works",
                "itemIds": [self.work_id, self.completed_work_id],
                "completed": True,
            }
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["itemKind"], "work")
        self.assertEqual(handler.response["targetItemIds"], [self.work_id, self.completed_work_id])
        self.assertEqual(handler.response["changedItemIds"], [self.work_id])
        self.assertEqual(handler.response["changedCount"], 1)
        self.assertEqual(self.item_state(self.work_id), (1, 10.0, "work-procurement-must-stay"))
        self.assertEqual(
            self.item_state(self.completed_work_id),
            (1, 3.0, "completed-work-procurement-must-stay"),
        )
        self.assertEqual(self.item_state(self.material_id), (0, 0.0, "Buy"))

        with server.db() as con:
            stage = con.execute(
                "SELECT progress, status_code FROM work_stages WHERE id = ?",
                (self.stage_id,),
            ).fetchone()
            other_stage = con.execute(
                "SELECT progress, status_code FROM work_stages WHERE id = ?",
                (self.other_stage_id,),
            ).fetchone()
            task = con.execute(
                "SELECT status, completed_at, updated_at FROM tasks WHERE id = ?",
                (self.task_id,),
            ).fetchone()
            audit = con.execute(
                "SELECT payload FROM audit_log WHERE action = 'bulk_complete_section' ORDER BY id DESC LIMIT 1"
            ).fetchone()
            daily_log = con.execute(
                "SELECT title, work_done, raw_input FROM daily_logs WHERE project_id = ? ORDER BY id DESC LIMIT 1",
                (self.project_id,),
            ).fetchone()

        self.assertEqual((stage["progress"], stage["status_code"]), (23, "in_progress"))
        self.assertEqual((other_stage["progress"], other_stage["status_code"]), (41, "in_progress"))
        self.assertEqual((task["status"], task["completed_at"]), ("open", None))
        self.assertEqual(task["updated_at"], self.fixture_timestamp)
        audit_payload = json.loads(audit["payload"])
        log_payload = json.loads(daily_log["raw_input"])
        self.assertEqual(audit_payload["item_kind"], "work")
        self.assertEqual(audit_payload["changed_item_ids"], [self.work_id])
        self.assertEqual(audit_payload["items"], 1)
        self.assertEqual(log_payload, audit_payload)
        self.assertIn("работ", daily_log["title"].lower())
        self.assertIn("1 поз.", daily_log["work_done"])

    def test_mixed_foreign_or_wrong_section_ids_fail_atomically(self) -> None:
        handler = self.call(
            {
                "itemKind": "work",
                "itemIds": [
                    self.work_id,
                    self.material_id,
                    self.other_section_work_id,
                    self.foreign_work_id,
                ],
                "completed": True,
            }
        )

        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response["error"], "bulk_section_items_mismatch")
        self.assertEqual(
            handler.response["invalidItemIds"],
            [self.material_id, self.other_section_work_id, self.foreign_work_id],
        )
        self.assertEqual(self.item_state(self.work_id), (0, 0.0, "work-procurement-must-stay"))
        self.assertEqual(self.item_state(self.material_id), (0, 0.0, "Buy"))
        with server.db() as con:
            self.assertEqual(
                con.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'bulk_complete_section'").fetchone()[0],
                0,
            )
            self.assertEqual(
                con.execute("SELECT COUNT(*) FROM daily_logs WHERE project_id = ?", (self.project_id,)).fetchone()[0],
                0,
            )

    def test_explicit_empty_ids_and_bad_kind_never_fallback(self) -> None:
        empty = self.call({"itemKind": "work", "itemIds": [], "completed": True})
        missing_kind = self.call({"itemIds": [self.work_id], "completed": True})
        bad_kind = self.call({"itemKind": "equipment", "itemIds": [self.work_id], "completed": True})

        self.assertEqual(empty.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(empty.response["error"], "section_items_required")
        self.assertEqual(missing_kind.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(missing_kind.response["error"], "bad_bulk_item_kind")
        self.assertEqual(bad_kind.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(bad_kind.response["error"], "bad_bulk_item_kind")
        self.assertEqual(self.item_state(self.work_id), (0, 0.0, "work-procurement-must-stay"))
        self.assertEqual(self.item_state(self.material_id), (0, 0.0, "Buy"))

    def test_material_alias_keeps_section_fallback_and_procurement_behavior(self) -> None:
        handler = self.call({"itemKind": "materials", "completed": True})

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["itemKind"], "material")
        self.assertEqual(handler.response["targetItemIds"], [self.material_id])
        self.assertEqual(self.item_state(self.material_id), (1, 5.0, "Закуплено"))
        self.assertEqual(self.item_state(self.work_id), (0, 0.0, "work-procurement-must-stay"))
        with server.db() as con:
            stage = con.execute(
                "SELECT progress, status_code FROM work_stages WHERE id = ?",
                (self.stage_id,),
            ).fetchone()
        self.assertEqual((stage["progress"], stage["status_code"]), (67, "in_progress"))


if __name__ == "__main__":
    unittest.main()
