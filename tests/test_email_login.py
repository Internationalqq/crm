"""Exercise email authentication against a temporary database, never send mail."""
import io
import json
import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import auth
import email_login
import test_auth_passwords as fixtures


class Handler(fixtures.FakeHandler):
    def __init__(self, payload):
        super().__init__(payload)
        self.wfile = io.BytesIO()
        self.output_headers = {}

    def send_response(self, status): self.status = status
    def send_header(self, key, value): self.output_headers[key] = value
    def end_headers(self): pass


class EmailLoginTests(unittest.TestCase):
    open_test_db = fixtures.AuthPasswordTests.open_test_db
    create_schema = fixtures.AuthPasswordTests.create_schema
    create_user = fixtures.AuthPasswordTests.create_user

    def setUp(self):
        fixtures.AuthPasswordTests.setUp(self)
        self.timestamp = 1700000000
        self.mail = []
        self._real_send_code = email_login.send_code
        for target, replacement in [
            ('auth.mail_configured', lambda: True),
            ('auth.clerk_enabled', lambda: False),
            ('auth.now_ts', lambda: self.timestamp),
            ('email_login.secrets.randbelow', lambda _: 123),
            ('email_login.send_code', lambda email, code: self.mail.append((email, code))),
        ]:
            patcher = patch(target, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.user_id = self.create_user()

    def tearDown(self): fixtures.AuthPasswordTests.tearDown(self)

    def request(self, email='worker@example.com', status=202):
        handler = Handler({'email': email})
        email_login.request_code(handler)
        self.assertEqual(handler.status, status, handler.response)
        return handler.response

    def verify(self, challenge, code='000123'):
        handler = Handler({'challenge': challenge, 'code': code})
        email_login.verify_code(handler)
        return handler

    def change_user(self, sql):
        with auth.db() as con: con.execute(sql, (self.user_id,))

    def test_success_leading_zero_role_secure_cookie_and_replay(self):
        data = self.request(' Worker@Example.COM ')
        self.assertEqual(self.mail, [('worker@example.com', '000123')])
        with auth.db() as con:
            row = con.execute('SELECT * FROM email_login_challenges').fetchone()
            self.assertNotIn('000123', (row['code_hash'], row['challenge_hash']))
            self.assertNotEqual(row['challenge_hash'], data['challenge'])
        with patch('auth.PMBI_FORCE_SECURE_COOKIES', True):
            handler = self.verify(data['challenge'])
        self.assertEqual(handler.status, 200)
        user = json.loads(handler.wfile.getvalue())['user']
        self.assertEqual(user['id'], self.user_id)
        self.assertEqual(user['role'], 'foreman')
        cookie = handler.output_headers['Set-Cookie']
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=Lax', cookie)
        self.assertIn('Secure', cookie)
        self.assertEqual(self.verify(data['challenge']).status, 401)
        with auth.db() as con:
            self.assertEqual(con.execute('SELECT count(*) FROM sessions').fetchone()[0], 1)
            self.assertEqual(con.execute('SELECT count(*) FROM users').fetchone()[0], 1)

    def test_parallel_redemption_only_one_session(self):
        challenge = self.request()['challenge']
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda _: self.verify(challenge).status, range(2)))
        self.assertEqual(sorted(statuses), [200, 401])

    def test_parallel_requests_only_one_delivery(self):
        def request(_):
            handler = Handler({'email': 'worker@example.com'})
            email_login.request_code(handler)
            return handler.status
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(request, range(2)))
        self.assertEqual(sorted(statuses), [202, 429])
        self.assertEqual(len(self.mail), 1)

    def test_duplicate_created_after_send_denies_login(self):
        challenge = self.request()['challenge']
        with auth.db() as con:
            con.execute("INSERT INTO users(login,email,password_hash,role,name,created_at) VALUES ('duplicate','worker@example.com','unused','admin','Duplicate',?)", (self.timestamp,))
        self.assertEqual(self.verify(challenge).status, 401)

    def test_transport_carries_code_in_html_and_text_not_subject(self):
        with patch('auth.send_email') as transport:
            # Call the real formatter while leaving all external transports mocked.
            self._real_send_code('worker@example.com', '000123')
        email, subject, text, html = transport.call_args.args
        self.assertEqual(email, 'worker@example.com')
        self.assertNotIn('000123', subject)
        self.assertIn('000123', text)
        self.assertIn('000123', html)

    def test_resend_60_seconds_uses_database_invalidates_previous(self):
        first = self.request()
        auth.AUTH_RATE_LIMITS.clear()
        limited = self.request(status=429)
        self.assertEqual(limited['retryAfter'], 60)
        self.timestamp += 59
        self.assertEqual(self.request(status=429)['retryAfter'], 1)
        self.timestamp += 1
        second = self.request()
        self.assertEqual(self.verify(first['challenge']).status, 401)
        self.assertEqual(self.verify(second['challenge']).status, 200)

    def test_expiry_boundary(self):
        challenge = self.request()['challenge']
        self.timestamp += 600
        self.assertEqual(self.verify(challenge).status, 410)

    def test_five_guesses_lock_even_if_next_code_correct(self):
        challenge = self.request()['challenge']
        for _ in range(4): self.assertEqual(self.verify(challenge, '999999').status, 401)
        self.assertEqual(self.verify(challenge, '999999').status, 429)
        self.assertEqual(self.verify(challenge).status, 401)

    def test_unknown_and_duplicate_email_do_not_send_or_create_account(self):
        unknown = self.request('absent@example.com')
        self.assertEqual(self.mail, [])
        self.assertEqual(self.verify(unknown['challenge']).status, 401)
        with auth.db() as con:
            con.execute("INSERT INTO users(login,email,password_hash,role,name,created_at) VALUES ('duplicate','worker@example.com','unused','admin','Duplicate',?)", (self.timestamp,))
        duplicate = self.request()
        self.assertEqual(self.mail, [])
        self.assertEqual(self.verify(duplicate['challenge']).status, 401)
        self.assertEqual(unknown.keys(), duplicate.keys())
        self.assertEqual(unknown['message'], duplicate['message'])

    def test_account_deactivated_after_send(self):
        challenge = self.request()['challenge']
        self.change_user('UPDATE users SET is_active=0 WHERE id=?')
        self.assertEqual(self.verify(challenge).status, 401)

    def test_email_changed_after_send(self):
        challenge = self.request()['challenge']
        self.change_user("UPDATE users SET email='different@example.com' WHERE id=?")
        self.assertEqual(self.verify(challenge).status, 401)

    def test_failed_delivery_generic_response_and_no_valid_code(self):
        with patch('email_login.send_code', side_effect=RuntimeError('private transport error')):
            data = self.request()
        self.assertEqual(self.verify(data['challenge']).status, 401)
        self.assertNotIn('private', json.dumps(data))
        with auth.db() as con:
            self.assertEqual(con.execute('SELECT action FROM audit_log').fetchone()[0], 'email_login_delivery_failed')

    def test_hourly_email_budget(self):
        for _ in range(5):
            self.request()
            self.timestamp += 60
        self.assertEqual(self.request(status=429)['retryAfter'], 3300)

    def test_ip_budget_across_unknown_addresses(self):
        for index in range(30): self.request(f'unknown{index}@example.com')
        self.request('another@example.com', status=429)

    def test_verification_ip_limit_durable(self):
        data = self.request()
        for _ in range(60): self.assertEqual(self.verify('x' * 43).status, 401)
        self.assertEqual(self.verify(data['challenge']).status, 429)

    def test_clerk_and_missing_transport_disable_flow(self):
        with patch('auth.clerk_enabled', return_value=True): self.request(status=503)
        with patch('auth.mail_configured', return_value=False): self.request(status=503)
        self.assertEqual(self.mail, [])

    def test_malformed_code_and_email(self):
        for email in ('invalid', 'a\r\nb@example.com', 'x' * 255 + '@example.com'):
            self.request(email, status=400)
        data = self.request()
        for code in ('12345', '1234567', '١٢٣٤٥٦', 'abcdef'):
            self.assertEqual(self.verify(data['challenge'], code).status, 400)


if __name__ == '__main__': unittest.main()
