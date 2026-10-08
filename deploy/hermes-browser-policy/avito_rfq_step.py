"""Bounded native-UI RFQ steps for Gulya's already-authorized gabion campaign.

No browser protocol, network requests, automatic Send retry, or new recipients.
The agent selects a relevant seller, reviews each returned screenshot, then
calls the next step. Bookkeeping and native actions do not need model turns.
"""
import argparse
import base64
import csv
import hashlib
import json
import os
import plistlib
from pathlib import Path
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit, parse_qs

HOME = Path('/Users/egor/.hermes/profiles/gulya')
WORKSPACE = HOME / 'workspace/gabions-20261008'
TEAM = Path('/Users/egor/.hermes/team-browser-access')
REPO = Path('/Users/egor/.hermes/hermes-agent')


def now():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, path)


def labels(snapshot):
    return [e.get('label', '') for e in snapshot.get('elements', [])
            if e.get('role') not in ('AXMenu', 'AXMenuItem', 'AXMenuBarItem')]


SEND_LABELS = ('Отправить', 'Отправить сообщение')


def chat_identity(snapshot, account_verified=False):
    """Only accept identity actually exposed in the current native UI."""
    texts = labels(snapshot)
    body = '\n'.join(texts)
    for refusal in ('Доступ ограничен', 'Чат в другом профиле', 'Подтвердите, что',
                    'Попробуйте обновить страницу', 'Войдите в аккаунт',
                    'Нет соединения', 'Не удалось отправить сообщение',
                    'Сообщение не отправлено'):
        if refusal in body:
            raise ValueError('UI blocked: ' + refusal)
    if 'Перспективная Методика' not in texts and not account_verified:
        raise ValueError('Working account not confirmed in current UI')
    urls = [t for t in texts if t.startswith('www.avito.ru/')]
    if len(set(urls)) != 1:
        raise ValueError('Exact chat URL unavailable')
    sellers = set()
    listing_ids = set()
    for text in texts:
        if text.startswith('https://www.avito.ru/user/'):
            match = re.fullmatch(r'/user/([a-zA-Z0-9]+)/profile', urlsplit(text).path)
            if match:
                sellers.add(match[1])
                listing_ids.update(parse_qs(urlsplit(text).query).get('iid', []))
    if len(sellers) != 1:
        raise ValueError('Exact seller identity unavailable; inspect rather than guess')
    page_url = 'https://' + urls[0]
    return {'seller_id': sellers.pop(), 'page_url': page_url,
            'chat_url': page_url if '/profile/messenger/channel/' in page_url else '',
            'listing_id': next(iter(listing_ids)) if len(listing_ids) == 1 else ''}


def unique_editor(snapshot):
    editors = [e for e in snapshot.get('elements', [])
               if e.get('role') == 'AXTextArea' and e.get('label') == 'Сообщение']
    if len(editors) != 1:
        raise ValueError('Exactly one message editor required')
    return editors[0]


def check_capacity(rows, identity):
    sent = {r['seller_id'] for r in rows
            if r.get('status') not in ('draft', 'blocked_not_sent', 'not_sent')}
    if len(sent) >= 30:
        raise ValueError('Campaign limit 30 reached')
    if any(r.get('seller_id') == identity['seller_id'] for r in rows):
        raise ValueError('Seller already recorded; never repeat')


def history_texts(snapshot):
    buttons = [e for e in snapshot['elements'] if e.get('role') == 'AXButton' and e.get('bounds')]
    for e in snapshot['elements']:
        if e.get('role') != 'AXStaticText':
            continue
        bounds = e.get('bounds')
        if bounds and any(b.get('label') == e.get('label') and
                          b['bounds'][0] <= bounds[0] < b['bounds'][0] + b['bounds'][2]
                          and b['bounds'][1] <= bounds[1] < b['bounds'][1] + b['bounds'][3]
                          for b in buttons):
            continue
        yield e.get('label', '')


def empty_conversation(snapshot, text, visually_reviewed=False):
    body = '\n'.join(labels(snapshot))
    if not visually_reviewed and not any(marker in body for marker in ('Нет сообщений', 'Пока нет сообщений', 'Чат создан.')):
        raise ValueError('Loaded empty conversation not proved; inspect history')
    if any(e.get('role') == 'AXButton' and e.get('label') in SEND_LABELS for e in snapshot['elements']):
        raise ValueError('Existing draft must be inspected')
    # A suggested reply is an AXButton, not a sent message.
    if any(text in label for label in history_texts(snapshot)):
        raise ValueError('RFQ already visible in history; do not repeat')
    return unique_editor(snapshot)


def visible_message(snapshot, text):
    expected = ' '.join(text.split())
    return any(' '.join(label.split()) == expected for label in history_texts(snapshot))


def require_review(pending, digest, phase):
    if (not digest or len(digest) != 64 or digest != pending.get('image_sha256')
            or pending.get('image_phase') != phase or not pending.get('image_path')):
        raise ValueError('Fresh screenshot review of the correct phase is required')


def mark_send_unknown(pending):
    pending.update(status='send_unknown', send_requested_at=now())
    for field in ('image_path', 'image_sha256', 'image_at', 'image_phase', 'evidence_path'):
        pending.pop(field, None)


def editor_point(snapshot):
    editor = unique_editor(snapshot)
    window = next(e for e in snapshot['elements'] if e['role'] == 'AXWindow')
    wx, wy, ww, wh = window['bounds']
    x, y, width, height = editor['bounds']
    if not (ww > 0 and wh > 0 and width > 0 and height > 0 and
            wx <= x and wy <= y and x + width <= wx + ww and y + height <= wy + wh):
        raise ValueError('Message editor must be visible inside the captured window')
    return [round((x + width / 2 - wx) * snapshot['width'] / ww),
            round((y + height / 2 - wy) * snapshot['height'] / wh)]


def contains_exact_text(value, expected):
    if isinstance(value, dict):
        return any(contains_exact_text(v, expected) for v in value.values())
    if isinstance(value, list):
        return any(contains_exact_text(v, expected) for v in value)
    if isinstance(value, str):
        if value == expected:
            return True
        try:
            parsed = json.loads(value)
            return not isinstance(parsed, str) and contains_exact_text(parsed, expected)
        except ValueError:
            pass
    return False


def verify_copied_editor(call_tool, press_key, expected):
    # A failed Copy must not accept the RFQ left in the clipboard by Paste.
    sentinel = 'rfq-copy-check-' + str(time.time_ns())
    reset = call_tool('clipboard_write', {'text': sentinel})
    if reset.get('isError') or not contains_exact_text(
            call_tool('clipboard_read', {'include_text': True}), sentinel):
        raise ValueError('Clipboard reset failed; no Send attempted')
    for keys in ('cmd+a', 'cmd+c'):
        press_key(keys)
    copied = call_tool('clipboard_read', {'include_text': True})
    if copied.get('isError') or not contains_exact_text(copied, expected):
        raise ValueError('Actual editor text differs; no Send attempted')


def record_verified(workspace, pending):
    """Idempotent after visual review; CSV is the authoritative send ledger."""
    csv_path = workspace / 'avito_outreach.csv'
    with csv_path.open(encoding='utf-8', newline='') as stream:
        reader = csv.DictReader(stream)
        fields, rows = reader.fieldnames, list(reader)
    existing = [r for r in rows if r['seller_id'] == pending['seller_id']]
    if existing:
        if len(existing) != 1 or existing[0].get('status') != 'sent_verified' or existing[0].get('text') != pending['text'] or existing[0].get('evidence') != pending['evidence_path']:
            raise ValueError('Conflicting ledger entry')
    else:
        check_capacity(rows, pending)
        row = {key: pending.get(key, '') for key in fields}
        row.update(status='sent_verified', sent_at=pending['verified_at'], evidence=pending['evidence_path'])
        rows.append(row)
        tmp = csv_path.with_name(csv_path.name + '.tmp')
        with tmp.open('w', encoding='utf-8', newline='') as stream:
            writer = csv.DictWriter(stream, fields)
            writer.writeheader()
            writer.writerows(rows)
        os.replace(tmp, csv_path)
    count = len({r['seller_id'] for r in rows if r.get('status') == 'sent_verified'})
    for name, field in [('state.json', 'avito_sent_verified'), ('result.json', 'avito_unique_sellers_sent')]:
        path = workspace / name
        data = json.loads(path.read_text())
        data.update({field: count, 'updated_at': now()})
        save(path, data)
    benchmark = workspace / 'speed-benchmark-20261008/optimized.jsonl'
    entries = [json.loads(line) for line in benchmark.read_text().splitlines() if line.strip()] if benchmark.exists() else []
    if not any(r['seller_id'] == pending['seller_id'] for r in entries):
        entries.append({**pending, 'status': 'sent_verified'})
        tmp = benchmark.with_name(benchmark.name + '.tmp')
        tmp.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in entries))
        os.replace(tmp, benchmark)
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('step', choices=['inspect', 'fill', 'send', 'confirm'])
    parser.add_argument('--lock-file', required=True)
    parser.add_argument('--supplier')
    parser.add_argument('--listing-url')
    parser.add_argument('--reviewed-image-sha256')
    args = parser.parse_args()
    root = WORKSPACE.resolve()
    lock_file = Path(args.lock_file).resolve()
    if not lock_file.is_relative_to(root):
        raise ValueError('Lock file must belong to this campaign')
    active = json.loads((TEAM / 'state/active.json').read_text())
    lock = json.loads(lock_file.read_text())
    if active.get('owner') != 'gulya' or active.get('ticket') != lock.get('ticket') or time.time() - active['created'] >= 900:
        raise ValueError('Own unexpired GUI turn required')
    task = json.loads((root / 'task.json').read_text())
    if task.get('campaign_id') != 'gabions-20261008-30google-30avito':
        raise ValueError('Wrong campaign')
    os.environ['HERMES_HOME'] = str(HOME)
    os.environ['PATH'] = plistlib.loads(Path('/Users/egor/Library/LaunchAgents/ai.hermes.gateway-gulya.plist').read_bytes())['EnvironmentVariables']['PATH']
    sys.path.insert(0, str(REPO))
    from tools.computer_use.tool import handle_computer_use, _get_backend

    out = root / 'speed-benchmark-20261008'
    pending_path = out / 'fast-pending.json'
    account_path = out / 'fast-account-check.json'
    inspection_path = out / 'fast-inspection.json'

    def capture():
        result = handle_computer_use({'action': 'capture', 'app': 'Firefox', 'mode': 'ax', 'max_elements': 1000})
        snapshot = json.loads(result)
        if snapshot.get('error'):
            raise ValueError(snapshot['error'])
        return snapshot

    def action(action_args):
        result = handle_computer_use({'app': 'Firefox', **action_args})
        parsed = json.loads(result) if isinstance(result, str) else result
        if not parsed.get('ok'):
            raise ValueError('Action not confirmed; inspect actual state, do not replay: ' + str(parsed.get('message', parsed.get('error'))))
        return parsed

    def screenshot(name):
        result = handle_computer_use({'action': 'capture', 'app': 'Firefox', 'mode': 'vision'})
        for part in result.get('content', []):
            if part.get('type') == 'image_url':
                uri = part['image_url']['url']
                raw = base64.b64decode(uri.split(',', 1)[1])
                path = out / (name + '-' + str(time.time_ns()) + ('.jpg' if uri.startswith('data:image/jpeg') else '.png'))
                path.write_bytes(raw)
                return str(path), hashlib.sha256(raw).hexdigest()
        raise ValueError('Screenshot unavailable; cannot claim visual verification')

    snap = capture()
    lock_hash = hashlib.sha256(lock['ticket'].encode()).hexdigest()
    if 'Перспективная Методика' in labels(snap):
        save(account_path, {'lock_hash': lock_hash, 'at': time.time()})
    account = json.loads(account_path.read_text()) if account_path.exists() else {}
    account_verified = account.get('lock_hash') == lock_hash and time.time() - account.get('at', 0) < 900
    # Account check is reusable only during the very same exclusive GUI turn.
    if args.step == 'inspect' and not any('/user/' in x for x in labels(snap)):
        if not account_verified:
            raise ValueError('Current working account unavailable')
        print(json.dumps({'account_verified': True, 'image': screenshot('account-check')[0]}))
        return
    identity = chat_identity(snap, account_verified)
    if args.step == 'inspect':
        path, digest = screenshot('fast-inspect')
        save(inspection_path, {'identity': identity, 'digest': digest, 'at': time.time(), 'lock_hash': lock_hash})
        if pending_path.exists():
            pending = json.loads(pending_path.read_text())
            if all(identity[k] == pending[k] for k in identity) and pending['status'] in ('filled_unverified', 'send_unknown'):
                pending.update(image_path=path, image_sha256=digest, image_at=time.time())
                pending['image_phase'] = 'after_send' if pending['status'] == 'send_unknown' else 'draft'
                pending['evidence_path'] = str(Path(path).relative_to(root))
                save(pending_path, pending)
        print(json.dumps({'identity': identity, 'elements': [e for e in snap['elements'] if e.get('role') in ('AXHeading', 'AXTextArea') or e.get('label') in ('Отправить', 'Нет сообщений', 'Пока нет сообщений')], 'image': path, 'image_sha256': digest}, ensure_ascii=False))
        return
    if args.step == 'fill':
        if not args.supplier or args.supplier not in labels(snap) or (args.listing_url and (urlsplit(args.listing_url).hostname != 'www.avito.ru' or urlsplit(args.listing_url).scheme != 'https')):
            raise ValueError('Observed supplier and HTTPS Avito listing required')
        if pending_path.exists() and json.loads(pending_path.read_text()).get('status') != 'sent_verified':
            raise ValueError('Unresolved pending send; inspect first')
        with (root / 'avito_outreach.csv').open() as stream:
            check_capacity(list(csv.DictReader(stream)), identity)
        inspection = json.loads(inspection_path.read_text()) if inspection_path.exists() else {}
        reviewed = (bool(args.reviewed_image_sha256) and args.reviewed_image_sha256 == inspection.get('digest') and inspection.get('identity') == identity and inspection.get('lock_hash') == lock_hash and time.time() - inspection.get('at', 0) < 120)
        empty_conversation(snap, task['request_text'], visually_reviewed=reviewed)
        pending = {**identity, 'profile_url': 'https://www.avito.ru/user/' + identity['seller_id'] + '/profile', 'supplier': args.supplier, 'listing_url': args.listing_url or '', 'phase': 'optimized', 'text': task['request_text'], 'status': 'fill_unknown', 'started_at': now()}
        save(pending_path, pending)
        native_start = time.monotonic()
        action({'action': 'click', 'coordinate': editor_point(snap), 'delivery_mode': 'foreground'})
        copied = _get_backend().call_tool('clipboard_write', {'text': pending['text']})
        if copied.get('isError'):
            raise ValueError('Clipboard write failed; no paste attempted')
        action({'action': 'key', 'keys': 'cmd+v'})
        pending.update(status='filled_unverified', filled_at=now(), native_paste_seconds=time.monotonic() - native_start)
        pending['image_path'], pending['image_sha256'] = screenshot('fast-fill-' + identity['seller_id'])
        pending['image_at'] = time.time()
        pending['image_phase'] = 'draft'
        save(pending_path, pending)
    else:
        pending = json.loads(pending_path.read_text())
        if any(identity[k] != pending[k] for k in identity):
            raise ValueError('Recipient changed')
        require_review(pending, args.reviewed_image_sha256, 'draft' if args.step == 'send' else 'after_send')
        if args.step == 'send':
            if pending['status'] != 'filled_unverified' or pending['text'] != task['request_text']:
                raise ValueError('No reviewed unsent draft; do not resend')
            if time.time() - pending['image_at'] > 120:
                raise ValueError('Draft review expired; inspect actual state')
            with (root / 'avito_outreach.csv').open() as stream:
                check_capacity(list(csv.DictReader(stream)), identity)
            # Copy from the visible editor to verify the exact renderer text.
            action({'action': 'click', 'coordinate': editor_point(snap), 'delivery_mode': 'foreground'})
            verify_copied_editor(_get_backend().call_tool,
                                 lambda keys: action({'action': 'key', 'keys': keys}),
                                 pending['text'])
            snap = capture()
            if chat_identity(snap, account_verified) != identity:
                raise ValueError('Recipient changed before Send')
            buttons = [e for e in snap['elements'] if e.get('role') == 'AXButton' and e.get('label') in SEND_LABELS]
            if len(buttons) != 1:
                raise ValueError('Exactly one Send button required')
            mark_send_unknown(pending)
            save(pending_path, pending)
            action({'action': 'click', 'element': buttons[0]['index'], 'delivery_mode': 'foreground'})
            pending['send_returned_at'] = now()
            time.sleep(0.7)
            pending['image_path'], pending['image_sha256'] = screenshot('fast-send-' + identity['seller_id'])
            pending['image_at'] = time.time()
            pending['image_phase'] = 'after_send'
            pending['evidence_path'] = str(Path(pending['image_path']).relative_to(root))
            save(pending_path, pending)
        else:
            if pending['status'] not in ('send_unknown', 'verified_unrecorded', 'sent_verified'):
                raise ValueError('No send to confirm')
            if not visible_message(snap, pending['text']):
                raise ValueError('Message text not present in current chat')
            if any(e.get('role') == 'AXButton' and e.get('label') in SEND_LABELS for e in snap['elements']):
                raise ValueError('Editor may still contain a draft')
            unique_editor(snap)
            pending.update(status='verified_unrecorded', verified_at=pending.get('verified_at') or now(), evidence_type='native_capture_and_operator_visual_review')
            # Freeze the reviewed evidence before the first ledger write.
            # Recovery after CSV succeeds must reuse this exact evidence.
            save(pending_path, pending)
            count = record_verified(root, pending)
            pending['status'] = 'sent_verified'
            save(pending_path, pending)
            print(json.dumps({'campaign_sent_verified': count, 'supplier': pending['supplier'], 'verified_at': pending['verified_at']}, ensure_ascii=False))
            return
    print(json.dumps({k: pending[k] for k in ('status', 'supplier', 'image_path', 'image_sha256')}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        print(json.dumps({'status': 'needs_inspection', 'reason': str(error)}, ensure_ascii=False))
        raise SystemExit(2)
