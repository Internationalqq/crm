import base64
import io
import json
from datetime import datetime, timezone
from unittest.mock import patch
from test_finance_intake import IntakeTests as FinanceFixture, Handler
import finance
import field_intake as field
import unittest


class FieldTests(unittest.TestCase):
    setUp=FinanceFixture.setUp
    tearDown=FinanceFixture.tearDown

    def call(self,path,data=None,token=True,user=True,access=True):
        (finance.DATA_DIR/'field-intake-integration.json').write_text(json.dumps(self.cfg))
        h=Handler(self.user if user is True else user,data,token,access,path)
        field.handle(h,'POST' if data is not None else 'GET',path)
        return h

    def source(self,text='Приехало 100 профилей',mid='1',media=None):
        ts=int(datetime(2026,10,6,20,30,tzinfo=timezone.utc).timestamp())
        r=self.call('/api/field-intake/import',dict(chat_id='-10',message_id=mid,sent_at=ts,text=text,media=media or []))
        self.assertEqual(r.status,200,r.response)
        return r.response['message_id']

    def draft(self,mid,kind='receipt',location='project',**detail):
        d={'fact_quote':'Приехало 100 профилей','lines':[{'title':'Профиль','unit':'шт','qty':'100'}], 'questions':[]}
        d.update(detail)
        r=self.call('/api/field-intake/events',dict(message_id=mid,event_key=kind,kind=kind,project_id=self.pid,location=location,title='Материалы / работы',data=d))
        self.assertEqual(r.status,200,r.response)
        return r.response['item']

    def apply(self,item,**kw):
        return self.call('/api/field-intake/'+str(item['id'])+'/apply',dict(revision=item['revision'],**kw))

    def test_report_date_is_explicit_or_original_send_day(self):
        ts=int(datetime(2026,10,6,20,30,tzinfo=timezone.utc).timestamp())
        with patch.object(field,'today_iso',return_value='2026-10-09'):
            self.assertEqual(field.report_day('Сварили 30 пластин. Материал придёт 5 ноября',ts),'2026-10-07')
            self.assertEqual(field.report_day('Отчёт за 5 октября. 30 пластин',ts),'2026-10-05')
            self.assertEqual(field.report_day('Очет за 5 октября. 30 пластин',ts),'2026-10-05')
            self.assertEqual(field.report_day('ОТЧЕТ ЗА 07.10.2026',ts),'2026-10-07')
            with self.assertRaises(ValueError):field.report_day('Отчёт за 7',ts)
            with self.assertRaises(ValueError):field.report_day('Отчёт за 7 ноября',ts)

    def test_unclear_date_is_retained_for_review_then_resolved_by_reply(self):
        mid=self.source('Отчёт за 5. Сделали 30 пластин.')
        a=self.draft(mid,'report',work_done='Сделали 30 пластин')
        self.assertIn('date_issue',a['data']);self.assertEqual(self.apply(a).status,409)
        reply=self.source('Отчёт за 5 октября',mid='reply')
        d=dict(a['data'],report_date_quote='Отчёт за 5 октября')
        r=self.call('/api/field-intake/events',dict(message_id=mid,event_key='report',kind='report',project_id=self.pid,location='project',title=a['title'],source_ids=[reply],revision=a['revision'],data=d))
        self.assertEqual(r.status,200,r.response);self.assertEqual(r.response['item']['event_date'],'2026-10-05')
        self.assertEqual(self.apply(r.response['item']).status,200)

    def test_receipt_repeated_request_and_reopen_no_double_stock_or_money(self):
        mid=self.source();self.assertEqual(self.source(),mid)
        a=self.draft(mid);self.assertEqual(self.apply(a).status,200)
        self.assertEqual(self.apply(a).status,200)
        with finance.db() as con:
            field.ensure_schema(con)
            self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],1)
            self.assertEqual(con.execute('SELECT count(*) FROM warehouse_items').fetchone()[0],0)
            self.assertEqual(con.execute('SELECT count(*) FROM finance_entries').fetchone()[0],0)
            self.assertEqual(field.balances(con,[self.pid])[0]['qty'],100)

    def test_company_exact_units_and_similar_names_stay_separate(self):
        for i,(title,unit) in enumerate([('Профиль','шт'),('Профиль','м'),('Профиль усиленный','шт')]):
            a=self.draft(self.source(mid=str(i)),location='company',lines=[dict(title=title,unit=unit,qty='2')])
            self.assertEqual(self.apply(a).status,200)
        with finance.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM warehouse_items').fetchone()[0],3)

    def test_plan_never_increases_stock_and_negative_or_future_not_receipt(self):
        for i,text in enumerate(['Ожидаем 100 профилей','Не приехало 100 профилей','100 профилей']):
            a=self.draft(self.source(text,mid=str(i)),fact_quote=text)
            self.assertEqual(self.apply(a).status,409)
        p=self.draft(self.source('Ожидаем 100 профилей 7 октября',mid='plan'),'expected',fact_quote='Ожидаем 100 профилей 7 октября',date_quote='7 октября')
        self.assertEqual(self.apply(p).status,200)
        with finance.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],0)

    def test_reposted_delivery_requires_human_review(self):
        a=self.draft(self.source());self.assertEqual(self.apply(a).status,200)
        b=self.draft(self.source(mid='2'));self.assertEqual(b['possible_duplicates'],[a['id']])
        self.assertEqual(self.apply(b,confirm_distinct=True).status,409) # integration cannot override
        r=self.call('/api/field-intake/'+str(b['id'])+'/apply',dict(revision=b['revision'],confirm_distinct=True),token=False)
        self.assertEqual(r.status,200)

    def test_report_photo_and_audio_transcript_survive_retry(self):
        from PIL import Image
        stream=io.BytesIO();Image.new('RGB',(10,10),'red').save(stream,'PNG')
        mid=self.source('',media=[dict(filename='photo.png',content_base64=base64.b64encode(stream.getvalue()).decode()),dict(filename='voice.ogg',content_base64=base64.b64encode(b'audio fixture').decode())])
        t={'transcript':'Отчёт за 7 октября. Сварили 30 пластин, работали 5 человек.'}
        self.assertEqual(self.call(f'/api/field-intake/messages/{mid}/transcript',t).status,200)
        self.assertEqual(self.call(f'/api/field-intake/messages/{mid}/transcript',t).status,200)
        a=self.draft(mid,'report',work_done='Сварили 30 пластин',workers_count=5)
        r=self.apply(a);self.assertEqual(r.status,200,r.response)
        self.assertEqual(self.apply(a).status,200)
        with finance.db() as con:
            row=con.execute('SELECT * FROM daily_logs').fetchone()
            self.assertEqual((row['report_date'],row['workers_count']),('2026-10-07',5))
            self.assertEqual(con.execute('SELECT count(*) FROM daily_log_photos').fetchone()[0],1)
            self.assertEqual(con.execute('SELECT count(*) FROM documents').fetchone()[0],1)
        changed=self.call(f'/api/field-intake/messages/{mid}/transcript',{'transcript':'changed'})
        self.assertEqual(changed.status,409)

    def test_source_and_project_authorization(self):
        a=self.draft(self.source())
        self.assertEqual(self.call('/api/field-intake/1',token=False,access=False).status,403)
        self.assertEqual(self.call('/api/field-intake',token=False,access=False).response['items'],[])
        self.assertEqual(self.call('/api/field-intake',token=False,user={'id':2,'role':'customer'}).status,403)
        self.cfg['group_id']='-other'
        self.assertEqual(self.call('/api/field-intake/1').status,403)
        self.assertEqual(self.call('/api/field-intake').response['items'],[])

    def test_invalid_second_line_rolls_back_whole_receipt(self):
        a=self.draft(self.source(),lines=[dict(title='Профиль',unit='шт',qty='100'),dict(title='Арматура',unit='шт',qty='-2')])
        self.assertEqual(self.apply(a).status,409)
        with finance.db() as con:
            self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],0)
            self.assertEqual(con.execute('SELECT count(*) FROM field_receipt_lines').fetchone()[0],0)
            self.assertEqual(con.execute('SELECT status FROM field_events').fetchone()[0],'needs_review')

    def test_two_concurrent_attempts_record_one_receipt(self):
        from concurrent.futures import ThreadPoolExecutor
        a=self.draft(self.source())
        def apply():
            with finance.db() as con:
                con.execute('BEGIN IMMEDIATE')
                row=con.execute('SELECT * FROM field_events WHERE id=?',(a['id'],)).fetchone()
                field.apply_event(con,row,self.uid);con.commit()
        with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda _:apply(),range(2)))
        with finance.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],1)

    def test_repost_quantity_format_does_not_evade_duplicate_check(self):
        a=self.draft(self.source());self.assertEqual(self.apply(a).status,200)
        b=self.draft(self.source(mid='2'),lines=[dict(title='ПРОФИЛЬ',unit='шт',qty='100.00')])
        self.assertEqual(self.apply(b).response['error'],'possible_duplicate_check_required')

    def test_partial_invoice_delivery_does_not_change_payment(self):
        with finance.db() as con:
            fid=con.execute("INSERT INTO finance_entries(project_id,direction,category,amount,status,created_by,created_at,updated_at) VALUES(?,'expense','Материалы',100,'planned',?,1,1)",(self.pid,self.uid)).lastrowid;con.commit()
        a=self.draft(self.source(),finance_entry_id=fid,delivery_status='partial')
        self.assertEqual(self.apply(a).status,200)
        with finance.db() as con:
            r=con.execute('SELECT * FROM finance_entries').fetchone();self.assertEqual(r['status'],'planned');self.assertIsNone(r['paid_date'])
        response=self.call('/api/field-intake/1',token=False,user={'id':self.uid,'role':'foreman','roles':[]}).response['item']
        self.assertNotIn('finance_entry_id',response);self.assertNotIn('finance_entry_id',response['data'])


if __name__=='__main__':unittest.main()
