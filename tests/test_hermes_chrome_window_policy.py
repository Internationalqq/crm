import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('chrome_policy', Path(__file__).resolve().parents[1] / 'deploy/hermes_chrome_window_policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def window(wid, pid=7, app='Google Chrome', title=''):
    return dict(window_id=wid, pid=pid, app_name=app, title=title)


def state(*roles, valid=False):
    return {'structuredContent': {'screenshot_frame_valid': valid, 'elements': [
        {'role': role, 'label': label, 'element_token': f'{role}:{i}'}
        for i, (role, label) in enumerate(roles)]}}


POPUP = state(('AXWindow', ''), ('AXWebArea', 'Omnibox Popup'))
MAIN = state(('AXWindow', 'Example — Google Chrome'), ('AXTextField', 'Адрес'), valid=True)


class ChromeWindowTests(unittest.TestCase):
    def select(self, windows, states):
        calls = []
        def native(candidates):
            calls.append([w['window_id'] for w in candidates])
            return candidates[0], states[candidates[0]['window_id']]
        result = policy.select_content(windows, native)
        return result, calls

    def test_omnibox_uses_same_pid_main_snapshot_without_rebinding_tokens(self):
        windows = [window(1), window(2, title='Example — Google Chrome')]
        (chosen, snapshot), calls = self.select(windows, {1: POPUP, 2: MAIN})
        self.assertEqual(chosen['window_id'], 2)
        self.assertIs(snapshot, MAIN)
        self.assertEqual(calls, [[1, 2], [2]])

    def test_cannot_fall_through_to_other_process(self):
        with self.assertRaises(RuntimeError):
            self.select([window(1), window(2, pid=8)], {1: POPUP, 2: MAIN})

    def test_positive_bounds_cannot_override_explicit_invalid_frame(self):
        invalid = state(('AXWindow', 'Google Chrome'))
        invalid['structuredContent']['window_bounds'] = {'width': 1280, 'height': 900}
        with self.assertRaises(RuntimeError):
            self.select([window(1), window(2)], {1: POPUP, 2: invalid})

    def test_no_main_or_invalid_main_remains_unbound(self):
        for windows, states in [([window(1)], {1: POPUP}),
                                ([window(1), window(2)], {1: POPUP, 2: state(('AXWindow', 'Google Chrome'))})]:
            with self.subTest(windows=windows), self.assertRaises(RuntimeError):
                self.select(windows, states)

    def test_ai_editor_dialog_and_unknown_window_are_never_skipped(self):
        for extra in [('AXTextArea', 'AI question'), ('AXDialog', 'Allow'),
                      ('AXSheet', 'Permission'), ('AXWebArea', 'Different popup')]:
            initial = state(('AXWindow', ''), ('AXWebArea', 'Omnibox Popup'), extra)
            if extra[1] == 'Different popup':
                initial = state(extra)
            (chosen, snapshot), calls = self.select([window(1), window(2)], {1: initial, 2: MAIN})
            self.assertEqual(chosen['window_id'], 1)
            self.assertIs(snapshot, initial)
            self.assertEqual(len(calls), 1)

    def test_dialog_below_omnibox_is_a_barrier_not_an_excuse_to_skip_it(self):
        dialog = state(('AXWindow', 'Google Chrome'), ('AXDialog', 'Sign in'), valid=True)
        with self.assertRaises(RuntimeError):
            self.select([window(1), window(2), window(3)], {1: POPUP, 2: dialog, 3: MAIN})

    def test_firefox_and_normal_chrome_are_unchanged(self):
        for app, snapshot in [('Firefox', POPUP), ('Google Chrome', MAIN)]:
            (chosen, result), calls = self.select([window(1, app=app), window(2, app=app)], {1: snapshot, 2: MAIN})
            self.assertEqual(chosen['window_id'], 1)
            self.assertIs(result, snapshot)
            self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
