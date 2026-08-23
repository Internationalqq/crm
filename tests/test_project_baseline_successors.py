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


class ProjectBaselineSuccessorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR
        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "baseline-successors.sqlite3"
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
            self.project_id = int(con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                ) VALUES ('Successor project', 'Address', 'Client', 'active', 1, 2, 3, ?)
                """,
                (timestamp,),
            ).lastrowid)
            self.estimate_item_id = int(con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Concrete', 'm3', 2, 500, 'material')
                """,
                (self.project_id,),
            ).lastrowid)
            con.commit()
        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        economics.DB_PATH = self.original_economics_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _call(self, function, path: str, payload: dict | None = None):
        handler = FakeHandler(self.admin, payload)
        function(handler, path)
        return handler

    def _create_and_approve_baseline(self) -> dict:
        created = self._call(
            economics.api_create_financial_baseline,
            f"/api/projects/{self.project_id}/financial-baselines",
            {"reason": "Initial baseline", "effectiveFrom": "2026-08-21"},
        )
        self.assertEqual(created.status, HTTPStatus.CREATED)
        baseline_id = int(created.response["baseline"]["id"])
        updated = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            {
                "reason": "Approved contract and target",
                "effectiveFrom": "2026-08-21",
                "revenueLines": [{
                    "title": "Contract revenue",
                    "estimateItemId": self.estimate_item_id,
                    "unit": "m3",
                    "quantity": 2,
                    "sourceAmountKopecks": 120000,
                    "vatMode": "no_vat",
                    "sourceType": "contract",
                    "sourceReference": "contract:line:1",
                }],
                "budgetLines": [{
                    "title": "Concrete target",
                    "lineType": "direct_cost",
                    "costCode": "MAT",
                    "estimateItemId": self.estimate_item_id,
                    "unit": "m3",
                    "quantity": 2,
                    "sourceAmountKopecks": 70000,
                    "vatMode": "no_vat",
                    "sourceType": "estimate",
                    "sourceReference": "estimate:line:1",
                }],
            },
        )
        self.assertEqual(updated.status, HTTPStatus.OK)
        self.assertEqual(self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        ).status, HTTPStatus.OK)
        approved = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/approve",
        )
        self.assertEqual(approved.status, HTTPStatus.OK)
        return approved.response["baseline"]

    def _clone_baseline(self, source_id: int) -> dict:
        created = self._call(
            economics.api_create_financial_baseline,
            f"/api/projects/{self.project_id}/financial-baselines",
            {
                "reason": "Contract revision",
                "effectiveFrom": "2026-09-01",
                "cloneFromBaselineId": source_id,
            },
        )
        self.assertEqual(created.status, HTTPStatus.CREATED)
        return created.response["baseline"]

    def _submit_and_approve(self, baseline_id: int):
        submitted = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        self.assertEqual(submitted.status, HTTPStatus.OK)
        return self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/approve",
        )

    def _insert_approved_operations(
        self, baseline: dict, *, supplier_offer_id: int | None = None
    ) -> dict:
        budget_line_id = int(baseline["budgetLines"][0]["id"])
        revenue_line_id = int(baseline["revenueLines"][0]["id"])
        timestamp = server.now_ts()
        with server.db() as con:
            commitment_id = int(con.execute(
                """
                INSERT INTO project_commitments (
                    project_id, baseline_id, commitment_type, commitment_no,
                    status, currency_code, counterparty_name, reason,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, 'other', 'C-1', 'draft', 'RUB', 'Supplier',
                          'Approved order', ?, ?, ?)
                """,
                (self.project_id, baseline["id"], self.admin_id, timestamp, timestamp),
            ).lastrowid)
            commitment_line_id = int(con.execute(
                """
                INSERT INTO project_commitment_lines (
                    commitment_id, position, budget_line_id, estimate_item_id,
                    supplier_offer_id, title, unit, quantity, source_unit_price_kopecks,
                    unit_cost_net_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, source_reference,
                    created_by, created_at
                ) VALUES (?, 1, ?, ?, ?, 'Concrete order', 'm3', 1, 40000,
                          40000, 40000, 0, 0, 40000, 'no_vat',
                          'commitment:C-1:line:1', ?, ?)
                """,
                (
                    commitment_id, budget_line_id, self.estimate_item_id,
                    supplier_offer_id,
                    self.admin_id, timestamp,
                ),
            ).lastrowid)
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?,
                    updated_at = ? WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, commitment_id),
            )
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'approved', approved_by = ?, approved_at = ?,
                    updated_at = ? WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, commitment_id),
            )

            actual_id = self._insert_actual_row(
                con,
                baseline_id=int(baseline["id"]),
                budget_line_id=budget_line_id,
                commitment_id=commitment_id,
                commitment_line_id=commitment_line_id,
                amount=15000,
                quantity=0.5,
                source_key="labor:first",
                timestamp=timestamp,
            )

            finance_entry_id = int(con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, category, payment_kind, vat_percent,
                    amount, paid_date, status, notes, created_by, created_at, updated_at
                ) VALUES (?, 'income', 'customer', 'cash', 0, 1000,
                          '2026-08-21', 'paid', 'Customer receipt', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            ).lastrowid)
            allocation_id = int(con.execute(
                """
                INSERT INTO project_payment_allocations (
                    project_id, finance_entry_id, allocation_key, direction,
                    allocation_purpose, target_type, target_revenue_line_id,
                    entry_kind, source_payment_gross_kopecks,
                    net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, reason, status,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, 'receipt:1', 'income', 'customer_receipt',
                          'revenue_line', ?, 'allocation', 100000, 10000, 0, 0,
                          10000, 'no_vat', 'Allocate receipt', 'draft', ?, ?, ?)
                """,
                (
                    self.project_id, finance_entry_id, revenue_line_id,
                    self.admin_id, timestamp, timestamp,
                ),
            ).lastrowid)
            con.execute(
                """
                UPDATE project_payment_allocations
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?,
                    updated_at = ? WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, allocation_id),
            )
            con.execute(
                """
                UPDATE project_payment_allocations
                SET status = 'approved', approved_by = ?, approved_at = ?,
                    updated_at = ? WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, allocation_id),
            )
            con.commit()
        return {
            "budget_line_id": budget_line_id,
            "revenue_line_id": revenue_line_id,
            "commitment_id": commitment_id,
            "commitment_line_id": commitment_line_id,
            "actual_id": actual_id,
            "allocation_id": allocation_id,
        }

    def _insert_actual_row(
        self,
        con: sqlite3.Connection,
        *,
        baseline_id: int,
        budget_line_id: int,
        commitment_id: int,
        commitment_line_id: int,
        amount: int,
        quantity: float,
        source_key: str,
        timestamp: int,
    ) -> int:
        actual_id = int(con.execute(
            """
            INSERT INTO project_actual_cost_entries (
                project_id, baseline_id, budget_line_id, commitment_id,
                commitment_line_id, estimate_item_id, cost_category, entry_kind,
                source_type, source_event_key, title, recognition_date, unit,
                quantity, source_unit_price_kopecks, unit_cost_net_kopecks,
                net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, valuation_method,
                source_reference, reason, status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'labor', 'cost', 'labor_timesheet', ?,
                      'Accepted work', '2026-08-21', 'm3', ?, ?, ?, ?, 0, 0, ?,
                      'no_vat', 'approved_rate', ?, 'Accepted work', 'draft', ?, ?, ?)
            """,
            (
                self.project_id, baseline_id, budget_line_id, commitment_id,
                commitment_line_id, self.estimate_item_id, source_key, quantity,
                amount, amount, amount, amount, source_key, self.admin_id,
                timestamp, timestamp,
            ),
        ).lastrowid)
        con.execute(
            """
            UPDATE project_actual_cost_entries
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?,
                updated_at = ? WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, actual_id),
        )
        con.execute(
            """
            UPDATE project_actual_cost_entries
            SET status = 'approved', approved_by = ?, approved_at = ?,
                updated_at = ? WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, actual_id),
        )
        return actual_id

    def _operation_refs(self) -> tuple[tuple, tuple, tuple]:
        with server.db() as con:
            return economics.project_operational_identity_snapshot(con, self.project_id)

    def test_replacement_keeps_history_and_project_wide_totals(self) -> None:
        first = self._create_and_approve_baseline()
        operations = self._insert_approved_operations(first)
        before_refs = self._operation_refs()
        with server.db() as con:
            before_totals = economics.current_economic_totals(
                con, self.project_id, int(first["id"])
            )

        second = self._clone_baseline(int(first["id"]))
        self.assertEqual(len(second["successorMappings"]["budget"]), 1)
        self.assertEqual(len(second["successorMappings"]["revenue"]), 1)
        approved = self._submit_and_approve(int(second["id"]))
        self.assertEqual(approved.status, HTTPStatus.OK)

        self.assertEqual(self._operation_refs(), before_refs)
        with server.db() as con:
            after_totals = economics.current_economic_totals(
                con, self.project_id, int(second["id"])
            )
            budget_resolution = economics.resolved_budget_line_map(
                con, self.project_id, int(second["id"])
            )
            revenue_resolution = economics.resolved_revenue_line_map(
                con, self.project_id, int(second["id"])
            )
            forecast = economics.calculate_forecast_snapshot(
                con,
                self.project_id,
                con.execute(
                    "SELECT * FROM project_financial_baselines WHERE id = ?",
                    (second["id"],),
                ).fetchone(),
                {},
            )
        for key in ("committed_total", "actual_cost", "remaining_commitment"):
            self.assertEqual(after_totals[key], before_totals[key])
        self.assertEqual(after_totals["committed_total"], 40000)
        self.assertEqual(after_totals["actual_cost"], 15000)
        self.assertEqual(after_totals["remaining_commitment"], 25000)
        self.assertEqual(
            budget_resolution[operations["budget_line_id"]][0],
            int(second["budgetLines"][0]["id"]),
        )
        self.assertEqual(
            revenue_resolution[operations["revenue_line_id"]],
            int(second["revenueLines"][0]["id"]),
        )
        self.assertEqual(forecast["actual_cost_net_kopecks"], 15000)
        self.assertEqual(forecast["eac_net_kopecks"], 75000)

        with server.db() as con:
            timestamp = server.now_ts()
            new_receipt_id = int(con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, category, payment_kind, vat_percent,
                    amount, paid_date, status, notes, created_by, created_at, updated_at
                ) VALUES (?, 'income', 'customer', 'cash', 0, 1200,
                          '2026-09-02', 'paid', 'Receipt after replacement', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            ).lastrowid)
            con.commit()
        duplicate_receipt = self._call(
            economics.api_create_payment_allocation,
            f"/api/projects/{self.project_id}/payment-allocations",
            {
                "financeEntryId": new_receipt_id,
                "targetType": "revenue_line",
                "targetId": int(second["revenueLines"][0]["id"]),
                "amount": 1200,
                "allocationKey": "receipt:after-replacement",
                "reason": "Historical receipts must consume successor capacity",
            },
        )
        self.assertEqual(duplicate_receipt.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            duplicate_receipt.response["error"],
            "payment_allocation_exceeds_revenue_line",
        )
        self.assertEqual(duplicate_receipt.response["remainingGrossKopecks"], 110000)

        with server.db() as con:
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute(
                    "DELETE FROM project_budget_line_successors WHERE to_baseline_id = ?",
                    (second["id"],),
                )

    def test_incomplete_mapping_rolls_back_replacement(self) -> None:
        first = self._create_and_approve_baseline()
        operations = self._insert_approved_operations(first)
        before_refs = self._operation_refs()
        second = self._clone_baseline(int(first["id"]))
        cleared = self._call(
            economics.api_update_financial_baseline_successors,
            f"/api/financial-baselines/{second['id']}/successors",
            {"budgetMappings": [], "revenueMappings": []},
        )
        self.assertEqual(cleared.status, HTTPStatus.OK)
        submitted = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{second['id']}/submit",
        )
        self.assertEqual(submitted.status, HTTPStatus.OK)

        blocked = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{second['id']}/approve",
        )

        self.assertEqual(blocked.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            blocked.response["error"],
            "baseline_replacement_requires_operational_mapping",
        )
        self.assertEqual(blocked.response["reason"], "successor_mapping_incomplete")
        self.assertEqual(
            blocked.response["missingBudgetLineIds"], [operations["budget_line_id"]]
        )
        self.assertEqual(
            blocked.response["missingRevenueLineIds"], [operations["revenue_line_id"]]
        )
        self.assertEqual(self._operation_refs(), before_refs)
        with server.db() as con:
            statuses = dict(con.execute(
                """
                SELECT version_no, status FROM project_financial_baselines
                WHERE project_id = ? ORDER BY version_no
                """,
                (self.project_id,),
            ).fetchall())
        self.assertEqual(statuses, {1: "approved", 2: "pending_approval"})

    def test_chain_and_new_actual_for_historical_commitment(self) -> None:
        first = self._create_and_approve_baseline()
        operations = self._insert_approved_operations(first)
        second = self._clone_baseline(int(first["id"]))
        self.assertEqual(self._submit_and_approve(int(second["id"])).status, HTTPStatus.OK)

        with server.db() as con:
            timestamp = server.now_ts()
            second_actual_id = self._insert_actual_row(
                con,
                baseline_id=int(first["id"]),
                budget_line_id=operations["budget_line_id"],
                commitment_id=operations["commitment_id"],
                commitment_line_id=operations["commitment_line_id"],
                amount=5000,
                quantity=0.25,
                source_key="labor:after-replacement",
                timestamp=timestamp,
            )
            con.commit()
            actual = con.execute(
                "SELECT baseline_id, budget_line_id, status FROM project_actual_cost_entries WHERE id = ?",
                (second_actual_id,),
            ).fetchone()
        self.assertEqual(tuple(actual), (first["id"], operations["budget_line_id"], "approved"))

        third = self._clone_baseline(int(second["id"]))
        self.assertEqual(self._submit_and_approve(int(third["id"])).status, HTTPStatus.OK)
        with server.db() as con:
            resolution = economics.resolved_budget_line_map(
                con, self.project_id, int(third["id"])
            )
            totals = economics.current_economic_totals(
                con, self.project_id, int(third["id"])
            )
        self.assertEqual(
            resolution[operations["budget_line_id"]][0],
            int(third["budgetLines"][0]["id"]),
        )
        self.assertEqual(totals["actual_cost"], 20000)
        self.assertEqual(totals["remaining_commitment"], 20000)

    def test_one_source_line_cannot_be_split_between_successors(self) -> None:
        first = self._create_and_approve_baseline()
        second = self._clone_baseline(int(first["id"]))
        source_id = int(first["budgetLines"][0]["id"])
        target_id = int(second["budgetLines"][0]["id"])
        duplicate = {
            "sourceBudgetLineId": source_id,
            "targetBudgetLineId": target_id,
            "mappingKind": "carry_forward",
            "reason": "Carry historical scope",
        }

        rejected = self._call(
            economics.api_update_financial_baseline_successors,
            f"/api/financial-baselines/{second['id']}/successors",
            {"budgetMappings": [duplicate, duplicate], "revenueMappings": []},
        )

        self.assertEqual(rejected.status, HTTPStatus.CONFLICT)
        self.assertEqual(rejected.response["error"], "duplicate_source_budget_successor")
        with server.db() as con:
            self.assertEqual(
                int(con.execute(
                    "SELECT COUNT(*) FROM project_budget_line_successors WHERE to_baseline_id = ?",
                    (second["id"],),
                ).fetchone()[0]),
                1,
            )

    def test_quantity_factor_is_applied_once_to_recognized_commitment_quantity(self) -> None:
        first = self._create_and_approve_baseline()
        with server.db() as con:
            timestamp = server.now_ts()
            offer_id = int(con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_type, candidate_name,
                    source_type, price, qty, unit, status, created_by,
                    activated_by, activated_at, created_at, updated_at
                ) VALUES (?, ?, 'supplier', 'Capacity-limited supplier', 'manual',
                          100, 2, 'm3', 'selected', ?, ?, ?, ?, ?)
                """,
                (
                    self.project_id, self.estimate_item_id, self.admin_id,
                    self.admin_id, timestamp, timestamp, timestamp,
                ),
            ).lastrowid)
            con.commit()
        operations = self._insert_approved_operations(
            first, supplier_offer_id=offer_id
        )
        second = self._clone_baseline(int(first["id"]))
        with server.db() as con:
            con.execute(
                """
                UPDATE project_budget_lines
                SET quantity = 3, net_amount_kopecks = 105000,
                    gross_amount_kopecks = 105000
                WHERE id = ?
                """,
                (second["budgetLines"][0]["id"],),
            )
            con.commit()
        budget_mapping = second["successorMappings"]["budget"][0]
        revenue_mapping = second["successorMappings"]["revenue"][0]
        mapped = self._call(
            economics.api_update_financial_baseline_successors,
            f"/api/financial-baselines/{second['id']}/successors",
            {
                "budgetMappings": [{
                    "sourceBudgetLineId": operations["budget_line_id"],
                    "targetBudgetLineId": budget_mapping["targetBudgetLineId"],
                    "mappingKind": "reclassified",
                    "quantityFactor": 2,
                    "reason": "One old unit equals two new units",
                }],
                "revenueMappings": [{
                    "sourceRevenueLineId": revenue_mapping["sourceRevenueLineId"],
                    "targetRevenueLineId": revenue_mapping["targetRevenueLineId"],
                    "mappingKind": revenue_mapping["mappingKind"],
                    "reason": revenue_mapping["reason"],
                }],
            },
        )
        self.assertEqual(mapped.status, HTTPStatus.OK, mapped.response)
        self.assertEqual(self._submit_and_approve(int(second["id"])).status, HTTPStatus.OK)

        with server.db() as con:
            snapshot = economics.calculate_forecast_snapshot(
                con,
                self.project_id,
                con.execute(
                    "SELECT * FROM project_financial_baselines WHERE id = ?",
                    (second["id"],),
                ).fetchone(),
                {},
            )
        remaining = next(
            component
            for component in snapshot["components"]
            if component["component_type"] == "remaining_commitment"
        )
        self.assertEqual(remaining["quantity"], 1.0)
        self.assertEqual(remaining["unit"], "m3")
        self.assertEqual(remaining["unit_cost_net_kopecks"], 20000)
        self.assertFalse(any(
            component["source_type"] == "active_supplier_offer"
            for component in snapshot["components"]
        ))
        baseline_remainder = next(
            component
            for component in snapshot["components"]
            if component["component_type"] == "uncontracted"
            and component["source_type"] == "target_budget"
        )
        self.assertEqual(baseline_remainder["quantity"], 1.0)


if __name__ == "__main__":
    unittest.main()
