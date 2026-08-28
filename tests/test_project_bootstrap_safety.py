from __future__ import annotations

import gc
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path

import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import projects  # noqa: E402
import server  # noqa: E402


class FakeBootstrapHandler:
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


class ProjectBootstrapSafetyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_server_db = server.DB_PATH
        self.original_projects_db = projects.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR
        server.DB_PATH = temp_path / "bootstrap-safety.sqlite3"
        projects.DB_PATH = server.DB_PATH
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()
        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            now = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent,
                    created_at, updated_at
                ) VALUES ('Live object', 'Address', 'Client', 'В работе', 0, 0, 0, ?, ?)
                """,
                (now, now),
            )
            self.project_id = int(cursor.lastrowid)
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, move_type, qty, price, created_by, created_at
                ) VALUES (?, 'receipt', 38.4, 0, ?, ?)
                """,
                (self.project_id, self.admin_id, now),
            )
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        projects.DB_PATH = self.original_projects_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def test_replace_is_blocked_before_live_structure_is_deleted(self) -> None:
        handler = FakeBootstrapHandler(
            {"id": self.admin_id, "role": "admin", "roles": []},
            {
                "replaceExisting": True,
                "project": {"title": "Destructive replacement"},
                "stages": [{"title": "Replacement stage"}],
            },
        )

        server.PMBIHandler.api_project_bootstrap(
            handler, f"/api/projects/{self.project_id}/bootstrap"
        )

        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            handler.response["error"],
            "bootstrap_replace_blocked_by_project_history",
        )
        with server.db() as con:
            project = con.execute(
                "SELECT title FROM projects WHERE id = ?", (self.project_id,)
            ).fetchone()
            stock_count = int(
                con.execute(
                    "SELECT COUNT(*) FROM stock_moves WHERE project_id = ?",
                    (self.project_id,),
                ).fetchone()[0]
            )
            stage_count = int(
                con.execute(
                    "SELECT COUNT(*) FROM work_stages WHERE project_id = ?",
                    (self.project_id,),
                ).fetchone()[0]
            )
        self.assertEqual(project["title"], "Live object")
        self.assertEqual(stock_count, 1)
        self.assertEqual(stage_count, 0)

    def test_replayed_bootstrap_task_key_is_idempotent(self) -> None:
        payload = {
            "replace_existing": False,
            "tasks": [
                {
                    "title": "Проверить тендер и решение об участии",
                    "description": "Стартовая задача AutoBot",
                    "priority": "high",
                    "client_request_id": "autobot:tender:12345678:starter",
                }
            ],
        }

        def call_bootstrap() -> None:
            handler = FakeBootstrapHandler(
                {"id": self.admin_id, "role": "admin", "roles": []},
                payload,
            )
            server.PMBIHandler.api_project_bootstrap(
                handler, f"/api/projects/{self.project_id}/bootstrap"
            )
            self.assertEqual(handler.status, HTTPStatus.OK)
            self.assertEqual(handler.response["summary"]["tasks"], 1)

        call_bootstrap()
        with server.db() as con:
            con.execute(
                """
                UPDATE projects
                SET internal_schedule_status = 'approved', internal_schedule_version = 7,
                    customer_schedule_status = 'approved', customer_schedule_version = 9
                WHERE id = ?
                """,
                (self.project_id,),
            )
            con.commit()

        call_bootstrap()

        with server.db() as con:
            tasks = con.execute(
                """
                SELECT title, client_request_id
                FROM tasks
                WHERE project_id = ?
                """,
                (self.project_id,),
            ).fetchall()
            project = con.execute(
                """
                SELECT internal_schedule_status, internal_schedule_version,
                       customer_schedule_status, customer_schedule_version
                FROM projects
                WHERE id = ?
                """,
                (self.project_id,),
            ).fetchone()
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["title"], "Проверить тендер и решение об участии")
        self.assertEqual(tasks[0]["client_request_id"], "autobot:tender:12345678:starter")
        self.assertEqual(project["internal_schedule_status"], "approved")
        self.assertEqual(project["internal_schedule_version"], 7)
        self.assertEqual(project["customer_schedule_status"], "approved")
        self.assertEqual(project["customer_schedule_version"], 9)


if __name__ == "__main__":
    unittest.main()
