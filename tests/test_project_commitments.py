from __future__ import annotations

import gc
import sqlite3
import sys
import tempfile
import threading
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import auth  # noqa: E402
import economics  # noqa: E402
import economics_workflow  # noqa: E402
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


class ProjectCommitmentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "project-commitments.sqlite3"
        server.DB_PATH = test_db
        economics.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            project_cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent, created_at
                )
                VALUES ('Commitment project', 'Address', 'Client', 'active',
                        1000000.25, 250000.75, 125000.50, ?)
                """,
                (server.now_ts(),),
            )
            self.project_id = int(project_cursor.lastrowid)
            item_cursor = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind
                )
                VALUES (?, 'Selected material', 'pcs', 2, 150, 'material')
                """,
                (self.project_id,),
            )
            self.estimate_item_id = int(item_cursor.lastrowid)
            self.baseline_id, self.budget_line_id = self._create_approved_baseline(con)
            offer_cursor = con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_type, candidate_name,
                    source_type, price, qty, unit, status, created_by,
                    activated_by, activated_at, created_at, updated_at
                )
                VALUES (?, ?, 'supplier', 'Selected supplier', 'manual',
                        120, 2, 'pcs', 'selected', ?, ?, ?, ?, ?)
                """,
                (
                    self.project_id,
                    self.estimate_item_id,
                    self.admin_id,
                    self.admin_id,
                    server.now_ts(),
                    server.now_ts(),
                    server.now_ts(),
                ),
            )
            self.offer_id = int(offer_cursor.lastrowid)
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
        baseline_cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, source_snapshot_hash,
                reason, created_by, created_at, updated_at
            )
            VALUES (?, 1, 'draft', 'RUB', 'sha256:commitment-test',
                    'Commitment test baseline', ?, ?, ?)
            """,
            (self.project_id, self.admin_id, timestamp, timestamp),
        )
        baseline_id = int(baseline_cursor.lastrowid)
        con.execute(
            """
            INSERT INTO project_revenue_lines (
                baseline_id, position, estimate_item_id, title, unit, quantity,
                unit_price_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
                vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
                source_type, source_reference, created_by, created_at
            )
            VALUES (?, 1, ?, 'Contract line', 'pcs', 2, 15000, 30000,
                    0, 0, 30000, 'no_vat', 'estimate', 'estimate:1', ?, ?)
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
            )
            VALUES (?, 1, 'direct_cost', 'MAT', ?, 'Material budget', 'pcs', 2,
                    10000, 20000, 0, 0, 20000, 'no_vat', 'estimate',
                    'estimate:1', ?, ?)
            """,
            (baseline_id, self.estimate_item_id, self.admin_id, timestamp),
        )
        reserve_cursor = con.execute(
            """
            INSERT INTO project_budget_lines (
                baseline_id, position, line_type, cost_code, title,
                net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, source_type,
                source_reference, created_by, created_at
            ) VALUES (?, 2, 'management_reserve', 'RESERVE', 'Management reserve',
                      5000, 0, 0, 5000, 'no_vat', 'policy',
                      'policy:reserve', ?, ?)
            """,
            (baseline_id, self.admin_id, timestamp),
        )
        self.reserve_line_id = int(reserve_cursor.lastrowid)
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

    def _create_payload(self, *, commitment_no: str = "PO-001") -> dict:
        return {
            "supplierOfferId": self.offer_id,
            "baselineId": self.baseline_id,
            "budgetLineId": self.budget_line_id,
            "commitmentNo": commitment_no,
            "vatMode": "gross",
            "vatRateBasisPoints": 2000,
            "reason": "Approved procurement requirement",
        }

    def _create_commitment(self, *, commitment_no: str = "PO-001") -> int:
        handler = FakeHandler(self.admin_user, self._create_payload(commitment_no=commitment_no))
        economics.api_create_commitment_from_offer(
            handler,
            f"/api/projects/{self.project_id}/commitments/from-offer",
        )
        self.assertEqual(handler.status, HTTPStatus.CREATED)
        return int(handler.response["id"])

    def _submit_and_approve(self, commitment_id: int) -> None:
        submit = FakeHandler(self.admin_user)
        economics.api_submit_commitment(submit, f"/api/commitments/{commitment_id}/submit")
        self.assertEqual(submit.status, HTTPStatus.OK)
        self.assertEqual(submit.response["status"], "pending_approval")

        approve = FakeHandler(self.admin_user)
        economics.api_approve_commitment(approve, f"/api/commitments/{commitment_id}/approve")
        self.assertEqual(approve.status, HTTPStatus.OK)
        self.assertEqual(approve.response["status"], "approved")

    @staticmethod
    def _legacy_snapshot(con: sqlite3.Connection) -> tuple[list[tuple], list[tuple], int]:
        projects = [
            tuple(row)
            for row in con.execute(
                """
                SELECT id, quote(budget), typeof(budget), quote(paid), typeof(paid),
                       quote(spent), typeof(spent)
                FROM projects ORDER BY id
                """
            ).fetchall()
        ]
        estimate_items = [
            tuple(row)
            for row in con.execute(
                """
                SELECT id, quote(planned_price), typeof(planned_price)
                FROM estimate_items ORDER BY id
                """
            ).fetchall()
        ]
        finance_count = int(con.execute("SELECT COUNT(*) FROM finance_entries").fetchone()[0])
        return projects, estimate_items, finance_count

    def test_selected_offer_does_not_create_commitment_automatically(self) -> None:
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM project_commitments").fetchone()[0], 0)

    def test_manual_multi_line_commitment_uses_budget_mapping_and_exact_vat(self) -> None:
        handler = FakeHandler(self.admin_user, {
            "baselineId": self.baseline_id,
            "commitmentType": "subcontract",
            "commitmentNo": "SC-001",
            "counterpartyName": "Installation team",
            "reason": "Confirmed subcontract scope",
            "lines": [
                {
                    "budgetLineId": self.budget_line_id,
                    "estimateItemId": self.estimate_item_id,
                    "title": "Materials",
                    "unit": "pcs",
                    "quantity": 2,
                    "unitPrice": "120.00",
                    "vatMode": "gross",
                    "vatRateBasisPoints": 2000,
                    "sourceReference": "manual:SC-001:1",
                },
                {
                    "budgetLineId": self.budget_line_id,
                    "estimateItemId": self.estimate_item_id,
                    "title": "Additional delivery scope",
                    "unit": "pcs",
                    "quantity": 3,
                    "unitPrice": "80.00",
                    "vatMode": "no_vat",
                    "vatRateBasisPoints": 0,
                    "sourceReference": "manual:SC-001:2",
                },
            ],
        })
        economics.api_create_commitment(
            handler,
            f"/api/projects/{self.project_id}/commitments",
        )

        self.assertEqual(handler.status, HTTPStatus.CREATED)
        with server.db() as con:
            commitment = con.execute(
                "SELECT * FROM project_commitments WHERE id = ?",
                (handler.response["id"],),
            ).fetchone()
            lines = con.execute(
                """
                SELECT * FROM project_commitment_lines
                WHERE commitment_id = ? ORDER BY position
                """,
                (handler.response["id"],),
            ).fetchall()
        self.assertEqual(commitment["status"], "draft")
        self.assertIsNone(commitment["source_supplier_offer_id"])
        self.assertEqual(len(lines), 2)
        self.assertEqual(
            [(row["net_amount_kopecks"], row["vat_amount_kopecks"], row["gross_amount_kopecks"]) for row in lines],
            [(20000, 4000, 24000), (24000, 0, 24000)],
        )

    def test_manual_commitment_rejects_budget_line_from_another_baseline(self) -> None:
        handler = FakeHandler(self.admin_user, {
            "baselineId": self.baseline_id,
            "commitmentType": "other",
            "counterpartyName": "Counterparty",
            "reason": "Wrong mapping regression",
            "lines": [{
                "budgetLineId": self.budget_line_id + 100000,
                "title": "Wrong line",
                "quantity": 1,
                "unitPrice": 1,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "sourceReference": "manual:wrong",
            }],
        })
        economics.api_create_commitment(
            handler,
            f"/api/projects/{self.project_id}/commitments",
        )
        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response, {"error": "commitment_budget_mapping_required"})
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM project_commitments").fetchone()[0], 0)

    def test_manual_commitment_rejects_operational_unit_mismatch(self) -> None:
        handler = FakeHandler(self.admin_user, {
            "baselineId": self.baseline_id,
            "commitmentType": "other",
            "counterpartyName": "Counterparty",
            "reason": "Unit mismatch regression",
            "lines": [{
                "budgetLineId": self.budget_line_id,
                "estimateItemId": self.estimate_item_id,
                "title": "Wrong unit",
                "unit": "hour",
                "quantity": 1,
                "unitPrice": 1,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "sourceReference": "manual:wrong-unit",
            }],
        })
        economics.api_create_commitment(
            handler,
            f"/api/projects/{self.project_id}/commitments",
        )
        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response, {"error": "operational_unit_mismatch"})
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM project_commitments").fetchone()[0], 0)

    def test_management_reserve_cannot_back_operational_commitment(self) -> None:
        handler = FakeHandler(self.admin_user, {
            "baselineId": self.baseline_id,
            "commitmentType": "other",
            "counterpartyName": "Counterparty",
            "reason": "Reserve is not an operational budget line",
            "lines": [{
                "budgetLineId": self.reserve_line_id,
                "title": "Must be rejected",
                "quantity": 1,
                "unitPrice": 100,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "sourceReference": "manual:reserve",
            }],
        })
        economics.api_create_commitment(
            handler, f"/api/projects/{self.project_id}/commitments"
        )
        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response, {"error": "commitment_budget_mapping_required"})

    def test_manual_commitment_lines_can_be_replaced_and_pending_can_be_returned(self) -> None:
        create = FakeHandler(self.admin_user, {
            "baselineId": self.baseline_id,
            "commitmentType": "other",
            "commitmentNo": "MANUAL-RETURN",
            "counterpartyName": "Counterparty",
            "reason": "Initial draft",
            "lines": [{
                "budgetLineId": self.budget_line_id,
                "estimateItemId": self.estimate_item_id,
                "title": "Initial line",
                "unit": "pcs",
                "quantity": 1,
                "unitPrice": 100,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "sourceReference": "manual:return:initial",
            }],
        })
        economics.api_create_commitment(
            create, f"/api/projects/{self.project_id}/commitments"
        )
        self.assertEqual(create.status, HTTPStatus.CREATED)
        commitment_id = int(create.response["id"])

        replace = FakeHandler(self.admin_user, {
            "commitmentNo": "MANUAL-RETURN-UPDATED",
            "expectedDate": "2026-09-01",
            "reason": "Header and lines are one transaction",
            "lines": [
            {
                "budgetLineId": self.budget_line_id,
                "estimateItemId": self.estimate_item_id,
                "title": "Replacement A",
                "unit": "pcs",
                "quantity": 1,
                "unitPrice": 100,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "sourceReference": "manual:return:a",
            },
            {
                "budgetLineId": self.budget_line_id,
                "estimateItemId": self.estimate_item_id,
                "title": "Replacement B",
                "unit": "pcs",
                "quantity": 1,
                "unitPrice": 120,
                "vatMode": "gross",
                "vatRateBasisPoints": 2000,
                "sourceReference": "manual:return:b",
            },
        ]})
        economics_workflow.api_replace_commitment_lines(
            replace, f"/api/commitments/{commitment_id}/replace-lines"
        )
        self.assertEqual(replace.status, HTTPStatus.OK)
        self.assertEqual(replace.response["lineCount"], 2)

        rejected = FakeHandler(self.admin_user, {
            "commitmentNo": "MUST-NOT-PERSIST",
            "reason": "This whole update must roll back",
            "lines": [{
                "budgetLineId": self.budget_line_id + 100000,
                "title": "Invalid replacement",
                "quantity": 1,
                "unitPrice": 1,
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "sourceReference": "manual:invalid",
            }],
        })
        economics_workflow.api_replace_commitment_lines(
            rejected, f"/api/commitments/{commitment_id}/replace-lines"
        )
        self.assertEqual(rejected.status, HTTPStatus.BAD_REQUEST)

        submit = FakeHandler(self.admin_user)
        economics.api_submit_commitment(
            submit, f"/api/commitments/{commitment_id}/submit"
        )
        self.assertEqual(submit.status, HTTPStatus.OK)
        returned = FakeHandler(self.admin_user, {"reason": "Clarify quantities"})
        economics_workflow.api_return_commitment(
            returned, f"/api/commitments/{commitment_id}/return"
        )
        self.assertEqual(returned.status, HTTPStatus.OK)
        self.assertEqual(returned.response["status"], "draft")

        with server.db() as con:
            commitment = con.execute(
                "SELECT * FROM project_commitments WHERE id = ?", (commitment_id,)
            ).fetchone()
            lines = con.execute(
                "SELECT * FROM project_commitment_lines WHERE commitment_id = ? ORDER BY position",
                (commitment_id,),
            ).fetchall()
            event = con.execute(
                """
                SELECT details FROM project_commitment_events
                WHERE commitment_id = ? ORDER BY id DESC LIMIT 1
                """,
                (commitment_id,),
            ).fetchone()
        self.assertEqual(commitment["status"], "draft")
        self.assertEqual(commitment["commitment_no"], "MANUAL-RETURN-UPDATED")
        self.assertEqual(commitment["expected_date"], "2026-09-01")
        self.assertEqual(commitment["reason"], "Header and lines are one transaction")
        self.assertIsNone(commitment["submitted_by"])
        self.assertEqual([row["title"] for row in lines], ["Replacement A", "Replacement B"])
        self.assertIn("Clarify quantities", event["details"])

    def test_create_draft_snapshots_offer_and_normalizes_vat(self) -> None:
        commitment_id = self._create_commitment()
        with server.db() as con:
            commitment = con.execute(
                "SELECT * FROM project_commitments WHERE id = ?",
                (commitment_id,),
            ).fetchone()
            line = con.execute(
                "SELECT * FROM project_commitment_lines WHERE commitment_id = ?",
                (commitment_id,),
            ).fetchone()
            self.assertEqual(commitment["status"], "draft")
            self.assertEqual(commitment["baseline_id"], self.baseline_id)
            self.assertEqual(commitment["source_supplier_offer_id"], self.offer_id)
            self.assertEqual(line["budget_line_id"], self.budget_line_id)
            self.assertEqual(line["source_unit_price_kopecks"], 12000)
            self.assertEqual(line["unit_cost_net_kopecks"], 10000)
            self.assertEqual(line["net_amount_kopecks"], 20000)
            self.assertEqual(line["vat_amount_kopecks"], 4000)
            self.assertEqual(line["gross_amount_kopecks"], 24000)

            con.execute("UPDATE supplier_offers SET price = 999 WHERE id = ?", (self.offer_id,))
            con.commit()
            unchanged = con.execute(
                "SELECT source_unit_price_kopecks FROM project_commitment_lines WHERE id = ?",
                (line["id"],),
            ).fetchone()[0]
            self.assertEqual(unchanged, 12000)

    def test_offer_can_have_only_one_non_cancelled_commitment(self) -> None:
        first_id = self._create_commitment()
        duplicate = FakeHandler(self.admin_user, self._create_payload(commitment_no="PO-002"))
        economics.api_create_commitment_from_offer(
            duplicate,
            f"/api/projects/{self.project_id}/commitments/from-offer",
        )
        self.assertEqual(duplicate.status, HTTPStatus.CONFLICT)
        self.assertEqual(duplicate.response, {"error": "offer_commitment_exists", "commitmentId": first_id})

    def test_concurrent_offer_creation_creates_exactly_one_commitment(self) -> None:
        barrier = threading.Barrier(2)
        handlers: list[FakeHandler] = []
        lock = threading.Lock()

        def worker(number: str) -> None:
            handler = FakeHandler(
                self.admin_user, self._create_payload(commitment_no=number)
            )
            barrier.wait(timeout=5)
            economics.api_create_commitment_from_offer(
                handler,
                f"/api/projects/{self.project_id}/commitments/from-offer",
            )
            with lock:
                handlers.append(handler)

        threads = [
            threading.Thread(target=worker, args=("PO-RACE-1",)),
            threading.Thread(target=worker, args=("PO-RACE-2",)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertEqual(sorted(int(item.status) for item in handlers), [201, 409])
        with server.db() as con:
            count = con.execute(
                """
                SELECT COUNT(*) FROM project_commitments
                WHERE source_supplier_offer_id = ? AND status <> 'cancelled'
                """,
                (self.offer_id,),
            ).fetchone()[0]
        self.assertEqual(count, 1)

    def test_unselected_offer_cannot_create_commitment(self) -> None:
        with server.db() as con:
            con.execute("UPDATE supplier_offers SET status = 'quoted' WHERE id = ?", (self.offer_id,))
            con.commit()
        handler = FakeHandler(self.admin_user, self._create_payload())
        economics.api_create_commitment_from_offer(
            handler,
            f"/api/projects/{self.project_id}/commitments/from-offer",
        )
        self.assertEqual(handler.status, HTTPStatus.CONFLICT)
        self.assertEqual(handler.response, {"error": "selected_project_offer_required"})

    def test_submit_approve_and_cancel_have_immutable_history(self) -> None:
        commitment_id = self._create_commitment()
        self._submit_and_approve(commitment_id)

        listing = FakeHandler(self.admin_user)
        economics.api_project_commitments(
            listing,
            f"/api/projects/{self.project_id}/commitments",
        )
        self.assertEqual(listing.status, HTTPStatus.OK)
        self.assertEqual(listing.response["summary"]["approvedNetKopecks"], 20000)
        self.assertEqual(
            [event["action"] for event in listing.response["items"][0]["events"]],
            ["created", "submitted", "approved"],
        )

        with server.db() as con:
            line_id = int(
                con.execute(
                    "SELECT id FROM project_commitment_lines WHERE commitment_id = ?",
                    (commitment_id,),
                ).fetchone()[0]
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "lines_are_not_editable"):
                con.execute(
                    "UPDATE project_commitment_lines SET net_amount_kopecks = 1 WHERE id = ?",
                    (line_id,),
                )
            event_id = int(
                con.execute(
                    "SELECT id FROM project_commitment_events WHERE commitment_id = ? LIMIT 1",
                    (commitment_id,),
                ).fetchone()[0]
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "event_is_immutable"):
                con.execute("DELETE FROM project_commitment_events WHERE id = ?", (event_id,))

        cancel = FakeHandler(self.admin_user, {"cancellationReason": "Order withdrawn"})
        economics.api_cancel_commitment(cancel, f"/api/commitments/{commitment_id}/cancel")
        self.assertEqual(cancel.status, HTTPStatus.OK)

        listing = FakeHandler(self.admin_user)
        economics.api_project_commitments(
            listing,
            f"/api/projects/{self.project_id}/commitments",
        )
        self.assertEqual(listing.response["summary"]["approvedCount"], 0)
        self.assertEqual(listing.response["summary"]["approvedNetKopecks"], 0)
        self.assertEqual(listing.response["items"][0]["status"], "cancelled")

    def test_approval_requires_approver_even_with_valid_lines(self) -> None:
        commitment_id = self._create_commitment()
        timestamp = server.now_ts()
        with server.db() as con:
            con.execute(
                """
                UPDATE project_commitments
                SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (self.admin_id, timestamp, timestamp, commitment_id),
            )
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute(
                    "UPDATE project_commitments SET status = 'approved', updated_at = ? WHERE id = ?",
                    (timestamp, commitment_id),
                )

    def test_commitment_api_role_matrix_omits_all_economics_for_blocked_roles(self) -> None:
        allowed_roles = {"main_admin", "admin", "director"}
        for role in auth.ROLE_CODES:
            with self.subTest(role=role):
                handler = FakeHandler({"id": self.admin_id, "role": role, "roles": []})
                economics.api_project_commitments(
                    handler,
                    f"/api/projects/{self.project_id}/commitments",
                )
                if role in allowed_roles:
                    self.assertEqual(handler.status, HTTPStatus.OK)
                    self.assertIn("summary", handler.response)
                else:
                    self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
                    self.assertEqual(handler.response, {"error": "forbidden"})

    def test_commitment_lifecycle_does_not_modify_legacy_finance_or_estimate(self) -> None:
        with server.db() as con:
            before = self._legacy_snapshot(con)
        commitment_id = self._create_commitment()
        self._submit_and_approve(commitment_id)
        with server.db() as con:
            after = self._legacy_snapshot(con)
        self.assertEqual(after, before)


if __name__ == "__main__":
    unittest.main()
