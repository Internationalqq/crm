import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import bridge as module
from streaming import LiveReply


class ForwardingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.home = self.directory.name
        Path(self.home, 'bot-token.txt').write_text('test')
        self.bridge = module.Bridge(self.home, self.home, 'codex')
        self.bridge.set('owner', 123)
        self.calls = []
        self.bridge.api = lambda method, payload: self.calls.append((method, payload)) or {'message_id': 8}
        self.clock = patch.object(module.time, 'time', return_value=100)
        self.now = self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.bridge.db.close()
        self.directory.cleanup()

    def update(self, number, text, forwarded=True, **fields):
        message = {'text': text, 'from': {'id': 123}, 'chat': {'id': 123, 'type': 'private'}, **fields}
        if forwarded:
            message['forward_origin'] = {'type': 'hidden_user', 'sender_user_name': 'Иван'}
        return {'update_id': number, 'message': message}

    def test_burst_waits_for_last_message_then_runs_once(self):
        with patch.object(module, 'run_codex', return_value='Общий ответ') as runner:
            for i in range(8):
                self.now.return_value = 100 + i
                self.bridge.accept(self.update(i + 1, 'Реплика ' + str(i)))
                self.bridge.work()
                runner.assert_not_called()
            self.now.return_value = 112
            self.bridge.work()
            self.bridge.work()
        self.assertEqual(runner.call_count, 1)
        prompt = runner.call_args.args[4]
        self.assertIn('один связный ответ', prompt)
        self.assertIn('Иван', prompt)
        for i in range(8):
            self.assertIn('Реплика ' + str(i), prompt)
        self.assertEqual(self.bridge.db.execute('SELECT count(*) FROM jobs').fetchone()[0], 1)

    def test_forwarded_stop_is_data_even_during_active_task(self):
        self.bridge.controls.active = True
        self.bridge.accept(self.update(1, '/stop'))
        self.assertEqual(list(self.bridge.controls.drain()), [])
        self.assertFalse(self.bridge.get('paused'))
        self.assertEqual(self.bridge.db.execute('SELECT status FROM jobs').fetchone()[0], 'collecting')

    def test_owner_explanation_and_quoted_reply_join_batch(self):
        self.bridge.accept(self.update(1, 'Хотя наоборот?', reply_to_message={'text': 'Кофе крепче'}))
        self.bridge.accept(self.update(2, 'Разбери спор', forwarded=False))
        payload = json.loads(self.bridge.db.execute('SELECT messages FROM forward_batches').fetchone()[0])
        self.assertEqual(payload[0]['reply'], 'Кофе крепче')
        self.assertFalse(payload[1]['forwarded'])
        self.assertEqual(payload[1]['text'], 'Разбери спор')

    def test_duplicates_and_foreign_messages_do_not_join(self):
        update = self.update(1, 'Первое')
        self.bridge.accept(update)
        self.bridge.accept(update)
        update = self.update(2, 'Чужое')
        update['message']['from']['id'] = 999
        self.bridge.accept(update)
        payload = json.loads(self.bridge.db.execute('SELECT messages FROM forward_batches').fetchone()[0])
        self.assertEqual(len(payload), 1)

    def test_batch_survives_restart(self):
        self.bridge.accept(self.update(1, 'Первое'))
        self.bridge.db.close()
        self.bridge = module.Bridge(self.home, self.home, 'codex')
        self.bridge.api = lambda *args: {'message_id': 8}
        self.bridge.accept(self.update(2, 'Второе'))
        self.now.return_value = 106
        with patch.object(module, 'run_codex', return_value='Ответ') as runner:
            self.bridge.work()
        self.assertEqual(runner.call_count, 1)
        self.assertIn('Первое', runner.call_args.args[4])
        self.assertIn('Второе', runner.call_args.args[4])

    def test_separate_bursts_make_separate_jobs(self):
        self.bridge.accept(self.update(1, 'Первое'))
        self.now.return_value = 110
        self.bridge.accept(self.update(2, 'Второе'))
        self.assertEqual(self.bridge.db.execute('SELECT count(*) FROM jobs').fetchone()[0], 2)

    def test_forwarded_attachments_all_reach_one_task(self):
        for i in (1, 2):
            self.bridge.accept(self.update(i, 'Фото', photo=[{'file_id': str(i), 'width': 10, 'height': 10}]))
        self.now.return_value = 106
        def prepare(*args):
            return 'Файл ' + str(args[4]), [{'type': 'localImage', 'path': str(args[4])}]
        with patch.object(module, 'prepare', side_effect=prepare) as files, patch.object(module, 'run_codex', return_value='Ответ') as runner:
            self.bridge.work()
        self.assertEqual(files.call_count, 2)
        self.assertEqual(len(runner.call_args.kwargs['extra_inputs']), 2)

    def test_stop_cancels_queue_and_pending_batch(self):
        self.bridge.accept(self.update(1, 'Новая задача', forwarded=False))
        self.bridge.accept(self.update(2, 'Пачка'))
        self.bridge.controls.active = True
        self.bridge.controls.accept('Уточнение', 90)
        self.bridge.accept(self.update(3, '/stop', forwarded=False))
        self.assertEqual(self.bridge.get('paused'), '1')
        self.assertEqual(self.bridge.db.execute("SELECT count(*) FROM jobs WHERE status='cancelled'").fetchone()[0], 2)
        self.assertEqual(list(self.bridge.controls.drain()), [{'kind': 'stop'}])
        self.assertEqual(self.bridge.controls.finish(), [])
        with patch.object(module, 'run_codex') as runner:
            self.bridge.work()
            runner.assert_not_called()
        self.bridge.accept(self.update(4, 'Новая отдельная задача', forwarded=False))
        self.assertEqual(self.bridge.get('paused'), '')

    def test_button_is_owner_scoped_and_old_job_button_is_rejected(self):
        self.bridge.controls.active = True
        self.bridge.active_stop = '7'
        def callback(number, owner, data):
            return {'update_id': number, 'callback_query': {'id': 'cb', 'from': {'id': owner},
                'message': {'chat': {'id': 123, 'type': 'private'}}, 'data': data}}
        self.bridge.accept(callback(1, 999, 'stop:7'))
        self.bridge.accept(callback(2, 123, 'stop:6'))
        self.assertEqual(list(self.bridge.controls.drain()), [])
        self.bridge.accept(callback(3, 123, 'stop:7'))
        self.assertEqual(list(self.bridge.controls.drain()), [{'kind': 'stop'}])

    def test_stop_button_removed_from_final_response(self):
        live = LiveReply(self.bridge.api, 123, stop_data='stop:7')
        live.publish('Проверяю')
        self.assertEqual(self.calls[-1][1]['reply_markup']['inline_keyboard'][0][0]['callback_data'], 'stop:7')
        live.finish('Готово')
        self.assertEqual(self.calls[-1][1]['reply_markup'], {'inline_keyboard': []})

    def test_stop_during_attachment_preparation_prevents_model_start(self):
        self.bridge.accept(self.update(1, 'Фото', photo=[{'file_id': '1', 'width': 10, 'height': 10}]))
        self.now.return_value = 106
        def prepare(*args):
            self.bridge.stop_all()
            return 'Файл', []
        with patch.object(module, 'prepare', side_effect=prepare), patch.object(module, 'run_codex') as runner:
            self.bridge.work()
            runner.assert_not_called()
        self.assertEqual(self.bridge.get('paused'), '1')


if __name__ == '__main__':
    unittest.main()
