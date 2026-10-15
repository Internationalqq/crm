"""Regression: each busy follow-up is observable before any queue merge."""
import asyncio
import importlib.util
from pathlib import Path
from unittest.mock import patch
import pytest

root = Path(__file__).resolve().parents[1]
if not (root / 'tests/gateway/test_active_session_text_merge.py').exists():
    root = Path('/Users/egor/.hermes/hermes-agent')
spec = importlib.util.spec_from_file_location('existing_merge_tests', root / 'tests/gateway/test_active_session_text_merge.py')
fixtures = importlib.util.module_from_spec(spec); spec.loader.exec_module(fixtures)


@pytest.mark.asyncio
async def test_each_original_observed_before_busy_merge_without_model_or_send():
    adapter = fixtures._make_adapter(); adapter._busy_text_mode = ''
    first = fixtures._make_event('first'); key = fixtures.build_session_key(first.source)
    adapter._active_sessions[key] = asyncio.Event(); originals = []
    def observe(name, **kwargs):
        assert name == 'gateway_message_received'
        originals.append((kwargs['event'].message_id, kwargs['event'].text))
        return []
    with patch('hermes_cli.plugins.invoke_hook', side_effect=observe):
        await adapter.handle_message(fixtures._make_event('photo caption'))
        await adapter.handle_message(fixtures._make_event('yes confirmed'))
    assert [x[1] for x in originals] == ['photo caption', 'yes confirmed']
    assert adapter._pending_messages[key].text == 'photo caption\nyes confirmed'
    adapter._message_handler.assert_not_called()


@pytest.mark.asyncio
async def test_ingress_skip_result_cannot_drop_busy_input():
    adapter = fixtures._make_adapter(); adapter._busy_text_mode = ''
    event = fixtures._make_event('ordinary input'); key = fixtures.build_session_key(event.source)
    adapter._active_sessions[key] = asyncio.Event()
    with patch('hermes_cli.plugins.invoke_hook', return_value=[{'action': 'skip'}]):
        await adapter.handle_message(event)
    assert adapter._pending_messages[key].text == 'ordinary input'
