"""Anya-only durable group attachment intake; no Telegram poller or payment rights."""
import base64
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import threading
import time
import urllib.request

PROFILE = Path('/Users/egor/.hermes/profiles/anya')
GROUP = '-5589110678'
LOCK = threading.Lock()
STARTED = False


def folder():
    p = PROFILE / 'workspace/group-finance/crm-outbox'
    p.mkdir(parents=True, exist_ok=True)
    return p


class Connection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def db():
    con = sqlite3.connect(folder() / 'queue.sqlite3', timeout=15, factory=Connection)
    con.row_factory = sqlite3.Row
    con.execute('CREATE TABLE IF NOT EXISTS queue (source TEXT PRIMARY KEY, payload TEXT NOT NULL, '
                'path TEXT NOT NULL, crm_id INTEGER, error TEXT, updated_at REAL NOT NULL)')
    return con


def api(path, data=None):
    cfg = json.loads((PROFILE / 'finance-crm.json').read_text())
    if not cfg['base_url'].startswith('https://'):
        raise ValueError('HTTPS required')
    req = urllib.request.Request(cfg['base_url'].rstrip('/') + '/api/finance-intake' + path,
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Authorization':'Bearer ' + cfg['token'], 'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def flush():
    # One sender in the existing gateway process. Server identity survives lost ACKs.
    if not LOCK.acquire(blocking=False):
        return
    try:
        with db() as con:
            for row in con.execute("SELECT * FROM queue WHERE crm_id IS NULL AND (error IS NULL OR error NOT LIKE 'HTTP4%') ORDER BY updated_at LIMIT 10").fetchall():
                try:
                    data = json.loads(row['payload'])
                    data['content_base64'] = base64.b64encode(Path(row['path']).read_bytes()).decode()
                    result = api('/import', data)
                    con.execute('UPDATE queue SET crm_id=?,error=NULL,updated_at=? WHERE source=?',
                                (result['item']['id'], time.time(), row['source']))
                except Exception as exc:
                    # Never persist credential-bearing exception text.
                    con.execute('UPDATE queue SET error=?,updated_at=? WHERE source=?',
                                ('HTTP' + str(exc.code) if hasattr(exc, 'code') else type(exc).__name__, time.time(), row['source']))
                con.commit()
    finally:
        LOCK.release()


def capture(event=None, **kwargs):
    source = getattr(event, 'source', None)
    if (Path(os.environ.get('HERMES_HOME', '')) != PROFILE or
        getattr(getattr(source, 'platform', None), 'value', None) != 'telegram' or
        str(getattr(source, 'chat_id', '')) != GROUP or getattr(event, 'internal', False)):
        return None
    raw = getattr(event, 'raw_message', None)
    # Replies to a receipt are not new receipt messages. Preserve original provenance.
    if not (getattr(raw, 'photo', None) or getattr(raw, 'document', None)):
        return None
    sender = getattr(raw, 'from_user', None)
    if not sender or getattr(sender, 'is_bot', True):
        return None
    from gateway.platforms.base import get_image_cache_dir, get_document_cache_dir
    roots = [get_image_cache_dir().resolve(), get_document_cache_dir().resolve()]
    accepted = []
    with db() as con:
        for path in getattr(event, 'media_urls', []):
            f = Path(path).resolve()
            if not any(f.is_relative_to(root) for root in roots) or not f.is_file():
                continue
            if f.suffix.lower() not in {'.jpg','.jpeg','.png','.webp','.pdf','.xlsx','.xls'}:
                continue
            if f.stat().st_size > 20 * 1024 * 1024:
                continue
            # Replied-to cached media are appended to the same event by the adapter.
            if "saved at: " + str(path) + "]" in (event.text or '') and '[Replied-to ' in (event.text or ''):
                continue
            content = f.read_bytes(); sha = hashlib.sha256(content).hexdigest()
            target = folder() / (sha + f.suffix.lower())
            if not target.exists():
                temp = target.with_suffix(target.suffix + '.tmp')
                temp.write_bytes(content); temp.replace(target)
            msg = str(event.message_id)
            key = GROUP + ':' + msg + ':' + sha
            original = getattr(getattr(raw, 'document', None), 'file_name', None) or f.name
            data = {'chat_id':GROUP, 'message_id':msg, 'attachment_id':sha,
                    'filename':original, 'sender_id':str(sender.id),
                    'sender_name':getattr(sender, 'full_name', '') or '',
                    'caption':str(getattr(raw, 'caption', None) or '')}
            con.execute('INSERT OR IGNORE INTO queue VALUES(?,?,?,NULL,NULL,?)',
                        (key, json.dumps(data, ensure_ascii=False), str(target), time.time()))
            accepted.append(key)
        con.commit()
    if not accepted:
        return None
    flush()
    with db() as con:
        rows = [dict(con.execute('SELECT source,crm_id,error FROM queue WHERE source=?',(k,)).fetchone()) for k in accepted]
    note = ('\n[CRM intake: ' + json.dumps(rows, ensure_ascii=False) +
            '. Original preserved locally. A crm_id confirms server storage only, not extraction or payment. '
            'Use finance_crm get/projects/draft to save each document extraction. If no crm_id, use status later; '
            'report queued, not synced. Ask for missing project. Never claim a payment was posted.]')
    return {'action':'rewrite', 'text':(event.text or '') + note}


def tool(args, **kwargs):
    try:
        action = args.get('action')
        if action == 'status':
            flush()
            with db() as con:
                result = [dict(r) for r in con.execute('SELECT source,crm_id,error,updated_at FROM queue ORDER BY updated_at DESC LIMIT 20')]
        elif action == 'projects':
            result = api('/projects')
        elif action in {'get', 'draft'}:
            ident = args.get('id')
            if type(ident) is not int or ident <= 0:
                raise ValueError('id required')
            result = api('/' + str(ident) + ('/draft' if action == 'draft' else ''), args.get('document') if action == 'draft' else None)
        else:
            raise ValueError('unknown action')
        return json.dumps(result, ensure_ascii=False)
    except Exception as exc:
        # Status code is enough to prompt refetch; full HTTP URL includes no token but avoid echoing config.
        return json.dumps({'error':type(exc).__name__, 'status':getattr(exc,'code',None),
                           'instruction':'Do not claim saved. For 409 refetch document, correct data and revision; never overwrite verified records.'})


def register(ctx):
    global STARTED
    if Path(os.environ.get('HERMES_HOME', '')) != PROFILE:
        return
    ctx.register_hook('pre_gateway_dispatch', capture)
    ctx.register_tool(name='finance_crm', toolset='finance_crm', handler=tool,
        schema={'name':'finance_crm','description':'Group finance CRM: status of originals, allowed project names, get document, save draft extraction. No payment/confirmation permissions. Money in integer kopecks; preserve revision; only facts from source, unknown=null/questions.',
                'parameters':{'type':'object','properties':{'action':{'type':'string','enum':['status','projects','get','draft']},'id':{'type':'integer'},
                 'document':{'type':'object','description':'Full draft: revision,project_id,kind(receipt/invoice/refund/other/unknown),title,counterparty,document_date ISO,amount_kopecks integer or null,fiscal_key FN:FD:FP or null,details:{lines:[{title,quantity decimal string,unit,amount_kopecks}],questions:[],payment_kind,vat_percent,planned_date}. Line amounts must equal total. Never infer VAT/payment.'}},'required':['action']}})
    if not STARTED:
        STARTED = True
        def worker():
            while True:
                try:
                    flush()
                except Exception:
                    pass
                time.sleep(30)
        threading.Thread(target=worker, name='finance-crm-outbox', daemon=True).start()
