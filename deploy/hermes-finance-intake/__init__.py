"""Anya-only durable group attachment intake; no Telegram poller or payment rights."""
import base64
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import threading
import time
import urllib.request

PROFILE = Path('/Users/egor/.hermes/profiles/anya')
GROUP = '-5589110678'
LOCK = threading.Lock()
STARTED = False
WAKE = threading.Event()


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
    con.execute('CREATE TABLE IF NOT EXISTS drafts (source TEXT PRIMARY KEY, payload TEXT NOT NULL, '
                'generation INTEGER NOT NULL, synced INTEGER NOT NULL DEFAULT 0, error TEXT)')
    return con


def api(path, data=None):
    cfg = json.loads((PROFILE / 'finance-crm.json').read_text())
    if cfg.get('transport') == 'relay':
        # Loopback is carried inside the authenticated Windows→Mac SSH connection.
        if cfg.get('relay_url') != 'http://127.0.0.1:18878/':
            raise ValueError('Unexpected relay endpoint')
        req=urllib.request.Request(cfg['relay_url'], data=json.dumps({'path':path,'data':data,'token':cfg['token']}).encode(),
                                   headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=30) as response:envelope=json.load(response)
        if envelope.get('status') != 200:
            error=RuntimeError('CRM request rejected');error.code=envelope.get('status',503);raise error
        return envelope['payload']
    if cfg.get('transport') == 'ssh':
        result = subprocess.run(['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
            '-o','UserKnownHostsFile='+cfg['known_hosts'],'-o','ConnectTimeout=10','-i',cfg['identity'],cfg['ssh_host']],
            input=json.dumps({'path':path,'data':data,'token':cfg['token']}),capture_output=True,text=True,timeout=30)
        if result.returncode:
            raise ConnectionError('CRM SSH unavailable')
        envelope=json.loads(result.stdout)
        if envelope.get('status') != 200:
            error=RuntimeError('CRM request rejected');error.code=envelope.get('status',503);raise error
        return envelope['payload']
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
                if not result_available(con, row['source']):
                    return  # One unavailable upstream must not delay every queued file.
            pending = con.execute('SELECT d.*,q.crm_id FROM drafts d JOIN queue q ON q.source=d.source '
                                  "WHERE d.synced=0 AND q.crm_id IS NOT NULL AND (d.error IS NULL OR d.error NOT LIKE 'HTTP4%') LIMIT 10").fetchall()
            for draft in pending:
                try:
                    data=json.loads(draft['payload'])
                    current=api('/'+str(draft['crm_id']))['item']
                    # A lost acknowledgement may have applied this exact draft already.
                    fields=('project_id','kind','title','counterparty','document_date','amount_kopecks','fiscal_key','details')
                    same=all(current.get(k)==data.get(k) for k in fields)
                    if not same:
                        expected=data.get('revision',1)
                        if current.get('status')!='needs_review' or current.get('revision')!=expected:
                            exc=RuntimeError('Draft changed; human review required');exc.code=409;raise exc
                        data['revision']=expected
                        api('/'+str(draft['crm_id'])+'/draft',data)
                    con.execute('UPDATE drafts SET synced=1,error=NULL WHERE source=? AND generation=?',
                                (draft['source'],draft['generation']))
                except Exception as exc:
                    con.execute('UPDATE drafts SET error=? WHERE source=? AND generation=?',
                                ('HTTP'+str(exc.code) if hasattr(exc,'code') else type(exc).__name__,draft['source'],draft['generation']))
                    con.commit()
                    if not str(getattr(exc,'code','')).startswith('4'):
                        return
                con.commit()
    finally:
        LOCK.release()


def result_available(con, source):
    return con.execute('SELECT crm_id FROM queue WHERE source=?',(source,)).fetchone()['crm_id'] is not None


def queue_draft(args):
    data=args.get('document')
    if not isinstance(data,dict) or len(json.dumps(data))>160000:
        raise ValueError('Full draft required')
    with db() as con:
        source=args.get('source')
        if source:
            row=con.execute('SELECT * FROM queue WHERE source=?',(source,)).fetchone()
        else:
            ident=args.get('id')
            if type(ident) is not int or ident<=0:raise ValueError('id or queued source required')
            row=con.execute('SELECT * FROM queue WHERE crm_id=? ORDER BY updated_at DESC LIMIT 1',(ident,)).fetchone()
        if not row:raise ValueError('Unknown original in this group')
        if row['crm_id'] is not None and type(data.get('revision')) is not int:
            raise ValueError('Read current revision before editing existing document')
        con.execute('INSERT INTO drafts(source,payload,generation) VALUES(?,?,1) ON CONFLICT(source) DO UPDATE SET '
                    'payload=excluded.payload,generation=drafts.generation+1,synced=0,error=NULL',
                    (row['source'],json.dumps(data,ensure_ascii=False)))
        con.commit()
    WAKE.set()
    return {'delivery':'queued','source':row['source'],'crm_id':row['crm_id'],
            'instruction':'Draft preserved locally. Check status; only draft_synced=1 confirms CRM storage.'}


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
    WAKE.set()
    with db() as con:
        rows = [dict(con.execute('SELECT source,crm_id,error FROM queue WHERE source=?',(k,)).fetchone()) for k in accepted]
    note = ('\n[CRM intake: ' + json.dumps(rows, ensure_ascii=False) +
            '. Original preserved locally. A crm_id confirms server storage only, not extraction or payment. '
            'Use finance_crm get/projects/draft to save each document extraction. If no crm_id, draft accepts this source key; '
            'save extraction locally even while offline, leave unknown project null. Check status later; '
            'report queued, not synced. Ask for missing project. Never claim a payment was posted.]')
    return {'action':'rewrite', 'text':(event.text or '') + note}


def tool(args, **kwargs):
    try:
        action = args.get('action')
        if action == 'status':
            WAKE.set()
            with db() as con:
                result = [dict(r) for r in con.execute('SELECT q.source,q.crm_id,q.error,q.updated_at,d.synced AS draft_synced,d.error AS draft_error '
                          'FROM queue q LEFT JOIN drafts d ON q.source=d.source ORDER BY q.updated_at DESC LIMIT 20')]
        elif action == 'projects':
            result = api('/projects')
        elif action == 'draft':
            result = queue_draft(args)
        elif action == 'get':
            ident = args.get('id')
            if type(ident) is not int or ident <= 0:
                raise ValueError('id required')
            result = api('/' + str(ident))
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
                'parameters':{'type':'object','properties':{'action':{'type':'string','enum':['status','projects','get','draft']},'id':{'type':'integer'},'source':{'type':'string','description':'Exact source key from CRM intake annotation; for draft before crm_id is assigned.'},
                 'document':{'type':'object','description':'Full draft: revision,project_id,kind(receipt/invoice/refund/other/unknown),title,counterparty,document_date ISO,amount_kopecks integer or null,fiscal_key FN:FD:FP or null,details:{lines:[{title,quantity decimal string,unit,amount_kopecks}],questions:[],payment_kind,vat_percent,planned_date}. Line amounts must equal total. Never infer VAT/payment.'}},'required':['action']}})
    if not STARTED:
        STARTED = True
        (folder()/'runtime.json').write_text(json.dumps({'pid':os.getpid(),'registered_at':time.time(),
            'plugin_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}))
        def worker():
            while True:
                try:
                    flush()
                except Exception:
                    pass
                WAKE.wait(30)
                WAKE.clear()
        threading.Thread(target=worker, name='finance-crm-outbox', daemon=True).start()
