from __future__ import annotations

import gc
import io
import json
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import communications_docs  # noqa: E402
import auth  # noqa: E402
import server  # noqa: E402


class FakeDocumentHandler:
    def __init__(self, user: dict, payload: object = None, *, can_access: bool = True):
        self.user = user
        self.payload = {} if payload is None else payload
        self.can_access = can_access
        self.status: int | None = None
        self.response: dict | None = None
        self.sent_file: dict | None = None

    def require_user(self) -> dict:
        return self.user

    def can_access_project(self, _user: dict, _project_id: int) -> bool:
        return self.can_access

    def require_project_access(self, _project_id: int) -> dict | None:
        return self.user if self.can_access else None

    def read_json(self) -> object:
        return self.payload

    def read_multipart(self) -> object:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload

    def send_file(
        self,
        file_path: Path,
        content_type: str,
        download_name: str,
        inline: bool = False,
    ) -> None:
        self.sent_file = {
            "file_path": file_path,
            "content_type": content_type,
            "download_name": download_name,
            "inline": inline,
        }


class FakeMultipartForm(dict):
    def getfirst(self, key: str, default: object = None) -> object:
        return self.get(key, default)


class DocumentManagementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_server_db = server.DB_PATH
        self.original_communications_db = communications_docs.DB_PATH
        self.original_auth_db = auth.DB_PATH
        self.original_communications_root = communications_docs.PROJECT_ROOT
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_server_documents = server.DOCUMENTS_DIR
        self.original_communications_documents = communications_docs.DOCUMENTS_DIR

        test_db = temp_path / "document-management.sqlite3"
        self.documents_dir = temp_path / "documents"
        server.DB_PATH = test_db
        communications_docs.DB_PATH = test_db
        auth.DB_PATH = test_db
        communications_docs.PROJECT_ROOT = temp_path
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = self.documents_dir
        communications_docs.DOCUMENTS_DIR = self.documents_dir
        server.init_db()

        with server.db() as con:
            self.admin_id = int(con.execute("SELECT id FROM users WHERE login = 'admin'").fetchone()[0])
            timestamp = server.now_ts()
            self.project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, budget, paid, spent,
                        created_at, updated_at
                    ) VALUES ('Document object', 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.other_project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, budget, paid, spent,
                        created_at, updated_at
                    ) VALUES ('Other object', 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.stage_id = int(
                con.execute(
                    """
                    INSERT INTO work_stages (
                        project_id, title, stage_kind, status_code, progress,
                        position, created_at, updated_at
                    ) VALUES (?, 'Foundation', 'work', 'not_started', 0, 1, ?, ?)
                    """,
                    (self.project_id, timestamp, timestamp),
                ).lastrowid
            )
            self.foreign_stage_id = int(
                con.execute(
                    """
                    INSERT INTO work_stages (
                        project_id, title, stage_kind, status_code, progress,
                        position, created_at, updated_at
                    ) VALUES (?, 'Foreign stage', 'work', 'not_started', 0, 1, ?, ?)
                    """,
                    (self.other_project_id, timestamp, timestamp),
                ).lastrowid
            )
            self.material_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price,
                        item_kind, item_kind_override
                    ) VALUES (?, 'Crushed stone', 't', 20, 1000, 'material', 'material')
                    """,
                    (self.project_id,),
                ).lastrowid
            )
            self.foreign_material_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price,
                        item_kind, item_kind_override
                    ) VALUES (?, 'Foreign material', 't', 10, 500, 'material', 'material')
                    """,
                    (self.other_project_id,),
                ).lastrowid
            )
            self.work_item_id = int(
                con.execute(
                    """
                    INSERT INTO estimate_items (
                        project_id, title, unit, planned_qty, planned_price,
                        item_kind, item_kind_override
                    ) VALUES (?, 'Install mesh', 'job', 1, 2000, 'work', 'work')
                    """,
                    (self.project_id,),
                ).lastrowid
            )
            con.commit()
        self.admin = {"id": self.admin_id, "role": "admin", "roles": [], "permissions": {"fullAccess": True}}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        communications_docs.DB_PATH = self.original_communications_db
        auth.DB_PATH = self.original_auth_db
        communications_docs.PROJECT_ROOT = self.original_communications_root
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_server_documents
        communications_docs.DOCUMENTS_DIR = self.original_communications_documents
        gc.collect()
        self.temp_dir.cleanup()

    def _insert_document(
        self,
        *,
        title: str = "Contract",
        status: str = "draft",
        create_file: bool = True,
        storage_path: Path | None = None,
    ) -> tuple[int, Path | None]:
        file_path = storage_path
        if create_file and file_path is None:
            file_path = self.documents_dir / f"project_{self.project_id}" / "contract.pdf"
        if create_file and file_path is not None:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(b"%PDF-test")
        timestamp = server.now_ts()
        with server.db() as con:
            document_id = int(
                con.execute(
                    """
                    INSERT INTO documents (
                        project_id, title, doc_type, status, original_name,
                        storage_name, storage_path, mime_type, file_ext,
                        size_bytes, notes, uploaded_by, is_client_visible,
                        created_at, updated_at
                    ) VALUES (?, ?, 'contract', ?, 'contract.pdf', ?, ?,
                              'application/pdf', '.pdf', 9, 'Original note', ?, 0, ?, ?)
                    """,
                    (
                        self.project_id,
                        title,
                        status,
                        file_path.name if file_path else None,
                        str(file_path) if file_path else None,
                        self.admin_id,
                        timestamp - 10,
                        timestamp - 10,
                    ),
                ).lastrowid
            )
            con.commit()
        return document_id, file_path

    def _update(self, document_id: int, payload: object, user: dict | None = None, *, can_access: bool = True) -> FakeDocumentHandler:
        handler = FakeDocumentHandler(user or self.admin, payload, can_access=can_access)
        communications_docs.api_update_document(handler, f"/api/documents/{document_id}/update")
        return handler

    def _delete(self, document_id: int, user: dict | None = None, *, can_access: bool = True) -> FakeDocumentHandler:
        handler = FakeDocumentHandler(user or self.admin, can_access=can_access)
        communications_docs.api_delete_document(handler, f"/api/documents/{document_id}")
        return handler

    def _upload(self, **fields: object) -> FakeDocumentHandler:
        form = FakeMultipartForm(
            {
                "file": SimpleNamespace(
                    file=io.BytesIO(b"%PDF-upload"),
                    filename="upload.pdf",
                    type="application/pdf",
                ),
                "title": "Uploaded contract",
                "doc_type": "contract",
                "status": "draft",
                **fields,
            }
        )
        handler = FakeDocumentHandler(self.admin, form)
        communications_docs.api_upload_project_document(
            handler,
            f"/api/projects/{self.project_id}/documents",
        )
        return handler

    def _create_test_user(self, login: str, name: str, role: str = "foreman") -> int:
        timestamp = server.now_ts()
        with server.db() as con:
            user_id = int(
                con.execute(
                    """
                    INSERT INTO users (
                        login, password_hash, role, name, status, is_active,
                        created_at, updated_at
                    ) VALUES (?, 'test-hash', ?, ?, 'active', 1, ?, ?)
                    """,
                    (login, role, name, timestamp, timestamp),
                ).lastrowid
            )
            con.commit()
        return user_id

    def _notifications_for(self, user: dict) -> dict:
        handler = FakeDocumentHandler(user)
        communications_docs.api_project_notifications(
            handler,
            f"/api/projects/{self.project_id}/notifications",
        )
        self.assertEqual(handler.status, HTTPStatus.OK)
        return handler.response

    def _material_notification_alerts(self, response: dict) -> list[dict]:
        return [
            next(
                item
                for item in response[key]
                if item["materialId"] == self.material_id
            )
            for key in ("procurementAlerts", "shortageAlerts")
        ]

    def test_update_persists_metadata_preserves_file_fields_and_audits(self) -> None:
        document_id, file_path = self._insert_document()

        result = self._update(
            document_id,
            {
                "title": "Signed contract",
                "doc_type": "contract",
                "status": "reviewed",
                "notes": "Checked by legal",
                "stage_id": self.stage_id,
                "is_client_visible": True,
            },
        )

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertEqual(result.response["document"]["title"], "Signed contract")
        self.assertEqual(result.response["document"]["stage_title"], "Foundation")
        self.assertTrue(result.response["document"]["can_preview"])
        with server.db() as con:
            row = con.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
            audit = con.execute(
                "SELECT action, payload FROM audit_log WHERE entity = 'document' AND entity_id = ? ORDER BY id DESC LIMIT 1",
                (document_id,),
            ).fetchone()
        self.assertEqual(row["storage_path"], str(file_path))
        self.assertEqual(row["original_name"], "contract.pdf")
        self.assertEqual(row["stage_id"], self.stage_id)
        self.assertEqual(row["is_client_visible"], 1)
        self.assertGreaterEqual(row["updated_at"], row["created_at"])
        self.assertEqual(audit["action"], "update_document")
        audit_payload = json.loads(audit["payload"])
        self.assertEqual(audit_payload["before"]["title"], "Contract")
        self.assertEqual(audit_payload["after"]["title"], "Signed contract")

    def test_update_rejects_foreign_stage_and_immutable_file_fields(self) -> None:
        document_id, _ = self._insert_document()

        foreign_stage = self._update(document_id, {"stage_id": self.foreign_stage_id})
        immutable = self._update(document_id, {"storage_path": "elsewhere.pdf"})

        self.assertEqual(foreign_stage.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(foreign_stage.response["error"], "document_stage_not_found")
        self.assertEqual(immutable.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(immutable.response["error"], "immutable_document_field")

    def test_update_and_delete_require_management_permission_and_project_access(self) -> None:
        document_id, file_path = self._insert_document()
        customer = {"id": self.admin_id, "role": "customer", "roles": []}

        update_forbidden = self._update(document_id, {"title": "No"}, customer)
        delete_forbidden = self._delete(document_id, customer)
        project_forbidden = self._delete(document_id, self.admin, can_access=False)

        self.assertEqual(update_forbidden.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(delete_forbidden.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(project_forbidden.status, HTTPStatus.FORBIDDEN)
        with server.db() as con:
            self.assertIsNotNone(con.execute("SELECT 1 FROM documents WHERE id = ?", (document_id,)).fetchone())
        self.assertTrue(file_path.is_file())

    def test_delete_removes_row_managed_file_and_keeps_audit_snapshot(self) -> None:
        document_id, file_path = self._insert_document(status="draft")

        result = self._delete(document_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertEqual(result.response["deleted_id"], document_id)
        self.assertTrue(result.response["file_deleted"])
        self.assertFalse(file_path.exists())
        with server.db() as con:
            self.assertIsNone(con.execute("SELECT 1 FROM documents WHERE id = ?", (document_id,)).fetchone())
            audit = con.execute(
                "SELECT action, payload FROM audit_log WHERE entity = 'document' AND entity_id = ? ORDER BY id DESC LIMIT 1",
                (document_id,),
            ).fetchone()
        self.assertEqual(audit["action"], "delete_document")
        self.assertEqual(json.loads(audit["payload"])["deleted_document"]["title"], "Contract")

    def test_referenced_document_cannot_be_deleted_or_reclassified(self) -> None:
        document_id, file_path = self._insert_document()
        timestamp = server.now_ts()
        with server.db() as con:
            con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, amount, document_id, status,
                    created_by, created_at, updated_at
                ) VALUES (?, 'expense', 100, ?, 'planned', ?, ?, ?)
                """,
                (self.project_id, document_id, self.admin_id, timestamp, timestamp),
            )
            con.commit()

        delete_result = self._delete(document_id)
        update_result = self._update(document_id, {"status": "approved"})
        title_result = self._update(document_id, {"title": "Corrected title"})

        self.assertEqual(delete_result.status, HTTPStatus.CONFLICT)
        self.assertEqual(delete_result.response["error"], "document_in_use")
        self.assertEqual(update_result.status, HTTPStatus.CONFLICT)
        self.assertEqual(update_result.response["error"], "document_classification_in_use")
        self.assertEqual(title_result.status, HTTPStatus.OK)
        self.assertTrue(file_path.is_file())

    def test_finalized_document_cannot_be_deleted_retyped_or_downgraded(self) -> None:
        document_id, file_path = self._insert_document(status="reviewed")

        delete_result = self._delete(document_id)
        downgrade_result = self._update(document_id, {"status": "draft"})
        retype_result = self._update(document_id, {"doc_type": "other"})
        advance_result = self._update(document_id, {"status": "approved", "title": "Approved contract"})

        self.assertEqual(delete_result.status, HTTPStatus.CONFLICT)
        self.assertEqual(delete_result.response["error"], "document_not_deletable")
        self.assertEqual(downgrade_result.status, HTTPStatus.CONFLICT)
        self.assertEqual(downgrade_result.response["error"], "document_status_regression")
        self.assertEqual(retype_result.status, HTTPStatus.CONFLICT)
        self.assertEqual(retype_result.response["error"], "document_classification_locked")
        self.assertEqual(advance_result.status, HTTPStatus.OK)
        self.assertTrue(file_path.is_file())
        with server.db() as con:
            row = con.execute("SELECT title, doc_type, status FROM documents WHERE id = ?", (document_id,)).fetchone()
            delete_audit = con.execute(
                "SELECT 1 FROM audit_log WHERE entity = 'document' AND entity_id = ? AND action = 'delete_document'",
                (document_id,),
            ).fetchone()
        self.assertEqual(dict(row), {"title": "Approved contract", "doc_type": "contract", "status": "approved"})
        self.assertIsNone(delete_audit)

    def test_update_rejects_non_object_and_unknown_classification(self) -> None:
        document_id, _ = self._insert_document()

        non_object = self._update(document_id, [])
        unknown_type = self._update(document_id, {"doc_type": "made_up"})
        unknown_status = self._update(document_id, {"status": "nonsense"})

        self.assertEqual(non_object.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(non_object.response["error"], "document_payload_must_be_object")
        self.assertEqual(unknown_type.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(unknown_type.response["error"], "bad_document_type")
        self.assertEqual(unknown_status.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(unknown_status.response["error"], "bad_document_status")
        with server.db() as con:
            row = con.execute("SELECT doc_type, status FROM documents WHERE id = ?", (document_id,)).fetchone()
            audit_count = con.execute(
                "SELECT COUNT(*) FROM audit_log WHERE entity = 'document' AND entity_id = ? AND action = 'update_document'",
                (document_id,),
            ).fetchone()[0]
        self.assertEqual(dict(row), {"doc_type": "contract", "status": "draft"})
        self.assertEqual(audit_count, 0)

    def test_legacy_unknown_classification_can_keep_value_during_metadata_edit(self) -> None:
        document_id, _ = self._insert_document()
        with server.db() as con:
            con.execute(
                "UPDATE documents SET doc_type = 'legacy_packet', status = 'legacy_state' WHERE id = ?",
                (document_id,),
            )
            con.commit()

        result = self._update(document_id, {"title": "Renamed legacy packet"})

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertEqual(result.response["document"]["doc_type"], "legacy_packet")
        self.assertEqual(result.response["document"]["status"], "legacy_state")

    def test_upload_rejects_bad_or_cross_project_stage_before_writing_file(self) -> None:
        malformed = self._upload(stage_id="not-a-number")
        foreign = self._upload(stage_id=self.foreign_stage_id)
        bad_template = self._upload(stage_id=self.stage_id, template_code="unknown_template")

        self.assertEqual(malformed.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(malformed.response["error"], "bad_stage_id")
        self.assertEqual(foreign.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(foreign.response["error"], "document_stage_not_found")
        self.assertEqual(bad_template.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(bad_template.response["error"], "bad_document_template")
        with server.db() as con:
            document_count = con.execute(
                "SELECT COUNT(*) FROM documents WHERE project_id = ?",
                (self.project_id,),
            ).fetchone()[0]
        self.assertEqual(document_count, 0)
        self.assertEqual([path for path in self.documents_dir.rglob("*") if path.is_file()], [])

    def test_upload_rejects_executable_and_script_files_before_writing(self) -> None:
        for filename in ("payload.exe", "maintenance.py", "installer.ps1", "macro.js"):
            with self.subTest(filename=filename):
                result = self._upload(
                    file=SimpleNamespace(
                        file=io.BytesIO(b"untrusted executable content"),
                        filename=filename,
                        type="application/octet-stream",
                    )
                )
                self.assertEqual(result.status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(result.response["error"], "unsupported_file_type")
        self.assertEqual([path for path in self.documents_dir.rglob("*") if path.is_file()], [])

    def test_uploaded_relative_file_can_be_deleted(self) -> None:
        upload_result = self._upload(stage_id=self.stage_id)

        self.assertEqual(upload_result.status, HTTPStatus.CREATED)
        document = upload_result.response["document"]
        self.assertEqual(document["stage_id"], self.stage_id)
        self.assertFalse(Path(document["storage_path"]).is_absolute())
        file_path = communications_docs.PROJECT_ROOT / document["storage_path"]
        self.assertTrue(file_path.is_file())

        delete_result = self._delete(int(document["id"]))

        self.assertEqual(delete_result.status, HTTPStatus.OK)
        self.assertTrue(delete_result.response["file_deleted"])
        self.assertFalse(file_path.exists())

    def test_upload_procurement_invoice_persists_metadata_and_is_always_internal(self) -> None:
        timestamp = server.now_ts()
        with server.db() as con:
            con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_type, candidate_name,
                    price, qty, status, created_at, updated_at
                ) VALUES (?, ?, 'supplier', 'Stone Supplier LLC', 625, 20,
                          'selected', ?, ?)
                """,
                (self.project_id, self.material_id, timestamp, timestamp),
            )
            con.commit()
        result = self._upload(
            doc_type="invoice",
            estimate_item_id=str(self.material_id),
            counterparty_name="Stone Supplier LLC",
            document_number="INV-42",
            document_date="2026-08-28",
            amount="12500.50",
            is_client_visible="1",
        )

        self.assertEqual(result.status, HTTPStatus.CREATED)
        document = result.response["document"]
        self.assertEqual(document["estimate_item_id"], self.material_id)
        self.assertEqual(document["estimate_item_title"], "Crushed stone")
        self.assertEqual(document["counterparty_name"], "Stone Supplier LLC")
        self.assertEqual(document["document_number"], "INV-42")
        self.assertEqual(document["document_date"], "2026-08-28")
        self.assertEqual(document["amount"], 12500.5)
        self.assertEqual(document["is_client_visible"], 0)

        list_handler = FakeDocumentHandler(self.admin)
        communications_docs.api_project_documents(
            list_handler,
            f"/api/projects/{self.project_id}/documents",
        )

        self.assertEqual(list_handler.status, HTTPStatus.OK)
        self.assertEqual(
            list_handler.response["documents"][0]["estimate_item_title"],
            "Crushed stone",
        )
        self.assertIn(
            {"id": self.material_id, "title": "Crushed stone", "unit": "t"},
            list_handler.response["procurementMaterials"],
        )
        self.assertNotIn(
            self.work_item_id,
            {
                item["id"]
                for item in list_handler.response["procurementMaterials"]
            },
        )
        with server.db() as con:
            material = next(
                item
                for item in communications_docs.material_summary_rows(
                    con,
                    self.project_id,
                    include_procurement_evidence=True,
                    include_supplier_selection=True,
                    include_procurement_details=True,
                )
                if item["id"] == self.material_id
            )
        self.assertTrue(material["invoiceAttached"])
        self.assertEqual(material["invoiceCount"], 1)
        self.assertEqual(material["latestInvoice"]["documentNumber"], "INV-42")
        self.assertEqual(material["latestInvoice"]["amount"], 12500.5)
        self.assertTrue(material["selectedSupplierOffer"])
        self.assertEqual(
            material["selectedSupplierOfferName"],
            "Stone Supplier LLC",
        )
        self.assertTrue(material["selectedSupplierOfferHasPrice"])

        visibility_update = self._update(
            int(document["id"]),
            {"is_client_visible": True},
        )
        self.assertEqual(visibility_update.status, HTTPStatus.OK)
        self.assertEqual(
            visibility_update.response["document"]["is_client_visible"],
            0,
        )
        customer = {"id": self.admin_id, "role": "customer", "roles": []}
        customer_list = FakeDocumentHandler(customer)
        communications_docs.api_project_documents(
            customer_list,
            f"/api/projects/{self.project_id}/documents",
        )
        self.assertEqual(customer_list.status, HTTPStatus.OK)
        self.assertEqual(customer_list.response["documents"], [])
        self.assertEqual(customer_list.response["procurementMaterials"], [])

    def test_upd_and_cash_receipt_also_close_procurement_evidence(self) -> None:
        for doc_type in ("upd", "cash_receipt"):
            result = self._upload(
                doc_type=doc_type,
                estimate_item_id=str(self.material_id),
                counterparty_name="Supplier",
                amount="1000",
            )
            self.assertEqual(result.status, HTTPStatus.CREATED)

        with server.db() as con:
            material = next(
                item
                for item in communications_docs.material_summary_rows(
                    con,
                    self.project_id,
                    include_procurement_evidence=True,
                )
                if item["id"] == self.material_id
            )
        self.assertTrue(material["invoiceAttached"])
        self.assertEqual(material["invoiceCount"], 2)

    def test_upload_rejects_cross_project_and_work_estimate_items_before_file_write(self) -> None:
        foreign = self._upload(
            doc_type="invoice",
            estimate_item_id=self.foreign_material_id,
        )
        work = self._upload(
            doc_type="invoice",
            estimate_item_id=self.work_item_id,
        )

        self.assertEqual(foreign.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            foreign.response["error"],
            "document_material_not_found",
        )
        self.assertEqual(work.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            work.response["error"],
            "document_material_not_found",
        )
        with server.db() as con:
            document_count = con.execute(
                "SELECT COUNT(*) FROM documents WHERE project_id = ?",
                (self.project_id,),
            ).fetchone()[0]
        self.assertEqual(document_count, 0)
        self.assertEqual(
            [path for path in self.documents_dir.rglob("*") if path.is_file()],
            [],
        )

    def test_upload_rejects_invalid_procurement_metadata(self) -> None:
        invalid_amount = self._upload(amount="NaN")
        invalid_date = self._upload(document_date="28.08.2026")
        long_counterparty = self._upload(counterparty_name="x" * 241)
        long_number = self._upload(document_number="x" * 121)

        self.assertEqual(invalid_amount.response["error"], "bad_document_amount")
        self.assertEqual(invalid_date.response["error"], "bad_document_date")
        self.assertEqual(
            long_counterparty.response["error"],
            "document_counterparty_too_long",
        )
        self.assertEqual(
            long_number.response["error"],
            "document_number_too_long",
        )

    def test_material_need_date_uses_persisted_production_signal_without_writes(self) -> None:
        timestamp = server.now_ts()
        with server.db() as con:
            con.execute(
                "UPDATE projects SET started_at = '2026-09-01' WHERE id = ?",
                (self.project_id,),
            )
            con.execute(
                "UPDATE work_stages SET planned_start = '2026-10-01' WHERE id = ?",
                (self.stage_id,),
            )
            con.execute(
                "UPDATE estimate_items SET stage_id = ? WHERE id = ?",
                (self.stage_id, self.material_id),
            )
            con.execute(
                """
                INSERT INTO production_schedule_operations (
                    project_id, generation_key, title, auto_duration_days,
                    position, status, created_at, updated_at
                ) VALUES (?, 'prep', 'Preparation', 1.5, 1, 'confirmed', ?, ?)
                """,
                (self.project_id, timestamp, timestamp),
            )
            operation_id = int(
                con.execute(
                    """
                    INSERT INTO production_schedule_operations (
                        project_id, generation_key, title, auto_duration_days,
                        position, status, created_at, updated_at
                    ) VALUES (?, 'material', 'Material operation', 1, 2,
                              'confirmed', ?, ?)
                    """,
                    (self.project_id, timestamp, timestamp),
                ).lastrowid
            )
            con.execute(
                """
                INSERT INTO production_schedule_operation_estimate_links (
                    operation_id, estimate_item_id, link_role, created_at
                ) VALUES (?, ?, 'material_signal', ?)
                """,
                (operation_id, self.material_id, timestamp),
            )
            con.commit()
            before_changes = con.total_changes
            material = next(
                item
                for item in communications_docs.material_summary_rows(
                    con,
                    self.project_id,
                )
                if item["id"] == self.material_id
            )
            after_changes = con.total_changes

            self.assertEqual(before_changes, after_changes)
            self.assertEqual(material["needByDate"], "2026-09-02")
            self.assertEqual(material["needDateSource"], "production")
            self.assertEqual(material["productionNeedByDate"], "2026-09-02")

            con.execute(
                "UPDATE estimate_items SET need_by_date = '2026-09-15' WHERE id = ?",
                (self.material_id,),
            )
            con.commit()
            explicit_material = next(
                item
                for item in communications_docs.material_summary_rows(
                    con,
                    self.project_id,
                )
                if item["id"] == self.material_id
            )
        self.assertEqual(explicit_material["needByDate"], "2026-09-15")
        self.assertEqual(explicit_material["needDateSource"], "explicit")

    def test_materials_summary_hides_procurement_details_by_role(self) -> None:
        upload = self._upload(
            doc_type="invoice",
            estimate_item_id=self.material_id,
            counterparty_name="Private Supplier",
            amount="9999",
        )
        self.assertEqual(upload.status, HTTPStatus.CREATED)
        timestamp = server.now_ts()
        with server.db() as con:
            con.execute(
                """
                INSERT INTO supplier_offers (
                    project_id, estimate_item_id, candidate_type, candidate_name,
                    price, qty, status, created_at, updated_at
                ) VALUES (?, ?, 'supplier', 'Private Supplier', 999.9, 10,
                          'selected', ?, ?)
                """,
                (self.project_id, self.material_id, timestamp, timestamp),
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at, source_type
                ) VALUES (?, ?, 'purchase', 1, 999.9, ?, ?, 'manual')
                """,
                (self.project_id, self.material_id, self.admin_id, timestamp),
            )
            con.commit()

        def summary_for(role: str) -> dict:
            user = {"id": self.admin_id, "role": role, "roles": [role]}
            handler = FakeDocumentHandler(user)
            server.PMBIHandler.api_materials_summary(
                handler,
                f"/api/projects/{self.project_id}/materials-summary",
            )
            self.assertEqual(handler.status, HTTPStatus.OK)
            return next(
                item
                for item in handler.response["items"]
                if item["id"] == self.material_id
            )

        customer_material = summary_for("customer")
        foreman_material = summary_for("foreman")
        director_material = summary_for("director")

        for field in (
            "invoiceAttached",
            "invoiceCount",
            "procurementActorId",
            "procurementActorName",
            "procurementActorAction",
            "procurementActorIds",
            "latestInvoice",
            "selectedSupplierOffer",
            "selectedSupplierOfferName",
            "selectedSupplierOfferHasPrice",
        ):
            self.assertNotIn(field, customer_material)
        self.assertTrue(foreman_material["invoiceAttached"])
        self.assertEqual(foreman_material["invoiceCount"], 1)
        self.assertEqual(foreman_material["procurementActorId"], self.admin_id)
        self.assertEqual(foreman_material["procurementActorIds"], [self.admin_id])
        self.assertEqual(foreman_material["procurementActorName"], "")
        self.assertNotIn("latestInvoice", foreman_material)
        self.assertNotIn("selectedSupplierOffer", foreman_material)
        self.assertNotIn("selectedSupplierOfferName", foreman_material)
        self.assertTrue(director_material["invoiceAttached"])
        self.assertEqual(
            director_material["latestInvoice"]["counterpartyName"],
            "Private Supplier",
        )
        self.assertEqual(director_material["procurementActorId"], self.admin_id)
        self.assertTrue(director_material["procurementActorName"])
        self.assertEqual(director_material["latestInvoice"]["amount"], 9999.0)
        self.assertTrue(director_material["selectedSupplierOffer"])
        self.assertEqual(
            director_material["selectedSupplierOfferName"],
            "Private Supplier",
        )

    def test_notifications_require_invoice_after_purchase_and_clear_after_upload(self) -> None:
        timestamp = server.now_ts()
        with server.db() as con:
            purchaser_id = int(
                con.execute(
                    """
                    INSERT INTO users (
                        login, password_hash, role, name, status, is_active,
                        created_at, updated_at
                    ) VALUES ('nikita-purchaser', 'test-hash', 'foreman',
                              'Никита Прораб', 'active', 1, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at
                ) VALUES (?, ?, 'purchase', 20, 1000, ?, ?)
                """,
                (self.project_id, self.material_id, purchaser_id, timestamp),
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at
                ) VALUES (?, ?, 'receipt', 20, 0, ?, ?)
                """,
                (self.project_id, self.material_id, self.admin_id, timestamp + 1),
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at
                ) VALUES (?, ?, 'receipt', 1, 0, ?, ?)
                """,
                (self.project_id, self.material_id, purchaser_id, timestamp + 2),
            )
            con.commit()

        before_upload = FakeDocumentHandler(self.admin)
        communications_docs.api_project_notifications(
            before_upload,
            f"/api/projects/{self.project_id}/notifications",
        )

        self.assertEqual(before_upload.status, HTTPStatus.OK)
        missing_invoice = [
            item
            for item in before_upload.response["procurementEvidenceAlerts"]
            if item["evidenceKind"] == "missing_invoice"
            and item["materialId"] == self.material_id
        ]
        self.assertEqual(len(missing_invoice), 1)
        self.assertEqual(missing_invoice[0]["status"], "critical")
        self.assertEqual(missing_invoice[0]["responsibleUserId"], purchaser_id)
        self.assertEqual(missing_invoice[0]["responsibleUserName"], "Никита Прораб")
        self.assertEqual(missing_invoice[0]["responsibleUserIds"], [purchaser_id])
        self.assertFalse(missing_invoice[0]["isPersonalAction"])
        self.assertEqual(
            before_upload.response["procurementEvidenceSummary"]["missingInvoice"],
            1,
        )

        purchaser = {
            "id": purchaser_id,
            "role": "foreman",
            "roles": ["foreman"],
            "permissions": {},
        }
        purchaser_notifications = FakeDocumentHandler(purchaser)
        communications_docs.api_project_notifications(
            purchaser_notifications,
            f"/api/projects/{self.project_id}/notifications",
        )
        purchaser_alert = next(
            item
            for item in purchaser_notifications.response["procurementEvidenceAlerts"]
            if item["evidenceKind"] == "missing_invoice"
            and item["materialId"] == self.material_id
        )
        self.assertTrue(purchaser_alert["isPersonalAction"])
        self.assertEqual(purchaser_alert["responsibleUserId"], purchaser_id)
        self.assertEqual(purchaser_alert["responsibleUserName"], "")
        self.assertEqual(purchaser_alert["responsibleUserIds"], [purchaser_id])

        other_foreman_notifications = FakeDocumentHandler(
            {
                "id": purchaser_id + 10_000,
                "role": "foreman",
                "roles": ["foreman"],
                "permissions": {},
            }
        )
        communications_docs.api_project_notifications(
            other_foreman_notifications,
            f"/api/projects/{self.project_id}/notifications",
        )
        other_foreman_alert = next(
            item
            for item in other_foreman_notifications.response["procurementEvidenceAlerts"]
            if item["evidenceKind"] == "missing_invoice"
            and item["materialId"] == self.material_id
        )
        self.assertFalse(other_foreman_alert["isPersonalAction"])
        self.assertIsNone(other_foreman_alert["responsibleUserId"])
        self.assertEqual(other_foreman_alert["responsibleUserName"], "")
        self.assertEqual(other_foreman_alert["responsibleUserIds"], [])

        upload = self._upload(
            doc_type="invoice",
            estimate_item_id=self.material_id,
            counterparty_name="Stone Supplier LLC",
            amount="20000",
        )
        self.assertEqual(upload.status, HTTPStatus.CREATED)

        after_upload = FakeDocumentHandler(self.admin)
        communications_docs.api_project_notifications(
            after_upload,
            f"/api/projects/{self.project_id}/notifications",
        )
        self.assertEqual(after_upload.status, HTTPStatus.OK)
        self.assertFalse(
            any(
                item["evidenceKind"] == "missing_invoice"
                and item["materialId"] == self.material_id
                for item in after_upload.response["procurementEvidenceAlerts"]
            )
        )
        self.assertEqual(
            after_upload.response["procurementEvidenceSummary"]["missingInvoice"],
            0,
        )

    def test_procurement_notifications_prefer_purchaser_and_redact_by_audience(self) -> None:
        purchaser_id = self._create_test_user(
            "assigned-purchaser",
            "Павел Закупщик",
        )
        foreman_id = self._create_test_user(
            "assigned-foreman-observer",
            "Никита Прораб",
        )
        timestamp = server.now_ts()
        today = str(communications_docs.build_attention_clock()["today"])
        with server.db() as con:
            con.execute(
                """
                UPDATE estimate_items
                SET stage_id = ?, need_by_date = ?, delivery_days = 2
                WHERE id = ?
                """,
                (self.stage_id, today, self.material_id),
            )
            con.execute(
                """
                INSERT INTO object_assignments (
                    object_id, user_id, role_code, responsibility, is_primary,
                    assigned_by, assigned_at
                ) VALUES (?, ?, 'foreman', 'Производство', 1, ?, ?)
                """,
                (self.project_id, foreman_id, self.admin_id, timestamp),
            )
            con.execute(
                """
                INSERT INTO object_assignments (
                    object_id, user_id, role_code, responsibility, is_primary,
                    assigned_by, assigned_at
                ) VALUES (?, ?, 'purchaser', 'Закупки', 0, ?, ?)
                """,
                (self.project_id, purchaser_id, self.admin_id, timestamp + 1),
            )
            con.commit()

        director_alerts = self._material_notification_alerts(
            self._notifications_for(self.admin)
        )
        for alert in director_alerts:
            self.assertEqual(alert["notificationAudience"], "supervisor")
            self.assertTrue(alert["isSupervisorView"])
            self.assertFalse(alert["isPersonalResponsibility"])
            self.assertFalse(alert["isPersonalAction"])
            self.assertFalse(alert["needsAssignment"])
            self.assertEqual(alert["responsibleUserId"], purchaser_id)
            self.assertEqual(alert["responsibleUserName"], "Павел Закупщик")
            self.assertEqual(alert["responsibleUserIds"], [purchaser_id])
            self.assertEqual(alert["responsibleRole"], "purchaser")
            self.assertEqual(alert["responsibilitySource"], "project_purchaser")

        purchaser = {
            "id": purchaser_id,
            "role": "foreman",
            "roles": ["foreman", "purchaser"],
            "permissions": {},
        }
        purchaser_alerts = self._material_notification_alerts(
            self._notifications_for(purchaser)
        )
        for alert in purchaser_alerts:
            self.assertEqual(alert["notificationAudience"], "assignee")
            self.assertFalse(alert["isSupervisorView"])
            self.assertTrue(alert["isPersonalResponsibility"])
            self.assertFalse(alert["isPersonalAction"])
            self.assertFalse(alert["needsAssignment"])
            self.assertEqual(alert["responsibleUserId"], purchaser_id)
            self.assertEqual(alert["responsibleUserName"], "")
            self.assertEqual(alert["responsibleUserIds"], [purchaser_id])

        foreman_observer = {
            "id": foreman_id,
            "role": "foreman",
            "roles": ["foreman"],
            "permissions": {},
        }
        observer_alerts = self._material_notification_alerts(
            self._notifications_for(foreman_observer)
        )
        for alert in observer_alerts:
            self.assertEqual(alert["notificationAudience"], "observer")
            self.assertFalse(alert["isSupervisorView"])
            self.assertFalse(alert["isPersonalResponsibility"])
            self.assertFalse(alert["isPersonalAction"])
            self.assertFalse(alert["needsAssignment"])
            self.assertIsNone(alert["responsibleUserId"])
            self.assertEqual(alert["responsibleUserName"], "")
            self.assertEqual(alert["responsibleUserIds"], [])

    def test_procurement_notifications_fall_back_to_foreman_then_require_assignment(self) -> None:
        foreman_id = self._create_test_user(
            "fallback-foreman",
            "Никита Прораб",
        )
        timestamp = server.now_ts()
        today = str(communications_docs.build_attention_clock()["today"])
        with server.db() as con:
            con.execute(
                "UPDATE estimate_items SET need_by_date = ? WHERE id = ?",
                (today, self.material_id),
            )
            con.execute(
                """
                INSERT INTO object_assignments (
                    object_id, user_id, role_code, responsibility, is_primary,
                    assigned_by, assigned_at
                ) VALUES (?, ?, 'foreman', 'Производство и закупки', 1, ?, ?)
                """,
                (self.project_id, foreman_id, self.admin_id, timestamp),
            )
            con.commit()

        director_alerts = self._material_notification_alerts(
            self._notifications_for(self.admin)
        )
        for alert in director_alerts:
            self.assertEqual(alert["notificationAudience"], "supervisor")
            self.assertEqual(alert["responsibleUserId"], foreman_id)
            self.assertEqual(alert["responsibleUserName"], "Никита Прораб")
            self.assertEqual(alert["responsibleRole"], "foreman")
            self.assertEqual(alert["responsibilitySource"], "project_foreman")
            self.assertFalse(alert["needsAssignment"])

        foreman = {
            "id": foreman_id,
            "role": "foreman",
            "roles": ["foreman"],
            "permissions": {},
        }
        foreman_alerts = self._material_notification_alerts(
            self._notifications_for(foreman)
        )
        for alert in foreman_alerts:
            self.assertEqual(alert["notificationAudience"], "assignee")
            self.assertTrue(alert["isPersonalResponsibility"])
            self.assertEqual(alert["responsibleUserId"], foreman_id)
            self.assertEqual(alert["responsibleUserName"], "")

        with server.db() as con:
            con.execute(
                "DELETE FROM object_assignments WHERE object_id = ?",
                (self.project_id,),
            )
            con.execute(
                "UPDATE projects SET buyer_id = NULL, foreman_id = NULL WHERE id = ?",
                (self.project_id,),
            )
            con.commit()

        unassigned_alerts = self._material_notification_alerts(
            self._notifications_for(self.admin)
        )
        for alert in unassigned_alerts:
            self.assertEqual(alert["notificationAudience"], "supervisor")
            self.assertTrue(alert["needsAssignment"])
            self.assertFalse(alert["isPersonalResponsibility"])
            self.assertIsNone(alert["responsibleUserId"])
            self.assertEqual(alert["responsibleUserName"], "")
            self.assertEqual(alert["responsibleUserIds"], [])
            self.assertEqual(alert["responsibilitySource"], "unassigned")

    def test_missing_invoice_stays_owned_by_purchase_actor_not_project_purchaser(self) -> None:
        assigned_purchaser_id = self._create_test_user(
            "project-purchaser",
            "Павел Закупщик",
        )
        purchase_actor_id = self._create_test_user(
            "purchase-recorder",
            "Никита Прораб",
        )
        timestamp = server.now_ts()
        with server.db() as con:
            con.execute(
                """
                INSERT INTO object_assignments (
                    object_id, user_id, role_code, responsibility, is_primary,
                    assigned_by, assigned_at
                ) VALUES (?, ?, 'buyer', 'Закупки', 1, ?, ?)
                """,
                (
                    self.project_id,
                    assigned_purchaser_id,
                    self.admin_id,
                    timestamp,
                ),
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at, source_type
                ) VALUES (?, ?, 'purchase', 20, 1000, ?, ?, 'manual')
                """,
                (
                    self.project_id,
                    self.material_id,
                    purchase_actor_id,
                    timestamp + 1,
                ),
            )
            con.commit()

        director_alert = next(
            item
            for item in self._notifications_for(self.admin)["procurementEvidenceAlerts"]
            if item["evidenceKind"] == "missing_invoice"
            and item["materialId"] == self.material_id
        )
        self.assertEqual(director_alert["notificationAudience"], "supervisor")
        self.assertEqual(director_alert["responsibleUserId"], purchase_actor_id)
        self.assertEqual(director_alert["responsibleUserName"], "Никита Прораб")
        self.assertEqual(director_alert["responsibleRole"], "procurement_actor")
        self.assertEqual(director_alert["responsibilitySource"], "purchase_actor")
        self.assertFalse(director_alert["isPersonalAction"])
        self.assertFalse(director_alert["isPersonalResponsibility"])

        purchase_actor = {
            "id": purchase_actor_id,
            "role": "foreman",
            "roles": ["foreman"],
            "permissions": {},
        }
        actor_alert = next(
            item
            for item in self._notifications_for(purchase_actor)["procurementEvidenceAlerts"]
            if item["evidenceKind"] == "missing_invoice"
            and item["materialId"] == self.material_id
        )
        self.assertEqual(actor_alert["notificationAudience"], "assignee")
        self.assertTrue(actor_alert["isPersonalAction"])
        self.assertFalse(actor_alert["isPersonalResponsibility"])
        self.assertEqual(actor_alert["responsibleUserId"], purchase_actor_id)
        self.assertEqual(actor_alert["responsibleUserName"], "")

        assigned_purchaser = {
            "id": assigned_purchaser_id,
            "role": "foreman",
            "roles": ["foreman", "purchaser"],
            "permissions": {},
        }
        purchaser_alert = next(
            item
            for item in self._notifications_for(assigned_purchaser)["procurementEvidenceAlerts"]
            if item["evidenceKind"] == "missing_invoice"
            and item["materialId"] == self.material_id
        )
        self.assertEqual(purchaser_alert["notificationAudience"], "observer")
        self.assertFalse(purchaser_alert["isPersonalAction"])
        self.assertFalse(purchaser_alert["isPersonalResponsibility"])
        self.assertIsNone(purchaser_alert["responsibleUserId"])
        self.assertEqual(purchaser_alert["responsibleUserName"], "")
        self.assertEqual(purchaser_alert["responsibleUserIds"], [])

    def test_customer_role_suppresses_procurement_identity_even_with_internal_role(self) -> None:
        purchaser_id = self._create_test_user(
            "customer-hidden-purchaser",
            "Скрытый Закупщик",
        )
        timestamp = server.now_ts()
        today = str(communications_docs.build_attention_clock()["today"])
        with server.db() as con:
            con.execute(
                "UPDATE estimate_items SET need_by_date = ? WHERE id = ?",
                (today, self.material_id),
            )
            con.execute(
                """
                INSERT INTO object_assignments (
                    object_id, user_id, role_code, responsibility, is_primary,
                    assigned_by, assigned_at
                ) VALUES (?, ?, 'purchaser', 'Закупки', 1, ?, ?)
                """,
                (self.project_id, purchaser_id, self.admin_id, timestamp),
            )
            con.commit()

        mixed_customer = {
            "id": self.admin_id,
            "role": "customer",
            "roles": ["customer", "director"],
            "permissions": {"fullAccess": True},
        }
        response = self._notifications_for(mixed_customer)
        self.assertEqual(response["procurementAlerts"], [])
        self.assertEqual(response["shortageAlerts"], [])
        self.assertEqual(response["procurementEvidenceAlerts"], [])

    def test_reversed_purchase_actor_is_ignored_and_receipt_actor_is_used(self) -> None:
        timestamp = server.now_ts()
        with server.db() as con:
            recorder_id = int(
                con.execute(
                    """
                    INSERT INTO users (
                        login, password_hash, role, name, status, is_active,
                        created_at, updated_at
                    ) VALUES ('reversed-recorder', 'test-hash', 'foreman',
                              'Отменённый автор', 'active', 1, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            original_move_id = int(
                con.execute(
                    """
                    INSERT INTO stock_moves (
                        project_id, estimate_item_id, move_type, qty, price,
                        created_by, created_at, source_type
                    ) VALUES (?, ?, 'purchase', 5, 1000, ?, ?, 'manual')
                    """,
                    (self.project_id, self.material_id, recorder_id, timestamp),
                ).lastrowid
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at, source_type, source_id
                ) VALUES (?, ?, 'purchase', -5, 0, ?, ?,
                          'stock_move_reversal', ?)
                """,
                (
                    self.project_id,
                    self.material_id,
                    self.admin_id,
                    timestamp + 1,
                    original_move_id,
                ),
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at, source_type
                ) VALUES (?, ?, 'receipt', 5, 0, ?, ?, 'manual')
                """,
                (self.project_id, self.material_id, self.admin_id, timestamp + 2),
            )
            con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price,
                    created_by, created_at, source_type, source_id
                ) VALUES (?, ?, 'receipt', 1, 0, ?, ?,
                          'legacy_purchase_receipt_backfill', 99)
                """,
                (self.project_id, self.material_id, recorder_id, timestamp + 3),
            )
            con.commit()
            material = next(
                item
                for item in communications_docs.material_summary_rows(
                    con,
                    self.project_id,
                    include_procurement_evidence=True,
                )
                if item["id"] == self.material_id
            )

        self.assertEqual(material["purchasedQty"], 0)
        self.assertEqual(material["receivedQty"], 6)
        self.assertEqual(material["procurementActorId"], self.admin_id)
        self.assertEqual(material["procurementActorAction"], "receipt")
        self.assertEqual(material["procurementActorIds"], [self.admin_id])

    def test_material_summary_tolerates_legacy_documents_schema(self) -> None:
        with server.db() as con:
            con.execute("PRAGMA foreign_keys = OFF")
            con.execute("DROP TABLE documents")
            con.execute(
                """
                CREATE TABLE documents (
                    id INTEGER PRIMARY KEY,
                    project_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    storage_path TEXT
                )
                """
            )
            material = next(
                item
                for item in communications_docs.material_summary_rows(
                    con,
                    self.project_id,
                    include_procurement_evidence=True,
                    include_procurement_details=True,
                )
                if item["id"] == self.material_id
            )

        self.assertFalse(material["invoiceAttached"])
        self.assertEqual(material["invoiceCount"], 0)
        self.assertIsNone(material["latestInvoice"])

    def test_accepted_status_is_ready_for_executive_checklist(self) -> None:
        self.assertTrue(communications_docs.executive_ready_status("accepted"))

    def test_delete_preserves_file_shared_by_another_document(self) -> None:
        document_id, file_path = self._insert_document(title="First")
        other_document_id, _ = self._insert_document(title="Second", storage_path=file_path)

        result = self._delete(document_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertFalse(result.response["file_deleted"])
        self.assertFalse(result.response["file_cleanup_failed"])
        self.assertTrue(file_path.is_file())
        with server.db() as con:
            self.assertIsNotNone(con.execute("SELECT 1 FROM documents WHERE id = ?", (other_document_id,)).fetchone())

    def test_delete_resolves_relative_runtime_storage_path(self) -> None:
        document_id, file_path = self._insert_document()
        relative_path = file_path.relative_to(communications_docs.PROJECT_ROOT)
        with server.db() as con:
            con.execute("UPDATE documents SET storage_path = ? WHERE id = ?", (str(relative_path), document_id))
            con.commit()

        result = self._delete(document_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertTrue(result.response["file_deleted"])
        self.assertFalse(file_path.exists())

    def test_delete_reports_and_audits_managed_file_cleanup_failure(self) -> None:
        document_id, file_path = self._insert_document()

        with self.assertLogs(communications_docs.LOGGER, level="WARNING"):
            with mock.patch("pathlib.Path.unlink", side_effect=OSError("locked")):
                result = self._delete(document_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertTrue(result.response["file_cleanup_failed"])
        self.assertFalse(result.response["file_deleted"])
        self.assertTrue(file_path.is_file())
        with server.db() as con:
            self.assertIsNone(con.execute("SELECT 1 FROM documents WHERE id = ?", (document_id,)).fetchone())
            cleanup_audit = con.execute(
                "SELECT payload FROM audit_log WHERE entity = 'document' AND entity_id = ? AND action = 'document_file_cleanup_failed'",
                (document_id,),
            ).fetchone()
        self.assertEqual(json.loads(cleanup_audit["payload"])["error"], "OSError")

    def test_delete_handles_malformed_legacy_storage_path_after_commit(self) -> None:
        document_id, file_path = self._insert_document()
        with server.db() as con:
            con.execute("UPDATE documents SET storage_path = ? WHERE id = ?", ("bad\0name.pdf", document_id))
            con.commit()

        with self.assertLogs(communications_docs.LOGGER, level="WARNING"):
            result = self._delete(document_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertTrue(result.response["file_cleanup_failed"])
        self.assertFalse(result.response["file_deleted"])
        self.assertTrue(file_path.is_file())
        with server.db() as con:
            self.assertIsNone(con.execute("SELECT 1 FROM documents WHERE id = ?", (document_id,)).fetchone())
            cleanup_audit = con.execute(
                "SELECT payload FROM audit_log WHERE entity = 'document' AND entity_id = ? AND action = 'document_file_cleanup_failed'",
                (document_id,),
            ).fetchone()
        self.assertEqual(json.loads(cleanup_audit["payload"])["error"], "ValueError")

    def test_delete_never_unlinks_file_outside_project_documents_directory(self) -> None:
        outside_file = Path(self.temp_dir.name) / "outside.pdf"
        document_id, _ = self._insert_document(storage_path=outside_file)

        with self.assertLogs(communications_docs.LOGGER, level="WARNING"):
            result = self._delete(document_id)

        self.assertEqual(result.status, HTTPStatus.OK)
        self.assertFalse(result.response["file_deleted"])
        self.assertTrue(result.response["file_cleanup_failed"])
        self.assertTrue(outside_file.is_file())

    def test_document_view_uses_server_chosen_type_and_blocks_active_content_inline(self) -> None:
        safe_document_id, safe_file = self._insert_document()
        safe_handler = FakeDocumentHandler(self.admin)

        communications_docs.api_document_file(
            safe_handler,
            f"/api/documents/{safe_document_id}/view",
            inline=True,
        )

        self.assertEqual(
            safe_handler.sent_file,
            {
                "file_path": safe_file.resolve(),
                "content_type": "application/pdf",
                "download_name": "contract.pdf",
                "inline": True,
            },
        )

        for suffix, mime_type in ((".html", "text/html"), (".svg", "image/svg+xml")):
            with self.subTest(suffix=suffix):
                unsafe_file = self.documents_dir / f"project_{self.project_id}" / f"payload{suffix}"
                unsafe_document_id, _ = self._insert_document(
                    title=f"Unsafe {suffix}",
                    storage_path=unsafe_file,
                )
                with server.db() as con:
                    con.execute(
                        """
                        UPDATE documents
                        SET original_name = ?, file_ext = ?, mime_type = ?
                        WHERE id = ?
                        """,
                        (unsafe_file.name, suffix, mime_type, unsafe_document_id),
                    )
                    row = con.execute(
                        "SELECT * FROM documents WHERE id = ?",
                        (unsafe_document_id,),
                    ).fetchone()
                    con.commit()

                unsafe_handler = FakeDocumentHandler(self.admin)
                communications_docs.api_document_file(
                    unsafe_handler,
                    f"/api/documents/{unsafe_document_id}/view",
                    inline=True,
                )

                self.assertFalse(communications_docs.document_payload(row)["can_preview"])
                self.assertEqual(unsafe_handler.sent_file["content_type"], "application/octet-stream")
                self.assertFalse(unsafe_handler.sent_file["inline"])

    def test_document_file_cannot_be_served_outside_its_project_directory(self) -> None:
        outside_file = Path(self.temp_dir.name) / "outside-secret.html"
        document_id, _ = self._insert_document(storage_path=outside_file)
        with server.db() as con:
            con.execute(
                """
                UPDATE documents
                SET original_name = 'outside-secret.html', file_ext = '.html', mime_type = 'text/html'
                WHERE id = ?
                """,
                (document_id,),
            )
            con.commit()
        handler = FakeDocumentHandler(self.admin)

        communications_docs.api_document_file(
            handler,
            f"/api/documents/{document_id}/view",
            inline=True,
        )

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response["error"], "document_forbidden")
        self.assertIsNone(handler.sent_file)

    def test_cleanup_audit_failure_never_escapes_after_document_commit(self) -> None:
        with self.assertLogs(communications_docs.LOGGER, level="ERROR"):
            with mock.patch.object(communications_docs, "db", side_effect=OSError("read-only filesystem")):
                communications_docs.record_document_file_cleanup_failure(
                    user_id=self.admin_id,
                    document_id=99,
                    project_id=self.project_id,
                    storage_path="data/documents/project_1/file.pdf",
                    error=OSError("locked"),
                )


if __name__ == "__main__":
    unittest.main()
