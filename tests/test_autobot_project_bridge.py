from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class FakeAutoBotHandler:
    def __init__(self, user: dict | None, payload: dict | None = None):
        self.user = user
        self.payload = payload or {}
        self.read_count = 0
        self.read_maximum: int | None = None
        self.status: int | None = None
        self.response: dict | None = None

    def require_user(self) -> dict | None:
        return self.user

    def require_project_access(self, _project_id: int) -> dict | None:
        return self.user

    def read_json(self, maximum: int | None = None) -> dict:
        self.read_count += 1
        self.read_maximum = maximum
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = int(status)
        self.response = payload


class AutoBotProjectBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_db_path = server.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        server.DB_PATH = temp_path / "autobot-project-bridge.sqlite3"
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            timestamp = server.now_ts()
            self.foreman_id = int(
                con.execute(
                    """
                    INSERT INTO users (
                        login, password_hash, role, name, status, created_at, updated_at
                    ) VALUES ('autobot-foreman', 'unused', 'foreman', 'AutoBot Foreman',
                              'active', ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.other_foreman_id = int(
                con.execute(
                    """
                    INSERT INTO users (
                        login, password_hash, role, name, status, created_at, updated_at
                    ) VALUES ('other-foreman', 'unused', 'foreman', 'Other Foreman',
                              'active', ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.purchaser_id = int(
                con.execute(
                    """
                    INSERT INTO users (
                        login, password_hash, role, name, status, created_at, updated_at
                    ) VALUES ('autobot-purchaser', 'unused', 'purchaser', 'Purchaser',
                              'active', ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )

            self.assigned_project_id = self._insert_project(
                con, "Assigned project", timestamp
            )
            self.unassigned_project_id = self._insert_project(
                con, "Unassigned project", timestamp
            )
            self.other_project_id = self._insert_project(
                con, "Other foreman's project", timestamp
            )
            con.execute(
                """
                INSERT INTO object_assignments (
                    object_id, user_id, role_code, responsibility,
                    is_primary, assigned_by, assigned_at
                ) VALUES (?, ?, 'foreman', 'Прораб объекта', 1, ?, ?)
                """,
                (
                    self.assigned_project_id,
                    self.foreman_id,
                    self.admin_id,
                    timestamp,
                ),
            )
            con.execute(
                """
                INSERT INTO object_assignments (
                    object_id, user_id, role_code, responsibility,
                    is_primary, assigned_by, assigned_at
                ) VALUES (?, ?, 'foreman', 'Прораб объекта', 1, ?, ?)
                """,
                (
                    self.other_project_id,
                    self.other_foreman_id,
                    self.admin_id,
                    timestamp,
                ),
            )
            # A generic access row is intentionally insufficient for the AutoBot
            # foreman picker: only an explicit foreman assignment grants scope.
            con.execute(
                "INSERT INTO user_project_access (user_id, project_id) VALUES (?, ?)",
                (self.foreman_id, self.unassigned_project_id),
            )
            con.commit()

    @staticmethod
    def _insert_project(con, title: str, timestamp: int) -> int:
        return int(
            con.execute(
                """
                INSERT INTO projects (
                    title, address, city, client_name, status, progress,
                    budget, paid, spent, created_at, updated_at
                ) VALUES (?, 'Address', 'Miass', 'Client', 'active', 0,
                          0, 0, 0, ?, ?)
                """,
                (title, timestamp, timestamp),
            ).lastrowid
        )

    def tearDown(self) -> None:
        server.DB_PATH = self.original_db_path
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        gc.collect()
        self.temp_dir.cleanup()

    def user(self, user_id: int, role: str, *, login: str | None = None) -> dict:
        return {
            "id": user_id,
            "login": login or role,
            "role": role,
            "roles": [],
            "permissions": server.default_permissions_for_role(role),
        }

    @staticmethod
    def import_payload(**extra: object) -> dict:
        payload = {
            "items": [
                {
                    "title": "Concrete B25",
                    "unit": "m3",
                    "plannedQty": 3,
                    "plannedPrice": 4500,
                    "sourceItemKey": "row-1",
                }
            ],
            "source": {
                "sourceType": "estimate",
                "sourceKey": "autobot:estimate-17",
                "title": "AutoBot estimate",
            },
            "sourceLabel": "AutoBot estimate",
            "sourceReference": "/estimates/17",
            "replace_source": True,
        }
        payload.update(extra)
        return payload

    @staticmethod
    def bundle_payload(**extra: object) -> dict:
        payload = {
            "estimates": [
                {
                    "source": {
                        "sourceType": "estimate",
                        "sourceKey": "estimate-a",
                        "externalId": "estimate-a",
                        "title": "Estimate A",
                        "fileName": "estimate-a.xlsx",
                        "sourceReference": "/estimates/estimate-a",
                    },
                    "items": [
                        {
                            "title": "Concrete B25",
                            "unit": "m3",
                            "plannedQty": 3,
                            "plannedPrice": 4500,
                            "sourceItemKey": "shared-row-key",
                        }
                    ],
                },
                {
                    "source": {
                        "sourceType": "estimate",
                        "sourceKey": "estimate-b",
                        "externalId": "estimate-b",
                        "title": "Estimate B",
                        "fileName": "estimate-b.xlsx",
                        "sourceReference": "/estimates/estimate-b",
                    },
                    "items": [
                        {
                            "title": "Reinforcement mesh",
                            "unit": "m2",
                            "plannedQty": 20,
                            "plannedPrice": 320,
                            "sourceItemKey": "shared-row-key",
                        }
                    ],
                },
            ],
            "source": {
                "sourceType": "estimate",
                "sourceKey": "bundle:estimate-a:estimate-b",
                "title": "Two estimates",
                "metadata": {
                    "bundleEstimateIds": ["estimate-a", "estimate-b"],
                    "bundleCount": 2,
                },
            },
            "sourceLabel": "Two estimates",
            "sourceReference": "/estimates",
            "replace": False,
            "replace_source": True,
        }
        payload.update(extra)
        return payload

    def test_routes_are_exact_and_do_not_expose_create_or_bootstrap(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        calls: list[tuple[str, str]] = []
        responses: list[tuple[int, dict]] = []
        handler.api_autobot_projects = lambda: calls.append(("projects", ""))
        handler.api_autobot_import_estimate = lambda path: calls.append(("import", path))
        handler.send_json = lambda status, payload: responses.append((int(status), payload))

        import_path = "/api/autobot/projects/42/estimate-import"
        server.PMBIHandler.handle_api(handler, "GET", "/api/autobot/projects")
        server.PMBIHandler.handle_api(handler, "POST", import_path)
        server.PMBIHandler.handle_api(handler, "POST", "/api/autobot/projects")
        server.PMBIHandler.handle_api(
            handler, "POST", "/api/autobot/projects/42/bootstrap"
        )

        self.assertEqual(calls, [("projects", ""), ("import", import_path)])
        self.assertEqual(
            responses,
            [
                (HTTPStatus.NOT_FOUND, {"error": "not_found"}),
                (HTTPStatus.NOT_FOUND, {"error": "not_found"}),
            ],
        )

    def test_import_rejects_nonpositive_or_oversized_project_ids(self) -> None:
        for project_id in ("0", "99999999999999999999"):
            with self.subTest(project_id=project_id):
                handler = FakeAutoBotHandler(None, self.import_payload())

                server.PMBIHandler.api_autobot_import_estimate(
                    handler,
                    f"/api/autobot/projects/{project_id}/estimate-import",
                )

                self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(handler.response, {"error": "bad_project_id"})
                self.assertEqual(handler.read_count, 0)

    def test_foreman_picker_contains_only_explicit_foreman_assignments(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman")
        )

        server.PMBIHandler.api_autobot_projects(handler)

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertIs(handler.response["ok"], True)
        self.assertEqual(
            [project["id"] for project in handler.response["projects"]],
            [self.assigned_project_id],
        )
        self.assertEqual(
            set(handler.response["projects"][0]),
            {"id", "title", "address", "city", "status"},
        )

    def test_admin_picker_preserves_access_to_all_projects(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.admin_id, "admin", login="admin")
        )

        server.PMBIHandler.api_autobot_projects(handler)

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertIs(handler.response["ok"], True)
        self.assertEqual(
            {project["id"] for project in handler.response["projects"]},
            {
                self.assigned_project_id,
                self.unassigned_project_id,
                self.other_project_id,
            },
        )

    def test_non_autobot_role_is_denied_before_any_project_data_is_returned(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.purchaser_id, "purchaser", login="autobot-purchaser")
        )

        server.PMBIHandler.api_autobot_projects(handler)

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response, {"error": "autobot_forbidden"})

    def test_foreman_import_uses_route_project_and_real_session_actor(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            self.import_payload(
                project_id=self.other_project_id,
                projectId=self.other_project_id,
                role="admin",
            ),
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        self.assertEqual(handler.response["imported"], 1)
        with server.db() as con:
            imported_projects = {
                int(row["project_id"])
                for row in con.execute(
                    "SELECT DISTINCT project_id FROM estimate_items WHERE title = ?",
                    ("Concrete B25",),
                ).fetchall()
            }
            audit = con.execute(
                """
                SELECT user_id, entity_id
                FROM audit_log
                WHERE action = 'import_estimate'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        self.assertEqual(imported_projects, {self.assigned_project_id})
        self.assertEqual(int(audit["user_id"]), self.foreman_id)
        self.assertEqual(int(audit["entity_id"]), self.assigned_project_id)

    def test_foreman_cannot_import_to_unassigned_project_even_with_client_role(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            self.import_payload(role="admin"),
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.other_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response, {"error": "project_forbidden"})
        self.assertEqual(handler.read_count, 0)
        with server.db() as con:
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM estimate_items WHERE project_id = ?",
                    (self.other_project_id,),
                ).fetchone()[0],
                0,
            )

    def test_foreman_cannot_request_destructive_full_project_replace(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, updated_at
                ) VALUES (?, 'Existing estimate row', 'm3', 1, 100, ?)
                """,
                (self.assigned_project_id, timestamp),
            )
            con.commit()
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            self.import_payload(replace=True, role="admin"),
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(
            handler.response, {"error": "estimate_full_replace_forbidden"}
        )
        with server.db() as con:
            titles = {
                str(row["title"])
                for row in con.execute(
                    "SELECT title FROM estimate_items WHERE project_id = ?",
                    (self.assigned_project_id,),
                ).fetchall()
            }
        self.assertEqual(titles, {"Existing estimate row"})

    def test_director_preserves_manager_import_scope_and_full_replace(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, updated_at
                ) VALUES (?, 'Obsolete row', 'm3', 1, 100, ?)
                """,
                (self.other_project_id, timestamp),
            )
            con.commit()
        handler = FakeAutoBotHandler(
            self.user(self.admin_id, "director", login="director"),
            self.import_payload(replace=True),
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.other_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        with server.db() as con:
            titles = {
                str(row["title"])
                for row in con.execute(
                    "SELECT title FROM estimate_items WHERE project_id = ?",
                    (self.other_project_id,),
                ).fetchall()
            }
        self.assertEqual(titles, {"Concrete B25"})

    def test_bundle_import_is_atomic_and_preserves_two_estimate_sources(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            self.bundle_payload(),
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        self.assertEqual(handler.response["imported"], 2)
        self.assertEqual(handler.response["estimateSources"], 2)
        self.assertEqual(handler.response["items"], [])
        self.assertTrue(handler.response["itemsOmitted"])
        self.assertEqual(handler.read_maximum, server.AUTOBOT_ESTIMATE_IMPORT_MAX_BYTES)
        with server.db() as con:
            sources = con.execute(
                """
                SELECT source_key, title, metadata
                FROM project_estimates
                WHERE project_id = ?
                ORDER BY source_key
                """,
                (self.assigned_project_id,),
            ).fetchall()
            rows = con.execute(
                """
                SELECT source.source_key, item.source_item_key, item.title
                FROM estimate_items item
                JOIN project_estimates source ON source.id = item.estimate_source_id
                WHERE item.project_id = ? AND item.is_deleted = 0
                ORDER BY source.source_key
                """,
                (self.assigned_project_id,),
            ).fetchall()
        self.assertEqual([row["source_key"] for row in sources], ["estimate-a", "estimate-b"])
        self.assertEqual([row["source_item_key"] for row in rows], ["shared-row-key", "shared-row-key"])
        self.assertEqual({row["title"] for row in rows}, {"Concrete B25", "Reinforcement mesh"})
        self.assertTrue(all('"bundleCount": 2' in row["metadata"] for row in sources))

    def test_bundle_value_issue_identifies_estimate_before_any_write(self) -> None:
        payload = self.bundle_payload()
        payload["estimates"][0]["items"][0]["plannedTotal"] = 1
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            payload,
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.UNPROCESSABLE_ENTITY)
        issue = handler.response["issues"][0]
        self.assertEqual(issue["sourceKey"], "estimate-a")
        self.assertEqual(issue["estimateTitle"], "Estimate A")
        self.assertEqual(issue["sourceItemKey"], "shared-row-key")
        self.assertEqual(issue["title"], "Concrete B25")
        with server.db() as con:
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM project_estimates WHERE project_id = ?",
                    (self.assigned_project_id,),
                ).fetchone()[0],
                0,
            )

    def test_bundle_retry_is_idempotent_and_source_replace_keeps_other_estimates(self) -> None:
        actor = self.user(self.foreman_id, "foreman", login="autobot-foreman")
        for _ in range(2):
            handler = FakeAutoBotHandler(actor, self.bundle_payload())
            server.PMBIHandler.api_autobot_import_estimate(
                handler,
                f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
            )
            self.assertEqual(handler.status, HTTPStatus.CREATED)

        replacement = self.bundle_payload()
        replacement["estimates"] = [
            {
                "source": replacement["estimates"][0]["source"],
                "items": [
                    {
                        "title": "Updated concrete B30",
                        "unit": "m3",
                        "plannedQty": 5,
                        "plannedPrice": 5100,
                        "sourceItemKey": "replacement-row",
                    }
                ],
            }
        ]
        replacement["source"]["metadata"] = {"bundleEstimateIds": ["estimate-a"], "bundleCount": 1}
        replacement_handler = FakeAutoBotHandler(actor, replacement)
        server.PMBIHandler.api_autobot_import_estimate(
            replacement_handler,
            f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
        )
        self.assertEqual(replacement_handler.status, HTTPStatus.CREATED)

        with server.db() as con:
            source_count = con.execute(
                "SELECT COUNT(*) FROM project_estimates WHERE project_id = ?",
                (self.assigned_project_id,),
            ).fetchone()[0]
            active_rows = con.execute(
                """
                SELECT source.source_key, item.source_item_key, item.title
                FROM estimate_items item
                JOIN project_estimates source ON source.id = item.estimate_source_id
                WHERE item.project_id = ? AND item.is_deleted = 0
                ORDER BY source.source_key
                """,
                (self.assigned_project_id,),
            ).fetchall()
            deleted_a = con.execute(
                """
                SELECT COUNT(*)
                FROM estimate_items item
                JOIN project_estimates source ON source.id = item.estimate_source_id
                WHERE item.project_id = ? AND source.source_key = 'estimate-a' AND item.is_deleted = 1
                """,
                (self.assigned_project_id,),
            ).fetchone()[0]
        self.assertEqual(source_count, 2)
        self.assertEqual(
            [(row["source_key"], row["source_item_key"]) for row in active_rows],
            [("estimate-a", "replacement-row"), ("estimate-b", "shared-row-key")],
        )
        self.assertEqual(deleted_a, 1)

    def test_bundle_rejects_duplicate_sources_before_writing(self) -> None:
        payload = self.bundle_payload()
        payload["estimates"][1]["source"]["sourceKey"] = "estimate-a"
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            payload,
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response["error"], "duplicate_estimate_source")
        with server.db() as con:
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM project_estimates WHERE project_id = ?",
                    (self.assigned_project_id,),
                ).fetchone()[0],
                0,
            )

    def test_bundle_rolls_back_everything_when_snapshot_fails(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            self.bundle_payload(),
        )

        with mock.patch.object(server, "capture_live_snapshot", side_effect=RuntimeError("snapshot failed")):
            with self.assertRaisesRegex(RuntimeError, "snapshot failed"):
                server.PMBIHandler.api_autobot_import_estimate(
                    handler,
                    f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
                )

        with server.db() as con:
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM project_estimates WHERE project_id = ?",
                    (self.assigned_project_id,),
                ).fetchone()[0],
                0,
            )
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM estimate_items WHERE project_id = ?",
                    (self.assigned_project_id,),
                ).fetchone()[0],
                0,
            )
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM audit_log WHERE action = 'import_estimate' AND entity_id = ?",
                    (self.assigned_project_id,),
                ).fetchone()[0],
                0,
            )

    def test_import_invalidates_material_caches_and_reopens_schedule(self) -> None:
        timestamp = server.now_ts()
        with server.db() as con:
            con.execute(
                """
                INSERT INTO market_analysis_cache (project_id, kind, status, payload, updated_at)
                VALUES (?, 'material', 'ready', '{}', ?)
                """,
                (self.assigned_project_id, timestamp),
            )
            con.execute(
                """
                INSERT INTO material_schedule_snapshots (project_id, payload, created_at, updated_at)
                VALUES (?, '{}', ?, ?)
                """,
                (self.assigned_project_id, timestamp, timestamp),
            )
            con.execute(
                """
                UPDATE projects
                SET internal_schedule_status = 'approved', customer_schedule_status = 'approved'
                WHERE id = ?
                """,
                (self.assigned_project_id,),
            )
            con.commit()
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            self.bundle_payload(),
        )

        server.PMBIHandler.api_autobot_import_estimate(
            handler,
            f"/api/autobot/projects/{self.assigned_project_id}/estimate-import",
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        with server.db() as con:
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM market_analysis_cache WHERE project_id = ?",
                    (self.assigned_project_id,),
                ).fetchone()[0],
                0,
            )
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM material_schedule_snapshots WHERE project_id = ?",
                    (self.assigned_project_id,),
                ).fetchone()[0],
                0,
            )
            project = con.execute(
                """
                SELECT internal_schedule_status, customer_schedule_status
                FROM projects WHERE id = ?
                """,
                (self.assigned_project_id,),
            ).fetchone()
        self.assertEqual(project["internal_schedule_status"], "draft")
        self.assertEqual(project["customer_schedule_status"], "draft")

    def test_foreman_still_cannot_use_project_bootstrap(self) -> None:
        handler = FakeAutoBotHandler(
            self.user(self.foreman_id, "foreman", login="autobot-foreman"),
            {"materials": self.import_payload()["items"]},
        )

        server.PMBIHandler.api_project_bootstrap(
            handler, f"/api/projects/{self.assigned_project_id}/bootstrap"
        )

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response, {"error": "forbidden"})
        self.assertEqual(handler.read_count, 0)


if __name__ == "__main__":
    unittest.main()
