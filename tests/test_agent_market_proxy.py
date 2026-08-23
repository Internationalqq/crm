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

    def __init__(self, payload: dict) -> None:
        self.body = json.dumps(payload).encode("utf-8")
        self.headers = Message()
        self.headers["Content-Type"] = "application/json"

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _limit: int = -1) -> bytes:
        return self.body


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


if __name__ == "__main__":
    unittest.main()
