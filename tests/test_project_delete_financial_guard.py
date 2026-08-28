from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import projects  # noqa: E402
import server  # noqa: E402


class FakeHandler:
    def __init__(self, user: dict):
        self.user = user
        self.status: int | None = None
        self.response: dict | None = None

    def require_user(self) -> dict:
        return self.user

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class ProjectDeleteFinancialGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_projects_db = projects.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "project-delete-guard.sqlite3"
        server.DB_PATH = test_db
        projects.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        projects.DB_PATH = self.original_projects_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _insert_project(self, con, title: str) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO projects (
                title, address, client_name, status, budget, paid, spent,
                created_at, updated_at
            ) VALUES (?, 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
            """,
            (title, timestamp, timestamp),
        )
        return int(cursor.lastrowid)

    def _add_approved_baseline(self, con, project_id: int, *, approve: bool = True) -> int:
        timestamp = server.now_ts()
        baseline = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code,
                source_snapshot_hash, reason, created_by, created_at, updated_at
            ) VALUES (?, 1, 'draft', 'RUB', 'sha256:delete-guard',
                      'Deletion guard fixture', ?, ?, ?)
            """,
            (project_id, self.admin_id, timestamp, timestamp),
        )
        baseline_id = int(baseline.lastrowid)
        con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, source_type,
                source_reference, created_by, created_at
            ) VALUES (?, 1, 'Contract revenue', 'unit', 1, 100000, 100000,
                      0, 0, 100000, 'no_vat', 'manual',
                      'test:delete-guard:revenue', ?, ?)
            """,
            (baseline_id, self.admin_id, timestamp),
        )
        con.execute(
            """
            INSERT INTO project_budget_lines (
                baseline_id, position, line_type, title, unit, quantity,
                unit_cost_net_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, source_type,
                source_reference, created_by, created_at
            ) VALUES (?, 1, 'direct_cost', 'Target cost', 'unit', 1,
                      70000, 70000, 0, 0, 70000, 'no_vat', 'manual',
                      'test:delete-guard:budget', ?, ?)
            """,
            (baseline_id, self.admin_id, timestamp),
        )
        con.execute(
            """
            UPDATE project_financial_baselines
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )
        if not approve:
            return baseline_id
        con.execute(
            """
            UPDATE project_financial_baselines
            SET status = 'approved', approved_by = ?, approved_at = ?,
                effective_from = '2026-08-21', updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )
        return baseline_id

    def _delete(self, project_id: int) -> FakeHandler:
        handler = FakeHandler(self.admin)
        projects.api_delete_project(handler, f"/api/projects/{project_id}")
        return handler

    def test_approved_financial_history_blocks_delete_before_document_cleanup(self) -> None:
        evidence_path = Path(self.temp_dir.name) / "accounting-evidence.pdf"
        evidence_path.write_bytes(b"immutable accounting evidence")

        with server.db() as con:
            project_id = self._insert_project(con, "Immutable project")
            timestamp = server.now_ts()
            document = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, original_name,
                    storage_name, storage_path, size_bytes, uploaded_by,
                    created_at, updated_at
                ) VALUES (?, 'Approved act', 'act', 'approved', 'act.pdf',
                          'act.pdf', ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    str(evidence_path),
                    evidence_path.stat().st_size,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            document_id = int(document.lastrowid)
            baseline_id = self._add_approved_baseline(con, project_id)
            con.commit()

        result = self._delete(project_id)

        self.assertEqual(result.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            result.response["error"],
            "project_has_immutable_financial_history",
        )
        self.assertIn("нельзя удалить", result.response["message"])
        with server.db() as con:
            self.assertIsNotNone(
                con.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
            )
            self.assertIsNotNone(
                con.execute("SELECT 1 FROM documents WHERE id = ?", (document_id,)).fetchone()
            )
            self.assertIsNotNone(
                con.execute(
                    "SELECT 1 FROM project_financial_baselines WHERE id = ?",
                    (baseline_id,),
                ).fetchone()
            )
        self.assertTrue(evidence_path.is_file())
        self.assertEqual(evidence_path.read_bytes(), b"immutable accounting evidence")

    def test_pending_baseline_is_guarded_before_db_immutability_trigger(self) -> None:
        with server.db() as con:
            project_id = self._insert_project(con, "Pending baseline project")
            baseline_id = self._add_approved_baseline(con, project_id, approve=False)
            con.commit()

        result = self._delete(project_id)

        self.assertEqual(result.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            result.response["error"], "project_has_immutable_financial_history"
        )
        with server.db() as con:
            row = con.execute(
                "SELECT status FROM project_financial_baselines WHERE id = ?",
                (baseline_id,),
            ).fetchone()
        self.assertEqual(row["status"], "pending_approval")

    def test_empty_project_keeps_existing_delete_behaviour(self) -> None:
        with server.db() as con:
            project_id = self._insert_project(con, "Empty project")
            con.commit()

        result = self._delete(project_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertEqual(result.response, {"ok": True, "deleted_id": project_id})
        with server.db() as con:
            self.assertIsNone(
                con.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
            )

    def test_delete_removes_default_draft_children_without_fk_orphans(self) -> None:
        with server.db() as con:
            project_id = self._insert_project(con, "Draft setup project")
            timestamp = server.now_ts()
            con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, is_client_visible, created_at
                ) VALUES (?, 'Draft contract', 'contract', 'draft', 0, ?)
                """,
                (project_id, timestamp),
            )
            con.execute(
                "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'team', 'Team', ?)",
                (project_id, timestamp),
            )
            con.execute(
                "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'client', 'Client', ?)",
                (project_id, timestamp),
            )
            con.commit()

        result = self._delete(project_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        with server.db() as con:
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM documents WHERE project_id = ?", (project_id,)
                ).fetchone()[0],
                0,
            )
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM chats WHERE project_id = ?", (project_id,)
                ).fetchone()[0],
                0,
            )
            self.assertEqual(con.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_operational_money_task_or_material_history_blocks_cascade_delete(self) -> None:
        fixtures = ("finance", "task", "stock")
        for fixture in fixtures:
            with self.subTest(fixture=fixture), server.db() as con:
                project_id = self._insert_project(con, f"Protected {fixture} project")
                timestamp = server.now_ts()
                if fixture == "finance":
                    con.execute(
                        """
                        INSERT INTO finance_entries (
                            project_id, direction, amount, status, created_by, created_at, updated_at
                        ) VALUES (?, 'expense', 12500, 'planned', ?, ?, ?)
                        """,
                        (project_id, self.admin_id, timestamp, timestamp),
                    )
                elif fixture == "task":
                    con.execute(
                        """
                        INSERT INTO tasks (
                            project_id, title, status, priority, created_by, created_at, updated_at
                        ) VALUES (?, 'Do not lose this task', 'open', 'high', ?, ?, ?)
                        """,
                        (project_id, self.admin_id, timestamp, timestamp),
                    )
                else:
                    con.execute(
                        """
                        INSERT INTO stock_moves (
                            project_id, move_type, qty, price, created_by, created_at
                        ) VALUES (?, 'receipt', 38.4, 0, ?, ?)
                        """,
                        (project_id, self.admin_id, timestamp),
                    )
                con.commit()

            result = self._delete(project_id)

            self.assertEqual(result.status, HTTPStatus.CONFLICT)
            self.assertEqual(result.response["error"], "project_has_operational_history")
            self.assertIn("история останется", result.response["message"])
            with server.db() as con:
                self.assertIsNotNone(
                    con.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
                )


if __name__ == "__main__":
    unittest.main()
