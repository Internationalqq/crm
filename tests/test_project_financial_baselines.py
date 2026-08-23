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


class ProjectFinancialBaselineSchemaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = server.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        server.DB_PATH = temp_path / "financial-baseline.sqlite3"
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            self.project_id = self._insert_project(
                con,
                title="Legacy project",
                budget=1_856_336.88,
                paid=123_456.78,
                spent=98_765.43,
            )
            self.other_project_id = self._insert_project(
                con,
                title="Other project",
                budget=250_000.01,
                paid=0,
                spent=0,
            )
            self.estimate_item_id = self._insert_estimate_item(
                con,
                self.project_id,
                title="Revenue item",
                planned_price=12_345.67,
            )
            self.other_estimate_item_id = self._insert_estimate_item(
                con,
                self.other_project_id,
                title="Other item",
                planned_price=999.99,
            )
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_db_path
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    @staticmethod
    def _insert_project(
        con: sqlite3.Connection,
        *,
        title: str,
        budget: float,
        paid: float,
        spent: float,
    ) -> int:
        cursor = con.execute(
            """
            INSERT INTO projects (
                title, address, client_name, status, budget, paid, spent, created_at
            )
            VALUES (?, 'Test address', 'Test client', 'active', ?, ?, ?, ?)
            """,
            (title, budget, paid, spent, server.now_ts()),
        )
        return int(cursor.lastrowid)

    @staticmethod
    def _insert_estimate_item(
        con: sqlite3.Connection,
        project_id: int,
        *,
        title: str,
        planned_price: float,
    ) -> int:
        cursor = con.execute(
            """
            INSERT INTO estimate_items (
                project_id, title, unit, planned_qty, planned_price, item_kind
            )
            VALUES (?, ?, 'unit', 2.5, ?, 'material')
            """,
            (project_id, title, planned_price),
        )
        return int(cursor.lastrowid)

    def _create_draft(self, con: sqlite3.Connection, version_no: int = 1) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, source_snapshot_hash,
                reason, created_by, created_at, updated_at
            )
            VALUES (?, ?, 'draft', 'RUB', ?, 'Initial approved baseline candidate', ?, ?, ?)
            """,
            (self.project_id, version_no, f"sha256:test-{version_no}", self.admin_id, timestamp, timestamp),
        )
        return int(cursor.lastrowid)

    def _add_revenue_line(
        self,
        con: sqlite3.Connection,
        baseline_id: int,
        *,
        estimate_item_id: int | None = None,
    ) -> int:
        cursor = con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, estimate_item_id, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                source_type, source_reference, created_by, created_at
            )
            VALUES (?, 1, ?, 'Contract revenue', 'unit', 1, 100000, 100000,
                    2000, 20000, 120000, 'gross', 'estimate', ?, ?, ?)
            """,
            (
                baseline_id,
                estimate_item_id if estimate_item_id is not None else self.estimate_item_id,
                "estimate:item:1",
                self.admin_id,
                server.now_ts(),
            ),
        )
        return int(cursor.lastrowid)

    def _add_budget_line(self, con: sqlite3.Connection, baseline_id: int) -> int:
        cursor = con.execute(
            """
            INSERT INTO project_budget_lines (
                baseline_id, position, line_type, cost_code, estimate_item_id,
                title, unit, quantity, unit_cost_net_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                source_vat_mode, source_type, source_reference, created_by, created_at
            )
            VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Target cost', 'unit', 1,
                    70000, 70000, 0, 0, 70000, 'no_vat', 'estimate', ?, ?, ?)
            """,
            (
                baseline_id,
                self.estimate_item_id,
                "estimate:item:1",
                self.admin_id,
                server.now_ts(),
            ),
        )
        return int(cursor.lastrowid)

    def _submit(self, con: sqlite3.Connection, baseline_id: int) -> None:
        timestamp = server.now_ts()
        con.execute(
            """
            UPDATE project_financial_baselines
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )

    def _approve(self, con: sqlite3.Connection, baseline_id: int) -> None:
        timestamp = server.now_ts()
        con.execute(
            """
            UPDATE project_financial_baselines
            SET status = 'approved', approved_by = ?, approved_at = ?,
                effective_from = '2026-08-20', updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )

    @staticmethod
    def _legacy_snapshot(con: sqlite3.Connection) -> tuple[list[tuple], list[tuple]]:
        projects = [
            tuple(row)
            for row in con.execute(
                """
                SELECT id, quote(budget), typeof(budget), quote(paid), typeof(paid),
                       quote(spent), typeof(spent)
                FROM projects
                ORDER BY id
                """
            ).fetchall()
        ]
        estimate_items = [
            tuple(row)
            for row in con.execute(
                """
                SELECT id, project_id, quote(planned_price), typeof(planned_price)
                FROM estimate_items
                ORDER BY id
                """
            ).fetchall()
        ]
        return projects, estimate_items

    def test_required_status_and_approval_metadata_are_enforced(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute(
                    """
                    INSERT INTO project_financial_baselines (
                        project_id, version_no, currency_code, source_snapshot_hash,
                        reason, created_by, created_at, updated_at
                    )
                    VALUES (?, 1, 'RUB', 'sha256:no-status', 'Missing status', ?, ?, ?)
                    """,
                    (self.project_id, self.admin_id, timestamp, timestamp),
                )

            with self.assertRaisesRegex(sqlite3.IntegrityError, "must_start_as_draft"):
                con.execute(
                    """
                    INSERT INTO project_financial_baselines (
                        project_id, version_no, status, currency_code, source_snapshot_hash,
                        effective_from, reason, created_by, submitted_by, submitted_at,
                        approved_by, approved_at, created_at, updated_at
                    )
                    VALUES (?, 2, 'approved', 'RUB', 'sha256:direct-approved',
                            '2026-08-20', 'Bypass lifecycle', ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        self.project_id,
                        self.admin_id,
                        self.admin_id,
                        timestamp,
                        self.admin_id,
                        timestamp,
                        timestamp,
                        timestamp,
                    ),
                )

            baseline_id = self._create_draft(con)
            self._add_revenue_line(con, baseline_id)
            self._add_budget_line(con, baseline_id)
            self._submit(con, baseline_id)
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute(
                    """
                    UPDATE project_financial_baselines
                    SET status = 'approved', effective_from = '2026-08-20', updated_at = ?
                    WHERE id = ?
                    """,
                    (server.now_ts(), baseline_id),
                )

    def test_approval_requires_both_revenue_and_budget_lines(self) -> None:
        with server.db() as con:
            empty_baseline_id = self._create_draft(con, version_no=1)
            self._submit(con, empty_baseline_id)
            with self.assertRaisesRegex(sqlite3.IntegrityError, "revenue_lines_required"):
                self._approve(con, empty_baseline_id)

            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'draft', submitted_by = NULL, submitted_at = NULL, updated_at = ?
                WHERE id = ?
                """,
                (server.now_ts(), empty_baseline_id),
            )
            self._add_revenue_line(con, empty_baseline_id)
            self._submit(con, empty_baseline_id)
            with self.assertRaisesRegex(sqlite3.IntegrityError, "budget_lines_required"):
                self._approve(con, empty_baseline_id)

    def test_approved_baseline_and_lines_are_immutable(self) -> None:
        with server.db() as con:
            baseline_id = self._create_draft(con)
            revenue_line_id = self._add_revenue_line(con, baseline_id)
            self._add_budget_line(con, baseline_id)
            self._submit(con, baseline_id)
            self._approve(con, baseline_id)

            with self.assertRaisesRegex(sqlite3.IntegrityError, "approved_financial_baseline_is_immutable"):
                con.execute(
                    "UPDATE project_financial_baselines SET reason = 'Changed' WHERE id = ?",
                    (baseline_id,),
                )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "lines_are_not_editable"):
                con.execute(
                    "UPDATE project_revenue_lines SET net_amount_kopecks = 1 WHERE id = ?",
                    (revenue_line_id,),
                )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "non_draft_financial_baseline_cannot_be_deleted"):
                con.execute("DELETE FROM project_financial_baselines WHERE id = ?", (baseline_id,))

    def test_only_one_approved_version_per_project(self) -> None:
        with server.db() as con:
            first_id = self._create_draft(con, version_no=1)
            self._add_revenue_line(con, first_id)
            self._add_budget_line(con, first_id)
            self._submit(con, first_id)
            self._approve(con, first_id)

            second_id = self._create_draft(con, version_no=2)
            self._add_revenue_line(con, second_id)
            self._add_budget_line(con, second_id)
            self._submit(con, second_id)
            with self.assertRaises(sqlite3.IntegrityError):
                self._approve(con, second_id)

    def test_approved_version_can_only_be_replaced_by_a_later_version(self) -> None:
        with server.db() as con:
            first_id = self._create_draft(con, version_no=1)
            self._add_revenue_line(con, first_id)
            self._add_budget_line(con, first_id)
            self._submit(con, first_id)
            self._approve(con, first_id)

            second_id = self._create_draft(con, version_no=2)
            self._add_revenue_line(con, second_id)
            self._add_budget_line(con, second_id)
            self._submit(con, second_id)

            timestamp = server.now_ts()
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'superseded', superseded_by_baseline_id = ?,
                    superseded_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (second_id, timestamp, timestamp, first_id),
            )
            self._approve(con, second_id)

            statuses = [
                tuple(row)
                for row in con.execute(
                    """
                    SELECT version_no, status, superseded_by_baseline_id
                    FROM project_financial_baselines
                    WHERE project_id = ?
                    ORDER BY version_no
                    """,
                    (self.project_id,),
                ).fetchall()
            ]
            self.assertEqual(
                statuses,
                [(1, "superseded", second_id), (2, "approved", None)],
            )

    def test_line_cannot_reference_estimate_item_from_another_project(self) -> None:
        with server.db() as con:
            baseline_id = self._create_draft(con)
            with self.assertRaisesRegex(sqlite3.IntegrityError, "estimate_item_project_mismatch"):
                self._add_revenue_line(
                    con,
                    baseline_id,
                    estimate_item_id=self.other_estimate_item_id,
                )

    def test_amount_and_vat_constraints_use_exact_kopecks(self) -> None:
        with server.db() as con:
            baseline_id = self._create_draft(con)
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute(
                    """
                    INSERT INTO project_revenue_lines (
                        baseline_id, position, title, net_amount_kopecks,
                        vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                        source_vat_mode, source_type, source_reference, created_by, created_at
                    )
                    VALUES (?, 1, 'Invalid VAT total', 10000, 2000, 2000, 11999,
                            'gross', 'manual', 'manual:test', ?, ?)
                    """,
                    (baseline_id, self.admin_id, server.now_ts()),
                )
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute(
                    """
                    INSERT INTO project_budget_lines (
                        baseline_id, position, line_type, title, net_amount_kopecks,
                        vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                        source_vat_mode, source_type, source_reference, created_by, created_at
                    )
                    VALUES (?, 1, 'direct_cost', 'VAT forbidden', 10000, 2000, 2000, 12000,
                            'no_vat', 'manual', 'manual:test', ?, ?)
                    """,
                    (baseline_id, self.admin_id, server.now_ts()),
                )

    def test_schema_migration_is_idempotent_and_preserves_legacy_values(self) -> None:
        with server.db() as con:
            before = self._legacy_snapshot(con)
            con.executescript(
                """
                DROP TABLE project_revenue_lines;
                DROP TABLE project_budget_lines;
                DROP TABLE project_financial_baselines;
                """
            )
            con.commit()

        server.init_db()
        server.init_db()

        with server.db() as con:
            after = self._legacy_snapshot(con)
            self.assertEqual(after, before)
            self.assertEqual(
                con.execute("SELECT COUNT(*) FROM project_financial_baselines").fetchone()[0],
                0,
            )
            self.assertEqual(con.execute("PRAGMA foreign_key_check").fetchall(), [])
            table_names = {
                row[0]
                for row in con.execute(
                    """
                    SELECT name FROM sqlite_master
                    WHERE type = 'table' AND name LIKE 'project_%'
                    """
                ).fetchall()
            }
            self.assertTrue(
                {
                    "project_financial_baselines",
                    "project_revenue_lines",
                    "project_budget_lines",
                }.issubset(table_names)
            )


if __name__ == "__main__":
    unittest.main()
