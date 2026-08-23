from __future__ import annotations

import gc
import sys
import tempfile
import threading
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


class BlockingHandler(FakeHandler):
    """Pause a draft update after its initial row read, before it takes the write lock."""

    def __init__(
        self,
        user: dict,
        payload: dict,
        payload_requested: threading.Event,
        release_payload: threading.Event,
    ):
        super().__init__(user, payload)
        self.payload_requested = payload_requested
        self.release_payload = release_payload

    def read_json(self) -> dict:
        self.payload_requested.set()
        if not self.release_payload.wait(timeout=10):
            raise TimeoutError("stale draft updater was not released")
        return self.payload


class EconomicsTransitionRaceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "economics-transition-races.sqlite3"
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
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                ) VALUES ('Transition race project', 'Address', 'Client', 'active',
                          1, 2, 3, ?)
                """,
                (timestamp,),
            )
            self.project_id = int(cursor.lastrowid)
            cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Concrete', 'm3', 2, 100, 'material')
                """,
                (self.project_id,),
            )
            self.estimate_item_id = int(cursor.lastrowid)
            (
                self.baseline_id,
                self.revenue_line_id,
                self.budget_line_id,
            ) = self._approved_baseline(con)
            self.commitment_id = self._draft_commitment(con)
            self.actual_cost_id = self._draft_actual_cost(con)
            self.income_payment_id = self._paid_income(con)
            con.commit()

        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}
        create = FakeHandler(
            self.admin,
            {
                "financeEntryId": self.income_payment_id,
                "targetType": "revenue_line",
                "targetId": self.revenue_line_id,
                "amount": 50,
                "allocationKey": "race-allocation",
                "reason": "Lifecycle race fixture",
            },
        )
        economics.api_create_payment_allocation(
            create, f"/api/projects/{self.project_id}/payment-allocations"
        )
        self.assertEqual(create.status, HTTPStatus.CREATED, create.response)
        self.allocation_id = int(create.response["id"])

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        economics.DB_PATH = self.original_economics_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _approved_baseline(self, con) -> tuple[int, int, int]:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, effective_from,
                source_snapshot_hash, reason, created_by, created_at, updated_at
            ) VALUES (?, 1, 'draft', 'RUB', '2026-08-20', 'sha256:race-approved',
                      'Approved lifecycle fixture', ?, ?, ?)
            """,
            (self.project_id, self.admin_id, timestamp, timestamp),
        )
        baseline_id = int(cursor.lastrowid)
        revenue = con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, estimate_item_id, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, ?, 'Contract revenue', 'm3', 2, 15000, 30000,
                      0, 0, 30000, 'no_vat', 'contract', 'race:revenue', ?, ?)
            """,
            (baseline_id, self.estimate_item_id, self.admin_id, timestamp),
        )
        budget = con.execute(
            """
            INSERT INTO project_budget_lines (
                baseline_id, position, line_type, cost_code, estimate_item_id,
                title, unit, quantity, unit_cost_net_kopecks, net_amount_kopecks,
                vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                source_vat_mode, source_type, source_reference, created_by, created_at
            ) VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Concrete target', 'm3', 2,
                      10000, 20000, 0, 0, 20000, 'no_vat', 'estimate',
                      'race:budget', ?, ?)
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
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (self.admin_id, timestamp, timestamp, baseline_id),
        )
        return baseline_id, int(revenue.lastrowid), int(budget.lastrowid)

    def _draft_commitment(self, con) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_commitments (
                project_id, baseline_id, commitment_type, commitment_no, status,
                currency_code, counterparty_name, reason, created_by, created_at, updated_at
            ) VALUES (?, ?, 'purchase_order', 'PO-RACE', 'draft', 'RUB',
                      'Supplier', 'Lifecycle race fixture', ?, ?, ?)
            """,
            (self.project_id, self.baseline_id, self.admin_id, timestamp, timestamp),
        )
        commitment_id = int(cursor.lastrowid)
        con.execute(
            """
            INSERT INTO project_commitment_lines (
                commitment_id, position, budget_line_id, estimate_item_id, title, unit,
                quantity, source_unit_price_kopecks, unit_cost_net_kopecks,
                net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, source_reference, created_by, created_at
            ) VALUES (?, 1, ?, ?, 'Concrete order', 'm3', 1, 10000, 10000,
                      10000, 0, 0, 10000, 'no_vat', 'race:commitment', ?, ?)
            """,
            (
                commitment_id,
                self.budget_line_id,
                self.estimate_item_id,
                self.admin_id,
                timestamp,
            ),
        )
        return commitment_id

    def _draft_actual_cost(self, con) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_actual_cost_entries (
                project_id, baseline_id, budget_line_id, estimate_item_id,
                cost_category, entry_kind, source_type, source_event_key, title,
                recognition_date, unit, quantity, source_unit_price_kopecks,
                unit_cost_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                valuation_method, source_reference, reason, status, created_by,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'labor', 'cost', 'labor_timesheet', 'race:actual',
                      'Accepted labor', '2026-08-20', 'm3', 1, 10000, 10000,
                      10000, 0, 0, 10000, 'no_vat', 'approved_rate',
                      'race:actual', 'Lifecycle race fixture', 'draft', ?, ?, ?)
            """,
            (
                self.project_id,
                self.baseline_id,
                self.budget_line_id,
                self.estimate_item_id,
                self.admin_id,
                timestamp,
                timestamp,
            ),
        )
        return int(cursor.lastrowid)

    def _paid_income(self, con) -> int:
        timestamp = server.now_ts()
        cursor = con.execute(
            """
            INSERT INTO finance_entries (
                project_id, direction, category, payment_kind, vat_percent, amount,
                planned_date, paid_date, counterparty_name, status, notes,
                created_by, created_at, updated_at
            ) VALUES (?, 'income', 'test', 'bank_no_vat', 0, 300,
                      '2026-08-20', '2026-08-20', 'Customer', 'paid',
                      'Lifecycle race fixture', ?, ?, ?)
            """,
            (self.project_id, self.admin_id, timestamp, timestamp),
        )
        return int(cursor.lastrowid)

    def _draft_baseline_on_separate_project(self) -> int:
        with server.db() as con:
            timestamp = server.now_ts()
            project = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                ) VALUES ('Baseline race project', 'Address', 'Client', 'active', 4, 5, 6, ?)
                """,
                (timestamp,),
            )
            project_id = int(project.lastrowid)
            item = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Baseline item', 'pcs', 1, 1, 'material')
                """,
                (project_id,),
            )
            item_id = int(item.lastrowid)
            baseline = con.execute(
                """
                INSERT INTO project_financial_baselines (
                    project_id, version_no, status, currency_code, effective_from,
                    source_snapshot_hash, reason, created_by, created_at, updated_at
                ) VALUES (?, 1, 'draft', 'RUB', '2026-08-20', 'sha256:race-draft',
                          'Baseline race fixture', ?, ?, ?)
                """,
                (project_id, self.admin_id, timestamp, timestamp),
            )
            baseline_id = int(baseline.lastrowid)
            con.execute(
                """
                INSERT INTO project_revenue_lines (
                    baseline_id, position, estimate_item_id, title, unit, quantity,
                    unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                    vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                    source_type, source_reference, created_by, created_at
                ) VALUES (?, 1, ?, 'Revenue', 'pcs', 1, 20000, 20000, 0, 0,
                          20000, 'no_vat', 'contract', 'race:baseline:revenue', ?, ?)
                """,
                (baseline_id, item_id, self.admin_id, timestamp),
            )
            con.execute(
                """
                INSERT INTO project_budget_lines (
                    baseline_id, position, line_type, cost_code, estimate_item_id,
                    title, unit, quantity, unit_cost_net_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                    source_vat_mode, source_type, source_reference, created_by, created_at
                ) VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Budget', 'pcs', 1,
                          10000, 10000, 0, 0, 10000, 'no_vat', 'estimate',
                          'race:baseline:budget', ?, ?)
                """,
                (baseline_id, item_id, self.admin_id, timestamp),
            )
            con.commit()
        return baseline_id

    def _race(self, function, path: str, payload: dict | None = None) -> list[FakeHandler]:
        barrier = threading.Barrier(2)
        handlers: list[FakeHandler] = []
        errors: list[BaseException] = []
        result_lock = threading.Lock()

        def worker() -> None:
            handler = FakeHandler(self.admin, payload)
            try:
                barrier.wait(timeout=5)
                function(handler, path)
                with result_lock:
                    handlers.append(handler)
            except BaseException as exc:  # pragma: no cover - surfaced below
                with result_lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        if errors:
            raise errors[0]
        self.assertEqual(len(handlers), 2)
        return handlers

    def _assert_single_transition(self, handlers: list[FakeHandler]) -> None:
        self.assertEqual(
            sorted(int(handler.status) for handler in handlers),
            [int(HTTPStatus.OK), int(HTTPStatus.CONFLICT)],
        )

    def _race_stale_update_against_submit(
        self,
        update_function,
        update_path: str,
        update_payload: dict,
        submit_function,
        submit_path: str,
    ) -> tuple[FakeHandler, FakeHandler]:
        payload_requested = threading.Event()
        release_payload = threading.Event()
        updater = BlockingHandler(
            self.admin, update_payload, payload_requested, release_payload
        )
        errors: list[BaseException] = []

        def update_worker() -> None:
            try:
                update_function(updater, update_path)
            except BaseException as exc:  # pragma: no cover - surfaced below
                errors.append(exc)

        thread = threading.Thread(target=update_worker)
        thread.start()
        self.assertTrue(
            payload_requested.wait(timeout=5),
            "draft updater did not reach read_json",
        )

        submitter = FakeHandler(self.admin)
        submit_function(submitter, submit_path)
        self.assertEqual(submitter.status, HTTPStatus.OK, submitter.response)

        release_payload.set()
        thread.join(timeout=15)
        self.assertFalse(thread.is_alive(), "draft updater did not finish")
        if errors:
            raise errors[0]
        self.assertEqual(updater.status, HTTPStatus.CONFLICT, updater.response)
        return updater, submitter

    def test_baseline_submit_and_return_are_single_transitions(self) -> None:
        baseline_id = self._draft_baseline_on_separate_project()
        submitted = self._race(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        self._assert_single_transition(submitted)

        returned = self._race(
            economics.api_return_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/return",
            {"reason": "Return once"},
        )
        self._assert_single_transition(returned)
        with server.db() as con:
            row = con.execute(
                "SELECT status FROM project_financial_baselines WHERE id = ?",
                (baseline_id,),
            ).fetchone()
            self.assertEqual(row["status"], "draft")
            for action in ("submit_financial_baseline", "return_financial_baseline"):
                count = int(
                    con.execute(
                        "SELECT COUNT(*) FROM audit_log WHERE action = ? AND entity_id = ?",
                        (action, baseline_id),
                    ).fetchone()[0]
                )
                self.assertEqual(count, 1)

    def test_operational_and_forecast_transitions_emit_one_event(self) -> None:
        transitions = (
            (
                economics.api_submit_commitment,
                f"/api/commitments/{self.commitment_id}/submit",
                None,
                "project_commitment_events",
                "commitment_id",
                self.commitment_id,
                "submitted",
            ),
            (
                economics.api_approve_commitment,
                f"/api/commitments/{self.commitment_id}/approve",
                None,
                "project_commitment_events",
                "commitment_id",
                self.commitment_id,
                "approved",
            ),
            (
                economics.api_cancel_commitment,
                f"/api/commitments/{self.commitment_id}/cancel",
                {"cancellationReason": "Cancel once"},
                "project_commitment_events",
                "commitment_id",
                self.commitment_id,
                "cancelled",
            ),
            (
                economics.api_submit_actual_cost,
                f"/api/actual-costs/{self.actual_cost_id}/submit",
                None,
                "project_actual_cost_events",
                "actual_cost_entry_id",
                self.actual_cost_id,
                "submitted",
            ),
            (
                economics.api_approve_actual_cost,
                f"/api/actual-costs/{self.actual_cost_id}/approve",
                None,
                "project_actual_cost_events",
                "actual_cost_entry_id",
                self.actual_cost_id,
                "approved",
            ),
            (
                economics.api_submit_payment_allocation,
                f"/api/payment-allocations/{self.allocation_id}/submit",
                None,
                "project_payment_allocation_events",
                "payment_allocation_id",
                self.allocation_id,
                "submitted",
            ),
        )
        for function, path, payload, table, id_column, entity_id, action in transitions:
            with self.subTest(action=action, entity_id=entity_id):
                handlers = self._race(function, path, payload)
                self._assert_single_transition(handlers)
                with server.db() as con:
                    count = int(
                        con.execute(
                            f"SELECT COUNT(*) FROM {table} WHERE {id_column} = ? AND action = ?",
                            (entity_id, action),
                        ).fetchone()[0]
                    )
                self.assertEqual(count, 1)

        calculated = self._race(
            economics.api_calculate_project_forecast,
            f"/api/projects/{self.project_id}/forecasts/calculate",
            {"calculationDate": "2026-08-21", "reason": "Concurrent calculation"},
        )
        self.assertEqual(
            [handler.status for handler in calculated].count(HTTPStatus.CREATED), 2
        )
        forecast_ids = [int(handler.response["forecast"]["id"]) for handler in calculated]
        with server.db() as con:
            versions = {
                int(row["version_no"])
                for row in con.execute(
                    "SELECT version_no FROM project_forecasts WHERE id IN (?, ?)",
                    forecast_ids,
                ).fetchall()
            }
        self.assertEqual(versions, {1, 2})

        forecast_id = forecast_ids[0]
        for function, suffix, action in (
            (economics.api_submit_project_forecast, "submit", "submitted"),
            (economics.api_approve_project_forecast, "approve", "approved"),
        ):
            handlers = self._race(
                function, f"/api/forecasts/{forecast_id}/{suffix}"
            )
            self._assert_single_transition(handlers)
            with server.db() as con:
                count = int(
                    con.execute(
                        """
                        SELECT COUNT(*) FROM project_forecast_events
                        WHERE forecast_id = ? AND action = ?
                        """,
                        (forecast_id, action),
                    ).fetchone()[0]
                )
            self.assertEqual(count, 1)

    def test_stale_draft_edits_cannot_overwrite_concurrent_submissions(self) -> None:
        baseline_id = self._draft_baseline_on_separate_project()
        cases = (
            {
                "name": "financial_baseline",
                "table": "project_financial_baselines",
                "entity_id": baseline_id,
                "business_columns": ("effective_from", "source_document_id", "reason"),
                "update": economics.api_update_financial_baseline,
                "update_path": f"/api/financial-baselines/{baseline_id}",
                "payload": {
                    "effectiveFrom": "2026-09-01",
                    "reason": "Stale baseline edit",
                },
                "submit": economics.api_submit_financial_baseline,
                "submit_path": f"/api/financial-baselines/{baseline_id}/submit",
                "update_audit_action": "update_financial_baseline",
                "event_table": None,
                "event_id_column": None,
            },
            {
                "name": "commitment",
                "table": "project_commitments",
                "entity_id": self.commitment_id,
                "business_columns": (
                    "baseline_id",
                    "commitment_no",
                    "expected_date",
                    "reason",
                ),
                "update": economics.api_update_commitment,
                "update_path": f"/api/commitments/{self.commitment_id}",
                "payload": {
                    "commitmentNo": "PO-STALE",
                    "expectedDate": "2026-09-01",
                    "reason": "Stale commitment edit",
                },
                "submit": economics.api_submit_commitment,
                "submit_path": f"/api/commitments/{self.commitment_id}/submit",
                "update_audit_action": "update_project_commitment_draft",
                "event_table": "project_commitment_events",
                "event_id_column": "commitment_id",
            },
            {
                "name": "actual_cost",
                "table": "project_actual_cost_entries",
                "entity_id": self.actual_cost_id,
                "business_columns": (
                    "title",
                    "reason",
                    "source_unit_price_kopecks",
                    "net_amount_kopecks",
                ),
                "update": economics.api_update_actual_cost,
                "update_path": f"/api/actual-costs/{self.actual_cost_id}",
                "payload": {
                    "title": "Stale actual edit",
                    "reason": "Stale actual edit",
                    "unitPrice": 125,
                },
                "submit": economics.api_submit_actual_cost,
                "submit_path": f"/api/actual-costs/{self.actual_cost_id}/submit",
                "update_audit_action": "update_project_actual_cost_draft",
                "event_table": "project_actual_cost_events",
                "event_id_column": "actual_cost_entry_id",
            },
            {
                "name": "payment_allocation",
                "table": "project_payment_allocations",
                "entity_id": self.allocation_id,
                "business_columns": (
                    "net_amount_kopecks",
                    "vat_amount_kopecks",
                    "gross_amount_kopecks",
                    "reason",
                ),
                "update": economics.api_update_payment_allocation,
                "update_path": f"/api/payment-allocations/{self.allocation_id}",
                "payload": {"amount": 75, "reason": "Stale allocation edit"},
                "submit": economics.api_submit_payment_allocation,
                "submit_path": f"/api/payment-allocations/{self.allocation_id}/submit",
                "update_audit_action": "update_project_payment_allocation_draft",
                "event_table": "project_payment_allocation_events",
                "event_id_column": "payment_allocation_id",
            },
        )

        for case in cases:
            with self.subTest(entity=case["name"]):
                columns = ", ".join(case["business_columns"])
                with server.db() as con:
                    before = tuple(
                        con.execute(
                            f"SELECT {columns} FROM {case['table']} WHERE id = ?",
                            (case["entity_id"],),
                        ).fetchone()
                    )
                    update_audits_before = int(
                        con.execute(
                            "SELECT COUNT(*) FROM audit_log WHERE action = ? AND entity_id = ?",
                            (case["update_audit_action"], case["entity_id"]),
                        ).fetchone()[0]
                    )
                    updated_events_before = 0
                    if case["event_table"]:
                        updated_events_before = int(
                            con.execute(
                                f"SELECT COUNT(*) FROM {case['event_table']} "
                                f"WHERE {case['event_id_column']} = ? AND action = 'updated'",
                                (case["entity_id"],),
                            ).fetchone()[0]
                        )

                self._race_stale_update_against_submit(
                    case["update"],
                    case["update_path"],
                    case["payload"],
                    case["submit"],
                    case["submit_path"],
                )

                with server.db() as con:
                    row = con.execute(
                        f"SELECT status, {columns} FROM {case['table']} WHERE id = ?",
                        (case["entity_id"],),
                    ).fetchone()
                    self.assertEqual(row["status"], "pending_approval")
                    self.assertEqual(tuple(row)[1:], before)
                    update_audits_after = int(
                        con.execute(
                            "SELECT COUNT(*) FROM audit_log WHERE action = ? AND entity_id = ?",
                            (case["update_audit_action"], case["entity_id"]),
                        ).fetchone()[0]
                    )
                    self.assertEqual(update_audits_after, update_audits_before)
                    if case["event_table"]:
                        updated_events_after = int(
                            con.execute(
                                f"SELECT COUNT(*) FROM {case['event_table']} "
                                f"WHERE {case['event_id_column']} = ? AND action = 'updated'",
                                (case["entity_id"],),
                            ).fetchone()[0]
                        )
                        self.assertEqual(updated_events_after, updated_events_before)


if __name__ == "__main__":
    unittest.main()
