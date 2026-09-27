import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('mail_setup',Path(__file__).resolve().parents[1]/'deploy/autobot-mail/setup.py')
setup=importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class MailSetupTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.path=Path(self.tmp.name)/'worker.token'
        self.path.write_text('existing-token-'+'x'*32+'\n')

    def details(self,value=''):
        return {'Config':{'Env':['MARKET_AGENT_TOKEN='+value,'UNRELATED=value']}}

    def test_env_override_matches_autobot_priority(self):
        token='configured-'+'x'*32
        self.assertEqual(setup.queue_token(self.details(token),self.path),token)

    def test_blank_env_uses_existing_token_file_without_rotation(self):
        before=self.path.read_bytes()
        self.assertEqual(setup.queue_token(self.details('  '),self.path),before.decode().strip())
        self.assertEqual(self.path.read_bytes(),before)

    def test_missing_or_malformed_token_never_generates_replacement(self):
        self.path.unlink()
        with self.assertRaises(SystemExit):setup.queue_token(self.details(),self.path)
        self.assertFalse(self.path.exists())
        self.path.write_text('invalid')
        with self.assertRaises(SystemExit):setup.queue_token(self.details(),self.path)
        self.assertEqual(self.path.read_text(),'invalid')

    def test_private_file_atomic_replace_preserves_exact_token(self):
        destination=self.path.with_name('secret')
        setup.private_file(destination,'a'*36)
        setup.private_file(destination,'b'*36)
        self.assertEqual(destination.read_text(),'b'*36)
        self.assertFalse(destination.with_suffix('.new').exists())


if __name__=='__main__':unittest.main()
