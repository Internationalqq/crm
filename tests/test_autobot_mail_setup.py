import importlib.util
from pathlib import Path
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    'autobot_mail_setup', Path(__file__).resolve().parents[1] / 'deploy/autobot-mail/setup.py')
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)


class MailSetupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'worker.token'
        self.path.write_text('existing-token-' + 'x' * 32 + '\n')

    def details(self, value=''):
        return {'Config': {'Env': ['BUYER_WORKER_TOKEN=' + value, 'UNRELATED=value']}}

    def test_blank_env_uses_existing_token_file_without_rotation(self):
        before = self.path.read_bytes()
        self.assertEqual(setup.queue_token(self.details('  '), self.path), before.decode().strip())
        self.assertEqual(self.path.read_bytes(), before)

    def test_missing_or_malformed_token_never_generates_replacement(self):
        self.path.unlink()
        with self.assertRaises(SystemExit):
            setup.queue_token(self.details(), self.path)
        self.assertFalse(self.path.exists())
        self.path.write_text('invalid')
        with self.assertRaises(SystemExit):
            setup.queue_token(self.details(), self.path)
        self.assertEqual(self.path.read_text(), 'invalid')

    def test_private_file_atomic_replace_preserves_exact_token(self):
        destination = self.path.with_name('secret')
        setup.private_file(destination, 'a' * 36)
        setup.private_file(destination, 'b' * 36)
        self.assertEqual(destination.read_text(), 'b' * 36)
        self.assertFalse(destination.with_suffix('.new').exists())

    def test_buyer_token_file_is_used_instead_of_price_search_override(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'buyer_worker.token'
            path.write_text('buyer-file-' + 'x' * 40)
            details = {'Config': {'Env': ['MARKET_AGENT_TOKEN=' + 'market-' + 'y' * 40]}}
            self.assertEqual(setup.queue_token(details, path), path.read_text())

    def test_explicit_buyer_override_takes_priority(self):
        token = 'buyer-override-' + 'x' * 40
        details = {'Config': {'Env': ['BUYER_WORKER_TOKEN=' + token]}}
        self.assertEqual(setup.queue_token(details, Path('/missing/token')), token)

    def test_missing_buyer_secret_does_not_fall_back_to_other_queue(self):
        details = {'Config': {'Env': ['MARKET_AGENT_TOKEN=' + 'y' * 40]}}
        with self.assertRaises(SystemExit):
            setup.queue_token(details, Path('/missing/buyer-token'))

    def test_invalid_secret_is_rejected(self):
        for token in ('short', 'x' * 40 + '\n' + 'y' * 40):
            with self.subTest(token_length=len(token)), self.assertRaises(SystemExit):
                setup.queue_token({'Config': {'Env': ['BUYER_WORKER_TOKEN=' + token]}}, Path('/missing'))


if __name__ == '__main__':
    unittest.main()
