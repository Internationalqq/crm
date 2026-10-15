"""Run with the existing Hermes runtime, on synthetic captures only."""
import json
from unittest.mock import MagicMock
import pytest
from tools.computer_use.backend import CaptureResult, UIElement
from tools.computer_use.tool import _capture_response, _dispatch


def capture(mode='ax'):
    return CaptureResult(mode=mode, width=1200, height=900, app='Google Chrome', elements=[
        UIElement(index=i, role='AXRadioButton' if i == 1490 else 'AXStaticText',
                  label='Saved AI tab' if i == 1490 else str(i), element_token=f'token-{i}')
        for i in range(1495)])


def test_tail_page_exposes_tabs_without_reindexing_or_losing_tokens():
    backend = MagicMock()
    backend.capture.return_value = capture()
    first = json.loads(_dispatch(backend, 'capture', {'mode': 'ax', 'max_elements': 1000}))
    second = json.loads(_dispatch(backend, 'capture', {'mode': 'ax', 'max_elements': 1000, 'element_offset': first['next_element_offset']}))
    assert len(first['elements']) == 1000
    assert len(second['elements']) == 495
    assert second['elements'][490]['index'] == 1490
    # Tokens stay in the backend's captured elements; model output exposes indices.
    assert backend.capture.return_value.elements[1490].element_token == 'token-1490'
    assert second['next_element_offset'] is None
    assert 'element_offset=1495' not in second['summary']
    assert backend.capture.call_count == 2


@pytest.mark.parametrize('offset', [-1, 'bad', None, float('inf')])
def test_invalid_offset_keeps_default_bounded_page(offset):
    result = json.loads(_capture_response(capture(), element_offset=offset))
    assert result['element_offset'] == 0
    assert len(result['elements']) == 100


def test_end_page_does_not_loop_or_bypass_maximum():
    backend = MagicMock(); backend.capture.return_value = capture()
    result = json.loads(_dispatch(backend, 'capture', {'mode': 'ax', 'max_elements': 5000, 'element_offset': 1000}))
    assert len(result['elements']) == 495
    result = json.loads(_capture_response(capture(), element_offset=9000))
    assert not result['elements'] and result['next_element_offset'] is None
    assert 'element_offset=9000' not in result['summary']


def test_som_keeps_default_first_page():
    result = json.loads(_capture_response(capture('som'), element_offset=1000))
    assert result['elements'][0]['index'] == 0
