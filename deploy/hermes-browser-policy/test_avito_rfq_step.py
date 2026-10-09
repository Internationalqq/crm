import csv
import json
from pathlib import Path
import tempfile
import unittest

import avito_rfq_step as rfq


def element(role, label):
    return {'role': role, 'label': label, 'index': 1}


class GuardTests(unittest.TestCase):
    def test_seller_identity_comes_from_current_chat(self):
        snap = {'elements': [element('AXStaticText', 'Перспективная Методика'),
                element('AXStaticText', 'www.avito.ru/profile/messenger/channel/chat1'),
                element('AXImage', 'https://www.avito.ru/user/seller1/profile?src=chat')]}
        self.assertEqual(rfq.chat_identity(snap)['seller_id'], 'seller1')
        snap['elements'].append(element('AXStaticText', 'Чат в другом профиле'))
        with self.assertRaisesRegex(ValueError, 'UI blocked'):
            rfq.chat_identity(snap)

    def test_ambiguous_identity_refuses(self):
        with self.assertRaises(ValueError):
            rfq.chat_identity({'elements': []})

    def test_unknown_send_is_never_repeated(self):
        for status in ['send_unknown', 'sent_verified', 'draft']:
            with self.subTest(status=status), self.assertRaises(ValueError):
                rfq.check_capacity([{'seller_id': 'a', 'status': status}], {'seller_id': 'a'})

    def test_total_limit_includes_previous_work(self):
        rows = [{'seller_id': str(i), 'status': 'sent_verified'} for i in range(30)]
        with self.assertRaisesRegex(ValueError, 'limit'):
            rfq.check_capacity(rows, {'seller_id': 'new'})
        rows[-1]['status'] = 'send_unknown'
        with self.assertRaisesRegex(ValueError, 'limit'):
            rfq.check_capacity(rows, {'seller_id': 'new'})

    def test_unknown_send_discards_draft_review(self):
        draft_hash = 'a' * 64
        pending = {'image_path': 'draft.png', 'image_sha256': draft_hash,
                   'image_phase': 'draft', 'image_at': 1, 'evidence_path': 'draft.png'}
        rfq.mark_send_unknown(pending)
        self.assertEqual(pending['status'], 'send_unknown')
        for digest in [None, draft_hash]:
            with self.subTest(digest=digest), self.assertRaises(ValueError):
                rfq.require_review(pending, digest, 'after_send')
        self.assertNotIn('evidence_path', pending)
        pending.update(image_sha256='b' * 64, image_path='after.png', image_phase='after_send')
        rfq.require_review(pending, 'b' * 64, 'after_send')

    def test_delivery_error_blocks_confirmation(self):
        for text in ['Нет соединения', 'Не удалось отправить сообщение', 'Сообщение не отправлено']:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, 'UI blocked'):
                rfq.chat_identity({'elements': [element('AXStaticText', text)]})

    def test_suggested_reply_is_not_history_but_draft_prevents_fill(self):
        snap = {'elements': [element('AXStaticText', 'Чат создан.'),
                element('AXTextArea', 'Сообщение'), element('AXButton', 'RFQ')]}
        rfq.empty_conversation(snap, 'RFQ')
        snap['elements'].append(element('AXButton', 'Отправить'))
        with self.assertRaisesRegex(ValueError, 'draft'):
            rfq.empty_conversation(snap, 'RFQ')
        snap['elements'][-1]['label'] = 'Отправить сообщение'
        with self.assertRaisesRegex(ValueError, 'draft'):
            rfq.empty_conversation(snap, 'RFQ', visually_reviewed=True)

    def test_editor_focus_uses_ax_element_not_scaled_screenshot_coordinates(self):
        snap = {'width': 1568, 'height': 813, 'elements': [
            {'role': 'AXWindow', 'bounds': [0, 25, 1920, 995]},
            {**element('AXTextArea', 'Сообщение'), 'bounds': [1471, 964, 303, 44], 'index': 184}]}
        self.assertEqual(rfq.editor_element(snap), 184)
        snap['elements'][1]['bounds'][1] = 1100
        with self.assertRaisesRegex(ValueError, 'visible'):
            rfq.editor_element(snap)

    def test_clipboard_text_must_match_completely(self):
        self.assertTrue(rfq.contains_exact_text({'data': json.dumps({'text': 'RFQ'})}, 'RFQ'))
        self.assertFalse(rfq.contains_exact_text({'data': 'RFQ plus something'}, 'RFQ'))

    def test_noop_copy_does_not_accept_stale_paste_text(self):
        for reset_works, copy_works in [(True, False), (False, False), (True, True)]:
            clipboard = ['RFQ']
            def tool(name, args):
                if name == 'clipboard_write' and reset_works:
                    clipboard[0] = args['text']
                return {'text': clipboard[0]}
            def key(keys):
                if keys == 'cmd+c' and copy_works:
                    clipboard[0] = 'RFQ'
            with self.subTest(reset=reset_works, copy=copy_works):
                if reset_works and copy_works:
                    rfq.verify_copied_editor(tool, key, 'RFQ')
                else:
                    with self.assertRaises(ValueError):
                        rfq.verify_copied_editor(tool, key, 'RFQ')

    def test_inline_chat_requires_same_turn_account_proof(self):
        snap = {'elements': [element('AXStaticText', 'www.avito.ru/all?q=габионы'),
                element('AXImage', 'https://www.avito.ru/user/seller1/profile?iid=123')]}
        with self.assertRaisesRegex(ValueError, 'account'):
            rfq.chat_identity(snap)
        identity = rfq.chat_identity(snap, account_verified=True)
        self.assertEqual(identity['seller_id'], 'seller1')
        self.assertEqual(identity['listing_id'], '123')
        self.assertEqual(identity['chat_url'], '')

    def test_previous_message_prevents_fill(self):
        snap = {'elements': [element('AXStaticText', 'Чат создан.'),
                element('AXTextArea', 'Сообщение'), element('AXStaticText', 'RFQ')]}
        with self.assertRaisesRegex(ValueError, 'history'):
            rfq.empty_conversation(snap, 'RFQ')

    def test_nested_suggestion_text_is_not_a_delivered_message(self):
        snap = {'elements': [element('AXTextArea', 'Сообщение'),
                {**element('AXButton', 'RFQ'), 'bounds': [10, 10, 100, 40]},
                {**element('AXStaticText', 'RFQ'), 'bounds': [15, 15, 90, 210]}]}
        rfq.empty_conversation(snap, 'RFQ', visually_reviewed=True)
        self.assertFalse(rfq.visible_message(snap, 'RFQ'))
        snap['elements'].append({**element('AXStaticText', 'RFQ'), 'bounds': [10, 100, 100, 40]})
        self.assertTrue(rfq.visible_message(snap, 'RFQ'))

    def test_suggestion_cannot_confirm_send(self):
        snap = {'elements': [element('AXButton', 'RFQ')]}
        self.assertFalse(rfq.visible_message(snap, 'RFQ'))
        snap['elements'].append(element('AXStaticText', 'RFQ'))
        self.assertTrue(rfq.visible_message(snap, 'RFQ'))

    def test_unloaded_or_missing_editor_prevents_fill(self):
        for entries in [[], [element('AXTextArea', 'Сообщение')],
                        [element('AXStaticText', 'Чат создан.')]]:
            with self.subTest(entries=entries), self.assertRaises(ValueError):
                rfq.empty_conversation({'elements': entries}, 'RFQ')

    def test_ledger_retry_preserves_history_and_never_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'speed-benchmark-20261008').mkdir()
            fields = ['seller_id', 'supplier', 'profile_url', 'listing_url', 'sent_at', 'text', 'status', 'evidence']
            with (root / 'avito_outreach.csv').open('w', newline='') as stream:
                csv.DictWriter(stream, fields).writeheader()
            for filename in ['state.json', 'result.json']:
                (root / filename).write_text(json.dumps({'monitor_recoveries': ['old'], 'tab_cleanup': ['old']}))
            pending = {'seller_id': 'abc', 'supplier': 'Seller\u2028name', 'chat_url': 'chat', 'text': 'RFQ',
                       'verified_at': '2026-10-08T13:00:00Z', 'evidence_path': 'evidence.png'}
            self.assertEqual(rfq.record_verified(root, pending), 1)
            self.assertEqual(rfq.record_verified(root, pending), 1)
            with (root / 'avito_outreach.csv').open() as stream:
                self.assertEqual(len(list(csv.DictReader(stream))), 1)
            state = json.loads((root / 'state.json').read_text())
            self.assertEqual(state['monitor_recoveries'], ['old'])
            self.assertEqual(state['tab_cleanup'], ['old'])
            entries = (root / 'speed-benchmark-20261008/optimized.jsonl').read_text(encoding='utf-8').strip().split('\n')
            self.assertEqual(len(entries), 1)
            self.assertEqual(json.loads(entries[0])['supplier'], 'Seller\u2028name')
            with self.assertRaisesRegex(ValueError, 'Conflicting'):
                rfq.record_verified(root, {**pending, 'text': 'different'})


if __name__ == '__main__':
    unittest.main()
