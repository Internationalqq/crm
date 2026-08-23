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


class ProjectFinancialBaselineWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "financial-baseline-workflow.sqlite3"
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
                ) VALUES ('Workflow project', 'Address', 'Client', 'active',
                          1234567.89, 23456.78, 12345.67, ?)
                """,
                (timestamp,),
            )
            self.project_id = int(project_cursor.lastrowid)
            item_cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Concrete', 'm3', 2, 500, 'material')
                """,
                (self.project_id,),
            )
            self.estimate_item_id = int(item_cursor.lastrowid)
            document_cursor = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, uploaded_by, created_at, updated_at
                ) VALUES (?, 'Contract', 'contract', 'approved', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            self.document_id = int(document_cursor.lastrowid)

            other_project_cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                ) VALUES ('Other project', 'Other', 'Other', 'active', 1, 2, 3, ?)
                """,
                (timestamp,),
            )
            self.other_project_id = int(other_project_cursor.lastrowid)
            other_item_cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                ) VALUES (?, 'Foreign item', 'u', 1, 1, 'material')
                """,
                (self.other_project_id,),
            )
            self.other_estimate_item_id = int(other_item_cursor.lastrowid)
            other_document_cursor = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, uploaded_by, created_at, updated_at
                ) VALUES (?, 'Foreign contract', 'contract', 'approved', ?, ?, ?)
                """,
                (self.other_project_id, self.admin_id, timestamp, timestamp),
            )
            self.other_document_id = int(other_document_cursor.lastrowid)
            con.commit()

        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}
        self.legacy_before = self._legacy_snapshot()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        economics.DB_PATH = self.original_economics_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def _legacy_snapshot(self) -> tuple:
        with server.db() as con:
            project = con.execute(
                """
                SELECT quote(budget), typeof(budget), quote(paid), typeof(paid),
                       quote(spent), typeof(spent)
                FROM projects WHERE id = ?
                """,
                (self.project_id,),
            ).fetchone()
            item = con.execute(
                """
                SELECT quote(planned_qty), typeof(planned_qty),
                       quote(planned_price), typeof(planned_price)
                FROM estimate_items WHERE id = ?
                """,
                (self.estimate_item_id,),
            ).fetchone()
        return tuple(project) + tuple(item)

    def _call(self, function, path: str, payload: dict | None = None, user: dict | None = None):
        handler = FakeHandler(user or self.admin, payload)
        function(handler, path)
        return handler

    def _create_draft(
        self,
        *,
        reason: str = "Initial financial baseline",
        clone_from_id: int | None = None,
        effective_from: str | None = "2026-08-20",
    ) -> dict:
        payload = {
            "reason": reason,
            "sourceDocumentId": self.document_id,
            "effectiveFrom": effective_from,
        }
        if clone_from_id is not None:
            payload["cloneFromBaselineId"] = clone_from_id
        handler = self._call(
            economics.api_create_financial_baseline,
            f"/api/projects/{self.project_id}/financial-baselines",
            payload,
        )
        self.assertEqual(handler.status, HTTPStatus.CREATED)
        return handler.response["baseline"]

    def _baseline_lines_payload(self, *, revenue_amount: int = 120000) -> dict:
        return {
            "effectiveFrom": "2026-08-20",
            "reason": "Confirmed contract and target cost",
            "revenueLines": [
                {
                    "title": "Contract revenue",
                    "estimateItemId": self.estimate_item_id,
                    "sourceDocumentId": self.document_id,
                    "unit": "m3",
                    "quantity": 2,
                    "sourceAmountKopecks": revenue_amount,
                    "vatMode": "gross",
                    "vatRateBasisPoints": 2000,
                    "sourceType": "contract",
                    "sourceReference": "contract:1:line:1",
                }
            ],
            "budgetLines": [
                {
                    "title": "Concrete target cost",
                    "lineType": "direct_cost",
                    "costCode": "MAT",
                    "estimateItemId": self.estimate_item_id,
                    "unit": "m3",
                    "quantity": 2,
                    "sourceAmountKopecks": 70000,
                    "vatMode": "net",
                    "vatRateBasisPoints": 2000,
                    "sourceType": "estimate",
                    "sourceReference": "estimate:1:line:1",
                }
            ],
        }

    def _fill_submit_approve(self) -> dict:
        baseline = self._create_draft()
        baseline_id = baseline["id"]
        updated = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            self._baseline_lines_payload(),
        )
        self.assertEqual(updated.status, HTTPStatus.OK)
        submitted = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        self.assertEqual(submitted.status, HTTPStatus.OK)
        approved = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/approve",
        )
        self.assertEqual(approved.status, HTTPStatus.OK)
        return approved.response["baseline"]

    def test_complete_initial_baseline_workflow_and_exact_vat(self) -> None:
        draft = self._create_draft()
        initial_hash = draft["sourceSnapshotHash"]
        baseline_id = draft["id"]

        updated = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            self._baseline_lines_payload(),
        )

        self.assertEqual(updated.status, HTTPStatus.OK)
        baseline = updated.response["baseline"]
        self.assertNotEqual(baseline["sourceSnapshotHash"], initial_hash)
        self.assertRegex(baseline["sourceSnapshotHash"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(baseline["totals"]["revenueNetKopecks"], 100000)
        self.assertEqual(baseline["totals"]["revenueVatKopecks"], 20000)
        self.assertEqual(baseline["totals"]["revenueGrossKopecks"], 120000)
        self.assertEqual(baseline["totals"]["targetCostNetKopecks"], 70000)
        self.assertEqual(baseline["totals"]["targetCostVatKopecks"], 14000)
        self.assertEqual(baseline["totals"]["targetCostGrossKopecks"], 84000)

        submitted = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        self.assertEqual(submitted.status, HTTPStatus.OK)
        self.assertEqual(submitted.response["status"], "pending_approval")

        approved = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/approve",
        )
        self.assertEqual(approved.status, HTTPStatus.OK)
        baseline = approved.response["baseline"]
        self.assertEqual(baseline["status"], "approved")
        self.assertEqual(baseline["submittedBy"], self.admin_id)
        self.assertEqual(baseline["approvedBy"], self.admin_id)
        self.assertTrue(baseline["submittedAt"])
        self.assertTrue(baseline["approvedAt"])
        self.assertEqual(
            [event["action"] for event in baseline["events"]],
            [
                "create_financial_baseline",
                "update_financial_baseline",
                "submit_financial_baseline",
                "approve_financial_baseline",
            ],
        )

        economics_view = self._call(
            economics.api_project_economics,
            f"/api/projects/{self.project_id}/economics",
        )
        self.assertEqual(economics_view.status, HTTPStatus.OK)
        self.assertEqual(economics_view.response["status"], "ready")
        self.assertEqual(
            economics_view.response["current"]["contractRevenueNetKopecks"], 100000
        )
        self.assertEqual(
            economics_view.response["current"]["targetCostNetKopecks"], 70000
        )
        self.assertEqual(self._legacy_snapshot(), self.legacy_before)

    def test_submit_requires_effective_date_and_positive_both_layers(self) -> None:
        draft = self._create_draft(effective_from=None)
        baseline_id = draft["id"]
        empty_submit = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        self.assertEqual(empty_submit.status, HTTPStatus.CONFLICT)
        self.assertEqual(empty_submit.response["error"], "baseline_effective_from_required")

        payload = self._baseline_lines_payload()
        payload["effectiveFrom"] = None
        updated = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            payload,
        )
        self.assertEqual(updated.status, HTTPStatus.OK)
        still_missing_date = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        self.assertEqual(still_missing_date.status, HTTPStatus.CONFLICT)
        self.assertEqual(still_missing_date.response["error"], "baseline_effective_from_required")

        fix_date_and_clear_revenue = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            {"effectiveFrom": "2026-08-20", "revenueLines": []},
        )
        self.assertEqual(fix_date_and_clear_revenue.status, HTTPStatus.OK)
        no_revenue = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        self.assertEqual(no_revenue.response["error"], "positive_baseline_revenue_required")

    def test_relation_validation_rolls_back_complete_line_replacement(self) -> None:
        draft = self._create_draft()
        baseline_id = draft["id"]
        valid = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            self._baseline_lines_payload(),
        )
        self.assertEqual(valid.status, HTTPStatus.OK)
        original_hash = valid.response["baseline"]["sourceSnapshotHash"]

        invalid_payload = self._baseline_lines_payload(revenue_amount=240000)
        invalid_payload["revenueLines"][0]["estimateItemId"] = self.other_estimate_item_id
        invalid = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            invalid_payload,
        )
        self.assertEqual(invalid.status, HTTPStatus.CONFLICT)
        self.assertEqual(invalid.response["error"], "baseline_estimate_item_not_found")

        listed = self._call(
            economics.api_project_financial_baselines,
            f"/api/projects/{self.project_id}/financial-baselines",
        )
        stored = listed.response["baselines"][0]
        self.assertEqual(stored["sourceSnapshotHash"], original_hash)
        self.assertEqual(stored["totals"]["revenueGrossKopecks"], 120000)

        foreign_document = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            {"sourceDocumentId": self.other_document_id},
        )
        self.assertEqual(foreign_document.status, HTTPStatus.NOT_FOUND)
        self.assertEqual(
            foreign_document.response["error"], "baseline_source_document_not_found"
        )

    def test_pending_baseline_can_be_returned_to_editing_with_history(self) -> None:
        draft = self._create_draft()
        baseline_id = draft["id"]
        self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            self._baseline_lines_payload(),
        )
        self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )

        returned = self._call(
            economics.api_return_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/return",
            {"reason": "Clarify target cost source"},
        )

        self.assertEqual(returned.status, HTTPStatus.OK)
        self.assertEqual(returned.response["status"], "draft")
        listed = self._call(
            economics.api_project_financial_baselines,
            f"/api/projects/{self.project_id}/financial-baselines",
        )
        baseline = listed.response["baselines"][0]
        self.assertIsNone(baseline["submittedBy"])
        self.assertIsNone(baseline["submittedAt"])
        self.assertEqual(baseline["events"][-1]["action"], "return_financial_baseline")
        self.assertEqual(
            baseline["events"][-1]["details"]["reason"],
            "Clarify target cost source",
        )

    def test_approval_rejects_source_changes_after_submission(self) -> None:
        draft = self._create_draft()
        baseline_id = draft["id"]
        self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/update",
            self._baseline_lines_payload(),
        )
        self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/submit",
        )
        with server.db() as con:
            with self.assertRaisesRegex(
                sqlite3.IntegrityError,
                "pending_financial_baseline_snapshot_is_immutable",
            ):
                con.execute(
                    "UPDATE project_financial_baselines SET reason = 'Changed after submit' WHERE id = ?",
                    (baseline_id,),
                )
            con.rollback()
            # The approval hash remains a second line of defence even if a
            # database administrator disables the write guard temporarily.
            con.execute("DROP TRIGGER trg_financial_baseline_pending_snapshot_guard_v1")
            con.execute(
                "UPDATE project_financial_baselines SET reason = 'Changed after submit' WHERE id = ?",
                (baseline_id,),
            )
            con.commit()

        blocked = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{baseline_id}/approve",
        )

        self.assertEqual(blocked.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            blocked.response["error"],
            "baseline_sources_changed_return_to_draft",
        )

    def test_clone_creates_later_version_and_atomically_supersedes_clean_baseline(self) -> None:
        first = self._fill_submit_approve()
        second = self._create_draft(
            reason="Approved change order",
            clone_from_id=first["id"],
            effective_from="2026-09-01",
        )
        self.assertEqual(second["versionNo"], 2)
        self.assertEqual(len(second["revenueLines"]), 1)
        self.assertEqual(len(second["budgetLines"]), 1)
        self.assertNotEqual(second["sourceSnapshotHash"], first["sourceSnapshotHash"])

        submitted = self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{second['id']}/submit",
        )
        self.assertEqual(submitted.status, HTTPStatus.OK)
        approved = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{second['id']}/approve",
        )
        self.assertEqual(approved.status, HTTPStatus.OK)

        listed = self._call(
            economics.api_project_financial_baselines,
            f"/api/projects/{self.project_id}/financial-baselines",
        )
        statuses = {
            baseline["versionNo"]: (
                baseline["status"], baseline["supersededByBaselineId"]
            )
            for baseline in listed.response["baselines"]
        }
        self.assertEqual(statuses[1], ("superseded", second["id"]))
        self.assertEqual(statuses[2], ("approved", None))
        self.assertEqual(self._legacy_snapshot(), self.legacy_before)

    def test_replacement_is_blocked_when_old_version_has_operational_links(self) -> None:
        first = self._fill_submit_approve()
        with server.db() as con:
            timestamp = server.now_ts()
            con.execute(
                """
                INSERT INTO project_commitments (
                    project_id, baseline_id, commitment_type, commitment_no,
                    status, currency_code, counterparty_name, reason,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, 'other', 'OP-1', 'draft', 'RUB', 'Supplier',
                          'Operational link', ?, ?, ?)
                """,
                (
                    self.project_id,
                    first["id"],
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            con.commit()
        second = self._create_draft(
            reason="Unsafe replacement",
            clone_from_id=first["id"],
            effective_from="2026-09-01",
        )
        self._call(
            economics.api_submit_financial_baseline,
            f"/api/financial-baselines/{second['id']}/submit",
        )

        blocked = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{second['id']}/approve",
        )

        self.assertEqual(blocked.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            blocked.response["error"],
            "baseline_replacement_requires_operational_mapping",
        )
        with server.db() as con:
            statuses = dict(
                con.execute(
                    """
                    SELECT version_no, status FROM project_financial_baselines
                    WHERE project_id = ? ORDER BY version_no
                    """,
                    (self.project_id,),
                ).fetchall()
            )
        self.assertEqual(statuses, {1: "approved", 2: "pending_approval"})

    def test_approved_baseline_cannot_be_edited_through_api(self) -> None:
        approved = self._fill_submit_approve()
        edit = self._call(
            economics.api_update_financial_baseline,
            f"/api/financial-baselines/{approved['id']}/update",
            {"reason": "Silent rewrite"},
        )
        self.assertEqual(edit.status, HTTPStatus.CONFLICT)
        self.assertEqual(edit.response["error"], "financial_baseline_not_draft")

    def test_full_role_matrix_blocks_baseline_data_at_api_boundary(self) -> None:
        allowed = {"main_admin", "admin", "director"}
        for role in auth.ROLE_CODES:
            with self.subTest(role=role):
                handler = self._call(
                    economics.api_project_financial_baselines,
                    f"/api/projects/{self.project_id}/financial-baselines",
                    user={"id": self.admin_id, "role": role, "roles": []},
                )
                if role in allowed:
                    self.assertEqual(handler.status, HTTPStatus.OK)
                    self.assertIn("baselines", handler.response)
                else:
                    self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
                    self.assertEqual(handler.response, {"error": "forbidden"})

    def test_server_routes_expose_only_explicit_baseline_workflow_actions(self) -> None:
        source = (PROJECT_ROOT / "backend" / "server.py").read_text(encoding="utf-8")
        for route in (
            'path.startswith("/api/projects/") and path.endswith("/financial-baselines")',
            'path.startswith("/api/financial-baselines/") and path.endswith("/update")',
            'path.startswith("/api/financial-baselines/") and path.endswith("/submit")',
            'path.startswith("/api/financial-baselines/") and path.endswith("/return")',
            'path.startswith("/api/financial-baselines/") and path.endswith("/approve")',
        ):
            self.assertIn(route, source)
        self.assertNotIn('financial-baselines/auto-migrate', source)


if __name__ == "__main__":
    unittest.main()
