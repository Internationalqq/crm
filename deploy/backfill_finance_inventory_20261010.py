# coding: utf-8
import hashlib
import base64
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import time

os.umask(0o077)
p=Path('/Users/egor/.hermes/profiles/anya')
group='-5589110678'
spec=importlib.util.spec_from_file_location('field_plugin',p/'plugins/field-crm-intake/__init__.py')
field=importlib.util.module_from_spec(spec);spec.loader.exec_module(field)
spec=importlib.util.spec_from_file_location('finance_plugin',p/'plugins/finance-crm-intake/__init__.py')
finance=importlib.util.module_from_spec(spec);spec.loader.exec_module(finance)


def history(ident):
    with sqlite3.connect('file:'+str(p/'state.db')+'?mode=ro',uri=True) as c:
        row=c.execute("SELECT content,timestamp FROM messages WHERE id=? AND role='user' AND session_id='20261007_130211_4adb74a6'",(ident,)).fetchone()
        assert row,'history_missing'
        return row


def persist_source(payload):
    key=group+':'+payload['message_id']
    encoded=json.dumps(payload,ensure_ascii=False)
    with field.db() as con:
        old=con.execute('SELECT payload FROM sources WHERE source=?',(key,)).fetchone()
        if old:assert json.loads(old['payload'])==payload,'historical_source_changed'
        else:con.execute('INSERT INTO sources VALUES(?,?,NULL,NULL,?)',(key,encoded,time.time()))
        con.commit()
    return key


def clarification(ident,sender,text):
    content,ts=history(ident)
    assert content=='['+sender+'] '+text,'clarification_mismatch'
    return persist_source({'chat_id':group,'message_id':'archive-anya-state-'+str(ident),
        'sent_at':int(ts),'sender_id':'','sender_name':sender,'text':text,'files':[],'reply_to':None})


def attachment_source(mid,history_id,text):
    content,ts=history(history_id)
    with sqlite3.connect('file:'+str(p/'workspace/group-finance/crm-outbox/queue.sqlite3')+'?mode=ro',uri=True) as c:
        c.row_factory=sqlite3.Row
        rows=c.execute('SELECT * FROM queue WHERE source LIKE ? ORDER BY source',(group+':'+str(mid)+':%',)).fetchall()
    assert rows,'original_missing'
    files=[]
    for row in rows:
        meta=json.loads(row['payload']);raw=Path(row['path']).read_bytes()
        assert meta['chat_id']==group and meta['message_id']==str(mid),'attachment_origin_mismatch'
        assert row['source'] in content,'history_attachment_mismatch'
        sha=hashlib.sha256(raw).hexdigest();assert sha==meta['attachment_id'],'original_hash_changed'
        name=sha+Path(meta['filename']).suffix.lower();target=field.folder()/name
        if target.exists():assert target.read_bytes()==raw,'source_file_changed'
        else:target.write_bytes(raw)
        files.append({'name':meta['filename'],'local_name':name,'sha256':sha})
    assert content.startswith('['+meta['sender_name']+'] '+text+'\n[CRM intake:'),'history_text_mismatch'
    return persist_source({'chat_id':group,'message_id':str(mid),'sent_at':int(ts),
        'sender_id':meta['sender_id'],'sender_name':meta['sender_name'],'text':text,'files':files,'reply_to':None}),{r['crm_id']:json.loads(r['payload'])['attachment_id'] for r in rows}


def sync_sources(keys):
    for key in keys:
        with field.db() as con:row=con.execute('SELECT * FROM sources WHERE source=?',(key,)).fetchone()
        if row['crm_id']:continue
        data=json.loads(row['payload']);media=[]
        for f in data.pop('files',[]):
            raw=(field.folder()/f['local_name']).read_bytes()
            assert hashlib.sha256(raw).hexdigest()==f['sha256'],'source_hash_mismatch'
            media.append({'filename':f['name'],'content_base64':base64.b64encode(raw).decode()})
        data['media']=media
        result=field.api('/import',data)
        with field.db() as con:
            con.execute('UPDATE sources SET crm_id=?,error=NULL WHERE source=?',(result['message_id'],key));con.commit()


def sync_owned_drafts(keys):
    # Never flush the global queue: only the explicitly owned sources/operations.
    for key in keys:
        with field.db() as con:
            rows=con.execute('SELECT * FROM operations WHERE source=?',(key,)).fetchall()
        assert len(rows)==1,'unexpected_owned_operations'
        row=rows[0];data=json.loads(row['payload'])
        assert data.get('apply') is False and data['event']['event_key'] in ['purchase-invoice-1','purchase-invoice-4'],'unexpected_operation'
        with field.db() as con:
            mid=con.execute('SELECT crm_id FROM sources WHERE source=?',(key,)).fetchone()[0]
            refs=[con.execute('SELECT crm_id FROM sources WHERE source=?',(ref,)).fetchone()[0] for ref in data['source_refs']]
        event=dict(data['event'],message_id=mid,source_ids=refs)
        result=field.api('/events',event)
        with field.db() as con:
            changed=con.execute('UPDATE operations SET synced=1,result=?,error=NULL WHERE source=? AND op_key=? AND generation=?',
                (json.dumps(result,ensure_ascii=False),key,row['op_key'],row['generation'])).rowcount
            assert changed==1,'operation_changed_during_backfill';con.commit()


before=field.api('')['items']
project=next(x for x in field.api('/projects')['projects'] if x['id']==10)
assert 'Гусиха' in project['title'],'project_mapping_changed'
ref_9145=clarification(10405,'Егор','Карабаш')
ref_perforator=clarification(10582,'Елена Подучин','В Фин план на понедельник 12.10.2026г Карабаш')
source_9145,hashes_9145=attachment_source(1662,10373,'добавить в фин план на 12.10.26\nоставлено в залог деньги')
source_perforator,hashes_perforator=attachment_source(1740,10570,'')
definitions=[(1,source_9145,ref_9145,'9145',{'Сварочный аппарат САИ 250','Маска сварщика Хамелеон MWH-9035K'}),
             (4,source_perforator,ref_perforator,'ЦБ-560',{'Перфоратор ИНТЕРСКОЛ П-55/1700ЭВ SDS max 830.1.0.70'})]
for ident,source,ref,number,tool_names in definitions:
    invoice=finance.api('/'+str(ident))['item']
    assert invoice['sha256']==(hashes_9145 if ident==1 else hashes_perforator)[ident],'invoice_original_mismatch'
    assert invoice['project_id']==10 and invoice['status']=='needs_review' and not invoice['finance_entry_id'],'invoice_state_changed'
    lines=[{'title':line['title'],'qty':line['quantity'],'unit':line['unit'],
            'item_type':'tool' if line['title'] in tool_names else 'material'} for line in invoice['details']['lines']]
    assert len(lines)==(5 if ident==1 else 1) and all(x['qty']=='1' for x in lines),'invoice_lines_changed'
    event={'event_key':'purchase-invoice-'+str(ident),'kind':'purchase','project_id':10,'location':'unknown',
           'title':'Карабаш — счёт №'+number+': покупка и место требуют подтверждения',
           'data':{'lines':lines,'fact_quote':'','questions':[
               'Счёт №'+number+' внесён в финплан на 12.10.2026. Подтвердите, куплены ли эти позиции; счёт и залог сами по себе не подтверждают покупку.',
               'Если получены: где находятся позиции — склад компании или объект? Укажите фактическую дату получения и количество.',
               'Если только куплены: укажите дату покупки и место будущей доставки. Дата оплаты в финплане не является датой доставки.']}}
    field.enqueue({'source':source,'event':event,'source_refs':[ref],'apply':False})

sync_sources([source_9145,source_perforator,ref_9145,ref_perforator])
sync_owned_drafts([source_9145,source_perforator])
with field.db() as con:
    operations=[dict(r) for r in con.execute("SELECT source,op_key,synced,result,error FROM operations WHERE source IN (?,?)",(source_9145,source_perforator))]
assert len(operations)==2 and all(x['synced']==1 for x in operations),'sync_incomplete'
ids=[json.loads(x['result'])['item']['id'] for x in operations]
after=field.api('')['items']
drafts=[x for x in after if x['id'] in ids]
assert len(drafts)==2 and all(x['status']=='needs_review' and x['location']=='unknown' for x in drafts)
assert len([x for x in after if x['status']=='applied'])==len([x for x in before if x['status']=='applied'])
assert [x for x in after if x['status']=='applied']==[x for x in before if x['status']=='applied'],'applied_events_changed_by_draft'
proof={'project_id':10,'event_ids':ids,'items':[{k:x[k] for k in ['id','title','kind','status','location','data']} for x in drafts],
       'synced':True,'no_stock_posted':True,'history_last_message':'2026-10-09','originals_sha256_verified':True}
(p/'workspace/group-finance/inventory-backfill-20261010.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
print(json.dumps({'project_id':10,'event_ids':ids,'positions':sum(len(x['data']['lines']) for x in drafts),
                  'tools':sum(l['item_type']=='tool' for x in drafts for l in x['data']['lines']),
                  'materials':sum(l['item_type']=='material' for x in drafts for l in x['data']['lines']),
                  'synced':True,'status':'needs_review','stock_unchanged':True}))
