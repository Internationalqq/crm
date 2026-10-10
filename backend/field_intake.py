"""Telegram field evidence, daily reports and physical deliveries. No payment posting."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import re
import sqlite3
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import finance
import warehouse
import communications_docs as reports
from auth import user_has_any_role, user_is_guest, user_can_view_finances
from business_time import today_iso

MAX_FILE = 20 * 1024 * 1024
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.pdf', '.ogg', '.oga', '.mp3', '.m4a', '.wav', '.opus'}
MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']


def ensure_schema(con):
    con.executescript('''
    CREATE TABLE IF NOT EXISTS field_messages (
        id INTEGER PRIMARY KEY, chat_id TEXT NOT NULL, message_id TEXT NOT NULL,
        sent_at INTEGER NOT NULL, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL,
        text TEXT NOT NULL, transcript TEXT NOT NULL, reply_to TEXT,
        media_json TEXT NOT NULL, content_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
        UNIQUE(chat_id,message_id));
    CREATE TABLE IF NOT EXISTS field_events (
        id INTEGER PRIMARY KEY, message_id INTEGER NOT NULL REFERENCES field_messages(id) ON DELETE RESTRICT,
        event_key TEXT NOT NULL, kind TEXT NOT NULL, project_id INTEGER REFERENCES projects(id) ON DELETE RESTRICT,
        location TEXT NOT NULL, event_date TEXT NOT NULL, title TEXT NOT NULL,
        data_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'needs_review',
        daily_log_id INTEGER REFERENCES daily_logs(id) ON DELETE RESTRICT,
        finance_entry_id INTEGER REFERENCES finance_entries(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(message_id,event_key));
    CREATE TABLE IF NOT EXISTS field_event_sources (
        event_id INTEGER NOT NULL REFERENCES field_events(id) ON DELETE RESTRICT,
        message_id INTEGER NOT NULL REFERENCES field_messages(id) ON DELETE RESTRICT,
        PRIMARY KEY(event_id,message_id));
    CREATE TABLE IF NOT EXISTS field_receipt_lines (
        event_id INTEGER NOT NULL REFERENCES field_events(id) ON DELETE RESTRICT,
        line_no INTEGER NOT NULL, title TEXT NOT NULL, unit TEXT NOT NULL, qty TEXT NOT NULL,
        stock_move_id INTEGER REFERENCES stock_moves(id) ON DELETE RESTRICT,
        warehouse_item_id INTEGER REFERENCES warehouse_items(id) ON DELETE RESTRICT,
        PRIMARY KEY(event_id,line_no));
    CREATE INDEX IF NOT EXISTS idx_field_events_project ON field_events(project_id,event_date,id);
    ''')


def settings():
    try: return json.loads((finance.DATA_DIR/'field-intake-integration.json').read_text())
    except (OSError,ValueError): return {}


def groups(cfg):
    return {str(g) for g in [cfg.get('group_id'), *cfg.get('group_ids', [])] if g}


def line_kind(line):
    kind = line.get('item_type', 'material')
    if kind not in {'material', 'tool'}:
        raise ValueError('bad_item_type')
    return kind


def integration(handler):
    cfg=settings(); token=str(cfg.get('token') or '')
    if len(token)>=32 and hmac.compare_digest(str(handler.headers.get('Authorization','')), 'Bearer '+token):
        return cfg
    return None


def can_use(user):
    return bool(user) and not user_is_guest(user) and (user_has_any_role(user,{'admin','director','foreman','purchaser'}) or user_can_view_finances(user))


def can_unassigned(user):
    return user_has_any_role(user,{'admin','director'}) or user_can_view_finances(user)


def allowed(handler,user,project_id):
    return can_use(user) and (handler.can_access_project(user,project_id) if project_id else can_unassigned(user))


def local_day(timestamp):
    return datetime.fromtimestamp(timestamp,timezone(timedelta(hours=5))).date()


def report_day(text, sent_at):
    """Only an explicit report date overrides the original message's local day."""
    base=local_day(sent_at)
    found=[]
    # The installed Russian STT sometimes drops т in «отчёт»; keep date evidence.
    report_word=r'(?:отч[её]т|оч[её]т)'
    pattern=report_word+r'\s+за\s+(\d{1,2})\s+(%s)(?:\s+(20\d{2}))?' % '|'.join(MONTHS)
    for match in re.finditer(pattern,text,re.I):
        day,month,year=match.groups(); month=MONTHS.index(month.lower())+1
        year=int(year) if year else base.year
        found.append(date(year,month,int(day)))
    for match in re.finditer(report_word+r'\s+за\s+(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?',text,re.I):
        day,month,year=match.groups(); year=int(year) if year else base.year
        found.append(date(year,int(month),int(day)))
    if len(set(found))>1:raise ValueError('conflicting_report_dates')
    if re.search(report_word+r'\s+за\b',text,re.I) and not found and not re.search(report_word+r'\s+за\s+сегодня\b',text,re.I):raise ValueError('report_date_needs_clarification')
    result=found[0] if found else base
    if result>date.fromisoformat(today_iso()):raise ValueError('future_report_date')
    return result.isoformat()


def media_path(sha):
    if not re.fullmatch('[a-f0-9]{64}',sha):raise ValueError('bad_media_hash')
    return finance.DATA_DIR/'field-intake'/sha[:2]/sha


def ingest(con,data,cfg):
    group = str(data.get('chat_id'))
    if group not in groups(cfg):raise PermissionError('wrong_group')
    message_id=str(data.get('message_id') or '')
    if not message_id or len(message_id)>100:raise ValueError('message_id_required')
    sent=int(data.get('sent_at') or 0)
    if sent<1577836800 or sent>finance.now_ts()+300:raise ValueError('bad_sent_at')
    text=str(data.get('text') or '');transcript=str(data.get('transcript') or '')
    if len(text)+len(transcript)>60000:raise ValueError('message_too_long')
    files=data.get('media',[])
    if not isinstance(files,list) or len(files)>12:raise ValueError('bad_media')
    media=[]; total_bytes=0
    for item in files:
        name=finance.sanitize_filename(str(item.get('filename') or ''))[:200];ext=Path(name).suffix.lower()
        raw=base64.b64decode(item.get('content_base64',''),validate=True)
        total_bytes+=len(raw)
        if total_bytes>MAX_FILE:raise ValueError('message_media_too_large')
        if ext not in EXTENSIONS or not raw or len(raw)>MAX_FILE:raise ValueError('unsupported_media')
        sha=hashlib.sha256(raw).hexdigest();target=media_path(sha);target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists():
            temp=target.with_suffix('.tmp');temp.write_bytes(raw);temp.replace(target)
        elif hashlib.sha256(target.read_bytes()).hexdigest()!=sha:raise ValueError('original_integrity_error')
        media.append({'sha256':sha,'name':name,'ext':ext,'size':len(raw)})
    signature=hashlib.sha256(json.dumps([sent,text,transcript,media],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    old=con.execute('SELECT * FROM field_messages WHERE chat_id=? AND message_id=?',(group,message_id)).fetchone()
    if old:
        if old['content_hash']!=signature:raise ValueError('source_changed_original_preserved')
        return old['id']
    cur=con.execute('INSERT INTO field_messages(chat_id,message_id,sent_at,sender_id,sender_name,text,transcript,reply_to,media_json,content_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        (group,message_id,sent,str(data.get('sender_id') or '')[:100],str(data.get('sender_name') or '')[:200],text,transcript,str(data.get('reply_to') or '') or None,json.dumps(media,ensure_ascii=False),signature,finance.now_ts()))
    return cur.lastrowid


def message(con,ident):
    row=con.execute('SELECT * FROM field_messages WHERE id=?',(ident,)).fetchone()
    if not row:raise ValueError('message_not_found')
    return row


def source_text(rows):
    return '\n'.join((r['text']+'\n'+r['transcript']) for r in rows)


def event_payload(con,row,show_finance=True):
    out=dict(row);out['data']=json.loads(out.pop('data_json'))
    out['sources']=[]
    for m in con.execute('SELECT m.* FROM field_messages m JOIN field_event_sources s ON s.message_id=m.id WHERE s.event_id=?',(row['id'],)):
        src={k:m[k] for k in ['id','message_id','sender_name','sent_at','text','transcript']}
        src['media']=[dict(f,view_url=f"/api/field-intake/messages/{m['id']}/file/{f['sha256']}") for f in json.loads(m['media_json'])]
        out['sources'].append(src)
    if not show_finance:
        out.pop('finance_entry_id',None);out['data'].pop('finance_entry_id',None)
    out['possible_duplicates']=duplicate_events(con,row)
    return out


def duplicate_events(con,row):
    """Flag reposts conservatively; a human may identify a genuinely separate delivery."""
    detail=json.loads(row['data_json'])
    sources=con.execute('SELECT m.* FROM field_messages m JOIN field_event_sources s ON s.message_id=m.id WHERE s.event_id=?',(row['id'],)).fetchall()
    hashes={f['sha256'] for m in sources for f in json.loads(m['media_json'])}
    result=[]
    for other in con.execute("SELECT * FROM field_events WHERE id!=? AND kind=? AND project_id IS ? AND status='applied'",(row['id'],row['kind'],row['project_id'])):
        other_sources=con.execute('SELECT m.* FROM field_messages m JOIN field_event_sources s ON s.message_id=m.id WHERE s.event_id=?',(other['id'],)).fetchall()
        same_media=bool(hashes & {f['sha256'] for m in other_sources for f in json.loads(m['media_json'])})
        od=json.loads(other['data_json'])
        def material_signature(data):
            try:return sorted((line_kind(l),str(l.get('title','')).strip().casefold(),str(l.get('unit','')).strip().casefold(),str(quantity(l.get('qty')).normalize())) for l in data.get('lines',[]))
            except (ValueError,TypeError):return None
        same_data=(row['event_date']==other['event_date'] and row['location']==other['location'] and
                   (bool(material_signature(detail)) and material_signature(detail)==material_signature(od) if row['kind']!='report' else detail.get('work_done')==od.get('work_done')))
        if same_media or same_data:result.append(other['id'])
    return result


def save_event(con,data,project_ids,cfg=None):
    mid=data.get('message_id');primary=message(con,mid)
    if cfg and primary['chat_id'] not in groups(cfg):raise PermissionError('wrong_group')
    ids=sorted(set([mid]+data.get('source_ids',[])))
    if len(ids)>20:raise ValueError('too_many_sources')
    sources=[message(con,i) for i in ids]
    if any(r['chat_id']!=primary['chat_id'] for r in sources):raise PermissionError('source_group_mismatch')
    key=str(data.get('event_key') or '')
    if not re.fullmatch('[a-zA-Z0-9_-]{1,80}',key):raise ValueError('event_key_required')
    old=con.execute('SELECT * FROM field_events WHERE message_id=? AND event_key=?',(mid,key)).fetchone()
    if old and old['project_id'] and old['project_id'] not in project_ids:raise PermissionError('project_forbidden')
    kind=data.get('kind');project=data.get('project_id') or None;location=data.get('location','unknown')
    if kind not in {'report','receipt','expected','purchase'}:raise ValueError('bad_kind')
    if project and (type(project) is not int or project not in project_ids):raise PermissionError('project_forbidden')
    for ident in ids:
        assigned=[r[0] for r in con.execute('SELECT e.project_id FROM field_events e JOIN field_event_sources s ON s.event_id=e.id WHERE s.message_id=? AND e.project_id IS NOT NULL AND e.id!=?',(ident,old['id'] if old else -1))]
        if any(p!=project for p in assigned):raise PermissionError('source_project_mismatch')
    if location not in {'company','project','unknown'}:raise ValueError('bad_location')
    detail=data.get('data',{})
    if not isinstance(detail,dict) or len(json.dumps(detail))>160000:raise ValueError('bad_event_data')
    if set(detail)-{'questions','work_done','workers_count','workforce','equipment_entries','equipment','blockers','next_steps','fact_quote','date_quote','report_date_quote','date_issue','lines','finance_entry_id','delivery_status','purchase_event_id'}:raise ValueError('unsupported_event_field')
    detail=dict(detail);detail.pop('date_issue',None)
    questions=detail.get('questions',[])
    if not isinstance(questions,list) or any(not isinstance(x,str) for x in questions):raise ValueError('bad_questions')
    text=source_text(sources)
    if kind=='report':
        quote=str(detail.get('report_date_quote') or '')
        if quote and quote not in text:raise ValueError('date_evidence_required')
        if quote and not re.search(r'(?:отч[её]т|оч[её]т)\s+за\b',quote,re.I):raise ValueError('report_date_needs_clarification')
        try:day=report_day(quote or source_text([primary]),primary['sent_at'])
        except ValueError:
            day=local_day(primary['sent_at']).isoformat()
            detail['date_issue']='Дата отчёта требует уточнения: укажите «отчёт за ДД месяц ГГГГ».'
    else:
        day=str(data.get('event_date') or local_day(primary['sent_at']).isoformat())
        if date.fromisoformat(day).isoformat()!=day:raise ValueError('bad_event_date')
        if data.get('event_date') and day!=local_day(primary['sent_at']).isoformat():
            quote=str(detail.get('date_quote') or '')
            if not quote or quote not in text:raise ValueError('date_evidence_required')
    title=str(data.get('title') or '')[:500]
    if not title:raise ValueError('title_required')
    encoded=json.dumps(detail,ensure_ascii=False,sort_keys=True)
    values=(kind,project,location,day,title,encoded)
    if old:
        old_sources=[r[0] for r in con.execute('SELECT message_id FROM field_event_sources WHERE event_id=? ORDER BY message_id',(old['id'],))]
        if values==tuple(old[k] for k in ['kind','project_id','location','event_date','title','data_json']) and ids==old_sources:return old['id']
        if old['status']=='applied':raise ValueError('applied_event_immutable')
        if data.get('revision')!=old['revision']:raise ValueError('revision_conflict')
        if not set(old_sources).issubset(ids):raise ValueError('original_sources_cannot_be_removed')
        con.execute('UPDATE field_events SET kind=?,project_id=?,location=?,event_date=?,title=?,data_json=?,revision=revision+1,updated_at=? WHERE id=?',(*values,finance.now_ts(),old['id']))
        ident=old['id']
    else:
        ident=con.execute('INSERT INTO field_events(message_id,event_key,kind,project_id,location,event_date,title,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
            (mid,key,*values,finance.now_ts(),finance.now_ts())).lastrowid
    con.executemany('INSERT OR IGNORE INTO field_event_sources VALUES(?,?)',[(ident,i) for i in ids])
    return ident


def quantity(value):
    try:q=Decimal(str(value))
    except InvalidOperation:raise ValueError('bad_quantity')
    if not q.is_finite() or q<=0 or q>Decimal('1000000000') or q.as_tuple().exponent < -6:raise ValueError('bad_quantity')
    return q


def attach_photos(con,row,actor):
    if not row['daily_log_id']:return
    current=con.execute('SELECT count(*) FROM daily_log_photos WHERE daily_log_id=?',(row['daily_log_id'],)).fetchone()[0]
    for src in con.execute('SELECT m.* FROM field_messages m JOIN field_event_sources s ON s.message_id=m.id WHERE s.event_id=?',(row['id'],)):
        for file in json.loads(src['media_json']):
            if file['ext'] not in {'.jpg','.jpeg','.png','.webp'}:continue
            key='field-photo-'+str(row['id'])+'-'+file['sha256'][:32]
            if con.execute('SELECT 1 FROM daily_log_photos WHERE daily_log_id=? AND client_photo_id=?',(row['daily_log_id'],key)).fetchone():continue
            if current>=reports.DAILY_LOG_PHOTO_LIMIT:raise ValueError('daily_log_photo_limit')
            raw=reports.compress_daily_log_image(media_path(file['sha256']).read_bytes())
            if not raw:raise ValueError('bad_daily_log_photo_format')
            name=key+'.webp';target=finance.project_documents_dir(row['project_id'])/name;target.write_bytes(raw);now=finance.now_ts()
            ident=con.execute("INSERT INTO documents(project_id,title,doc_type,status,original_name,storage_name,storage_path,mime_type,file_ext,size_bytes,notes,uploaded_by,is_client_visible,created_at,updated_at,generated_by_system) VALUES(?,?,'photo_report','draft',?,?,?,'image/webp','.webp',?,?,?,0,?,?,0)",
                (row['project_id'],'Фото к отчёту за '+row['event_date'],file['name'],name,str(target.relative_to(finance.PROJECT_ROOT)),len(raw),'Telegram: исходник сохранён',actor,now,now)).lastrowid
            con.execute('INSERT INTO daily_log_photos(daily_log_id,project_id,document_id,client_photo_id,created_by,created_at) VALUES(?,?,?,?,?,?)',(row['daily_log_id'],row['project_id'],ident,key,actor,now));current+=1


def apply_event(con,row,actor,confirm_distinct=False):
    if row['status']=='applied':return
    if duplicate_events(con,row) and not confirm_distinct:raise ValueError('possible_duplicate_check_required')
    detail=json.loads(row['data_json']);sources=con.execute('SELECT m.* FROM field_messages m JOIN field_event_sources s ON s.message_id=m.id WHERE s.event_id=?',(row['id'],)).fetchall();text=source_text(sources)
    if detail.get('questions') or detail.get('date_issue'):raise ValueError('unresolved_questions')
    project=row['project_id'];now=finance.now_ts()
    if row['kind']=='report':
        if not project:raise ValueError('project_required')
        if row['event_date']>today_iso():raise ValueError('future_report_date')
        start=con.execute('SELECT started_at FROM projects WHERE id=?',(project,)).fetchone()[0]
        if start and row['event_date']<str(start):raise ValueError('report_date_before_project_start')
        workforce,error=reports.normalize_daily_log_resources(detail.get('workforce'), 'workforce')
        if error:raise ValueError(error['error'])
        equipment,error=reports.normalize_daily_log_resources(detail.get('equipment_entries'),'equipment')
        if error:raise ValueError(error['error'])
        count=detail.get('workers_count',0)
        if type(count) is not int or not 0<=count<=999:raise ValueError('bad_workers_count')
        work=str(detail.get('work_done') or '').strip()
        if not work:raise ValueError('work_done_required')
        cur=con.execute('INSERT INTO daily_logs(project_id,report_date,title,work_done,workers_count,equipment,blockers,next_steps,raw_input,is_client_visible,client_request_id,workers_json,equipment_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)',
            (project,row['event_date'],row['title'],work,sum(x['count'] for x in workforce) if workforce else count,str(detail.get('equipment') or ''),str(detail.get('blockers') or ''),str(detail.get('next_steps') or ''),text,'field-report-'+str(row['id']),json.dumps(workforce,ensure_ascii=False),json.dumps(equipment,ensure_ascii=False),actor,now,now))
        con.execute('UPDATE field_events SET daily_log_id=? WHERE id=?',(cur.lastrowid,row['id']))
        row=con.execute('SELECT * FROM field_events WHERE id=?',(row['id'],)).fetchone();attach_photos(con,row,actor)
    else:
        if row['location']=='unknown' or (row['location']=='project' and not project):raise ValueError('location_required')
        lines=detail.get('lines',[])
        if not isinstance(lines,list) or not lines or len(lines)>200:raise ValueError('material_lines_required')
        if row['kind']=='receipt' and row['event_date']>today_iso():raise ValueError('future_receipt_is_not_stock')
        fact=str(detail.get('fact_quote') or '')
        if not fact or fact not in text:raise ValueError('fact_evidence_required')
        if row['kind']=='expected' and (not detail.get('date_quote') or detail['date_quote'] not in text):raise ValueError('delivery_date_needs_clarification')
        if row['kind']=='receipt':
            if re.search(r'пришл[юё]|приед[еу]|ожида|планир|будет|будут|не\s+(?:приех|прив[её]з|зав[её]з|приш|поступ|получ|прин|достав)',fact,re.I):raise ValueError('planned_delivery_is_not_stock')
            if not re.search(r'\b(?:приехал\w*|привезл\w*|привёз|привез[её]н\w*|пришл[аио]\w*|поступил\w*|получил\w*|принял\w*|принят\w*|доставил\w*|доставлен\w*|завезл\w*|завёз|завез[её]н\w*)\b',fact,re.I):raise ValueError('actual_receipt_evidence_required')
        if row['kind']=='purchase':
            if row['event_date']>today_iso() or re.search(r'\b(?:не\s+(?:куп|закуп|приобр)|купим|купить|планир)',fact,re.I) or not re.search(r'\b(?:купил\w*|куплен\w*|закупил\w*|приобр[её]л\w*)\b',fact,re.I):
                raise ValueError('actual_purchase_evidence_required')
        purchase_id=detail.get('purchase_event_id')
        if purchase_id:
            if type(purchase_id) is not int:raise ValueError('purchase_link_mismatch')
            purchase=con.execute("SELECT * FROM field_events WHERE id=? AND kind='purchase' AND status='applied' AND project_id IS ? AND location=?",(purchase_id,project,row['location'])).fetchone()
            if row['kind']!='receipt' or not purchase:raise ValueError('purchase_link_mismatch')
            purchased=json.loads(purchase['data_json'])['lines']
            delivered=[]
            for previous in con.execute("SELECT data_json FROM field_events WHERE kind='receipt' AND status='applied' AND project_id IS ?",(project,)):
                prior=json.loads(previous['data_json'])
                if prior.get('purchase_event_id')==purchase_id:delivered.extend(prior['lines'])
            signature=lambda l:(line_kind(l),str(l.get('title','')).strip().casefold(),str(l.get('unit','')).strip())
            for line in lines:
                key=signature(line)
                total=sum((quantity(l['qty']) for l in purchased if signature(l)==key),Decimal(0))
                used=sum((quantity(l['qty']) for l in delivered+lines if signature(l)==key),Decimal(0))
                if used>total:raise ValueError('receipt_exceeds_purchase')
        linked=detail.get('finance_entry_id')
        if linked:
            invoice=con.execute("SELECT id FROM finance_entries WHERE id=? AND project_id=? AND direction='expense' AND status!='cancelled'",(linked,project)).fetchone()
            if not invoice:raise ValueError('invoice_project_mismatch')
            if row['kind']=='receipt' and detail.get('delivery_status') not in {'partial','complete'}:raise ValueError('delivery_status_required')
            con.execute('UPDATE field_events SET finance_entry_id=? WHERE id=?',(linked,row['id']))
        for n,line in enumerate(lines):
            title=str(line.get('title') or '').strip();unit=str(line.get('unit') or '').strip();qty=quantity(line.get('qty'))
            item_type=line_kind(line)
            if not title or not unit or len(title)>500 or len(unit)>30:raise ValueError('material_title_unit_required')
            if row['kind'] in {'expected','purchase'}:continue
            move=None;item=None
            if row['location']=='company':
                # Do not use the manual form's fuzzy matching or overwrite a unit.
                sku=str(line.get('sku') or '')[:100]
                target=next((r for r in warehouse.warehouse_item_rows(con) if r['item_type']==item_type and r['name'].casefold()==title.casefold() and r['unit']==unit and str(r['sku'] or '')==sku),None)
                if target:
                    item=target['id'];con.execute('UPDATE warehouse_items SET qty=qty+?,updated_at=? WHERE id=?',(float(qty),now,item))
                else:
                    item=con.execute("INSERT INTO warehouse_items(item_type,category,name,sku,unit,qty,condition_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",(item_type,'Инструмент' if item_type=='tool' else 'Материалы',title,sku,unit,float(qty),'Новый' if item_type=='tool' else 'new',now,now)).lastrowid
            else:
                estimate=line.get('estimate_item_id') or None
                if estimate:
                    material=con.execute('SELECT * FROM estimate_items WHERE id=? AND project_id=? AND COALESCE(is_deleted,0)=0',(estimate,project)).fetchone()
                    resolved_kind='tool' if material and material['item_kind']=='tool' else warehouse.resolved_estimate_item_kind(material) if material else None
                    if not material or resolved_kind!=item_type or material['unit']!=unit:raise ValueError('material_project_or_unit_mismatch')
                move=con.execute("INSERT INTO stock_moves(project_id,estimate_item_id,move_type,qty,price,comment,created_by,created_at,source_type,source_id,source_key,material_title_snapshot,material_unit_snapshot) VALUES(?,?,'receipt',?,0,?,?,?,'field_intake',?,?,?,?)",
                    (project,estimate,float(qty),'Приход Telegram за '+row['event_date'],actor,now,row['id'],f"field:{row['id']}:{n}",title,unit)).lastrowid
            con.execute('INSERT INTO field_receipt_lines VALUES(?,?,?,?,?,?,?)',(row['id'],n,title,unit,str(qty),move,item))
    con.execute("UPDATE field_events SET status='applied',revision=revision+1,updated_at=? WHERE id=?",(now,row['id']))
    finance.create_audit(con,actor,'apply_field_event','field_event',row['id'],{'kind':row['kind'],'project_id':project,'event_date':row['event_date'],'cash_posted':False})


def project_inventory(con, project_id):
    """Unbudgeted stock and undelivered purchases, with their original evidence."""
    events=con.execute("SELECT * FROM field_events WHERE project_id=? AND status='applied' AND location='project' ORDER BY id DESC",(project_id,)).fetchall()
    received={}
    for event in events:
        data=json.loads(event['data_json'])
        if event['kind']=='receipt' and data.get('purchase_event_id'):
            for line in data['lines']:
                key=(data['purchase_event_id'],line_kind(line),line['title'].strip().casefold(),line['unit'].strip())
                received[key]=received.get(key,Decimal(0))+quantity(line['qty'])
    result=[]
    for event in events:
        data=json.loads(event['data_json'])
        if event['kind'] not in {'receipt','purchase','expected'}:continue
        for n,line in enumerate(data.get('lines',[])):
            kind=line_kind(line)
            if event['kind']=='receipt' and line.get('estimate_item_id'):continue
            qty=quantity(line['qty'])
            status='on_site'
            if event['kind']=='purchase':
                key=(event['id'],kind,line['title'].strip().casefold(),line['unit'].strip())
                # Consume linked receipts once even when the purchase repeats a line.
                delivered=min(qty,received.get(key,Decimal(0)))
                received[key]=received.get(key,Decimal(0))-delivered
                qty-=delivered
                status='purchased'
            elif event['kind']=='expected':status='expected'
            if qty<=0:continue
            result.append({'eventId':event['id'],'itemKind':kind,'title':line['title'],'unit':line['unit'],
                           'quantity':float(qty),'status':status,'eventDate':event['event_date']})
    return result


def balances(con,project_ids):
    result=[]
    for r in warehouse.warehouse_item_rows(con):
        result.append({'project_id':None,'location':'company','location_title':'Склад компании','name':r['name'],'unit':r['unit'],'qty':float(r['qty']),'item_id':r['id'],'item_type':r['item_type']})
    for pid in project_ids:
        title=con.execute('SELECT title FROM projects WHERE id=?',(pid,)).fetchone()[0]
        rows=con.execute("""SELECT s.estimate_item_id,COALESCE(e.title,NULLIF(s.material_title_snapshot,''),'Без названия') AS title,
            COALESCE(e.unit,NULLIF(s.material_unit_snapshot,''),'') AS unit,
            COALESCE(NULLIF(e.item_kind,''),json_extract(f.data_json,'$.lines[' || l.line_no || '].item_type'),'material') AS item_type,
            SUM(CASE WHEN s.move_type='receipt' THEN s.qty WHEN s.move_type IN ('use','writeoff') THEN -s.qty ELSE 0 END) AS qty
            FROM stock_moves s LEFT JOIN estimate_items e ON e.id=s.estimate_item_id
            LEFT JOIN field_receipt_lines l ON l.stock_move_id=s.id LEFT JOIN field_events f ON f.id=l.event_id
            WHERE s.project_id=? GROUP BY s.estimate_item_id,2,3,4 HAVING ABS(SUM(CASE WHEN s.move_type='receipt' THEN s.qty WHEN s.move_type IN ('use','writeoff') THEN -s.qty ELSE 0 END))>0.0000001""",(pid,)).fetchall()
        for r in rows:result.append({'project_id':pid,'location':'project','location_title':title,'name':r['title'],'unit':r['unit'],'qty':r['qty'],'item_id':r['estimate_item_id'],'item_type':r['item_type']})
    return result


def handle(handler,method,path):
    cfg=integration(handler);user=None if cfg else handler.require_user()
    if not cfg and not user:return
    if user and not can_use(user):handler.send_json(403,{'error':'forbidden'});return
    try:
        with finance.db() as con:
            projects=[dict(r) for r in con.execute('SELECT id,title FROM projects ORDER BY title') if (r['id'] in cfg.get('project_ids',[]) if cfg else handler.can_access_project(user,r['id']))]
            pids={p['id'] for p in projects};show_finance=bool(cfg) or user_can_view_finances(user)
            if method=='GET' and path=='/api/field-intake/projects':handler.send_json(200,{'projects':projects});return
            if method=='GET' and path=='/api/field-intake/balances':handler.send_json(200,{'items':balances(con,pids),'projects':projects});return
            if method=='POST' and path=='/api/field-intake/import':
                if not cfg:raise PermissionError('integration_required')
                data=handler.read_json(maximum=29*1024*1024);con.execute('BEGIN IMMEDIATE');ident=ingest(con,data,cfg);con.commit();handler.send_json(200,{'message_id':ident});return
            transcript=re.fullmatch(r'/api/field-intake/messages/(\d+)/transcript',path)
            if method=='POST' and transcript:
                if not cfg:raise PermissionError('integration_required')
                data=handler.read_json();con.execute('BEGIN IMMEDIATE');m=message(con,int(transcript[1]))
                if m['chat_id'] not in groups(cfg):raise PermissionError('wrong_group')
                value=str(data.get('transcript') or '').strip()
                if not value or len(value)>60000:raise ValueError('transcript_required')
                if not any(f['ext'] in {'.ogg','.oga','.mp3','.m4a','.wav','.opus'} for f in json.loads(m['media_json'])):raise ValueError('audio_source_required')
                if m['transcript'] and m['transcript']!=value:raise ValueError('transcript_already_saved')
                if not m['transcript'] and con.execute('SELECT 1 FROM field_event_sources WHERE message_id=?',(m['id'],)).fetchone():raise ValueError('transcript_must_precede_events')
                con.execute('UPDATE field_messages SET transcript=? WHERE id=?',(value,m['id']));con.commit();handler.send_json(200,{'message_id':m['id']});return
            context=re.fullmatch(r'/api/field-intake/context/(\d+)',path)
            if method=='GET' and context:
                pid=int(context[1])
                if pid not in pids:raise PermissionError('project_forbidden')
                materials=[dict(r) for r in con.execute("SELECT id,title,unit,item_kind FROM estimate_items WHERE project_id=? AND COALESCE(is_deleted,0)=0",(pid,))]
                invoices=[dict(r) for r in con.execute("SELECT id,category,counterparty_name,planned_date,paid_date,status,amount FROM finance_entries WHERE project_id=? AND direction='expense' AND status!='cancelled'",(pid,))] if show_finance else []
                handler.send_json(200,{'materials':materials,'invoices':invoices});return
            if method=='GET' and path=='/api/field-intake':
                rows=con.execute('SELECT * FROM field_events ORDER BY id DESC LIMIT 500').fetchall()
                visible=[r for r in rows if (message(con,r['message_id'])['chat_id'] in groups(cfg) and (not r['project_id'] or r['project_id'] in pids) if cfg else allowed(handler,user,r['project_id']))]
                handler.send_json(200,{'items':[event_payload(con,r,show_finance) for r in visible],'projects':projects,'can_finance':show_finance});return
            if method=='POST' and path=='/api/field-intake/events':
                data=handler.read_json();con.execute('BEGIN IMMEDIATE')
                if user:
                    existing=con.execute('SELECT * FROM field_events WHERE message_id=? AND event_key=?',(data.get('message_id'),data.get('event_key'))).fetchone()
                    if not existing or not allowed(handler,user,existing['project_id']):raise PermissionError('event_forbidden')
                    if not data.get('project_id') and not can_unassigned(user):raise PermissionError('project_required')
                    for source_id in data.get('source_ids',[]):
                        linked_rows=con.execute('SELECT e.* FROM field_events e JOIN field_event_sources s ON s.event_id=e.id WHERE s.message_id=?',(source_id,)).fetchall()
                        if not linked_rows or any(not allowed(handler,user,r['project_id']) for r in linked_rows):raise PermissionError('source_forbidden')
                    if not show_finance:
                        original=json.loads(existing['data_json']).get('finance_entry_id')
                        if 'finance_entry_id' in data.get('data',{}) and data['data']['finance_entry_id']!=original:raise PermissionError('finance_link_forbidden')
                        if original:data.setdefault('data',{})['finance_entry_id']=original
                ident=save_event(con,data,pids,cfg);con.commit();row=con.execute('SELECT * FROM field_events WHERE id=?',(ident,)).fetchone();handler.send_json(200,{'item':event_payload(con,row,show_finance)});return
            filematch=re.fullmatch(r'/api/field-intake/messages/(\d+)/file/([a-f0-9]{64})',path)
            if method=='GET' and filematch and not cfg:
                mid=int(filematch[1]);m=message(con,mid)
                rows=con.execute('SELECT e.* FROM field_events e JOIN field_event_sources s ON s.event_id=e.id WHERE s.message_id=?',(mid,)).fetchall()
                if not rows or not all(allowed(handler,user,r['project_id']) for r in rows):raise PermissionError('forbidden')
                file=next((x for x in json.loads(m['media_json']) if x['sha256']==filematch[2]),None)
                if not file:raise ValueError('file_not_found')
                handler.send_file(media_path(file['sha256']),mimetypes.guess_type(file['name'])[0] or 'application/octet-stream',file['name'],inline=file['ext'] in {'.jpg','.jpeg','.png','.webp','.pdf','.ogg','.mp3','.m4a','.wav'});return
            match=re.fullmatch(r'/api/field-intake/(\d+)(?:/(apply|attach))?',path)
            if not match:handler.send_json(404,{'error':'not_found'});return
            if method=='POST':con.execute('BEGIN IMMEDIATE')
            row=con.execute('SELECT * FROM field_events WHERE id=?',(int(match[1]),)).fetchone()
            if not row:raise ValueError('event_not_found')
            primary=message(con,row['message_id'])
            if cfg:
                if primary['chat_id'] not in groups(cfg) or (row['project_id'] and row['project_id'] not in pids):raise PermissionError('forbidden')
            elif not allowed(handler,user,row['project_id']):raise PermissionError('forbidden')
            if method=='GET' and not match[2]:handler.send_json(200,{'item':event_payload(con,row,show_finance)});return
            if method!='POST' or match[2] not in {'apply','attach'}:raise PermissionError('forbidden')
            data=handler.read_json();actor=cfg.get('actor_id') if cfg else user['id']
            if data.get('revision')!=row['revision'] and row['status']!='applied':raise ValueError('revision_conflict')
            if match[2]=='attach':
                if row['kind']!='report':raise ValueError('report_required')
                for ident in data.get('source_ids',[]):
                    m=message(con,ident)
                    if m['chat_id']!=primary['chat_id']:raise PermissionError('wrong_group')
                    linked_rows=con.execute('SELECT e.* FROM field_events e JOIN field_event_sources s ON s.event_id=e.id WHERE s.message_id=?',(ident,)).fetchall()
                    if any(r['project_id']!=row['project_id'] for r in linked_rows):raise PermissionError('source_project_mismatch')
                    if not cfg and not linked_rows and not can_unassigned(user):raise PermissionError('source_forbidden')
                    con.execute('INSERT OR IGNORE INTO field_event_sources VALUES(?,?)',(row['id'],ident))
                attach_photos(con,row,actor)
            else:apply_event(con,row,actor,confirm_distinct=not cfg and data.get('confirm_distinct') is True)
            con.commit();row=con.execute('SELECT * FROM field_events WHERE id=?',(row['id'],)).fetchone();handler.send_json(200,{'item':event_payload(con,row,show_finance)})
    except PermissionError as exc:handler.send_json(403,{'error':str(exc)})
    except (ValueError,TypeError,OverflowError) as exc:handler.send_json(409,{'error':str(exc)})
    except sqlite3.IntegrityError:handler.send_json(409,{'error':'related_record_conflict'})
