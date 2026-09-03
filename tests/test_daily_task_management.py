from __future__ import annotations

import gc
import sqlite3
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class FakeDailyTaskHandler:
    daily_task_manager = server.PMBIHandler.daily_task_manager
    daily_task_now = server.PMBIHandler.daily_task_now
    daily_task_payload = server.PMBIHandler.daily_task_payload
    daily_task_rows = server.PMBIHandler.daily_task_rows
    daily_task_users = server.PMBIHandler.daily_task_users

    def __init__(self, user: dict, payload: dict | None = None):
        self.user = user
        self.payload = payload or {}
        self.status: int | None = None
        self.response: dict | None = None
        self.path = "/api/daily-tasks"

    def require_user(self) -> dict:
        return self.user

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class DailyTaskManagementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        server.DB_PATH = Path(self.temp_dir.name) / "daily-task-management.sqlite3"
        with server.db() as con:
            con.executescript(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    login TEXT NOT NULL,
                    role TEXT NOT NULL,
                    first_name TEXT,
                    last_name TEXT,
                    name TEXT NOT NULL,
                    avatar_url TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE daily_tasks (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    status TEXT NOT NULL,
                    task_date TEXT NOT NULL,
                    completed_at TEXT,
                    archived_at TEXT,
                    created_by INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER
                );
                INSERT INTO users (id, login, role, name) VALUES
                    (1, 'worker_one', 'foreman', 'Первый сотрудник'),
                    (2, 'worker_two', 'foreman', 'Второй сотрудник'),
                    (3, 'task_admin', 'admin', 'Администратор'),
                    (4, 'task_director', 'director', 'Директор');
                INSERT INTO daily_tasks (
                    id, user_id, text, status, task_date, created_by, created_at, updated_at
                ) VALUES
                    (11, 1, 'Задача сотрудника', 'planned', '2026-08-21', 3, 1, 1),
                    (12, 2, 'Задача для удаления', 'planned', '2026-08-21', 4, 1, 1);
                """
            )
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_db_path
        gc.collect()
        self.temp_dir.cleanup()

    @staticmethod
    def user(user_id: int, role: str) -> dict:
        return {"id": user_id, "role": role, "roles": []}

    def update(self, task_id: int, user: dict, payload: dict) -> FakeDailyTaskHandler:
        handler = FakeDailyTaskHandler(user, payload)
        server.PMBIHandler.api_update_daily_task(
            handler, f"/api/daily-tasks/{task_id}/update"
        )
        return handler

    def delete(self, task_id: int, user: dict) -> FakeDailyTaskHandler:
        handler = FakeDailyTaskHandler(user)
        server.PMBIHandler.api_delete_daily_task(
            handler, f"/api/daily-tasks/{task_id}/delete"
        )
        return handler

    def task(self, task_id: int) -> sqlite3.Row | None:
        with server.db() as con:
            return con.execute(
                "SELECT * FROM daily_tasks WHERE id = ?", (task_id,)
            ).fetchone()

    def list_tasks(self, user: dict, query: str = "") -> FakeDailyTaskHandler:
        handler = FakeDailyTaskHandler(user)
        handler.path = "/api/daily-tasks" + query
        server.PMBIHandler.api_daily_tasks(handler)
        return handler

    def test_regular_employee_only_sees_own_tasks(self) -> None:
        response = self.list_tasks(self.user(1, "foreman"))

        self.assertEqual(response.status, HTTPStatus.OK)
        self.assertFalse(response.response["canSeeAll"])
        self.assertEqual([item["userId"] for item in response.response["tasks"]], [1])
        self.assertEqual([item["id"] for item in response.response["users"]], [1])

        denied = self.list_tasks(self.user(1, "foreman"), "?userId=2")
        self.assertEqual(denied.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(denied.response, {"error": "daily_tasks_forbidden"})

    def test_director_can_see_all_tasks(self) -> None:
        response = self.list_tasks(self.user(4, "director"))

        self.assertEqual(response.status, HTTPStatus.OK)
        self.assertTrue(response.response["canSeeAll"])
        self.assertEqual({item["userId"] for item in response.response["tasks"]}, {1, 2})

    def test_regular_employee_cannot_edit_or_delete_someone_elses_task(self) -> None:
        update = self.update(12, self.user(1, "foreman"), {"text": "Чужая правка"})
        self.assertEqual(update.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(update.response, {"error": "not_task_owner"})
        self.assertEqual(self.task(12)["text"], "Задача для удаления")

        delete = self.delete(12, self.user(1, "foreman"))
        self.assertEqual(delete.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(delete.response, {"error": "not_task_owner"})
        self.assertIsNotNone(self.task(12))

    def test_employee_can_edit_and_delete_own_task(self) -> None:
        update = self.update(11, self.user(1, "foreman"), {"text": "Моя правка"})
        self.assertEqual(update.status, HTTPStatus.OK)
        self.assertEqual(self.task(11)["text"], "Моя правка")

        delete = self.delete(11, self.user(1, "foreman"))
        self.assertEqual(delete.status, HTTPStatus.OK)
        self.assertIsNone(self.task(11))

    def test_admin_can_edit_and_reassign_any_task(self) -> None:
        update = self.update(
            11,
            self.user(3, "admin"),
            {"text": "Исправлено администратором", "userId": 2},
        )
        self.assertEqual(update.status, HTTPStatus.OK)
        row = self.task(11)
        self.assertEqual(row["text"], "Исправлено администратором")
        self.assertEqual(row["user_id"], 2)

    def test_director_can_edit_and_delete_any_task(self) -> None:
        update = self.update(
            11, self.user(4, "director"), {"text": "Исправлено директором"}
        )
        self.assertEqual(update.status, HTTPStatus.OK)
        self.assertEqual(self.task(11)["text"], "Исправлено директором")

        delete = self.delete(12, self.user(4, "director"))
        self.assertEqual(delete.status, HTTPStatus.OK)
        self.assertIsNone(self.task(12))


if __name__ == "__main__":
    unittest.main()
