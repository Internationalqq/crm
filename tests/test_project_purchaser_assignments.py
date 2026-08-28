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

import projects  # noqa: E402
import server  # noqa: E402


class FakeManageHandler:
    def __init__(self, user: dict, payload: dict):
        self.user = user
        self.payload = payload
        self.status: int | None = None
        self.response: dict | None = None

    def require_user(self) -> dict:
        return self.user

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload

    def set_project_foremen(
        self,
        con: sqlite3.Connection,
        project_id: int,
        foreman_ids: list[int],
        assigned_by: int,
    ) -> list[int]:
        return projects.set_project_foremen(con, project_id, foreman_ids, assigned_by)

    def set_project_purchasers(
        self,
        con: sqlite3.Connection,
        project_id: int,
        purchaser_ids: list[int],
        assigned_by: int,
    ) -> list[int]:
        return projects.set_project_purchasers(con, project_id, purchaser_ids, assigned_by)


class ProjectPurchaserAssignmentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.con = sqlite3.connect(":memory:")
        self.con.row_factory = sqlite3.Row
        self.con.execute("PRAGMA foreign_keys = ON")
        self.con.executescript(
            """
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY,
                buyer_id INTEGER,
                updated_at INTEGER
            );
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                role TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE roles (
                id INTEGER PRIMARY KEY,
                code TEXT NOT NULL UNIQUE
            );
            CREATE TABLE user_roles (
                user_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL
            );
            CREATE TABLE object_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role_code TEXT NOT NULL,
                responsibility TEXT,
                is_primary INTEGER NOT NULL DEFAULT 0,
                assigned_by INTEGER,
                assigned_at INTEGER NOT NULL,
                UNIQUE(object_id, user_id, role_code)
            );
            CREATE TABLE user_project_access (
                user_id INTEGER NOT NULL,
                project_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, project_id)
            );
            """
        )
        self.con.execute("INSERT INTO projects (id) VALUES (10)")
        self.con.executemany(
            "INSERT INTO users (id, role) VALUES (?, ?)",
            [
                (1, "admin"),
                (2, "foreman"),
                (3, "purchaser"),
                (4, "purchaser"),
            ],
        )
        self.con.execute(
            """
            INSERT INTO object_assignments (
                object_id, user_id, role_code, responsibility,
                is_primary, assigned_by, assigned_at
            ) VALUES (10, 2, 'foreman', 'Project foreman', 1, 1, 1)
            """
        )
        self.con.execute(
            """
            INSERT INTO object_assignments (
                object_id, user_id, role_code, responsibility,
                is_primary, assigned_by, assigned_at
            ) VALUES (10, 4, 'purchaser', 'Project purchaser', 1, 1, 1)
            """
        )
        self.con.execute(
            "INSERT INTO user_project_access (user_id, project_id) VALUES (4, 10)"
        )
        self.con.commit()

    def tearDown(self) -> None:
        self.con.close()

    def test_set_project_purchasers_replaces_and_clears_only_supply_assignment(self) -> None:
        assigned = projects.set_project_purchasers(self.con, 10, [3, 3], 1)

        self.assertEqual(assigned, [3])
        rows = self.con.execute(
            """
            SELECT user_id, role_code, is_primary
            FROM object_assignments
            WHERE object_id = 10
            ORDER BY role_code, user_id
            """
        ).fetchall()
        self.assertEqual(
            [(row["user_id"], row["role_code"], row["is_primary"]) for row in rows],
            [(2, "foreman", 1), (3, "purchaser", 1)],
        )
        project = self.con.execute(
            "SELECT buyer_id FROM projects WHERE id = 10"
        ).fetchone()
        self.assertEqual(project["buyer_id"], 3)
        access_ids = {
            row["user_id"]
            for row in self.con.execute(
                "SELECT user_id FROM user_project_access WHERE project_id = 10"
            ).fetchall()
        }
        self.assertIn(3, access_ids)
        self.assertNotIn(4, access_ids)

        self.assertEqual(projects.set_project_purchasers(self.con, 10, [], 1), [])
        self.assertIsNone(
            self.con.execute(
                "SELECT buyer_id FROM projects WHERE id = 10"
            ).fetchone()["buyer_id"]
        )
        remaining = self.con.execute(
            "SELECT user_id, role_code FROM object_assignments WHERE object_id = 10"
        ).fetchall()
        self.assertEqual(
            [(row["user_id"], row["role_code"]) for row in remaining],
            [(2, "foreman")],
        )


class ProjectResponsiblesApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_server_db = server.DB_PATH
        self.original_projects_db = projects.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR
        server.DB_PATH = temp_path / "project-responsibles.sqlite3"
        projects.DB_PATH = server.DB_PATH
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            timestamp = server.now_ts()
            self.foreman_id = int(
                con.execute(
                    """
                    INSERT INTO users (login, password_hash, role, name, status, created_at, updated_at)
                    VALUES ('api-foreman', 'unused', 'foreman', 'API Foreman', 'active', ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.purchaser_id = int(
                con.execute(
                    """
                    INSERT INTO users (login, password_hash, role, name, status, created_at, updated_at)
                    VALUES ('api-purchaser', 'unused', 'purchaser', 'API Purchaser', 'active', ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, progress,
                        budget, paid, spent, created_at, updated_at
                    ) VALUES ('API project', 'Address', 'Client', 'active', 0, 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        projects.DB_PATH = self.original_projects_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def call_manage(self, payload: dict) -> FakeManageHandler:
        handler = FakeManageHandler(
            {"id": self.admin_id, "login": "admin", "role": "admin", "roles": []},
            payload,
        )
        server.PMBIHandler.api_users_manage(handler)
        return handler

    def test_access_action_saves_both_roles_and_legacy_payload_keeps_purchaser(self) -> None:
        handler = self.call_manage(
            {
                "action": "set_project_foremen",
                "project_id": self.project_id,
                "foreman_ids": [self.foreman_id],
                "purchaser_ids": [self.purchaser_id],
            }
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["assigned_foremen"], [self.foreman_id])
        self.assertEqual(handler.response["assigned_purchasers"], [self.purchaser_id])
        with server.db() as con:
            roles = {
                row["role_code"]
                for row in con.execute(
                    "SELECT role_code FROM object_assignments WHERE object_id = ?",
                    (self.project_id,),
                ).fetchall()
            }
            self.assertEqual(roles, {"foreman", "purchaser"})

        legacy_handler = self.call_manage(
            {
                "action": "set_project_foremen",
                "project_id": self.project_id,
                "foreman_ids": [self.foreman_id],
            }
        )
        self.assertEqual(legacy_handler.status, HTTPStatus.OK)
        self.assertNotIn("assigned_purchasers", legacy_handler.response)
        with server.db() as con:
            purchaser = con.execute(
                """
                SELECT user_id FROM object_assignments
                WHERE object_id = ? AND role_code = 'purchaser'
                """,
                (self.project_id,),
            ).fetchone()
        self.assertEqual(purchaser["user_id"], self.purchaser_id)


if __name__ == "__main__":
    unittest.main()
