"""Offline native-UI fixtures; no accounts, network, browser or real sends."""
import argparse
import csv
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import avito_rfq_step as rfq
import avito_rfq_batch as batch


def element(role, label='', index=1, bounds=None, **kw):
    return dict(role=role, label=label, index=index, bounds=bounds or [0, 0, 0, 0], **kw)


def search_snapshot(cards):
    elements = [element('AXWindow', bounds=[0, 25, 1920, 995]),
                element('AXWebArea', 'габионы - Авито', 37, [0, 110, 1920, 910]),
                element('AXHeading', '«Габионы»: объявления', 2, [302, 120, 380, 44]),
                element('AXStaticText', batch.SEARCH.removeprefix('https://')),
                element('AXComboBox', 'Найдите в Google или введите адрес', 3, [346, 73, 1180, 32])]
    for i, c in enumerate(cards):
        y = 180 + i * 250
        elements.extend([
            element('AXHeading', c['title'], 10 + i, [890, y, 350, 22]),
            element('AXLink', c['supplier'] + ' Рейтинг 5,0 · 10 отзывов', 20 + i, [1387, y, 226, 99]),
            element('AXStaticText', c['supplier'], 30 + i, [1390, y + 58, 213, 20]),
            element('AXStaticText', '5,0', 40 + i, [1476, y + 78, 23, 20]),
            element('AXStaticText', '10 отзывов', 50 + i, [1512, y + 78, 80, 20]),
            element('AXButton', 'Написать', 60 + i, [1390, y + 125, 220, 36]),
            element('AXStaticText', 'Производство сварных габионов в сборе из оцинкованной сетки. '
                    'Изготовление под заказ по размерам покупателя.', 70 + i, [890, y + 60, 455, 100])])
    return {'elements': elements}


def chat_snapshot(card, history=None):
    return {'elements': [
        element('AXWindow', bounds=[0, 25, 1920, 995]),
        element('AXStaticText', 'Перспективная Методика'),
        element('AXStaticText', 'www.avito.ru/profile/messenger/channel/test'),
        element('AXImage', 'https://www.avito.ru/user/' + card['supplier'] + '/profile?iid=42'),
        element('AXHeading', card['supplier'], bounds=[717, 277, 140, 20]),
        element('AXStaticText', card['title'], bounds=[717, 301, 400, 20]),
        element('AXStaticText', history or 'Отвечает за несколько часов', bounds=[800, 500, 300, 20]),
        element('AXHeading', 'Спросите у продавца', bounds=[655, 730, 250, 30]),
        element('AXTextArea', 'Сообщение', bounds=[656, 951, 609, 44]) ]}


class ParserTests(unittest.TestCase):
    def test_only_visible_relevant_cards_in_display_order(self):
        cards = [dict(title='Камень для габионов', supplier='Stone'),
                 dict(title='Габионы сварные', supplier='New'),
                 dict(title='Забор из габионов', supplier='Second'),
                 dict(title='Габионы', supplier='Offscreen')]
        self.assertEqual([x['supplier'] for x in batch.search_cards(search_snapshot(cards))], ['New', 'Second'])

    def test_ambiguous_write_control_is_not_a_candidate(self):
        snap = search_snapshot([dict(title='Габионы', supplier='Seller')])
        button = next(e for e in snap['elements'] if e['role'] == 'AXButton')
        snap['elements'].append(dict(button, index=999))
        self.assertEqual(batch.search_cards(snap), [])

    def test_machine_review_requires_matching_loaded_empty_chat(self):
        card = dict(title='Габионы', supplier='Seller')
        batch.require_empty_chat(chat_snapshot(card), card, 'RFQ', rfq)
        for history in ('Нам уже писали вчера', 'RFQ', 'Доставлено', '12:30'):
            with self.subTest(history=history), self.assertRaises(ValueError):
                batch.require_empty_chat(chat_snapshot(card, history), card, 'RFQ', rfq)
        with self.assertRaisesRegex(ValueError, 'Listing changed'):
            batch.require_empty_chat(chat_snapshot(card), dict(card, title='Другой габион'), 'RFQ', rfq)

    def test_machine_review_stops_on_existing_draft_or_block(self):
        card = dict(title='Габионы', supplier='Seller')
        for extra in (element('AXStaticText', 'Доступ ограничен: проблема с IP'),
                      element('AXButton', 'Отправить')):
            snap = chat_snapshot(card); snap['elements'].append(extra)
            with self.assertRaises(ValueError):
                batch.require_empty_chat(snap, card, 'RFQ', rfq)
        snap = chat_snapshot(card); snap['elements'][-1]['value'] = 'Unsent text'
        with self.assertRaisesRegex(ValueError, 'never overwrite'):
            batch.require_empty_chat(snap, card, 'RFQ', rfq)


class NativeTests(unittest.TestCase):
    def setUp(self):
        self.card = dict(title='Габионы', supplier='Seller')
        self.snap = search_snapshot([self.card])
        self.card = batch.search_cards(self.snap)[0]
        self.actions = []
        self.enterContext(patch.object(rfq, 'check_turn', return_value={'ticket': 'own'}))
        self.enterContext(patch.object(batch.time, 'sleep'))
        self.ui = batch.Native(rfq, self.call, Path('turn.json'))

    def call(self, args):
        if args['action'] == 'capture':
            return json.dumps(self.snap)
        self.actions.append(args)
        if args['action'] == 'scroll' and args['direction'] == 'up':
            next(e for e in self.snap['elements'] if e.get('label') == '«Габионы»: объявления')['bounds'][1] = 120
        return json.dumps({'ok': True})

    def test_search_resets_restored_scroll_using_observed_document(self):
        next(e for e in self.snap['elements'] if e.get('label') == '«Габионы»: объявления')['bounds'][1] = -900
        result = self.ui.search()
        self.assertTrue(batch.search_loaded(result, rfq))
        scrolls = [a for a in self.actions if a['action'] == 'scroll']
        self.assertEqual(len(scrolls), 2)
        self.assertTrue(all(a['element'] == 37 and a['direction'] == 'up' for a in scrolls))
        self.assertEqual(sum(a['action'] == 'set_value' for a in self.actions), 1)

    def test_scroll_uses_document_not_keyboard_focus(self):
        self.ui.page_down()
        self.assertEqual(self.actions, [dict(app='Firefox', action='scroll', direction='down', amount=3, element=37)])

    def test_changed_card_stops_before_click(self):
        for change in (dict(supplier='Other'), dict(description='A different offer'), dict(seller_context='Another city')):
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, 'changed or is ambiguous'):
                self.ui.open_chat(dict(self.card, **change))
        self.assertEqual(self.actions, [])

    def test_chat_open_waits_for_connection_before_single_expand(self):
        connecting = {'elements': [element('AXStaticText', 'Подключение'),
                                  element('AXLink', 'Открыть сообщения во весь экран', 88)]}
        stale = {'elements': [element('AXHeading', 'Previous seller'),
                              element('AXLink', 'Открыть сообщения во весь экран', 87),
                              element('AXTextArea', 'Сообщение')]}
        ready = {'elements': [element('AXLink', 'Открыть сообщения во весь экран', 89),
                              element('AXHeading', self.card['supplier']), element('AXTextArea', 'Сообщение')]}
        loading = chat_snapshot(self.card)
        loading['elements'] = [e for e in loading['elements'] if e.get('label') != 'Спросите у продавца']
        with patch.object(self.ui, 'capture', side_effect=[self.snap, stale, connecting, ready, loading, chat_snapshot(self.card)]):
            result = self.ui.open_chat(self.card)
        self.assertEqual(rfq.chat_identity(result)['seller_id'], 'Seller')
        self.assertEqual([a['element'] for a in self.actions], [60, 89])

    def test_back_accepts_search_without_a_relevant_visible_card(self):
        chat = chat_snapshot(self.card)
        chat['elements'].append(element('AXButton', 'Назад', 99, [120, 73, 25, 25]))
        with patch.object(self.ui, 'capture', side_effect=[chat, search_snapshot([])]):
            result = self.ui.back(self.card)
        self.assertTrue(batch.search_loaded(result, rfq))
        self.assertEqual([a['element'] for a in self.actions], [99])

    def test_back_collapses_only_completed_sellers_restored_empty_widget(self):
        chat = chat_snapshot(self.card)
        chat['elements'].append(element('AXButton', 'Назад', 99, [120, 73, 25, 25]))
        restored = search_snapshot([])
        restored['elements'].extend([element('AXHeading', self.card['supplier']),
                                    element('AXTextArea', 'Сообщение'), element('AXButton', 'Свернуть сообщения', 100)])
        with patch.object(self.ui, 'capture', side_effect=[chat, restored, search_snapshot([])]):
            self.ui.back(self.card)
        self.assertEqual([a['element'] for a in self.actions], [99, 100])

    def test_lost_lock_or_failed_action_never_retried(self):
        with patch.object(rfq, 'check_turn', side_effect=ValueError('lost lock')):
            with self.assertRaisesRegex(ValueError, 'lost lock'):
                self.ui.page_down()
        self.assertEqual(self.actions, [])
        with patch.object(self.ui, 'call', return_value='{"ok":false,"message":"unknown"}') as call:
            with self.assertRaisesRegex(ValueError, 'never replay'):
                self.ui.action(action='click', element=60)
            self.assertEqual(call.call_count, 1)


class BatchTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(); self.addCleanup(temp.cleanup)
        self.root = Path(temp.name); self.out = self.root / 'speed-benchmark-20261008'; self.out.mkdir()
        self.enterContext(patch.object(rfq, 'WORKSPACE', self.root))
        self.enterContext(patch.object(rfq, 'check_turn', return_value={'ticket': 'same-own-turn'}))
        (self.root / 'task.json').write_text(json.dumps({'campaign_id': 'gabions-20261008-30google-30avito', 'request_text': 'RFQ'}))
        self.csv = self.root / 'avito_outreach.csv'
        self.rows = [dict(seller_id=str(i), supplier='Old' + str(i), status='sent_verified') for i in range(27)]
        self.write_rows()
        self.cards = [dict(title='Габионы', supplier='New' + str(i)) for i in range(3)]
        self.opened, self.sent, self.backs = [], [], 0
        self.blocked, self.unknown, self.old_history = False, False, False
        self.search_calls = 0
        self.enterContext(patch.object(batch, 'Native', return_value=self))
        self.enterContext(patch.object(rfq, 'main', side_effect=self.submit))
        self.lock_file = self.root / 'turn.json'

    def write_rows(self):
        with self.csv.open('w', newline='') as f:
            w = csv.DictWriter(f, ['seller_id', 'supplier', 'status']); w.writeheader(); w.writerows(self.rows)

    def capture(self):
        snap = search_snapshot(self.cards)
        if self.blocked:
            snap['elements'].append(element('AXStaticText', 'Доступ ограничен'))
        return batch.guard(snap, rfq)

    def search(self):
        self.search_calls += 1
        return self.capture()

    def page_down(self):
        return self.capture()

    def open_chat(self, card):
        self.opened.append(card['supplier'])
        return chat_snapshot(card, 'An old message' if self.old_history else None)

    def back(self, card):
        self.backs += 1
        return self.capture()

    def evidence(self):
        return {}

    def submit(self, args, machine_candidate):
        self.assertEqual(args.step, 'submit')
        self.assertIsNone(args.reviewed_image_sha256)  # Never fabricate visual review.
        self.assertEqual(args.supplier, machine_candidate['supplier'])
        self.sent.append(args.supplier)
        if self.unknown:
            print(json.dumps({'status': 'send_unknown'})); return
        self.rows.append(dict(seller_id=args.supplier, supplier=args.supplier, status='sent_verified')); self.write_rows()
        print(json.dumps({'status': 'sent_verified', 'supplier': args.supplier}))

    def execute(self, step, digest=None):
        args = argparse.Namespace(step=step, lock_file='turn.json', approved_plan_sha256=digest)
        return batch.run(args, rfq, None, True)

    def test_three_remaining_sent_in_one_batch_without_model_between(self):
        plan = self.execute('scan')
        self.assertEqual(plan['target'], 3)
        self.assertEqual(len(plan['candidates']), 3)
        self.assertEqual(self.sent, [])
        result = self.execute('run_batch', plan['plan_sha256'])
        self.assertEqual((result['status'], result['completed'], self.backs), ('complete', 3, 3))
        self.assertEqual(self.sent, ['New0', 'New1', 'New2'])
        self.assertEqual(len(self.rows), 30)
        before = (self.out / 'mechanical-result.json').read_bytes()
        self.execute('run_batch', plan['plan_sha256'])
        self.assertEqual(len(self.sent), 3)
        self.assertEqual((self.out / 'mechanical-result.json').read_bytes(), before)

    def test_captcha_stops_before_search_navigation(self):
        self.blocked = True
        result = self.execute('scan')
        self.assertEqual(result['status'], 'needs_inspection')
        self.assertEqual(self.search_calls, 0)
        self.assertEqual(self.sent, [])

    def test_unrelated_tab_or_existing_draft_preserved_before_navigation(self):
        with patch.object(self, 'capture', return_value={'elements': [element('AXStaticText', 'mail.ru')]}):
            self.assertEqual(self.execute('scan')['status'], 'needs_inspection')
        snap = chat_snapshot(self.cards[0])
        next(e for e in snap['elements'] if e['role'] == 'AXTextArea')['value'] = 'Keep this draft'
        with self.assertRaisesRegex(ValueError, 'never overwrite'):
            batch.guard(snap, rfq)
        self.assertEqual(self.search_calls, 0)

    def test_changed_or_unapproved_plan_does_not_navigate(self):
        plan = self.execute('scan'); before = self.search_calls
        self.assertEqual(self.execute('run_batch', 'a' * 64)['status'], 'needs_inspection')
        self.assertEqual(self.search_calls, before)
        (self.root / 'task.json').write_text(json.dumps({'campaign_id':'other', 'request_text':'CHANGED'}))
        self.assertEqual(self.execute('run_batch', plan['plan_sha256'])['status'], 'needs_inspection')
        self.assertEqual(self.sent, [])

    def test_pending_unknown_is_never_overwritten_or_replayed(self):
        p = self.out / 'fast-pending.json'; p.write_text('{"status":"send_unknown"}')
        result = self.execute('scan')
        self.assertEqual(result['status'], 'needs_inspection')
        self.assertEqual(p.read_text(), '{"status":"send_unknown"}')
        self.assertEqual(self.search_calls, 0)

    def test_unknown_delivery_stops_without_next_recipient_or_back(self):
        plan = self.execute('scan'); self.unknown = True
        result = self.execute('run_batch', plan['plan_sha256'])
        self.assertEqual(result['completed'], 0)
        self.assertEqual(result['status'], 'needs_inspection')
        self.assertEqual(self.opened, ['New0'])
        self.assertEqual(self.backs, 0)
        self.execute('run_batch', plan['plan_sha256'])
        self.assertEqual(self.sent, ['New0'])

    def test_nonempty_history_stops_without_send(self):
        plan = self.execute('scan'); self.old_history = True
        self.assertEqual(self.execute('run_batch', plan['plan_sha256'])['status'], 'needs_inspection')
        self.assertEqual(self.sent, [])

    def test_duplicate_seller_id_is_skipped_even_if_name_changed(self):
        self.cards = [dict(title='Габионы', supplier='Renamed')]
        plan = self.execute('scan')
        snap = chat_snapshot(self.cards[0])
        next(e for e in snap['elements'] if e['role'] == 'AXImage')['label'] = 'https://www.avito.ru/user/0/profile?iid=42'
        with patch.object(self, 'open_chat', return_value=snap):
            result = self.execute('run_batch', plan['plan_sha256'])
        self.assertEqual(result['completed'], 0)
        self.assertEqual(result['skipped'][0]['reason'], 'already_in_ledger')
        self.assertEqual(self.sent, [])

    def test_stop_evidence_is_saved_with_partial_progress(self):
        plan = self.execute('scan'); self.unknown = True
        with patch.object(self, 'evidence', return_value={'image_path': 'evidence.png'}):
            result = self.execute('run_batch', plan['plan_sha256'])
        saved = json.loads((self.out / 'mechanical-result.json').read_text(encoding='utf-8'))
        self.assertEqual(saved, result)
        self.assertEqual(saved['image_path'], 'evidence.png')

    def test_expired_plan_or_changed_lock_is_rejected(self):
        import time
        plan = self.execute('scan')
        with patch.object(batch.time, 'time', return_value=time.time() + 901):
            self.assertEqual(self.execute('run_batch', plan['plan_sha256'])['status'], 'needs_inspection')
        with patch.object(rfq, 'check_turn', return_value={'ticket': 'new-turn'}):
            self.assertEqual(self.execute('run_batch', plan['plan_sha256'])['status'], 'needs_inspection')
        self.assertEqual(self.search_calls, 1)
        self.assertEqual(self.sent, [])


if __name__ == '__main__':
    unittest.main()
