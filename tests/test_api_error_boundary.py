from __future__ import annotations

import io
import sys
import unittest
from contextlib import redirect_stderr
from http import HTTPStatus
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class ApiErrorBoundaryTests(unittest.TestCase):
    def test_unhandled_exception_details_are_not_returned_to_client(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        responses: list[tuple[int, dict]] = []
        handler.api_projects = lambda: (_ for _ in ()).throw(
            RuntimeError("secret-db-path C:/private/pmbi.sqlite3")
        )
        handler.send_json = lambda status, payload: responses.append((int(status), payload))

        with redirect_stderr(io.StringIO()):
            server.PMBIHandler.handle_api(handler, "GET", "/api/projects")

        self.assertEqual(
            responses,
            [(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "server_error"})],
        )
        self.assertNotIn("secret-db-path", repr(responses))


if __name__ == "__main__":
    unittest.main()
