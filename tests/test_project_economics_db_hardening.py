from __future__ import annotations

import gc
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class ProjectEconomicsDbHardeningTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        server.DB_PATH = temp_path / "economics-db-hardening.sqlite3"
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        self.sequence = 0
        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                ) VALUES ('DB hardening', 'Address', 'Client', 'active', 0, 0, 0, ?)
                """,
                (timestamp,),
            )
            self.project_id = int(cursor.lastrowid)
            cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Budget item', 'pcs', 2, 100, 'material')
                """,
                (self.project_id,),
            )
            self.estimate_item_id = int(cursor.lastrowid)
            (
                self.baseline_id,
                self.revenue_line_id,
                self.budget_line_id,
            ) = self._create_baseline(con, version_no=1, status="approved")
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_db_path
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _next_key(self, prefix: str) -> str:
        self.sequence += 1
        return f"{prefix}:{self.sequence}"

    def _create_baseline(
        self,
        con: sqlite3.Connection,
        *,
        version_no: int,
        status: str,
    ) -> tuple[int, int, int]:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, source_snapshot_hash,
                effective_from, reason, created_by, created_at, updated_at
            ) VALUES (?, ?, 'draft', 'RUB', ?, '2026-08-21', ?, ?, ?, ?)
            """,
            (
                self.project_id,
                version_no,
                self._next_key("sha256:baseline"),
                f"Baseline {version_no}",
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        baseline_id = int(cursor.lastrowid)
        revenue = con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, estimate_item_id, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, ?, 'Revenue', 'pcs', 2, 15000, 30000,
                      0, 0, 30000, 'no_vat', 'estimate', ?, ?, ?)
            """,
            (
                baseline_id,
                self.estimate_item_id,
                self._next_key("revenue"),
                self.admin_id,
                timestamp,
            ),
        )
        budget = con.execute(
            """
            INSERT INTO project_budget_lines (
                baseline_id, position, line_type, cost_code, estimate_item_id,
                title, unit, quantity, unit_cost_net_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                source_vat_mode, source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Budget', 'pcs', 2,
                      10000, 20000, 0, 0, 20000, 'no_vat', 'estimate', ?, ?, ?)
            """,
            (
                baseline_id,
                self.estimate_item_id,
                self._next_key("budget"),
                self.admin_id,
                timestamp,
            ),
        )
        if status in {"pending_approval", "approved"}:
            self._submit(con, "project_financial_baselines", baseline_id)
        if status == "approved":
            self._approve(con, "project_financial_baselines", baseline_id)
        return baseline_id, int(revenue.lastrowid), int(budget.lastrowid)

    def _create_commitment(
        self,
        con: sqlite3.Connection,
        *,
        status: str = "draft",
        unit: str = "pcs",
        source_supplier_offer_id: int | None = None,
        with_line: bool = True,
    ) -> tuple[int, int | None]:
        timestamp = server.now_ts()
        number = self._next_key("PO")
        cursor = con.execute(
            """
            INSERT INTO project_commitments (
                project_id, baseline_id, source_supplier_offer_id, commitment_type,
                commitment_no, status, currency_code, counterparty_name, reason,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, 'purchase_order', ?, 'draft', 'RUB', 'Supplier',
                      'Commitment snapshot', ?, ?, ?)
            """,
            (
                self.project_id,
                self.baseline_id,
                source_supplier_offer_id,
                number,
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        commitment_id = int(cursor.lastrowid)
        line_id = None
        if with_line:
            line_id = self._insert_commitment_line(con, commitment_id, unit=unit)
        if status in {"pending_approval", "approved"}:
            self._submit(con, "project_commitments", commitment_id)
        if status == "approved":
            self._approve(con, "project_commitments", commitment_id)
        return commitment_id, line_id

    def _insert_commitment_line(
        self,
        con: sqlite3.Connection,
        commitment_id: int,
        *,
        unit: str,
    ) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_commitment_lines (
                commitment_id, position, budget_line_id, estimate_item_id, title,
                unit, quantity, source_unit_price_kopecks, unit_cost_net_kopecks,
                net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, source_reference,
                created_by, created_at
            ) VALUES (?, 1, ?, ?, 'Ordered item', ?, 1, 10000, 10000, 10000,
                      0, 0, 10000, 'no_vat', ?, ?, ?)
            """,
            (
                commitment_id,
                self.budget_line_id,
                self.estimate_item_id,
                unit,
                self._next_key("commitment-line"),
                self.admin_id,
                timestamp,
            ),
        )
        return int(cursor.lastrowid)

    def _create_actual(
        self,
        con: sqlite3.Connection,
        *,
        status: str = "draft",
        unit: str = "pcs",
        commitment_id: int | None = None,
        commitment_line_id: int | None = None,
        entry_kind: str = "cost",
        reverses_entry_id: int | None = None,
    ) -> int:
        timestamp = server.now_ts()
        source_type = "labor_timesheet" if entry_kind == "cost" else entry_kind
        valuation_method = "approved_rate" if entry_kind == "cost" else "original_snapshot"
        cursor = con.execute(
            """
            INSERT INTO project_actual_cost_entries (
                project_id, baseline_id, budget_line_id, commitment_id,
                commitment_line_id, estimate_item_id, cost_category, entry_kind,
                source_type, source_event_key, reverses_entry_id, title,
                recognition_date, unit, quantity, source_unit_price_kopecks,
                unit_cost_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                valuation_method, source_reference, reason, status, created_by,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'labor', ?, ?, ?, ?, 'Recognized cost',
                      '2026-08-21', ?, 1, 10000, 10000, 10000, 0, 0, 10000,
                      'no_vat', ?, ?, 'Actual snapshot', 'draft', ?, ?, ?)
            """,
            (
                self.project_id,
                self.baseline_id,
                self.budget_line_id,
                commitment_id,
                commitment_line_id,
                self.estimate_item_id,
                entry_kind,
                source_type,
                self._next_key("actual-event"),
                reverses_entry_id,
                unit,
                valuation_method,
                self._next_key("actual-reference"),
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        actual_id = int(cursor.lastrowid)
        if status in {"pending_approval", "approved"}:
            self._submit(con, "project_actual_cost_entries", actual_id)
        if status == "approved":
            self._approve(con, "project_actual_cost_entries", actual_id)
        return actual_id

    def _create_pending_allocation(self, con: sqlite3.Connection) -> int:
        timestamp = server.now_ts()
        payment = con.execute(
            """
            INSERT INTO finance_entries (
                project_id, direction, category, payment_kind, vat_percent, amount,
                planned_date, paid_date, counterparty_name, status, notes,
                created_by, created_at, updated_at
            ) VALUES (?, 'income', 'test', 'bank_no_vat', 0, 200,
                      '2026-08-21', '2026-08-21', 'Customer', 'paid',
                      'Paid receipt', ?, ?, ?)
            """,
            (self.project_id, self.admin_id, timestamp, timestamp),
        )
        cursor = con.execute(
            """
            INSERT INTO project_payment_allocations (
                project_id, finance_entry_id, allocation_key, direction,
                allocation_purpose, target_type, target_revenue_line_id,
                entry_kind, source_payment_gross_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                source_vat_mode, reason, status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, 'income', 'customer_receipt', 'revenue_line', ?,
                      'allocation', 20000, 10000, 0, 0, 10000, 'no_vat',
                      'Allocation snapshot', 'draft', ?, ?, ?)
            """,
            (
                self.project_id,
                int(payment.lastrowid),
                self._next_key("allocation"),
                self.revenue_line_id,
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        allocation_id = int(cursor.lastrowid)
        self._submit(con, "project_payment_allocations", allocation_id)
        return allocation_id

    def _submit(self, con: sqlite3.Connection, table: str, row_id: int) -> None:
        timestamp = server.now_ts()
        con.execute(
            f"""
            UPDATE {table}
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, row_id),
        )

    def _approve(self, con: sqlite3.Connection, table: str, row_id: int) -> None:
        timestamp = server.now_ts()
        con.execute(
            f"""
            UPDATE {table}
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, row_id),
        )

    def test_pending_snapshots_reject_business_mutation_on_transition(self) -> None:
        with server.db() as con:
            pending_baseline, _, _ = self._create_baseline(
                con, version_no=2, status="pending_approval"
            )
            pending_commitment, _ = self._create_commitment(
                con, status="pending_approval"
            )
            pending_actual = self._create_actual(con, status="pending_approval")
            pending_allocation = self._create_pending_allocation(con)

            for table, row_id, error in (
                (
                    "project_financial_baselines",
                    pending_baseline,
                    "pending_financial_baseline_snapshot_is_immutable",
                ),
                (
                    "project_commitments",
                    pending_commitment,
                    "pending_project_commitment_snapshot_is_immutable",
                ),
                (
                    "project_actual_cost_entries",
                    pending_actual,
                    "pending_project_actual_cost_snapshot_is_immutable",
                ),
                (
                    "project_payment_allocations",
                    pending_allocation,
                    "pending_project_payment_allocation_snapshot_is_immutable",
                ),
            ):
                with self.assertRaisesRegex(sqlite3.IntegrityError, error):
                    con.execute(
                        f"""
                        UPDATE {table}
                        SET submitted_at = submitted_at + 1, updated_at = updated_at + 1
                        WHERE id = ?
                        """,
                        (row_id,),
                    )

            timestamp = server.now_ts()
            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "pending_financial_baseline_snapshot_is_immutable",
            ):
                con.execute(
                    """
                    UPDATE project_financial_baselines
                    SET status = 'draft', submitted_by = NULL, submitted_at = NULL,
                        reason = 'tampered during return', updated_at = ?
                    WHERE id = ?
                    """,
                    (timestamp, pending_baseline),
                )

            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "pending_project_commitment_snapshot_is_immutable",
            ):
                con.execute(
                    """
                    UPDATE project_commitments
                    SET status = 'approved', approved_by = ?, approved_at = ?,
                        counterparty_name = 'Swapped supplier', updated_at = ?
                    WHERE id = ?
                    """,
                    (self.admin_id, timestamp, timestamp, pending_commitment),
                )

            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "pending_project_actual_cost_snapshot_is_immutable",
            ):
                con.execute(
                    """
                    UPDATE project_actual_cost_entries
                    SET status = 'approved', approved_by = ?, approved_at = ?,
                        title = 'Swapped cost', updated_at = ?
                    WHERE id = ?
                    """,
                    (self.admin_id, timestamp, timestamp, pending_actual),
                )

            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "pending_project_payment_allocation_snapshot_is_immutable",
            ):
                con.execute(
                    """
                    UPDATE project_payment_allocations
                    SET status = 'approved', approved_by = ?, approved_at = ?,
                        reason = 'Swapped allocation', updated_at = ?
                    WHERE id = ?
                    """,
                    (self.admin_id, timestamp, timestamp, pending_allocation),
                )

            for table, row_id, field, expected in (
                ("project_financial_baselines", pending_baseline, "reason", "Baseline 2"),
                ("project_commitments", pending_commitment, "counterparty_name", "Supplier"),
                ("project_actual_cost_entries", pending_actual, "title", "Recognized cost"),
                (
                    "project_payment_allocations",
                    pending_allocation,
                    "reason",
                    "Allocation snapshot",
                ),
            ):
                row = con.execute(
                    f"SELECT status, {field} FROM {table} WHERE id = ?", (row_id,)
                ).fetchone()
                self.assertEqual(row["status"], "pending_approval")
                self.assertEqual(row[field], expected)

            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'draft', submitted_by = NULL, submitted_at = NULL,
                    updated_at = ? WHERE id = ?
                """,
                (timestamp, pending_baseline),
            )
            for table, row_id in (
                ("project_commitments", pending_commitment),
                ("project_actual_cost_entries", pending_actual),
                ("project_payment_allocations", pending_allocation),
            ):
                con.execute(
                    f"""
                    UPDATE {table}
                    SET status = 'draft', submitted_by = NULL, submitted_at = NULL,
                        approved_by = NULL, approved_at = NULL, updated_at = ?
                    WHERE id = ?
                    """,
                    (timestamp, row_id),
                )
                self._submit(con, table, row_id)
                self._approve(con, table, row_id)

    def test_commitment_and_actual_units_are_guarded_on_insert_and_update(self) -> None:
        with server.db() as con:
            commitment_id, _ = self._create_commitment(con, with_line=False)
            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "project_commitment_operational_unit_mismatch",
            ):
                self._insert_commitment_line(con, commitment_id, unit="kg")
            line_id = self._insert_commitment_line(con, commitment_id, unit="pcs")
            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "project_commitment_operational_unit_mismatch",
            ):
                con.execute(
                    "UPDATE project_commitment_lines SET unit = 'kg' WHERE id = ?",
                    (line_id,),
                )

            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "project_actual_cost_operational_unit_mismatch",
            ):
                self._create_actual(con, unit="kg")
            actual_id = self._create_actual(con, unit="pcs")
            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "project_actual_cost_operational_unit_mismatch",
            ):
                con.execute(
                    "UPDATE project_actual_cost_entries SET unit = 'kg' WHERE id = ?",
                    (actual_id,),
                )

    def test_grandfathered_unit_mismatch_is_rejected_at_approval(self) -> None:
        with server.db() as con:
            commitment_id, _ = self._create_commitment(con, with_line=False)
            con.execute("DROP TRIGGER trg_project_commitment_line_unit_insert_guard_v1")
            self._insert_commitment_line(con, commitment_id, unit="kg")

            con.execute("DROP TRIGGER trg_project_actual_cost_unit_insert_guard_v1")
            actual_id = self._create_actual(con, unit="kg")
            con.commit()

        server.init_db()

        with server.db() as con:
            self._submit(con, "project_commitments", commitment_id)
            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "project_commitment_operational_unit_mismatch",
            ):
                self._approve(con, "project_commitments", commitment_id)
            con.rollback()

            self._submit(con, "project_actual_cost_entries", actual_id)
            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "project_actual_cost_operational_unit_mismatch",
            ):
                self._approve(con, "project_actual_cost_entries", actual_id)

    def test_correction_can_be_approved_after_commitment_is_cancelled(self) -> None:
        with server.db() as con:
            commitment_id, commitment_line_id = self._create_commitment(
                con, status="approved"
            )
            original_id = self._create_actual(
                con,
                status="approved",
                commitment_id=commitment_id,
                commitment_line_id=commitment_line_id,
            )
            timestamp = server.now_ts()
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?,
                    cancellation_reason = 'Order closed', updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, commitment_id),
            )
            reversal_id = self._create_actual(
                con,
                status="pending_approval",
                commitment_id=commitment_id,
                commitment_line_id=commitment_line_id,
                entry_kind="reversal",
                reverses_entry_id=original_id,
            )
            self._approve(con, "project_actual_cost_entries", reversal_id)
            status = con.execute(
                "SELECT status FROM project_actual_cost_entries WHERE id = ?",
                (reversal_id,),
            ).fetchone()[0]
            self.assertEqual(status, "approved")

    def test_offer_duplicate_migration_is_non_destructive_and_future_safe(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            offer = con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_name, price, qty, unit,
                    status, created_by, activated_by, activated_at, created_at, updated_at
                ) VALUES (?, ?, 'Selected supplier', 100, 2, 'pcs', 'selected',
                          ?, ?, ?, ?, ?)
                """,
                (
                    self.project_id,
                    self.estimate_item_id,
                    self.admin_id,
                    self.admin_id,
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )
            offer_id = int(offer.lastrowid)
            con.execute("DROP TRIGGER trg_project_commitment_open_offer_insert_guard_v1")
            con.execute("DROP TRIGGER trg_project_commitment_open_offer_update_guard_v1")
            first, _ = self._create_commitment(
                con, source_supplier_offer_id=offer_id, with_line=False
            )
            second, _ = self._create_commitment(
                con, source_supplier_offer_id=offer_id, with_line=False
            )
            con.commit()

        server.init_db()

        with server.db() as con:
            rows = con.execute(
                """
                SELECT id FROM project_commitments
                WHERE source_supplier_offer_id = ? AND status <> 'cancelled'
                ORDER BY id
                """,
                (offer_id,),
            ).fetchall()
            self.assertEqual([int(row[0]) for row in rows], [first, second])
            index = next(
                row
                for row in con.execute("PRAGMA index_list(project_commitments)")
                if row["name"] == "idx_project_commitments_one_open_per_offer"
            )
            self.assertEqual(int(index["unique"]), 0)
            with self.assertRaisesRegex(
                sqlite3.IntegrityError, "project_commitment_offer_already_linked"
            ):
                self._create_commitment(
                    con, source_supplier_offer_id=offer_id, with_line=False
                )


if __name__ == "__main__":
    unittest.main()
