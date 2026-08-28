from __future__ import annotations

import sys
import unittest
from http import HTTPStatus
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import auth  # noqa: E402
import server  # noqa: E402


class AuthRequestCacheTests(unittest.TestCase):
    @staticmethod
    def _handler() -> tuple[server.PMBIHandler, list[tuple[int, dict]]]:
        handler = object.__new__(server.PMBIHandler)
        handler.headers = {"Authorization": "Bearer test-token"}
        responses: list[tuple[int, dict]] = []
        handler.send_json = lambda status, payload: responses.append((int(status), payload))
        return handler, responses

    def test_guest_gate_and_endpoint_share_one_clerk_lookup(self) -> None:
        handler, responses = self._handler()
        user = {"id": 7, "role": "admin", "roles": [], "permissions": {"fullAccess": True}}
        endpoint_users: list[dict | None] = []
        handler.api_projects = lambda: endpoint_users.append(handler.require_user())

        with (
            mock.patch.object(auth, "clerk_enabled", return_value=True),
            mock.patch.object(
                auth,
                "_resolve_current_user_from_clerk",
                return_value=(user, None),
            ) as resolve,
        ):
            server.PMBIHandler.handle_api(handler, "GET", "/api/projects")

        resolve.assert_called_once_with(handler)
        self.assertEqual(endpoint_users, [user])
        self.assertEqual(responses, [])

    def test_guest_restriction_still_runs_with_cached_identity(self) -> None:
        handler, responses = self._handler()
        guest = {"id": 11, "role": "guest", "roles": [], "permissions": {}}
        endpoint_calls: list[str] = []
        handler.api_users = lambda: endpoint_calls.append("users")

        with (
            mock.patch.object(auth, "clerk_enabled", return_value=True),
            mock.patch.object(
                auth,
                "_resolve_current_user_from_clerk",
                return_value=(guest, None),
            ) as resolve,
        ):
            server.PMBIHandler.handle_api(handler, "GET", "/api/users")

        resolve.assert_called_once_with(handler)
        self.assertEqual(endpoint_calls, [])
        self.assertEqual(
            responses,
            [(HTTPStatus.FORBIDDEN, {"error": "guest_forbidden"})],
        )

    def test_cached_clerk_error_is_preserved_for_require_user(self) -> None:
        handler, responses = self._handler()
        endpoint_users: list[dict | None] = []
        handler.api_projects = lambda: endpoint_users.append(handler.require_user())

        with (
            mock.patch.object(auth, "clerk_enabled", return_value=True),
            mock.patch.object(
                auth,
                "_resolve_current_user_from_clerk",
                return_value=(None, "bad_clerk_token"),
            ) as resolve,
        ):
            server.PMBIHandler.handle_api(handler, "GET", "/api/projects")

        resolve.assert_called_once_with(handler)
        self.assertEqual(endpoint_users, [None])
        self.assertEqual(
            responses,
            [(HTTPStatus.UNAUTHORIZED, {"error": "bad_clerk_token"})],
        )


if __name__ == "__main__":
    unittest.main()
