import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('working_timer', Path(__file__).with_name('working_timer.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TimerTests(unittest.IsolatedAsyncioTestCase):
    async def test_one_bubble_ticks_during_silence_and_tracks_cleanup_id(self):
        adapter = SimpleNamespace(send=AsyncMock(return_value=SimpleNamespace(success=True, message_id=7)),
                                  edit_message=AsyncMock(return_value=SimpleNamespace(success=True)))
        state = {'time': 0, 'active': True}
        ids = []
        async def sleep(_):
            state['time'] += 1
            if state['time'] == 3:
                state['active'] = False
        await module.working_timer(adapter, 'chat', {'thread_id': 'topic'}, lambda: state['active'], ids,
                                   clock=lambda: state['time'], sleep=sleep)
        adapter.send.assert_awaited_once_with('chat', '⏳ Работаю · 0:00', metadata={'thread_id': 'topic'})
        self.assertEqual(ids, ['7'])
        self.assertEqual([call.args[-1] for call in adapter.edit_message.await_args_list],
                         ['⏳ Работаю · 0:01', '⏳ Работаю · 0:02'])

    async def test_unknown_send_or_failed_edit_never_creates_second_bubble(self):
        for fail_send in (False, True):
            adapter = SimpleNamespace(send=AsyncMock(return_value=SimpleNamespace(success=True, message_id=7)),
                                      edit_message=AsyncMock(return_value=SimpleNamespace(success=False)))
            if fail_send:
                adapter.send.side_effect = RuntimeError('transport')
            ids = []
            await module.working_timer(adapter, 'chat', {}, lambda: True, ids, sleep=AsyncMock())
            self.assertEqual(adapter.send.await_count, 1)
            self.assertEqual(ids, [] if fail_send else ['7'])

    async def test_stale_run_never_sends(self):
        adapter = SimpleNamespace(send=AsyncMock())
        await module.working_timer(adapter, 'chat', {}, lambda: False, [])
        adapter.send.assert_not_called()


if __name__ == '__main__':
    unittest.main()
