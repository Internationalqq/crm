import importlib.util,json,os,shutil,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace as NS
from datetime import datetime,timezone
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
class TractorPluginTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.home=Path(self.tmp.name);self.cache=self.home/'cache';self.cache.mkdir()
        plugin=self.home/'plugins/tractor-crm-intake/__init__.py';plugin.parent.mkdir(parents=True)
        shutil.copyfile(ROOT/'deploy/hermes-tractor-intake/__init__.py',plugin)
        shutil.copyfile(ROOT/'deploy/hermes-field-intake/__init__.py',plugin.with_name('_source_capture.py'))
        spec=importlib.util.spec_from_file_location('installed_tractor',plugin);self.p=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.p)
        (self.home/'tractor-crm.json').write_text(json.dumps({'group_id':'-5295304684'}))
        self.patches=[patch.dict(os.environ,{'HERMES_HOME':str(self.home)}),patch.dict(__import__('sys').modules,{'gateway.platforms.base':NS(get_image_cache_dir=lambda:self.cache,get_document_cache_dir=lambda:self.cache,get_audio_cache_dir=lambda:self.cache)})]
        for p in self.patches:p.start()
    def tearDown(self):
        for p in reversed(self.patches):p.stop()
        self.tmp.cleanup()
    def event(self):
        return NS(source=NS(chat_id='-5295304684',platform=NS(value='telegram')),internal=False,raw_message=NS(from_user=NS(id=1,is_bot=False,full_name='Driver'),date=datetime.now(timezone.utc),text='Трактор 4 часа'),media_urls=[],text='Трактор 4 часа',message_id='1')
    def test_scope_capture_outbox_lost_response_retry_and_frozen_delivered(self):
        event=self.event();self.assertIn('Tractor CRM source:',self.p.capture(event=event,gateway=NS(),session_store=NS())['text'])
        event.source.chat_id='-5589110678';self.assertIsNone(self.p.capture(event))
        args={'action':'extract','source':'-5295304684:1','record':{'kind':'work','hours':'4'}}
        self.assertTrue(json.loads(self.p.tool(args))['queued'])
        seen=[]
        def api(path,data):
            seen.append(data)
            if len(seen)==1:raise TimeoutError()
            return {'id':1,'status':'draft'}
        with patch.object(self.p,'api',side_effect=api):self.p.flush();self.p.flush()
        self.assertEqual(seen[0],seen[1])
        with self.p.source.db() as con:self.assertEqual(con.execute('SELECT synced FROM operations').fetchone()[0],1)
        self.assertEqual(json.loads(self.p.tool(args))['id'],1)
        # Historical delivered payloads did not have the optional false flag.
        self.assertEqual(json.loads(self.p.tool({**args,'needs_clarification':False}))['id'],1)
        con=self.p.source.db()
        try:self.assertNotIn('needs_clarification',json.loads(con.execute('SELECT payload FROM operations').fetchone()[0]))
        finally:con.close()
        args['record']['hours']='5';self.assertIn('already_synced',json.loads(self.p.tool(args))['error'])
    def test_http4_stops_and_error_does_not_leak_secrets(self):
        self.p.capture(self.event());self.p.tool({'action':'extract','source':'-5295304684:1','record':{}})
        with patch.object(self.p,'api',side_effect=ValueError('HTTP403')) as api:self.p.flush();self.p.flush();self.assertEqual(api.call_count,1)
        with patch.object(self.p,'api',side_effect=RuntimeError('secret')):self.assertNotIn('secret',self.p.tool({'action':'context'}))
if __name__=='__main__':unittest.main()
