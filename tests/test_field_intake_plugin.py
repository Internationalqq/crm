import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace as NS
from datetime import datetime,timezone
from unittest.mock import patch
import tempfile
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


if __name__=='__main__':unittest.main()
