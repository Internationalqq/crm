from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import server  # noqa: E402


class FakePositionHandler:
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


class EstimatePositionUpdateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        server.DB_PATH = Path(self.temp_dir.name) / "position-update.sqlite3"
        server.init_db()
        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent,
                    created_at, updated_at
                ) VALUES ('Object', '', '', 'В работе', 0, 0, 0, ?, ?)
                """,
                (timestamp, timestamp),
            )
            self.project_id = int(cursor.lastrowid)
            work = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price,
                    actual_qty, is_completed, item_kind, section_title, updated_at
                ) VALUES (?, 'Old work', 'м2', 10, 125, 4, 0, 'work', 'Old section', ?)
                """,
                (self.project_id, timestamp),
            )
            material = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price,
                    item_kind, section_title, updated_at
                ) VALUES (?, 'Old material', 'шт', 5, 250, 'material', 'Old section', ?)
                """,
                (self.project_id, timestamp),
            )
            self.work_id = int(work.lastrowid)
            self.material_id = int(material.lastrowid)
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_db_path
        gc.collect()
        self.temp_dir.cleanup()

    def user(self, role: str = "admin") -> dict:
        return {
            "id": self.admin_id,
            "role": role,
            "roles": [],
            "permissions": server.default_permissions_for_role(role),
        }

    def update(self, item_id: int, payload: dict, role: str = "admin") -> FakePositionHandler:
        handler = FakePositionHandler(self.user(role), payload)
        server.PMBIHandler.api_update_estimate_position(
            handler,
            f"/api/projects/{self.project_id}/estimate-items/{item_id}/update",
        )
        return handler

    def test_work_position_update_preserves_kind_price_and_fact(self) -> None:
        handler = self.update(
            self.work_id,
            {
                "title": "New work",
                "unit": "м2",
                "plannedQty": 12.5,
                "sectionTitle": "New section",
                "expectedKind": "work",
            },
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["itemKind"], "work")
        self.assertEqual(handler.response["item"]["title"], "New work")
        with server.db() as con:
            row = con.execute(
                "SELECT title, unit, planned_qty, planned_price, actual_qty, item_kind, section_title "
                "FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()
            audit = con.execute(
                "SELECT action, payload FROM audit_log WHERE entity = 'estimate_item' AND entity_id = ? ORDER BY id DESC LIMIT 1",
                (self.work_id,),
            ).fetchone()
        self.assertEqual(row["title"], "New work")
        self.assertEqual(row["planned_qty"], 12.5)
        self.assertEqual(row["planned_price"], 125)
        self.assertEqual(row["actual_qty"], 4)
        self.assertEqual(row["item_kind"], "work")
        self.assertEqual(row["section_title"], "New section")
        self.assertEqual(audit["action"], "update_estimate_position")
        self.assertIn('"before"', audit["payload"])
        self.assertIn('"after"', audit["payload"])

    def test_material_position_uses_same_safe_endpoint(self) -> None:
        handler = self.update(
            self.material_id,
            {
                "title": "New material",
                "unit": "шт",
                "planned_qty": 7,
                "section_title": "Supply",
                "expected_kind": "material",
            },
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["itemKind"], "material")
        with server.db() as con:
            row = con.execute(
                "SELECT title, planned_qty, planned_price, item_kind FROM estimate_items WHERE id = ?",
                (self.material_id,),
            ).fetchone()
        self.assertEqual(tuple(row), ("New material", 7, 250, "material"))

    def test_forbidden_fields_and_kind_mismatch_do_not_write(self) -> None:
        forbidden = self.update(
            self.work_id,
            {"title": "Bad", "item_kind": "material"},
        )
        mismatch = self.update(
            self.work_id,
            {"title": "Bad", "expectedKind": "material"},
        )

        self.assertEqual(forbidden.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(forbidden.response["error"], "estimate_position_fields_forbidden")
        self.assertEqual(mismatch.status, HTTPStatus.CONFLICT)
        self.assertEqual(mismatch.response["error"], "estimate_position_kind_mismatch")
        with server.db() as con:
            row = con.execute("SELECT title, item_kind FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()
        self.assertEqual(tuple(row), ("Old work", "work"))

    def test_customer_cannot_edit_position(self) -> None:
        handler = self.update(
            self.work_id,
            {"title": "Customer edit"},
            role="customer",
        )

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response["error"], "forbidden")
        with server.db() as con:
            title = con.execute("SELECT title FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()[0]
        self.assertEqual(title, "Old work")

    def test_foreman_can_edit_but_purchaser_cannot(self) -> None:
        foreman = self.update(
            self.work_id,
            {
                "title": "Foreman work",
                "unit": "м2",
                "plannedQty": 11,
                "sectionTitle": "Old section",
                "expectedKind": "work",
            },
            role="foreman",
        )
        purchaser = self.update(
            self.material_id,
            {
                "title": "Purchaser material",
                "unit": "шт",
                "plannedQty": 6,
                "sectionTitle": "Old section",
                "expectedKind": "material",
            },
            role="purchaser",
        )

        self.assertEqual(foreman.status, HTTPStatus.OK)
        self.assertEqual(purchaser.status, HTTPStatus.FORBIDDEN)
        with server.db() as con:
            work_title = con.execute("SELECT title FROM estimate_items WHERE id = ?", (self.work_id,)).fetchone()[0]
            material_title = con.execute("SELECT title FROM estimate_items WHERE id = ?", (self.material_id,)).fetchone()[0]
        self.assertEqual(work_title, "Foreman work")
        self.assertEqual(material_title, "Old material")


if __name__ == "__main__":
    unittest.main()
