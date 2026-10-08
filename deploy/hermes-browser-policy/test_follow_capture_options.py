"""Action verification must not need a second model turn to request AX."""
import json
from unittest.mock import MagicMock, patch

import pytest

from tools.computer_use.backend import ActionResult, CaptureResult, UIElement
from tools.computer_use.tool import _dispatch


def backend_fixture():
    backend = MagicMock()
    backend._last_app = "Firefox"
    for action in ("click", "drag", "scroll", "type_text", "key", "set_value", "focus_app"):
        getattr(backend, action).return_value = ActionResult(ok=True, action=action)
    backend.capture.side_effect = lambda mode, app: CaptureResult(
        mode=mode, width=1200, height=900, app=app,
        elements=[UIElement(index=i, role="AXButton", label=f"row {i}") for i in range(160)],
    )
    return backend


@pytest.mark.parametrize("action,args", [
    ("click", {"element": 1}),
    ("double_click", {"element": 1}),
    ("right_click", {"element": 1}),
    ("middle_click", {"element": 1}),
    ("drag", {"from_element": 1, "to_element": 2}),
    ("scroll", {"direction": "down"}),
    ("type", {"text": "approved request", "element": 1}),
    ("key", {"keys": "return"}),
    ("set_value", {"value": "approved request", "element": 1}),
    ("focus_app", {"app": "Firefox"}),
])
def test_action_returns_requested_ax_and_elements_in_one_call(action, args):
    backend = backend_fixture()
    result = json.loads(_dispatch(backend, action, dict(args, capture_after=True, mode="ax", max_elements=150)))
    backend.capture.assert_called_once_with(mode="ax", app="Firefox")
    assert result["ok"] is True
    assert result["mode"] == "ax"
    assert len(result["elements"]) == 150
    assert result["truncated_elements"] == 10


def test_default_remains_som_with_default_cap():
    backend = backend_fixture()
    result = json.loads(_dispatch(backend, "click", {"element": 1, "capture_after": True}))
    backend.capture.assert_called_once_with(mode="som", app="Firefox")
    assert len(result["elements"]) == 100


def test_invalid_follow_capture_mode_rejected_before_input():
    backend = backend_fixture()
    result = json.loads(_dispatch(backend, "click", {"element": 1, "capture_after": True, "mode": "invalid"}))
    assert "error" in result
    backend.click.assert_not_called()
    backend.capture.assert_not_called()


def test_failed_action_does_not_capture_or_retry():
    backend = backend_fixture()
    backend.click.return_value = ActionResult(ok=False, action="click", message="outcome unknown")
    result = json.loads(_dispatch(backend, "click", {"element": 1, "capture_after": True, "mode": "ax"}))
    assert result["ok"] is False
    assert backend.click.call_count == 1
    backend.capture.assert_not_called()


def test_capture_failure_is_distinct_from_action_failure_without_replay():
    backend = backend_fixture()
    backend.capture.side_effect = RuntimeError("window unavailable")
    result = json.loads(_dispatch(backend, "click", {"element": 1, "capture_after": True, "mode": "ax"}))
    assert result["ok"] is True
    assert result["capture_ok"] is False
    assert result["capture_error"] == "follow_up_capture_failed"
    assert backend.click.call_count == backend.capture.call_count == 1


def test_ax_path_does_not_call_auxiliary_vision():
    backend = backend_fixture()
    with patch("tools.computer_use.tool._route_capture_through_aux_vision") as vision:
        _dispatch(backend, "click", {"element": 1, "capture_after": True, "mode": "ax"})
    vision.assert_not_called()
