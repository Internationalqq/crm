import hashlib
import importlib.util
import io
import json
from pathlib import Path
import ssl
import subprocess
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('eis_fetch', Path(__file__).resolve().parents[1] / 'deploy/eis_mac_fetch.py')
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)
URL = 'https://zakupki.gov.ru/44fz/filestore/public/1.0/download/file.html?uid=1'


class EISFetchTests(unittest.TestCase):
    def test_url_and_redirect_do_not_leave_public_eis(self):
        self.assertEqual(fetch.validate_url(URL), URL)
        for url in ['http://zakupki.gov.ru/epz/x', 'https://evil.ru/epz/x',
                    'https://zakupki.gov.ru.evil.ru/epz/x', 'https://a@zakupki.gov.ru/epz/x',
                    'https://zakupki.gov.ru:8443/epz/x', 'https://zakupki.gov.ru/private']:
            with self.assertRaises(ValueError):
                fetch.EISRedirect().redirect_request(None, None, 302, '', {}, url)

    def test_only_pinned_certificate_is_loaded_even_if_a_ca_was_appended(self):
        with tempfile.TemporaryDirectory() as temp:
            cert = Path(temp) / 'ca.pem'
            pem = ssl.DER_cert_to_PEM_cert(b'first')
            cert.write_text(pem + ssl.DER_cert_to_PEM_cert(b'untrusted appended CA'))
            context = Mock()
            with patch.object(fetch, 'ROOT_SHA256', hashlib.sha256(b'first').hexdigest()), \
                    patch.object(fetch.ssl, 'create_default_context', return_value=context), \
                    patch.object(fetch.urllib.request, 'HTTPSHandler'), \
                    patch.object(fetch.urllib.request, 'build_opener'):
                fetch.verified_opener(cert)
            context.load_verify_locations.assert_called_once_with(cadata=pem)

    def test_truncated_or_oversized_response_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            for declared, limit in [('8', 20), ('3', 2)]:
                response = io.BytesIO(b'abc')
                response.url, response.status = URL, 200
                response.headers = {'Content-Length': declared}
                opener = Mock()
                opener.open.return_value = response
                with patch.object(fetch, 'verified_opener', return_value=opener):
                    with self.assertRaises(ValueError):
                        fetch._download_one(URL, Path(temp) / 'file.part', 'cert', limit)

    def test_cached_retry_recovers_sidecar_and_rebuilds_complete_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            def download(url, path, certificate, remaining, limit):
                path.write_bytes(b'complete')
                return {'headers': {}, 'size_bytes': 8, 'sha256': hashlib.sha256(b'complete').hexdigest()}
            with patch.object(fetch, 'verified_opener'), patch.object(fetch, '_run_download', side_effect=download):
                original = fetch.fetch_documents([{'url': URL}], folder, 'cert')
            (folder / 'download-manifest.json').write_text('[]')
            with patch.object(fetch, 'verified_opener'), patch.object(fetch, '_run_download') as child:
                self.assertEqual(fetch.fetch_documents([{'url': URL}], folder, 'cert'), original)
                child.assert_not_called()
            self.assertEqual(json.loads((folder / 'download-manifest.json').read_text()), original)

    def test_failed_child_cleans_partial_without_publishing_it(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            def failure(url, path, *args):
                path.write_bytes(b'partial')
                raise subprocess.TimeoutExpired('worker', .1)
            with patch.object(fetch, 'verified_opener'), patch.object(fetch, '_run_download', side_effect=failure):
                with self.assertRaises(subprocess.TimeoutExpired):
                    fetch.fetch_documents([{'url': URL}], folder, 'cert')
            self.assertFalse(list(folder.glob('*.part')))
            self.assertFalse(list(folder.glob('*.source')))

    def test_wall_clock_deadline_stops_a_trickling_child(self):
        with tempfile.TemporaryDirectory() as temp:
            script = Path(temp) / 'trickle.py'
            script.write_text("import pathlib,sys,time\np=pathlib.Path(sys.argv[3])\nwhile True:\n p.write_bytes(b'x')\n time.sleep(.02)\n")
            started = time.monotonic()
            with patch.object(fetch, '__file__', str(script)):
                with self.assertRaises(subprocess.TimeoutExpired):
                    fetch._run_download(URL, Path(temp) / 'part', 'cert', .2, 100)
            self.assertLess(time.monotonic() - started, 2)


if __name__ == '__main__':
    unittest.main()
