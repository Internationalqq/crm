import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('rfq_plugin', Path(__file__).parent / 'gulya-avito-rfq/__init__.py')
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)


class PluginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.workspace = self.home / 'workspace'
        self.images = self.workspace / 'speed-benchmark-20261008'
        self.images.mkdir(parents=True)
        self.enterContext(patch.object(plugin, 'HOME', self.home))
        self.enterContext(patch.object(plugin, 'WORKSPACE', self.workspace))
        self.enterContext(patch.dict(os.environ, {
            'HERMES_HOME': str(self.home), 'HERMES_PROFILE': 'gulya',
            'HERMES_KANBAN_TASK': plugin.TASK, 'HERMES_KANBAN_BOARD': plugin.BOARD}))

    def test_scope_requires_all_four_boundaries(self):
        self.assertTrue(plugin.in_scope())
        for key in ('HERMES_HOME', 'HERMES_PROFILE', 'HERMES_KANBAN_TASK', 'HERMES_KANBAN_BOARD'):
            with self.subTest(key=key), patch.dict(os.environ, {key: 'other'}), patch.object(plugin.subprocess, 'run') as run:
                self.assertEqual(json.loads(plugin.handle({'step': 'send', 'lock_file': 'x'}))['status'], 'refused')
                run.assert_not_called()

    def test_outside_scope_registers_nothing(self):
        from unittest.mock import Mock
        ctx = Mock()
        with patch.dict(os.environ, {'HERMES_KANBAN_TASK': 'other'}):
            plugin.register(ctx)
        ctx.register_tool.assert_not_called()

    def test_lock_escape_rejected_before_process(self):
        for lock in ('../outside.json', str(self.home / 'outside.json')):
            with self.subTest(lock=lock), patch.object(plugin.subprocess, 'run') as run:
                self.assertEqual(json.loads(plugin.handle({'step': 'send', 'lock_file': lock}))['status'], 'needs_inspection')
                run.assert_not_called()

    def test_unknown_step_rejected(self):
        with patch.object(plugin.subprocess, 'run') as run:
            self.assertEqual(json.loads(plugin.handle({'step': 'shell', 'lock_file': 'x'}))['status'], 'needs_inspection')
            run.assert_not_called()

    def test_arguments_are_literal_argv_not_shell(self):
        done = subprocess.CompletedProcess([], 0, '{"status":"sent_verified"}\n', '')
        supplier = '$(touch hacked); name'
        with patch.object(plugin.subprocess, 'run', return_value=done) as run:
            result = plugin.handle({'step': 'fill', 'lock_file': 'turn.json', 'supplier': supplier,
                                    'reviewed_image_sha256': 'a' * 64})
        self.assertEqual(json.loads(result)['status'], 'sent_verified')
        self.assertIn(supplier, run.call_args.args[0])
        self.assertEqual(run.call_args.kwargs['cwd'], self.workspace)
        self.assertNotIn('shell', run.call_args.kwargs)
        self.assertEqual(run.call_count, 1)

    def test_timeout_never_retries(self):
        with patch.object(plugin.subprocess, 'run', side_effect=subprocess.TimeoutExpired('helper', 110)) as run:
            result = json.loads(plugin.handle({'step': 'send', 'lock_file': 'turn.json'}))
        self.assertFalse(result['automatic_retry'])
        self.assertEqual(result['status'], 'needs_inspection')
        self.assertEqual(run.call_count, 1)

    def test_overlapping_send_enters_helper_only_once_and_releases(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Event
        entered, release = Event(), Event()

        def slow_helper(*args, **kwargs):
            entered.set()
            self.assertTrue(release.wait(5))
            return subprocess.CompletedProcess([], 0, '{"status":"send_unknown"}', '')

        with patch.object(plugin.subprocess, 'run', side_effect=slow_helper) as run:
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(plugin.handle, {'step': 'send', 'lock_file': 'turn.json'})
                self.assertTrue(entered.wait(5))
                try:
                    other = json.loads(plugin.handle({'step': 'send', 'lock_file': 'turn.json'}))
                    self.assertEqual(other['status'], 'needs_inspection')
                    self.assertFalse(other['automatic_retry'])
                    self.assertEqual(run.call_count, 1)
                finally:
                    release.set()
                self.assertEqual(json.loads(first.result())['status'], 'send_unknown')
            plugin.handle({'step': 'inspect', 'lock_file': 'turn.json'})
            self.assertEqual(run.call_count, 2)

    def test_nonzero_result_cannot_appear_successful(self):
        done = subprocess.CompletedProcess([], 2, '{"status":"sent_verified"}', '')
        with patch.object(plugin.subprocess, 'run', return_value=done):
            result = json.loads(plugin.handle({'step': 'send', 'lock_file': 'turn.json'}))
        self.assertEqual(result['status'], 'needs_inspection')
        self.assertFalse(result['automatic_retry'])

    def test_missing_result_does_not_leak_stderr(self):
        done = subprocess.CompletedProcess([], 1, 'notice', 'private credential')
        with patch.object(plugin.subprocess, 'run', return_value=done):
            result = plugin.handle({'step': 'send', 'lock_file': 'turn.json'})
        self.assertNotIn('private credential', result)
        self.assertEqual(json.loads(result)['status'], 'needs_inspection')

    def test_image_returned_in_same_result_after_notice(self):
        image = self.images / 'proof.png'
        image.write_bytes(b'\x89PNG\r\n\x1a\nfixture')
        import hashlib
        digest = hashlib.sha256(image.read_bytes()).hexdigest()
        data = {'image_path': str(image), 'image_sha256': digest, 'status': 'send_unknown'}
        done = subprocess.CompletedProcess([], 0, 'version notice\n' + json.dumps(data), '')
        with patch.object(plugin.subprocess, 'run', return_value=done):
            result = plugin.handle({'step': 'send', 'lock_file': 'turn.json'})
        self.assertTrue(result['_multimodal'])
        self.assertEqual(json.loads(result['text_summary'])['status'], 'send_unknown')
        self.assertTrue(result['content'][1]['image_url']['url'].startswith('data:image/png;base64,'))
        self.assertEqual(json.loads(result['content'][0]['text'])['image_sha256'], digest)

    def test_changed_image_refused(self):
        image = self.images / 'proof.png'
        image.write_bytes(b'\x89PNG\r\n\x1a\nfixture')
        with self.assertRaisesRegex(ValueError, 'changed'):
            plugin.with_image({'image': str(image), 'image_sha256': 'a' * 64})

    def test_external_image_refused(self):
        with self.assertRaisesRegex(ValueError, 'outside'):
            plugin.with_image({'image': str(self.home / 'secret.png')})

    def test_non_image_refused(self):
        image = self.images / 'proof.png'
        image.write_text('private file')
        with self.assertRaisesRegex(ValueError, 'PNG/JPEG'):
            plugin.with_image({'image': str(image)})

    def test_compact_preserves_canonical_instructions_and_does_not_mutate(self):
        data = {'task': {'id': 't', 'title': 'Title', 'body': 'Full body', 'status': 'blocked'},
                'worker_context': 'Full body\nParent handoffs\nAttachments\nLatest comments',
                'parents': ['p'], 'children': [], 'comments': list(range(30)),
                'events': list(range(50)), 'runs': list(range(20))}
        original = json.dumps(data)
        result = json.loads(plugin.compact_card(original))
        self.assertEqual(result['worker_context'], data['worker_context'])
        self.assertEqual(result['task']['status'], 'blocked')
        self.assertEqual(result['history_counts'], {'comments': 30, 'events': 50, 'runs': 20})
        self.assertNotIn('comments', result)
        self.assertEqual(json.dumps(data), original)

    def test_compact_preserves_errors(self):
        raw = '{"error":"board access refused"}'
        self.assertEqual(plugin.compact_card(raw), raw)

    def test_registered_show_compact_default_full_opt_out_and_scope(self):
        import sys
        import types
        from unittest.mock import Mock
        raw = json.dumps({'task': {'id': 't', 'body': 'Instructions'},
                          'worker_context': 'Instructions', 'parents': [], 'children': [],
                          'comments': [1], 'runs': [2], 'events': [3]})
        original = Mock(return_value=raw)
        fake = types.SimpleNamespace(_handle_show=original, _check_kanban_mode=lambda: True,
                                     KANBAN_SHOW_SCHEMA={'parameters': {'properties': {}}})
        ctx = Mock()
        with patch.dict(sys.modules, {'tools': types.SimpleNamespace(kanban_tools=fake)}):
            plugin.register(ctx)
        call = ctx.register_tool.call_args_list[0]
        self.assertTrue(call.kwargs['override'])
        self.assertTrue(call.args[2]['parameters']['properties']['compact']['default'])
        show = call.args[3]
        self.assertNotIn('comments', json.loads(show({})))
        self.assertEqual(show({'compact': False}), raw)
        with patch.dict(os.environ, {'HERMES_KANBAN_TASK': 'other'}):
            self.assertEqual(show({}), raw)


if __name__ == '__main__':
    unittest.main()
