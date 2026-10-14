import json
import base64
from unittest.mock import patch
from test_finance_intake import IntakeTests as Fixture, Handler
import finance, tractor, unittest

class TractorTests(unittest.TestCase):
    setUp=Fixture.setUp
    tearDown=Fixture.tearDown
    def call(self,path,data=None,token=False,user=True):
        (finance.DATA_DIR/'tractor-integration.json').write_text(json.dumps({**self.cfg,'enabled':True,'auto_post':getattr(self,'auto_post',True)}))
        if data is not None and '/entries/' in path:
            self.op_counter=getattr(self,'op_counter',0)+1
            data.setdefault('operation_key','test-operation:'+str(self.op_counter))
        h=Handler(self.user if user is True else user,data,token,True,path)
        tractor.handle(h,'POST' if data is not None else 'GET',path)
        return h
    def draft(self,key='operation-1',**kw):
        data={'kind':'work','date':'2026-10-12','location':'external','external':'Частный участок','hours':'4.25','rate':'1000.50'};data.update(kw)
        r=self.call('/api/tractor/entries',{'data':data,'request_key':key})
        self.assertEqual(r.status,200,r.response)
        return r.response['item']
    def confirm(self,item,**kw):
        return self.call('/api/tractor/entries/'+str(item['id']),{'data':tractor.raw_data(item['data']),'revision':item['revision'],'action':'confirm',**kw})
    def test_money_confirmation_cancel_revision_and_linked_payment(self):
        a=self.draft();self.assertEqual(a['data']['amount_cents'],425213)
        b=self.draft();self.assertEqual(a['id'],b['id'])
        c=self.confirm(a);self.assertEqual(c.status,200,c.response);c=c.response['item']
        self.assertEqual(self.confirm(a).status,409)
        self.assertEqual(self.confirm(c).status,409)
        pay=self.draft('payment-1',kind='income',hours='0',rate='0',amount='1200',work_id=c['id'])
        self.assertEqual(self.confirm(pay).status,200)
        self.assertEqual(self.call('/api/tractor/entries/'+str(c['id']),{'action':'cancel','revision':c['revision'],'reason':'Ошибка'}).status,409)
        current=self.call('/api/tractor').response['items'][0]
        self.assertEqual(self.call('/api/tractor/entries/'+str(current['id']),{'action':'cancel','revision':current['revision'],'reason':'Ошибка оплаты'}).status,200)
        self.assertEqual(self.call('/api/tractor/entries/'+str(c['id']),{'action':'cancel','revision':c['revision'],'reason':'Ошибка часов'}).status,200)
    def test_validation_access_date_key_and_no_project_finance(self):
        self.assertEqual(self.call('/api/tractor',user={'id':1,'role':'foreman','roles':[]}).status,403)
        self.assertTrue(tractor.can_use({'role':'main_admin'}))
        with patch.object(tractor,'today_iso',return_value='2026-10-13'):
            with finance.db() as con:self.assertEqual(tractor.normalize(con,{},True)['date'],'2026-10-13')
        for value in ['NaN','-1','0.123','Infinity']:
            with self.assertRaises(ValueError):tractor.money(value)
        a=self.draft();self.assertEqual(self.call('/api/tractor/entries',{'request_key':'operation-1','data':{**tractor.raw_data(a['data']),'hours':'5'}}).status,409)
        with finance.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM finance_entries').fetchone()[0],0)
    def test_telegram_original_group_draft_repeat_and_duplicate_check(self):
        self.auto_post=False
        message={'chat_id':'-10','message_id':'t1','sent_at':finance.now_ts(),'text':'Заправили трактор 30л, 2000р','media':[{'filename':'receipt.pdf','content_base64':base64.b64encode(b'%PDF-test-tractor').decode()}]}
        body={'message':message,'record':{'kind':'fuel','litres':'30','amount':'2000'}}
        a=self.call('/api/tractor/import',body,True,False);self.assertEqual(a.status,200,a.response)
        b=self.call('/api/tractor/import',body,True,False);self.assertEqual(a.response['id'],b.response['id'])
        self.assertEqual(self.call('/api/tractor/import',{**body,'message':{**message,'chat_id':'-99'}},True,False).status,403)
        changed={**body,'message':{**message,'text':'Поменяли'}};self.assertEqual(self.call('/api/tractor/import',changed,True,False).status,409)
        items=self.call('/api/tractor').response['items'];self.assertEqual(items[0]['status'],'draft');self.assertEqual(self.confirm(items[0]).status,200)
        body['message']['message_id']='t2';self.assertEqual(self.call('/api/tractor/import',body,True,False).status,200)
        item=self.call('/api/tractor').response['items'][0];self.assertEqual(self.confirm(item).status,409)
        self.assertEqual(self.confirm(item,confirm_duplicate=True).status,200)
    def test_incomplete_draft_cannot_be_confirmed_and_context_is_scoped(self):
        a=self.draft(location='project',project_id=None,hours='0')
        self.assertEqual(self.confirm(a).status,409)
        self.assertEqual(self.call('/api/tractor/context',token=True,user=False).status,200)
        self.assertNotIn('items',self.call('/api/tractor/context',token=True,user=False).response)
        self.assertEqual(self.call('/api/tractor',token=True,user=False).status,401)

    def test_lost_response_exact_retry_does_not_repeat_audit(self):
        a=self.draft()
        body={'data':tractor.raw_data(a['data']),'revision':a['revision'],'action':'confirm','operation_key':'lost-response-1'}
        self.assertEqual(self.call('/api/tractor/entries/'+str(a['id']),body).status,200)
        self.assertEqual(self.call('/api/tractor/entries/'+str(a['id']),body).status,200)
        with finance.db() as con:self.assertEqual(con.execute("SELECT count(*) FROM tractor_audit WHERE action='confirm'").fetchone()[0],1)

    def test_disabled_bot_and_changed_extraction_fail_closed(self):
        (finance.DATA_DIR/'tractor-integration.json').write_text(json.dumps({**self.cfg,'enabled':False}))
        h=Handler(None,None,True,True,'/api/tractor/context');tractor.handle(h,'GET','/api/tractor/context');self.assertEqual(h.status,401)
        msg={'chat_id':'-10','message_id':'changed-record','sent_at':finance.now_ts(),'text':'4 часа трактор'}
        body={'message':msg,'record':{'kind':'work','hours':'4'}}
        self.assertEqual(self.call('/api/tractor/import',body,True,False).status,200)
        body['record']['hours']='5'
        self.assertEqual(self.call('/api/tractor/import',body,True,False).status,409)

    def test_complete_telegram_fact_auto_records_repeat_and_duplicate(self):
        msg={'chat_id':'-10','message_id':'auto-fuel','sent_at':finance.now_ts(),'text':'Дегтярка: заправили 30 литров','media':[{'filename':'receipt.pdf','content_base64':base64.b64encode(b'%PDF-unique-autofuel').decode()}]}
        body={'message':msg,'record':{'kind':'fuel','location':'external','external':'Дегтярка','litres':'30','description':'Заправили 30 литров'}}
        first=self.call('/api/tractor/import',body,True,False)
        self.assertEqual(first.status,200,first.response);self.assertEqual(first.response['status'],'confirmed')
        repeat=self.call('/api/tractor/import',body,True,False);self.assertEqual(repeat.response,first.response)
        with finance.db() as con:self.assertEqual(con.execute("SELECT count(*) FROM tractor_audit WHERE action='record'").fetchone()[0],1)
        body['message']['message_id']='auto-fuel-copy'
        duplicate=self.call('/api/tractor/import',body,True,False)
        self.assertEqual(duplicate.response['status'],'cancelled');self.assertEqual(duplicate.response['duplicate_of'],first.response['id'])
        self.assertEqual(self.call('/api/tractor/import',body,True,False).response,duplicate.response)
        items=self.call('/api/tractor').response['items'];self.assertIsNone(items[0]['needs_clarification'])
        with finance.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM finance_entries').fetchone()[0],0)

    def test_followup_questions_and_missing_fields_do_not_block_recording(self):
        def body(mid,record,**extras):return {'message':{'chat_id':'-10','message_id':mid,'sent_at':finance.now_ts(),'text':'Исходные факты'},'record':record,**extras}
        record={'kind':'work','location':'external','external':'Частный участок','hours':'5','description':'Работал 5 часов'}
        ambiguous=self.call('/api/tractor/import',body('ambiguous-fact',record,needs_clarification=True),True,False)
        self.assertEqual(ambiguous.response['status'],'confirmed')
        incomplete=self.call('/api/tractor/import',body('missing-site',{**record,'external':''}),True,False)
        self.assertEqual(incomplete.response['status'],'confirmed');self.assertIsNone(incomplete.response['needs_clarification'])
        complete=self.call('/api/tractor/import',body('hours-only-rate-unknown',record),True,False)
        self.assertEqual(complete.response['status'],'confirmed')
        current=next(i for i in self.call('/api/tractor').response['items'] if i['id']==complete.response['id'])
        self.assertEqual(current['data']['amount_cents'],0);self.assertEqual(current['data']['hours'],'5')

    def test_downtime_is_recorded_without_work_or_money(self):
        a=self.draft('downtime-operation',kind='downtime',hours='0',rate='0',description='Ждал фильтр')
        result=self.confirm(a);self.assertEqual(result.status,200,result.response)
        self.assertEqual(result.response['item']['data']['hours'],'0')
        with finance.db() as con:
            for fields in [{'hours':'1'},{'amount':'100'},{'rate':'10'},{'litres':'1'}]:
                with self.assertRaises(ValueError):tractor.normalize(con,{'kind':'downtime','description':'Причина',**fields},False)

    def test_time_interval_records_without_break_question_and_replays(self):
        msg={'chat_id':'-10','message_id':'shift','sent_at':finance.now_ts(),'text':'13.10 Сергей 11:00-17:00'}
        body={'message':msg,'record':{'kind':'work','hours':'0','description':'Сергей 11:00-17:00'},'needs_clarification':True}
        a=self.call('/api/tractor/import',body,True,False);self.assertEqual(a.response['status'],'confirmed')
        self.assertEqual(self.call('/api/tractor/import',body,True,False).response,a.response)
        current=next(i for i in self.call('/api/tractor').response['items'] if i['id']==a.response['id'])
        self.assertEqual(float(current['data']['hours']),6);self.assertEqual(current['data']['amount_cents'],0)
        self.assertEqual(tractor.interval_hours('9:00–19:00'),'10.00');self.assertEqual(tractor.interval_hours('23:00-01:00'),'2.00')
        self.assertIsNone(tractor.interval_hours('11:00-17:00 и 9:00-19:00'))
        self.assertIsNone(tractor.interval_hours('11:00-17:00, перерыв 1 час'))
        body['message']['message_id']='explicit-break';body['message']['text']='Сергей 11:00-17:00, перерыв 1 час'
        saved=self.call('/api/tractor/import',body,True,False);self.assertEqual(saved.response['status'],'confirmed')
        current=next(i for i in self.call('/api/tractor').response['items'] if i['id']==saved.response['id'])
        self.assertEqual(float(current['data']['hours']),0)
        self.assertIn('перерыв 1 час',current['source']['text'])
        body['message'].update(message_id='voice-explicit-break',text='',transcript='Сергей 11:00-17:00, перерыв 1 час')
        voice=self.call('/api/tractor/import',body,True,False);self.assertEqual(voice.response['status'],'confirmed')
        current=next(i for i in self.call('/api/tractor').response['items'] if i['id']==voice.response['id'])
        self.assertEqual(float(current['data']['hours']),0)
        self.assertIn('перерыв 1 час',current['source']['transcript'])

if __name__=='__main__':unittest.main()
