"""Opt-in quiet approval results for Hermes Telegram; approval decisions stay enforced."""
from pathlib import Path
import argparse

OLD = '''                await query.answer(text=label)

                # Edit message to show decision, remove buttons
                try:
                    await query.edit_message_text(
                        text=self.format_message(f"{label} by {user_display}"),
                        parse_mode=ParseMode.MARKDOWN_V2,
                        reply_markup=None,
                    )
                except Exception:
                    pass  # non-fatal if edit fails'''
NEW = '''                quiet_result = os.environ.get("HERMES_TELEGRAM_APPROVAL_RESULT_ENABLED", "true").lower() == "false"
                await query.answer(text="Решение сохранено" if quiet_result else label)

                # This profile may remove the temporary prompt after a decision.
                # Authorization and approval resolution below remain unchanged.
                try:
                    if quiet_result:
                        await query.delete_message()
                    else:
                        await query.edit_message_text(
                            text=self.format_message(f"{label} by {user_display}"),
                            parse_mode=ParseMode.MARKDOWN_V2,
                            reply_markup=None,
                        )
                except Exception:
                    if quiet_result:
                        try:
                            await query.edit_message_reply_markup(reply_markup=None)
                        except Exception:
                            pass  # Presentation failure must not lose the decision.'''


def patch_source(source):
    if NEW in source:
        return source
    if source.count(OLD) != 1:
        raise ValueError('Hermes adapter changed: approval block needs review')
    patched = source.replace(OLD, NEW)
    compile(patched, '<telegram-adapter>', 'exec')
    return patched


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args()
    path = args.root.resolve() / 'plugins/platforms/telegram/adapter.py'
    original = path.read_text(encoding='utf-8')
    patched = patch_source(original)
    args.backup.mkdir(parents=True, exist_ok=True)
    saved = args.backup / 'telegram-adapter-before.py'
    if not saved.exists():
        saved.write_text(original, encoding='utf-8')
    if patched != original:
        staged = path.with_suffix('.quiet-staged')
        staged.write_text(patched, encoding='utf-8')
        staged.replace(path)
    print('Telegram result presentation patched; approval handling preserved')


if __name__ == '__main__':
    main()
