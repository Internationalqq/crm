"""Install beside Hermes test_run_cleanup_progress.py for integration verification."""
import asyncio
import importlib.util
from pathlib import Path
import time
import pytest

spec = importlib.util.spec_from_file_location('timer_cleanup_fixture', Path(__file__).with_name('test_run_cleanup_progress.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class QuietAgent:
    def __init__(self, **kwargs):
        self.tools = []

    def run_conversation(self, message, conversation_history=None, task_id=None):
        time.sleep(1.2)
        return {'final_response': 'done', 'messages': [], 'api_calls': 1}


@pytest.mark.asyncio
async def test_timer_deleted_only_after_final_delivery(monkeypatch, tmp_path):
    adapter = fixture.CleanupCaptureAdapter()
    runner = fixture._make_runner(adapter)
    gateway = fixture._install_fakes(monkeypatch, QuietAgent, cleanup_on=True)
    monkeypatch.setenv('HERMES_TOOL_PROGRESS_MODE', 'off')
    monkeypatch.setattr(gateway, '_load_gateway_config', lambda: {
        'display': {'platforms': {'telegram': {'working_timer': True, 'cleanup_progress': True}}}})
    monkeypatch.setattr(gateway, '_hermes_home', tmp_path)
    source = fixture.SessionSource(platform=fixture.Platform.TELEGRAM, chat_id='123', chat_type='dm')
    key = 'agent:main:telegram:dm:123'
    result = await runner._run_agent(message='hello', context_prompt='', history=[], source=source,
                                     session_id='timer-test', session_key=key)
    assert result['final_response'] == 'done'
    timers = [item for item in adapter.sent if item['content'].startswith('⏳ Работаю ·')]
    assert len(timers) == 1
    assert timers[0]['content'] == '⏳ Работаю · 0:00'
    assert adapter.edits and adapter.edits[0]['content'] == '⏳ Работаю · 0:01'
    assert not adapter.deleted
    callback = adapter.pop_post_delivery_callback(key)
    assert callable(callback)
    callback()
    for _ in range(20):
        await asyncio.sleep(0.01)
        if adapter.deleted:
            break
    assert any(item['message_id'] == timers[0]['message_id'] for item in adapter.deleted)
