from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
import auth
import server


class AutoBotAccessTests(unittest.TestCase):
    def request(self, user, extra_headers=None, auth_error=None):
        handler = object.__new__(server.PMBIHandler)
        handler.headers = {'Host': 'crm.example', 'X-Forwarded-Proto': 'https', **(extra_headers or {})}
        handler.current_user = lambda: user
        handler._pmbi_clerk_auth_result = (user, auth_error)
        responses = []
        handler.send_json = lambda status, payload: responses.append((int(status), payload))
        with mock.patch.object(auth, 'current_user', return_value=user), mock.patch.object(auth, 'clerk_enabled', return_value=bool(auth_error)), mock.patch.object(auth, 'current_user_from_clerk', return_value=(user, auth_error)), mock.patch.object(server, 'PMBI_PUBLIC_BASE_URL', 'https://crm.example'):
            server.PMBIHandler.handle_api(handler, 'GET', '/api/autobot/access-check')
        return responses

    def test_anonymous_and_invalid_session_are_denied(self):
        self.assertEqual(self.request(None), [(401, {'error': 'auth_required'})])
        self.assertEqual(self.request(None, auth_error='clerk_token_invalid'), [(401, {'error': 'clerk_token_invalid'})])

    def test_existing_autobot_roles_keep_access_without_identity_in_response(self):
        for role in ('main_admin', 'admin', 'director', 'foreman'):
            with self.subTest(role=role):
                self.assertEqual(self.request({'id': 900, 'role': role, 'login': 'isolation-user'}), [(200, {'ok': True})])
        self.assertEqual(self.request({'id': 900, 'role': 'worker', 'roles': [{'code': 'foreman'}]}), [(200, {'ok': True})])

    def test_other_roles_cannot_use_direct_autobot_urls(self):
        for role in ('guest', 'customer', 'client', 'accountant', 'worker', 'supplier'):
            with self.subTest(role=role):
                result = self.request({'id': 900, 'role': role})
                self.assertEqual(result[0][0], 403)
                self.assertNotIn('id', result[0][1])

    def test_cross_site_headers_do_not_bypass_auth_via_get_subrequest(self):
        user = {'id': 900, 'role': 'admin'}
        for headers in ({'Origin': 'https://evil.example'}, {'Origin': 'null'}, {'Sec-Fetch-Site': 'cross-site'}):
            with self.subTest(headers=headers):
                self.assertEqual(self.request(user, headers), [(403, {'error': 'cross_site_request_forbidden'})])
        self.assertEqual(self.request(user, {'Origin': 'https://crm.example', 'Sec-Fetch-Site': 'same-origin'}), [(200, {'ok': True})])

    def test_access_route_is_exact_and_read_only(self):
        handler = object.__new__(server.PMBIHandler)
        calls, responses = [], []
        handler.api_autobot_access_check = lambda: calls.append('access')
        handler.send_json = lambda status, payload: responses.append(int(status))
        server.PMBIHandler.handle_api(handler, 'GET', '/api/autobot/access-check')
        server.PMBIHandler.handle_api(handler, 'POST', '/api/autobot/access-check')
        server.PMBIHandler.handle_api(handler, 'GET', '/api/autobot/access-check/anything')
        self.assertEqual(calls, ['access'])
        self.assertEqual(responses, [404, 404])


def load_installer():
    spec = importlib.util.spec_from_file_location('autobot_access_installer', ROOT / 'deploy/nginx/install_autobot_access.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AutoBotProxyInstallationTests(unittest.TestCase):
    def config(self):
        blocks = []
        for location in ('/autobot/', '/estimates', '/tenders', '/merge-report', '/research', '~ ^/api/(estimates|tender)', '= /static/embed_bridge.js'):
            blocks.append('location ' + location + ' {\n    proxy_pass http://127.0.0.1:8765;\n    proxy_set_header Host $host;\n}')
        return 'server {\nserver_name crm.example;\n' + '\n'.join(blocks) + '\n}\n'

    def test_private_routes_are_protected_once_and_other_directives_preserved(self):
        installer = load_installer()
        original = self.config()
        updated, protected = installer.protected_config(original)
        self.assertEqual(len(protected), 6)
        self.assertEqual(updated.count('include /opt/crm/deploy/nginx/autobot-protected.conf;'), 6)
        self.assertEqual(updated.count('include /opt/crm/deploy/nginx/autobot-access.conf;'), 1)
        self.assertEqual(updated.count('proxy_set_header Host $host;'), 7)
        second, _ = installer.protected_config(updated)
        self.assertEqual(updated, second)

    def test_unexpected_proxy_layout_requires_review(self):
        installer = load_installer()
        with self.assertRaisesRegex(ValueError, 'layout changed'):
            installer.protected_config('server { server_name crm.example; location / { proxy_pass http://elsewhere; } }')

    def test_braces_in_comments_and_quotes_do_not_end_location(self):
        installer = load_installer()
        original = self.config().replace('proxy_set_header Host $host;', 'proxy_set_header Host $host;\n# }\nproxy_set_header X-Test "{literal}";')
        _, protected = installer.protected_config(original)
        self.assertEqual(len(protected), 6)


if __name__ == '__main__':
    unittest.main()
