from __future__ import annotations
import base64
import gc
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import finance
import finance_intake as intake
import server
import communications_docs


class Handler:
    def __init__(self, user, data=None, token=False, access=True, path='/api/finance-intake'):
        self.user=user; self.data=data; self.headers={'Authorization':'Bearer '+'t'*40} if token else {}
        self.access=access; self.path=path; self.response=None; self.status=None
    def require_user(self):
        if not self.user: self.send_json(401, {'error':'unauthorized'})
        return self.user
    def can_access_project(self,user,ident):return self.access
    def require_project_access(self,ident):return self.user if self.access else None
    def read_json(self,**kwargs):return self.data
    def send_json(self,status,payload):self.status=status;self.response=payload
    def send_file(self,path,*args,**kwargs):self.status=200;self.response=path.read_bytes()


class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); p=Path(self.temp.name)
        self.patches=[patch.object(server,'DB_PATH',p/'data/test.sqlite3'),patch.object(server,'BOOTSTRAP_PATH',p/'admin.txt'),
                      patch.object(server,'DATA_DIR',p/'data'),patch.object(finance,'DB_PATH',p/'data/test.sqlite3'),
                      patch.object(finance,'DATA_DIR',p/'data'),patch.object(finance,'PROJECT_ROOT',p),
                      patch.object(finance,'DOCUMENTS_DIR',p/'data/documents')]
        self.patches.append(patch.object(communications_docs, 'DB_PATH', p/'data/test.sqlite3'))
        for m in self.patches:m.start()
        (p/'data').mkdir();server.init_db()
        with finance.db() as con:
            self.uid=con.execute("SELECT id FROM users WHERE login='admin'").fetchone()[0]
            self.pid=con.execute("INSERT INTO projects(title,address,client_name,status,created_at,updated_at) VALUES('Test','Test address','Test client','active',1,1)").lastrowid
            con.commit()
        self.user={'id':self.uid,'role':'admin','roles':[]}
        self.cfg={'token':'t'*40,'group_id':'-10','actor_id':self.uid,'project_ids':[self.pid]}
        (finance.DATA_DIR/'finance-intake-integration.json').write_text(json.dumps(self.cfg))
    def tearDown(self):
        for m in reversed(self.patches):m.stop()
        gc.collect();self.temp.cleanup()
    def call(self,path,data=None,token=False,user=True,access=True):
        h=Handler(self.user if user is True else user,data,token,access,path)
        intake.handle(h,'POST' if data is not None else 'GET',path.split('?')[0]);return h
    def upload(self,raw=b'%PDF-1.4 test',message='1'):
        return self.call('/api/finance-intake/import',{'chat_id':'-10','message_id':message,'attachment_id':'1',
                         'filename':'receipt.pdf','sender_name':'Test','sender_id':'2','content_base64':base64.b64encode(raw).decode()},token=True).response['item']
    def draft(self,item,kind='receipt'):
        return {'revision':item['revision'],'project_id':self.pid,'kind':kind,'amount_kopecks':12345,
                'document_date':'2026-10-07','counterparty':'Shop','title':'Materials',
                'details':{'lines':[{'title':'Material','quantity':'1.25','amount_kopecks':12345}], 'questions':[],
                           'payment_kind':'bank_vat','vat_percent':20}}
    def test_repeat_after_reopen_and_lost_response_deduplicates_original_and_source(self):
        a=self.upload();b=self.upload();c=self.upload(message='2')
        self.assertEqual(a['id'],b['id']);self.assertEqual(a['id'],c['id'])
        with finance.db() as con:
            intake.ensure_schema(con)
            self.assertEqual(con.execute('SELECT count(*) FROM finance_intake').fetchone()[0],1)
            self.assertEqual(con.execute('SELECT count(*) FROM finance_intake_sources').fetchone()[0],2)
            self.assertEqual(con.execute('SELECT count(*) FROM finance_entries').fetchone()[0],0)
    def test_source_mutation_does_not_replace_original(self):
        self.upload()
        with finance.db() as con:
            with self.assertRaisesRegex(ValueError,'source_changed'):
                intake.ingest(con,b'other',{'chat_id':'-10','message_id':'1','attachment_id':'1','filename':'receipt.pdf'},self.cfg)
        self.assertEqual(self.call('/api/finance-intake/1/file').response,b'%PDF-1.4 test')
    def test_draft_revision_totals_and_fiscal_duplicate(self):
        a=self.upload();d=self.draft(a);d['fiscal_key']='1234567890123456:12:456'
        self.assertEqual(self.call('/api/finance-intake/1/draft',d,token=True).status,200)
        self.assertEqual(self.call('/api/finance-intake/1/draft',d,token=True).status,409)
        b=self.upload(raw=b'another',message='2');d=self.draft(b);d['details']['lines'][0]['amount_kopecks']=100
        self.assertEqual(self.call('/api/finance-intake/2/draft',d,token=True).status,409)
        d=self.draft(b);d['fiscal_key']='1234567890123456:12:456'
        self.assertIn('fiscal_duplicate',self.call('/api/finance-intake/2/draft',d,token=True).response['error'])
    def test_receipt_verified_once_without_creating_money_or_stock(self):
        a=self.upload();saved=self.call('/api/finance-intake/1/draft',self.draft(a),token=True).response['item']
        first=self.call('/api/finance-intake/1/confirm',{'revision':saved['revision']})
        self.assertEqual(first.status,200)
        second=self.call('/api/finance-intake/1/confirm',{'revision':saved['revision']})
        self.assertEqual(first.response['item']['document_id'],second.response['item']['document_id'])
        with finance.db() as con:
            self.assertEqual(con.execute('SELECT count(*) FROM documents').fetchone()[0],1)
            self.assertEqual(con.execute('SELECT count(*) FROM finance_entries').fetchone()[0],0)
            self.assertEqual(con.execute('SELECT count(*) FROM stock_moves').fetchone()[0],0)
    def test_invoice_creates_only_one_planned_entry_linked_receipt_no_double_count(self):
        a=self.upload();saved=self.call('/api/finance-intake/1/draft',self.draft(a,'invoice'),token=True).response['item']
        r=self.call('/api/finance-intake/1/confirm',{'revision':saved['revision']});self.assertEqual(r.status,200,r.response)
        fid=r.response['item']['finance_entry_id']
        b=self.upload(raw=b'receipt',message='2');saved=self.call('/api/finance-intake/2/draft',self.draft(b),token=True).response['item']
        r=self.call('/api/finance-intake/2/confirm',{'revision':saved['revision'],'finance_entry_id':fid});self.assertEqual(r.status,200,r.response)
        with finance.db() as con:
            rows=con.execute('SELECT * FROM finance_entries').fetchall();self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]['status'],'planned');self.assertEqual(rows[0]['amount'],123.45)
            self.assertIsNone(rows[0]['paid_date']);self.assertEqual(rows[0]['vat_percent'],20)
    def test_authorization_and_unknown_project_not_leaked(self):
        a=self.upload();self.call('/api/finance-intake/1/draft',self.draft(a),token=True)
        self.assertEqual(self.call('/api/finance-intake/1/confirm',{'revision':2},token=True).status,403)
        self.assertEqual(self.call('/api/finance-intake',token=True).status,403)
        self.assertEqual(self.call('/api/finance-intake/1/file',token=True).status,403)
        self.assertEqual(self.call('/api/finance-intake/1',access=False).status,403)
        self.assertEqual(self.call('/api/finance-intake',access=False).response['items'],[])
        self.assertEqual(self.call('/api/finance-intake',user=None).status,401)
        self.assertEqual(self.call('/api/finance-intake',user={'id':2,'role':'customer','roles':[]}).status,403)
        d=self.draft(a);d['project_id']=999
        self.assertEqual(self.call('/api/finance-intake/1/draft',d,token=True).status,403)

    def test_verified_original_cannot_be_exposed_or_deleted_via_documents_api(self):
        a=self.upload();self.call('/api/finance-intake/1/draft',self.draft(a),token=True)
        doc=self.call('/api/finance-intake/1/confirm',{'revision':2}).response['item']['document_id']
        h=Handler({'id':2,'role':'customer','roles':[]})
        communications_docs.api_document_file(h,f'/api/documents/{doc}/view',True)
        self.assertEqual(h.status,403)
        h=Handler(self.user,{'is_client_visible':True})
        communications_docs.api_update_document(h,f'/api/documents/{doc}')
        self.assertEqual(h.status,409)
        h=Handler(self.user)
        communications_docs.api_delete_document(h,f'/api/documents/{doc}')
        self.assertEqual(h.status,409)

    def test_refund_requires_original_and_cannot_exceed_receipt(self):
        a=self.upload();self.call('/api/finance-intake/1/draft',self.draft(a),token=True)
        self.call('/api/finance-intake/1/confirm',{'revision':2})
        b=self.upload(raw=b'refund',message='2');d=self.draft(b,'refund')
        self.call('/api/finance-intake/2/draft',d,token=True)
        self.assertEqual(self.call('/api/finance-intake/2/confirm',{'revision':2}).status,409)
        d['revision']=2;d['details']['original_receipt_id']=1
        self.call('/api/finance-intake/2/draft',d,token=True)
        self.assertEqual(self.call('/api/finance-intake/2/confirm',{'revision':3}).status,200)
        b=self.upload(raw=b'refund2',message='3');d=self.draft(b,'refund');d['details']['original_receipt_id']=1
        self.call('/api/finance-intake/3/draft',d,token=True)
        self.assertEqual(self.call('/api/finance-intake/3/confirm',{'revision':2}).response['error'],'refund_exceeds_original')

    def test_new_photo_of_same_purchase_requires_explicit_duplicate_review(self):
        a=self.upload();self.call('/api/finance-intake/1/draft',self.draft(a),token=True)
        self.call('/api/finance-intake/1/confirm',{'revision':2})
        b=self.upload(raw=b'new photo',message='2');r=self.call('/api/finance-intake/2/draft',self.draft(b),token=True)
        self.assertEqual(r.response['item']['possible_duplicates'],[1])
        self.assertEqual(self.call('/api/finance-intake/2/confirm',{'revision':2}).response['error'],'possible_duplicate_check_required')
        self.assertEqual(self.call('/api/finance-intake/2/confirm',{'revision':2,'confirm_distinct':True}).status,200)

if __name__=='__main__':unittest.main()
