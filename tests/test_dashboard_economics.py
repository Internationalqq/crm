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

import economics  # noqa: E402
import server  # noqa: E402


class DashboardHandler:
    def __init__(self, user: dict):
        self.user = user
        self.status: int | None = None
        self.response: dict | None = None

    def require_user(self) -> dict:
        return self.user

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class DashboardEconomicsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR
        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "dashboard-economics.sqlite3"
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
                    title, address, client_name, status, progress,
                    budget, paid, spent, created_at
                ) VALUES ('Portfolio project', 'Address', 'Client', 'В работе', 25,
                          9999999, 8888888, 7777777, ?)
                """,
                (timestamp,),
            ).lastrowid)
            baseline_id = int(con.execute(
                """
                INSERT INTO project_financial_baselines (
                    project_id, version_no, status, currency_code,
                    source_snapshot_hash, effective_from, reason, created_by,
                    created_at, updated_at
                ) VALUES (?, 1, 'draft', 'RUB', 'sha256:dashboard',
                          '2026-08-21', 'Dashboard baseline', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            ).lastrowid)
            con.execute(
                """
                INSERT INTO project_revenue_lines (
                    baseline_id, position, title, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, source_type,
                    source_reference, created_by, created_at
                ) VALUES (?, 1, 'Revenue', 100000, 0, 0, 100000,
                          'no_vat', 'contract', 'contract:dashboard', ?, ?)
                """,
                (baseline_id, self.admin_id, timestamp),
            )
            con.execute(
                """
                INSERT INTO project_budget_lines (
                    baseline_id, position, line_type, title,
                    net_amount_kopecks, vat_rate_basis_points,
                    vat_amount_kopecks, gross_amount_kopecks,
                    source_vat_mode, source_type, source_reference,
                    created_by, created_at
                ) VALUES (?, 1, 'direct_cost', 'Target cost', 70000, 0, 0,
                          70000, 'no_vat', 'manual', 'manual:dashboard', ?, ?)
                """,
                (baseline_id, self.admin_id, timestamp),
            )
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, baseline_id),
            )
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'approved', approved_by = ?, approved_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, baseline_id),
            )
            forecast_source_hash = economics.forecast_source_state_hash(
                con, self.project_id, baseline_id
            )
            forecast_id = int(con.execute(
                """
                INSERT INTO project_forecasts (
                    project_id, baseline_id, version_no, status, currency_code,
                    calculation_date, source_state_hash,
                    contract_revenue_net_kopecks, target_cost_net_kopecks,
                    committed_total_net_kopecks, actual_cost_net_kopecks,
                    etc_net_kopecks, eac_net_kopecks,
                    forecast_margin_net_kopecks, budget_variance_net_kopecks,
                    reason, created_by, created_at, updated_at
                ) VALUES (?, ?, 1, 'draft', 'RUB', '2026-08-21', ?,
                          100000, 70000, 0, 0, 0, 0, 100000, 70000,
                          'Dashboard forecast', ?, ?, ?)
                """,
                (
                    self.project_id,
                    baseline_id,
                    forecast_source_hash,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            ).lastrowid)
            self.baseline_id = baseline_id
            self.forecast_id = forecast_id
            con.execute(
                """
                UPDATE project_forecasts
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, forecast_id),
            )
            con.execute(
                """
                UPDATE project_forecasts
                SET status = 'approved', approved_by = ?, approved_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, forecast_id),
            )
            con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, amount, paid_date, status,
                    created_by, created_at
                ) VALUES (?, 'income', 999, '2026-08-21', 'paid', ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp),
            )
            con.commit()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        economics.DB_PATH = self.original_economics_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def test_dashboard_uses_approved_economics_and_real_cash_not_legacy_fields(self) -> None:
        handler = DashboardHandler(
            {"id": self.admin_id, "login": "admin", "role": "admin", "roles": []}
        )
        server.PMBIHandler.api_dashboard(handler)

        self.assertEqual(handler.status, HTTPStatus.OK)
        portfolio = handler.response["portfolioEconomics"]
        self.assertEqual(portfolio["configuredProjects"], 1)
        self.assertEqual(portfolio["unconfiguredProjects"], 0)
        self.assertEqual(portfolio["contractRevenueNetKopecks"], 100000)
        self.assertEqual(portfolio["targetCostNetKopecks"], 70000)
        self.assertEqual(portfolio["forecastMarginNetKopecks"], 100000)
        self.assertEqual(portfolio["forecastProjects"], 1)
        self.assertEqual(portfolio["staleForecastProjects"], 0)
        self.assertEqual(portfolio["forecastAttentionProjects"], 0)
        self.assertEqual(handler.response["cashBalance"], 999)
        for legacy_key in ("totalBudget", "totalPaid", "totalSpent", "profitNow"):
            self.assertNotIn(legacy_key, handler.response)

    def test_dashboard_omits_portfolio_economics_and_cash_for_blocked_role(self) -> None:
        handler = DashboardHandler(
            {"id": self.admin_id, "login": "finance", "role": "financier", "roles": []}
        )
        server.PMBIHandler.api_dashboard(handler)
        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertNotIn("portfolioEconomics", handler.response)
        self.assertNotIn("cashBalance", handler.response)
        protected = json.dumps(handler.response, ensure_ascii=False)
        self.assertNotIn("contractRevenueNetKopecks", protected)
        self.assertNotIn("forecastMarginNetKopecks", protected)

    def test_dashboard_excludes_stale_forecast_from_portfolio_margin(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            commitment_id = int(con.execute(
                """
                INSERT INTO project_commitments (
                    project_id, baseline_id, commitment_type, commitment_no,
                    status, counterparty_name, reason, created_by,
                    created_at, updated_at
                ) VALUES (?, ?, 'other', 'STALE-1', 'draft', 'Counterparty',
                          'State changed after forecast', ?, ?, ?)
                """,
                (
                    self.project_id,
                    self.baseline_id,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            ).lastrowid)
            budget_line_id = int(con.execute(
                "SELECT id FROM project_budget_lines WHERE baseline_id = ?",
                (self.baseline_id,),
            ).fetchone()[0])
            con.execute(
                """
                INSERT INTO project_commitment_lines (
                    commitment_id, position, budget_line_id, title, unit,
                    quantity, source_unit_price_kopecks, unit_cost_net_kopecks,
                    net_amount_kopecks, vat_rate_basis_points,
                    vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                    source_reference, created_by, created_at
                ) VALUES (?, 1, ?, 'New commitment', 'pcs', 1, 1000, 1000,
                          1000, 0, 0, 1000, 'no_vat', 'test:stale', ?, ?)
                """,
                (commitment_id, budget_line_id, self.admin_id, timestamp),
            )
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, commitment_id),
            )
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'approved', approved_by = ?, approved_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, commitment_id),
            )
            con.commit()

        handler = DashboardHandler(
            {"id": self.admin_id, "login": "admin", "role": "admin", "roles": []}
        )
        server.PMBIHandler.api_dashboard(handler)

        portfolio = handler.response["portfolioEconomics"]
        self.assertEqual(portfolio["forecastProjects"], 0)
        self.assertEqual(portfolio["staleForecastProjects"], 1)
        self.assertEqual(portfolio["forecastAttentionProjects"], 1)
        self.assertIsNone(portfolio["forecastMarginNetKopecks"])
        self.assertIsNone(portfolio["eacNetKopecks"])


if __name__ == "__main__":
    unittest.main()
