"""Durable financial source documents. Intake never posts payments or stock moves."""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import mimetypes
import re
import secrets
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

import finance
from auth import user_can_manage_finances, user_can_view_finances

MAX_BYTES = 20 * 1024 * 1024


def ensure_schema(con):
    con.executescript("""
        CREATE TABLE IF NOT EXISTS finance_intake (
            id INTEGER PRIMARY KEY, sha256 TEXT NOT NULL UNIQUE,
            original_name TEXT NOT NULL, file_ext TEXT NOT NULL, size_bytes INTEGER NOT NULL,
            project_id INTEGER REFERENCES projects(id) ON DELETE RESTRICT,
            kind TEXT NOT NULL DEFAULT 'unknown', status TEXT NOT NULL DEFAULT 'needs_review',
            amount_kopecks INTEGER, document_date TEXT, counterparty TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL DEFAULT '', details_json TEXT NOT NULL DEFAULT '{}',
            fiscal_key TEXT UNIQUE, revision INTEGER NOT NULL DEFAULT 1,
            document_id INTEGER REFERENCES documents(id) ON DELETE RESTRICT,
            finance_entry_id INTEGER REFERENCES finance_entries(id) ON DELETE RESTRICT,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS finance_intake_sources (
            chat_id TEXT NOT NULL, message_id TEXT NOT NULL, attachment_id TEXT NOT NULL,
            intake_id INTEGER NOT NULL REFERENCES finance_intake(id) ON DELETE RESTRICT,
            sender_id TEXT NOT NULL, sender_name TEXT NOT NULL, caption TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY(chat_id, message_id, attachment_id)
        );
        CREATE INDEX IF NOT EXISTS idx_finance_intake_project ON finance_intake(project_id, id);
    """)


def settings():
    try:
        return json.loads((finance.DATA_DIR / 'finance-intake-integration.json').read_text())
    except (OSError, ValueError):
        return {}


def integration(handler):
    value = str(handler.headers.get('Authorization', ''))
    cfg = settings()
    token = str(cfg.get('token') or '')
    if len(token) >= 32 and hmac.compare_digest(value, 'Bearer ' + token):
        return cfg
    return None


def storage(sha):
    return finance.DATA_DIR / 'finance-intake' / sha[:2] / sha


def allowed(handler, user, row):
    return user_can_view_finances(user) and (
        handler.can_access_project(user, row['project_id']) if row['project_id'] else
        user_can_manage_finances(user)
    )


def payload(con, row):
    item = dict(row)
    item['details'] = json.loads(item.pop('details_json'))
    item['sources'] = [dict(r) for r in con.execute(
        'SELECT chat_id,message_id,sender_name,caption,created_at FROM finance_intake_sources WHERE intake_id=?',
        (row['id'],))]
    item['view_url'] = f"/api/finance-intake/{row['id']}/file"
    item['possible_duplicates'] = duplicate_candidates(con, row)
    return item


def duplicate_candidates(con, row):
    if not row['counterparty'].strip() or not row['document_date'] or not row['amount_kopecks']:
        return []
    return [r['id'] for r in con.execute(
        "SELECT id FROM finance_intake WHERE id!=? AND project_id IS ? AND kind=? AND status='verified' "
        'AND document_date=? AND amount_kopecks=? AND lower(trim(counterparty))=lower(trim(?))',
        (row['id'], row['project_id'], row['kind'], row['document_date'], row['amount_kopecks'], row['counterparty']))]


def ingest(con, raw, data, cfg):
    if str(data.get('chat_id')) != str(cfg.get('group_id')):
        raise PermissionError('wrong_group')
    source = tuple(str(data.get(k) or '') for k in ('chat_id', 'message_id', 'attachment_id'))
    if not all(source) or any(len(x) > 200 for x in source):
        raise ValueError('source_required')
    name = finance.sanitize_filename(str(data.get('filename') or ''))[:200]
    ext = Path(name).suffix.lower()
    if ext not in finance.FINANCE_INVOICE_EXTENSIONS or not raw or len(raw) > MAX_BYTES:
        raise ValueError('unsupported_or_empty_file')
    sha = hashlib.sha256(raw).hexdigest()
    con.execute('BEGIN IMMEDIATE')
    previous = con.execute('SELECT i.* FROM finance_intake_sources s JOIN finance_intake i ON i.id=s.intake_id '
                           'WHERE s.chat_id=? AND s.message_id=? AND s.attachment_id=?', source).fetchone()
    if previous and previous['sha256'] != sha:
        raise ValueError('source_changed_original_preserved')
    row = previous or con.execute('SELECT * FROM finance_intake WHERE sha256=?', (sha,)).fetchone()
    if row and row['project_id'] and row['project_id'] not in cfg.get('project_ids', []):
        raise PermissionError('project_forbidden')
    target = storage(sha)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        temp = target.with_name(sha + '.' + secrets.token_hex(8) + '.tmp')
        try:
            temp.write_bytes(raw)
            temp.replace(target)
        finally:
            temp.unlink(missing_ok=True)
    elif hashlib.sha256(target.read_bytes()).hexdigest() != sha:
        raise ValueError('original_integrity_error')
    duplicate = row is not None
    if not row:
        now = finance.now_ts()
        cursor = con.execute('INSERT INTO finance_intake(sha256,original_name,file_ext,size_bytes,created_at,updated_at) '
                             'VALUES(?,?,?,?,?,?)', (sha, name, ext, len(raw), now, now))
        row = con.execute('SELECT * FROM finance_intake WHERE id=?', (cursor.lastrowid,)).fetchone()
    con.execute('INSERT OR IGNORE INTO finance_intake_sources VALUES(?,?,?,?,?,?,?,?)',
                (*source, row['id'], str(data.get('sender_id') or '')[:100],
                 str(data.get('sender_name') or '')[:200], str(data.get('caption') or '')[:8000], finance.now_ts()))
    con.commit()
    return {'item': payload(con, row), 'duplicate': duplicate}


def kopecks(value):
    if value is None:
        return None
    if type(value) is not int or not 0 <= value <= 10**13:
        raise ValueError('invalid_kopecks')
    return value


def validate(data):
    kind = data.get('kind', 'unknown')
    if kind not in {'unknown', 'receipt', 'invoice', 'refund', 'other'}:
        raise ValueError('invalid_kind')
    amount = kopecks(data.get('amount_kopecks'))
    dt = data.get('document_date') or None
    if dt:
        date.fromisoformat(dt)
    details = data.get('details', {})
    if not isinstance(details, dict) or len(json.dumps(details)) > 150000:
        raise ValueError('invalid_details')
    questions = details.get('questions', [])
    if not isinstance(questions, list) or len(questions) > 50 or any(not isinstance(q, str) or len(q) > 2000 for q in questions):
        raise ValueError('invalid_questions')
    if details.get('planned_date'):
        date.fromisoformat(details['planned_date'])
    lines = details.get('lines', [])
    if not isinstance(lines, list) or len(lines) > 500:
        raise ValueError('invalid_lines')
    total = 0
    for line in lines:
        if not isinstance(line, dict) or not str(line.get('title') or '').strip():
            raise ValueError('line_title_required')
        value = kopecks(line.get('amount_kopecks'))
        if value is None:
            raise ValueError('line_amount_required')
        total += value
        if line.get('quantity') is not None:
            try:
                qty = Decimal(str(line['quantity']))
                if not qty.is_finite() or qty <= 0:
                    raise ValueError('invalid_quantity')
            except InvalidOperation as exc:
                raise ValueError('invalid_quantity') from exc
    if lines and amount is not None and total != amount:
        raise ValueError('lines_total_mismatch')
    fiscal = str(data.get('fiscal_key') or '').strip() or None
    if fiscal and not re.fullmatch(r'\d{10,20}:\d{1,12}:\d{1,12}', fiscal):
        raise ValueError('fiscal_key_requires_fn_fd_fp')
    return kind, amount, dt, details, fiscal


def revise(con, row, data, actor):
    if row['status'] != 'needs_review':
        raise ValueError('document_already_verified')
    if type(data.get('revision')) is not int or data['revision'] != row['revision']:
        raise ValueError('revision_conflict')
    kind, amount, dt, details, fiscal = validate(data)
    if fiscal:
        duplicate = con.execute('SELECT id FROM finance_intake WHERE fiscal_key=? AND id!=?', (fiscal, row['id'])).fetchone()
        if duplicate:
            raise ValueError('fiscal_duplicate:' + str(duplicate['id']))
    project = data.get('project_id') or None
    if project is not None and (type(project) is not int or not con.execute('SELECT id FROM projects WHERE id=?', (project,)).fetchone()):
        raise ValueError('project_not_found')
    con.execute('UPDATE finance_intake SET project_id=?,kind=?,amount_kopecks=?,document_date=?,counterparty=?,title=?, '
                'details_json=?,fiscal_key=?,revision=revision+1,updated_at=? WHERE id=?',
                (project, kind, amount, dt, str(data.get('counterparty') or '')[:300], str(data.get('title') or '')[:500],
                 json.dumps(details, ensure_ascii=False), fiscal, finance.now_ts(), row['id']))
    finance.create_audit(con, actor, 'revise_finance_intake', 'finance_intake', row['id'],
                         {'previous': dict(row), 'revision': row['revision'] + 1})


def confirm(con, row, data, user):
    # Retrying a confirmation returns the already committed identity.
    if row['status'] != 'needs_review':
        return
    if data.get('revision') != row['revision']:
        raise ValueError('revision_conflict')
    if not row['project_id'] or not row['document_date'] or not row['amount_kopecks'] or row['kind'] == 'unknown':
        raise ValueError('project_date_amount_kind_required')
    details = json.loads(row['details_json'])
    if details.get('currency', 'RUB') != 'RUB':
        raise ValueError('only_rub_can_be_confirmed')
    if details.get('questions'):
        raise ValueError('unresolved_questions')
    if row['kind'] == 'refund':
        original = con.execute("SELECT * FROM finance_intake WHERE id=? AND kind='receipt' AND status='verified' AND project_id=?",
                               (details.get('original_receipt_id'), row['project_id'])).fetchone()
        if not original:
            raise ValueError('original_receipt_required')
        refunded = sum(r['amount_kopecks'] for r in con.execute(
            "SELECT amount_kopecks,details_json FROM finance_intake WHERE kind='refund' AND status='verified' AND project_id=?",
            (row['project_id'],)) if json.loads(r['details_json']).get('original_receipt_id') == original['id'])
        if refunded + row['amount_kopecks'] > original['amount_kopecks']:
            raise ValueError('refund_exceeds_original')
    if row['kind'] == 'invoice':
        if details.get('payment_kind') not in {'cash', 'bank_no_vat', 'bank_vat'}:
            raise ValueError('payment_kind_required')
        vat = details.get('vat_percent')
        if type(vat) not in {int, float} or not 0 <= vat <= 100:
            raise ValueError('vat_required')
        if details.get('planned_date'):
            date.fromisoformat(details['planned_date'])
    linked = data.get('finance_entry_id') or None
    if duplicate_candidates(con, row) and not linked and data.get('confirm_distinct') is not True:
        raise ValueError('possible_duplicate_check_required')
    if linked:
        entry = con.execute('SELECT * FROM finance_entries WHERE id=? AND project_id=?', (linked, row['project_id'])).fetchone()
        if not entry or entry['direction'] != 'expense' or entry['status'] == 'cancelled':
            raise ValueError('invalid_linked_expense')
        # An existing invoice/payment is evidence-linked only, never counted twice.
        if int(Decimal(str(entry['amount'])) * 100) != row['amount_kopecks']:
            raise ValueError('linked_amount_mismatch')
    raw = storage(row['sha256']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != row['sha256']:
        raise ValueError('original_integrity_error')
    name = 'intake_' + str(row['id']) + '_' + row['sha256'] + row['file_ext']
    target = finance.project_documents_dir(row['project_id']) / name
    target.write_bytes(raw)
    now = finance.now_ts()
    title = row['title'] or row['original_name']
    doc = con.execute("INSERT INTO documents(project_id,title,doc_type,status,original_name,storage_name,storage_path,"
                      "mime_type,file_ext,size_bytes,notes,uploaded_by,is_client_visible,created_at,updated_at) "
                      "VALUES(?,?,?,'submitted',?,?,?,?,?,?,?,?,0,?,?)",
                      (row['project_id'], title, 'invoice' if row['kind'] == 'invoice' else 'cash_receipt',
                       row['original_name'], name, str(target.relative_to(finance.PROJECT_ROOT)),
                       mimetypes.guess_type(row['original_name'])[0] or 'application/octet-stream', row['file_ext'],
                       row['size_bytes'], 'Входящий финансовый документ №' + str(row['id']), user['id'], now, now))
    if row['kind'] == 'invoice' and not linked:
        # No VAT or payment is inferred from a file. Monetary fact remains untouched.
        cur = con.execute("INSERT INTO finance_entries(project_id,direction,category,payment_kind,vat_percent,amount,"
                          "planned_date,counterparty_name,document_id,status,notes,created_by,created_at,updated_at) "
                          "VALUES(?,'expense',?,?,?,?,?,?,?, 'planned',?,?,?,?)",
                          (row['project_id'], title, details['payment_kind'], details['vat_percent'],
                           float(Decimal(row['amount_kopecks']) / 100), details.get('planned_date'),
                           row['counterparty'], doc.lastrowid,
                           'Счёт из реестра №' + str(row['id']), user['id'], now, now))
        linked = cur.lastrowid
    con.execute("UPDATE finance_intake SET status='verified',document_id=?,finance_entry_id=?,revision=revision+1,updated_at=? WHERE id=?",
                (doc.lastrowid, linked, now, row['id']))
    finance.create_audit(con, user['id'], 'confirm_finance_intake', 'finance_intake', row['id'],
                         {'document_id': doc.lastrowid, 'finance_entry_id': linked, 'cash_posted': False,
                          'confirm_distinct': data.get('confirm_distinct') is True})


def handle(handler, method, path):
    from urllib.parse import parse_qs, urlsplit
    query = parse_qs(urlsplit(handler.path).query)
    cfg = integration(handler)
    user = None if cfg else handler.require_user()
    if not cfg and not user:
        return
    if user and not user_can_view_finances(user):
        handler.send_json(403, {'error': 'forbidden'}); return
    try:
        with finance.db() as con:
            if method == 'POST' and path == '/api/finance-intake/import':
                if not cfg:
                    raise PermissionError('integration_required')
                data = handler.read_json(maximum=29 * 1024 * 1024)
                try:
                    raw = base64.b64decode(data.pop('content_base64', ''), validate=True)
                except (ValueError, binascii.Error) as exc:
                    raise ValueError('invalid_file_encoding') from exc
                handler.send_json(200, ingest(con, raw, data, cfg)); return
            project_rows = con.execute('SELECT id,title FROM projects ORDER BY title').fetchall()
            projects = [dict(r) for r in project_rows if (r['id'] in cfg.get('project_ids', []) if cfg else handler.can_access_project(user, r['id']))]
            project_ids = {r['id'] for r in projects}
            if method == 'GET' and path == '/api/finance-intake':
                if cfg:
                    raise PermissionError('integration_list_forbidden')
                rows = con.execute('SELECT * FROM finance_intake ORDER BY id DESC').fetchall()
                project = int(query['project_id'][0]) if query.get('project_id') else None
                items = [payload(con, r) for r in rows if allowed(handler, user, r) and (not project or r['project_id'] == project)]
                handler.send_json(200, {'items': items, 'projects': projects, 'can_manage': user_can_manage_finances(user)}); return
            if method == 'GET' and path == '/api/finance-intake/projects':
                handler.send_json(200, {'projects': projects}); return
            match = re.fullmatch(r'/api/finance-intake/(\d+)(?:/(draft|confirm|file))?', path)
            if not match:
                handler.send_json(404, {'error': 'not_found'}); return
            doc_id, action = int(match[1]), match[2]
            if method == 'POST':
                con.execute('BEGIN IMMEDIATE')
            row = con.execute('SELECT * FROM finance_intake WHERE id=?', (doc_id,)).fetchone()
            if not row:
                handler.send_json(404, {'error': 'not_found'}); return
            if cfg:
                owned = con.execute('SELECT 1 FROM finance_intake_sources WHERE intake_id=? AND chat_id=?', (doc_id, str(cfg.get('group_id')))).fetchone()
                if not owned or (row['project_id'] and row['project_id'] not in project_ids):
                    raise PermissionError('forbidden')
            elif not allowed(handler, user, row):
                raise PermissionError('forbidden')
            if method == 'GET' and not action:
                handler.send_json(200, {'item': payload(con, row)}); return
            if method == 'GET' and action == 'file' and not cfg:
                # Safe image/PDF only; other types are forced downloads.
                ext = row['file_ext']; mime = mimetypes.guess_type(row['original_name'])[0]
                inline = ext in {'.pdf', '.jpg', '.jpeg', '.png', '.webp'}
                handler.send_file(storage(row['sha256']), mime if inline else 'application/octet-stream', row['original_name'], inline=inline); return
            if method != 'POST' or action not in {'draft', 'confirm'}:
                raise PermissionError('forbidden')
            if user and not user_can_manage_finances(user):
                raise PermissionError('forbidden')
            data = handler.read_json()
            if action == 'draft':
                if data.get('project_id') and data['project_id'] not in project_ids:
                    raise PermissionError('project_forbidden')
                revise(con, row, data, cfg.get('actor_id') if cfg else user['id'])
            else:
                if cfg:
                    raise PermissionError('integration_cannot_confirm')
                confirm(con, row, data, user)
            con.commit()
            row = con.execute('SELECT * FROM finance_intake WHERE id=?', (doc_id,)).fetchone()
            handler.send_json(200, {'item': payload(con, row)})
    except PermissionError as exc:
        handler.send_json(403, {'error': str(exc)})
    except (ValueError, TypeError) as exc:
        handler.send_json(409, {'error': str(exc)})
