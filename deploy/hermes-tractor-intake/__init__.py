"""Tractor drafts over the existing local SSH relay; durable original capture is shared."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import threading
import time
import urllib.request

PROFILE=Path(__file__).resolve().parents[2]
# Installed beside this plugin from deploy/hermes-field-intake/__init__.py.
spec=importlib.util.spec_from_file_location('tractor_source_capture',Path(__file__).with_name('_source_capture.py'))
source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
STARTED=False;LOCK=threading.Lock();WAKE=threading.Event()


def config():
    try:return json.loads((PROFILE/'tractor-crm.json').read_text())
    except (OSError,ValueError):return {}


def folder():
    p=PROFILE/'workspace/tractor/crm-outbox';p.mkdir(parents=True,exist_ok=True);return p


source.config=config;source.folder=folder;source.WAKE=WAKE


def api(path,data=None):
    cfg=config()
    if cfg.get('relay_url')!='http://127.0.0.1:18878/' or not source.groups(cfg):raise ValueError('group_not_connected')
    req=urllib.request.Request(cfg['relay_url'],data=json.dumps({'namespace':'tractor','path':path,'data':data,'token':cfg['token']}).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as r:v=json.load(r)
    if v.get('status')!=200:raise ValueError('HTTP'+str(v.get('status')))
    return v['payload']


def flush():
    if not LOCK.acquire(False):return
    try:
        with source.db() as con:
            rows=con.execute("SELECT s.source,s.payload AS original,o.payload AS extraction,o.generation FROM sources s JOIN operations o ON o.source=s.source WHERE o.synced=0 AND (o.error IS NULL OR o.error NOT LIKE 'HTTP4%') LIMIT 20").fetchall()
            for row in rows:
                try:
                    message=json.loads(row['original']);media=[]
                    for f in message.pop('files',[]):
                        raw=(folder()/f['local_name']).read_bytes()
                        if hashlib.sha256(raw).hexdigest()!=f['sha256']:raise ValueError('original_integrity_error')
                        media.append({'filename':f['name'],'content_base64':base64.b64encode(raw).decode()})
                    args=json.loads(row['extraction']);message['media']=media;message['transcript']=args.get('transcript','')
                    result=api('/import',{'message':message,'record':args['record'],**({'needs_clarification':True} if args.get('needs_clarification') is True else {})})
                    con.execute('UPDATE sources SET crm_id=? WHERE source=?',(result['id'],row['source']))
                    con.execute("UPDATE operations SET synced=1,result=?,error=NULL WHERE source=? AND op_key='tractor' AND generation=?",(json.dumps(result),row['source'],row['generation']))
                except Exception as e:
                    code=str(e) if isinstance(e,ValueError) and str(e).startswith('HTTP') else type(e).__name__
                    con.execute("UPDATE operations SET error=? WHERE source=? AND op_key='tractor' AND generation=?",(code,row['source'],row['generation']))
                con.commit()
    finally:LOCK.release()


def capture(event):
    result=source.capture(event)
    if result:
        original=result['text'].split('\n[Field CRM source:',1)[0]
        key=str(event.source.chat_id)+':'+str(event.message_id)
        return {'action':'rewrite','text':original+'\n[Tractor CRM source: '+key+'. Read plugins/tractor-crm-intake/WORKFLOW.md. Use tractor_crm context and extract. Complete single facts enter the journal automatically; ambiguous or multiple facts must set needs_clarification=true. Never claim paid without explicit receipt evidence. Exact original/voice evidence, hours, litres and money only from source; ask about unknowns. Check status synced=1 before saying saved to CRM.]'}


def tool(args,**kwargs):
    try:
        action=args.get('action')
        if action=='context':result=api('/context')
        elif action=='extract':
            if 'needs_clarification' in args and type(args['needs_clarification']) is not bool:raise ValueError('clarification_flag_required')
            key=args.get('source');record=args.get('record')
            if not isinstance(key,str) or not isinstance(record,dict) or len(json.dumps(args))>180000:raise ValueError('source_record_required')
            with source.db() as con:
                row=con.execute('SELECT * FROM sources WHERE source=?',(key,)).fetchone()
                if not row or json.loads(row['payload'])['chat_id'] not in source.groups(config()):raise ValueError('unknown_source')
                payload=json.dumps({'record':record,'transcript':args.get('transcript',''),**({'needs_clarification':True} if args.get('needs_clarification') is True else {})},sort_keys=True,ensure_ascii=False)
                old=con.execute("SELECT * FROM operations WHERE source=? AND op_key='tractor'",(key,)).fetchone()
                if old and old['synced']:
                    if old['payload']!=payload:raise ValueError('already_synced_edit_in_crm')
                    return old['result']
                con.execute("INSERT INTO operations VALUES(?,'tractor',?,1,0,NULL,NULL) ON CONFLICT(source,op_key) DO UPDATE SET payload=excluded.payload,generation=generation+1,error=NULL",(key,payload));con.commit()
            WAKE.set();result={'queued':True,'confirmed':False}
        elif action in {'status','source'}:
            WAKE.set()
            with source.db() as con:
                if action=='status':result={'sources':[dict(r) for r in con.execute('SELECT source,crm_id,error FROM sources ORDER BY updated_at DESC LIMIT 25')],'operations':[dict(r) for r in con.execute('SELECT source,synced,result,error FROM operations ORDER BY rowid DESC LIMIT 25')]}
                else:
                    r=con.execute('SELECT payload FROM sources WHERE source=?',(args.get('source'),)).fetchone()
                    if not r:raise ValueError('unknown_source')
                    result=json.loads(r[0]);result.pop('files',None)
        else:raise ValueError('unknown_action')
        return json.dumps(result,ensure_ascii=False)
    except Exception as e:return json.dumps({'error':str(e) if isinstance(e,ValueError) else type(e).__name__,'instruction':'Not saved/confirmed. Inspect source/status; fix fields. Do not send to financier or another group.'})


def register(ctx):
    global STARTED
    if Path(os.environ.get('HERMES_HOME',''))!=PROFILE:return
    ctx.register_hook('pre_gateway_dispatch',capture)
    ctx.register_tool(name='tractor_crm',toolset='tractor_crm',handler=tool,schema={'name':'tractor_crm','description':'Own tractor group: original evidence to CRM journal. Complete single facts auto-record; unknowns stay for clarification. No project finance posting. Durable outbox and idempotent original.', 'parameters':{'type':'object','properties':{'action':{'type':'string','enum':['context','source','extract','status']},'source':{'type':'string'},'transcript':{'type':'string'},'needs_clarification':{'type':'boolean','description':'True for multiple facts, uncertain interpretation or missing evidence; prevents automatic recording.'},'record':{'type':'object','description':'kind work/fuel/maintenance/transport/expense/income/downtime, date ISO from message day or explicit fact; location project/external/company, project_id integer from context for our site, external exact customer/address for outside site, description, hours/litres/rate/amount decimal strings RUB (not kopecks). income only explicit received payment, not invoice. Missing facts may remain zero/null in draft. Never invent VAT, money, hours or object.'}},'required':['action']}})
    if STARTED:return
    STARTED=True
    (folder()/'runtime.json').write_text(json.dumps({'pid':os.getpid(),'registered_at':time.time(),'connected':bool(source.groups(config()))}))
    def worker():
        while True:
            try:flush()
            except Exception:pass
            WAKE.wait(30);WAKE.clear()
    threading.Thread(target=worker,name='tractor-crm-outbox',daemon=True).start()
