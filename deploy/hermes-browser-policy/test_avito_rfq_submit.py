"""Native UI simulation: no browser, model, account or real send is used."""
import base64
from contextlib import redirect_stdout
import csv
import hashlib
import io
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import avito_rfq_step as rfq


class SubmitTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.out = self.root / 'speed-benchmark-20261008'
        self.out.mkdir()
        self.team = self.root / 'team'
        (self.team / 'state').mkdir(parents=True)
        self.lock = self.root / 'turn.json'
        self.lock.write_text(json.dumps({'ticket': 'test-ticket'}))
        self.active = self.team / 'state/active.json'
        self.active.write_text(json.dumps({'owner': 'gulya', 'ticket': 'test-ticket', 'created': time.time()}))
        self.text = 'Approved RFQ: 39 / 50 / 26; RAL7040'
        (self.root / 'task.json').write_text(json.dumps({'campaign_id': 'gabions-20261008-30google-30avito', 'request_text': self.text}))
        for name in ('state.json', 'result.json'):
            (self.root / name).write_text(json.dumps({'monitor_recoveries': ['preserve']}))
        self.csv = self.root / 'avito_outreach.csv'
        with self.csv.open('w', newline='') as stream:
            csv.DictWriter(stream, ['seller_id', 'supplier', 'text', 'status', 'sent_at', 'evidence']).writeheader()
        self.enterContext(patch.object(rfq, 'WORKSPACE', self.root))
        self.enterContext(patch.object(rfq, 'TEAM', self.team))
        self.enterContext(patch.object(rfq.time, 'sleep'))
        self.enterContext(patch.object(rfq, 'load_native', return_value=(self.native, lambda: self)))
        self.phase = 'empty'
        self.editor = ''
        self.clipboard = ''
        self.events = []
        self.editor_focused = False
        self.wrong_paste = False
        self.changed_recipient = False
        self.fail_send = False
        self.receipt = True
        self.lose_lock = False
        self.blocked = False
        self.digest = 'a' * 64
        identity = rfq.chat_identity(self.snapshot())
        (self.out / 'fast-inspection.json').write_text(json.dumps({
            'identity': identity, 'digest': self.digest, 'at': time.time(),
            'lock_hash': hashlib.sha256(b'test-ticket').hexdigest()}))

    def snapshot(self):
        def e(role, label, index=1, **extra):
            return {'role': role, 'label': label, 'index': index, **extra}
        seller = 'changed' if self.changed_recipient and self.phase != 'empty' else 'seller'
        entries = [e('AXWindow', '', bounds=[0, 0, 1000, 800]),
                   e('AXStaticText', 'Перспективная Методика'),
                   e('AXStaticText', 'www.avito.ru/profile/messenger/channel/chat'),
                   e('AXImage', f'https://www.avito.ru/user/{seller}/profile?iid=1'),
                   e('AXHeading', 'Supplier'),
                   e('AXTextArea', 'Сообщение', index=184, bounds=[20, 600, 600, 60], value=self.editor)]
        if self.phase == 'empty':
            entries.append(e('AXStaticText', 'Чат создан.'))
        if self.phase == 'draft':
            entries.append(e('AXButton', 'Отправить', index=9))
            if self.blocked:
                entries.append(e('AXStaticText', 'Подтвердите, что вы человек'))
        if self.phase == 'sent':
            entries.append(e('AXStaticText', self.text, bounds=[600, 100, 320, 240]))
            if self.receipt:
                entries.append(e('AXStaticText', 'Доставлено', bounds=[840, 348, 80, 15]))
        return {'elements': entries, 'width': 1000, 'height': 800}

    def call_tool(self, name, args):
        if name == 'clipboard_write':
            self.clipboard = args['text']
        return {'text': self.clipboard}

    def native(self, args):
        if args['action'] == 'click' and args.get('element') != 9:
            self.assertEqual(args.get('element'), 184, 'Focus the fresh AX editor, not screenshot coordinates')
            self.assertNotIn('coordinate', args)
            self.editor_focused = True
        if args['action'] == 'capture':
            if args['mode'] == 'ax':
                return json.dumps(self.snapshot())
            raw = b'\x89PNG\r\n\x1a\nfixture'
            return {'content': [{'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + base64.b64encode(raw).decode()}}]}
        if args.get('keys') == 'cmd+v':
            self.assertTrue(self.editor_focused)
            self.events.append('paste')
            self.editor = 'WRONG' if self.wrong_paste else self.clipboard
            self.phase = 'draft'
            if self.lose_lock:
                self.active.write_text(json.dumps({'owner': 'commercial', 'ticket': 'other', 'created': time.time()}))
        if args.get('keys') == 'cmd+c':
            self.assertTrue(self.editor_focused)
            self.events.append('copy_actual_editor')
            self.clipboard = self.editor
        if args.get('element') == 9:
            self.events.append('send_once')
            self.phase, self.editor = 'sent', ''
            if self.fail_send:
                raise TimeoutError('Send returned no acknowledgement')
        return json.dumps({'ok': True})

    def run_submit(self, digest=None):
        args = ['helper', 'submit', '--lock-file', str(self.lock), '--supplier', 'Supplier',
                '--reviewed-image-sha256', digest or self.digest]
        output = io.StringIO()
        with patch.object(rfq.sys, 'argv', args), redirect_stdout(output):
            rfq.main()
        return json.loads(output.getvalue().strip())

    def pending(self):
        return json.loads((self.out / 'fast-pending.json').read_text())

    def test_one_call_pastes_verifies_sends_records_without_model(self):
        result = self.run_submit()
        self.assertEqual(result['status'], 'sent_verified')
        self.assertEqual(result['campaign_sent_verified'], 1)
        self.assertEqual(self.events, ['paste', 'copy_actual_editor', 'send_once'])
        self.assertEqual(self.pending()['evidence_type'], 'native_exact_text_delivery_empty_editor')
        self.assertEqual(json.loads((self.root / 'state.json').read_text())['monitor_recoveries'], ['preserve'])
        with self.assertRaisesRegex(ValueError, 'already recorded'):
            self.run_submit()
        self.assertEqual(self.events.count('send_once'), 1)

    def test_bad_recipient_review_prevents_paste(self):
        with self.assertRaisesRegex(ValueError, 'fresh review'):
            self.run_submit('b' * 64)
        self.assertEqual(self.events, [])

    def test_exact_text_check_stops_wrong_paste(self):
        self.wrong_paste = True
        with self.assertRaisesRegex(ValueError, 'Actual editor text differs'):
            self.run_submit()
        self.assertNotIn('send_once', self.events)

    def test_recipient_change_prevents_send(self):
        self.changed_recipient = True
        with self.assertRaisesRegex(ValueError, 'Recipient changed'):
            self.run_submit()
        self.assertNotIn('send_once', self.events)

    def test_lock_change_prevents_send(self):
        self.lose_lock = True
        with self.assertRaisesRegex(ValueError, 'Own unexpired'):
            self.run_submit()
        self.assertNotIn('send_once', self.events)

    def test_captcha_prevents_send(self):
        self.blocked = True
        with self.assertRaisesRegex(ValueError, 'UI blocked'):
            self.run_submit()
        self.assertNotIn('send_once', self.events)

    def test_timeout_persists_unknown_and_never_replays(self):
        self.fail_send = True
        with self.assertRaises(TimeoutError):
            self.run_submit()
        self.assertEqual(self.pending()['status'], 'send_unknown')
        with self.assertRaisesRegex(ValueError, 'Unresolved pending'):
            self.run_submit()
        self.assertEqual(self.events.count('send_once'), 1)

    def test_absent_delivery_receipt_remains_unknown(self):
        self.receipt = False
        result = self.run_submit()
        self.assertEqual(result['status'], 'send_unknown')
        self.assertEqual(self.events.count('send_once'), 1)
        with self.csv.open() as stream:
            self.assertEqual(list(csv.DictReader(stream)), [])

    def test_older_delivery_receipt_cannot_verify_new_message(self):
        self.receipt = False
        original = self.snapshot
        def with_old_receipt():
            snap = original()
            snap['elements'].extend([
                {'role': 'AXStaticText', 'label': 'An older unrelated message', 'bounds': [600, 5, 320, 30]},
                {'role': 'AXStaticText', 'label': 'Доставлено', 'bounds': [840, 40, 80, 15]}])
            return snap
        self.snapshot = with_old_receipt
        result = self.run_submit()
        self.assertEqual(result['status'], 'send_unknown')
        self.assertEqual(self.events.count('send_once'), 1)
        with self.csv.open() as stream:
            self.assertEqual(list(csv.DictReader(stream)), [])

    def test_missing_bounds_or_ambiguous_receipts_need_visual_review(self):
        self.phase = 'sent'
        snap = self.snapshot()
        snap['elements'][-1].pop('bounds')
        self.assertFalse(rfq.delivery_ready(snap, self.text))
        snap = self.snapshot()
        snap['elements'].append(dict(snap['elements'][-1]))
        self.assertFalse(rfq.delivery_ready(snap, self.text))

    def test_editor_value_or_send_button_prevents_delivery_claim(self):
        self.phase = 'sent'
        self.assertTrue(rfq.delivery_ready(self.snapshot(), self.text))
        self.editor = 'unfinished'
        self.assertFalse(rfq.delivery_ready(self.snapshot(), self.text))
        self.editor = ''
        snap = self.snapshot()
        snap['elements'].append({'role': 'AXButton', 'label': 'Отправить'})
        self.assertFalse(rfq.delivery_ready(snap, self.text))


if __name__ == '__main__':
    unittest.main()
