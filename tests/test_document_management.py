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
