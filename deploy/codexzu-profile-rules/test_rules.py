import asyncio
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace as NS
import unittest
from unittest.mock import AsyncMock

spec=importlib.util.spec_from_file_location('codexzu_rules',Path(__file__).with_name('__init__.py'))
rules=importlib.util.module_from_spec(spec);spec.loader.exec_module(rules)

def event(number, text, sender=None, media=None, owner='123', reply=''):
    raw=NS(forward_origin=NS(sender_user=NS(full_name=sender)) if sender else None,
           reply_to_message=NS(text=reply,caption=None) if reply else None)
    return NS(source=NS(user_id=owner,chat_id=owner,chat_type='dm',thread_id=None),
              raw_message=raw,text=text,message_id=str(number),reply_to_text=reply,
              media_urls=media or [],media_types=['image']*len(media or []),internal=False)

class BatchingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp=tempfile.TemporaryDirectory();self.dispatch=AsyncMock()
        self.b=rules.ForwardBatcher(self.temp.name,'123',self.dispatch,delay=.015)
    async def asyncTearDown(self):
        for t in list(self.b.tasks.values()):t.cancel()
        await asyncio.gather(*self.b.tasks.values(),return_exceptions=True)
        self.temp.cleanup()
    async def test_preserves_authors_reply_order_and_single_dispatch(self):
        self.assertTrue(self.b.take(event(1,'первый','Аня',reply='исходная реплика')))
        self.assertTrue(self.b.take(event(2,'второй','Борис')))
        self.assertTrue(self.b.take(event(3,'помоги ответить')))
        await asyncio.sleep(.04)
        self.dispatch.assert_awaited_once()
        text=self.dispatch.call_args.args[0].text
        records=json.loads(text.split('\n\n',1)[1])
        self.assertEqual([r['author'] for r in records],['Аня','Борис','Владелец'])
        self.assertEqual(records[0]['reply'],'исходная реплика')
    async def test_forwarded_stop_is_data(self):
        self.b.take(event(1,'/stop','Собеседник'));await asyncio.sleep(.04)
        self.dispatch.assert_awaited_once();self.assertFalse(self.dispatch.call_args.args[0].text.startswith('/'))
    async def test_owner_stop_cancels_batch_and_passes_native_stop(self):
        self.b.take(event(1,'цитата','Аня'));e=event(2,'стоп');self.assertFalse(self.b.take(e));self.assertEqual(e.text,'/stop')
        await asyncio.sleep(.04);self.dispatch.assert_not_awaited()
        data=json.loads(next(self.b.directory.glob('*.json')).read_text());self.assertEqual(data['status'],'cancelled')
    async def test_other_owner_passthrough_without_collecting(self):
        self.assertFalse(self.b.take(event(1,'чужой','Аня',owner='999')));self.assertEqual(self.b.pending,{})
    async def test_plain_message_does_not_wait_for_batching(self):
        self.assertFalse(self.b.take(event(1,'привет')));self.assertEqual(self.b.pending,{})
    async def test_attachments_are_not_lost(self):
        self.b.take(event(1,'первое','Аня',['a.png']));self.b.take(event(2,'второе','Борис',['b.png']))
        await asyncio.sleep(.04);e=self.dispatch.call_args.args[0];self.assertEqual(e.media_urls,['a.png','b.png'])
    async def test_saved_before_dispatch_and_duplicate_not_replayed(self):
        self.b.take(event(1,'текст','Аня'));path=next(self.b.directory.glob('*.json'));self.assertEqual(json.loads(path.read_text())['status'],'collecting')
        await asyncio.sleep(.04)
        recovered=rules.ForwardBatcher(self.temp.name,'123',self.dispatch,delay=.015)
        self.assertTrue(recovered.take(event(1,'текст','Аня')));await asyncio.sleep(.04);self.dispatch.assert_awaited_once()
    async def test_failed_dispatch_is_unknown_without_blind_retry(self):
        self.dispatch.side_effect=RuntimeError('unknown handoff');self.b.take(event(1,'текст','Аня'));await asyncio.sleep(.04)
        self.dispatch.assert_awaited_once();self.assertEqual(json.loads(next(self.b.directory.glob('*.json')).read_text())['status'],'dispatch_unknown')
    async def test_approval_command_bypasses_pending_quotes(self):
        self.b.take(event(1,'текст','Аня'));self.assertFalse(self.b.take(event(2,'/approve')))
        self.assertEqual(len(next(iter(self.b.pending.values()))['records']),1)

if __name__=='__main__':unittest.main()
