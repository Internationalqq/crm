from __future__ import annotations

import unittest
from unittest import mock

from test_http_static_delivery import StaticResponseHarness, server


class PresentationTests(unittest.TestCase):
    def test_public_presentation_needs_no_database_and_keeps_security_headers(self):
        with mock.patch.object(server, "db", side_effect=AssertionError("Presentation must not read CRM data")):
            for path in ("/presentation", "/presentation/", "/presentation?next=%3Cscript%3Euntrusted-query%3C/script%3E"):
                with self.subTest(path=path):
                    status, headers, body = StaticResponseHarness.request("GET", path)
                    self.assertEqual(status, 200)
                    self.assertIn("Стройка".encode(), body)
                    self.assertIn("Записи интерфейса сделаны на демонстрационных данных.".encode(), body)
                    self.assertNotIn(b"untrusted-query", body)
                    self.assertEqual(headers["Cache-Control"], "no-store")
                    self.assertEqual(headers["X-Frame-Options"], "DENY")
                    self.assertEqual(headers["X-Content-Type-Options"], "nosniff")

    def test_head_matches_get_without_body(self):
        get_status, get_headers, body = StaticResponseHarness.request("GET", "/presentation")
        head_status, head_headers, head_body = StaticResponseHarness.request("HEAD", "/presentation")
        self.assertEqual(head_status, get_status)
        self.assertEqual(head_headers, get_headers)
        self.assertEqual(head_body, b"")
        self.assertEqual(int(head_headers["Content-Length"]), len(body))

    def test_nearby_paths_do_not_become_public(self):
        for path in ("/presentation/private", "/presentation-admin", "/presentation.html"):
            with self.subTest(path=path):
                status, headers, body = StaticResponseHarness.request("GET", path)
                self.assertEqual(status, 302)
                self.assertTrue(headers["Location"].startswith("/login?next="))
                self.assertEqual(body, b"")


if __name__ == "__main__":
    unittest.main()
