from __future__ import annotations

import gzip
import io
import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class StaticResponseHarness:
    @staticmethod
    def request(
        method: str,
        path: str,
        request_headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        handler = object.__new__(server.PMBIHandler)
        handler.command = method
        handler.path = path
        handler.headers = request_headers or {}
        handler.wfile = io.BytesIO()
        statuses: list[int] = []
        response_headers: dict[str, str] = {}
        handler.send_response = lambda status, message=None: statuses.append(int(status))
        handler.send_header = lambda name, value: response_headers.__setitem__(name, value)
        handler.end_headers = lambda: None
        handler.current_user = lambda: None

        if method == "HEAD":
            server.PMBIHandler.do_HEAD(handler)
        else:
            server.PMBIHandler.do_GET(handler)

        return statuses[-1], response_headers, handler.wfile.getvalue()


class HttpStaticDeliveryTests(unittest.TestCase):
    def test_head_root_matches_get_headers_and_has_no_body(self) -> None:
        get_status, get_headers, get_body = StaticResponseHarness.request("GET", "/")
        head_status, head_headers, head_body = StaticResponseHarness.request("HEAD", "/")

        self.assertEqual(head_status, get_status)
        self.assertEqual(head_status, 200)
        self.assertTrue(get_body)
        self.assertEqual(head_body, b"")
        self.assertEqual(head_headers["Content-Length"], get_headers["Content-Length"])
        self.assertEqual(head_headers["Content-Type"], "text/html; charset=utf-8")
        self.assertEqual(head_headers["Cache-Control"], "no-store")
        self.assertEqual(head_headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(head_headers["X-Frame-Options"], "DENY")
        self.assertEqual(
            head_headers["Content-Security-Policy"],
            "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
        )
        self.assertEqual(head_headers["Referrer-Policy"], "no-referrer")

    def test_versioned_asset_is_immutable_but_unversioned_asset_revalidates(self) -> None:
        _, versioned_headers, _ = StaticResponseHarness.request(
            "GET", "/assets/js/app.js?v=build-42"
        )
        _, unversioned_headers, _ = StaticResponseHarness.request(
            "GET", "/assets/js/app.js"
        )

        self.assertEqual(
            versioned_headers["Cache-Control"],
            "public, max-age=31536000, immutable",
        )
        self.assertEqual(unversioned_headers["Cache-Control"], "no-cache")
        self.assertEqual(versioned_headers["X-Content-Type-Options"], "nosniff")

    def test_gzip_text_asset_and_head_have_correct_content_length(self) -> None:
        request_headers = {"Accept-Encoding": "br, gzip;q=1"}
        get_status, get_headers, get_body = StaticResponseHarness.request(
            "GET", "/assets/js/app.js?v=gzip-test", request_headers
        )
        head_status, head_headers, head_body = StaticResponseHarness.request(
            "HEAD", "/assets/js/app.js?v=gzip-test", request_headers
        )

        self.assertEqual(get_status, 200)
        self.assertEqual(head_status, 200)
        self.assertEqual(get_headers["Content-Encoding"], "gzip")
        self.assertEqual(get_headers["Vary"], "Accept-Encoding")
        self.assertEqual(int(get_headers["Content-Length"]), len(get_body))
        self.assertEqual(head_headers["Content-Length"], get_headers["Content-Length"])
        self.assertEqual(head_headers["Content-Encoding"], "gzip")
        self.assertEqual(head_body, b"")
        self.assertEqual(
            gzip.decompress(get_body),
            (server.FRONTEND_ASSETS / "js" / "app.js").read_bytes(),
        )

    def test_explicit_gzip_rejection_overrides_wildcard(self) -> None:
        _, headers, body = StaticResponseHarness.request(
            "GET",
            "/assets/js/app.js?v=identity-test",
            {"Accept-Encoding": "gzip;q=0, *;q=1"},
        )

        self.assertNotIn("Content-Encoding", headers)
        self.assertEqual(
            body,
            (server.FRONTEND_ASSETS / "js" / "app.js").read_bytes(),
        )


if __name__ == "__main__":
    unittest.main()
