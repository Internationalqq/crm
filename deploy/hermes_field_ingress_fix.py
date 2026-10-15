"""Observe originals before busy/debounce merges, without changing dispatch/auth."""
import argparse
from pathlib import Path


def apply(root, backup):
    base = root / 'gateway/platforms/base.py'
    original = base.read_text(encoding='utf-8')
    anchor = '        coerce_plaintext_gateway_command(event)\n\n        # Rewrite ``event.source.thread_id``'
    replacement = '''        # Durable intake observes each original before busy/debounce can merge it.
        if not getattr(event, "internal", False):
            try:
                from hermes_cli.plugins import invoke_hook
                for result in invoke_hook("gateway_message_received", event=event):
                    if isinstance(result, dict) and result.get("action") == "rewrite" and isinstance(result.get("text"), str):
                        event.text = result["text"]
            except Exception:
                logger.warning("gateway_message_received intake failed", exc_info=True)

        coerce_plaintext_gateway_command(event)

        # Rewrite ``event.source.thread_id``'''
    if replacement in original:
        changed = original
    else:
        if original.count(anchor) != 1:
            raise ValueError('Gateway version changed; inspect ingress before applying')
        changed = original.replace(anchor, replacement)
    plugins = root / 'hermes_cli/plugins.py'
    before = plugins.read_text(encoding='utf-8')
    marker = 'VALID_HOOKS: Set[str] = {\n'
    if '    "gateway_message_received",\n' in before:
        after = before
    else:
        if before.count(marker) != 1:
            raise ValueError('Plugin hook registry changed')
        after = before.replace(marker, marker + '    "gateway_message_received",\n')
    for path, source in [(base, changed), (plugins, after)]:
        compile(source, str(path), 'exec')
    backup.mkdir(parents=True, exist_ok=True)
    for path, old, new in [(base, original, changed), (plugins, before, after)]:
        saved = backup / path.name
        if not saved.exists():
            saved.write_text(old, encoding='utf-8')
        stage = path.with_suffix('.intake-staged')
        stage.write_text(new, encoding='utf-8'); stage.replace(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args(); apply(args.root, args.backup)
