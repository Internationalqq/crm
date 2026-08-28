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
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        server.DB_PATH = Path(self.temp_dir.name) / "position-update.sqlite3"
        server.BOOTSTRAP_PATH = Path(self.temp_dir.name) / "INITIAL_ADMIN.txt"
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
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
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

    def import_estimate(self, payload: dict) -> FakePositionHandler:
        handler = FakePositionHandler(self.user("admin"), payload)
        server.PMBIHandler.api_import_estimate(
            handler,
            f"/api/projects/{self.project_id}/estimate-import",
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
                "SELECT title, planned_qty, planned_price, item_kind, item_kind_override FROM estimate_items WHERE id = ?",
                (self.material_id,),
            ).fetchone()
        self.assertEqual(tuple(row), ("New material", 7, 250, "material", None))

    def test_admin_can_update_price_with_before_after_audit(self) -> None:
        handler = self.update(
            self.work_id,
            {
                "title": "Old work",
                "unit": "м2",
                "plannedQty": 10,
                "plannedPrice": "12,50",
                "sectionTitle": "Old section",
                "expectedKind": "work",
            },
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        with server.db() as con:
            row = con.execute(
                "SELECT planned_price FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()
            audit = con.execute(
                "SELECT payload FROM audit_log WHERE entity = 'estimate_item' AND entity_id = ? ORDER BY id DESC LIMIT 1",
                (self.work_id,),
            ).fetchone()
        self.assertEqual(row["planned_price"], 12.5)
        self.assertIn('"planned_price": 125.0', audit["payload"])
        self.assertIn('"planned_price": 12.5', audit["payload"])

    def test_foreman_cannot_update_price(self) -> None:
        handler = self.update(
            self.work_id,
            {
                "title": "Old work",
                "unit": "м2",
                "plannedQty": 10,
                "plannedPrice": 1,
                "sectionTitle": "Old section",
                "expectedKind": "work",
            },
            role="foreman",
        )

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response["error"], "price_fields_forbidden")
        with server.db() as con:
            price = con.execute(
                "SELECT planned_price FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()[0]
        self.assertEqual(price, 125)

    def test_price_must_be_finite_and_nonnegative(self) -> None:
        for value in ("not-a-number", "NaN", "Infinity", -1):
            with self.subTest(value=value):
                handler = self.update(
                    self.work_id,
                    {
                        "title": "Old work",
                        "unit": "м2",
                        "plannedQty": 10,
                        "plannedPrice": value,
                        "sectionTitle": "Old section",
                        "expectedKind": "work",
                    },
                )
                self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(handler.response["error"], "estimate_position_price_invalid")
        with server.db() as con:
            price = con.execute(
                "SELECT planned_price FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()[0]
        self.assertEqual(price, 125)

    def test_clean_material_can_move_to_work_and_manual_type_beats_fsbc_heuristic(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            con.execute(
                "INSERT INTO market_analysis_cache (project_id, kind, status, payload, updated_at) VALUES (?, 'material', 'ready', '{}', ?)",
                (self.project_id, timestamp),
            )
            con.execute(
                "INSERT INTO material_schedule_snapshots (project_id, payload, created_by, created_at, updated_at) VALUES (?, '{}', ?, ?, ?)",
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            con.commit()

        handler = self.update(
            self.material_id,
            {
                "title": "ФСБЦ-1 ошибочно распознано",
                "unit": "ч",
                "plannedQty": 5,
                "sectionTitle": "Монтаж",
                "expectedKind": "material",
                "targetKind": "work",
            },
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertTrue(handler.response["kindChanged"])
        self.assertEqual(handler.response["previousItemKind"], "material")
        self.assertEqual(handler.response["itemKind"], "work")
        self.assertEqual(handler.response["item"]["itemKind"], "work")
        self.assertEqual(handler.response["itemKindSource"], "manual")
        with server.db() as con:
            row = con.execute(
                "SELECT item_kind, item_kind_override, planned_price FROM estimate_items WHERE id = ?",
                (self.material_id,),
            ).fetchone()
            audit = con.execute(
                "SELECT action FROM audit_log WHERE entity = 'estimate_item' AND entity_id = ? ORDER BY id DESC LIMIT 1",
                (self.material_id,),
            ).fetchone()
            self.assertEqual(con.execute("SELECT COUNT(*) FROM market_analysis_cache WHERE project_id = ?", (self.project_id,)).fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM material_schedule_snapshots WHERE project_id = ?", (self.project_id,)).fetchone()[0], 0)
        self.assertEqual(tuple(row), ("work", "work", 250))
        self.assertEqual(audit["action"], "change_estimate_position_kind")

    def test_clean_work_can_move_to_material_and_manual_type_beats_gesn_heuristic(self) -> None:
        with server.db() as con:
            con.execute("UPDATE estimate_items SET actual_qty = 0, is_completed = 0 WHERE id = ?", (self.work_id,))
            con.commit()

        handler = self.update(
            self.work_id,
            {
                "title": "ГЭСН 01-01 ошибочно распознано",
                "unit": "шт",
                "plannedQty": 10,
                "sectionTitle": "Поставка",
                "expectedKind": "work",
                "targetKind": "material",
            },
        )

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["itemKind"], "material")
        self.assertEqual(handler.response["item"]["itemKind"], "material")
        with server.db() as con:
            row = con.execute(
                "SELECT item_kind, item_kind_override, planned_price FROM estimate_items WHERE id = ?",
                (self.work_id,),
            ).fetchone()
        self.assertEqual(tuple(row), ("material", "material", 125))

    def test_kind_change_is_blocked_when_material_has_stock_history(self) -> None:
        with server.db() as con:
            con.execute(
                "INSERT INTO stock_moves (project_id, estimate_item_id, move_type, qty, price, comment, created_by, created_at) VALUES (?, ?, 'purchase', 1, 0, '', ?, ?)",
                (self.project_id, self.material_id, self.admin_id, server.now_ts()),
            )
            con.commit()

        handler = self.update(
            self.material_id,
            {
                "title": "Blocked material",
                "unit": "шт",
                "plannedQty": 5,
                "sectionTitle": "Old section",
                "expectedKind": "material",
                "targetKind": "work",
            },
        )

        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response["error"], "estimate_position_kind_change_blocked")
        self.assertIn("stock_moves", {item["code"] for item in handler.response["blockers"]})
        with server.db() as con:
            row = con.execute("SELECT title, item_kind, item_kind_override FROM estimate_items WHERE id = ?", (self.material_id,)).fetchone()
            audits = con.execute("SELECT COUNT(*) FROM audit_log WHERE entity = 'estimate_item' AND entity_id = ?", (self.material_id,)).fetchone()[0]
        self.assertEqual(tuple(row), ("Old material", "material", None))
        self.assertEqual(audits, 0)

    def test_work_with_recorded_progress_cannot_move_to_material(self) -> None:
        handler = self.update(
            self.work_id,
            {
                "title": "Blocked work",
                "unit": "м2",
                "plannedQty": 10,
                "sectionTitle": "Old section",
                "expectedKind": "work",
                "targetKind": "material",
            },
        )

        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertIn("recorded_progress", {item["code"] for item in handler.response["blockers"]})

    def test_invalid_target_kind_is_rejected(self) -> None:
        handler = self.update(
            self.material_id,
            {"expectedKind": "material", "targetKind": "something-else"},
        )

        self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(handler.response["error"], "bad_estimate_position_kind")
        with server.db() as con:
            row = con.execute("SELECT item_kind, item_kind_override FROM estimate_items WHERE id = ?", (self.material_id,)).fetchone()
        self.assertEqual(tuple(row), ("material", None))

    def test_manual_kind_survives_both_reimport_paths(self) -> None:
        source = {"sourceType": "manual", "sourceKey": "kind-override-test", "title": "Override test"}
        item = {
            "sourceItemKey": "row-1",
            "title": "Imported material",
            "unit": "шт",
            "planned_qty": 2,
            "planned_price": 10,
            "item_kind": "material",
            "section_title": "Import",
        }
        first_import = self.import_estimate({"source": source, "items": [item]})
        self.assertEqual(first_import.status, HTTPStatus.CREATED)
        with server.db() as con:
            imported_id = int(con.execute(
                "SELECT id FROM estimate_items WHERE project_id = ? AND source_item_key = 'row-1'",
                (self.project_id,),
            ).fetchone()[0])

        moved = self.update(
            imported_id,
            {
                "title": "Imported work",
                "unit": "ч",
                "plannedQty": 2,
                "sectionTitle": "Import",
                "expectedKind": "material",
                "targetKind": "work",
            },
        )
        self.assertEqual(moved.status, HTTPStatus.OK)

        second_item = dict(item, title="Imported again", item_kind="material")
        second_import = self.import_estimate({"source": source, "items": [second_item]})
        self.assertEqual(second_import.status, HTTPStatus.CREATED)
        bootstrap_handler = FakePositionHandler(
            self.user("admin"),
            {
                "replaceExisting": False,
                "source": source,
                "materials": [dict(second_item, title="Bootstrap again")],
            },
        )
        server.PMBIHandler.api_project_bootstrap(
            bootstrap_handler,
            f"/api/projects/{self.project_id}/bootstrap",
        )
        self.assertEqual(bootstrap_handler.status, HTTPStatus.OK)

        with server.db() as con:
            row = con.execute(
                "SELECT item_kind, item_kind_override FROM estimate_items WHERE id = ?",
                (imported_id,),
            ).fetchone()
        self.assertEqual(tuple(row), ("work", "work"))

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
