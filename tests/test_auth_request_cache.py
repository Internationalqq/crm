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

    def test_anonymous_public_read_does_not_grant_subsequent_write_access(self) -> None:
        handler, responses = self._handler()
        handler.headers = {}
        endpoint_users = []
        handler.api_projects = lambda: endpoint_users.append(handler.require_user())
        handler.api_create_project = lambda: endpoint_users.append(handler.require_user())
        with mock.patch.object(auth, 'clerk_enabled', return_value=False):
            server.PMBIHandler.handle_api(handler, 'GET', '/api/projects')
            server.PMBIHandler.handle_api(handler, 'POST', '/api/projects')
        self.assertTrue(auth.user_is_public_viewer(endpoint_users[0]))
        self.assertIsNone(endpoint_users[1])
        self.assertEqual(responses, [(HTTPStatus.UNAUTHORIZED, {'error': 'auth_required'})])

    def test_unprovisioned_clerk_account_cannot_fall_back_to_public_profile(self) -> None:
        handler, responses = self._handler()
        with (
            mock.patch.object(auth, 'clerk_enabled', return_value=True),
            mock.patch.object(auth, '_resolve_current_user_from_clerk',
                              return_value=(None, 'clerk_user_not_provisioned')) as resolve,
        ):
            server.PMBIHandler.handle_api(handler, 'GET', '/api/auth/me')
        resolve.assert_called_once_with(handler)
        self.assertEqual(responses, [(HTTPStatus.FORBIDDEN, {'error': 'clerk_user_not_provisioned'})])

    def test_public_route_policy_is_exact_and_read_only(self) -> None:
        for path in ('/api/auth/me', '/api/projects', '/api/projects/1',
                     '/api/projects/1/daily-logs', '/api/projects/1/production-schedule', '/api/documents/2/view'):
            with self.subTest(path=path):
                self.assertTrue(auth.public_api_allowed('GET', path))
                self.assertFalse(auth.public_api_allowed('POST', path))
                self.assertFalse(auth.public_api_allowed('DELETE', path))
        for path in ('/api/users', '/api/dashboard', '/api/projects/1/finance',
                     '/api/projects/1/daily-logs/delete', '/api/documents/2/download'):
            self.assertFalse(auth.public_api_allowed('GET', path))


if __name__ == "__main__":
    unittest.main()
