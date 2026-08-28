from __future__ import annotations

import io
import json
import sys
import unittest
import urllib.error
from email.message import Message
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class _Response:
    status = 200

    def __init__(self, payload: dict | bytes) -> None:
        self.body = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        self.headers = Message()
        self.headers["Content-Type"] = "application/json"

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, limit: int = -1) -> bytes:
        return self.body if limit < 0 else self.body[:limit]


class AgentMarketProxyTests(unittest.TestCase):
    def make_handler(self, *, body: bytes = b"", authorization: str = ""):
        handler = object.__new__(server.PMBIHandler)
        handler.headers = Message()
        handler.headers["Content-Length"] = str(len(body))
        handler.headers["Content-Type"] = "application/json"
        if authorization:
            handler.headers["Authorization"] = authorization
        handler.rfile = io.BytesIO(body)
        handler.wfile = io.BytesIO()
        handler.response_status = None
        handler.response_headers = {}
        handler.send_response = lambda status: setattr(handler, "response_status", int(status))
        handler.send_header = lambda name, value: handler.response_headers.__setitem__(name, value)
        handler.end_headers = lambda: None
        return handler

    def test_route_allowlist_is_narrow(self) -> None:
        self.assertTrue(server.is_agent_market_proxy_route("GET", "/api/agent-market/v1/status"))
        self.assertTrue(server.is_agent_market_proxy_route("POST", "/api/agent-market/v1/claim"))
        self.assertTrue(
            server.is_agent_market_proxy_route(
                "POST", "/api/agent-market/v1/jobs/0123456789abcdef0123456789abcdef/complete"
            )
        )
        self.assertFalse(server.is_agent_market_proxy_route("GET", "/api/agent-market/v1/claim"))
        self.assertFalse(server.is_agent_market_proxy_route("POST", "/api/tenders/1/delete"))

    @patch("server.urllib.request.urlopen")
    def test_proxy_forwards_bearer_token_and_json(self, urlopen) -> None:
        urlopen.return_value = _Response({"ok": True, "job": None})
        body = json.dumps({"worker_id": "mac-mini"}).encode("utf-8")
        handler = self.make_handler(body=body, authorization="Bearer secret")

        handler.proxy_agent_market_request("POST", "/api/agent-market/v1/claim")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "http://autobot:8765/api/agent-market/v1/claim")
        self.assertEqual(request.get_header("Authorization"), "Bearer secret")
        self.assertEqual(request.data, body)
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 35)
        self.assertEqual(handler.response_status, 200)
        self.assertEqual(json.loads(handler.wfile.getvalue()), {"ok": True, "job": None})

    @patch("server.urllib.request.urlopen")
    def test_proxy_preserves_autobot_unauthorized_response(self, urlopen) -> None:
        headers = Message()
        headers["Content-Type"] = "application/json"
        urlopen.side_effect = urllib.error.HTTPError(
            "http://autobot:8765/api/agent-market/v1/status",
            401,
            "Unauthorized",
            headers,
            io.BytesIO(b'{"ok":false,"message":"bad token"}'),
        )
        handler = self.make_handler()

        handler.proxy_agent_market_request("GET", "/api/agent-market/v1/status")

        self.assertEqual(handler.response_status, 401)
        self.assertEqual(json.loads(handler.wfile.getvalue())["message"], "bad token")

    @patch("server.urllib.request.urlopen")
    def test_proxy_rejects_malformed_content_length_without_contacting_autobot(self, urlopen) -> None:
        handler = self.make_handler()
        handler.headers.replace_header("Content-Length", "not-a-number")

        handler.proxy_agent_market_request("POST", "/api/agent-market/v1/claim")

        urlopen.assert_not_called()
        self.assertEqual(handler.response_status, 400)
        self.assertEqual(json.loads(handler.wfile.getvalue())["error"], "invalid_content_length")

    @patch("server.urllib.request.urlopen")
    def test_proxy_rejects_oversized_upstream_response_instead_of_truncating_json(self, urlopen) -> None:
        urlopen.return_value = _Response(b"x" * (2 * 1024 * 1024 + 1))
        handler = self.make_handler()

        handler.proxy_agent_market_request("GET", "/api/agent-market/v1/status")

        self.assertEqual(handler.response_status, 502)
        self.assertEqual(json.loads(handler.wfile.getvalue())["error"], "autobot_response_too_large")

    @patch("server.urllib.request.urlopen", side_effect=TimeoutError("internal details"))
    def test_proxy_returns_stable_error_code_when_autobot_times_out(self, _urlopen) -> None:
        handler = self.make_handler()

        handler.proxy_agent_market_request("GET", "/api/agent-market/v1/status")

        self.assertEqual(handler.response_status, 503)
        payload = json.loads(handler.wfile.getvalue())
        self.assertEqual(payload["error"], "autobot_unavailable")
        self.assertNotIn("TimeoutError", handler.wfile.getvalue().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
