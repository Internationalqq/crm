"""Single-machine operational ledger. No automatic project finance posting."""
import hashlib
import hmac
import json
import re
import sqlite3
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import finance
import field_intake
from auth import user_has_any_role, user_is_guest
from business_time import today_iso

KINDS = {'work', 'fuel', 'maintenance', 'transport', 'expense', 'income'}
ROLES = {'main_admin', 'admin', 'director', 'financier', 'accountant'}


def can_use(user):
    return bool(user) and not user_is_guest(user) and user_has_any_role(user, ROLES)


def ensure_schema(con):
    con.executescript('''
    CREATE TABLE IF NOT EXISTS tractor_settings(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL);
    INSERT OR IGNORE INTO tractor_settings VALUES(1,'Трактор');
    CREATE TABLE IF NOT EXISTS tractor_entries(
        id INTEGER PRIMARY KEY, request_key TEXT NOT NULL UNIQUE,
        source_id INTEGER UNIQUE REFERENCES field_messages(id) ON DELETE RESTRICT,
        data_json TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','confirmed','cancelled')),
        revision INTEGER NOT NULL DEFAULT 1, created_by INTEGER REFERENCES users(id),
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tractor_audit(
        id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES tractor_entries(id),
        action TEXT NOT NULL, reason TEXT NOT NULL, actor_id INTEGER REFERENCES users(id), created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tractor_operations(
        request_key TEXT PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES tractor_entries(id), fingerprint TEXT NOT NULL);
    ''')


def settings():
    try:
        return json.loads((finance.DATA_DIR / 'tractor-integration.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def number(value, limit, places=2):
    try:
        result = Decimal(str(value or '0').replace(',', '.'))
    except (InvalidOperation, ValueError):
        raise ValueError('Введите корректное число')
    if not result.is_finite() or result < 0 or result > limit:
        raise ValueError('Число вне допустимого диапазона')
    if result != result.quantize(Decimal(10) ** -places):
        raise ValueError('Допустимо не больше двух знаков после запятой')
    return result


def money(value):
    return int((number(value, 100000000) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def normalize(con, raw, draft=False):
    if not isinstance(raw, dict):
        raise ValueError('Некорректная запись')
    if set(raw) - {'kind','date','location','project_id','external','description','hours','litres','rate','amount','work_id'}:
        raise ValueError('Неизвестное поле записи')
    kind = raw.get('kind', 'expense')
    if kind not in KINDS:
        raise ValueError('Выберите вид записи')
    day = str(raw.get('date') or today_iso())
    if date.fromisoformat(day).isoformat() != day:
        raise ValueError('Некорректная дата')
    location = raw.get('location', 'company')
    if location not in {'project','external','company'}:
        raise ValueError('Выберите место')
    pid = raw.get('project_id') or None
    if pid:
        if type(pid) is not int or not con.execute('SELECT id FROM projects WHERE id=?', (pid,)).fetchone():
            raise ValueError('Объект не найден')
    external = str(raw.get('external') or '').strip()
    description = str(raw.get('description') or '').strip()
    if len(external) > 300 or len(description) > 3000:
        raise ValueError('Слишком длинное описание')
    if not draft and ((location == 'project' and not pid) or (location == 'external' and not external)):
        raise ValueError('Укажите объект или стороннюю площадку')
    hours = number(raw.get('hours'), 24)
    litres = number(raw.get('litres'), 10000)
    rate = money(raw.get('rate'))
    amount = money(raw.get('amount'))
    if kind == 'work':
        if not draft and not hours:
            raise ValueError('Укажите отработанные часы')
        amount = int((hours * rate).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    elif not draft and not amount and not (kind == 'fuel' and litres):
        raise ValueError('Укажите сумму')
    work_id = raw.get('work_id') or None
    if work_id:
        if type(work_id) is not int or kind != 'income':
            raise ValueError('Оплата должна ссылаться на работу')
        work = con.execute('SELECT * FROM tractor_entries WHERE id=?', (work_id,)).fetchone()
        if not work or work['status'] != 'confirmed' or json.loads(work['data_json'])['kind'] != 'work':
            raise ValueError('Подтверждённая работа не найдена')
        wd = json.loads(work['data_json'])
        if location != wd['location'] or (location == 'project' and pid != wd['project_id']) or (location == 'external' and external != wd['external']):
            raise ValueError('Место оплаты должно совпадать с работой')
    return {'kind':kind,'date':day,'location':location,'project_id':pid if location=='project' else None,
            'external':external if location=='external' else '', 'description':description,
            'hours':str(hours) if kind=='work' else '0', 'litres':str(litres) if kind=='fuel' else '0',
            'rate_cents':rate if kind=='work' else 0,'amount_cents':amount,'work_id':work_id}


def raw_data(data):
    return {**{k:v for k,v in data.items() if k not in {'rate_cents','amount_cents'}},
            'rate':str(Decimal(data['rate_cents'])/100), 'amount':str(Decimal(data['amount_cents'])/100)}


def create(con, raw, key, actor=None, source_id=None):
    if not isinstance(key, str) or not re.fullmatch(r'[a-zA-Z0-9:_-]{8,120}', key):
        raise ValueError('Требуется ключ операции')
    previous = con.execute('SELECT * FROM tractor_entries WHERE request_key=?', (key,)).fetchone()
    data = normalize(con, raw, draft=True)
    if previous:
        if json.loads(previous['data_json']) != data:
            raise ValueError('Ключ уже использован для другой записи')
        return previous['id']
    now = finance.now_ts()
    cur = con.execute('INSERT INTO tractor_entries(request_key,source_id,data_json,status,created_by,created_at,updated_at) VALUES(?,?,?,\'draft\',?,?,?)',
                      (key,source_id,json.dumps(data,ensure_ascii=False),actor,now,now))
    audit(con, cur.lastrowid, 'created', '', actor)
    return cur.lastrowid


def audit(con, ident, action, reason, actor):
    con.execute('INSERT INTO tractor_audit(entry_id,action,reason,actor_id,created_at) VALUES(?,?,?,?,?)', (ident,action,reason,actor,finance.now_ts()))


def update(con, ident, raw, revision, actor, action='save', reason='', confirm_duplicate=False, operation_key=None):
    fingerprint=hashlib.sha256(json.dumps([ident,raw,revision,action,reason,confirm_duplicate],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    if operation_key is not None:
        if not isinstance(operation_key,str) or not re.fullmatch(r'[a-zA-Z0-9:_-]{8,160}',operation_key):raise ValueError('Требуется ключ операции')
        prior=con.execute('SELECT * FROM tractor_operations WHERE request_key=?',(operation_key,)).fetchone()
        if prior:
            if prior['entry_id']!=ident or prior['fingerprint']!=fingerprint:raise ValueError('Ключ операции уже использован. Откройте запись заново')
            return
    row = con.execute('SELECT * FROM tractor_entries WHERE id=?', (ident,)).fetchone()
    if not row:
        raise ValueError('Запись не найдена')
    if row['revision'] != revision:
        raise ValueError('Запись изменилась. Обновите страницу')
    if action == 'cancel':
        if row['status'] == 'cancelled':
            return
        if not isinstance(reason,str) or not reason.strip() or len(reason)>1000:
            raise ValueError('Укажите причину отмены')
        if json.loads(row['data_json'])['kind']=='work':
            for item in con.execute("SELECT data_json FROM tractor_entries WHERE status='confirmed'"):
                if json.loads(item[0]).get('work_id') == ident:
                    raise ValueError('Сначала отмените связанные оплаты')
        status = 'cancelled'; data = json.loads(row['data_json'])
    else:
        if action not in {'save','confirm'} or row['status'] != 'draft':
            raise ValueError('Подтверждённую запись можно только отменить')
        data = normalize(con, raw, draft=action=='save')
        if action=='confirm' and row['source_id'] and not confirm_duplicate:
            hashes={x['sha256'] for x in json.loads(field_intake.message(con,row['source_id'])['media_json'])}
            for other in con.execute("SELECT m.media_json FROM tractor_entries e JOIN field_messages m ON m.id=e.source_id WHERE e.status='confirmed' AND e.id!=?", (ident,)):
                if hashes & {x['sha256'] for x in json.loads(other[0])}:
                    raise ValueError('Этот чек уже есть в учёте. Проверьте дубликат и подтвердите отдельно')
        status = 'confirmed' if action=='confirm' else 'draft'
    con.execute('UPDATE tractor_entries SET data_json=?,status=?,revision=revision+1,updated_at=? WHERE id=?', (json.dumps(data,ensure_ascii=False),status,finance.now_ts(),ident))
    audit(con, ident, action, reason.strip(), actor)
    if operation_key is not None:
        con.execute('INSERT INTO tractor_operations VALUES(?,?,?)',(operation_key,ident,fingerprint))


def payload(con, row):
    result = dict(row); result.pop('request_key'); result['data']=json.loads(result.pop('data_json'))
    result['history']=[dict(r) for r in con.execute('SELECT action,reason,created_at FROM tractor_audit WHERE entry_id=? ORDER BY id',(row['id'],))]
    result['source']=None
    if row['source_id']:
        m=field_intake.message(con,row['source_id'])
        result['source']={'text':m['text'],'transcript':m['transcript'],'sender':m['sender_name'],'sent_at':m['sent_at'],
                          'media':[dict(f,view_url=f"/api/tractor/messages/{m['id']}/file/{f['sha256']}") for f in json.loads(m['media_json'])]}
    return result


def handle(handler, method, path):
    cfg=settings(); token=str(cfg.get('token') or '')
    integration = cfg.get('enabled') is True and path in {'/api/tractor/import','/api/tractor/context'} and len(token)>=32 and hmac.compare_digest(str(handler.headers.get('Authorization','')), 'Bearer '+token)
    user=None
    if not integration:
        user=handler.require_user()
        if not user:return
        if not can_use(user):handler.send_json(403,{'error':'tractor_forbidden'});return
    try:
        with finance.db() as con:
            if method=='POST':
                data=handler.read_json()
                if not isinstance(data,dict):raise ValueError('Требуется объект JSON')
                con.execute('BEGIN IMMEDIATE')
            if method=='GET' and path=='/api/tractor/context':
                handler.send_json(200,{'projects':[dict(r) for r in con.execute('SELECT id,title FROM projects ORDER BY title')], 'today':today_iso()});return
            if method=='POST' and path=='/api/tractor/import':
                if not integration:raise PermissionError('integration_required')
                if not isinstance(data,dict) or not isinstance(data.get('message'),dict):raise ValueError('message_required')
                mid=field_intake.ingest(con,data['message'],cfg)
                record=data.get('record',{})
                if not isinstance(record,dict):raise ValueError('record_required')
                record=dict(record)
                record.setdefault('date',field_intake.local_day(data['message']['sent_at']).isoformat())
                old=con.execute('SELECT * FROM tractor_entries WHERE source_id=?',(mid,)).fetchone()
                if old and json.loads(old['data_json'])!=normalize(con,record,draft=True):raise ValueError('Источник уже сохранён с другими данными. Исправьте запись в CRM')
                ident=old['id'] if old else create(con,record,'telegram-message:'+str(mid),None,mid)
                con.commit();handler.send_json(200,{'id':ident,'status':'draft' if not old else con.execute('SELECT status FROM tractor_entries WHERE id=?',(ident,)).fetchone()[0]});return
            if method=='GET' and path=='/api/tractor':
                rows=sorted(con.execute('SELECT * FROM tractor_entries').fetchall(),key=lambda r:(json.loads(r['data_json'])['date'],r['id']),reverse=True)
                projects=[dict(r) for r in con.execute('SELECT id,title FROM projects ORDER BY title')]
                handler.send_json(200,{'name':con.execute('SELECT name FROM tractor_settings WHERE id=1').fetchone()[0],
                    'today':today_iso(),'items':[payload(con,r) for r in rows], 'projects':projects,
                    'telegram_connected':len(token)>=32 and bool(field_intake.groups(cfg)) and cfg.get('enabled') is True});return
            if method=='POST' and path=='/api/tractor/name':
                name=str(data.get('name') or '').strip()
                if not name or len(name)>100:raise ValueError('Введите название до 100 символов')
                con.execute('UPDATE tractor_settings SET name=? WHERE id=1',(name,));con.commit();handler.send_json(200,{'name':name});return
            if method=='POST' and path=='/api/tractor/entries':
                ident=create(con,data.get('data'),data.get('request_key'),user['id']);con.commit()
                handler.send_json(200,{'item':payload(con,con.execute('SELECT * FROM tractor_entries WHERE id=?',(ident,)).fetchone())});return
            match=re.fullmatch(r'/api/tractor/entries/(\d+)',path)
            if method=='POST' and match:
                ident=int(match[1])
                if not data.get('operation_key'):raise ValueError('Требуется ключ операции')
                update(con,ident,data.get('data'),data.get('revision'),user['id'],data.get('action','save'),data.get('reason',''),data.get('confirm_duplicate') is True,data['operation_key']);con.commit()
                handler.send_json(200,{'item':payload(con,con.execute('SELECT * FROM tractor_entries WHERE id=?',(ident,)).fetchone())});return
            file=re.fullmatch(r'/api/tractor/messages/(\d+)/file/([a-f0-9]{64})',path)
            if method=='GET' and file:
                mid=int(file[1])
                if not con.execute('SELECT id FROM tractor_entries WHERE source_id=?',(mid,)).fetchone():raise PermissionError('source_forbidden')
                m=field_intake.message(con,mid);media=next((f for f in json.loads(m['media_json']) if f['sha256']==file[2]),None)
                if not media:raise ValueError('Файл не найден')
                import mimetypes
                handler.send_file(field_intake.media_path(media['sha256']),mimetypes.guess_type(media['name'])[0] or 'application/octet-stream',media['name'],inline=True);return
            handler.send_json(404,{'error':'not_found'})
    except PermissionError as error:handler.send_json(403,{'error':str(error)})
    except (ValueError,TypeError,KeyError,OverflowError,InvalidOperation) as error:handler.send_json(409,{'error':str(error)})
    except sqlite3.IntegrityError:handler.send_json(409,{'error':'Конфликт связанной записи'})
