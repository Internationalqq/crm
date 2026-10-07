"""Durable field-message outbox in Anya's existing gateway, no Telegram poller."""
import base64
import hashlib
import json
import os
import re
from pathlib import Path
import sqlite3
import threading
import time
import urllib.request

PROFILE=Path('/Users/egor/.hermes/profiles/anya')
LOCK=threading.Lock();WAKE=threading.Event();STARTED=False


def config():
    try:return json.loads((PROFILE/'field-crm.json').read_text())
    except (ValueError,OSError):return {}


def folder():
    p=PROFILE/'workspace/daily-reports/crm-outbox';p.mkdir(parents=True,exist_ok=True);return p


class Connection(sqlite3.Connection):
    def __exit__(self,*args):
        try:return super().__exit__(*args)
        finally:self.close()


def db():
    con=sqlite3.connect(folder()/'queue.sqlite3',timeout=15,factory=Connection);con.row_factory=sqlite3.Row
    con.execute('CREATE TABLE IF NOT EXISTS sources(source TEXT PRIMARY KEY,payload TEXT NOT NULL,crm_id INTEGER,error TEXT,updated_at REAL NOT NULL)')
    con.execute('CREATE TABLE IF NOT EXISTS operations(source TEXT NOT NULL,op_key TEXT NOT NULL,payload TEXT NOT NULL,generation INTEGER NOT NULL,synced INTEGER NOT NULL DEFAULT 0,result TEXT,error TEXT,PRIMARY KEY(source,op_key))')
    return con


def api(path,data=None):
    cfg=config()
    if not cfg.get('group_id'):raise ValueError('group_not_connected')
    if cfg.get('relay_url')!='http://127.0.0.1:18878/':raise ValueError('unexpected_relay')
    req=urllib.request.Request(cfg['relay_url'],data=json.dumps({'namespace':'field','path':path,'data':data,'token':cfg['token']}).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as r:value=json.load(r)
    if value.get('status')!=200:
        exc=RuntimeError('CRM request rejected');exc.code=value.get('status',503)
        reason=value.get('payload',{}).get('error','')
        exc.reason=reason if isinstance(reason,str) and re.fullmatch('[a-z0-9_]{1,100}',reason) else ''
        raise exc
    return value['payload']


def flush():
    if not config().get('group_id') or not LOCK.acquire(False):return
    try:
        with db() as con:
            for row in con.execute("SELECT * FROM sources WHERE crm_id IS NULL AND (error IS NULL OR error NOT LIKE 'HTTP4%') ORDER BY updated_at LIMIT 20").fetchall():
                try:
                    data=json.loads(row['payload']);media=[]
                    for f in data.pop('files',[]):
                        p=folder()/f['local_name'];raw=p.read_bytes()
                        if hashlib.sha256(raw).hexdigest()!=f['sha256']:raise ValueError('original_integrity_error')
                        media.append({'filename':f['name'],'content_base64':base64.b64encode(raw).decode()})
                    data['media']=media;v=api('/import',data)
                    con.execute('UPDATE sources SET crm_id=?,error=NULL WHERE source=?',(v['message_id'],row['source']))
                except Exception as exc:
                    con.execute('UPDATE sources SET error=? WHERE source=?',(error_code(exc),row['source']));con.commit();return
                con.commit()
            for row in con.execute("SELECT o.*,s.crm_id FROM operations o JOIN sources s ON s.source=o.source WHERE o.synced=0 AND s.crm_id IS NOT NULL AND (o.error IS NULL OR o.error NOT LIKE 'HTTP4%') ORDER BY s.updated_at,o.rowid LIMIT 20").fetchall():
                try:
                    data=json.loads(row['payload']);mid=row['crm_id'];result={}
                    if data.get('transcript'):api('/messages/'+str(mid)+'/transcript',{'transcript':data['transcript']})
                    if data.get('attach_to'):
                        result=api('/'+str(data['attach_to'])+'/attach',{'source_ids':[mid],'revision':data.get('revision')})
                    else:
                        event=data['event'];event['message_id']=mid
                        extra=[]
                        for source in data.get('source_refs',[]):
                            r=con.execute('SELECT crm_id FROM sources WHERE source=?',(source,)).fetchone()
                            if not r or not r['crm_id']:raise ConnectionError('source_not_synced')
                            extra.append(r['crm_id'])
                        event['source_ids']=extra
                        result=api('/events',event)
                        if data.get('apply'):
                            result=api('/'+str(result['item']['id'])+'/apply',{'revision':result['item']['revision']})
                    con.execute('UPDATE operations SET synced=1,result=?,error=NULL WHERE source=? AND op_key=? AND generation=?',(json.dumps(result,ensure_ascii=False),row['source'],row['op_key'],row['generation']))
                except Exception as exc:
                    con.execute('UPDATE operations SET error=? WHERE source=? AND op_key=? AND generation=?',(error_code(exc),row['source'],row['op_key'],row['generation']));con.commit()
                    if not str(getattr(exc,'code','')).startswith('4'):return
                con.commit()
    finally:LOCK.release()


def error_code(exc):return ('HTTP'+str(exc.code)+(':'+exc.reason if getattr(exc,'reason','') else '')) if hasattr(exc,'code') else type(exc).__name__


def enqueue(args):
    source=args.get('source');event=args.get('event');attach=args.get('attach_to')
    if not isinstance(source,str) or not (isinstance(event,dict) or type(attach) is int):raise ValueError('source_and_event_required')
    key=('attach-'+str(attach)) if attach else str(event.get('event_key') or '')
    if not key or len(json.dumps(args))>180000:raise ValueError('bad_operation')
    payload={k:args[k] for k in ['event','attach_to','revision','transcript','apply','source_refs'] if k in args}
    with db() as con:
        r=con.execute('SELECT * FROM sources WHERE source=?',(source,)).fetchone()
        if not r:raise ValueError('unknown_source')
        if json.loads(r['payload'])['chat_id']!=str(config().get('group_id')):raise ValueError('wrong_group')
        con.execute('INSERT INTO operations(source,op_key,payload,generation) VALUES(?,?,?,1) ON CONFLICT(source,op_key) DO UPDATE SET payload=excluded.payload,generation=operations.generation+1,synced=0,error=NULL,result=NULL',(source,key,json.dumps(payload,ensure_ascii=False)));con.commit()
    WAKE.set();return {'status':'queued','source':source,'operation':key,'instruction':'Check status. queued is not CRM completion. HTTP409 requires get/refetch and clarification, never blind retry.'}


def capture(event=None,**kwargs):
    cfg=config();source=getattr(event,'source',None);group=str(cfg.get('group_id') or '')
    if not group or Path(os.environ.get('HERMES_HOME',''))!=PROFILE or getattr(getattr(source,'platform',None),'value',None)!='telegram' or str(getattr(source,'chat_id',''))!=group or getattr(event,'internal',False):return None
    raw=getattr(event,'raw_message',None);sender=getattr(raw,'from_user',None)
    if not sender or getattr(sender,'is_bot',True):return None
    from gateway.platforms.base import get_image_cache_dir,get_document_cache_dir,get_audio_cache_dir
    roots=[f().resolve() for f in [get_image_cache_dir,get_document_cache_dir,get_audio_cache_dir]]
    files=[];total=0
    has_media=any(getattr(raw,k,None) for k in ['photo','document','voice','audio'])
    if has_media:
        for value in getattr(event,'media_urls',[]):
            p=Path(value).resolve()
            if not any(p.is_relative_to(root) for root in roots) or not p.is_file():continue
            if '[Replied-to ' in (event.text or '') and 'saved at: '+str(value)+']' in (event.text or ''):continue
            if p.suffix.lower() not in {'.jpg','.jpeg','.png','.webp','.pdf','.ogg','.oga','.mp3','.m4a','.wav','.opus'}:continue
            total+=p.stat().st_size
            if total>20*1024*1024:raise ValueError('message_media_too_large')
            data=p.read_bytes();sha=hashlib.sha256(data).hexdigest();name=sha+p.suffix.lower();target=folder()/name
            if not target.exists():temp=target.with_suffix(target.suffix+'.tmp');temp.write_bytes(data);temp.replace(target)
            original=getattr(getattr(raw,'document',None),'file_name',None) or p.name
            files.append({'name':original,'local_name':name,'sha256':sha})
    text=str(getattr(raw,'text',None) or getattr(raw,'caption',None) or '')
    # Telegram can join consecutive text chunks; retain that observed text without quoted reply context.
    if getattr(raw,'text',None) and str(event.text or '').startswith(text):text=str(event.text).split('[Replied-to ',1)[0].rstrip()
    timestamp=getattr(raw,'date',None)
    if not timestamp:raise ValueError('original_message_date_missing')
    reply=getattr(raw,'reply_to_message',None);key=group+':'+str(event.message_id)
    payload={'chat_id':group,'message_id':str(event.message_id),'sent_at':int(timestamp.timestamp()),'sender_id':str(sender.id),'sender_name':getattr(sender,'full_name',''),'text':text,'files':files,'reply_to':str(reply.message_id) if reply else None}
    with db() as con:
        con.execute('INSERT OR IGNORE INTO sources VALUES(?,?,NULL,NULL,?)',(key,json.dumps(payload,ensure_ascii=False),time.time()));con.commit()
    WAKE.set()
    note='\n[Field CRM source: '+key+'. Original saved locally, CRM delivery pending. Use field_crm projects/recent/context, then extract with stable event_key per fact. For voice copy the actual successful transcript first; never invent unheard content. REPORT DATE: explicit «отчёт за 7 октября» otherwise ORIGINAL sent day Asia/Yekaterinburg, never today from processing. Report, actual receipt, expected delivery are separate events. Require project/location/quantity/unit and verbatim fact quote for stock. Unknowns -> questions, apply=false. Known unambiguous facts -> apply=true. Photos replying to an existing report: attach_to that verified event id. Same invoice does not mean same payment; do not change payments. Check status before saying saved/applied. Read the field workflow.]'
    return {'action':'rewrite','text':(event.text or '')+note}


def tool(args,**kwargs):
    try:
        action=args.get('action')
        if action=='status':
            WAKE.set()
            with db() as con:
                result={'connected':bool(config().get('group_id')),'sources':[dict(r) for r in con.execute('SELECT source,crm_id,error,updated_at FROM sources ORDER BY updated_at DESC LIMIT 30')], 'operations':[dict(r) for r in con.execute('SELECT source,op_key,synced,result,error FROM operations ORDER BY rowid DESC LIMIT 30')]}
        elif action=='source':
            with db() as con:
                row=con.execute('SELECT * FROM sources WHERE source=?',(args.get('source'),)).fetchone()
                if not row:raise ValueError('source_not_found')
                result=dict(row);result['payload']=json.loads(result['payload']);result['payload'].pop('files',None)
        elif action=='extract':result=enqueue(args)
        elif action in {'get','context'}:
            ident=args.get('id')
            if type(ident) is not int or ident<=0:raise ValueError('id_required')
            result=api(('/context/' if action=='context' else '/')+str(ident))
        elif action in {'projects','recent'}:result=api('/projects' if action=='projects' else '')
        else:raise ValueError('unknown_action')
        return json.dumps(result,ensure_ascii=False)
    except Exception as exc:return json.dumps({'error':error_code(exc),'instruction':'Not confirmed. Inspect status/source; clarify missing facts. Do not claim delivery or retry HTTP4 without correcting the cause.'})


def register(ctx):
    global STARTED
    if Path(os.environ.get('HERMES_HOME',''))!=PROFILE:return
    ctx.register_hook('pre_gateway_dispatch',capture)
    ctx.register_tool(name='field_crm',toolset='field_crm',handler=tool,schema={'name':'field_crm','description':'Assigned daily-report group: durable original/voice transcription, daily log, actual material receipt, future delivery. No payments or automatic material consumption. Unknowns remain questions. Tool result queued needs status synced and applied evidence.', 'parameters':{'type':'object','properties':{'action':{'type':'string','enum':['status','source','projects','recent','context','get','extract']},'id':{'type':'integer'},'source':{'type':'string'},'source_refs':{'type':'array','items':{'type':'string'}},'transcript':{'type':'string','description':'Exact successful speech transcription, before saving events; immutable.'},'attach_to':{'type':'integer'},'revision':{'type':'integer'},'apply':{'type':'boolean'},'event':{'type':'object','description':'event_key stable, revision when editing, kind report/receipt/expected, project_id integer/null, location company/project/unknown, title, event_date ISO for delivery only, data: questions[], work_done/workers_count/workforce/equipment_entries/equipment/blockers/next_steps for report; lines[{title,qty decimal string,unit,sku,estimate_item_id nullable}], fact_quote exact source, date_quote for delivery date, finance_entry_id only verified invoice, delivery_status partial/complete for receipt. Do not infer VAT, payment, hours, objects or quantities.'}},'required':['action']}})
    if STARTED:return
    STARTED=True
    (folder()/'runtime.json').write_text(json.dumps({'pid':os.getpid(),'registered_at':time.time(),'plugin_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'connected':bool(config().get('group_id'))}))
    def worker():
        while True:
            try:flush()
            except Exception:pass
            WAKE.wait(30);WAKE.clear()
    threading.Thread(target=worker,name='field-crm-outbox',daemon=True).start()
