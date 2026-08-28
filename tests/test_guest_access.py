from __future__ import annotations

import gc
import io
import json
import sys
import tempfile
import unittest
from http import HTTPStatus
from http.cookies import SimpleCookie
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import auth  # noqa: E402
import communications_docs  # noqa: E402
import projects  # noqa: E402
import schedule_tasks  # noqa: E402
import server  # noqa: E402


class AuthResponseHandler:
    def __init__(self, cookie: str = "", payload: dict | None = None) -> None:
        self.headers = {"User-Agent": "credential-guest-test"}
        if cookie:
            self.headers["Cookie"] = cookie
        self.client_address = ("127.0.0.1", 42001)
        self.request_payload = payload or {}
        self.status = None
        self.response_headers: list[tuple[str, str]] = []
        self.payload = None
        self.wfile = io.BytesIO()

    def send_response(self, status: int) -> None:
        self.status = status

    def send_header(self, name: str, value: str) -> None:
        self.response_headers.append((name, value))

    def end_headers(self) -> None:
        return None

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.payload = payload

    def read_json(self) -> dict:
        return self.request_payload


class PageHandler(AuthResponseHandler):
    def __init__(self, path: str, cookie: str = "") -> None:
        super().__init__(cookie)
        self.path = path

    def clean_path(self) -> str:
        return server.PMBIHandler.clean_path(self)

    def current_user(self) -> dict | None:
        return auth.current_user(self)

    def redirect(self, location: str) -> None:
        server.PMBIHandler.redirect(self, location)

    def render_template(self, template_name: str, variables: dict[str, str]) -> bytes:
        return server.PMBIHandler.render_template(self, template_name, variables)

    def send_html(self, body: bytes, status: int = HTTPStatus.OK) -> None:
        server.PMBIHandler.send_html(self, body, status)

    def serve_public_entry(self) -> None:
        server.PMBIHandler.serve_public_entry(self)

    def serve_app(self, path: str) -> None:
        server.PMBIHandler.serve_app(self, path)


class JsonHandler:
    def __init__(self, user: dict | None, payload: dict | None = None) -> None:
        self.user = user
        self.request_payload = payload or {}
        self.status = None
        self.payload = None

    def require_user(self) -> dict | None:
        if not self.user:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "auth_required"})
            return None
        return self.user

    def read_json(self) -> dict:
        return self.request_payload

    def can_access_project(self, user: dict, project_id: int) -> bool:
        return projects.can_access_project(self, user, project_id)

    def require_project_access(self, project_id: int) -> dict | None:
        user = self.require_user()
        if not user:
            return None
        if not self.can_access_project(user, project_id):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "project_forbidden"})
            return None
        return user

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.payload = payload


class GuestAccessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.test_db = temp_path / "guest-access.sqlite3"
        self.original_paths = {
            "auth": auth.DB_PATH,
            "auth_data": auth.DATA_DIR,
            "server": server.DB_PATH,
            "projects": projects.DB_PATH,
            "communications": communications_docs.DB_PATH,
            "schedule": schedule_tasks.DB_PATH,
            "bootstrap": server.BOOTSTRAP_PATH,
            "documents": server.DOCUMENTS_DIR,
        }
        auth.DB_PATH = self.test_db
        auth.DATA_DIR = temp_path
        server.DB_PATH = self.test_db
        projects.DB_PATH = self.test_db
        communications_docs.DB_PATH = self.test_db
        schedule_tasks.DB_PATH = self.test_db
        server.BOOTSTRAP_PATH = temp_path / "INITIAL_ADMIN.txt"
        server.DOCUMENTS_DIR = temp_path / "documents"
        server.init_db()

        timestamp = server.now_ts()
        with server.db() as con:
            actor_row = con.execute("SELECT * FROM users WHERE lower(login) = 'admin'").fetchone()
            self.actor_id = int(actor_row["id"])
            self.assigned_project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, progress, guest_visible,
                        budget, paid, spent, created_at, updated_at
                    ) VALUES ('Чебаркуль', 'Закрытый адрес', 'Заказчик', 'active', 37, 0, 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            self.other_project_id = int(
                con.execute(
                    """
                    INSERT INTO projects (
                        title, address, client_name, status, progress, guest_visible,
                        budget, paid, spent, created_at, updated_at
                    ) VALUES ('Чужой объект', 'Другой адрес', 'Другой заказчик', 'active', 10, 1, 0, 0, 0, ?, ?)
                    """,
                    (timestamp, timestamp),
                ).lastrowid
            )
            con.execute(
                """
                INSERT INTO daily_logs (
                    project_id, report_date, title, work_done, workers_count,
                    equipment, blockers, next_steps, progress_percent, raw_input,
                    is_client_visible, created_by, created_at, updated_at
                ) VALUES (?, '2026-08-24', 'Публичный отчёт', 'Выполнены работы', 4,
                          'Кран', '', 'Следующий этап', 37, 'Внутренняя диктовка', 1, ?, ?, ?)
                """,
                (self.assigned_project_id, self.actor_id, timestamp, timestamp),
            )
            con.execute(
                """
                INSERT INTO daily_logs (
                    project_id, report_date, title, work_done, raw_input,
                    is_client_visible, created_by, created_at, updated_at
                ) VALUES (?, '2026-08-23', 'Внутренний отчёт', 'Скрытая запись',
                          'Скрытая диктовка', 0, ?, ?, ?)
                """,
                (self.assigned_project_id, self.actor_id, timestamp, timestamp),
            )
            con.execute(
                """
                INSERT INTO production_schedule_operations (
                    project_id, generation_key, title, planned_qty, unit,
                    people_count, shift_count, brigade_count, auto_duration_days,
                    position, origin, status, color, source_signature,
                    source_link_count, source_links_snapshot, manual_fields,
                    created_at, updated_at
                ) VALUES (?, 'credential-guest-operation', 'Монтаж', 12, 'м²',
                          3, 1, 1, 2, 0, 'auto', 'linked', 'blue',
                          'private-signature', 1, '[{"private": true}]', '[]', ?, ?)
                """,
                (self.assigned_project_id, timestamp, timestamp),
            )
            con.commit()
            actor_row = con.execute("SELECT * FROM users WHERE id = ?", (self.actor_id,)).fetchone()
        self.actor = auth.user_payload(actor_row)

    def tearDown(self) -> None:
        auth.DB_PATH = self.original_paths["auth"]
        auth.DATA_DIR = self.original_paths["auth_data"]
        server.DB_PATH = self.original_paths["server"]
        projects.DB_PATH = self.original_paths["projects"]
        communications_docs.DB_PATH = self.original_paths["communications"]
        schedule_tasks.DB_PATH = self.original_paths["schedule"]
        server.BOOTSTRAP_PATH = self.original_paths["bootstrap"]
        server.DOCUMENTS_DIR = self.original_paths["documents"]
        gc.collect()
        self.temp_dir.cleanup()

    def create_guest(self, project_id: int | None = None, actor: dict | None = None) -> tuple[dict, dict]:
        handler = JsonHandler(actor or self.actor, {"projectId": project_id or self.assigned_project_id})
        server.PMBIHandler.api_create_guest_access(handler)
        self.assertEqual(handler.status, HTTPStatus.CREATED)
        guest_id = int(handler.payload["guest"]["id"])
        with server.db() as con:
            row = con.execute("SELECT * FROM users WHERE id = ?", (guest_id,)).fetchone()
        return auth.user_payload(row), handler.payload

    def test_public_entry_has_login_only_and_creates_no_session(self) -> None:
        for path in ("/", "/index.html", "/?next=/app/projects"):
            with self.subTest(path=path):
                handler = PageHandler(path)
                server.PMBIHandler.do_GET(handler)
                body = handler.wfile.getvalue().decode("utf-8")
                self.assertEqual(handler.status, HTTPStatus.OK)
                self.assertIn("public-entry-window", body)
                self.assertIn("Войти", body)
                self.assertNotIn("Смотреть объекты без входа", body)
                self.assertFalse(any(name == "Set-Cookie" for name, _ in handler.response_headers))
        with server.db() as con:
            self.assertEqual(int(con.execute("SELECT COUNT(*) FROM guest_sessions").fetchone()[0]), 0)
            self.assertEqual(int(con.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]), 0)

    def test_anonymous_app_redirects_to_public_entry(self) -> None:
        for path in ("/app/projects", "/app/dashboard", "/app/users"):
            with self.subTest(path=path):
                handler = PageHandler(path)
                server.PMBIHandler.do_GET(handler)
                self.assertEqual(handler.status, HTTPStatus.FOUND)
                location = next(value for name, value in handler.response_headers if name == "Location")
                self.assertEqual(location, f"/?next={path}")
                self.assertFalse(any(name == "Set-Cookie" for name, _ in handler.response_headers))

    def test_retired_anonymous_guest_endpoint_is_not_found(self) -> None:
        handler = JsonHandler(None)
        handler.headers = {}
        handler.current_user = lambda: None
        server.PMBIHandler.handle_api(handler, "POST", "/api/auth/guest")
        self.assertEqual(handler.status, HTTPStatus.NOT_FOUND)
        self.assertEqual(handler.payload, {"error": "not_found"})

    def test_creation_generates_hashed_credentials_and_one_project_acl(self) -> None:
        guest, response = self.create_guest()
        credentials = response["credentials"]
        self.assertTrue(response["passwordShownOnce"])
        self.assertRegex(credentials["login"], rf"^guest-{self.assigned_project_id}-[0-9a-f]{{8}}$")
        self.assertGreaterEqual(len(credentials["password"]), 10)
        self.assertTrue(guest["isGuest"])
        self.assertEqual(guest["permissions"]["modules"], ["projects"])

        with server.db() as con:
            user_row = con.execute("SELECT password_hash FROM users WHERE id = ?", (guest["id"],)).fetchone()
            acl_rows = con.execute("SELECT project_id FROM user_project_access WHERE user_id = ?", (guest["id"],)).fetchall()
            assignments = con.execute("SELECT COUNT(*) FROM object_assignments WHERE user_id = ?", (guest["id"],)).fetchone()[0]
            audit_payload = con.execute(
                "SELECT payload FROM audit_log WHERE action = 'create_guest_access' AND entity_id = ?",
                (guest["id"],),
            ).fetchone()["payload"]
        self.assertNotEqual(user_row["password_hash"], credentials["password"])
        self.assertTrue(auth.verify_password(credentials["password"], user_row["password_hash"]))
        self.assertEqual([int(row["project_id"]) for row in acl_rows], [self.assigned_project_id])
        self.assertEqual(int(assignments), 0)
        self.assertNotIn(credentials["password"], audit_payload)
        self.assertNotIn("password", json.loads(audit_payload))
        directory = JsonHandler(self.actor)
        server.PMBIHandler.api_users(directory)
        listed_guest = next(item for item in directory.payload["users"] if int(item["id"]) == int(guest["id"]))
        self.assertTrue(listed_guest["isGuest"])
        self.assertEqual(listed_guest["assignedProjects"][0]["id"], self.assigned_project_id)
        self.assertFalse(any("password" in key.lower() for key in listed_guest))

    def test_each_creation_uses_unique_login_and_password(self) -> None:
        _first_guest, first = self.create_guest()
        _second_guest, second = self.create_guest()
        self.assertNotEqual(first["credentials"]["login"], second["credentials"]["login"])
        self.assertNotEqual(first["credentials"]["password"], second["credentials"]["password"])

    def test_anonymous_guest_and_inaccessible_actor_cannot_create_access(self) -> None:
        anonymous = JsonHandler(None, {"projectId": self.assigned_project_id})
        server.PMBIHandler.api_create_guest_access(anonymous)
        self.assertEqual(anonymous.status, HTTPStatus.UNAUTHORIZED)

        guest, _response = self.create_guest()
        guest_handler = JsonHandler(guest, {"projectId": self.assigned_project_id})
        server.PMBIHandler.api_create_guest_access(guest_handler)
        self.assertEqual(guest_handler.status, HTTPStatus.FORBIDDEN)

        timestamp = server.now_ts()
        with server.db() as con:
            role = con.execute("SELECT id FROM roles WHERE code = 'financier'").fetchone()
            restricted_id = int(
                con.execute(
                    """
                    INSERT INTO users (login, password_hash, role, name, status, is_active, created_at, updated_at)
                    VALUES ('restricted-user', ?, 'financier', 'Ограниченный пользователь', 'active', 1, ?, ?)
                    """,
                    (auth.hash_password('Restricted-2026!'), timestamp, timestamp),
                ).lastrowid
            )
            con.execute("INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)", (restricted_id, role["id"], timestamp))
            con.execute("INSERT INTO user_project_access (user_id, project_id) VALUES (?, ?)", (restricted_id, self.assigned_project_id))
            con.commit()
            restricted_row = con.execute("SELECT * FROM users WHERE id = ?", (restricted_id,)).fetchone()
        restricted = auth.user_payload(restricted_row)
        denied = JsonHandler(restricted, {"projectId": self.other_project_id})
        server.PMBIHandler.api_create_guest_access(denied)
        self.assertEqual(denied.status, HTTPStatus.FORBIDDEN)
        allowed = JsonHandler(restricted, {"projectId": self.assigned_project_id})
        server.PMBIHandler.api_create_guest_access(allowed)
        self.assertEqual(allowed.status, HTTPStatus.CREATED)

    def test_generated_credentials_login_as_real_guest_session(self) -> None:
        guest, response = self.create_guest()
        login_handler = AuthResponseHandler(payload=response["credentials"])
        auth.api_login(login_handler)
        self.assertEqual(login_handler.status, HTTPStatus.OK)
        body = json.loads(login_handler.wfile.getvalue().decode("utf-8"))
        self.assertTrue(body["user"]["isGuest"])
        set_cookie = next(value for name, value in login_handler.response_headers if name == "Set-Cookie")
        parsed = SimpleCookie()
        parsed.load(set_cookie)
        token = parsed[auth.SESSION_COOKIE].value
        current = auth.current_user(AuthResponseHandler(f"{auth.SESSION_COOKIE}={token}"))
        self.assertEqual(current["id"], guest["id"])
        self.assertTrue(auth.user_is_guest(current))
        with server.db() as con:
            session = con.execute("SELECT user_id FROM sessions WHERE token_hash = ?", (auth.token_hash(token),)).fetchone()
        self.assertEqual(int(session["user_id"]), guest["id"])

    def test_guest_project_list_uses_acl_not_global_visibility(self) -> None:
        guest, _response = self.create_guest()
        handler = JsonHandler(guest)
        projects.api_projects(handler)
        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual([item["id"] for item in handler.payload["projects"]], [self.assigned_project_id])
        self.assertEqual(set(handler.payload["projects"][0]), {"id", "title", "status", "progress"})
        self.assertTrue(projects.can_access_project(handler, guest, self.assigned_project_id))
        self.assertFalse(projects.can_access_project(handler, guest, self.other_project_id))

    def test_guest_reports_and_schedule_are_project_scoped_and_redacted(self) -> None:
        guest, _response = self.create_guest()
        report_handler = JsonHandler(guest)
        communications_docs.api_project_daily_logs(report_handler, f"/api/projects/{self.assigned_project_id}/daily-logs")
        self.assertEqual(report_handler.status, HTTPStatus.OK)
        self.assertEqual(len(report_handler.payload["logs"]), 1)
        report = report_handler.payload["logs"][0]
        self.assertEqual(report["title"], "Публичный отчёт")
        self.assertEqual(report["author_name"], "Команда объекта")
        self.assertNotIn("raw_input", report)
        self.assertNotIn("created_by", report)

        denied = JsonHandler(guest)
        communications_docs.api_project_daily_logs(denied, f"/api/projects/{self.other_project_id}/daily-logs")
        self.assertEqual(denied.status, HTTPStatus.FORBIDDEN)

        schedule = JsonHandler(guest)
        schedule_tasks.api_production_schedule(schedule, f"/api/projects/{self.assigned_project_id}/production-schedule")
        self.assertEqual(schedule.status, HTTPStatus.OK)
        self.assertNotIn("operations", schedule.payload)
        self.assertEqual(len(schedule.payload["items"]), 1)
        for forbidden in ("generationKey", "sourceSignature", "sourceLinkSnapshots", "manualFields"):
            self.assertNotIn(forbidden, schedule.payload["items"][0])

    def test_guest_policy_is_default_deny_even_with_another_role(self) -> None:
        guest, _response = self.create_guest()
        mixed = {**guest, "role": "admin", "roles": ["admin", "guest"], "permissions": {"fullAccess": True, "modules": auth.ALL_MODULES}}
        self.assertTrue(auth.user_can_open(mixed, "/app/projects"))
        self.assertFalse(auth.user_can_open(mixed, "/app/dashboard"))
        self.assertFalse(auth.user_can_open(mixed, "/app/users"))
        self.assertTrue(auth.guest_api_allowed("GET", "/api/projects"))
        self.assertFalse(auth.guest_api_allowed("GET", "/api/users"))
        guard = JsonHandler(mixed)
        guard.headers = {}
        guard.current_user = lambda: mixed
        server.PMBIHandler.handle_api(guard, "GET", "/api/users")
        self.assertEqual(guard.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(guard.payload, {"error": "guest_forbidden"})

    def test_guest_role_permissions_are_kept_minimal_on_migration(self) -> None:
        with server.db() as con:
            con.execute("UPDATE roles SET permissions = ? WHERE code = 'guest'", (json.dumps({"fullAccess": True, "modules": auth.ALL_MODULES}),))
            con.commit()
        server.init_db()
        with server.db() as con:
            permissions = json.loads(con.execute("SELECT permissions FROM roles WHERE code = 'guest'").fetchone()["permissions"])
        self.assertEqual(permissions, auth.default_permissions_for_role("guest"))

    def test_logout_returns_to_public_state_without_creating_guest(self) -> None:
        _guest, response = self.create_guest()
        login = AuthResponseHandler(payload=response["credentials"])
        auth.api_login(login)
        cookie = next(value for name, value in login.response_headers if name == "Set-Cookie")
        parsed = SimpleCookie()
        parsed.load(cookie)
        token = parsed[auth.SESSION_COOKIE].value
        logout = AuthResponseHandler(f"{auth.SESSION_COOKIE}={token}")
        auth.api_logout(logout)
        self.assertEqual(logout.status, HTTPStatus.OK)
        self.assertIsNone(auth.current_user(AuthResponseHandler(f"{auth.SESSION_COOKIE}={token}")))
        page = PageHandler("/")
        server.PMBIHandler.do_GET(page)
        self.assertEqual(page.status, HTTPStatus.OK)
        self.assertIn("public-entry-window", page.wfile.getvalue().decode("utf-8"))
        self.assertFalse(any(name == "Set-Cookie" for name, _ in page.response_headers))


if __name__ == "__main__":
    unittest.main()
