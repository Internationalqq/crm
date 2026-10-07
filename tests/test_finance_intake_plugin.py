import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch

p=Path(__file__).resolve().parents[1]/'deploy/hermes-finance-intake/__init__.py'
spec=importlib.util.spec_from_file_location('intake_plugin',p)
plugin=importlib.util.module_from_spec(spec);spec.loader.exec_module(plugin)


class PluginTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.cache=self.root/'cache';self.cache.mkdir()
        self.patches=[patch.object(plugin,'PROFILE',self.root),patch.dict(os.environ,{'HERMES_HOME':str(self.root)}),
            patch.dict(sys.modules,{'gateway.platforms.base':NS(get_image_cache_dir=lambda:self.cache,get_document_cache_dir=lambda:self.cache)})]
        for m in self.patches:m.start()
    def tearDown(self):
        for m in reversed(self.patches):m.stop()
        self.tmp.cleanup()
    def event(self):
        f=self.cache/'test.jpg';f.write_bytes(b'original bytes')
        return NS(source=NS(platform=NS(value='telegram'),chat_id=plugin.GROUP),internal=False,
            raw_message=NS(photo=[1],document=None,from_user=NS(id=12,is_bot=False,full_name='Member'),caption='Object'),
            media_urls=[str(f)],text='caption',message_id='14')
    def test_attachment_durable_before_network_and_retry_lost_ack(self):
        e=self.event()
        with patch.object(plugin,'api',side_effect=TimeoutError): r=plugin.capture(e)
        self.assertIn('crm_id": null',r['text'])
        with plugin.db() as con:
            row=con.execute('SELECT * FROM queue').fetchone();self.assertEqual(Path(row['path']).read_bytes(),b'original bytes')
        with patch.object(plugin,'api',return_value={'item':{'id':9}}) as api:
            plugin.flush();plugin.capture(e)
            self.assertEqual(api.call_count,1)
        with plugin.db() as con:self.assertEqual(con.execute('SELECT count(*) FROM queue').fetchone()[0],1)
    def test_unrelated_group_reply_and_files_outside_cache_not_ingested(self):
        e=self.event();e.source.chat_id='-99';self.assertIsNone(plugin.capture(e))
        e.source.chat_id=plugin.GROUP;e.raw_message.photo=[];self.assertIsNone(plugin.capture(e))
        e.raw_message.photo=[1];f=self.root/'outside.jpg';f.write_bytes(b'private');e.media_urls=[str(f)]
        self.assertIsNone(plugin.capture(e))
    def test_money_action_unavailable_and_secrets_not_returned_on_errors(self):
        self.assertIn('error',json.loads(plugin.tool({'action':'confirm','id':1})))
        with patch.object(plugin,'api',side_effect=ValueError('SECRET')):
            self.assertNotIn('SECRET',plugin.tool({'action':'projects'}))

if __name__=='__main__':unittest.main()
