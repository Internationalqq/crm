from __future__ import annotations

import io
import json
import sys
import unittest
import urllib.error
from http import HTTPStatus
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class _UpstreamResponse:
    def __init__(self, status: int = 200):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


class AutoBotHealthProxyTests(unittest.TestCase):
    @staticmethod
    def _handler(user: dict | None = None):
        handler = object.__new__(server.PMBIHandler)
        responses: list[tuple[int, dict]] = []
        handler.require_user = lambda: user
        handler.send_json = lambda status, payload: responses.append((int(status), payload))
        return handler, responses

    def test_route_is_exact(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        calls: list[str] = []
        responses: list[tuple[int, dict]] = []
        handler.api_autobot_health = lambda: calls.append("health")
        handler.send_json = lambda status, payload: responses.append((int(status), payload))

        server.PMBIHandler.handle_api(handler, "GET", "/api/autobot/health")
        server.PMBIHandler.handle_api(handler, "GET", "/api/autobot/health/internal")

        self.assertEqual(calls, ["health"])
        self.assertEqual(responses[-1], (HTTPStatus.NOT_FOUND, {"error": "not_found"}))

    def test_unauthenticated_request_never_contacts_internal_service(self) -> None:
        handler, responses = self._handler(None)
        with mock.patch.object(server.urllib.request, "urlopen") as urlopen:
            server.PMBIHandler.api_autobot_health(handler)

        urlopen.assert_not_called()
        self.assertEqual(responses, [])

    def test_success_is_normalized_and_uses_short_internal_timeout(self) -> None:
        handler, responses = self._handler({"id": 7, "role": "admin"})
        with (
            mock.patch.object(server, "PMBI_AUTOBOT_INTERNAL_URL", "http://autobot-internal:8765"),
            mock.patch.object(
                server.urllib.request,
                "urlopen",
                return_value=_UpstreamResponse(200),
            ) as urlopen,
        ):
            server.PMBIHandler.api_autobot_health(handler)

        self.assertEqual(responses, [(HTTPStatus.OK, {"ok": True})])
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "http://autobot-internal:8765/healthz")
        self.assertEqual(request.get_method(), "GET")
        self.assertLessEqual(urlopen.call_args.kwargs["timeout"], 2.0)

    def test_network_error_returns_safe_503_without_internal_details(self) -> None:
        handler, responses = self._handler({"id": 7, "role": "admin"})
        internal_url = "http://secret-autobot-host:8765"
        with (
            mock.patch.object(server, "PMBI_AUTOBOT_INTERNAL_URL", internal_url),
            mock.patch.object(
                server.urllib.request,
                "urlopen",
                side_effect=urllib.error.URLError("connection refused at secret-autobot-host"),
            ),
        ):
            server.PMBIHandler.api_autobot_health(handler)

        self.assertEqual(
            responses,
            [(HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False, "error": "autobot_unavailable"})],
        )
        self.assertNotIn("secret-autobot-host", json.dumps(responses))

    def test_json_responses_are_no_store_and_nosniff(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        handler.command = "GET"
        handler.wfile = io.BytesIO()
        handler.current_user = lambda: {"id": 7, "role": "admin"}
        statuses: list[int] = []
        headers: dict[str, str] = {}
        handler.send_response = lambda status, message=None: statuses.append(int(status))
        handler.send_header = lambda name, value: headers.__setitem__(name, value)
        handler.end_headers = lambda: None

        server.PMBIHandler.send_json(handler, HTTPStatus.OK, {"ok": True})

        self.assertEqual(statuses, [HTTPStatus.OK])
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertEqual(json.loads(handler.wfile.getvalue()), {"ok": True})


if __name__ == "__main__":
    unittest.main()
