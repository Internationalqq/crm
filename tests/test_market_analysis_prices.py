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

import auth  # noqa: E402
import server  # noqa: E402
import warehouse  # noqa: E402


class FakeSupplierHandler:
    def __init__(self, user: dict, payload: dict):
        self.user = user
        self.payload = payload
        self.status = None
        self.response = None

    def require_project_access(self, project_id: int) -> dict:
        return self.user

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class MarketAnalysisPriceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_warehouse_db = warehouse.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        server.DB_PATH = Path(self.temp_dir.name) / "price-analysis.sqlite3"
        warehouse.DB_PATH = server.DB_PATH
        server.BOOTSTRAP_PATH = Path(self.temp_dir.name) / "INITIAL_ADMIN.txt"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            project_cur = con.execute(
                """
                INSERT INTO projects (title, address, client_name, status, created_at, contract_no)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                ("Price project", "Test address", "Test client", "active", server.now_ts(), "ESTIMATE-price-test"),
            )
            self.project_id = int(project_cur.lastrowid)
            item_cur = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind, section_title
                )
                VALUES (?, ?, ?, ?, ?, 'material', ?)
                """,
                (self.project_id, "Tile", "m2", 10, 100, "Finishing"),
            )
            self.item_id = int(item_cur.lastrowid)
            active_cur = con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_type, candidate_name, source_type,
                    price, qty, unit, status, created_by, activated_by, activated_at, created_at, updated_at
                )
                VALUES (?, ?, 'supplier', ?, 'manual', ?, ?, ?, 'selected', ?, ?, ?, ?, ?)
                """,
                (
                    self.project_id,
                    self.item_id,
                    "Active supplier",
                    75,
                    10,
                    "m2",
                    self.admin_id,
                    self.admin_id,
                    server.now_ts(),
                    server.now_ts(),
                    server.now_ts(),
                ),
            )
            self.active_offer_id = int(active_cur.lastrowid)
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        warehouse.DB_PATH = self.original_warehouse_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        gc.collect()
        self.temp_dir.cleanup()

    def _approve_procurement_limit(self, limit_net_kopecks: int = 60000, quantity: float = 10) -> int:
        with server.db() as con:
            timestamp = server.now_ts()
            baseline = con.execute(
                """
                INSERT INTO project_financial_baselines (
                    project_id, version_no, status, currency_code, source_snapshot_hash,
                    reason, created_by, created_at, updated_at
                )
                VALUES (?, 1, 'draft', 'RUB', 'sha256:limit-test', 'Procurement limit', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            baseline_id = int(baseline.lastrowid)
            con.execute(
                """
                INSERT INTO project_revenue_lines (
                    baseline_id, position, estimate_item_id, title, unit, quantity,
                    unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                    vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                    source_type, source_reference, created_by, created_at
                )
                VALUES (?, 1, ?, 'Contract revenue', 'm2', 10, 10000, 100000,
                        0, 0, 100000, 'no_vat', 'estimate', 'estimate:test', ?, ?)
                """,
                (baseline_id, self.item_id, self.admin_id, timestamp),
            )
            unit_limit = int(round(limit_net_kopecks / quantity))
            con.execute(
                """
                INSERT INTO project_budget_lines (
                    baseline_id, position, line_type, cost_code, estimate_item_id,
                    title, unit, quantity, unit_cost_net_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                    source_vat_mode, source_type, source_reference, created_by, created_at
                )
                VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Purchase ceiling', 'm2', ?, ?, ?,
                        0, 0, ?, 'no_vat', 'manual', 'limit:test', ?, ?)
                """,
                (
                    baseline_id,
                    self.item_id,
                    quantity,
                    unit_limit,
                    limit_net_kopecks,
                    limit_net_kopecks,
                    self.admin_id,
                    timestamp,
                ),
            )
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, baseline_id),
            )
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'approved', approved_by = ?, approved_at = ?,
                    effective_from = '2026-08-21', updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, baseline_id),
            )
            con.commit()
        return baseline_id

    def test_margin_formula_boundaries(self) -> None:
        cases = [
            (100, 75, 25.0),
            (100, 125, -25.0),
            (100, 100, 0.0),
            (100, 0, 100.0),
            (0, 75, None),
            (100, None, None),
            ("bad", 75, None),
        ]
        for estimate_price, entered_price, expected in cases:
            with self.subTest(estimate_price=estimate_price, entered_price=entered_price):
                self.assertEqual(
                    server.calculate_margin_percent(estimate_price, entered_price),
                    expected,
                )

    def test_market_snapshot_persists_price_source_date_and_estimate_version(self) -> None:
        market_rows = [
            {
                "positionIndex": None,
                "title": "Tile",
                "titleKey": server.normalize_market_title_key("Tile"),
                "marketType": "material",
                "marketPrice": 80,
                "marketPriceText": "80",
                "offers": [
                    {
                        "title": "AI supplier",
                        "domain": "supplier.example",
                        "url": "https://supplier.example/tile",
                        "price": 80,
                    }
                ],
                "statusNote": "",
            }
        ]

        with server.db() as con:
            payload = server.build_project_market_analysis(
                con,
                self.project_id,
                "material",
                market_rows=market_rows,
            )
            saved = server.save_market_price_snapshots(con, payload)
            con.commit()

            self.assertEqual(saved, 1)
            row = payload["rows"][0]
            self.assertEqual(row["estimateUnitPrice"], 100)
            self.assertEqual(row["marketPrice"], 80)
            self.assertEqual(row["enteredPrice"], 75)
            self.assertEqual(row["marginPercent"], 25.0)
            self.assertEqual(row["activeOffer"]["id"], self.active_offer_id)
            self.assertTrue(row["marketPriceIsFresh"])
            self.assertTrue(payload["estimateVersion"].startswith("sha256:"))

            snapshot = con.execute(
                "SELECT * FROM market_price_snapshots WHERE estimate_item_id = ?",
                (self.item_id,),
            ).fetchone()
            self.assertIsNotNone(snapshot)
            self.assertEqual(float(snapshot["price"]), 80)
            self.assertEqual(snapshot["source_name"], "supplier.example")
            self.assertEqual(snapshot["source_url"], "https://supplier.example/tile")
            self.assertEqual(snapshot["estimate_version"], payload["estimateVersion"])
            self.assertGreater(int(snapshot["analyzed_at"]), 0)

            fallback = server.build_project_market_analysis(
                con,
                self.project_id,
                "material",
                market_rows=[],
            )
            fallback_row = fallback["rows"][0]
            self.assertEqual(fallback_row["marketPrice"], 80)
            self.assertTrue(fallback_row["marketPriceIsStale"])
            self.assertEqual(fallback_row["marketEstimateVersion"], payload["estimateVersion"])

    def test_restricted_payload_contains_only_position_identity(self) -> None:
        with server.db() as con:
            payload = server.restricted_market_analysis_payload(
                con,
                self.project_id,
                "material",
                can_submit_price=True,
            )

        self.assertEqual(payload["status"], "restricted")
        self.assertTrue(payload["canSubmitPrice"])
        self.assertEqual(
            set(payload["rows"][0]),
            {"estimateItemId", "title"},
        )
        self.assertFalse(auth.payload_has_procurement_prices(payload))

        restricted_handler = FakeSupplierHandler(
            {
                "id": self.admin_id,
                "role": "purchaser",
                "roles": [],
                "permissions": {"suppliers": "edit"},
            },
            {},
        )
        warehouse.api_project_supplier_offers(
            restricted_handler,
            f"/api/projects/{self.project_id}/supplier-offers",
        )
        self.assertEqual(restricted_handler.status, HTTPStatus.OK)
        self.assertEqual(restricted_handler.response["offers"], [])
        self.assertEqual(restricted_handler.response["history"], [])
        self.assertFalse(auth.payload_has_procurement_prices(restricted_handler.response))

    def test_procurement_limit_warns_and_requires_override_reason(self) -> None:
        baseline_id = self._approve_procurement_limit(60000, 10)
        with server.db() as con:
            payload = server.build_project_market_analysis(
                con,
                self.project_id,
                "material",
                market_rows=[],
            )
        limit = payload["rows"][0]["procurementLimit"]
        self.assertTrue(limit["configured"])
        self.assertEqual(limit["baselineId"], baseline_id)
        self.assertEqual(limit["status"], "exceeded")
        self.assertEqual(limit["limitNetKopecks"], 60000)
        self.assertEqual(limit["offerAmountKopecks"], 75000)
        self.assertEqual(limit["overrunKopecks"], 15000)
        self.assertEqual(limit["reasonHint"], "price_over_limit")

        foreman = {
            "id": self.admin_id,
            "role": "foreman",
            "roles": [],
            "permissions": {"suppliers": "edit"},
        }
        create_handler = FakeSupplierHandler(
            foreman,
            {"estimate_item_id": self.item_id, "candidate_name": "Over limit", "price": 70, "qty": 10},
        )
        warehouse.api_create_supplier_offer(
            create_handler,
            f"/api/projects/{self.project_id}/supplier-offers",
        )
        self.assertEqual(create_handler.status, HTTPStatus.CREATED)
        self.assertNotIn("limitCheck", create_handler.response)
        offer_id = int(create_handler.response["id"])

        director = {
            "id": self.admin_id,
            "role": "director",
            "roles": [],
            "permissions": {"fullAccess": True},
        }
        rejected = FakeSupplierHandler(director, {"status": "selected"})
        warehouse.api_update_supplier_offer(rejected, f"/api/supplier-offers/{offer_id}/update")
        self.assertEqual(rejected.status, HTTPStatus.CONFLICT)
        self.assertEqual(rejected.response["error"], "procurement_limit_exceeded")
        self.assertEqual(rejected.response["limitCheck"]["overrunKopecks"], 10000)

        approved = FakeSupplierHandler(
            director,
            {"status": "selected", "limitOverrideReason": "Дополнительный объём согласован"},
        )
        warehouse.api_update_supplier_offer(approved, f"/api/supplier-offers/{offer_id}/update")
        self.assertEqual(approved.status, HTTPStatus.OK)
        with server.db() as con:
            actions = [
                row["action"]
                for row in con.execute(
                    "SELECT action FROM supplier_offer_events WHERE supplier_offer_id = ? ORDER BY id",
                    (offer_id,),
                ).fetchall()
            ]
        self.assertEqual(actions, ["created", "activated", "limit_override"])

    def test_multiple_offers_keep_one_active_and_record_history(self) -> None:
        restricted_user = {
            "id": self.admin_id,
            "role": "foreman",
            "roles": [],
            "permissions": {"suppliers": "edit"},
        }
        create_handler = FakeSupplierHandler(
            restricted_user,
            {
                "estimate_item_id": self.item_id,
                "candidate_type": "supplier",
                "candidate_name": "Second supplier",
                "price": 70,
                "qty": 10,
                "unit": "m2",
                "status": "selected",
            },
        )
        warehouse.api_create_supplier_offer(
            create_handler,
            f"/api/projects/{self.project_id}/supplier-offers",
        )
        self.assertEqual(create_handler.status, HTTPStatus.CREATED)
        second_offer_id = int(create_handler.response["id"])

        with server.db() as con:
            second = con.execute("SELECT status FROM supplier_offers WHERE id = ?", (second_offer_id,)).fetchone()
            self.assertEqual(second["status"], "quoted")
            created_event = con.execute(
                "SELECT action, actor_id FROM supplier_offer_events WHERE supplier_offer_id = ?",
                (second_offer_id,),
            ).fetchone()
            self.assertEqual(created_event["action"], "created")
            self.assertEqual(int(created_event["actor_id"]), self.admin_id)

        director_user = {
            "id": self.admin_id,
            "role": "director",
            "roles": [],
            "permissions": {"fullAccess": True},
        }
        activate_handler = FakeSupplierHandler(director_user, {"status": "selected"})
        warehouse.api_update_supplier_offer(
            activate_handler,
            f"/api/supplier-offers/{second_offer_id}/update",
        )
        self.assertEqual(activate_handler.status, HTTPStatus.OK)

        with server.db() as con:
            active = con.execute(
                "SELECT id FROM supplier_offers WHERE estimate_item_id = ? AND status = 'selected'",
                (self.item_id,),
            ).fetchall()
            self.assertEqual([int(row["id"]) for row in active], [second_offer_id])
            actions = [
                row["action"]
                for row in con.execute(
                    "SELECT action FROM supplier_offer_events WHERE supplier_offer_id = ? ORDER BY id",
                    (second_offer_id,),
                ).fetchall()
            ]
            self.assertEqual(actions, ["created", "activated"])
            old_actions = [
                row["action"]
                for row in con.execute(
                    "SELECT action FROM supplier_offer_events WHERE supplier_offer_id = ? ORDER BY id",
                    (self.active_offer_id,),
                ).fetchall()
            ]
            self.assertIn("deactivated", old_actions)

            with self.assertRaises(sqlite3.IntegrityError):
                con.execute(
                    """
                    INSERT INTO supplier_offers (
                        project_id, estimate_item_id, candidate_type, candidate_name, source_type,
                        price, qty, status, created_at, updated_at
                    )
                    VALUES (?, ?, 'supplier', 'Third supplier', 'manual', 60, 10, 'selected', ?, ?)
                    """,
                    (self.project_id, self.item_id, server.now_ts(), server.now_ts()),
                )

    def test_init_migrates_legacy_duplicate_active_offers_before_unique_index(self) -> None:
        with server.db() as con:
            con.execute("DROP INDEX idx_supplier_offers_one_active_per_item")
            duplicate = con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_type, candidate_name, source_type,
                    price, qty, status, created_by, created_at, updated_at
                )
                VALUES (?, ?, 'supplier', 'Legacy duplicate', 'manual', 65, 10, 'selected', ?, ?, ?)
                """,
                (self.project_id, self.item_id, self.admin_id, server.now_ts(), server.now_ts()),
            )
            duplicate_id = int(duplicate.lastrowid)
            con.commit()

        server.init_db()

        with server.db() as con:
            active_ids = [
                int(row["id"])
                for row in con.execute(
                    "SELECT id FROM supplier_offers WHERE estimate_item_id = ? AND status = 'selected'",
                    (self.item_id,),
                ).fetchall()
            ]
            self.assertEqual(active_ids, [duplicate_id])
            self.assertEqual(
                con.execute("SELECT status FROM supplier_offers WHERE id = ?", (self.active_offer_id,)).fetchone()["status"],
                "quoted",
            )
            self.assertIsNotNone(
                con.execute(
                    "SELECT 1 FROM supplier_offer_events WHERE supplier_offer_id = ? AND action = 'activated'",
                    (duplicate_id,),
                ).fetchone()
            )
            self.assertIsNotNone(
                con.execute(
                    "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_supplier_offers_one_active_per_item'"
                ).fetchone()
            )


if __name__ == "__main__":
    unittest.main()
