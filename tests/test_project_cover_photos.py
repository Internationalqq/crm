from __future__ import annotations

import gc
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import projects  # noqa: E402
import server  # noqa: E402


class ProjectCoverPhotoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.original_server_db = server.DB_PATH
        self.original_projects_db = projects.DB_PATH
        self.original_bootstrap_path = server.BOOTSTRAP_PATH
        self.original_documents_dir = server.DOCUMENTS_DIR
        test_db = temp_path / "project-cover-photo.sqlite3"
        server.DB_PATH = test_db
        projects.DB_PATH = test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

    def tearDown(self) -> None:
        server.DB_PATH = self.original_server_db
        projects.DB_PATH = self.original_projects_db
        server.BOOTSTRAP_PATH = self.original_bootstrap_path
        server.DOCUMENTS_DIR = self.original_documents_dir
        gc.collect()
        self.temp_dir.cleanup()

    def test_cover_photo_prefers_photo_report_and_respects_customer_visibility(self) -> None:
        timestamp = server.now_ts()
        with server.db() as con:
            project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, budget, paid, spent,
                        created_at, updated_at
                    ) VALUES ('Test object', 'Address', 'Client', 'active', 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            internal_photo_id = int(
                con.execute(
                    """
                    INSERT INTO documents (
                        project_id, title, doc_type, status, original_name,
                        storage_name, storage_path, mime_type, file_ext,
                        is_client_visible, created_at, updated_at
                    ) VALUES (?, 'Internal site photo', 'photo_report', 'ready', 'site.webp',
                              'site.webp', 'site.webp', 'image/webp', '.webp', 0, ?, ?)
                    """,
                    (project_id, timestamp, timestamp),
                ).lastrowid
            )
            visible_image_id = int(
                con.execute(
                    """
                    INSERT INTO documents (
                        project_id, title, doc_type, status, original_name,
                        storage_name, storage_path, mime_type, file_ext,
                        is_client_visible, created_at, updated_at
                    ) VALUES (?, 'Visible drawing', 'project_doc', 'ready', 'view.jpg',
                              'view.jpg', 'view.jpg', 'image/jpeg', '.jpg', 1, ?, ?)
                    """,
                    (project_id, timestamp + 1, timestamp + 1),
                ).lastrowid
            )
            row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

        admin_project = projects.serialize_project(
            row,
            {"id": 1, "role": "admin", "roles": [], "permissions": {"fullAccess": True}},
        )
        customer_project = projects.serialize_project(
            row,
            {"id": 2, "role": "customer", "roles": [], "permissions": {"modules": ["projects"]}},
        )

        self.assertEqual(
            admin_project["cover_photo_url"],
            f"/api/documents/{internal_photo_id}/view",
        )
        self.assertEqual(admin_project["cover_photo_title"], "Internal site photo")
        self.assertEqual(
            customer_project["cover_photo_url"],
            f"/api/documents/{visible_image_id}/view",
        )
        self.assertEqual(customer_project["cover_photo_title"], "Visible drawing")


if __name__ == "__main__":
    unittest.main()
