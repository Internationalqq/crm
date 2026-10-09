import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import json
import time
import sys
import io
sys.path.insert(0, str(Path(__file__).parent))

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).with_name('bridge.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
import attachments
import outgoing
import sqlite3


class AccessTests(unittest.TestCase):
    def test_late_steering_is_preserved_for_next_turn(self):
        from control import Controls
        control = Controls(lambda x: None)
        control.active = True
        control.accept('Позднее уточнение', 77)
        remaining = control.finish()
        self.assertEqual(remaining, [{'kind': 'steer', 'text': 'Позднее уточнение', 'update_id': 77}])
        self.assertFalse(control.active)

    def test_polling_can_interrupt_worker_without_sqlite_thread_violation(self):
        import threading
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.db.execute("INSERT INTO jobs VALUES (70,'task','queued',NULL)"); bridge.db.commit()
            bridge.api = lambda method, payload: {'message_id': 1}
            ready = threading.Event()
            def execute(*args, **kwargs):
                ready.set()
                value = kwargs['controls'].queue.get(timeout=5)
                self.assertEqual(value, {'kind': 'stop'})
                return 'Остановлено'
            with patch.object(module, 'run_codex', side_effect=execute):
                thread = threading.Thread(target=bridge.work_in_thread)
                thread.start(); self.assertTrue(ready.wait(5))
                bridge.accept({'update_id': 71, 'message': {'text': '/stop', 'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123}}})
                thread.join(5); self.assertFalse(thread.is_alive())
            self.assertEqual(bridge.db.execute('SELECT status FROM jobs WHERE id=70').fetchone()[0], 'completed')
            bridge.db.close()

    def test_controls_stop_steer_question_and_scoped_approval(self):
        from control import Controls
        sent = []
        control = Controls(sent.append)
        control.active = True
        self.assertTrue(control.accept('Уточнение'))
        self.assertEqual(list(control.drain()), [{'kind': 'steer', 'text': 'Уточнение'}])
        control.request({'id': 4, 'method': 'item/tool/requestUserInput', 'params': {'questions': [{'id': 'date', 'question': 'Дата?'}]}})
        control.accept('Завтра')
        self.assertEqual(list(control.drain())[0]['result'], {'answers': {'date': {'answers': ['Завтра']}}})
        control.request({'id': 5, 'method': 'item/fileChange/requestApproval', 'params': {'reason': 'Создать файл'}})
        control.accept('/approve')
        self.assertEqual(list(control.drain())[0]['result'], {'decision': 'accept'})
        control.accept('/stop')
        self.assertEqual(list(control.drain()), [{'kind': 'stop'}])
        control.finish()
        self.assertFalse(control.accept('Новая задача'))

    def test_owner_controls_are_deduplicated_and_foreign_input_ignored(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.controls.active = True
            update = {'update_id': 90, 'message': {'text': 'Уточни', 'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123}}}
            bridge.accept(update); bridge.accept(update)
            self.assertEqual(len(list(bridge.controls.drain())), 1)
            update['update_id'] = 91; update['message']['from']['id'] = 456
            bridge.accept(update)
            self.assertEqual(list(bridge.controls.drain()), [])
            self.assertEqual(bridge.db.execute('SELECT count(*) FROM jobs').fetchone()[0], 0)
            bridge.db.close()

    def test_completed_job_attaches_file_and_removes_local_path_from_reply(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.db.execute("INSERT INTO jobs VALUES (24,'Создай файл','queued',NULL)")
            bridge.db.commit()
            sent = []
            bridge.api = lambda method, payload: sent.append(payload['text']) or {'message_id': 1}
            with patch.object(module, 'run_codex', return_value='Готово\nMEDIA: C:/work/result.png'), patch.object(module, 'deliver', return_value=555) as deliver:
                bridge.work()
                self.assertEqual(deliver.call_count, 1)
                self.assertEqual(deliver.call_args.args[-1], 'C:/work/result.png')
            self.assertEqual(sent, ['⏳ Работаю · 0:00', 'Готово'])
            bridge.db.close()

    def test_outgoing_file_sent_once_with_durable_receipt(self):
        with tempfile.TemporaryDirectory() as home:
            path = Path(home, 'result.png'); path.write_bytes(b'PNG')
            db = sqlite3.connect(':memory:')
            with patch.object(outgoing, 'upload', return_value=555) as upload:
                self.assertEqual(outgoing.deliver(db, 'secret', 123, home, 1, str(path)), 555)
                self.assertEqual(outgoing.deliver(db, 'secret', 123, home, 1, str(path)), 555)
                self.assertEqual(upload.call_count, 1)
                self.assertEqual(upload.call_args.args[-1], b'PNG')
            self.assertEqual(db.execute('SELECT status,message_id FROM outgoing_files').fetchone(), ('sent', 555))
            db.close()

    def test_unknown_file_delivery_not_repeated(self):
        with tempfile.TemporaryDirectory() as home:
            path = Path(home, 'result.txt'); path.write_text('result')
            db = sqlite3.connect(':memory:')
            with patch.object(outgoing, 'upload', side_effect=RuntimeError('timeout')) as upload:
                with self.assertRaises(RuntimeError): outgoing.deliver(db, 'secret', 123, home, 1, str(path))
                with self.assertRaises(RuntimeError): outgoing.deliver(db, 'secret', 123, home, 1, str(path))
                self.assertEqual(upload.call_count, 1)
            db.close()

    def test_file_paths_outside_workspace_and_env_rejected(self):
        with tempfile.TemporaryDirectory() as home, tempfile.TemporaryDirectory() as other:
            outside = Path(other, 'file.txt'); outside.write_text('secret')
            secret = Path(home, '.env'); secret.write_text('secret')
            with self.assertRaises(ValueError): outgoing.allowed_file(str(outside), home)
            with self.assertRaises(ValueError): outgoing.allowed_file(str(secret), home)

    def test_file_directives_and_local_links_hidden_from_public_text(self):
        text, paths = outgoing.split_files('Готово\nMEDIA: C:/work/avatar.png\n[Скачать](C:/work/avatar.png)')
        self.assertEqual(paths, ['C:/work/avatar.png'])
        self.assertNotIn('C:/', text)
        self.assertNotIn('MEDIA:', text)
        self.assertNotIn('C:/', outgoing.public_preview('Готово\nMEDIA: C:/work/partial'))

    def test_work_passes_image_and_caption_to_codex_and_only_sends_result(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.db.execute("INSERT INTO jobs VALUES (22,'Проверь чек','queued',NULL)")
            bridge.db.execute('INSERT INTO attachments VALUES (?,?)', (22, json.dumps({'kind': 'image', 'file_id': 'image'})))
            bridge.db.commit()
            sent = []
            bridge.api = lambda method, payload: sent.append(payload['text']) or {'message_id': 1}
            inputs = [{'type': 'localImage', 'path': 'receipt.jpg'}]
            with patch.object(module, 'prepare', return_value=('Attached receipt', inputs)), patch.object(module, 'run_codex', return_value='Проверено') as runner:
                bridge.work()
            self.assertEqual(runner.call_args.kwargs['extra_inputs'], inputs)
            self.assertIn('Проверь чек', runner.call_args.args[4])
            self.assertEqual(sent, ['⏳ Работаю · 0:00', 'Проверено'])
            bridge.db.close()

    def test_voice_failure_does_not_disable_text_tasks(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.db.execute("INSERT INTO jobs VALUES (23,'','queued',NULL)")
            bridge.db.execute('INSERT INTO attachments VALUES (?,?)', (23, json.dumps({'kind': 'voice', 'file_id': 'voice'})))
            bridge.db.commit()
            bridge.api = lambda method, payload: {'message_id': 1}
            with patch.object(module, 'prepare', side_effect=module.AttachmentError('Mac unavailable')):
                bridge.work()
            self.assertIsNone(bridge.get('halted'))
            self.assertEqual(bridge.db.execute('SELECT status FROM jobs').fetchone()[0], 'failed')
            bridge.db.close()

    def test_attachment_with_caption_is_queued_once_without_ack(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.send = lambda text: self.fail('No receipt acknowledgement expected')
            update = {'update_id': 10, 'message': {'caption': 'Что на фото?', 'photo': [{'file_id': 'photo', 'width': 100, 'height': 100}], 'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123}}}
            bridge.accept(update); bridge.accept(update)
            self.assertEqual(bridge.db.execute('SELECT count(*) FROM attachments').fetchone()[0], 1)
            self.assertEqual(bridge.db.execute('SELECT prompt FROM jobs').fetchone()[0], 'Что на фото?')
            bridge.db.close()

    def test_unknown_user_attachment_is_not_downloaded_or_queued(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex')
            bridge.set('owner', 123)
            bridge.accept({'update_id': 11, 'message': {'voice': {'file_id': 'voice'}, 'chat': {'type': 'private', 'id': 999}, 'from': {'id': 999}}})
            self.assertEqual(bridge.db.execute('SELECT count(*) FROM attachments').fetchone()[0], 0)
            bridge.db.close()

    def test_photo_download_has_fixed_local_name_and_native_image_input(self):
        with tempfile.TemporaryDirectory() as home:
            with patch.object(attachments.urllib.request, 'urlopen', return_value=io.BytesIO(b'fake image')):
                note, inputs = attachments.prepare(lambda *args: {'file_path': 'photos/file.jpg'}, 'secret', home, 12,
                                                   {'kind': 'image', 'file_id': 'f', 'file_name': '../../photo.jpg'})
            self.assertEqual(inputs, [{'type': 'localImage', 'path': str(Path(home)/'TelegramInbox/12.jpg')}])
            self.assertNotIn('secret', note)

    def test_oversized_and_traversal_files_are_refused(self):
        with tempfile.TemporaryDirectory() as home:
            with self.assertRaises(attachments.AttachmentError):
                attachments.download(lambda *args: self.fail('Must reject before API'), 'secret', home, 12,
                                     {'kind': 'document', 'file_id': 'f', 'file_size': attachments.MAX_BYTES + 1})
            with self.assertRaises(attachments.AttachmentError):
                attachments.download(lambda *args: {'file_path': '../secret.txt'}, 'secret', home, 12,
                                     {'kind': 'document', 'file_id': 'f'})

    def test_voice_transcript_becomes_task_without_public_echo(self):
        with tempfile.TemporaryDirectory() as home:
            with patch.object(attachments, 'download', return_value=Path(home)/'12.ogg'), patch.object(attachments, 'transcribe', return_value='Проверь CRM'):
                note, inputs = attachments.prepare(None, None, home, 12, {'kind': 'voice'})
            self.assertIn('Проверь CRM', note)
            self.assertEqual(inputs, [])

    def test_timer_updates_during_silence_and_final_replaces_same_message(self):
        calls = []
        clock = [10]
        live = module.LiveReply(lambda method, payload: calls.append((method, payload)) or {'message_id': 42}, 123, lambda: clock[0])
        live.started_at = clock[0]
        live.tick()
        self.assertEqual(calls[-1][1]['text'], '⏳ Работаю · 0:00')
        clock[0] += 65
        live.tick()
        self.assertEqual(calls[-1][1]['text'], '⏳ Работаю · 1:05')
        live.feed({'method': 'item/reasoning/textDelta', 'params': {'delta': 'SECRET'}})
        live.finish('Готово')
        clock[0] += 2; live.tick()
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[-1][1]['text'], 'Готово')
        self.assertEqual(calls[-1][1]['message_id'], 42)
        self.assertEqual(sum(method == 'sendMessage' for method, _ in calls), 1)
        self.assertNotIn('SECRET', str(calls))

    def test_live_text_edits_one_message_then_replaces_with_summary(self):
        calls = []
        clock = [10]
        def api(method, payload):
            calls.append((method, payload))
            return {'message_id': 42}
        live = module.LiveReply(api, 123, lambda: clock[0])
        live.feed({'method': 'item/started', 'params': {'item': {'type': 'agentMessage', 'id': 'a'}}})
        live.feed({'method': 'item/agentMessage/delta', 'params': {'itemId': 'a', 'delta': 'Проверяю'}})
        live.feed({'method': 'item/reasoning/textDelta', 'params': {'delta': 'SECRET'}})
        live.feed({'method': 'item/commandExecution/outputDelta', 'params': {'delta': 'terminal'}})
        live.feed({'method': 'item/agentMessage/delta', 'params': {'itemId': 'a', 'delta': ' файлы'}})
        clock[0] += 3
        live.feed({'method': 'item/agentMessage/delta', 'params': {'itemId': 'a', 'delta': '.'}})
        live.finish('Готово: проверено.')
        self.assertEqual([method for method, _ in calls], ['sendMessage', 'editMessageText', 'editMessageText'])
        self.assertEqual(calls[-1][1]['text'], 'Готово: проверено.')
        self.assertEqual(calls[-1][1]['message_id'], 42)
        self.assertNotIn('SECRET', str(calls))
        self.assertNotIn('terminal', str(calls))

    def test_unknown_preview_delivery_never_sends_duplicate(self):
        def fail(method, payload):
            raise RuntimeError('network')
        live = module.LiveReply(fail, 123)
        live.publish('Текст')
        with self.assertRaises(RuntimeError):
            live.finish('Итог')

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
            self.assertEqual(sent, [])
            self.assertEqual(bridge.db.execute('SELECT count(*) FROM jobs').fetchone()[0], 1)
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
            bridge.api = lambda method, payload: sent.append(payload['text']) or {'message_id': 1}
            def execute(codex, workspace, crm, thread, prompt, events, on_thread, on_event, **options):
                self.assertEqual(workspace, home)
                self.assertIn('hello', prompt)
                self.assertIn('универсальный помощник', prompt)
                on_thread('thread-1')
                return 'готово'
            with patch.object(module, 'run_codex', side_effect=execute) as run:
                bridge.work()
                bridge.work()
                self.assertEqual(run.call_count, 1)
            self.assertEqual(bridge.get('thread'), 'thread-1')
            self.assertEqual(sent, ['⏳ Работаю · 0:00', 'готово'])
            bridge.db.close()

    def test_crm_is_optional_context_and_resume_keeps_general_root(self):
        with tempfile.TemporaryDirectory() as home:
            Path(home, 'bot-token.txt').write_text('test', encoding='utf-8')
            bridge = module.Bridge(home, home, 'codex', 'C:/CRM')
            bridge.set('owner', 123)
            bridge.set('thread', 'existing-thread')
            bridge.db.execute("INSERT INTO jobs VALUES (8,'Напиши письмо','queued',NULL)")
            bridge.db.commit()
            bridge.api = lambda method, payload: {'message_id': 1}
            def execute(codex, workspace, crm, thread, prompt, events, on_thread, on_event, **options):
                self.assertEqual((workspace, crm, thread), (home, 'C:/CRM', 'existing-thread'))
                self.assertIn('Если задача касается CRM', prompt)
                self.assertIn('Не считай каждую задачу связанной с CRM', prompt)
                return 'Письмо'
            with patch.object(module, 'run_codex', side_effect=execute):
                bridge.work()
            self.assertEqual(bridge.db.execute('SELECT status FROM jobs').fetchone()[0], 'completed')
            bridge.db.close()


if __name__ == '__main__':
    unittest.main()
