"""Observed search cards -> one model review -> bounded native UI batch.

No web API, generated seller URLs, model calls within the loop, or Send retries.
Only the existing gabion campaign, browser/account and remaining limit apply.
"""
import argparse
import base64
from contextlib import redirect_stdout
import csv
import hashlib
import io
import json
import re
import time

SEARCH = 'https://www.avito.ru/all/remont_i_stroitelstvo?q=габионы'
REFUSALS = ('Доступ ограничен', 'Чат в другом профиле', 'Подтвердите, что',
            'Войдите в аккаунт', 'Вход или регистрация', 'Не удалось отправить',
            'Сообщение не отправлено', 'Нет соединения', 'Слишком много запросов')


def norm(text):
    return ' '.join(text.casefold().split())


def guard(snapshot, rfq):
    body = '\n'.join(rfq.labels(snapshot))
    for marker in REFUSALS:
        if marker in body:
            raise ValueError('UI blocked: ' + marker)
    if (any(e.get('role') == 'AXTextArea' and e.get('value') for e in snapshot['elements'])
            or any(e.get('role') == 'AXButton' and e.get('label') in rfq.SEND_LABELS for e in snapshot['elements'])):
        raise ValueError('Existing editor text or draft; never overwrite')
    return snapshot


def signature(card):
    return tuple(norm(card.get(k, '')) for k in ('title', 'supplier', 'description', 'seller_context'))


def read_ledger(rfq):
    with (rfq.WORKSPACE / 'avito_outreach.csv').open(encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


def search_loaded(snapshot, rfq, allow_chat=False):
    return (SEARCH.removeprefix('https://') in rfq.labels(snapshot)
            and any(e['role'] == 'AXHeading' and e.get('label') == '«Габионы»: объявления'
                    for e in snapshot['elements'])
            and (allow_chat or not any(e['role'] == 'AXTextArea' for e in snapshot['elements'])))


def search_cards(snapshot):
    """Conservative adapter for the observed desktop search layout only."""
    elements = snapshot['elements']
    window = next(e['bounds'] for e in elements if e['role'] == 'AXWindow')
    wx, wy, ww, wh = window
    headings = sorted((e for e in elements if e['role'] == 'AXHeading'
                       and e.get('bounds', [0])[0] >= wx + ww * .4), key=lambda e: e['bounds'][1])
    cards = []
    for i, heading in enumerate(headings):
        x, y, _, _ = heading['bounds']
        bottom = headings[i + 1]['bounds'][1] if i + 1 < len(headings) else y + 450
        title = heading.get('label', '')
        if not re.search('габион', title, re.I) or re.search('камень|щебень|песок|монтаж|установка', title, re.I):
            continue
        sellers = [e for e in elements if e['role'] == 'AXLink' and ' Рейтинг ' in e.get('label', '')
                   and e['bounds'][0] > x + 300 and abs(e['bounds'][1] - y) < 8]
        writes = [e for e in elements if e['role'] == 'AXButton' and e.get('label') == 'Написать'
                  and e['bounds'][0] > x + 300 and y <= e['bounds'][1] < bottom]
        if len(sellers) != 1 or len(writes) != 1:
            continue
        link, button = sellers[0], writes[0]
        sx, sy, sw, sh = link['bounds']
        names = [e['label'] for e in elements if e['role'] == 'AXStaticText' and e.get('label')
                 and sx <= e['bounds'][0] < sx + sw and sy - 2 <= e['bounds'][1] <= sy + sh
                 and not re.fullmatch(r'[\d\s.,·]+|\d+\s+отзыв\w*', e['label'])]
        if len(names) != 1:
            continue
        # Only fully visible cards can be approved or clicked. Off-screen AX
        # nodes are retained by Firefox and must not create an invisible queue.
        if not (wy + 100 <= y and button['bounds'][1] + button['bounds'][3] <= wy + wh):
            continue
        descriptions = [e['label'] for e in elements if e['role'] == 'AXStaticText'
                        and e.get('label') and len(e['label']) > 100 and e['bounds'][0] == x
                        and y < e['bounds'][1] < bottom]
        cards.append({'title': title, 'supplier': names[0], 'description': ' '.join(descriptions),
                      'seller_context': link['label'],
                      'button': button['index']})
    return cards


def require_empty_chat(snapshot, candidate, text, rfq):
    """Machine review is stricter than visual review; ambiguity stops the batch."""
    guard(snapshot, rfq)
    headings = [e for e in snapshot['elements'] if e['role'] == 'AXHeading']
    seller = [e for e in headings if norm(e.get('label', '')) == norm(candidate['supplier'])]
    suggestion = [e for e in snapshot['elements'] if e.get('label') == 'Спросите у продавца']
    if len(seller) != 1 or not suggestion:
        raise ValueError('Loaded empty chat not proved; model must inspect')
    if not any(norm(candidate['title']) in norm(s) for s in rfq.labels(snapshot)):
        raise ValueError('Listing changed; model must inspect')
    editor = rfq.empty_conversation(snapshot, text, visually_reviewed=True)
    if editor.get('value'):
        raise ValueError('Existing editor text; never overwrite')
    left = editor['bounds'][0] - 40
    right = editor['bounds'][0] + editor['bounds'][2] + 50
    top = seller[0]['bounds'][1] + 60
    bottom = min(e['bounds'][1] for e in suggestion)
    center = [e.get('label', '') for e in rfq.history_elements(snapshot) if e.get('bounds')
              and left <= e['bounds'][0] <= right and top <= e['bounds'][1] < bottom]
    markers = ('Отвечает ', 'Пользователь редко отвечает на сообщения', 'Чат создан.')
    allowed = ('Сегодня', 'Показать телефон', 'Купить')
    if not any(s.startswith(markers) for s in center) or any(s and s not in allowed and not s.startswith(markers) for s in center):
        raise ValueError('History is not provably empty; model must inspect')


class Native:
    def __init__(self, rfq, call, lock_file):
        self.rfq, self.call, self.lock_file = rfq, call, lock_file
        self.deadline = time.monotonic() + 540

    def check(self):
        self.rfq.check_turn(self.lock_file)
        if time.monotonic() >= self.deadline:
            raise ValueError('Batch time budget reached; preserve progress')

    def capture(self):
        self.check()
        return guard(json.loads(self.call({'action': 'capture', 'app': 'Firefox', 'mode': 'ax', 'max_elements': 2000})), self.rfq)

    def action(self, **args):
        self.check()
        result = json.loads(self.call({'app': 'Firefox', **args}))
        if not result.get('ok'):
            raise ValueError('Native action not confirmed; inspect, never replay: ' + str(result.get('message')))

    def wait(self, predicate):
        end = min(self.deadline, time.monotonic() + 12)
        while True:
            snap = self.capture()
            if predicate(snap):
                return snap
            if time.monotonic() >= end:
                raise ValueError('Page did not reach expected state; model must inspect')
            time.sleep(.4)

    def search(self):
        snap = self.capture()
        address = [e for e in snap['elements'] if e['role'] == 'AXComboBox' and e.get('label') == 'Найдите в Google или введите адрес']
        if len(address) != 1:
            raise ValueError('Address field not uniquely observed')
        self.action(action='click', element=address[0]['index'], delivery_mode='foreground')
        snap = self.capture()
        address = next(e for e in snap['elements'] if e['role'] == 'AXComboBox' and e.get('label') == 'Найдите в Google или введите адрес')
        self.action(action='set_value', element=address['index'], value=SEARCH)
        self.action(action='key', keys='return')
        snap = self.wait(lambda s: search_loaded(s, self.rfq))
        # Same-URL navigation can restore an old scroll position. Reset the
        # observed document, without assuming keyboard focus in page content.
        for _ in range(10):
            before = next(e['bounds'] for e in snap['elements'] if e.get('label') == '«Габионы»: объявления')
            snap = self.scroll(snap, 'up', 50)
            after = next(e['bounds'] for e in snap['elements'] if e.get('label') == '«Габионы»: объявления')
            if before == after and after[1] >= 110:
                return snap
        raise ValueError('Search scroll position not stable; model must inspect')

    def scroll(self, snap, direction, amount):
        areas = [e for e in snap['elements'] if e['role'] == 'AXWebArea']
        if len(areas) != 1 or not search_loaded(snap, self.rfq):
            raise ValueError('Search document not uniquely observed')
        self.action(action='scroll', direction=direction, amount=amount, element=areas[0]['index'])
        return self.capture()

    def page_down(self):
        return self.scroll(self.capture(), 'down', 3)

    def open_chat(self, card):
        snap = self.capture()
        matches = [c for c in search_cards(snap) if signature(c) == signature(card)]
        if len(matches) != 1:
            raise ValueError('Approved search card changed or is ambiguous')
        self.action(action='click', element=matches[0]['button'], delivery_mode='foreground')
        # A link exposed during "Подключение" can still be stale. Wait only by
        # capturing, never click the same control again after an unknown result.
        snap = self.wait(lambda s: 'Подключение' not in self.rfq.labels(s)
                         and any(e.get('label') == 'Открыть сообщения во весь экран' for e in s['elements'])
                         and any(e['role'] == 'AXHeading' and norm(e.get('label', '')) == norm(card['supplier']) for e in s['elements'])
                         and any(e['role'] == 'AXTextArea' and e.get('label') == 'Сообщение' for e in s['elements']))
        links = [e for e in snap['elements'] if e.get('label') == 'Открыть сообщения во весь экран']
        if len(links) != 1:
            raise ValueError('Full chat control ambiguous')
        self.action(action='click', element=links[0]['index'], delivery_mode='foreground')
        return self.wait(lambda s: 'Перспективная Методика' in self.rfq.labels(s)
                         and any(e['role'] == 'AXHeading' and norm(e.get('label', '')) == norm(card['supplier']) for e in s['elements'])
                         and any(e['role'] == 'AXTextArea' for e in s['elements'])
                         and 'Спросите у продавца' in self.rfq.labels(s))

    def back(self, card):
        snap = self.capture()
        buttons = [e for e in snap['elements'] if e['role'] == 'AXButton' and e.get('label') == 'Назад' and e['bounds'][1] < 110]
        if len(buttons) != 1:
            raise ValueError('Browser Back unavailable; do not close an unknown tab')
        self.action(action='click', element=buttons[0]['index'], delivery_mode='foreground')
        snap = self.wait(lambda s: search_loaded(s, self.rfq, allow_chat=True))
        if any(e['role'] == 'AXTextArea' for e in snap['elements']):
            # Firefox may restore the just-used inline chat with Back. Collapse
            # only this seller's empty editor; do not close another work tab.
            if not any(e['role'] == 'AXHeading' and norm(e.get('label', '')) == norm(card['supplier']) for e in snap['elements']):
                raise ValueError('Unexpected restored chat; preserve it for inspection')
            collapse = [e for e in snap['elements'] if e['role'] == 'AXButton' and e.get('label') == 'Свернуть сообщения']
            if len(collapse) != 1:
                raise ValueError('Cannot collapse completed inline chat')
            self.action(action='click', element=collapse[0]['index'], delivery_mode='foreground')
            snap = self.wait(lambda s: search_loaded(s, self.rfq))
        return snap

    def evidence(self):
        result = self.call({'action': 'capture', 'app': 'Firefox', 'mode': 'vision'})
        for part in result.get('content', []):
            if part.get('type') == 'image_url':
                uri = part['image_url']['url']; raw = base64.b64decode(uri.split(',', 1)[1])
                suffix = '.jpg' if uri.startswith('data:image/jpeg') else '.png'
                path = self.rfq.WORKSPACE / ('speed-benchmark-20261008/batch-' + str(time.time_ns()) + suffix)
                path.write_bytes(raw)
                return {'image_path': str(path), 'image_sha256': hashlib.sha256(raw).hexdigest()}
        return {}


def run(args, rfq, call, account_verified):
    out = rfq.WORKSPACE / 'speed-benchmark-20261008'
    plan_path, result_path = out / 'mechanical-plan.json', out / 'mechanical-result.json'
    ui = Native(rfq, call, rfq.WORKSPACE / args.lock_file)
    started = time.monotonic()
    result = {'status': 'needs_inspection', 'automatic_retry': False, 'completed': 0, 'skipped': [], 'samples': []}
    try:
        initial = ui.capture()  # Inspect refusals BEFORE any navigation, including scan.
        addresses = [s for s in rfq.labels(initial) if s.startswith('www.avito.ru/')]
        if len(set(addresses)) != 1 or not (search_loaded(initial, rfq) or '/profile/messenger/' in addresses[0]):
            raise ValueError('Start in the existing Avito search or messenger tab; preserve other work')
        if not account_verified:
            raise ValueError('Confirm working account once in this own GUI turn')
        pending_path = out / 'fast-pending.json'
        if pending_path.exists() and json.loads(pending_path.read_text(encoding='utf-8')).get('status') != 'sent_verified':
            raise ValueError('Unresolved pending send; inspect before scan/batch')
        task = json.loads((rfq.WORKSPACE / 'task.json').read_text(encoding='utf-8'))
        request_hash = hashlib.sha256(task['request_text'].encode()).hexdigest()
        lock_hash = hashlib.sha256(rfq.check_turn(ui.lock_file)['ticket'].encode()).hexdigest()
        rows = read_ledger(rfq)
        occupied = {r['seller_id'] for r in rows if r.get('status') not in ('draft', 'blocked_not_sent', 'not_sent')}
        target = min(10, 30 - len(occupied))
        if target <= 0:
            raise ValueError('Campaign limit reached')
        if args.step == 'scan':
            seen = {norm(r['supplier']) for r in rows}; cards = []
            snap = ui.search()
            for page in range(30):
                for card in search_cards(snap):
                    if norm(card['supplier']) not in seen:
                        seen.add(norm(card['supplier']))
                        cards.append({k: v for k, v in card.items() if k != 'button'} | {'page': page})
                        if len(cards) >= target:
                            break
                if len(cards) >= target:
                    break
                snap = ui.page_down()
            if not cards:
                raise ValueError('No new suitable visible sellers; model must inspect')
            plan = {'at': time.time(), 'lock_hash': lock_hash, 'request_hash': request_hash,
                    'search_url': SEARCH, 'campaign_id': task['campaign_id'], 'candidates': cards}
            rfq.save(plan_path, plan)
            return {'status': 'review_candidates', 'plan_sha256': hashlib.sha256(plan_path.read_bytes()).hexdigest(),
                    'candidates': cards, 'target': target, 'remaining_campaign': 30 - len(occupied),
                    'scan_seconds': time.monotonic() - started}
        raw = plan_path.read_bytes(); plan = json.loads(raw)
        digest = hashlib.sha256(raw).hexdigest()
        if (digest != args.approved_plan_sha256 or plan['lock_hash'] != lock_hash or plan['request_hash'] != request_hash
                or time.time() - plan['at'] > 900 or plan['campaign_id'] != task['campaign_id']
                or plan['search_url'] != SEARCH or not 0 < len(plan['candidates']) <= target):
            raise ValueError('Fresh approved plan for this own turn and request required')
        if result_path.exists() and json.loads(result_path.read_text(encoding='utf-8')).get('plan_sha256') == digest:
            raise ValueError('This batch was already attempted; inspect its saved result, never replay')
        result.update(status='running', plan_sha256=digest, started_at=rfq.now())
        rfq.save(result_path, result)
        snap = ui.search(); page = 0
        for candidate in plan['candidates']:
            recipient_start = time.monotonic()
            while page < candidate['page']:
                snap = ui.page_down(); page += 1
            result['current'] = candidate; rfq.save(result_path, result)
            snap = ui.open_chat(candidate)
            identity = rfq.chat_identity(snap)
            rows = read_ledger(rfq)
            if any(r['seller_id'] == identity['seller_id'] for r in rows):
                result['skipped'].append({'supplier': candidate['supplier'], 'seller_id': identity['seller_id'], 'reason': 'already_in_ledger'})
            else:
                require_empty_chat(snap, candidate, task['request_text'], rfq)
                # Reuse all existing exact-text, identity, limit, receipt and
                # durable unknown-send guards. Never manufacture a review hash.
                output = io.StringIO()
                submit = argparse.Namespace(step='submit', lock_file=str(ui.lock_file), supplier=candidate['supplier'],
                                            listing_url=None, reviewed_image_sha256=None, approved_plan_sha256=None)
                with redirect_stdout(output):
                    rfq.main(submit, machine_candidate=candidate)
                sent = json.loads(output.getvalue().strip().splitlines()[-1])
                if sent.get('status') != 'sent_verified':
                    raise ValueError('Delivery unknown; inspect actual result, no next seller')
                result['samples'].append({**sent, 'open_through_delivery_seconds': time.monotonic() - recipient_start})
                result['completed'] += 1
            rfq.save(result_path, result)
            snap = ui.back(candidate)  # Reuse the search tab; no extra work tabs accumulate.
        result.update(status='complete', finished_at=rfq.now(), batch_seconds=time.monotonic() - started)
    except (ValueError, OSError, KeyError, StopIteration, TypeError) as error:
        result.update(status='needs_inspection', reason=str(error), stopped_at=rfq.now(), batch_seconds=time.monotonic() - started)
        # An attempted plan result is append-only in effect: a rejected replay
        # must not replace its original progress/evidence.
        try:
            result.update(ui.evidence())
        except (OSError, ValueError, KeyError, TypeError):
            pass
        if result.get('plan_sha256'):
            rfq.save(result_path, result)
        return result
    rfq.save(result_path, result)
    return result
