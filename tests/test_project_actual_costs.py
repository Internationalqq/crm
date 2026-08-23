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


class ProjectActualCostTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "project-actual-costs.sqlite3"
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
                )
                VALUES ('Actual cost project', 'Address', 'Client', 'active',
                        1000000.25, 250000.75, 125000.50, ?)
                """,
                (timestamp,),
            )
            self.project_id = int(project_cursor.lastrowid)
            item_cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                )
                VALUES (?, 'Concrete', 'm3', 2, 150, 'material')
                """,
                (self.project_id,),
            )
            self.estimate_item_id = int(item_cursor.lastrowid)
            self.baseline_id, self.budget_line_id = self._create_approved_baseline(con)
            self.commitment_id, self.commitment_line_id = self._create_approved_commitment(con)
            move_cursor = con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price, comment,
                    created_by, created_at
                )
                VALUES (?, ?, 'receipt', 2, 120, 'Accepted direct delivery', ?, ?)
                """,
                (self.project_id, self.estimate_item_id, self.admin_id, timestamp),
            )
            self.stock_move_id = int(move_cursor.lastrowid)
            zero_move_cursor = con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price, comment,
                    created_by, created_at
                )
                VALUES (?, ?, 'receipt', 1, 0, 'Legacy warehouse issue shadow move', ?, ?)
                """,
                (self.project_id, self.estimate_item_id, self.admin_id, timestamp),
            )
            self.zero_price_move_id = int(zero_move_cursor.lastrowid)
            warehouse_item_cursor = con.execute(
                """
                INSERT INTO warehouse_items (
                    item_type, name, unit, qty, created_at, updated_at
                ) VALUES ('material', 'Concrete from central warehouse', 'm3', 10, ?, ?)
                """,
                (timestamp, timestamp),
            )
            transfer_cursor = con.execute(
                """
                INSERT INTO warehouse_transfers (
                    warehouse_item_id, project_id, estimate_item_id, qty, unit,
                    comment, created_by, created_at
                ) VALUES (?, ?, ?, 1, 'm3', 'Issued to project', ?, ?)
                """,
                (
                    int(warehouse_item_cursor.lastrowid),
                    self.project_id,
                    self.estimate_item_id,
                    self.admin_id,
                    timestamp,
                ),
            )
            self.warehouse_transfer_id = int(transfer_cursor.lastrowid)
            accepted_doc_cursor = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, uploaded_by, created_at, updated_at
                ) VALUES (?, 'Signed service act', 'service_act', 'accepted', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            self.accepted_document_id = int(accepted_doc_cursor.lastrowid)
            draft_doc_cursor = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, uploaded_by, created_at, updated_at
                ) VALUES (?, 'Draft service act', 'service_act', 'draft', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            self.draft_document_id = int(draft_doc_cursor.lastrowid)
            invoice_cursor = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, uploaded_by, created_at, updated_at
                ) VALUES (?, 'Supplier invoice', 'invoice', 'approved', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            self.invoice_document_id = int(invoice_cursor.lastrowid)
            con.commit()

        self.admin_user = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        economics.DB_PATH = self.original_economics_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _create_approved_baseline(self, con: sqlite3.Connection) -> tuple[int, int]:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, source_snapshot_hash,
                reason, created_by, created_at, updated_at
            ) VALUES (?, 1, 'draft', 'RUB', 'sha256:actual-cost-test',
                      'Actual cost test baseline', ?, ?, ?)
            """,
            (self.project_id, self.admin_id, timestamp, timestamp),
        )
        baseline_id = int(cursor.lastrowid)
        con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, estimate_item_id, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, ?, 'Contract revenue', 'm3', 2, 15000, 30000,
                      0, 0, 30000, 'no_vat', 'estimate', 'estimate:revenue:1', ?, ?)
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
            ) VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Concrete target', 'm3', 2,
                      10000, 20000, 0, 0, 20000, 'no_vat', 'estimate',
                      'estimate:budget:1', ?, ?)
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
                effective_from = '2026-08-20', updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )
        return baseline_id, int(budget_cursor.lastrowid)

    def _create_approved_commitment(self, con: sqlite3.Connection) -> tuple[int, int]:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_commitments (
                project_id, baseline_id, commitment_type, commitment_no, status,
                currency_code, counterparty_name, reason, created_by, created_at, updated_at
            ) VALUES (?, ?, 'purchase_order', 'PO-ACTUAL-1', 'draft', 'RUB',
                      'Concrete supplier', 'Approved order', ?, ?, ?)
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
            ) VALUES (?, 1, ?, ?, 'Concrete order', 'm3', 2, 12000, 10000,
                      20000, 2000, 4000, 24000, 'gross', 'test:commitment:1', ?, ?)
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

    def _stock_payload(self) -> dict:
        return {
            "stockMoveId": self.stock_move_id,
            "baselineId": self.baseline_id,
            "budgetLineId": self.budget_line_id,
            "commitmentLineId": self.commitment_line_id,
            "recognitionDate": "2026-08-20",
            "vatMode": "gross",
            "vatRateBasisPoints": 2000,
            "reason": "Accepted delivery to project",
        }

    def _create_stock_actual(self) -> int:
        handler = FakeHandler(self.admin_user, self._stock_payload())
        economics.api_create_actual_cost_from_stock_move(
            handler,
            f"/api/projects/{self.project_id}/actual-costs/from-stock-move",
        )
        self.assertEqual(handler.status, HTTPStatus.CREATED, handler.response)
        return int(handler.response["id"])

    def _submit_and_approve(self, entry_id: int) -> None:
        submit = FakeHandler(self.admin_user)
        economics.api_submit_actual_cost(submit, f"/api/actual-costs/{entry_id}/submit")
        self.assertEqual(submit.status, HTTPStatus.OK, submit.response)
        approve = FakeHandler(self.admin_user)
        economics.api_approve_actual_cost(approve, f"/api/actual-costs/{entry_id}/approve")
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
        finance = [tuple(row) for row in con.execute("SELECT * FROM finance_entries ORDER BY id").fetchall()]
        return projects, items, finance

    def test_stock_receipt_becomes_actual_only_after_explicit_approval(self) -> None:
        entry_id = self._create_stock_actual()
        listing = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(listing, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(listing.response["summary"]["approvedNetKopecks"], 0)

        self._submit_and_approve(entry_id)
        listing = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(listing, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(listing.response["summary"]["approvedNetKopecks"], 20000)
        self.assertEqual(listing.response["summary"]["approvedVatKopecks"], 4000)
        self.assertEqual(listing.response["summary"]["approvedGrossKopecks"], 24000)

    def test_source_event_is_idempotent_and_zero_price_move_is_rejected(self) -> None:
        entry_id = self._create_stock_actual()
        duplicate = FakeHandler(self.admin_user, self._stock_payload())
        economics.api_create_actual_cost_from_stock_move(
            duplicate,
            f"/api/projects/{self.project_id}/actual-costs/from-stock-move",
        )
        self.assertEqual(duplicate.status, HTTPStatus.CONFLICT)
        self.assertEqual(duplicate.response["actualCostEntryId"], entry_id)

        zero_payload = self._stock_payload()
        zero_payload["stockMoveId"] = self.zero_price_move_id
        zero = FakeHandler(self.admin_user, zero_payload)
        economics.api_create_actual_cost_from_stock_move(
            zero,
            f"/api/projects/{self.project_id}/actual-costs/from-stock-move",
        )
        self.assertEqual(zero.status, HTTPStatus.CONFLICT)
        self.assertEqual(zero.response, {"error": "priced_material_receipt_required"})

    def test_approved_actual_reduces_commitment_remaining_without_changing_commitment(self) -> None:
        before = FakeHandler(self.admin_user)
        economics.api_project_commitments(before, f"/api/projects/{self.project_id}/commitments")
        self.assertEqual(before.response["summary"]["approvedNetKopecks"], 20000)
        self.assertEqual(before.response["summary"]["recognizedNetKopecks"], 0)
        self.assertEqual(before.response["summary"]["remainingNetKopecks"], 20000)

        entry_id = self._create_stock_actual()
        self._submit_and_approve(entry_id)
        after = FakeHandler(self.admin_user)
        economics.api_project_commitments(after, f"/api/projects/{self.project_id}/commitments")
        self.assertEqual(after.response["summary"]["approvedNetKopecks"], 20000)
        self.assertEqual(after.response["summary"]["recognizedNetKopecks"], 20000)
        self.assertEqual(after.response["summary"]["remainingNetKopecks"], 0)
        self.assertEqual(after.response["summary"]["overrunNetKopecks"], 0)

    def test_invoice_is_not_cost_evidence_and_draft_act_cannot_be_submitted(self) -> None:
        base_payload = {
            "sourceType": "service_act",
            "sourceEventKey": "line-1",
            "title": "Accepted service",
            "baselineId": self.baseline_id,
            "budgetLineId": self.budget_line_id,
            "estimateItemId": self.estimate_item_id,
            "recognitionDate": "2026-08-20",
            "unitPrice": 100,
            "quantity": 1,
            "vatMode": "no_vat",
            "vatRateBasisPoints": 0,
            "reason": "Act evidence",
        }
        invoice_payload = dict(base_payload, documentId=self.invoice_document_id)
        invoice = FakeHandler(self.admin_user, invoice_payload)
        economics.api_create_actual_cost(invoice, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(invoice.status, HTTPStatus.CONFLICT)
        self.assertEqual(invoice.response, {"error": "invoice_is_not_actual_cost_evidence"})

        draft_payload = dict(base_payload, documentId=self.draft_document_id)
        draft = FakeHandler(self.admin_user, draft_payload)
        economics.api_create_actual_cost(draft, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(draft.status, HTTPStatus.CREATED)
        submit = FakeHandler(self.admin_user)
        economics.api_submit_actual_cost(submit, f"/api/actual-costs/{draft.response['id']}/submit")
        self.assertEqual(submit.status, HTTPStatus.CONFLICT)
        self.assertEqual(submit.response, {"error": "accepted_non_invoice_document_required"})

    def test_accepted_act_and_approved_resource_rate_are_supported(self) -> None:
        service = FakeHandler(
            self.admin_user,
            {
                "sourceType": "service_act",
                "sourceEventKey": "service-line-1",
                "documentId": self.accepted_document_id,
                "title": "Accepted service act",
                "baselineId": self.baseline_id,
                "budgetLineId": self.budget_line_id,
                "recognitionDate": "2026-08-20",
                "unitPrice": 50,
                "quantity": 2,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "reason": "Signed act",
            },
        )
        economics.api_create_actual_cost(service, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(service.status, HTTPStatus.CREATED, service.response)
        with server.db() as con:
            inherited_unit = con.execute(
                "SELECT unit FROM project_actual_cost_entries WHERE id = ?",
                (int(service.response["id"]),),
            ).fetchone()[0]
        self.assertEqual(inherited_unit, "m3")
        self._submit_and_approve(int(service.response["id"]))

        labor = FakeHandler(
            self.admin_user,
            {
                "sourceType": "labor_timesheet",
                "sourceEventKey": "timesheet:2026-08-20:worker-1",
                "title": "Approved labor timesheet",
                "baselineId": self.baseline_id,
                "budgetLineId": self.budget_line_id,
                "recognitionDate": "2026-08-20",
                "unit": "m3",
                "unitPrice": 10,
                "quantity": 8,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "reason": "Approved timesheet and internal rate",
            },
        )
        economics.api_create_actual_cost(labor, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(labor.status, HTTPStatus.CREATED, labor.response)
        self._submit_and_approve(int(labor.response["id"]))

        listing = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(listing, f"/api/projects/{self.project_id}/actual-costs")
        self.assertEqual(listing.response["summary"]["approvedNetKopecks"], 18000)

    def test_explicit_operational_unit_mismatch_is_rejected(self) -> None:
        handler = FakeHandler(
            self.admin_user,
            {
                "sourceType": "labor_timesheet",
                "sourceEventKey": "timesheet:mismatched-unit",
                "title": "Mismatched quantity unit",
                "baselineId": self.baseline_id,
                "budgetLineId": self.budget_line_id,
                "recognitionDate": "2026-08-20",
                "unit": "hour",
                "unitPrice": 10,
                "quantity": 8,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "reason": "Must not mix hours and cubic metres",
            },
        )
        economics.api_create_actual_cost(
            handler, f"/api/projects/{self.project_id}/actual-costs"
        )
        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response, {"error": "operational_unit_mismatch"})

    def test_warehouse_issue_requires_explicit_nonzero_valuation(self) -> None:
        payload = {
            "warehouseTransferId": self.warehouse_transfer_id,
            "baselineId": self.baseline_id,
            "budgetLineId": self.budget_line_id,
            "recognitionDate": "2026-08-20",
            "unitPrice": 90,
            "vatMode": "no_vat",
            "vatRateBasisPoints": 0,
            "reason": "Valued central warehouse issue",
        }
        missing_method = FakeHandler(self.admin_user, payload)
        economics.api_create_actual_cost_from_warehouse_transfer(
            missing_method,
            f"/api/projects/{self.project_id}/actual-costs/from-warehouse-transfer",
        )
        self.assertEqual(missing_method.status, HTTPStatus.BAD_REQUEST)

        valued = FakeHandler(self.admin_user, dict(payload, valuationMethod="moving_weighted_average"))
        economics.api_create_actual_cost_from_warehouse_transfer(
            valued,
            f"/api/projects/{self.project_id}/actual-costs/from-warehouse-transfer",
        )
        self.assertEqual(valued.status, HTTPStatus.CREATED, valued.response)
        self._submit_and_approve(int(valued.response["id"]))

    def test_reversal_is_separate_approved_record_and_history_is_immutable(self) -> None:
        original_id = self._create_stock_actual()
        self._submit_and_approve(original_id)
        cancelled = FakeHandler(
            self.admin_user,
            {"cancellationReason": "Unaccepted order remainder cancelled"},
        )
        economics.api_cancel_commitment(
            cancelled, f"/api/commitments/{self.commitment_id}/cancel"
        )
        self.assertEqual(cancelled.status, HTTPStatus.OK, cancelled.response)
        reverse = FakeHandler(
            self.admin_user,
            {"recognitionDate": "2026-08-21", "reason": "Accepted supplier return"},
        )
        economics.api_reverse_actual_cost(reverse, f"/api/actual-costs/{original_id}/reverse")
        self.assertEqual(reverse.status, HTTPStatus.CREATED, reverse.response)
        reversal_id = int(reverse.response["id"])

        before_approval = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(
            before_approval, f"/api/projects/{self.project_id}/actual-costs"
        )
        self.assertEqual(before_approval.response["summary"]["approvedNetKopecks"], 20000)
        self._submit_and_approve(reversal_id)
        after_approval = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(
            after_approval, f"/api/projects/{self.project_id}/actual-costs"
        )
        self.assertEqual(after_approval.response["summary"]["approvedNetKopecks"], 0)

        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "approved_project_actual_cost_is_immutable"):
                con.execute(
                    "UPDATE project_actual_cost_entries SET reason = 'Changed' WHERE id = ?",
                    (original_id,),
                )
            event_id = int(
                con.execute(
                    "SELECT id FROM project_actual_cost_events WHERE actual_cost_entry_id = ? LIMIT 1",
                    (original_id,),
                ).fetchone()[0]
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "event_is_immutable"):
                con.execute("DELETE FROM project_actual_cost_events WHERE id = ?", (event_id,))

    def test_actual_cost_api_role_matrix(self) -> None:
        allowed_roles = {"main_admin", "admin", "director"}
        for role in auth.ROLE_CODES:
            with self.subTest(role=role):
                handler = FakeHandler({"id": self.admin_id, "role": role, "roles": []})
                economics.api_project_actual_costs(
                    handler,
                    f"/api/projects/{self.project_id}/actual-costs",
                )
                if role in allowed_roles:
                    self.assertEqual(handler.status, HTTPStatus.OK)
                    self.assertIn("summary", handler.response)
                else:
                    self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
                    self.assertEqual(handler.response, {"error": "forbidden"})

    def test_actual_cost_and_payment_are_independent_and_legacy_data_is_unchanged(self) -> None:
        with server.db() as con:
            before = self._legacy_snapshot(con)
        entry_id = self._create_stock_actual()
        self._submit_and_approve(entry_id)
        with server.db() as con:
            after_actual = self._legacy_snapshot(con)
        self.assertEqual(after_actual, before)

        listing = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(listing, f"/api/projects/{self.project_id}/actual-costs")
        actual_before_payment = listing.response["summary"]
        with server.db() as con:
            con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, category, payment_kind, amount, paid_date,
                    counterparty_name, status, notes, created_by, created_at, updated_at
                ) VALUES (?, 'expense', 'materials', 'bank_vat', 240, '2026-08-22',
                          'Concrete supplier', 'paid', 'Payment is not cost recognition', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, server.now_ts(), server.now_ts()),
            )
            con.commit()
        listing_after_payment = FakeHandler(self.admin_user)
        economics.api_project_actual_costs(
            listing_after_payment,
            f"/api/projects/{self.project_id}/actual-costs",
        )
        self.assertEqual(listing_after_payment.response["summary"], actual_before_payment)

    def test_schema_requires_lifecycle_metadata_and_is_idempotent(self) -> None:
        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "must_start_as_draft"):
                con.execute(
                    """
                    INSERT INTO project_actual_cost_entries (
                        project_id, baseline_id, budget_line_id, cost_category, entry_kind,
                        source_type, source_event_key, title, recognition_date, quantity,
                        source_unit_price_kopecks, unit_cost_net_kopecks, net_amount_kopecks,
                        vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                        source_vat_mode, valuation_method, source_reference, reason, status,
                        created_by, submitted_by, submitted_at, approved_by, approved_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, 'labor', 'cost', 'labor_timesheet', 'direct-approved',
                              'Bypass', '2026-08-20', 1, 100, 100, 100, 0, 0, 100,
                              'no_vat', 'approved_rate', 'test', 'Bypass lifecycle', 'approved',
                              ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        self.project_id, self.baseline_id, self.budget_line_id,
                        self.admin_id, self.admin_id, server.now_ts(), self.admin_id,
                        server.now_ts(), server.now_ts(), server.now_ts(),
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
