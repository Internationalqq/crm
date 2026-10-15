import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace as NS
from datetime import datetime,timezone
from unittest.mock import patch
import tempfile
import shutil
import unittest

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('field_plugin',root/'deploy/hermes-field-intake/__init__.py')
plugin=importlib.util.module_from_spec(spec);spec.loader.exec_module(plugin)


class PluginTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.cache=self.root/'cache';self.cache.mkdir()
        self.patches=[patch.object(plugin,'PROFILE',self.root),patch.dict(os.environ,{'HERMES_HOME':str(self.root)}),
            patch.dict(sys.modules,{'gateway.platforms.base':NS(get_image_cache_dir=lambda:self.cache,get_document_cache_dir=lambda:self.cache,get_audio_cache_dir=lambda:self.cache)})]
        for m in self.patches:m.start()
        (self.root/'field-crm.json').write_text(json.dumps({'group_id':'-20'}))
    def tearDown(self):
        for m in reversed(self.patches):m.stop()
        self.tmp.cleanup()
    def event(self):
        p=self.cache/'voice.ogg';p.write_bytes(b'original audio')
        return NS(source=NS(platform=NS(value='telegram'),chat_id='-20'),internal=False,
            raw_message=NS(voice=NS(),from_user=NS(id=12,is_bot=False,full_name='Member'),date=datetime(2026,10,6,20,30,tzinfo=timezone.utc)),
            media_urls=[str(p)],text='[voice]',message_id='17')
    def test_installed_profile_owns_queue_and_rejects_other_gateway(self):
        owner=self.root/'profiles'/'pto'
        installed=owner/'plugins'/'field-crm-intake'/'__init__.py'
        installed.parent.mkdir(parents=True)
        shutil.copyfile(root/'deploy/hermes-field-intake/__init__.py',installed)
        (owner/'field-crm.json').write_text(json.dumps({'group_id':'-20'}))
        spec=importlib.util.spec_from_file_location('installed_pto_field_plugin',installed)
        loaded=importlib.util.module_from_spec(spec);spec.loader.exec_module(loaded)
        with patch.dict(os.environ,{'HERMES_HOME':str(owner)}):
            self.assertIn('-20:17',loaded.capture(self.event())['text'])
            with loaded.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM sources').fetchone()[0],1)
        self.assertTrue((owner/'workspace/daily-reports/crm-outbox/queue.sqlite3').exists())
        with patch.dict(os.environ,{'HERMES_HOME':str(self.root/'profiles'/'anya')}):
            self.assertIsNone(loaded.capture(self.event()))
            ctx=NS(register_hook=lambda *a,**k:self.fail('registered in another gateway'))
            loaded.register(ctx)
    def test_scoped_original_voice_durable_and_pending_group_is_disabled(self):
        e=self.event();r=plugin.capture(e);self.assertIn('-20:17',r['text'])
        plugin.capture(e)
        with plugin.db() as con:
            rows=con.execute('SELECT * FROM sources').fetchall();self.assertEqual(len(rows),1)
            data=json.loads(rows[0]['payload']);self.assertEqual(data['sent_at'],int(e.raw_message.date.timestamp()))
            self.assertEqual((plugin.folder()/data['files'][0]['local_name']).read_bytes(),b'original audio')
        e.source.chat_id='-10';self.assertIsNone(plugin.capture(e))
        (self.root/'field-crm.json').write_text('{}');self.assertIsNone(plugin.capture(self.event()))
        with patch.object(plugin,'api') as api:plugin.flush();api.assert_not_called()

    def test_finance_group_enabled_without_changing_primary_report_group(self):
        (self.root/'field-crm.json').write_text(json.dumps({'group_id':'-20','group_ids':['-finance']}))
        finance_event=self.event();finance_event.source.chat_id='-finance'
        self.assertIn('-finance:17',plugin.capture(finance_event)['text'])
        self.assertIn('-20:17',plugin.capture(self.event())['text'])
        foreign=self.event();foreign.source.chat_id='-foreign'
        self.assertIsNone(plugin.capture(foreign))
        with plugin.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM sources').fetchone()[0],2)
    def test_extraction_survives_reopen_and_lost_apply_ack(self):
        plugin.capture(self.event())
        plugin.enqueue({'source':'-20:17','transcript':'Отчёт за 7 октября. 30 пластин.', 'apply':True,
                        'event':{'event_key':'report-1','kind':'report','data':{'work_done':'30 пластин'}}})
        calls=[];first=True
        def api(path,data=None):
            nonlocal first
            calls.append(path)
            if path=='/import':return {'message_id':5}
            if path=='/messages/5/transcript':return {'message_id':5}
            if path=='/events':return {'item':{'id':9,'revision':1}}
            if first:first=False;raise TimeoutError()
            return {'item':{'id':9,'status':'applied'}}
        with patch.object(plugin,'api',side_effect=api):plugin.flush();plugin.flush()
        self.assertEqual(calls.count('/import'),1)
        with plugin.db() as con:
            row=con.execute('SELECT * FROM operations').fetchone();self.assertEqual(row['synced'],1)
            self.assertEqual(json.loads(row['result'])['item']['status'],'applied')
    def test_http4_is_not_blindly_retried_and_secrets_not_exposed(self):
        plugin.capture(self.event())
        exc=RuntimeError('secret');exc.code=403
        with patch.object(plugin,'api',side_effect=exc) as api:
            plugin.flush();plugin.flush();self.assertEqual(api.call_count,1)
            self.assertNotIn('secret',plugin.tool({'action':'projects'}))
    def test_reply_photo_attachment_does_not_create_another_report(self):
        plugin.capture(self.event());plugin.enqueue({'source':'-20:17','attach_to':6,'revision':2})
        calls=[]
        def api(path,data=None):
            calls.append((path,data));return {'message_id':7} if path=='/import' else {'item':{'id':6}}
        with patch.object(plugin,'api',side_effect=api):plugin.flush()
        self.assertEqual(calls[-1],('/6/attach',{'source_ids':[7],'revision':2}));self.assertNotIn('/events',[c[0] for c in calls])

    def test_ingress_and_gateway_hooks_capture_original_only_once(self):
        event=self.event()
        first=plugin.capture(event)
        self.assertIsNone(plugin.capture(event))
        self.assertIn('Field CRM source: -20:17',first['text'])
        second=self.event();second.message_id='18';second.raw_message.voice=None
        second.raw_message.text='Да, всё верно';second.media_urls=[];second.text='Да, всё верно'
        plugin.capture(second)
        with plugin.db() as con:
            self.assertEqual(con.execute('SELECT count(*) FROM sources').fetchone()[0],2)
            self.assertEqual(json.loads(con.execute('SELECT payload FROM sources WHERE source=?',('-20:18',)).fetchone()[0])['text'],'Да, всё верно')

    def test_coverage_keeps_unextracted_and_failed_sources_visible_after_reopen(self):
        plugin.capture(self.event())
        with plugin.db() as con:
            self.assertEqual(plugin.coverage(con)['unclassified_total'],1)
        plugin.enqueue({'source':'-20:17','event':{'event_key':'receipt-1'},'apply':False})
        with plugin.db() as con:
            item=plugin.coverage(con)['items'][0]
            self.assertFalse(item['unclassified']);self.assertEqual(item['operations'][0]['state'],'queued')
            con.execute("UPDATE operations SET error='HTTP409:bad_quantity'")
        with plugin.db() as con:
            self.assertEqual(plugin.coverage(con)['items'][0]['operations'][0]['state'],'error')

    def test_classification_never_posts_stock_and_duplicate_needs_applied_target(self):
        plugin.capture(self.event())
        with patch.object(plugin,'api') as api:
            plugin.classify({'source':'-20:17','outcome':'no_event','reason':'Вопрос о статусе, нового факта нет.'})
            api.assert_not_called()
        with patch.object(plugin,'api',return_value={'item':{'status':'needs_review'}}):
            with self.assertRaisesRegex(ValueError,'duplicate_target_not_applied'):
                plugin.classify({'source':'-20:17','outcome':'duplicate','reason':'Повтор документа','id':8})
        with patch.object(plugin,'api',return_value={'item':{'status':'applied'}}) as api:
            plugin.classify({'source':'-20:17','outcome':'duplicate','reason':'Тот же документ и количество','id':8})
            api.assert_called_once_with('/8')
        with plugin.db() as con:self.assertEqual(plugin.coverage(con)['items'][0]['classification']['event_id'],8)

    def test_clarification_reference_is_covered_by_original_operation(self):
        event=self.event();plugin.capture(event)
        other=self.event();other.message_id='18';plugin.capture(other)
        plugin.enqueue({'source':'-20:17','source_refs':['-20:18'],'event':{'event_key':'receipt-1'}})
        with plugin.db() as con:
            rows=plugin.coverage(con)['items']
            self.assertEqual(plugin.coverage(con)['unclassified_total'],0)
            self.assertEqual(rows[1]['used_by'][0]['state'],'queued')

    def test_old_unclassified_source_is_not_hidden_by_200_later_classifications(self):
        with plugin.db() as con:
            for i in range(201):
                key='-20:'+str(i)
                con.execute('INSERT INTO sources VALUES(?,?,NULL,NULL,?)',(key,json.dumps({'chat_id':'-20'}),i))
                if i:con.execute('INSERT INTO source_outcomes VALUES(?,?,?,?,?)',(key,'no_event','status only',None,i))
        with plugin.db() as con:
            result=plugin.coverage(con)
            self.assertEqual(result['unclassified_total'],1)
            self.assertEqual(result['items'][0]['source'],'-20:0')
            self.assertEqual(result['omitted'],1)


if __name__=='__main__':unittest.main()
