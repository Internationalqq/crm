import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import json
import subprocess
import time

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).with_name('bridge.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AccessTests(unittest.TestCase):
    def test_russian_before_pairing_does_not_crash_or_run(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('pairing', 'abcdef')
            bridge.set('pairing_expires', time.time() + 60)
            bridge.send = lambda text: None
            message = {'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123}, 'text': 'Проверь, как чеки попадают в CRM'}
            bridge.accept({'update_id': 1, 'message': message})
            self.assertIsNone(bridge.get('owner'))
            self.assertEqual(bridge.db.execute('SELECT count(*) FROM jobs').fetchone()[0], 0)
            message['text'] = '/start abcdef'
            bridge.accept({'update_id': 2, 'message': message})
            self.assertEqual(bridge.get('owner'), '123')
            bridge.db.close()

    def test_plain_start_explains_pairing_without_granting_access(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            with patch.object(bridge, 'api', return_value={}) as api:
                bridge.accept({'update_id': 1, 'message': {'text': '/start', 'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123}}})
                self.assertEqual(api.call_args[0][0], 'sendMessage')
            self.assertIsNone(bridge.get('owner'))
            bridge.db.close()

    def test_private_owner_only(self):
        message = {'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123}}
        self.assertTrue(module.authorized(message, 123))
        self.assertFalse(module.authorized(message, 124))
        message['chat']['type'] = 'group'
        self.assertFalse(module.authorized(message, 123))

    def test_dedup_and_recovery_do_not_repeat_running_job(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            sent = []
            bridge.send = sent.append
            update = {'update_id': 5, 'message': {'text': 'check', 'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123}}}
            bridge.accept(update)
            bridge.accept(update)
            self.assertEqual(len(sent), 1)
            bridge.db.execute("UPDATE jobs SET status='running'")
            bridge.db.commit()
            bridge.db.close()
            reopened = module.Bridge(home, home, 'codex')
            self.assertEqual(reopened.db.execute('SELECT status FROM jobs').fetchone()[0], 'interrupted')
            reopened.db.close()

    def test_task_executes_once_and_preserves_thread(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.db.execute("INSERT INTO jobs VALUES (7,'hello','queued',NULL)")
            bridge.db.commit()
            sent = []
            bridge.send = sent.append
            def execute(command, **kwargs):
                self.assertEqual(command[-1], '-')
                self.assertIn('hello', kwargs['input'])
                self.assertNotIn('hello', command)
                kwargs['stdout'].write(json.dumps({'type': 'thread.started', 'thread_id': 'thread-1'}) + '\n')
                Path(home, 'answer-7.txt').write_text('готово', encoding='utf-8')
                return subprocess.CompletedProcess(command, 0)
            with patch.object(module.subprocess, 'run', side_effect=execute) as run:
                bridge.work()
                bridge.work()
                self.assertEqual(run.call_count, 1)
            self.assertEqual(bridge.get('thread'), 'thread-1')
            self.assertEqual(sent, ['готово'])
            bridge.db.close()


if __name__ == '__main__':
    unittest.main()
