from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from test_http_static_delivery import StaticResponseHarness, server


class HttpVideoDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.assets = Path(self.directory.name)
        self.content = bytes(range(256)) * 600
        (self.assets / "film.mp4").write_bytes(self.content)
        (self.assets / "empty.mp4").write_bytes(b"")
        patch = mock.patch.object(server, "FRONTEND_ASSETS", self.assets)
        patch.start()
        self.addCleanup(patch.stop)

    def get(self, range_value=None, method="GET", **headers):
        if range_value is not None:
            headers["Range"] = range_value
        return StaticResponseHarness.request(method, "/assets/film.mp4?v=film-1", headers)

    def test_full_video_is_streamed_without_compression_and_keeps_cache_policy(self):
        status, headers, body = self.get(**{"Accept-Encoding": "gzip"})
        self.assertEqual(status, 200)
        self.assertEqual(body, self.content)
        self.assertEqual(headers["Content-Length"], str(len(self.content)))
        self.assertEqual(headers["Content-Type"], "video/mp4")
        self.assertEqual(headers["Accept-Ranges"], "bytes")
        self.assertEqual(headers["Cache-Control"], "public, max-age=31536000, immutable")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertNotIn("Content-Encoding", headers)
        _, unversioned, _ = StaticResponseHarness.request("GET", "/assets/film.mp4")
        self.assertEqual(unversioned["Cache-Control"], "no-cache")

    def test_prefix_middle_open_ended_and_suffix_ranges(self):
        size = len(self.content)
        for requested, start, end in (
            ("bytes=0-1", 0, 1),
            ("bytes=65000-66000", 65000, 66000),
            ("bytes=100-", 100, size - 1),
            ("bytes=-512", size - 512, size - 1),
            ("bytes=150000-999999", 150000, size - 1),
            ("bytes=-999999", 0, size - 1),
        ):
            with self.subTest(requested=requested):
                status, headers, body = self.get(requested)
                self.assertEqual(status, 206)
                self.assertEqual(body, self.content[start:end + 1])
                self.assertEqual(headers["Content-Range"], f"bytes {start}-{end}/{size}")
                self.assertEqual(int(headers["Content-Length"]), len(body))

    def test_unsatisfiable_ranges_return_empty_416_and_file_size(self):
        for requested in ("bytes=999999-", "bytes=-0", "bytes=5-3", "bytes=" + "9" * 100 + "-"):
            with self.subTest(requested=requested):
                status, headers, body = self.get(requested)
                self.assertEqual(status, 416)
                self.assertEqual(headers["Content-Range"], f"bytes */{len(self.content)}")
                self.assertEqual(headers["Content-Length"], "0")
                self.assertEqual(body, b"")

    def test_unsupported_or_malformed_range_falls_back_to_full_file(self):
        for requested in ("bytes=", "bytes=-", "seconds=0-1", "bytes=0-1,10-11", "bytes=abc-def", "bytes=" + "9" * 5000 + "-"):
            with self.subTest(requested=requested[:50]):
                status, headers, body = self.get(requested)
                self.assertEqual(status, 200)
                self.assertNotIn("Content-Range", headers)
                self.assertEqual(body, self.content)

    def test_head_ignores_ranges_has_full_headers_and_no_body(self):
        for requested in (None, "bytes=0-1", "bytes=999999-"):
            with self.subTest(requested=requested):
                status, headers, body = self.get(requested, method="HEAD")
                self.assertEqual(status, 200)
                self.assertEqual(headers["Content-Length"], str(len(self.content)))
                self.assertNotIn("Content-Range", headers)
                self.assertEqual(body, b"")

    def test_unverifiable_if_range_returns_full_file(self):
        status, headers, body = self.get("bytes=0-1", **{"If-Range": '"old-version"'})
        self.assertEqual(status, 200)
        self.assertNotIn("Content-Range", headers)
        self.assertEqual(body, self.content)

    def test_empty_media_and_missing_asset(self):
        status, headers, body = StaticResponseHarness.request("GET", "/assets/empty.mp4")
        self.assertEqual((status, body), (200, b""))
        self.assertEqual(headers["Content-Length"], "0")
        status, headers, body = StaticResponseHarness.request("GET", "/assets/empty.mp4", {"Range": "bytes=0-"})
        self.assertEqual((status, body), (416, b""))
        self.assertEqual(headers["Content-Range"], "bytes */0")
        status, _, _ = StaticResponseHarness.request("GET", "/assets/missing.mp4")
        self.assertEqual(status, 404)

    def test_range_does_not_bypass_asset_path_boundary(self):
        status, _, _ = StaticResponseHarness.request("GET", "/assets/../secret.mp4", {"Range": "bytes=0-1"})
        self.assertIn(status, (403, 404))


if __name__ == "__main__":
    unittest.main()
