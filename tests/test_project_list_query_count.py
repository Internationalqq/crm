from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import projects  # noqa: E402
import server  # noqa: E402


class _Handler:
    def __init__(self, user: dict):
        self.user = user
        self.status = None
        self.response = None

    def require_user(self) -> dict:
        return self.user

    def send_json(self, status: int, payload: dict) -> None:
        self.status = int(status)
        self.response = payload


class ProjectListQueryCountTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_projects_db = projects.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        temp_path = Path(self.temp_dir.name)
        server.DB_PATH = temp_path / "project-list.sqlite3"
        projects.DB_PATH = server.DB_PATH
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.init_db()
        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            timestamp = server.now_ts()
            for index in range(3):
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, created_at, updated_at
                    ) VALUES (?, 'Address', 'Client', 'active', ?, ?)
                    """,
                    (f"Project {index}", timestamp, timestamp),
                )
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        projects.DB_PATH = self.original_projects_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        gc.collect()
        self.temp_dir.cleanup()

    def test_list_uses_one_database_connection_for_all_project_metadata(self) -> None:
        handler = _Handler(
            {
                "id": self.admin_id,
                "role": "admin",
                "roles": [],
                "permissions": {"fullAccess": True},
            }
        )
        original_db = projects.db
        connection_count = 0

        def counted_db():
            nonlocal connection_count
            connection_count += 1
            return original_db()

        with mock.patch.object(projects, "db", side_effect=counted_db):
            projects.api_projects(handler)

        self.assertEqual(connection_count, 1)
        self.assertEqual(len(handler.response["projects"]), 3)
        self.assertTrue(
            all("assigned_foremen" in project for project in handler.response["projects"])
        )


if __name__ == "__main__":
    unittest.main()
