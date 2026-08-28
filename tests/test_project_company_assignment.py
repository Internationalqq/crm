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
    def __init__(self, user: dict, payload: dict | None = None) -> None:
        self.user = user
        self.request_payload = payload or {}
        self.status: int | None = None
        self.response: dict | None = None

    def require_user(self) -> dict:
        return self.user

    def read_json(self) -> dict:
        return self.request_payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class ProjectCompanyAssignmentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.test_db = temp_path / "project-company-assignment.sqlite3"
        self.original_paths = {
            "server_db": server.DB_PATH,
            "server_data": server.DATA_DIR,
            "server_bootstrap": server.BOOTSTRAP_PATH,
            "server_documents": server.DOCUMENTS_DIR,
            "projects_db": projects.DB_PATH,
            "projects_data": projects.DATA_DIR,
        }
        server.DB_PATH = self.test_db
        server.DATA_DIR = temp_path
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        projects.DB_PATH = self.test_db
        projects.DATA_DIR = temp_path
        server.init_db()

        with server.db() as con:
            admin = con.execute(
                "SELECT id FROM users WHERE lower(login) = 'admin'"
            ).fetchone()
            self.admin_id = int(admin["id"])
            self.company_options = {
                item["code"]: item
                for item in projects.project_portfolio_company_options(con)
            }

    def tearDown(self) -> None:
        server.DB_PATH = self.original_paths["server_db"]
        server.DATA_DIR = self.original_paths["server_data"]
        server.BOOTSTRAP_PATH = self.original_paths["server_bootstrap"]
        server.DOCUMENTS_DIR = self.original_paths["server_documents"]
        projects.DB_PATH = self.original_paths["projects_db"]
        projects.DATA_DIR = self.original_paths["projects_data"]
        gc.collect()
        self.temp_dir.cleanup()

    def admin_user(self) -> dict:
        return {"id": self.admin_id, "role": "admin", "roles": []}

    def project_payload(
        self,
        title: str,
        own_legal_entity_id: object = ...,
    ) -> dict:
        payload = {
            "title": title,
            "address": "Тестовый адрес",
            "client_name": "Тестовый заказчик",
        }
        if own_legal_entity_id is not ...:
            payload["own_legal_entity_id"] = own_legal_entity_id
        return payload

    def create_project(self, title: str, company_code: str = "uess") -> FakeHandler:
        handler = FakeHandler(
            self.admin_user(),
            self.project_payload(title, self.company_options[company_code]["id"]),
        )
        projects.api_create_project(handler)
        self.assertEqual(handler.status, HTTPStatus.CREATED, handler.response)
        return handler

    def insert_legacy_project(self, title: str = "Legacy without company") -> int:
        timestamp = server.now_ts()
        with server.db() as con:
            cursor = con.execute(
                """
                INSERT INTO projects (
                    title, address, client_name, status, progress,
                    budget, paid, spent, created_at, updated_at
                ) VALUES (?, 'Старый адрес', 'Старый заказчик', 'active', 0,
                          0, 0, 0, ?, ?)
                """,
                (title, timestamp, timestamp),
            )
            con.commit()
            return int(cursor.lastrowid)

    def insert_company(self, company_type: str, name: str) -> int:
        with server.db() as con:
            cursor = con.execute(
                "INSERT INTO companies (type, name, created_at) VALUES (?, ?, ?)",
                (company_type, name, server.now_ts()),
            )
            con.commit()
            return int(cursor.lastrowid)

    def stored_company_id(self, project_id: int) -> int | None:
        with server.db() as con:
            row = con.execute(
                "SELECT own_legal_entity_id FROM projects WHERE id = ?",
                (project_id,),
            ).fetchone()
            return int(row["own_legal_entity_id"]) if row["own_legal_entity_id"] else None

    def test_init_db_seeds_portfolio_companies_idempotently(self) -> None:
        expected = list(projects.PROJECT_PORTFOLIO_COMPANIES)
        before = [
            (item["id"], item["code"], item["name"])
            for item in self.company_options.values()
        ]

        server.init_db()

        with server.db() as con:
            after_options = projects.project_portfolio_company_options(con)
            own_company_count = int(
                con.execute(
                    "SELECT COUNT(*) FROM companies WHERE type = 'own_legal_entity'"
                ).fetchone()[0]
            )
        after = [
            (item["id"], item["code"], item["name"])
            for item in after_options
        ]
        self.assertEqual([(item[1], item[2]) for item in after], expected)
        self.assertEqual(after, before)
        self.assertEqual(own_company_count, 3)

    def test_create_assigns_each_seeded_company(self) -> None:
        for code, label in projects.PROJECT_PORTFOLIO_COMPANIES:
            with self.subTest(code=code):
                handler = self.create_project(f"Create {code}", code)
                project = handler.response["project"]
                expected_id = self.company_options[code]["id"]
                self.assertEqual(project["own_legal_entity_id"], expected_id)
                self.assertEqual(project["portfolio_company"], code)
                self.assertEqual(project["portfolio_company_label"], label)
                self.assertEqual(self.stored_company_id(project["id"]), expected_id)

    def test_new_project_requires_company(self) -> None:
        cases = (
            self.project_payload("Missing company"),
            self.project_payload("Empty company", ""),
        )
        for payload in cases:
            with self.subTest(title=payload["title"]):
                handler = FakeHandler(self.admin_user(), payload)
                projects.api_create_project(handler)
                self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST, handler.response)

    def test_update_changes_company_and_accepts_camel_case_alias(self) -> None:
        created = self.create_project("Update company", "uess").response["project"]
        strategy = self.company_options["strategy"]
        handler = FakeHandler(
            self.admin_user(),
            {"ownLegalEntityId": strategy["id"]},
        )

        projects.api_update_project(
            handler, f"/api/projects/{created['id']}/update"
        )

        self.assertEqual(handler.status, HTTPStatus.OK, handler.response)
        self.assertEqual(handler.response["project"]["own_legal_entity_id"], strategy["id"])
        self.assertEqual(handler.response["project"]["portfolio_company"], "strategy")
        self.assertEqual(handler.response["project"]["portfolio_company_label"], "Стратегия")
        self.assertEqual(self.stored_company_id(created["id"]), strategy["id"])

    def test_update_without_company_preserves_existing_assignment(self) -> None:
        created = self.create_project("Preserve company", "pm").response["project"]
        expected_id = self.company_options["pm"]["id"]
        handler = FakeHandler(self.admin_user(), {"status": "В работе"})

        projects.api_update_project(
            handler, f"/api/projects/{created['id']}/update"
        )

        self.assertEqual(handler.status, HTTPStatus.OK, handler.response)
        self.assertEqual(handler.response["project"]["own_legal_entity_id"], expected_id)
        self.assertEqual(handler.response["project"]["portfolio_company"], "pm")
        self.assertEqual(self.stored_company_id(created["id"]), expected_id)

    def test_explicit_empty_company_clears_assignment(self) -> None:
        created = self.create_project("Clear company", "pm").response["project"]
        handler = FakeHandler(self.admin_user(), {"own_legal_entity_id": ""})

        projects.api_update_project(
            handler, f"/api/projects/{created['id']}/update"
        )

        self.assertEqual(handler.status, HTTPStatus.OK, handler.response)
        self.assertIsNone(handler.response["project"]["own_legal_entity_id"])
        self.assertIsNone(handler.response["project"]["portfolio_company"])
        self.assertIsNone(handler.response["project"]["portfolio_company_label"])
        self.assertIsNone(self.stored_company_id(created["id"]))

    def test_create_rejects_invalid_or_nonportfolio_company(self) -> None:
        client_id = self.insert_company("client", "Заказчик не является нашей компанией")
        extra_own_id = self.insert_company("own_legal_entity", "Четвёртая компания")
        cases = (
            ("text", "bad_company_id"),
            (999_999, "own_legal_entity_not_found"),
            (client_id, "own_legal_entity_not_found"),
            (extra_own_id, "own_legal_entity_not_found"),
        )

        for index, (company_id, expected_error) in enumerate(cases):
            with self.subTest(company_id=company_id):
                handler = FakeHandler(
                    self.admin_user(),
                    self.project_payload(f"Invalid create {index}", company_id),
                )
                projects.api_create_project(handler)
                self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST, handler.response)
                self.assertEqual(handler.response["error"], expected_error)

    def test_update_rejects_invalid_or_nonportfolio_company(self) -> None:
        created = self.create_project("Invalid update", "uess").response["project"]
        original_id = self.company_options["uess"]["id"]
        client_id = self.insert_company("client", "Чужой заказчик")
        extra_own_id = self.insert_company("own_legal_entity", "Четвёртая компания")
        cases = (
            ("text", "bad_company_id"),
            (999_999, "own_legal_entity_not_found"),
            (client_id, "own_legal_entity_not_found"),
            (extra_own_id, "own_legal_entity_not_found"),
        )

        for company_id, expected_error in cases:
            with self.subTest(company_id=company_id):
                handler = FakeHandler(
                    self.admin_user(), {"own_legal_entity_id": company_id}
                )
                projects.api_update_project(
                    handler, f"/api/projects/{created['id']}/update"
                )
                self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST, handler.response)
                self.assertEqual(handler.response["error"], expected_error)
                self.assertEqual(self.stored_company_id(created["id"]), original_id)

    def test_list_returns_assignments_and_only_seeded_options(self) -> None:
        expected_projects: dict[str, tuple[str, str, int]] = {}
        for code, label in projects.PROJECT_PORTFOLIO_COMPANIES:
            title = f"List {code}"
            created = self.create_project(title, code).response["project"]
            expected_projects[title] = (
                code,
                label,
                self.company_options[code]["id"],
            )
            self.assertEqual(created["portfolio_company"], code)
        legacy_id = self.insert_legacy_project()

        handler = FakeHandler(self.admin_user())
        projects.api_projects(handler)

        self.assertEqual(handler.status, HTTPStatus.OK, handler.response)
        self.assertEqual(
            [
                (item["code"], item["name"], item["id"])
                for item in handler.response["portfolioCompanies"]
            ],
            [
                (code, label, self.company_options[code]["id"])
                for code, label in projects.PROJECT_PORTFOLIO_COMPANIES
            ],
        )
        by_title = {item["title"]: item for item in handler.response["projects"]}
        for title, (code, label, company_id) in expected_projects.items():
            self.assertEqual(by_title[title]["own_legal_entity_id"], company_id)
            self.assertEqual(by_title[title]["portfolio_company"], code)
            self.assertEqual(by_title[title]["portfolio_company_label"], label)
        legacy = next(
            item for item in handler.response["projects"] if item["id"] == legacy_id
        )
        self.assertIsNone(legacy["own_legal_entity_id"])
        self.assertIsNone(legacy["portfolio_company"])
        self.assertIsNone(legacy["portfolio_company_label"])

    def test_legacy_null_survives_partial_update(self) -> None:
        project_id = self.insert_legacy_project("Legacy partial update")
        handler = FakeHandler(self.admin_user(), {"status": "В работе"})

        projects.api_update_project(
            handler, f"/api/projects/{project_id}/update"
        )

        self.assertEqual(handler.status, HTTPStatus.OK, handler.response)
        self.assertIsNone(handler.response["project"]["own_legal_entity_id"])
        self.assertIsNone(handler.response["project"]["portfolio_company"])
        self.assertIsNone(handler.response["project"]["portfolio_company_label"])
        self.assertIsNone(self.stored_company_id(project_id))


if __name__ == "__main__":
    unittest.main()
