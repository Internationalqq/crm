from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import auth  # noqa: E402
import projects  # noqa: E402
import server  # noqa: E402


class FakeHandler:
    def __init__(self, user: dict, payload: dict | None = None):
        self.user = user
        self.payload = payload or {}
        self.status: int | None = None
        self.response: dict | None = None

    def require_user(self) -> dict:
        return self.user

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class ProjectEconomicsVisibilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_projects_db = projects.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "project-economics-visibility.sqlite3"
        server.DB_PATH = test_db
        projects.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, progress,
                    budget, paid, spent, created_at
                ) VALUES (
                    'Visibility project', 'Test address', 'Test client', 'active', 42,
                    987654.32, 123456.78, 87654.32, ?
                )
                """,
                (server.now_ts(),),
            )
            self.project_id = int(cursor.lastrowid)
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        projects.DB_PATH = self.original_projects_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _project_row(self):
        with server.db() as con:
            return con.execute(
                "SELECT * FROM projects WHERE id = ?", (self.project_id,)
            ).fetchone()

    def _legacy_values(self) -> tuple[float, float, float]:
        row = self._project_row()
        return float(row["budget"]), float(row["paid"]), float(row["spent"])

    def test_legacy_money_fields_follow_full_role_matrix(self) -> None:
        allowed = {"main_admin", "admin", "director"}
        for role in auth.ROLE_CODES:
            with self.subTest(role=role):
                data = projects.serialize_project(
                    self._project_row(),
                    {"id": self.admin_id, "role": role, "roles": []},
                )
                for field in ("budget", "paid", "spent"):
                    if role in allowed:
                        self.assertIn(field, data)
                    else:
                        self.assertNotIn(field, data)

    def test_secondary_director_role_grants_economics_visibility(self) -> None:
        data = projects.serialize_project(
            self._project_row(),
            {
                "id": self.admin_id,
                "role": "foreman",
                "roles": [{"code": "director"}],
            },
        )
        self.assertEqual(data["budget"], 987654.32)
        self.assertEqual(data["paid"], 123456.78)
        self.assertEqual(data["spent"], 87654.32)

    def test_restricted_role_cannot_overwrite_existing_legacy_budget(self) -> None:
        before = self._legacy_values()
        handler = FakeHandler(
            {"id": self.admin_id, "role": "foreman", "roles": []},
            {
                "title": "Visibility project updated",
                "address": "Test address",
                "client_name": "Test client",
                "status": "active",
                "budget": 0,
            },
        )

        projects.api_update_project(
            handler, f"/api/projects/{self.project_id}/update"
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertNotIn("budget", handler.response["project"])
        self.assertEqual(self._legacy_values(), before)

    def test_authorized_role_can_update_existing_legacy_budget(self) -> None:
        handler = FakeHandler(
            {"id": self.admin_id, "role": "admin", "roles": []},
            {
                "title": "Visibility project",
                "address": "Test address",
                "client_name": "Test client",
                "status": "active",
                "budget": 765432.10,
            },
        )

        projects.api_update_project(
            handler, f"/api/projects/{self.project_id}/update"
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["project"]["budget"], 765432.10)
        self.assertEqual(self._legacy_values()[0], 765432.10)

    def test_restricted_role_new_project_ignores_submitted_legacy_budget(self) -> None:
        handler = FakeHandler(
            {"id": self.admin_id, "role": "foreman", "roles": []},
            {
                "title": "Restricted project",
                "address": "Other address",
                "client_name": "Other client",
                "budget": 555000,
            },
        )

        projects.api_create_project(handler)

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        self.assertNotIn("budget", handler.response["project"])
        with server.db() as con:
            row = con.execute(
                "SELECT budget FROM projects WHERE title = 'Restricted project'"
            ).fetchone()
        self.assertEqual(float(row["budget"]), 0)

    def test_server_fallback_does_not_leak_legacy_money(self) -> None:
        admin_html = server.PMBIHandler.project_cards_fallback_html(
            object(), {"id": self.admin_id, "role": "admin", "roles": []}
        )
        foreman_html = server.PMBIHandler.project_cards_fallback_html(
            object(), {"id": self.admin_id, "role": "foreman", "roles": []}
        )

        self.assertIn("Экономика", admin_html)
        self.assertIn("Раздел «Финансы»", admin_html)
        self.assertNotIn("Legacy-бюджет", admin_html)
        self.assertNotIn("987 654 ₽", admin_html)
        self.assertNotIn("Legacy-бюджет", foreman_html)
        self.assertNotIn("987 654 ₽", foreman_html)
        self.assertIn("Готовность", foreman_html)


if __name__ == "__main__":
    unittest.main()
