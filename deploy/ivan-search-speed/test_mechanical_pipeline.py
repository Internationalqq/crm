import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('pipeline',Path(__file__).with_name('mechanical_pipeline.py'))
pipeline=importlib.util.module_from_spec(spec);spec.loader.exec_module(pipeline)


class PipelineTests(unittest.TestCase):
    def test_per_position_waits_for_review_and_stops_after_cleanup_failure(self):
        class FastStop(threading.Event):
            def wait(self,timeout=None):return False
        with tempfile.TemporaryDirectory() as folder:
            w=Path(folder);(w/'packets').mkdir();rows=[]
            for n in [1,2]:
                raw=w/'raw'/str(n);raw.mkdir(parents=True)
                pipeline.save(raw/'collected.json',{'position':n})
                rows.append({'position_key':str(n),'name':'item','quantity':'1','unit':'шт'})
            original=pipeline.save;calls=[]
            def reviewed_save(path,value):
                original(path,value)
                if path.parent==w/'packets' and path.suffix=='.json' and 'items' in value:
                    original(path.with_suffix('.review.json'),{'items':value['items']})
            def cleanup(command,log,timeout):
                self.assertTrue((w/'packets/batch-0001.review.json').exists())
                self.assertIn('--cleanup-position',command);calls.append(command)
                raise TimeoutError('AX timeout')
            with patch.object(pipeline,'save',reviewed_save),patch.object(pipeline,'run_child',cleanup):
                pipeline.produce(w,[1,2],rows,time.time()+120,FastStop(),2,per_position=True)
            self.assertEqual(len(calls),1)
            self.assertFalse((w/'packets/batch-0002.json').exists())
            self.assertEqual(json.loads((w/'producer-state.json').read_text())['status'],'needs_attention')

    def test_packet_keeps_all_saved_candidates_and_text(self):
        with tempfile.TemporaryDirectory() as folder:
            raw=Path(folder)
            offers=[{'price_rub':i+1,'evidence':'price','context':'work'} for i in range(30)]
            pipeline.save(raw/'ai-source-1.json',{'candidates':offers,'page_text':'complete captured text'})
            pipeline.save(raw/'organic-discovery.json',{'organic_requested':5})
            item=pipeline.packet_item(raw,1,{'position_key':'k','name':'item','quantity':1,'unit':'шт'})
            self.assertEqual(len(item['sources'][0]['candidates']),30)
            self.assertEqual(item['sources'][0]['page_text'],'complete captured text')
            self.assertEqual(item['source_plan']['organic_requested'],5)
            self.assertFalse(item['candidates_truncated'])
    def test_packet_is_durable_before_cleanup_and_cleanup_failure_preserves_collection(self):
        class FastStop(threading.Event):
            def wait(self,timeout=None):return False
        with tempfile.TemporaryDirectory() as directory:
            w=Path(directory);(w/'packets').mkdir();raw=w/'raw/1';raw.mkdir(parents=True)
            pipeline.save(raw/'collected.json',{'position':1});called=[]
            def cleanup(command,log,timeout):
                self.assertTrue((w/'packets/batch-0001.json').exists())
                self.assertEqual(command[2:4],['cleanup','1']);self.assertIn('--cleanup-collected',command)
                called.append(command);raise TimeoutError('cleanup timed out')
            rows=[{'position_key':'1','name':'item','quantity':'1','unit':'шт'}]
            with patch.object(pipeline,'run_child',cleanup):pipeline.produce(w,[1],rows,time.time()+120,FastStop(),1)
            self.assertEqual(len(called),1)
            self.assertEqual(json.loads((w/'producer-state.json').read_text())['status'],'finished')
            self.assertEqual(json.loads((w/'packets/batch-0001.cleanup.json').read_text())['status'],'needs_attention')
            self.assertTrue((raw/'collected.json').exists())
    def test_finite_test_skips_ready_items_preserves_total_and_flushes_for_review(self):
        class FastStop(threading.Event):
            def wait(self,timeout=None):return False
        with tempfile.TemporaryDirectory() as folder:
            w=Path(folder);(w/'packets').mkdir();rows=[{'position_key':str(n),'name':'item','quantity':'1','unit':'шт'} for n in range(1,9)]
            pipeline.save(w/'packets/batch-0001.json',{'items':[{'position':1}]})
            called=[]
            def collect(command,log,timeout):
                called.append(int(command[3]));log.write_text('')
                if command[2] in ('discover','organic'):
                    pipeline.save(log.parent/('discovery.json' if command[2]=='discover' else 'organic-discovery.json'),{'elements':[]})
                return 0
            with patch.object(pipeline,'run_child',collect):pipeline.produce(w,list(range(1,9)),rows,time.time()+120,FastStop(),2)
            state=json.loads((w/'producer-state.json').read_text())
            self.assertEqual((state['status'],state['collected_positions'],state['total']),('stopped',3,8))
            self.assertEqual(set(called),{2,3});self.assertFalse((w/'raw/4').exists())
            self.assertEqual([i['position'] for i in json.loads((w/'packets/batch-0002.json').read_text())['items']],[2,3])
    def packet(self):
        return {'items':[{'position':1,'position_key':'key','sources':[{'source_id':'ai-source-1.json','status':'read',
            'candidates':[{'price_minor':12345}]}]}]}

    def response(self):
        return {'items':[{'position':1,'position_key':'key','status':'public_candidates','selected':[
            {'source_id':'ai-source-1.json','candidate_index':0,'price_minor':12345}],
            'problems':[],'needs_recheck':[]}]}

    def test_exact_literal_price_survives_validation(self):
        r=self.response();self.assertIs(pipeline.validate_review(self.packet(),r),r)

    def test_invented_price_and_blocked_source_are_rejected(self):
        r=self.response();r['items'][0]['selected'][0]['price_minor']=1
        with self.assertRaises(ValueError):pipeline.validate_review(self.packet(),r)
        p=self.packet();p['items'][0]['sources'][0]['status']='blocked_source'
        with self.assertRaises(ValueError):pipeline.validate_review(p,self.response())

    def test_missing_or_wrong_positions_are_not_completed(self):
        with self.assertRaises(ValueError):pipeline.validate_review(self.packet(),{'items':[]})
        r=self.response();r['items'][0]['position_key']='other'
        with self.assertRaises(ValueError):pipeline.validate_review(self.packet(),r)

    def test_reviewer_failure_keeps_packet_without_blind_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            w=Path(folder);(w/'packets').mkdir();f=w/'packets'/'batch-0001.json'
            pipeline.save(f,self.packet());calls=[]
            def fail(*args):calls.append(args);return 1
            pipeline.review_queue(w,time.time()+5,threading.Event(),threading.Event(),fail)
            self.assertEqual(len(calls),1);self.assertTrue(f.exists())
            self.assertTrue(f.with_suffix('.failed.json').exists())
            self.assertFalse(f.with_suffix('.review.json').exists())

    def test_deadline_with_pending_review_is_not_finished(self):
        with tempfile.TemporaryDirectory() as folder:
            w=Path(folder);(w/'packets').mkdir()
            pipeline.save(w/'packets/batch-0001.json',self.packet())
            finished=threading.Event();finished.set()
            pipeline.review_queue(w,time.time()-1,threading.Event(),finished)
            self.assertEqual(json.loads((w/'reviewer-state.json').read_text())['status'],'stopped')

    def test_collector_finishes_second_batch_while_first_review_is_blocked(self):
        class FastStop(threading.Event):
            def wait(self,timeout=None):return super().wait(min(timeout or .01,.005))
        with tempfile.TemporaryDirectory() as folder:
            w=Path(folder);(w/'packets').mkdir();rows=[{'position_key':str(n),'name':'item','quantity':'1','unit':'шт'} for n in range(1,11)]
            entered=threading.Event();release=threading.Event();finished=threading.Event();stop=FastStop()
            def review(command,log,timeout):
                f=Path(command[-1]);p=json.loads(f.read_text());entered.set();release.wait(3)
                pipeline.save(f.with_suffix('.response.json'),{'items':[{'position':i['position'],'position_key':i['position_key'],
                    'status':'no_price','selected':[],'problems':[],'needs_recheck':[]} for i in p['items']]});return 0
            def collect(command,log,timeout):
                log.write_text('')
                if command[2] in ('discover','organic'):
                    pipeline.save(log.parent/('discovery.json' if command[2]=='discover' else 'organic-discovery.json'),{'elements':[]})
                return 0
            thread=threading.Thread(target=pipeline.review_queue,args=(w,time.time()+5,stop,finished,review));thread.start()
            try:
                with patch.object(pipeline,'run_child',collect):pipeline.produce(w,list(range(1,11)),rows,time.time()+120,stop)
                self.assertTrue(entered.wait(1));self.assertFalse(release.is_set())
                self.assertEqual(len(json.loads((w/'packets'/'batch-0002.json').read_text())['items']),5)
            finally:finished.set();release.set();thread.join(3)
            self.assertFalse(thread.is_alive())
            self.assertTrue((w/'packets'/'batch-0002.review.json').exists())


if __name__=='__main__':unittest.main()
