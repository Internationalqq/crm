from __future__ import annotations

import gc
import json
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import finance  # noqa: E402
import server  # noqa: E402


class FakeHandler:
    def __init__(self, user: dict):
        self.user = user
        self.status: int | None = None
        self.response: dict | None = None

    def require_project_access(self, project_id: int) -> dict:
        return self.user

    def recalc_project_finance_totals(self, con, project_id: int) -> None:
        finance.recalc_project_finance_totals(self, con, project_id)

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class FinanceDeleteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_finance_db = finance.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "finance-delete.sqlite3"
        server.DB_PATH = test_db
        finance.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            timestamp = server.now_ts()
            project = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent,
                    created_at, updated_at
                ) VALUES ('Finance delete', 'Address', 'Client', 'active',
                          0, 1500, 750, ?, ?)
                """,
                (timestamp, timestamp),
            )
            self.project_id = int(project.lastrowid)
            con.commit()
        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        finance.DB_PATH = self.original_finance_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _insert_entry(
        self,
        *,
        direction: str = "income",
        amount: float = 1500,
        document_id: int | None = None,
        status: str = "planned",
    ) -> int:
        with server.db() as con:
            timestamp = server.now_ts()
            entry = con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, category, payment_kind, vat_percent,
                    amount, paid_date, counterparty_name, document_id, status,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, 'Accidental operation', 'cash', 0, ?,
                          ?, 'Customer', ?, ?, ?, ?, ?)
                """,
                (
                    self.project_id,
                    direction,
                    amount,
                    "2026-08-24" if status == "paid" else None,
                    document_id,
                    status,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            con.commit()
            return int(entry.lastrowid)

    def _delete(self, finance_id: int, user: dict | None = None) -> FakeHandler:
        handler = FakeHandler(user or self.admin)
        finance.api_delete_finance_entry(handler, f"/api/finances/{finance_id}")
        return handler

    def test_deletes_unallocated_entry_recalculates_totals_and_keeps_audit_snapshot(self) -> None:
        finance_id = self._insert_entry()

        result = self._delete(finance_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertEqual(result.response["deleted_id"], finance_id)
        with server.db() as con:
            self.assertIsNone(con.execute("SELECT 1 FROM finance_entries WHERE id = ?", (finance_id,)).fetchone())
            project = con.execute("SELECT paid, spent FROM projects WHERE id = ?", (self.project_id,)).fetchone()
            audit = con.execute(
                "SELECT action, payload FROM audit_log WHERE entity = 'finance_entry' AND entity_id = ? ORDER BY id DESC LIMIT 1",
                (finance_id,),
            ).fetchone()
        self.assertEqual(float(project["paid"]), 0)
        self.assertEqual(float(project["spent"]), 0)
        self.assertEqual(audit["action"], "delete_finance_entry")
        snapshot = json.loads(audit["payload"])
        self.assertEqual(snapshot["deleted_entry"]["amount"], 1500)

    def test_project_finances_estimate_total_excludes_soft_deleted_items(self) -> None:
        with server.db() as con:
            con.executemany(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, is_deleted
                ) VALUES (?, ?, 'pcs', ?, ?, ?)
                """,
                (
                    (self.project_id, "Active item", 2, 50, 0),
                    (self.project_id, "Deleted item", 3, 100, 1),
                ),
            )
            con.commit()

        handler = FakeHandler(self.admin)
        finance.api_project_finances(handler, f"/api/projects/{self.project_id}/finances")

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(handler.response["summary"]["estimateTotal"], 100)

    def test_document_linked_entry_cannot_be_deleted(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            document = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, original_name,
                    uploaded_by, created_at, updated_at
                ) VALUES (?, 'Invoice', 'invoice', 'submitted', 'invoice.pdf', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            document_id = int(document.lastrowid)
            con.commit()
        finance_id = self._insert_entry(direction="expense", amount=750, document_id=document_id)

        result = self._delete(finance_id)

        self.assertEqual(result.status, HTTPStatus.CONFLICT)
        self.assertEqual(result.response["error"], "finance_entry_is_not_deletable_draft")
        with server.db() as con:
            self.assertIsNotNone(con.execute("SELECT 1 FROM documents WHERE id = ?", (document_id,)).fetchone())
            self.assertIsNotNone(con.execute("SELECT 1 FROM finance_entries WHERE id = ?", (finance_id,)).fetchone())

    def test_approved_paid_and_cancelled_entries_stay_in_audit_history(self) -> None:
        for status in ("approved", "paid", "cancelled"):
            with self.subTest(status=status):
                finance_id = self._insert_entry(status=status)

                result = self._delete(finance_id)

                self.assertEqual(result.status, HTTPStatus.CONFLICT)
                self.assertEqual(result.response["error"], "finance_entry_is_not_deletable_draft")
                with server.db() as con:
                    self.assertIsNotNone(
                        con.execute("SELECT 1 FROM finance_entries WHERE id = ?", (finance_id,)).fetchone()
                    )

    def test_allocated_entry_is_not_deleted(self) -> None:
        finance_id = self._insert_entry()
        with server.db() as con:
            timestamp = server.now_ts()
            baseline = con.execute(
                """
                INSERT INTO project_financial_baselines (
                    project_id, version_no, status, currency_code,
                    source_snapshot_hash, reason, created_by, created_at, updated_at
                ) VALUES (?, 1, 'draft', 'RUB', 'sha256:finance-delete',
                          'Finance delete guard', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            baseline_id = int(baseline.lastrowid)
            revenue = con.execute(
                """
                INSERT INTO project_revenue_lines (
                    baseline_id, position, title, unit, quantity,
                    unit_price_net_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, source_type,
                    source_reference, created_by, created_at
                ) VALUES (?, 1, 'Customer receipt', 'unit', 1, 150000,
                          150000, 0, 0, 150000, 'no_vat', 'manual',
                          'test:finance-delete', ?, ?)
                """,
                (baseline_id, self.admin_id, timestamp),
            )
            revenue_id = int(revenue.lastrowid)
            con.execute(
                """
                INSERT INTO project_budget_lines (
                    baseline_id, position, line_type, title, unit, quantity,
                    unit_cost_net_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, source_type,
                    source_reference, created_by, created_at
                ) VALUES (?, 1, 'direct_cost', 'Test budget', 'unit', 1,
                          100000, 100000, 0, 0, 100000, 'no_vat', 'manual',
                          'test:finance-delete:budget', ?, ?)
                """,
                (baseline_id, self.admin_id, timestamp),
            )
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?,
                    updated_at = ? WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, baseline_id),
            )
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'approved', approved_by = ?, approved_at = ?,
                    effective_from = '2026-08-24', updated_at = ? WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, baseline_id),
            )
            con.execute(
                """
                INSERT INTO project_payment_allocations (
                    project_id, finance_entry_id, allocation_key, direction,
                    allocation_purpose, target_type, target_revenue_line_id,
                    entry_kind, source_payment_gross_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                    source_vat_mode, reason, status, created_by, created_at, updated_at
                ) VALUES (?, ?, 'delete-guard', 'income', 'customer_receipt',
                          'revenue_line', ?, 'allocation', 150000, 150000,
                          0, 0, 150000, 'no_vat', 'Deletion guard', 'draft', ?, ?, ?)
                """,
                (
                    self.project_id,
                    finance_id,
                    revenue_id,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            con.commit()

        result = self._delete(finance_id)

        self.assertEqual(result.status, HTTPStatus.CONFLICT)
        self.assertEqual(result.response["error"], "finance_entry_has_payment_allocations")
        with server.db() as con:
            self.assertIsNotNone(con.execute("SELECT 1 FROM finance_entries WHERE id = ?", (finance_id,)).fetchone())

    def test_user_without_finance_management_cannot_delete(self) -> None:
        finance_id = self._insert_entry()
        foreman = {"id": self.admin_id, "role": "foreman", "roles": []}

        result = self._delete(finance_id, foreman)

        self.assertEqual(result.status, HTTPStatus.FORBIDDEN)
        with server.db() as con:
            self.assertIsNotNone(con.execute("SELECT 1 FROM finance_entries WHERE id = ?", (finance_id,)).fetchone())


if __name__ == "__main__":
    unittest.main()
