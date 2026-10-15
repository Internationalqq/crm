import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


reader = load('public_reader', 'deploy/hermes-public-research/__init__.py')
compact = load('compact', 'deploy/hermes_kanban_compact.py')


class PublicResearchTests(unittest.TestCase):
    def test_compact_does_not_duplicate_history(self):
        t = types.SimpleNamespace(id='x', body='b'*50000)
        comments = [types.SimpleNamespace(author='u', body='c'*50000) for _ in range(100)]
        runs = [types.SimpleNamespace(id=2, status='blocked', summary='s'*50000, error='e'*50000)]
        view = compact.compact_view(t, comments, runs, [], [])
        self.assertLess(len(json.dumps(view)), len(t.body) + 12000)
        self.assertEqual(view['body'], t.body)
        self.assertEqual(view['history_counts']['comments'], 100)
        self.assertNotIn('worker_context', view)
        self.assertEqual(len(comments), 100)

    def test_compact_patch_is_idempotent(self):
        source = '            def _task_dict(t):\n                pass\nKANBAN_SHOW_SCHEMA = {\n            "board": _board_schema_prop(),\n}\nKANBAN_LIST_SCHEMA = {}'
        result = compact.patch_source(source)
        self.assertEqual(result, compact.patch_source(result))
        self.assertIn('"compact"', result)

    def test_rejects_non_https_credentials_ports_and_denied_domains(self):
        for url in ['file:///etc/passwd', 'http://example.org', 'https://u:p@example.org',
                    'https://example.org:8080', 'https://demontazh-stavropol.ru/price/',
                    'https://www.asfaltekb.ru/price-list/']:
            with self.subTest(url=url), self.assertRaises(ValueError): reader.target(url)

    def test_private_dns_and_policy_blocked_before_connect(self):
        policy = types.SimpleNamespace(check_website_access=lambda _: None)
        with patch.dict(sys.modules, {'tools.website_policy': policy}):
            for ip in ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1']:
                with patch.object(reader.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', (ip, 443))]):
                    with self.assertRaisesRegex(ValueError, 'non_public_address'):reader.target('https://example.org')
            policy.check_website_access = lambda _: {'rule': 'blocked'}
            with self.assertRaisesRegex(ValueError, 'website_policy_denied'): reader.target('https://example.org')

    def test_reader_hides_scripts_but_keeps_prices(self):
        p=reader.VisibleText();p.feed('<h1>Услуга</h1><script>secret</script><p>100 руб. за м²</p>')
        text=''.join(p.parts)
        self.assertIn('100 руб.',text);self.assertNotIn('secret',text)

    def test_redirect_revalidates_and_http_error_not_retried(self):
        class Response:
            status=302
            def getheader(self, name, default=''):return 'https://127.0.0.1/' if name=='Location' else default
        connection=types.SimpleNamespace(request=lambda *a,**k:None,getresponse=lambda:Response(),close=lambda:None)
        with patch.object(reader,'target',side_effect=[(reader.urlsplit('https://example.org'),'example.org','8.8.8.8'),ValueError('non_public_address')]) as target:
            with patch.object(reader,'PinnedHTTPS',return_value=connection):
                with self.assertRaisesRegex(ValueError,'non_public_address'):reader.fetch('https://example.org')
            self.assertEqual(target.call_count,2)
        Response.status=403
        with patch.object(reader,'target',return_value=(reader.urlsplit('https://example.org'),'example.org','8.8.8.8')):
            with patch.object(reader,'PinnedHTTPS',return_value=connection) as factory:
                with self.assertRaisesRegex(ValueError,'http_403'):reader.fetch('https://example.org')
                self.assertEqual(factory.call_count,1)

    def test_task_scope_is_enforced(self):
        with patch.dict(reader.os.environ, {'HERMES_HOME':str(reader.PROFILE),'HERMES_KANBAN_TASK':'other'}):
            self.assertFalse(json.loads(reader.tool({'url':'https://example.org'}))['success'])

    def test_streaming_response_obeys_total_deadline(self):
        response=types.SimpleNamespace(read1=lambda _: b'x')
        conn=types.SimpleNamespace(sock=None)
        with patch.object(reader.time,'monotonic',side_effect=[0,2,61]):
            with self.assertRaisesRegex(ValueError,'page_deadline'):reader.read_body(response,conn,60)


if __name__ == '__main__':unittest.main()
