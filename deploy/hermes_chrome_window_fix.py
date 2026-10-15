"""Install the narrow Chrome capture fix into the existing Hermes runtime."""
import argparse
from pathlib import Path

OLD = '    def _select_content_window(self, windows: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:\n'
NEW = '''    def _select_content_window(self, windows: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        from tools.computer_use.chrome_window_policy import select_content
        return select_content(windows, self._select_application_window)

    def _select_application_window(self, windows: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
'''


def apply(root, backup):
    target = root / 'tools/computer_use/cua_backend.py'
    original = target.read_text(encoding='utf-8')
    if NEW in original:
        updated = original
    else:
        if original.count(OLD) != 1:
            raise ValueError('Hermes capture version changed; inspect before applying')
        updated = original.replace(OLD, NEW)
    policy = Path(__file__).with_name('hermes_chrome_window_policy.py').read_text(encoding='utf-8-sig')
    compile(updated, str(target), 'exec')
    compile(policy, '<chrome-window-policy>', 'exec')
    backup.mkdir(parents=True, exist_ok=True)
    saved = backup / 'cua_backend.py'
    if not saved.exists():
        saved.write_text(original, encoding='utf-8')
    helper = target.with_name('chrome_window_policy.py')
    helper_stage = helper.with_suffix('.chrome-staged')
    helper_stage.write_text(policy, encoding='utf-8')
    helper_stage.replace(helper)
    stage = target.with_suffix('.chrome-staged')
    stage.write_text(updated, encoding='utf-8')
    stage.replace(target)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args()
    apply(args.root, args.backup)
    print('Chrome zero-sized omnibox selection fixed; input guards retained')
