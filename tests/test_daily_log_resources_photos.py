from __future__ import annotations

import gc
import io
import sys
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import auth  # noqa: E402
import communications_docs  # noqa: E402
import server  # noqa: E402


class MultipartForm(dict):
    def getfirst(self, name: str, default: str = "") -> str:
        value = self.get(name, default)
        return str(value if value is not None else default)


class Upload:
    def __init__(self, filename: str, raw: bytes, mime_type: str = "image/jpeg") -> None:
        self.filename = filename
        self.file = io.BytesIO(raw)
        self.type = mime_type


class Handler:
    def __init__(
        self,
        user: dict,
        payload: dict | None = None,
        form: MultipartForm | None = None,
        *,
        can_access_project: bool = True,
    ) -> None:
        self.user = user
        self.payload = payload or {}
        self.form = form or MultipartForm()
        self.project_access = can_access_project
        self.status: int | None = None
        self.response: dict | None = None
        self.file_body: bytes | None = None

    def require_project_access(self, _project_id: int) -> dict:
        return self.user

    def require_user(self) -> dict:
        return self.user

    def can_access_project(self, _user: dict, _project_id: int) -> bool:
        return self.project_access

    def read_json(self) -> dict:
        return self.payload

    def read_multipart(self) -> MultipartForm:
        return self.form

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload

    def send_file(self, file_path: Path, _content_type: str, _name: str, inline: bool = False) -> None:
        self.status = HTTPStatus.OK
        self.file_body = file_path.read_bytes()
        self.response = {"inline": inline}


class DailyLogResourcePhotoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_server_db = server.DB_PATH
        self.original_communications_db = communications_docs.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_server_documents = server.DOCUMENTS_DIR
        self.original_communications_documents = communications_docs.DOCUMENTS_DIR

        test_db = temp_path / "daily-log-resources.sqlite3"
        documents_dir = temp_path / "documents"
        server.DB_PATH = test_db
        communications_docs.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = documents_dir
        communications_docs.DOCUMENTS_DIR = documents_dir
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
                    ) VALUES ('Resource object', 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            con.commit()
        self.admin = {"id": self.admin_id, "role": "admin", "roles": []}

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        communications_docs.DB_PATH = self.original_communications_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_server_documents
        communications_docs.DOCUMENTS_DIR = self.original_communications_documents
        gc.collect()
        self.temp_dir.cleanup()

    def create_log(self, **extra: object) -> Handler:
        payload = {
            "title": "Отчёт за смену",
            "work_done": "Выполнены работы на объекте.",
            "report_date": "2026-08-26",
            "client_request_id": "resource-report-1",
        }
        payload.update(extra)
        handler = Handler(self.admin, payload=payload)
        communications_docs.api_create_daily_log(
            handler,
            f"/api/projects/{self.project_id}/daily-logs",
        )
        return handler

    @staticmethod
    def jpeg_bytes(width: int = 3200, height: int = 2100) -> bytes:
        output = io.BytesIO()
        Image.new("RGB", (width, height), (44, 96, 138)).save(output, format="JPEG", quality=96)
        return output.getvalue()

    def upload_photo(self, log_id: int, client_photo_id: str, raw: bytes | None = None) -> Handler:
        form = MultipartForm(
            {
                "client_photo_id": client_photo_id,
                "file": Upload("site-photo.jpg", raw if raw is not None else self.jpeg_bytes()),
            }
        )
        handler = Handler(self.admin, form=form)
        communications_docs.api_upload_daily_log_photo(
            handler,
            f"/api/projects/{self.project_id}/daily-logs/{log_id}/photos",
        )
        return handler

    def test_repeatable_workforce_and_equipment_are_stored_with_totals(self) -> None:
        created = self.create_log(
            workforce=[
                {"role": "Электрики", "count": 3, "hours": 8},
                {"role": "Монтажники", "count": 2, "hours": 6.5},
            ],
            equipment_entries=[
                {"name": "Автовышка", "count": 1, "hours": 5.5},
                {"name": "Компрессор", "count": 2, "hours": 4},
            ],
        )

        self.assertEqual(created.status, HTTPStatus.CREATED)
        log = created.response["log"]
        self.assertEqual(log["workers_count"], 5)
        self.assertEqual(log["worker_hours"], 37)
        self.assertEqual(log["equipment_hours"], 13.5)
        self.assertEqual(log["workforce"][0]["role"], "Электрики")
        self.assertEqual(log["equipment_entries"][0]["name"], "Автовышка")
        self.assertIn("Автовышка — 1 ед., 5.5 ч", log["equipment"])

        listed = Handler(self.admin)
        communications_docs.api_project_daily_logs(
            listed,
            f"/api/projects/{self.project_id}/daily-logs",
        )
        self.assertEqual(listed.status, HTTPStatus.OK)
        self.assertEqual(listed.response["logs"][0]["worker_hours"], 37)

    def test_invalid_resource_hours_reject_the_report(self) -> None:
        invalid = self.create_log(
            client_request_id="invalid-resource-report",
            workforce=[{"role": "Электрики", "count": 2, "hours": 25}],
        )

        self.assertEqual(invalid.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(invalid.response["error"], "bad_workforce_hours")
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs").fetchone()[0], 0)

    def test_photo_is_compressed_linked_listed_and_idempotent(self) -> None:
        created = self.create_log()
        log_id = int(created.response["id"])

        first = self.upload_photo(log_id, "resource-report-1:photo:one")
        replay = self.upload_photo(log_id, "resource-report-1:photo:one")

        self.assertEqual(first.status, HTTPStatus.CREATED)
        self.assertEqual(replay.status, HTTPStatus.OK)
        self.assertTrue(replay.response["idempotentReplay"])
        self.assertEqual(first.response["photo"]["id"], replay.response["photo"]["id"])
        self.assertEqual(first.response["photo"]["mime_type"], "image/webp")

        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM documents").fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_photos").fetchone()[0], 1)
            row = con.execute("SELECT storage_path, size_bytes FROM documents").fetchone()
        stored_path = Path(str(row["storage_path"]))
        self.assertTrue(stored_path.is_file())
        with Image.open(stored_path) as image:
            self.assertEqual(image.format, "WEBP")
            self.assertLessEqual(max(image.size), communications_docs.DAILY_LOG_PHOTO_MAX_EDGE)
        self.assertLess(int(row["size_bytes"]), len(self.jpeg_bytes()))

        listed = Handler(self.admin)
        communications_docs.api_project_daily_logs(
            listed,
            f"/api/projects/{self.project_id}/daily-logs",
        )
        photos = listed.response["logs"][0]["photos"]
        self.assertEqual(len(photos), 1)
        self.assertEqual(photos[0]["view_url"], f"/api/documents/{photos[0]['id']}/view")

        deleted = Handler(self.admin)
        communications_docs.api_delete_daily_log(
            deleted,
            f"/api/projects/{self.project_id}/daily-logs/{log_id}/delete",
        )
        self.assertEqual(deleted.status, HTTPStatus.OK)
        self.assertEqual(deleted.response["deletedPhotoCount"], 1)
        self.assertFalse(stored_path.exists())
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM documents").fetchone()[0], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_log_photos").fetchone()[0], 0)

    def test_delete_report_does_not_recalculate_project_progress(self) -> None:
        created = self.create_log(client_request_id="progress-independent-report")
        log_id = int(created.response["id"])
        with server.db() as con:
            con.execute(
                "UPDATE projects SET progress = 63, status = 'active' WHERE id = ?",
                (self.project_id,),
            )
            con.commit()

        deleted = Handler(self.admin)
        communications_docs.api_delete_daily_log(
            deleted,
            f"/api/projects/{self.project_id}/daily-logs/{log_id}/delete",
        )

        self.assertEqual(deleted.status, HTTPStatus.OK)
        with server.db() as con:
            project = con.execute(
                "SELECT progress, status FROM projects WHERE id = ?",
                (self.project_id,),
            ).fetchone()
        self.assertEqual(int(project["progress"]), 63)
        self.assertEqual(project["status"], "active")

    def test_delete_report_does_not_restore_older_report_progress(self) -> None:
        self.create_log(
            client_request_id="historical-progress-report",
            report_date="2026-08-25",
            progress_percent=17,
        )
        deleted_report = self.create_log(
            client_request_id="progress-independent-report-2",
            report_date="2026-08-26",
        )
        with server.db() as con:
            con.execute(
                "UPDATE projects SET progress = 63, status = 'Подготовка' WHERE id = ?",
                (self.project_id,),
            )
            con.commit()

        deleted = Handler(self.admin)
        communications_docs.api_delete_daily_log(
            deleted,
            f"/api/projects/{self.project_id}/daily-logs/{deleted_report.response['id']}/delete",
        )

        self.assertEqual(deleted.status, HTTPStatus.OK)
        with server.db() as con:
            project = con.execute(
                "SELECT progress, status FROM projects WHERE id = ?",
                (self.project_id,),
            ).fetchone()
        self.assertEqual((int(project["progress"]), project["status"]), (63, "Подготовка"))
        self.assertEqual(int(deleted.response["project"]["progress"]), 63)
        self.assertEqual(deleted.response["project"]["status"], "Подготовка")

    def test_fake_image_is_rejected_without_document(self) -> None:
        created = self.create_log()
        uploaded = self.upload_photo(
            int(created.response["id"]),
            "resource-report-1:photo:fake",
            b"\xff\xd8\xffthis-is-not-an-image",
        )

        self.assertEqual(uploaded.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(uploaded.response["error"], "bad_daily_log_photo_format")
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM documents").fetchone()[0], 0)

    def test_guest_can_view_only_client_visible_report_photo(self) -> None:
        created = self.create_log()
        uploaded = self.upload_photo(int(created.response["id"]), "resource-report-1:photo:visible")
        document_id = int(uploaded.response["photo"]["id"])
        guest = {"id": 99, "role": "guest", "roles": [], "isGuest": True}

        visible = Handler(guest)
        communications_docs.api_document_file(visible, f"/api/documents/{document_id}/view", inline=True)
        self.assertEqual(visible.status, HTTPStatus.OK)
        self.assertTrue(visible.file_body)
        self.assertTrue(auth.guest_api_allowed("GET", f"/api/documents/{document_id}/view"))

        outsider = Handler(guest, can_access_project=False)
        communications_docs.api_document_file(outsider, f"/api/documents/{document_id}/view", inline=True)
        self.assertEqual(outsider.status, HTTPStatus.FORBIDDEN)

        generic_path = communications_docs.project_documents_dir(self.project_id) / "generic-visible.webp"
        generic_path.write_bytes(communications_docs.compress_daily_log_image(self.jpeg_bytes(80, 60)) or b"")
        with server.db() as con:
            timestamp = server.now_ts()
            generic_document_id = int(
                con.execute(
                    """
                    INSERT INTO documents (
                        project_id, title, doc_type, status, original_name, storage_name,
                        storage_path, mime_type, file_ext, size_bytes, uploaded_by,
                        is_client_visible, created_at, updated_at
                    ) VALUES (?, 'Generic client document', 'file', 'draft', 'generic.webp',
                              'generic-visible.webp', ?, 'image/webp', '.webp', ?, ?, 1, ?, ?)
                    """,
                    (
                        self.project_id,
                        str(generic_path),
                        generic_path.stat().st_size,
                        self.admin_id,
                        timestamp,
                        timestamp,
                    ),
                ).lastrowid
            )
            con.commit()
        generic = Handler(guest)
        communications_docs.api_document_file(
            generic,
            f"/api/documents/{generic_document_id}/view",
            inline=True,
        )
        self.assertEqual(generic.status, HTTPStatus.FORBIDDEN)

        with server.db() as con:
            con.execute("UPDATE documents SET is_client_visible = 0 WHERE id = ?", (document_id,))
            con.commit()
        hidden = Handler(guest)
        communications_docs.api_document_file(hidden, f"/api/documents/{document_id}/view", inline=True)
        self.assertEqual(hidden.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(hidden.response["error"], "document_forbidden")

    def test_report_delete_preserves_photo_used_by_finance(self) -> None:
        created = self.create_log()
        log_id = int(created.response["id"])
        uploaded = self.upload_photo(log_id, "resource-report-1:photo:referenced")
        document_id = int(uploaded.response["photo"]["id"])
        with server.db() as con:
            storage_path = Path(
                str(con.execute("SELECT storage_path FROM documents WHERE id = ?", (document_id,)).fetchone()[0])
            )
            con.execute(
                """
                INSERT INTO finance_entries (
                    project_id, direction, payment_kind, amount, document_id,
                    status, created_by, created_at, updated_at
                ) VALUES (?, 'expense', 'cash', 100, ?, 'planned', ?, ?, ?)
                """,
                (self.project_id, document_id, self.admin_id, server.now_ts(), server.now_ts()),
            )
            con.commit()

        deleted = Handler(self.admin)
        communications_docs.api_delete_daily_log(
            deleted,
            f"/api/projects/{self.project_id}/daily-logs/{log_id}/delete",
        )

        self.assertEqual(deleted.status, HTTPStatus.CONFLICT)
        self.assertEqual(deleted.response["error"], "daily_log_photo_in_use")
        self.assertTrue(storage_path.is_file())
        with server.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM daily_logs WHERE id = ?", (log_id,)).fetchone()[0], 1)
            self.assertEqual(con.execute("SELECT COUNT(*) FROM documents WHERE id = ?", (document_id,)).fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
