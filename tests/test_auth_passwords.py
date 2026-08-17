from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
import urllib.request
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import auth  # noqa: E402


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        result = super().__exit__(exc_type, exc_value, traceback)
        self.close()
        return result


class FakeHandler:
    def __init__(self, payload: dict, token: str | None = None):
        self.payload = payload
        self.status = None
        self.response = None
        self.client_address = ("127.0.0.1", 42000)
        self.headers = {}
        if token:
            self.headers["Cookie"] = f"{auth.SESSION_COOKIE}={token}"

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class AuthPasswordTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.old_db_path = auth.DB_PATH
        self.old_data_dir = auth.DATA_DIR
        self.old_db = auth.db
        self.old_smtp_host = auth.PMBI_SMTP_HOST
        self.old_smtp_from = auth.PMBI_SMTP_FROM
        self.old_mail_provider = auth.PMBI_MAIL_PROVIDER
        self.old_resend_api_key = auth.PMBI_RESEND_API_KEY
        self.old_resend_from = auth.PMBI_RESEND_FROM
        self.old_send_password_reset_email = auth.send_password_reset_email
        auth.DATA_DIR = Path(self.tmp.name)
        auth.DB_PATH = Path(self.tmp.name) / "test.sqlite3"
        auth.db = self.open_test_db
        auth.AUTH_RATE_LIMITS.clear()
        self.create_schema()

    def tearDown(self) -> None:
        auth.DB_PATH = self.old_db_path
        auth.DATA_DIR = self.old_data_dir
        auth.db = self.old_db
        auth.PMBI_SMTP_HOST = self.old_smtp_host
        auth.PMBI_SMTP_FROM = self.old_smtp_from
        auth.PMBI_MAIL_PROVIDER = self.old_mail_provider
        auth.PMBI_RESEND_API_KEY = self.old_resend_api_key
        auth.PMBI_RESEND_FROM = self.old_resend_from
        auth.send_password_reset_email = self.old_send_password_reset_email
        auth.AUTH_RATE_LIMITS.clear()
        self.tmp.cleanup()

    def open_test_db(self) -> sqlite3.Connection:
        auth.DATA_DIR.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(auth.DB_PATH, factory=ClosingConnection)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def create_schema(self) -> None:
        with auth.db() as con:
            con.executescript(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    login TEXT NOT NULL UNIQUE,
                    email TEXT,
                    phone TEXT,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    first_name TEXT,
                    last_name TEXT,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    avatar_url TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER
                );
                CREATE TABLE sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    user_agent TEXT,
                    ip TEXT
                );
                CREATE TABLE audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    entity TEXT,
                    entity_id INTEGER,
                    payload TEXT,
                    created_at INTEGER NOT NULL
                );
                """
            )

    def create_user(self, password: str = "old-pass-1") -> int:
        with auth.db() as con:
            cur = con.execute(
                """
                INSERT INTO users (login, email, password_hash, role, name, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                ("worker", "worker@example.com", auth.hash_password(password), "foreman", "Worker", auth.now_ts()),
            )
            con.commit()
            return int(cur.lastrowid)

    def create_session(self, user_id: int, token: str) -> None:
        with auth.db() as con:
            con.execute(
                """
                INSERT INTO sessions (user_id, token_hash, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, auth.token_hash(token), auth.now_ts(), auth.now_ts() + 3600),
            )
            con.commit()

    def user_row(self) -> sqlite3.Row:
        with auth.db() as con:
            return con.execute("SELECT * FROM users WHERE login = 'worker'").fetchone()

    def session_count(self) -> int:
        with auth.db() as con:
            return int(con.execute("SELECT COUNT(*) AS count FROM sessions").fetchone()["count"])

    def test_change_password_updates_hash_and_keeps_current_session(self) -> None:
        user_id = self.create_user()
        self.create_session(user_id, "current-token")
        self.create_session(user_id, "other-token")

        handler = FakeHandler(
            {"currentPassword": "old-pass-1", "newPassword": "new-pass-1"},
            token="current-token",
        )
        auth.api_change_password(handler)

        self.assertEqual(handler.status, HTTPStatus.OK)
        row = self.user_row()
        self.assertTrue(auth.verify_password("new-pass-1", row["password_hash"]))
        self.assertFalse(auth.verify_password("old-pass-1", row["password_hash"]))
        self.assertEqual(self.session_count(), 1)

    def test_change_password_rejects_bad_current_password(self) -> None:
        user_id = self.create_user()
        self.create_session(user_id, "current-token")

        handler = FakeHandler(
            {"currentPassword": "wrong-pass", "newPassword": "new-pass-1"},
            token="current-token",
        )
        auth.api_change_password(handler)

        self.assertEqual(handler.status, HTTPStatus.UNAUTHORIZED)
        row = self.user_row()
        self.assertTrue(auth.verify_password("old-pass-1", row["password_hash"]))

    def test_password_reset_sends_temporary_password_and_clears_sessions(self) -> None:
        user_id = self.create_user()
        self.create_session(user_id, "current-token")
        sent = {}

        def fake_send(email: str, login: str, temporary_password: str) -> None:
            sent.update({"email": email, "login": login, "password": temporary_password})

        auth.PMBI_SMTP_HOST = "smtp.example.com"
        auth.PMBI_SMTP_FROM = "robot@example.com"
        auth.send_password_reset_email = fake_send

        handler = FakeHandler({"email": "worker@example.com"})
        auth.api_request_password_reset(handler)

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertEqual(sent["email"], "worker@example.com")
        self.assertEqual(sent["login"], "worker")
        self.assertTrue(auth.verify_password(sent["password"], self.user_row()["password_hash"]))
        self.assertEqual(self.session_count(), 0)

    def test_password_reset_does_not_reveal_unknown_email(self) -> None:
        auth.PMBI_SMTP_HOST = "smtp.example.com"
        auth.PMBI_SMTP_FROM = "robot@example.com"
        handler = FakeHandler({"email": "unknown@example.com"})

        auth.api_request_password_reset(handler)

        self.assertEqual(handler.status, HTTPStatus.OK)
        self.assertTrue(handler.response["ok"])

    def test_password_reset_is_rate_limited_by_email(self) -> None:
        auth.PMBI_SMTP_HOST = "smtp.example.com"
        auth.PMBI_SMTP_FROM = "robot@example.com"
        for _ in range(auth.PASSWORD_RESET_EMAIL_LIMIT):
            handler = FakeHandler({"email": "unknown@example.com"})
            auth.api_request_password_reset(handler)
            self.assertEqual(handler.status, HTTPStatus.OK)

        handler = FakeHandler({"email": "unknown@example.com"})
        auth.api_request_password_reset(handler)

        self.assertEqual(handler.status, HTTPStatus.TOO_MANY_REQUESTS)

    def test_resend_provider_counts_as_configured(self) -> None:
        auth.PMBI_MAIL_PROVIDER = "resend"
        auth.PMBI_RESEND_API_KEY = "test-key"
        auth.PMBI_RESEND_FROM = "PM.bi <robot@example.com>"
        auth.PMBI_SMTP_HOST = ""
        auth.PMBI_SMTP_FROM = ""

        self.assertTrue(auth.mail_configured())

    def test_resend_sender_posts_email_payload(self) -> None:
        captured = {}
        old_urlopen = urllib.request.urlopen

        class FakeResponse:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback) -> bool:
                return False

        def fake_urlopen(request, timeout=0):
            captured["url"] = request.full_url
            captured["timeout"] = timeout
            captured["body"] = request.data.decode("utf-8")
            captured["auth"] = request.headers.get("Authorization")
            return FakeResponse()

        auth.PMBI_RESEND_API_KEY = "test-key"
        auth.PMBI_RESEND_FROM = "PM.bi <robot@example.com>"
        urllib.request.urlopen = fake_urlopen
        try:
            auth.send_password_reset_email_resend("worker@example.com", "worker", "TempPass123")
        finally:
            urllib.request.urlopen = old_urlopen

        self.assertEqual(captured["url"], "https://api.resend.com/emails")
        self.assertEqual(captured["timeout"], 20)
        self.assertIn("Bearer test-key", captured["auth"])
        self.assertIn("worker@example.com", captured["body"])
        self.assertIn("TempPass123", captured["body"])


if __name__ == "__main__":
    unittest.main()
