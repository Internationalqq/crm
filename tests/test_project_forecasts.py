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

import economics  # noqa: E402
import economics_workflow  # noqa: E402
import server  # noqa: E402


class FakeHandler:
    def __init__(self, user: dict, payload: dict | None = None):
        self.user = user
        self.payload = payload or {}
        self.status: int | None = None
        self.response: dict | None = None

    def require_project_access(self, project_id: int) -> dict:
        return self.user

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class ProjectForecastTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "project-forecasts.sqlite3"
        server.DB_PATH = test_db
        economics.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            timestamp = server.now_ts()
            project_cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                ) VALUES ('Forecast project', 'Address', 'Client', 'active',
                          987654.32, 12345.67, 7654.32, ?)
                """,
                (timestamp,),
            )
            self.project_id = int(project_cursor.lastrowid)
            item_cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Concrete', 'm3', 2, 150, 'material')
                """,
                (self.project_id,),
            )
            self.estimate_item_id = int(item_cursor.lastrowid)
            self.baseline_id, self.revenue_line_id, self.budget_line_id = (
                self._create_approved_baseline(con)
            )
            document_cursor = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, uploaded_by, created_at, updated_at
                ) VALUES (?, 'Accepted material act', 'service_act', 'accepted', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            self.accepted_document_id = int(document_cursor.lastrowid)
            con.commit()

        self.admin_user = {"id": self.admin_id, "role": "admin", "roles": []}
        self.legacy_values = self._legacy_values()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        economics.DB_PATH = self.original_economics_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _create_approved_baseline(
        self,
        con: sqlite3.Connection,
        *,
        project_id: int | None = None,
        estimate_item_id: int | None = None,
        version_no: int = 1,
        revenue_net: int = 30000,
        target_net: int = 20000,
    ) -> tuple[int, int, int]:
        project_id = project_id or self.project_id
        estimate_item_id = estimate_item_id or self.estimate_item_id
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, source_snapshot_hash,
                reason, created_by, created_at, updated_at
            ) VALUES (?, ?, 'draft', 'RUB', ?, 'Forecast test baseline', ?, ?, ?)
            """,
            (
                project_id,
                version_no,
                f"sha256:forecast-baseline-{project_id}-{version_no}",
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        baseline_id = int(cursor.lastrowid)
        revenue_cursor = con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, estimate_item_id, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, ?, 'Contract revenue', 'm3', 2, ?, ?, 0, 0, ?,
                      'no_vat', 'contract', 'contract:test', ?, ?)
            """,
            (
                baseline_id,
                estimate_item_id,
                revenue_net // 2,
                revenue_net,
                revenue_net,
                self.admin_id,
                timestamp,
            ),
        )
        budget_cursor = con.execute(
            """
            INSERT INTO project_budget_lines (
                baseline_id, position, line_type, cost_code, estimate_item_id,
                title, unit, quantity, unit_cost_net_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                source_vat_mode, source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Concrete target', 'm3', 2,
                      ?, ?, 0, 0, ?, 'no_vat', 'estimate', 'estimate:budget:1', ?, ?)
            """,
            (
                baseline_id,
                estimate_item_id,
                target_net // 2,
                target_net,
                target_net,
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
                effective_from = '2026-08-20', updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )
        return baseline_id, int(revenue_cursor.lastrowid), int(budget_cursor.lastrowid)

    def _create_approved_commitment(
        self,
        *,
        quantity: float = 2,
        unit_net_kopecks: int = 10000,
        supplier_offer_id: int | None = None,
    ) -> tuple[int, int]:
        with server.db() as con:
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO project_commitments (
                    project_id, baseline_id, commitment_type, commitment_no, status,
                    currency_code, counterparty_name, reason, created_by, created_at, updated_at
                ) VALUES (?, ?, 'purchase_order', ?, 'draft', 'RUB',
                          'Supplier', 'Approved forecast commitment', ?, ?, ?)
                """,
                (
                    self.project_id,
                    self.baseline_id,
                    f"PO-{timestamp}-{quantity}",
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            commitment_id = int(cursor.lastrowid)
            net_amount = int(quantity * unit_net_kopecks)
            line_cursor = con.execute(
                """
                INSERT INTO project_commitment_lines (
                    commitment_id, position, budget_line_id, estimate_item_id,
                    supplier_offer_id, title, unit, quantity,
                    source_unit_price_kopecks, unit_cost_net_kopecks,
                    net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, source_reference,
                    created_by, created_at
                ) VALUES (?, 1, ?, ?, ?, 'Concrete order', 'm3', ?, ?, ?, ?,
                          0, 0, ?, 'no_vat', 'purchase-order:test', ?, ?)
                """,
                (
                    commitment_id,
                    self.budget_line_id,
                    self.estimate_item_id,
                    supplier_offer_id,
                    quantity,
                    unit_net_kopecks,
                    unit_net_kopecks,
                    net_amount,
                    net_amount,
                    self.admin_id,
                    timestamp,
                ),
            )
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, commitment_id),
            )
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, commitment_id),
            )
            con.commit()
        return commitment_id, int(line_cursor.lastrowid)

    def _create_approved_actual(
        self,
        *,
        quantity: float,
        net_amount_kopecks: int,
        commitment_id: int | None = None,
        commitment_line_id: int | None = None,
    ) -> int:
        with server.db() as con:
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO project_actual_cost_entries (
                    project_id, baseline_id, budget_line_id, commitment_id,
                    commitment_line_id, estimate_item_id, cost_category, entry_kind,
                    source_type, source_event_key, title, recognition_date, unit,
                    document_id,
                    quantity, source_unit_price_kopecks, unit_cost_net_kopecks,
                    net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, valuation_method,
                    source_reference, reason, status, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'material', 'cost', 'manual_expense', ?,
                          'Accepted concrete', '2026-08-20', 'm3', ?, ?, ?, ?, ?, 0, 0, ?,
                          'no_vat', 'source_document', 'acceptance:test',
                          'Accepted work/material', 'draft', ?, ?, ?)
                """,
                (
                    self.project_id,
                    self.baseline_id,
                    self.budget_line_id,
                    commitment_id,
                    commitment_line_id,
                    self.estimate_item_id,
                    f"forecast-actual:{timestamp}:{quantity}",
                    self.accepted_document_id,
                    quantity,
                    int(net_amount_kopecks / quantity),
                    int(net_amount_kopecks / quantity),
                    net_amount_kopecks,
                    net_amount_kopecks,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            entry_id = int(cursor.lastrowid)
            con.execute(
                """
                UPDATE project_actual_cost_entries
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, entry_id),
            )
            con.execute(
                """
                UPDATE project_actual_cost_entries
                SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, entry_id),
            )
            con.commit()
        return entry_id

    def _insert_offer(self, *, price: float, quantity: float = 2) -> int:
        with server.db() as con:
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_name, source_type,
                    price, qty, unit, status, created_by, activated_by,
                    activated_at, created_at, updated_at
                ) VALUES (?, ?, 'Selected supplier', 'manual', ?, ?, 'm3', 'selected',
                          ?, ?, ?, ?, ?)
                """,
                (
                    self.project_id,
                    self.estimate_item_id,
                    price,
                    quantity,
                    self.admin_id,
                    self.admin_id,
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )
            con.commit()
            return int(cursor.lastrowid)

    def _insert_market_snapshot(self, *, price: float, analyzed_at: int | None = None) -> int:
        with server.db() as con:
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO market_price_snapshots (
                    project_id, estimate_item_id, estimate_item_title, item_kind,
                    estimate_version, source_estimate_id, price, source_name,
                    source_payload, analyzed_at, created_at
                ) VALUES (?, ?, 'Concrete', 'material', 'estimate-v1', 'estimate:test',
                          ?, 'AutoBot', '[]', ?, ?)
                """,
                (
                    self.project_id,
                    self.estimate_item_id,
                    price,
                    analyzed_at or timestamp,
                    timestamp,
                ),
            )
            con.commit()
            return int(cursor.lastrowid)

    def _calculate(self, payload: dict | None = None) -> FakeHandler:
        request = {"reason": "Periodic forecast calculation"}
        request.update(payload or {})
        handler = FakeHandler(self.admin_user, request)
        economics.api_calculate_project_forecast(
            handler, f"/api/projects/{self.project_id}/forecasts/calculate"
        )
        return handler

    def _submit_and_approve(self, forecast_id: int) -> None:
        submit = FakeHandler(self.admin_user)
        economics.api_submit_project_forecast(
            submit, f"/api/forecasts/{forecast_id}/submit"
        )
        self.assertEqual(submit.status, HTTPStatus.OK, submit.response)
        approve = FakeHandler(self.admin_user)
        economics.api_approve_project_forecast(
            approve, f"/api/forecasts/{forecast_id}/approve"
        )
        self.assertEqual(approve.status, HTTPStatus.OK, approve.response)

    def _get_economics(self, user: dict | None = None) -> FakeHandler:
        handler = FakeHandler(user or self.admin_user)
        economics.api_project_economics(
            handler, f"/api/projects/{self.project_id}/economics"
        )
        return handler

    def _legacy_values(self) -> tuple:
        with server.db() as con:
            project = tuple(
                con.execute(
                    "SELECT quote(budget), quote(paid), quote(spent) FROM projects WHERE id = ?",
                    (self.project_id,),
                ).fetchone()
            )
            item = tuple(
                con.execute(
                    "SELECT quote(planned_price) FROM estimate_items WHERE id = ?",
                    (self.estimate_item_id,),
                ).fetchone()
            )
        return project, item

    def test_target_budget_forecast_formula_and_official_version_lifecycle(self) -> None:
        calculated = self._calculate()
        self.assertEqual(calculated.status, HTTPStatus.CREATED, calculated.response)
        forecast = calculated.response["forecast"]
        self.assertEqual(forecast["status"], "draft")
        self.assertEqual(forecast["contractRevenueNetKopecks"], 30000)
        self.assertEqual(forecast["targetCostNetKopecks"], 20000)
        self.assertEqual(forecast["actualCostNetKopecks"], 0)
        self.assertEqual(forecast["etcNetKopecks"], 20000)
        self.assertEqual(forecast["eacNetKopecks"], 20000)
        self.assertEqual(forecast["forecastMarginNetKopecks"], 10000)
        self.assertEqual(forecast["forecastMarginPercent"], 33.33)
        self.assertEqual(forecast["forecastMarginColor"], "positive")
        self.assertEqual(forecast["budgetVarianceNetKopecks"], 0)
        self.assertEqual(
            [component["sourceType"] for component in forecast["components"]],
            ["target_budget"],
        )

        before_approval = self._get_economics()
        self.assertEqual(before_approval.status, HTTPStatus.OK)
        self.assertEqual(before_approval.response["forecastStatus"], "not_calculated")
        self.assertIsNone(before_approval.response["forecast"])

        self._submit_and_approve(forecast["id"])
        after_approval = self._get_economics()
        self.assertEqual(after_approval.response["forecastStatus"], "approved")
        self.assertEqual(after_approval.response["forecast"]["versionNo"], 1)

    def test_acceptance_moves_commitment_to_actual_without_double_counting_eac(self) -> None:
        commitment_id, commitment_line_id = self._create_approved_commitment()
        before = self._calculate().response["forecast"]
        self.assertEqual(before["actualCostNetKopecks"], 0)
        self.assertEqual(before["etcNetKopecks"], 20000)
        self.assertEqual(before["eacNetKopecks"], 20000)
        self.assertEqual(before["components"][0]["sourceType"], "approved_commitment")

        self._create_approved_actual(
            quantity=1,
            net_amount_kopecks=10000,
            commitment_id=commitment_id,
            commitment_line_id=commitment_line_id,
        )
        after = self._calculate().response["forecast"]
        self.assertEqual(after["actualCostNetKopecks"], 10000)
        self.assertEqual(after["etcNetKopecks"], 10000)
        self.assertEqual(after["eacNetKopecks"], 20000)
        self.assertEqual(after["components"][0]["netAmountKopecks"], 10000)
        self.assertEqual(after["components"][0]["quantity"], 1.0)

    def test_source_priority_capacity_and_explicit_vat_normalization(self) -> None:
        offer_id = self._insert_offer(price=90, quantity=1)
        snapshot_id = self._insert_market_snapshot(price=80)

        missing_vat = self._calculate()
        self.assertEqual(missing_vat.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            missing_vat.response,
            {
                "error": "forecast_price_normalization_required",
                "sourceType": "supplier_offer",
                "sourceId": offer_id,
            },
        )

        calculated = self._calculate(
            {
                "priceNormalizations": [
                    {
                        "sourceType": "supplier_offer",
                        "sourceId": offer_id,
                        "vatMode": "no_vat",
                        "vatRateBasisPoints": 0,
                    },
                    {
                        "sourceType": "market_snapshot",
                        "sourceId": snapshot_id,
                        "vatMode": "no_vat",
                        "vatRateBasisPoints": 0,
                    },
                ]
            }
        )
        self.assertEqual(calculated.status, HTTPStatus.CREATED, calculated.response)
        forecast = calculated.response["forecast"]
        self.assertEqual(forecast["etcNetKopecks"], 17000)
        self.assertEqual(forecast["eacNetKopecks"], 17000)
        self.assertEqual(forecast["forecastMarginNetKopecks"], 13000)
        self.assertEqual(
            [component["sourceType"] for component in forecast["components"]],
            ["active_supplier_offer", "autobot_snapshot"],
        )
        self.assertEqual(
            [component["quantity"] for component in forecast["components"]],
            [1.0, 1.0],
        )

    def test_latest_market_snapshot_is_chosen_by_analysis_time_not_insert_id(self) -> None:
        newer_id = self._insert_market_snapshot(price=70, analyzed_at=200)
        self._insert_market_snapshot(price=999, analyzed_at=100)
        calculated = self._calculate(
            {
                "priceNormalizations": [
                    {
                        "sourceType": "market_snapshot",
                        "sourceId": newer_id,
                        "vatMode": "no_vat",
                        "vatRateBasisPoints": 0,
                    }
                ]
            }
        )
        self.assertEqual(calculated.status, HTTPStatus.CREATED, calculated.response)
        forecast = calculated.response["forecast"]
        self.assertEqual(forecast["etcNetKopecks"], 14000)
        self.assertEqual(forecast["components"][0]["marketSnapshotId"], newer_id)

    def test_supplier_offer_gross_price_is_normalized_to_management_net(self) -> None:
        offer_id = self._insert_offer(price=120, quantity=2)
        calculated = self._calculate(
            {
                "priceNormalizations": [
                    {
                        "sourceType": "supplier_offer",
                        "sourceId": offer_id,
                        "vatMode": "gross",
                        "vatRateBasisPoints": 2000,
                    }
                ]
            }
        )
        self.assertEqual(calculated.status, HTTPStatus.CREATED, calculated.response)
        forecast = calculated.response["forecast"]
        component = forecast["components"][0]
        self.assertEqual(component["rawUnitPriceKopecks"], 12000)
        self.assertEqual(component["unitCostNetKopecks"], 10000)
        self.assertEqual(forecast["etcNetKopecks"], 20000)
        self.assertEqual(forecast["eacNetKopecks"], 20000)
        self.assertEqual(forecast["forecastMarginNetKopecks"], 10000)

    def test_payment_changes_cash_but_not_forecast_or_source_hash(self) -> None:
        calculated = self._calculate()
        forecast = calculated.response["forecast"]
        self._submit_and_approve(forecast["id"])
        before = self._get_economics().response

        with server.db() as con:
            timestamp = server.now_ts()
            con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, category, payment_kind, vat_percent,
                    amount, paid_date, counterparty_name, status, created_by, created_at, updated_at
                ) VALUES (?, 'expense', 'materials', 'bank_vat', 20, 120,
                          '2026-08-20', 'Supplier', 'paid', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            con.commit()

        after = self._get_economics().response
        self.assertEqual(before["forecast"]["sourceStateHash"], after["forecast"]["sourceStateHash"])
        self.assertEqual(after["forecastStatus"], "approved")
        for key in (
            "actualCostNetKopecks",
            "etcNetKopecks",
            "eacNetKopecks",
            "forecastMarginNetKopecks",
        ):
            self.assertEqual(before["forecast"][key], after["forecast"][key])
        self.assertEqual(after["cashFlow"]["cashPaidNetKopecks"], 10000)
        self.assertEqual(after["cashFlow"]["cashPaidVatKopecks"], 2000)
        self.assertEqual(after["cashFlow"]["cashPaidGrossKopecks"], 12000)
        self.assertEqual(after["cashFlow"]["cashBalanceGrossKopecks"], -12000)

    def test_source_change_blocks_approval_and_marks_approved_forecast_stale(self) -> None:
        offer_id = self._insert_offer(price=90)
        payload = {
            "priceNormalizations": [
                {
                    "sourceType": "supplier_offer",
                    "sourceId": offer_id,
                    "vatMode": "no_vat",
                    "vatRateBasisPoints": 0,
                }
            ]
        }
        first = self._calculate(payload).response["forecast"]
        self._submit_and_approve(first["id"])

        draft = self._calculate(payload).response["forecast"]
        with server.db() as con:
            con.execute(
                "UPDATE supplier_offers SET price = 95, updated_at = updated_at + 1 WHERE id = ?",
                (offer_id,),
            )
            con.commit()

        submit = FakeHandler(self.admin_user)
        economics.api_submit_project_forecast(
            submit, f"/api/forecasts/{draft['id']}/submit"
        )
        self.assertEqual(submit.status, HTTPStatus.CONFLICT)
        self.assertEqual(submit.response["error"], "forecast_sources_changed_recalculate")
        economics_view = self._get_economics()
        self.assertEqual(economics_view.response["forecastStatus"], "stale")
        self.assertTrue(economics_view.response["forecast"]["isStale"])

    def test_adjustments_risks_and_version_history(self) -> None:
        first = self._calculate(
            {
                "adjustments": [
                    {
                        "type": "risk",
                        "amountNet": 150,
                        "reason": "Possible price increase",
                    },
                    {
                        "type": "adjustment",
                        "amountNet": -20,
                        "reason": "Confirmed saving",
                    },
                ]
            }
        ).response["forecast"]
        self.assertEqual(first["etcNetKopecks"], 33000)
        self.assertEqual(first["eacNetKopecks"], 33000)
        self.assertEqual(first["forecastMarginNetKopecks"], -3000)
        self.assertEqual(first["forecastMarginColor"], "negative")
        self.assertEqual(first["budgetVarianceNetKopecks"], -13000)
        self._submit_and_approve(first["id"])

        second = self._calculate().response["forecast"]
        self.assertEqual(second["versionNo"], 2)
        self._submit_and_approve(second["id"])
        current = self._get_economics().response["forecast"]
        self.assertEqual(current["id"], second["id"])
        with server.db() as con:
            history = con.execute(
                "SELECT version_no, status FROM project_forecasts ORDER BY version_no"
            ).fetchall()
        self.assertEqual([tuple(row) for row in history], [(1, "approved"), (2, "approved")])

    def test_margin_percent_boundaries(self) -> None:
        cases = (
            (30000, 10000, 33.33),
            (30000, 0, 0.0),
            (30000, -5000, -16.67),
            (0, 0, None),
            (0, -1000, None),
        )
        for revenue, margin, expected in cases:
            with self.subTest(revenue=revenue, margin=margin):
                self.assertEqual(economics.margin_percent_value(revenue, margin), expected)

    def test_economics_role_matrix_is_enforced_before_serialization(self) -> None:
        allowed = ("main_admin", "admin", "director")
        denied = ("financier", "accountant", "foreman", "purchaser", "customer", "client")
        for role in allowed:
            with self.subTest(role=role, access="allowed"):
                user = {"id": self.admin_id, "role": role, "roles": []}
                get_handler = self._get_economics(user)
                self.assertEqual(get_handler.status, HTTPStatus.OK)
                calculate = FakeHandler(user, {"reason": f"Role matrix: {role}"})
                economics.api_calculate_project_forecast(
                    calculate, f"/api/projects/{self.project_id}/forecasts/calculate"
                )
                self.assertEqual(calculate.status, HTTPStatus.CREATED, calculate.response)

        protected_keys = {
            "baseline",
            "current",
            "forecast",
            "cashFlow",
            "contractRevenueNetKopecks",
            "targetCostNetKopecks",
            "actualCostNetKopecks",
            "forecastMarginNetKopecks",
        }
        for role in denied:
            with self.subTest(role=role, access="denied"):
                user = {"id": self.admin_id, "role": role, "roles": []}
                get_handler = self._get_economics(user)
                self.assertEqual(get_handler.status, HTTPStatus.FORBIDDEN)
                self.assertEqual(get_handler.response, {"error": "forbidden"})
                self.assertTrue(protected_keys.isdisjoint(get_handler.response))
                calculate = FakeHandler(user, {"reason": "Must be rejected"})
                economics.api_calculate_project_forecast(
                    calculate, f"/api/projects/{self.project_id}/forecasts/calculate"
                )
                self.assertEqual(calculate.status, HTTPStatus.FORBIDDEN)
                self.assertEqual(calculate.response, {"error": "forbidden"})

    def test_forecast_snapshot_components_and_events_are_immutable(self) -> None:
        forecast = self._calculate().response["forecast"]
        forecast_id = int(forecast["id"])
        component_id = int(forecast["components"][0]["id"])
        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "snapshot_is_immutable"):
                con.execute(
                    "UPDATE project_forecasts SET etc_net_kopecks = 1 WHERE id = ?",
                    (forecast_id,),
                )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "component_is_immutable"):
                con.execute(
                    "UPDATE project_forecast_components SET net_amount_kopecks = 1 WHERE id = ?",
                    (component_id,),
                )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "component_is_immutable"):
                con.execute(
                    "DELETE FROM project_forecast_components WHERE id = ?",
                    (component_id,),
                )

        self._submit_and_approve(forecast_id)
        with server.db() as con:
            event_id = int(
                con.execute(
                    "SELECT id FROM project_forecast_events WHERE forecast_id = ? LIMIT 1",
                    (forecast_id,),
                ).fetchone()[0]
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "event_is_immutable"):
                con.execute(
                    "UPDATE project_forecast_events SET details = '{}' WHERE id = ?",
                    (event_id,),
                )

    def test_schema_blocks_invalid_lifecycle_and_component_total(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            with self.assertRaisesRegex(sqlite3.IntegrityError, "must_start_as_draft"):
                con.execute(
                    """
                    INSERT INTO project_forecasts (
                        project_id, baseline_id, version_no, status, currency_code,
                        calculation_date, source_state_hash,
                        contract_revenue_net_kopecks, target_cost_net_kopecks,
                        committed_total_net_kopecks, actual_cost_net_kopecks,
                        etc_net_kopecks, eac_net_kopecks, forecast_margin_net_kopecks,
                        budget_variance_net_kopecks, reason, created_by,
                        submitted_by, submitted_at, approved_by, approved_at,
                        created_at, updated_at
                    ) VALUES (?, ?, 99, 'approved', 'RUB', '2026-08-20', 'sha256:test',
                              30000, 20000, 0, 0, 0, 0, 30000, 20000,
                              'Invalid direct approval', ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        self.project_id,
                        self.baseline_id,
                        self.admin_id,
                        self.admin_id,
                        timestamp,
                        self.admin_id,
                        timestamp,
                        timestamp,
                        timestamp,
                    ),
                )

        forecast = self._calculate().response["forecast"]
        with server.db() as con:
            timestamp = server.now_ts()
            con.execute(
                """
                UPDATE project_forecasts
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, forecast["id"]),
            )
            con.execute("DROP TRIGGER trg_project_forecast_snapshot_immutable")
            con.execute(
                """
                UPDATE project_forecasts
                SET etc_net_kopecks = 1, eac_net_kopecks = 1,
                    forecast_margin_net_kopecks = contract_revenue_net_kopecks - 1,
                    budget_variance_net_kopecks = target_cost_net_kopecks - 1
                WHERE id = ?
                """,
                (forecast["id"],),
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "component_total_mismatch"):
                con.execute(
                    """
                    UPDATE project_forecasts
                    SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (self.admin_id, timestamp, timestamp, forecast["id"]),
                )

    def test_legacy_financial_fields_are_never_read_or_changed(self) -> None:
        forecast = self._calculate().response["forecast"]
        self._submit_and_approve(forecast["id"])
        self._get_economics()
        self.assertEqual(self._legacy_values(), self.legacy_values)

    def test_forecast_history_lists_drafts_and_pending_can_be_returned(self) -> None:
        forecast = self._calculate().response["forecast"]
        listing = FakeHandler(self.admin_user)
        economics_workflow.api_project_forecasts(
            listing, f"/api/projects/{self.project_id}/forecasts"
        )
        self.assertEqual(listing.status, HTTPStatus.OK)
        self.assertEqual(listing.response["summary"]["count"], 1)
        self.assertEqual(listing.response["forecasts"][0]["status"], "draft")

        submit = FakeHandler(self.admin_user)
        economics.api_submit_project_forecast(
            submit, f"/api/forecasts/{forecast['id']}/submit"
        )
        self.assertEqual(submit.status, HTTPStatus.OK)
        returned = FakeHandler(self.admin_user, {"reason": "Update risk assumptions"})
        economics_workflow.api_return_project_forecast(
            returned, f"/api/forecasts/{forecast['id']}/return"
        )
        self.assertEqual(returned.status, HTTPStatus.OK)
        self.assertEqual(returned.response["status"], "draft")

        with server.db() as con:
            row = con.execute(
                "SELECT status, submitted_by, submitted_at FROM project_forecasts WHERE id = ?",
                (forecast["id"],),
            ).fetchone()
            audit = con.execute(
                """
                SELECT payload FROM audit_log
                WHERE entity = 'project_forecast' AND entity_id = ?
                  AND action = 'return_project_forecast'
                """,
                (forecast["id"],),
            ).fetchone()
        self.assertEqual(row["status"], "draft")
        self.assertIsNone(row["submitted_by"])
        self.assertIsNone(row["submitted_at"])
        self.assertIn("Update risk assumptions", audit["payload"])

        history = FakeHandler(self.admin_user)
        economics_workflow.api_project_forecasts(
            history, f"/api/projects/{self.project_id}/forecasts"
        )
        returned_event = next(
            event
            for event in history.response["forecasts"][0]["events"]
            if event["action"] == "returned"
        )
        self.assertEqual(returned_event["details"]["reason"], "Update risk assumptions")

    def test_forecast_price_sources_expose_stable_autobot_snapshot_ids(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO market_price_snapshots (
                    project_id, estimate_item_id, estimate_item_title, item_kind,
                    estimate_version, source_estimate_id, price, source_name,
                    source_url, source_payload, analyzed_at, created_at
                ) VALUES (?, ?, 'Concrete', 'material', 'estimate-v1',
                          'ESTIMATE-1', 123.45, 'AutoBot', 'https://example.test',
                          '[]', ?, ?)
                """,
                (self.project_id, self.estimate_item_id, timestamp, timestamp),
            )
            snapshot_id = int(cursor.lastrowid)
            con.execute(
                """
                INSERT INTO market_price_snapshots (
                    project_id, estimate_item_id, estimate_item_title, item_kind,
                    estimate_version, source_estimate_id, price, source_name,
                    source_url, source_payload, analyzed_at, created_at
                ) VALUES (?, ?, 'Concrete', 'material', 'estimate-older-import',
                          'ESTIMATE-OLDER', 999.99, 'Imported archive', '',
                          '[]', ?, ?)
                """,
                (
                    self.project_id,
                    self.estimate_item_id,
                    timestamp - 100,
                    timestamp + 1,
                ),
            )
            con.commit()

        handler = FakeHandler(self.admin_user)
        economics_workflow.api_project_forecast_price_sources(
            handler, f"/api/projects/{self.project_id}/forecast-price-sources"
        )
        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(len(handler.response["marketSnapshots"]), 1)
        self.assertEqual(handler.response["marketSnapshots"][0]["id"], snapshot_id)
        self.assertEqual(handler.response["marketSnapshots"][0]["estimateItemId"], self.estimate_item_id)
        self.assertEqual(handler.response["marketSnapshots"][0]["price"], 123.45)


if __name__ == "__main__":
    unittest.main()
