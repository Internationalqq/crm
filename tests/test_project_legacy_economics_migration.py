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
import legacy_economics  # noqa: E402
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


class ProjectLegacyEconomicsMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_server_db = server.DB_PATH
        self.original_economics_db = economics.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR

        temp_path = Path(self.temp_dir.name)
        test_db = temp_path / "legacy-economics.sqlite3"
        server.DB_PATH = test_db
        economics.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()
        with server.db() as con:
            legacy_economics.ensure_legacy_economics_schema(con)
            self.admin_id = int(
                con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0]
            )
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent,
                    created_at, updated_at
                ) VALUES ('Legacy object', 'Address', 'Client', 'active',
                          1200.0, 123.45, 67.89, ?, ?)
                """,
                (timestamp, timestamp),
            )
            self.project_id = int(cursor.lastrowid)
            item_one = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price,
                    item_kind, section_title, article, updated_at
                ) VALUES (?, 'Concrete', 'm3', 2, 300, 'material', 'Materials', 'M-1', ?)
                """,
                (self.project_id, timestamp),
            )
            item_two = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price,
                    item_kind, section_title, article, updated_at
                ) VALUES (?, 'Installation', 'h', 3, 200, 'work', 'Works', 'W-1', ?)
                """,
                (self.project_id, timestamp),
            )
            self.estimate_item_ids = [int(item_one.lastrowid), int(item_two.lastrowid)]

            evidence_path = temp_path / "approved-contract.pdf"
            evidence_path.write_bytes(b"immutable contract evidence v1")
            document = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, original_name,
                    storage_name, storage_path, mime_type, file_ext, size_bytes,
                    uploaded_by, created_at, updated_at
                ) VALUES (?, 'Contract and estimate', 'contract', 'approved',
                          'contract.pdf', 'contract.pdf', ?, 'application/pdf',
                          '.pdf', ?, ?, ?, ?)
                """,
                (
                    self.project_id,
                    str(evidence_path),
                    evidence_path.stat().st_size,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            self.document_id = int(document.lastrowid)
            con.commit()
        self.evidence_path = evidence_path
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
            items = con.execute(
                """
                SELECT id, quote(planned_qty), typeof(planned_qty),
                       quote(planned_price), typeof(planned_price)
                FROM estimate_items WHERE project_id = ? ORDER BY id
                """,
                (self.project_id,),
            ).fetchall()
        return tuple(project) + tuple(tuple(row) for row in items)

    def _call(self, function, path: str, payload: dict | None = None, user: dict | None = None):
        handler = FakeHandler(user or self.admin, payload)
        function(handler, path)
        return handler

    def _scan(self, project_id: int | None = None, user: dict | None = None) -> dict:
        project_id = project_id or self.project_id
        handler = self._call(
            legacy_economics.api_scan_project_legacy_economics,
            f"/api/projects/{project_id}/legacy-economics-migration/scan",
            user=user,
        )
        self.assertIn(handler.status, {HTTPStatus.OK, HTTPStatus.CREATED})
        return handler.response["review"]

    def _valid_update_payload(self, review: dict) -> dict:
        decisions = [
            {
                "sourceKind": "project_budget",
                "targetKind": "revenue",
                "position": 1,
                "title": "Contract revenue",
                "vatMode": "gross",
                "vatRateBasisPoints": 2000,
                "evidenceKey": "contract",
                "comment": "Confirmed by signed contract",
            }
        ]
        for position, item in enumerate(review["snapshot"]["items"], start=1):
            decisions.append(
                {
                    "sourceKind": "estimate_item",
                    "snapshotItemId": item["id"],
                    "targetKind": "target_cost",
                    "position": position,
                    "title": item["title"],
                    "vatMode": "net",
                    "vatRateBasisPoints": 2000,
                    "evidenceKey": "contract",
                    "comment": "Confirmed internal target-cost line",
                    "lineType": "direct_cost",
                }
            )
        return {
            "expectedRevision": review["revisionNo"],
            "expectedSourceContentHash": review["snapshot"]["sourceContentHash"],
            "budgetClassification": "contract_revenue_candidate",
            "estimateClassification": "internal_cost",
            "defaultVatMode": "net",
            "defaultVatRateBasisPoints": 2000,
            "sourcesComparable": True,
            "effectiveFrom": "2026-08-21",
            "discrepancyComment": "Totals agree; sources have different economic roles.",
            "evidence": [
                {
                    "key": "contract",
                    "documentId": self.document_id,
                    "sourceReference": "contract:approved:2026-08-21",
                }
            ],
            "decisions": decisions,
            "resolutions": [],
        }

    def _update_valid_review(self, review: dict) -> dict:
        handler = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            self._valid_update_payload(review),
        )
        self.assertEqual(handler.status, HTTPStatus.OK, handler.response)
        return handler.response["review"]

    def test_scan_is_exact_idempotent_and_legacy_values_do_not_change(self) -> None:
        first = self._scan()
        second = self._scan()

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(first["snapshotId"], second["snapshotId"])
        self.assertEqual(
            first["snapshot"]["sourceContentHash"],
            second["snapshot"]["sourceContentHash"],
        )
        self.assertRegex(first["snapshot"]["sourceContentHash"], r"^sha256:[0-9a-f]{64}$")
        self.assertRegex(first["snapshot"]["snapshotHash"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(first["snapshot"]["legacyBudgetKopecks"], 120000)
        self.assertEqual(first["snapshot"]["legacyPaidKopecks"], 12345)
        self.assertEqual(first["snapshot"]["legacySpentKopecks"], 6789)
        self.assertEqual(first["snapshot"]["estimateTotalKopecks"], 120000)
        self.assertEqual(first["status"], "ready_for_review")
        self.assertEqual(first["anomalies"], [])
        self.assertEqual(self._legacy_snapshot(), self.legacy_before)

        with server.db() as con:
            self.assertEqual(
                con.execute("SELECT COUNT(*) FROM project_legacy_economics_snapshots").fetchone()[0],
                1,
            )
            self.assertEqual(
                con.execute("SELECT COUNT(*) FROM project_legacy_migration_reviews").fetchone()[0],
                1,
            )

    def test_estimate_item_cannot_be_management_reserve_but_manual_reserve_is_allowed(
        self,
    ) -> None:
        review = self._scan()
        invalid_payload = self._valid_update_payload(review)
        invalid_payload["decisions"][1]["lineType"] = "management_reserve"

        rejected = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            invalid_payload,
        )

        self.assertEqual(rejected.status, HTTPStatus.CONFLICT)
        self.assertEqual(
            rejected.response["error"],
            "legacy_management_reserve_requires_manual_source",
        )
        with server.db() as con:
            stored = con.execute(
                "SELECT revision_no FROM project_legacy_migration_reviews WHERE id = ?",
                (review["id"],),
            ).fetchone()
            self.assertEqual(int(stored["revision_no"]), review["revisionNo"])
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM project_legacy_migration_decisions WHERE review_id = ?",
                    (review["id"],),
                ).fetchone()[0],
                0,
            )

        valid_payload = self._valid_update_payload(review)
        valid_payload["decisions"].append(
            {
                "sourceKind": "manual",
                "clientKey": "management-reserve",
                "sourceAmountKopecks": 15000,
                "targetKind": "target_cost",
                "lineType": "management_reserve",
                "position": 3,
                "title": "Management reserve",
                "vatMode": "no_vat",
                "vatRateBasisPoints": 0,
                "evidenceKey": "contract",
                "comment": "Explicit aggregate reserve approved by management",
            }
        )
        accepted = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            valid_payload,
        )

        self.assertEqual(accepted.status, HTTPStatus.OK, accepted.response)
        reserve = next(
            item
            for item in accepted.response["review"]["decisions"]
            if item["sourceKind"] == "manual"
        )
        self.assertEqual(reserve["targetKind"], "target_cost")
        self.assertEqual(reserve["lineType"], "management_reserve")

    def test_ignore_uses_locked_revision_and_audits_only_a_real_transition(self) -> None:
        review = self._scan()
        original_db = economics.db
        events: list[str] = []

        class RacingConnection:
            def __init__(self, connection: sqlite3.Connection):
                self.connection = connection
                self.injected = False

            def __enter__(self):
                self.connection.__enter__()
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                return self.connection.__exit__(exc_type, exc_value, traceback)

            def __getattr__(self, name):
                return getattr(self.connection, name)

            def execute(self, sql: str, parameters=()):
                normalized = " ".join(sql.split())
                if normalized == "BEGIN IMMEDIATE":
                    events.append("begin_immediate")
                elif (
                    normalized.startswith(
                        "SELECT * FROM project_legacy_migration_reviews WHERE id = ?"
                    )
                    and "locked_review_read" not in events
                ):
                    events.append("locked_review_read")
                if (
                    not self.injected
                    and "SET status = 'ignored'" in normalized
                    and "revision_no = revision_no + 1" in normalized
                ):
                    self.assert_locked_order()
                    self.connection.execute(
                        """
                        UPDATE project_legacy_migration_reviews
                        SET revision_no = revision_no + 1
                        WHERE id = ?
                        """,
                        (review["id"],),
                    )
                    self.injected = True
                    events.append("competing_revision")
                return self.connection.execute(sql, parameters)

            @staticmethod
            def assert_locked_order() -> None:
                if events[:2] != ["begin_immediate", "locked_review_read"]:
                    raise AssertionError(f"unexpected ignore lock order: {events}")

        economics.db = lambda: RacingConnection(original_db())
        try:
            raced = self._call(
                legacy_economics.api_ignore_project_legacy_economics_review,
                f"/api/legacy-economics-migrations/{review['id']}/ignore",
                {"expectedRevision": review["revisionNo"], "reason": "Race test"},
            )
        finally:
            economics.db = original_db

        self.assertEqual(raced.status, HTTPStatus.CONFLICT, raced.response)
        self.assertEqual(raced.response["error"], "legacy_review_revision_conflict")
        self.assertEqual(
            events[:3],
            ["begin_immediate", "locked_review_read", "competing_revision"],
        )
        with server.db() as con:
            stored = con.execute(
                "SELECT status, revision_no FROM project_legacy_migration_reviews WHERE id = ?",
                (review["id"],),
            ).fetchone()
            self.assertEqual(stored["status"], review["status"])
            self.assertEqual(int(stored["revision_no"]), review["revisionNo"])
            self.assertEqual(
                con.execute(
                    """
                    SELECT COUNT(*) FROM audit_log
                    WHERE action = 'ignore_legacy_economics_review' AND entity_id = ?
                    """,
                    (review["id"],),
                ).fetchone()[0],
                0,
            )

        ignored = self._call(
            legacy_economics.api_ignore_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/ignore",
            {"expectedRevision": review["revisionNo"], "reason": "Approved exclusion"},
        )
        self.assertEqual(ignored.status, HTTPStatus.OK, ignored.response)
        replay = self._call(
            legacy_economics.api_ignore_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/ignore",
            {"expectedRevision": review["revisionNo"], "reason": "Approved exclusion"},
        )
        self.assertEqual(replay.status, HTTPStatus.OK, replay.response)
        self.assertTrue(replay.response["idempotentReplay"])
        with server.db() as con:
            self.assertEqual(
                con.execute(
                    """
                    SELECT COUNT(*) FROM audit_log
                    WHERE action = 'ignore_legacy_economics_review' AND entity_id = ?
                    """,
                    (review["id"],),
                ).fetchone()[0],
                1,
            )

    def test_snapshot_source_changes_create_new_snapshot_only_after_old_review_is_terminal(self) -> None:
        first = self._scan()
        with server.db() as con:
            con.execute(
                "UPDATE estimate_items SET planned_price = 301 WHERE id = ?",
                (self.estimate_item_ids[0],),
            )
            con.commit()

        blocked = self._call(
            legacy_economics.api_scan_project_legacy_economics,
            f"/api/projects/{self.project_id}/legacy-economics-migration/scan",
        )
        self.assertEqual(blocked.status, HTTPStatus.CONFLICT)
        self.assertEqual(blocked.response["error"], "legacy_migration_open_review_exists")

        ignored = self._call(
            legacy_economics.api_ignore_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{first['id']}/ignore",
            {"expectedRevision": first["revisionNo"], "reason": "Source changed; rescan"},
        )
        self.assertEqual(ignored.status, HTTPStatus.OK)
        second = self._scan()
        self.assertNotEqual(first["snapshotId"], second["snapshotId"])
        self.assertNotEqual(
            first["snapshot"]["sourceContentHash"], second["snapshot"]["sourceContentHash"]
        )
        self.assertEqual(self._legacy_snapshot()[0:6], self.legacy_before[0:6])

    def test_snapshot_and_terminal_review_are_immutable_at_database_level(self) -> None:
        review = self._scan()
        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "snapshot_is_immutable"):
                con.execute(
                    "UPDATE project_legacy_economics_snapshots SET budget_kopecks = 1 WHERE id = ?",
                    (review["snapshotId"],),
                )
            con.rollback()
            with self.assertRaisesRegex(sqlite3.IntegrityError, "snapshot_item_is_immutable"):
                con.execute(
                    "UPDATE project_legacy_estimate_snapshot_items SET title = 'Changed' WHERE snapshot_id = ?",
                    (review["snapshotId"],),
                )
            con.rollback()

        ignored = self._call(
            legacy_economics.api_ignore_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/ignore",
            {"expectedRevision": review["revisionNo"], "reason": "Deliberately excluded"},
        )
        self.assertEqual(ignored.status, HTTPStatus.OK)
        with server.db() as con:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "review_is_terminal"):
                con.execute(
                    "UPDATE project_legacy_migration_reviews SET discrepancy_comment = 'x' WHERE id = ?",
                    (review["id"],),
                )

    def test_optimistic_update_and_role_matrix(self) -> None:
        denied_roles = ["financier", "accountant", "foreman", "purchaser", "customer", "client"]
        for index, role in enumerate(denied_roles, start=1):
            with self.subTest(role=role):
                denied = {"id": self.admin_id + index, "role": role, "roles": []}
                handler = self._call(
                    legacy_economics.api_scan_project_legacy_economics,
                    f"/api/projects/{self.project_id}/legacy-economics-migration/scan",
                    user=denied,
                )
                self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
                self.assertEqual(handler.response, {"error": "forbidden"})

        director_secondary = {
            "id": self.admin_id,
            "role": "foreman",
            "roles": [{"code": "director"}],
        }
        review = self._scan(user=director_secondary)
        payload = self._valid_update_payload(review)
        first = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            payload,
            user=director_secondary,
        )
        self.assertEqual(first.status, HTTPStatus.OK, first.response)
        stale = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            payload,
            user=director_secondary,
        )
        self.assertEqual(stale.status, HTTPStatus.CONFLICT)
        self.assertEqual(stale.response["error"], "legacy_review_revision_conflict")

    def test_confirm_creates_one_pending_baseline_with_exact_vat_and_provenance(self) -> None:
        review = self._update_valid_review(self._scan())
        confirm_payload = {
            "expectedRevision": review["revisionNo"],
            "expectedSourceContentHash": review["snapshot"]["sourceContentHash"],
        }
        confirmed = self._call(
            legacy_economics.api_confirm_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/confirm",
            confirm_payload,
        )

        self.assertEqual(confirmed.status, HTTPStatus.CREATED, confirmed.response)
        baseline = confirmed.response["baseline"]
        self.assertEqual(baseline["status"], "pending_approval")
        self.assertEqual(baseline["totals"]["revenueNetKopecks"], 100000)
        self.assertEqual(baseline["totals"]["revenueVatKopecks"], 20000)
        self.assertEqual(baseline["totals"]["revenueGrossKopecks"], 120000)
        self.assertEqual(baseline["totals"]["targetCostNetKopecks"], 120000)
        self.assertEqual(baseline["totals"]["targetCostVatKopecks"], 24000)
        self.assertEqual(baseline["totals"]["targetCostGrossKopecks"], 144000)
        self.assertEqual(confirmed.response["review"]["status"], "confirmed")
        self.assertRegex(
            confirmed.response["review"]["decisionHash"], r"^sha256:[0-9a-f]{64}$"
        )
        for line in baseline["revenueLines"] + baseline["budgetLines"]:
            self.assertIn("legacy-snapshot:", line["sourceReference"])
            self.assertEqual(line["sourceDocumentId"], self.document_id)
        self.assertEqual(self._legacy_snapshot(), self.legacy_before)

        replay = self._call(
            legacy_economics.api_confirm_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/confirm",
            confirm_payload,
        )
        self.assertEqual(replay.status, HTTPStatus.OK)
        self.assertTrue(replay.response["idempotentReplay"])
        self.assertEqual(replay.response["baseline"]["id"], baseline["id"])
        with server.db() as con:
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM project_financial_baselines WHERE project_id = ?",
                    (self.project_id,),
                ).fetchone()[0],
                1,
            )
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM project_revenue_lines WHERE baseline_id = ?",
                    (baseline["id"],),
                ).fetchone()[0],
                1,
            )
            self.assertEqual(
                con.execute(
                    "SELECT COUNT(*) FROM project_budget_lines WHERE baseline_id = ?",
                    (baseline["id"],),
                ).fetchone()[0],
                2,
            )

        economics_before_approval = self._call(
            economics.api_project_economics,
            f"/api/projects/{self.project_id}/economics",
        )
        self.assertEqual(economics_before_approval.response["status"], "not_configured")
        approved = self._call(
            economics.api_approve_financial_baseline,
            f"/api/financial-baselines/{baseline['id']}/approve",
        )
        self.assertEqual(approved.status, HTTPStatus.OK, approved.response)
        economics_after_approval = self._call(
            economics.api_project_economics,
            f"/api/projects/{self.project_id}/economics",
        )
        self.assertEqual(economics_after_approval.response["status"], "ready")

    def test_scan_after_confirm_is_read_only_already_migrated_comparison(self) -> None:
        review = self._update_valid_review(self._scan())
        confirmed = self._call(
            legacy_economics.api_confirm_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/confirm",
            {
                "expectedRevision": review["revisionNo"],
                "expectedSourceContentHash": review["snapshot"]["sourceContentHash"],
            },
        )
        self.assertEqual(confirmed.status, HTTPStatus.CREATED, confirmed.response)
        baseline_id = confirmed.response["baseline"]["id"]

        with server.db() as con:
            counts_before = tuple(
                con.execute(
                    """
                    SELECT
                        (SELECT COUNT(*) FROM project_legacy_economics_snapshots),
                        (SELECT COUNT(*) FROM project_legacy_migration_reviews),
                        (SELECT COUNT(*) FROM project_financial_baselines)
                    """
                ).fetchone()
            )

        same_source = self._call(
            legacy_economics.api_scan_project_legacy_economics,
            f"/api/projects/{self.project_id}/legacy-economics-migration/scan",
        )
        self.assertEqual(same_source.status, HTTPStatus.OK, same_source.response)
        self.assertEqual(same_source.response["status"], "already_migrated")
        self.assertTrue(same_source.response["alreadyMigrated"])
        self.assertTrue(same_source.response["idempotentReplay"])
        self.assertFalse(same_source.response["sourceChanged"])
        self.assertFalse(same_source.response["snapshotCreated"])
        self.assertFalse(same_source.response["reviewCreated"])
        self.assertEqual(same_source.response["review"]["id"], review["id"])
        self.assertEqual(same_source.response["generatedBaselineId"], baseline_id)

        with server.db() as con:
            con.execute(
                "UPDATE estimate_items SET planned_price = 301 WHERE id = ?",
                (self.estimate_item_ids[0],),
            )
            con.commit()

        changed_source = self._call(
            legacy_economics.api_scan_project_legacy_economics,
            f"/api/projects/{self.project_id}/legacy-economics-migration/scan",
        )
        self.assertEqual(changed_source.status, HTTPStatus.OK, changed_source.response)
        self.assertEqual(changed_source.response["status"], "already_migrated")
        self.assertTrue(changed_source.response["sourceChanged"])
        self.assertNotEqual(
            changed_source.response["liveSourceContentHash"],
            review["snapshot"]["sourceContentHash"],
        )

        with server.db() as con:
            counts_after = tuple(
                con.execute(
                    """
                    SELECT
                        (SELECT COUNT(*) FROM project_legacy_economics_snapshots),
                        (SELECT COUNT(*) FROM project_legacy_migration_reviews),
                        (SELECT COUNT(*) FROM project_financial_baselines)
                    """
                ).fetchone()
            )
            link = con.execute(
                """
                SELECT generated_baseline_id FROM project_legacy_migration_reviews
                WHERE id = ?
                """,
                (review["id"],),
            ).fetchone()
        self.assertEqual(counts_after, counts_before)
        self.assertEqual(int(link["generated_baseline_id"]), baseline_id)

    def test_source_or_evidence_drift_blocks_confirm_without_partial_baseline(self) -> None:
        review = self._update_valid_review(self._scan())
        with server.db() as con:
            con.execute(
                "UPDATE estimate_items SET planned_price = 301 WHERE id = ?",
                (self.estimate_item_ids[0],),
            )
            con.commit()
        changed = self._call(
            legacy_economics.api_confirm_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/confirm",
            {
                "expectedRevision": review["revisionNo"],
                "expectedSourceContentHash": review["snapshot"]["sourceContentHash"],
            },
        )
        self.assertEqual(changed.status, HTTPStatus.CONFLICT)
        self.assertEqual(changed.response["error"], "legacy_source_changed_rescan_required")
        with server.db() as con:
            self.assertEqual(
                con.execute("SELECT COUNT(*) FROM project_financial_baselines").fetchone()[0],
                0,
            )

        with server.db() as con:
            con.execute(
                "UPDATE estimate_items SET planned_price = 300 WHERE id = ?",
                (self.estimate_item_ids[0],),
            )
            con.commit()
        self.evidence_path.write_bytes(b"evidence changed after review")
        evidence_changed = self._call(
            legacy_economics.api_confirm_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/confirm",
            {
                "expectedRevision": review["revisionNo"],
                "expectedSourceContentHash": review["snapshot"]["sourceContentHash"],
            },
        )
        self.assertEqual(evidence_changed.status, HTTPStatus.CONFLICT)
        self.assertEqual(evidence_changed.response["error"], "legacy_evidence_changed")
        with server.db() as con:
            self.assertEqual(
                con.execute("SELECT COUNT(*) FROM project_financial_baselines").fetchone()[0],
                0,
            )

    def test_ratio_anomaly_never_confirms_automatically_and_requires_explicit_resolution(self) -> None:
        with server.db() as con:
            timestamp = server.now_ts()
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, budget, paid, spent,
                    created_at, updated_at
                ) VALUES ('Ratio anomaly', 'A', 'C', 'active', 1000, 0, 0, ?, ?)
                """,
                (timestamp, timestamp),
            )
            project_id = int(cursor.lastrowid)
            con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price,
                    item_kind, updated_at
                ) VALUES (?, 'Anomalous cost', 'u', 1, 2000, 'material', ?)
                """,
                (project_id, timestamp),
            )
            document = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, original_name,
                    storage_name, storage_path, size_bytes, uploaded_by,
                    created_at, updated_at
                ) VALUES (?, 'Evidence', 'contract', 'approved', 'e.pdf',
                          'e.pdf', ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    str(self.evidence_path),
                    self.evidence_path.stat().st_size,
                    self.admin_id,
                    timestamp,
                    timestamp,
                ),
            )
            document_id = int(document.lastrowid)
            con.commit()

        review = self._scan(project_id)
        self.assertEqual(review["status"], "blocked_anomaly")
        ratio = next(
            anomaly
            for anomaly in review["anomalies"]
            if anomaly["code"] == "estimate_budget_ratio_out_of_range"
        )
        update_payload = {
            "expectedRevision": review["revisionNo"],
            "expectedSourceContentHash": review["snapshot"]["sourceContentHash"],
            "budgetClassification": "contract_revenue_candidate",
            "estimateClassification": "internal_cost",
            "defaultVatMode": "no_vat",
            "defaultVatRateBasisPoints": 0,
            "sourcesComparable": False,
            "effectiveFrom": "2026-08-21",
            "discrepancyComment": "Contract amount and internal cost are intentionally not comparable.",
            "evidence": [
                {
                    "key": "source",
                    "documentId": document_id,
                    "sourceReference": "approved source",
                }
            ],
            "decisions": [
                {
                    "sourceKind": "project_budget",
                    "targetKind": "revenue",
                    "title": "Revenue",
                    "position": 1,
                    "evidenceKey": "source",
                    "comment": "Confirmed revenue",
                },
                {
                    "sourceKind": "estimate_item",
                    "snapshotItemId": review["snapshot"]["items"][0]["id"],
                    "targetKind": "target_cost",
                    "title": "Target cost",
                    "position": 1,
                    "evidenceKey": "source",
                    "comment": "Confirmed target cost",
                },
            ],
            "resolutions": [],
        }
        updated = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            update_payload,
        )
        self.assertEqual(updated.status, HTTPStatus.OK, updated.response)
        still_blocked = updated.response["review"]
        self.assertEqual(still_blocked["status"], "blocked_anomaly")
        rejected = self._call(
            legacy_economics.api_confirm_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/confirm",
            {
                "expectedRevision": still_blocked["revisionNo"],
                "expectedSourceContentHash": still_blocked["snapshot"]["sourceContentHash"],
            },
        )
        self.assertEqual(rejected.status, HTTPStatus.CONFLICT)
        self.assertEqual(rejected.response["error"], "legacy_anomaly_resolution_required")

        update_payload["expectedRevision"] = still_blocked["revisionNo"]
        update_payload["resolutions"] = [
            {
                "anomalyId": ratio["id"],
                "resolution": "not_applicable",
                "comment": "Different economic meanings confirmed from source documents.",
            }
        ]
        resolved = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            update_payload,
        )
        self.assertEqual(resolved.status, HTTPStatus.OK, resolved.response)
        self.assertEqual(resolved.response["review"]["status"], "ready_for_review")

    def test_missing_evidence_and_existing_baseline_block_materialization(self) -> None:
        review = self._scan()
        payload = self._valid_update_payload(review)
        payload["evidence"][0]["documentId"] = 999999
        bad_document = self._call(
            legacy_economics.api_update_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/update",
            payload,
        )
        self.assertEqual(bad_document.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(bad_document.response["error"], "legacy_evidence_document_not_found")

        review = self._update_valid_review(review)
        with server.db() as con:
            timestamp = server.now_ts()
            con.execute(
                """
                INSERT INTO project_financial_baselines (
                    project_id, version_no, status, currency_code,
                    source_snapshot_hash, reason, created_by, created_at, updated_at
                ) VALUES (?, 1, 'draft', 'RUB', 'sha256:draft',
                          'Unrelated manual draft', ?, ?, ?)
                """,
                (self.project_id, self.admin_id, timestamp, timestamp),
            )
            con.commit()
        blocked = self._call(
            legacy_economics.api_confirm_project_legacy_economics_review,
            f"/api/legacy-economics-migrations/{review['id']}/confirm",
            {
                "expectedRevision": review["revisionNo"],
                "expectedSourceContentHash": review["snapshot"]["sourceContentHash"],
            },
        )
        self.assertEqual(blocked.status, HTTPStatus.CONFLICT)
        self.assertEqual(blocked.response["error"], "project_financial_baseline_already_exists")
        self.assertEqual(self._legacy_snapshot(), self.legacy_before)


if __name__ == "__main__":
    unittest.main()
