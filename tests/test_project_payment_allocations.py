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


class ProjectPaymentAllocationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "project-payment-allocations.sqlite3"
        server.DB_PATH = test_db
        economics.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            timestamp = server.now_ts()
            project_cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                ) VALUES ('Cash allocation project', 'Address', 'Client', 'active',
                          1000000.25, 777.77, 333.33, ?)
                """,
                (timestamp,),
            )
            self.project_id = int(project_cursor.lastrowid)
            item_cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Paid material', 'pcs', 2, 150, 'material')
                """,
                (self.project_id,),
            )
            self.estimate_item_id = int(item_cursor.lastrowid)
            (
                self.baseline_id,
                self.revenue_line_id,
                self.budget_line_id,
            ) = self._create_approved_baseline(con)
            self.commitment_id, self.commitment_line_id = self._create_approved_commitment(con)
            self.actual_cost_id = self._create_approved_actual_cost(con)
            self.income_payment_id = self._insert_payment(
                con,
                direction="income",
                amount=360,
                payment_kind="bank_vat",
                vat_percent=20,
                status="paid",
                paid_date="2026-08-20",
                counterparty="Customer",
            )
            self.expense_payment_id = self._insert_payment(
                con,
                direction="expense",
                amount=240,
                payment_kind="bank_vat",
                vat_percent=20,
                status="paid",
                paid_date="2026-08-21",
                counterparty="Supplier",
            )
            self.planned_payment_id = self._insert_payment(
                con,
                direction="expense",
                amount=100,
                payment_kind="bank_no_vat",
                vat_percent=0,
                status="approved",
                paid_date=None,
                counterparty="Planned supplier",
            )
            self.undated_paid_payment_id = self._insert_payment(
                con,
                direction="expense",
                amount=50,
                payment_kind="cash",
                vat_percent=0,
                status="paid",
                paid_date=None,
                counterparty="Undated supplier",
            )
            con.commit()
        self.admin_user = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        economics.DB_PATH = self.original_economics_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _create_approved_baseline(self, con: sqlite3.Connection) -> tuple[int, int, int]:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, source_snapshot_hash,
                reason, created_by, created_at, updated_at
            ) VALUES (?, 1, 'draft', 'RUB', 'sha256:payment-test',
                      'Payment allocation baseline', ?, ?, ?)
            """,
            (self.project_id, self.admin_id, timestamp, timestamp),
        )
        baseline_id = int(cursor.lastrowid)
        revenue_cursor = con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, estimate_item_id, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, ?, 'Customer contract line', 'pcs', 2, 15000, 30000,
                      2000, 6000, 36000, 'gross', 'estimate', 'revenue:1', ?, ?)
            """,
            (baseline_id, self.estimate_item_id, self.admin_id, timestamp),
        )
        budget_cursor = con.execute(
            """
            INSERT INTO project_budget_lines (
                baseline_id, position, line_type, cost_code, estimate_item_id,
                title, unit, quantity, unit_cost_net_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                source_vat_mode, source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Material target', 'pcs', 2,
                      10000, 20000, 2000, 4000, 24000, 'gross', 'estimate',
                      'budget:1', ?, ?)
            """,
            (baseline_id, self.estimate_item_id, self.admin_id, timestamp),
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
                effective_from = '2026-08-20', updated_at = ? WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )
        return baseline_id, int(revenue_cursor.lastrowid), int(budget_cursor.lastrowid)

    def _create_approved_commitment(self, con: sqlite3.Connection) -> tuple[int, int]:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_commitments (
                project_id, baseline_id, commitment_type, commitment_no, status,
                currency_code, counterparty_name, reason, created_by, created_at, updated_at
            ) VALUES (?, ?, 'purchase_order', 'PO-PAY-1', 'draft', 'RUB',
                      'Supplier', 'Payment test order', ?, ?, ?)
            """,
            (self.project_id, self.baseline_id, self.admin_id, timestamp, timestamp),
        )
        commitment_id = int(cursor.lastrowid)
        line_cursor = con.execute(
            """
            INSERT INTO project_commitment_lines (
                commitment_id, position, budget_line_id, estimate_item_id, title, unit,
                quantity, source_unit_price_kopecks, unit_cost_net_kopecks,
                net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, source_reference, created_by, created_at
            ) VALUES (?, 1, ?, ?, 'Supplier order line', 'pcs', 2, 12000, 10000,
                      20000, 2000, 4000, 24000, 'gross', 'commitment:1', ?, ?)
            """,
            (
                commitment_id,
                self.budget_line_id,
                self.estimate_item_id,
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
        return commitment_id, int(line_cursor.lastrowid)

    def _create_approved_actual_cost(self, con: sqlite3.Connection) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_actual_cost_entries (
                project_id, baseline_id, budget_line_id, commitment_id, commitment_line_id,
                estimate_item_id, cost_category, entry_kind, source_type, source_event_key,
                title, recognition_date, unit, quantity, source_unit_price_kopecks,
                unit_cost_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                valuation_method, source_reference, reason, status, created_by,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'material', 'cost', 'labor_timesheet',
                      'payment-test-actual', 'Accepted cost', '2026-08-20', 'pcs', 2,
                      12000, 10000, 20000, 2000, 4000, 24000, 'gross',
                      'approved_rate', 'actual:1', 'Accepted actual for payment test',
                      'draft', ?, ?, ?)
            """,
            (
                self.project_id,
                self.baseline_id,
                self.budget_line_id,
                self.commitment_id,
                self.commitment_line_id,
                self.estimate_item_id,
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        actual_id = int(cursor.lastrowid)
        con.execute(
            """
            UPDATE project_actual_cost_entries
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, actual_id),
        )
        con.execute(
            """
            UPDATE project_actual_cost_entries
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, actual_id),
        )
        return actual_id

    def _insert_payment(
        self,
        con: sqlite3.Connection,
        *,
        direction: str,
        amount: float,
        payment_kind: str,
        vat_percent: float,
        status: str,
        paid_date: str | None,
        counterparty: str,
    ) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO finance_entries (
                project_id, direction, category, payment_kind, vat_percent, amount,
                planned_date, paid_date, counterparty_name, status, notes,
                created_by, created_at, updated_at
            ) VALUES (?, ?, 'test', ?, ?, ?, '2026-08-20', ?, ?, ?,
                      'Payment allocation test', ?, ?, ?)
            """,
            (
                self.project_id,
                direction,
                payment_kind,
                vat_percent,
                amount,
                paid_date,
                counterparty,
                status,
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        return int(cursor.lastrowid)

    def _allocation_payload(
        self,
        *,
        finance_entry_id: int | None = None,
        target_type: str = "actual_cost",
        target_id: int | None = None,
        amount: float = 120,
        allocation_key: str = "actual-part-1",
    ) -> dict:
        return {
            "financeEntryId": finance_entry_id or self.expense_payment_id,
            "targetType": target_type,
            "targetId": target_id or self.actual_cost_id,
            "amount": amount,
            "allocationKey": allocation_key,
            "reason": "Reconcile paid transaction with approved source",
        }

    def _create_allocation(self, payload: dict | None = None) -> int:
        handler = FakeHandler(self.admin_user, payload or self._allocation_payload())
        economics.api_create_payment_allocation(
            handler,
            f"/api/projects/{self.project_id}/payment-allocations",
        )
        self.assertEqual(handler.status, HTTPStatus.CREATED, handler.response)
        return int(handler.response["id"])

    def _submit_and_approve(self, allocation_id: int) -> None:
        submit = FakeHandler(self.admin_user)
        economics.api_submit_payment_allocation(
            submit,
            f"/api/payment-allocations/{allocation_id}/submit",
        )
        self.assertEqual(submit.status, HTTPStatus.OK, submit.response)
        approve = FakeHandler(self.admin_user)
        economics.api_approve_payment_allocation(
            approve,
            f"/api/payment-allocations/{allocation_id}/approve",
        )
        self.assertEqual(approve.status, HTTPStatus.OK, approve.response)

    @staticmethod
    def _legacy_snapshot(con: sqlite3.Connection) -> tuple[list[tuple], list[tuple], list[tuple]]:
        projects = [
            tuple(row)
            for row in con.execute(
                """
                SELECT id, quote(budget), typeof(budget), quote(paid), typeof(paid),
                       quote(spent), typeof(spent) FROM projects ORDER BY id
                """
            ).fetchall()
        ]
        items = [
            tuple(row)
            for row in con.execute(
                "SELECT id, quote(planned_price), typeof(planned_price) FROM estimate_items ORDER BY id"
            ).fetchall()
        ]
        finance = [tuple(row) for row in con.execute("SELECT * FROM finance_entries ORDER BY id")]
        return projects, items, finance

    def test_cash_flow_uses_only_paid_dated_entries_and_separates_vat(self) -> None:
        handler = FakeHandler(self.admin_user)
        economics.api_project_cash_flow(handler, f"/api/projects/{self.project_id}/cash-flow")
        self.assertEqual(handler.status, HTTPStatus.OK)
        summary = handler.response["summary"]
        self.assertEqual(summary["cashReceivedNetKopecks"], 30000)
        self.assertEqual(summary["cashReceivedVatKopecks"], 6000)
        self.assertEqual(summary["cashReceivedGrossKopecks"], 36000)
        self.assertEqual(summary["cashPaidNetKopecks"], 20000)
        self.assertEqual(summary["cashPaidVatKopecks"], 4000)
        self.assertEqual(summary["cashPaidGrossKopecks"], 24000)
        self.assertEqual(summary["cashBalanceGrossKopecks"], 12000)
        recognized = {item["id"]: item["recognizedInCashFlow"] for item in handler.response["payments"]}
        self.assertFalse(recognized[self.planned_payment_id])
        self.assertFalse(recognized[self.undated_paid_payment_id])

    def test_allocation_affects_settlement_but_not_actual_cost_or_cash(self) -> None:
        actual_before = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(
            actual_before, f"/api/projects/{self.project_id}/actual-costs"
        )
        cash_before = FakeHandler(self.admin_user)
        economics.api_project_cash_flow(cash_before, f"/api/projects/{self.project_id}/cash-flow")
        allocation_id = self._create_allocation()

        draft_cash = FakeHandler(self.admin_user)
        economics.api_project_cash_flow(draft_cash, f"/api/projects/{self.project_id}/cash-flow")
        self.assertEqual(draft_cash.response["summary"]["allocatedPaidGrossKopecks"], 0)

        self._submit_and_approve(allocation_id)
        actual_after = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(
            actual_after, f"/api/projects/{self.project_id}/actual-costs"
        )
        cash_after = FakeHandler(self.admin_user)
        economics.api_project_cash_flow(cash_after, f"/api/projects/{self.project_id}/cash-flow")

        self.assertEqual(
            actual_after.response["summary"]["approvedNetKopecks"],
            actual_before.response["summary"]["approvedNetKopecks"],
        )
        self.assertEqual(
            cash_after.response["summary"]["cashPaidGrossKopecks"],
            cash_before.response["summary"]["cashPaidGrossKopecks"],
        )
        self.assertEqual(cash_after.response["summary"]["allocatedPaidGrossKopecks"], 12000)
        self.assertEqual(cash_after.response["summary"]["unallocatedPaidGrossKopecks"], 12000)
        self.assertEqual(actual_after.response["items"][0]["allocatedPaymentGrossKopecks"], 12000)

        commitments = FakeHandler(self.admin_user)
        economics.api_project_commitments(
            commitments, f"/api/projects/{self.project_id}/commitments"
        )
        self.assertEqual(commitments.response["summary"]["allocatedPaymentGrossKopecks"], 12000)
        self.assertEqual(commitments.response["summary"]["approvedNetKopecks"], 20000)
        self.assertEqual(commitments.response["summary"]["recognizedNetKopecks"], 20000)

    def test_customer_receipt_can_be_allocated_only_to_revenue(self) -> None:
        income_payload = self._allocation_payload(
            finance_entry_id=self.income_payment_id,
            target_type="revenue_line",
            target_id=self.revenue_line_id,
            amount=360,
            allocation_key="customer-receipt-1",
        )
        allocation_id = self._create_allocation(income_payload)
        self._submit_and_approve(allocation_id)
        cash = FakeHandler(self.admin_user)
        economics.api_project_cash_flow(cash, f"/api/projects/{self.project_id}/cash-flow")
        self.assertEqual(cash.response["summary"]["allocatedReceivedGrossKopecks"], 36000)
        self.assertEqual(cash.response["summary"]["unallocatedReceivedGrossKopecks"], 0)

        wrong_target = FakeHandler(
            self.admin_user,
            self._allocation_payload(
                finance_entry_id=self.income_payment_id,
                target_type="actual_cost",
                target_id=self.actual_cost_id,
                allocation_key="wrong-income-target",
            ),
        )
        economics.api_create_payment_allocation(
            wrong_target,
            f"/api/projects/{self.project_id}/payment-allocations",
        )
        self.assertEqual(wrong_target.status, HTTPStatus.CONFLICT)
        self.assertEqual(wrong_target.response, {"error": "income_payment_requires_revenue_line"})

    def test_planned_or_undated_payment_cannot_be_allocated(self) -> None:
        for payment_id in (self.planned_payment_id, self.undated_paid_payment_id):
            with self.subTest(payment_id=payment_id):
                handler = FakeHandler(
                    self.admin_user,
                    self._allocation_payload(
                        finance_entry_id=payment_id,
                        amount=10,
                        allocation_key=f"invalid-payment-{payment_id}",
                    ),
                )
                economics.api_create_payment_allocation(
                    handler,
                    f"/api/projects/{self.project_id}/payment-allocations",
                )
                self.assertEqual(handler.status, HTTPStatus.CONFLICT)
                self.assertEqual(handler.response, {"error": "paid_dated_finance_entry_required"})

    def test_allocation_is_idempotent_and_cannot_exceed_payment_or_target(self) -> None:
        first_id = self._create_allocation()
        duplicate = FakeHandler(self.admin_user, self._allocation_payload())
        economics.api_create_payment_allocation(
            duplicate,
            f"/api/projects/{self.project_id}/payment-allocations",
        )
        self.assertEqual(duplicate.status, HTTPStatus.CONFLICT)
        self.assertEqual(duplicate.response["paymentAllocationId"], first_id)
        self._submit_and_approve(first_id)

        too_much = FakeHandler(
            self.admin_user,
            self._allocation_payload(amount=121, allocation_key="actual-part-2"),
        )
        economics.api_create_payment_allocation(
            too_much,
            f"/api/projects/{self.project_id}/payment-allocations",
        )
        self.assertEqual(too_much.status, HTTPStatus.CONFLICT)
        self.assertIn(too_much.response["error"], {
            "payment_allocation_exceeds_payment",
            "payment_allocation_exceeds_actual_cost",
        })

    def test_allocated_payment_financial_identity_is_immutable(self) -> None:
        allocation_id = self._create_allocation()
        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "allocated_finance_entry_is_immutable"):
                con.execute(
                    "UPDATE finance_entries SET amount = 999 WHERE id = ?",
                    (self.expense_payment_id,),
                )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "allocated_finance_entry_is_immutable"):
                con.execute(
                    "UPDATE finance_entries SET status = 'approved' WHERE id = ?",
                    (self.expense_payment_id,),
                )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "allocated_finance_entry_cannot_be_deleted"):
                con.execute("DELETE FROM finance_entries WHERE id = ?", (self.expense_payment_id,))
        self.assertGreater(allocation_id, 0)

    def test_reversal_changes_only_attribution_and_preserves_history(self) -> None:
        allocation_id = self._create_allocation()
        self._submit_and_approve(allocation_id)
        reverse = FakeHandler(self.admin_user, {"reason": "Wrong settlement target"})
        economics.api_reverse_payment_allocation(
            reverse,
            f"/api/payment-allocations/{allocation_id}/reverse",
        )
        self.assertEqual(reverse.status, HTTPStatus.CREATED, reverse.response)
        reversal_id = int(reverse.response["id"])
        self._submit_and_approve(reversal_id)

        cash = FakeHandler(self.admin_user)
        economics.api_project_cash_flow(cash, f"/api/projects/{self.project_id}/cash-flow")
        self.assertEqual(cash.response["summary"]["cashPaidGrossKopecks"], 24000)
        self.assertEqual(cash.response["summary"]["allocatedPaidGrossKopecks"], 0)
        self.assertEqual(cash.response["summary"]["unallocatedPaidGrossKopecks"], 24000)
        actual = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(actual, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(actual.response["summary"]["approvedNetKopecks"], 20000)
        self.assertEqual(actual.response["summary"]["allocatedPaymentGrossKopecks"], 0)

        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "approved_project_payment_allocation_is_immutable"):
                con.execute(
                    "UPDATE project_payment_allocations SET reason = 'Changed' WHERE id = ?",
                    (allocation_id,),
                )
            event_id = int(
                con.execute(
                    """
                    SELECT id FROM project_payment_allocation_events
                    WHERE payment_allocation_id = ? LIMIT 1
                    """,
                    (allocation_id,),
                ).fetchone()[0]
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "event_is_immutable"):
                con.execute("DELETE FROM project_payment_allocation_events WHERE id = ?", (event_id,))

    def test_direct_commitment_allocation_is_reported_without_changing_actual(self) -> None:
        with server.db() as con:
            second_payment_id = self._insert_payment(
                con,
                direction="expense",
                amount=240,
                payment_kind="bank_vat",
                vat_percent=20,
                status="paid",
                paid_date="2026-08-22",
                counterparty="Supplier advance",
            )
            con.commit()
        allocation_id = self._create_allocation(
            self._allocation_payload(
                finance_entry_id=second_payment_id,
                target_type="commitment",
                target_id=self.commitment_id,
                amount=240,
                allocation_key="supplier-advance",
            )
        )
        self._submit_and_approve(allocation_id)
        commitments = FakeHandler(self.admin_user)
        economics.api_project_commitments(
            commitments, f"/api/projects/{self.project_id}/commitments"
        )
        item = commitments.response["items"][0]
        self.assertEqual(item["allocatedPaymentGrossKopecks"], 24000)
        self.assertEqual(item["unpaidGrossKopecks"], 0)
        actual = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(actual, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(actual.response["summary"]["allocatedPaymentGrossKopecks"], 0)
        self.assertEqual(actual.response["summary"]["approvedNetKopecks"], 20000)

    def test_cash_flow_role_matrix(self) -> None:
        allowed_roles = {"main_admin", "admin", "director"}
        for role in auth.ROLE_CODES:
            with self.subTest(role=role):
                handler = FakeHandler({"id": self.admin_id, "role": role, "roles": []})
                economics.api_project_cash_flow(
                    handler,
                    f"/api/projects/{self.project_id}/cash-flow",
                )
                if role in allowed_roles:
                    self.assertEqual(handler.status, HTTPStatus.OK)
                    self.assertIn("cashPaidGrossKopecks", handler.response["summary"])
                else:
                    self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
                    self.assertEqual(handler.response, {"error": "forbidden"})

    def test_allocation_lifecycle_does_not_modify_legacy_data(self) -> None:
        with server.db() as con:
            before = self._legacy_snapshot(con)
        allocation_id = self._create_allocation()
        self._submit_and_approve(allocation_id)
        with server.db() as con:
            after = self._legacy_snapshot(con)
        self.assertEqual(after, before)

    def test_schema_is_idempotent_and_direct_approval_is_forbidden(self) -> None:
        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "must_start_as_draft"):
                con.execute(
                    """
                    INSERT INTO project_payment_allocations (
                        project_id, finance_entry_id, allocation_key, direction,
                        allocation_purpose, target_type, target_actual_cost_entry_id,
                        entry_kind, source_payment_gross_kopecks, net_amount_kopecks,
                        vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                        source_vat_mode, reason, status, created_by, submitted_by,
                        submitted_at, approved_by, approved_at, created_at, updated_at
                    ) VALUES (?, ?, 'bypass', 'expense', 'supplier_payment', 'actual_cost', ?,
                              'allocation', 24000, 20000, 2000, 4000, 24000, 'gross',
                              'Bypass lifecycle', 'approved', ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        self.project_id,
                        self.expense_payment_id,
                        self.actual_cost_id,
                        self.admin_id,
                        self.admin_id,
                        server.now_ts(),
                        self.admin_id,
                        server.now_ts(),
                        server.now_ts(),
                        server.now_ts(),
                    ),
                )
            before = self._legacy_snapshot(con)
        server.init_db()
        server.init_db()
        with server.db() as con:
            self.assertEqual(self._legacy_snapshot(con), before)
            self.assertEqual(con.execute("PRAGMA foreign_key_check").fetchall(), [])


if __name__ == "__main__":
    unittest.main()
