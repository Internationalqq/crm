from __future__ import annotations

import io
import json
import sys
import unittest
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class HeaderBag(dict):
    def __init__(self, *args, content_lengths: list[str] | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.content_lengths = content_lengths

    def get_all(self, name: str):
        if name.lower() == "content-length" and self.content_lengths is not None:
            return self.content_lengths
        value = self.get(name)
        return [value] if value is not None else None


class RequestBodyHandler:
    def __init__(self, headers: dict[str, str], body: bytes = b""):
        self.headers = HeaderBag(headers)
        self.rfile = io.BytesIO(body)

    def request_content_length(self, maximum: int) -> int:
        return server.PMBIHandler.request_content_length(self, maximum)


class DispatchHandler:
    def __init__(self, headers: dict[str, str]):
        self.headers = HeaderBag(headers)
        self.status = None
        self.response = None
        self.login_called = False

    def send_json(self, status: int, payload: dict) -> None:
        self.status = status
        self.response = payload

    def current_user(self):
        return None

    def api_login(self) -> None:
        self.login_called = True


class BodyDispatchHandler(DispatchHandler):
    def __init__(self, headers: dict[str, str], body: bytes = b""):
        super().__init__(headers)
        self.rfile = io.BytesIO(body)

    def request_content_length(self, maximum: int) -> int:
        return server.PMBIHandler.request_content_length(self, maximum)

    def api_login(self) -> None:
        server.PMBIHandler.read_json(self)


class HttpRequestSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_public_base_url = server.PMBI_PUBLIC_BASE_URL
        self.original_trust_proxy_headers = server.PMBI_TRUST_PROXY_HEADERS
        server.PMBI_PUBLIC_BASE_URL = "https://crm.example"
        server.PMBI_TRUST_PROXY_HEADERS = False

    def tearDown(self) -> None:
        server.PMBI_PUBLIC_BASE_URL = self.original_public_base_url
        server.PMBI_TRUST_PROXY_HEADERS = self.original_trust_proxy_headers

    def test_cross_site_write_detection_uses_fetch_metadata_and_origin(self) -> None:
        self.assertTrue(
            server.request_is_cross_site_mutation(
                "POST",
                HeaderBag({"Host": "crm.example", "Sec-Fetch-Site": "cross-site"}),
            )
        )
        self.assertTrue(
            server.request_is_cross_site_mutation(
                "POST",
                HeaderBag({"Host": "crm.example", "Origin": "https://evil.example"}),
            )
        )
        self.assertTrue(
            server.request_is_cross_site_mutation(
                "POST", HeaderBag({"Host": "crm.example", "Origin": "null"})
            )
        )
        self.assertFalse(
            server.request_is_cross_site_mutation(
                "POST",
                HeaderBag({"Host": "crm.example:443", "Origin": "https://crm.example"}),
            )
        )
        self.assertTrue(
            server.request_is_cross_site_mutation(
                "POST",
                HeaderBag({"Host": "crm.example", "Origin": "http://crm.example"}),
            )
        )
        self.assertFalse(server.request_is_cross_site_mutation("POST", HeaderBag({})))
        self.assertFalse(
            server.request_is_cross_site_mutation(
                "GET", HeaderBag({"Host": "crm.example", "Origin": "https://evil.example"})
            )
        )

    def test_handle_api_blocks_cross_site_request_before_dispatch(self) -> None:
        handler = DispatchHandler(
            {
                "Host": "crm.example",
                "Origin": "https://evil.example",
                "Sec-Fetch-Site": "cross-site",
            }
        )

        server.PMBIHandler.handle_api(handler, "POST", "/api/auth/login")

        self.assertEqual(handler.status, HTTPStatus.FORBIDDEN)
        self.assertEqual(handler.response, {"error": "cross_site_request_forbidden"})
        self.assertFalse(handler.login_called)

    def test_same_origin_and_non_browser_requests_keep_dispatching(self) -> None:
        for headers in (
            {"Host": "crm.example", "Origin": "https://crm.example"},
            {},
        ):
            with self.subTest(headers=headers):
                handler = DispatchHandler(headers)
                server.PMBIHandler.handle_api(handler, "POST", "/api/auth/login")
                self.assertTrue(handler.login_called)

    def test_origin_parser_handles_ipv6_malformed_values_and_trusted_proxy(self) -> None:
        server.PMBI_PUBLIC_BASE_URL = "http://[::1]:8080"
        self.assertFalse(
            server.request_is_cross_site_mutation(
                "POST",
                HeaderBag({"Host": "[::1]:8080", "Origin": "http://[::1]:8080"}),
            )
        )
        self.assertTrue(
            server.request_is_cross_site_mutation(
                "POST", HeaderBag({"Host": "[::1", "Origin": "http://[::1]:8080"})
            )
        )
        self.assertTrue(
            server.request_is_cross_site_mutation(
                "POST", HeaderBag({"Host": "[::1]:8080", "Origin": "http://[::1"})
            )
        )
        self.assertTrue(
            server.request_is_cross_site_mutation(
                "POST",
                HeaderBag({"Host": "[::1]:8080", "Origin": "http://[::1]:8080/path"}),
            )
        )

        server.PMBI_PUBLIC_BASE_URL = ""
        server.PMBI_TRUST_PROXY_HEADERS = True
        proxy_headers = {
            "Host": "crm.example:443",
            "X-Forwarded-Proto": "https",
            "Origin": "https://crm.example",
        }
        self.assertFalse(
            server.request_is_cross_site_mutation("POST", HeaderBag(proxy_headers))
        )
        proxy_headers["Origin"] = "http://crm.example"
        self.assertTrue(
            server.request_is_cross_site_mutation("POST", HeaderBag(proxy_headers))
        )

        server.PMBI_TRUST_PROXY_HEADERS = False
        self.assertFalse(
            server.request_is_cross_site_mutation(
                "POST",
                HeaderBag({"Host": "crm.example:80", "Origin": "http://crm.example"}),
            )
        )

    def test_negative_duplicate_and_chunked_lengths_are_rejected(self) -> None:
        negative = RequestBodyHandler({"Content-Length": "-1"})
        with self.assertRaisesRegex(ValueError, "invalid_content_length"):
            server.PMBIHandler.request_content_length(negative, 1024)

        duplicate = RequestBodyHandler({"Content-Length": "5"})
        duplicate.headers = HeaderBag(
            {"Content-Length": "5"}, content_lengths=["5", "5"]
        )
        with self.assertRaisesRegex(ValueError, "invalid_content_length"):
            server.PMBIHandler.request_content_length(duplicate, 1024)

        chunked = RequestBodyHandler({"Transfer-Encoding": "chunked"})
        with self.assertRaisesRegex(ValueError, "unsupported_transfer_encoding"):
            server.PMBIHandler.request_content_length(chunked, 1024)

    def test_invalid_content_length_is_reported_as_bad_request_by_dispatch(self) -> None:
        handler = BodyDispatchHandler({"Content-Length": "-1"})

        server.PMBIHandler.handle_api(handler, "POST", "/api/auth/login")

        self.assertEqual(handler.status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(handler.response, {"error": "invalid_content_length"})

    def test_json_body_must_be_utf8_object_within_limit(self) -> None:
        array_body = json.dumps([1, 2]).encode("utf-8")
        array_handler = RequestBodyHandler(
            {"Content-Length": str(len(array_body))}, array_body
        )
        with self.assertRaisesRegex(ValueError, "json_object_required"):
            server.PMBIHandler.read_json(array_handler)

        invalid_utf8 = b"\xff"
        encoding_handler = RequestBodyHandler({"Content-Length": "1"}, invalid_utf8)
        with self.assertRaisesRegex(ValueError, "invalid_json_encoding"):
            server.PMBIHandler.read_json(encoding_handler)

        too_large = RequestBodyHandler({"Content-Length": str(1024 * 1024 + 1)})
        with self.assertRaisesRegex(ValueError, "Payload too large"):
            server.PMBIHandler.read_json(too_large)

        for invalid_number in (b'{"amount": NaN}', b'{"amount": Infinity}', b'{"amount": -Infinity}'):
            with self.subTest(invalid_number=invalid_number):
                number_handler = RequestBodyHandler(
                    {"Content-Length": str(len(invalid_number))}, invalid_number
                )
                with self.assertRaisesRegex(ValueError, "invalid_json_number"):
                    server.PMBIHandler.read_json(number_handler)


if __name__ == "__main__":
    unittest.main()
