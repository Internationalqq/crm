"""Finite, source-verified Karabash recovery through the existing field API."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import time
from datetime import datetime, timezone, timedelta

os.umask(0o077)
PROFILE = Path('/Users/egor/.hermes/profiles/pto')
WORK = PROFILE / 'workspace/karabash-recovery-20261015'
GROUP = '-5157677441'
# Verified read-only against field_event_sources in the saved production baseline.
PRIOR_SOURCES = {7: [21, 23, 24], 8: [37]}
spec = importlib.util.spec_from_file_location('field', PROFILE / 'plugins/field-crm-intake/__init__.py')
field = importlib.util.module_from_spec(spec)
spec.loader.exec_module(field)


def archive_source(history_id, image=None):
    with sqlite3.connect('file:' + str(PROFILE / 'state.db') + '?mode=ro', uri=True) as c:
        row = c.execute('SELECT content,timestamp FROM messages WHERE id=? AND role=? AND session_id=?',
                        (history_id, 'user', '20261013_155256_06570c')).fetchone()
    assert row, 'historical_user_missing'
    text, timestamp = row
    files = []
    if image:
        assert image in text, 'historical_image_mismatch'
        path = PROFILE / 'image_cache' / image
        raw = path.read_bytes(); sha = hashlib.sha256(raw).hexdigest()
        name = sha + path.suffix.lower(); target = field.folder() / name
        if target.exists():
            assert target.read_bytes() == raw
        else:
            target.write_bytes(raw)
        files.append({'name': image, 'local_name': name, 'sha256': sha})
    key = GROUP + ':archive-pto-state-' + str(history_id)
    payload = {'chat_id': GROUP, 'message_id': key.split(':', 1)[1], 'sent_at': int(timestamp),
               'sender_id': '', 'sender_name': 'Архив ПТО: сообщение ' + str(history_id),
               'text': text, 'files': files, 'reply_to': None}
    with field.db() as c:
        old = c.execute('SELECT payload FROM sources WHERE source=?', (key,)).fetchone()
        if old:
            assert json.loads(old['payload']) == payload, 'archive_source_changed'
        else:
            c.execute('INSERT INTO sources VALUES(?,?,NULL,NULL,?)',
                      (key, json.dumps(payload, ensure_ascii=False), time.time()))
    ensure_source(key)
    return key


def ensure_source(key):
    with field.db() as c:
        row = c.execute('SELECT * FROM sources WHERE source=?', (key,)).fetchone()
    assert row, 'source_missing'
    if row['crm_id']:
        return row['crm_id']
    payload = json.loads(row['payload']); media = []
    for f in payload.pop('files', []):
        raw = (field.folder() / f['local_name']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == f['sha256']
        media.append({'filename': f['name'], 'content_base64': base64.b64encode(raw).decode()})
    result = field.api('/import', dict(payload, media=media))
    with field.db() as c:
        c.execute('UPDATE sources SET crm_id=?,error=NULL WHERE source=?', (result['message_id'], key))
    return result['message_id']


def post(key, event, refs, expected_id=None, apply=True):
    mid = ensure_source(key); ids = [ensure_source(ref) for ref in refs]
    current = next((x for x in field.api('')['items']
                    if x['message_id'] == mid and x['event_key'] == event['event_key']), None)
    if expected_id:
        assert current and current['id'] == expected_id, 'draft_identity_changed'
    if current and current['status'] == 'applied':
        assert current['project_id'] == event['project_id'] and current['kind'] == event['kind']
        assert current['data']['lines'] == event['data']['lines'], 'applied_payload_changed'
        return current
    if current:
        event['revision'] = current['revision']
        exposed = field.api('/' + str(current['id']))['item'].get('sources')
        prior = [s['id'] for s in exposed] if exposed is not None else PRIOR_SOURCES.get(current['id'], [mid])
        with field.db() as c:
            queued=c.execute('SELECT payload FROM operations WHERE source=? AND op_key=?',(key,event['event_key'])).fetchone()
        if queued:
            prior += [ensure_source(ref) for ref in json.loads(queued['payload']).get('source_refs',[])]
        ids = sorted(set(ids + prior))
    # Persist every prior clarification too: a restart must replay the same source set.
    with field.db() as c:
        by_id = {r['crm_id']: r['source'] for r in c.execute('SELECT source,crm_id FROM sources WHERE crm_id IS NOT NULL')}
    assert all(i == mid or i in by_id for i in ids), 'source_reference_not_in_outbox'
    refs = sorted({by_id[i] for i in ids if i != mid})
    field.enqueue({'source': key, 'event': event, 'source_refs': refs, 'apply': apply})
    with field.db() as c:
        operation = c.execute('SELECT * FROM operations WHERE source=? AND op_key=?', (key, event['event_key'])).fetchone()
    result = field.api('/events', dict(event, message_id=mid, source_ids=ids))
    if apply:
        result = field.api('/' + str(result['item']['id']) + '/apply', {'revision': result['item']['revision']})
    verified = field.api('/' + str(result['item']['id']))
    assert verified['item']['status'] == ('applied' if apply else 'needs_review'), 'read_after_write_failed'
    with field.db() as c:
        changed = c.execute('UPDATE operations SET synced=1,result=?,error=NULL WHERE source=? AND op_key=? AND generation=?',
                            (json.dumps(verified, ensure_ascii=False), key, event['event_key'], operation['generation'])).rowcount
        assert changed == 1, 'operation_generation_changed'
    return verified['item']


def line(title, qty, unit='шт', kind='material'):
    return {'title': title, 'qty': str(qty), 'unit': unit, 'item_type': kind}


def main():
    assert (WORK / 'outbox-before.sqlite3').exists(), 'backup_required'
    projects = field.api('/projects')['projects']
    assert any(x['id'] == 10 and 'Гусиха' in x['title'] for x in projects), 'project_changed'
    confirmation = GROUP + ':137'; ensure_source(confirmation)
    units = archive_source(652)
    cheque = archive_source(638, 'img_94ed2e09c796.jpg')
    results = []
    for ident, key in [(7, GROUP + ':48'), (8, GROUP + ':75')]:
        old = field.api('/' + str(ident))['item']
        event = {k: old[k] for k in ['event_key', 'kind', 'project_id', 'location', 'event_date', 'title']}
        data = dict(old['data']); data['questions'] = []
        data['lines'] = [dict(x, item_type=x.get('item_type', 'material')) for x in data['lines']]
        refs = [confirmation]
        data['fact_quote'] = 'Все получили в карабаш'
        if ident == 8:
            # The invoice day is not evidence of the actual delivery day.
            data['delivery_status'] = 'complete'
            data['questions'] = ['Получение всех строк подтверждено 15.10.2026; точная дата получения по накладной №ООЦБ-014410 не указана. Дата 12.10.2026 — дата исходника, не подтверждённая дата поставки.']
            event['title'] = 'Карабаш — №ООЦБ-014410: получение подтверждено, дата поставки неизвестна'
        event['data'] = data
        results.append(post(key, event, refs, expected_id=ident, apply=ident != 8))
    lines = [
        line('Степлер мебельный тип53 4–14мм Сибртех 40101', 1, kind='tool'),
        line('Скобы для степлера 14мм тип53', 2, 'упак'),
        line('Черенок 40мм 1,2метра', 4),
        line('Лопата совковая Рельсовая сталь остроконечная К-22 Оранжево-черная 140644', 4, kind='tool'),
        line('Лезвия 18мм для ножей, упаковка 10шт', 3, 'упак'),
        line('Нож 18мм выдвижное лезвие металл направляющая Matrix 78918', 3, kind='tool'),
        line('Отвертка 2в1 5×65 средняя Ермак 115031', 1, kind='tool'),
        line('Саморез по дереву желтый 5×30', '0.05', 'кг'),
        line('Пакет', 1),
    ]
    # Confirmation date, not the printed purchase date, is the dated receipt evidence.
    with field.db() as c:
        sent = json.loads(c.execute('SELECT payload FROM sources WHERE source=?', (confirmation,)).fetchone()[0])['sent_at']
    day = datetime.fromtimestamp(sent, timezone(timedelta(hours=5))).date().isoformat()
    event = {'event_key': 'receipt-44428', 'kind': 'receipt', 'project_id': 10, 'location': 'project',
             'event_date': day, 'title': 'Карабаш — чек №44428 от 14.10.2026; получение подтверждено ' + day,
             'data': {'lines': lines, 'questions': [], 'fact_quote': 'Все получили в карабаш', 'delivery_status': 'complete'}}
    results.append(post(confirmation, event, [cheque, units]))
    lines = [line('Диск по металлу 125×6×22 шлифовальный Луга (80/10)', 10),
             line('Диск лепестковый торцевой 125×22 Р40 Луга Б 12040л (80/10)', 5),
             line('Мешок для мусора ПВД 240л 40мкм 90×140см, рулон 10шт, 34479', 1, 'рул'),
             line('Зубило для перфоратора SDS+ широкое 14×40×250мм MATRIX 70310', 1, kind='tool')]
    event = {'event_key': 'receipt-014620', 'kind': 'receipt', 'project_id': 10, 'location': 'project',
             'event_date': '2026-10-15', 'title': 'Карабаш — приход 15.10.2026, накладная №ООЦБ-014620',
             'data': {'lines': lines, 'questions': [], 'fact_quote': 'Все получили в карабаш', 'delivery_status': 'complete'}}
    # A worker may have created the standard draft while the recovery was preparing.
    mid=ensure_source(GROUP+':139')
    same=[x for x in field.api('')['items'] if x['message_id']==mid and x['kind']=='receipt']
    if not any(x['event_key']==event['event_key'] for x in same) and same:
        assert len(same)==1 and '014620' in same[0]['title'], 'ambiguous_existing_receipt'
        event['event_key']=same[0]['event_key']
    results.append(post(GROUP + ':139', event, [confirmation]))
    target = WORK / 'applied-specific.json'
    target.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps([{'id': x['id'], 'status': x['status'], 'lines': len(x['data']['lines'])} for x in results]))


if __name__ == '__main__':
    main()
