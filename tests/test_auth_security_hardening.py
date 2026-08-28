from __future__ import annotations

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


class FakeHandler:
    def __init__(self, payload: dict | None = None, headers: dict | None = None):
        self.payload = payload or {}
        self.headers = headers or {}
        self.client_address = ("127.0.0.1", 42000)
        self.status = None
        self.response = None

    def read_json(self) -> dict:
        return self.payload

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload


class MissingUserConnection:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        return False

    def execute(self, _query: str, _parameters=()):
        return self

    def fetchone(self):
        return None


class FormItem:
    def __init__(self, value: str = "", *, filename: str = "", mime_type: str = ""):
        self.value = value
        self.filename = filename
        self.type = mime_type
        self.file = io.BytesIO(value.encode("utf-8"))


class AuthSecurityHardeningTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_trust_proxy_headers = auth.PMBI_TRUST_PROXY_HEADERS
        self.original_authorized_parties = auth.CLERK_AUTHORIZED_PARTIES
        self.original_clerk_enabled = auth.clerk_enabled
        self.original_jwt_decode = auth.jwt.decode
        self.original_db = auth.db
        self.original_avatars_dir = auth.AVATARS_DIR
        auth.AUTH_RATE_LIMITS.clear()

    def tearDown(self) -> None:
        auth.PMBI_TRUST_PROXY_HEADERS = self.original_trust_proxy_headers
        auth.CLERK_AUTHORIZED_PARTIES = self.original_authorized_parties
        auth.clerk_enabled = self.original_clerk_enabled
        auth.jwt.decode = self.original_jwt_decode
        auth.db = self.original_db
        auth.AVATARS_DIR = self.original_avatars_dir
        auth.AUTH_RATE_LIMITS.clear()

    def test_clerk_authorized_party_allows_missing_and_rejects_foreign_azp(self) -> None:
        auth.CLERK_AUTHORIZED_PARTIES = {"https://crm.example"}
        auth.clerk_enabled = lambda: True

        claims = {"sub": "user_1"}
        auth.jwt.decode = lambda *_args, **_kwargs: claims
        self.assertIs(auth.verify_clerk_session_token("token"), claims)

        claims = {"sub": "user_1", "azp": "https://evil.example"}
        auth.jwt.decode = lambda *_args, **_kwargs: claims
        self.assertIsNone(auth.verify_clerk_session_token("token"))

        claims = {"sub": "user_1", "azp": "https://crm.example/"}
        auth.jwt.decode = lambda *_args, **_kwargs: claims
        self.assertIs(auth.verify_clerk_session_token("token"), claims)

    def test_forwarded_client_ip_is_only_used_when_proxy_headers_are_trusted(self) -> None:
        handler = FakeHandler(headers={"X-Forwarded-For": "203.0.113.8, 10.0.0.2"})

        auth.PMBI_TRUST_PROXY_HEADERS = False
        self.assertEqual(auth.handler_client_ip(handler), "127.0.0.1")

        auth.PMBI_TRUST_PROXY_HEADERS = True
        self.assertEqual(auth.handler_client_ip(handler), "203.0.113.8")

    def test_login_is_rate_limited_by_account_even_if_forwarded_ip_changes(self) -> None:
        auth.PMBI_TRUST_PROXY_HEADERS = False
        auth.db = lambda: MissingUserConnection()
        for attempt in range(auth.LOGIN_ACCOUNT_ATTEMPT_LIMIT):
            handler = FakeHandler(
                {"login": "worker", "password": "wrong"},
                {"X-Forwarded-For": f"203.0.113.{attempt + 1}"},
            )
            auth.api_login(handler)
            self.assertEqual(handler.status, HTTPStatus.UNAUTHORIZED)

        blocked = FakeHandler(
            {"login": "worker", "password": "wrong"},
            {"X-Forwarded-For": "198.51.100.20"},
        )
        auth.api_login(blocked)

        self.assertEqual(blocked.status, HTTPStatus.TOO_MANY_REQUESTS)
        self.assertEqual(blocked.response, {"error": "too_many_login_attempts"})

    def test_multipart_login_rejects_avatar_before_authentication(self) -> None:
        handler = FakeHandler(headers={"Content-Type": "multipart/form-data; boundary=x"})
        handler.read_multipart = lambda: {
            "login": FormItem("worker"),
            "password": FormItem("secret"),
            "avatar": FormItem("not-an-image", filename="avatar.png", mime_type="image/png"),
        }

        auth.api_login(handler)

        self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(handler.response, {"error": "login_avatar_not_supported"})

    def test_avatar_upload_validates_real_image_content(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            auth.AVATARS_DIR = Path(temporary_directory)
            handler = FakeHandler()
            fake_image = FormItem(
                "<script>alert(1)</script>",
                filename="avatar.png",
                mime_type="image/png",
            )

            ok, url = auth.save_avatar_upload(handler, fake_image, 7)

            self.assertFalse(ok)
            self.assertIsNone(url)
            self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST)
            self.assertEqual(handler.response, {"error": "bad_avatar_image"})
            self.assertEqual(list(auth.AVATARS_DIR.iterdir()), [])

            image_bytes = io.BytesIO()
            Image.new("RGB", (2, 2), "white").save(image_bytes, format="PNG")
            valid_image = FormItem(filename="avatar.png", mime_type="image/png")
            valid_image.file = io.BytesIO(image_bytes.getvalue())

            ok, url = auth.save_avatar_upload(handler, valid_image, 7)

            self.assertTrue(ok)
            self.assertRegex(url or "", r"^/api/auth/avatar/user_7_.+\.png$")
            self.assertEqual(len(list(auth.AVATARS_DIR.iterdir())), 1)


if __name__ == "__main__":
    unittest.main()
