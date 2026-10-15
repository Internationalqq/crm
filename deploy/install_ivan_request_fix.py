"""Install the reviewed compact view and scoped reader; does not start workers."""
from pathlib import Path
import datetime
import py_compile
import shutil
import yaml
from hermes_kanban_compact import patch_source
from hermes_research_artifacts import patch_source as patch_verification


def main():
    root = Path('/Users/egor/.hermes/hermes-agent')
    profile = Path('/Users/egor/.hermes/profiles/commercial')
    source = Path(__file__).resolve().parent
    backup = Path('/Users/egor/.hermes/backups/ivan-request-fix-20261015')
    backup.mkdir(parents=True, exist_ok=True)
    target = root / 'tools/kanban_tools.py'
    if not (backup / 'kanban_tools.py').exists():shutil.copy2(target, backup / 'kanban_tools.py')
    changed = patch_source(target.read_text())
    temp = target.with_suffix('.py.staged'); temp.write_text(changed)
    py_compile.compile(str(temp), doraise=True)
    shutil.copy2(source / 'hermes_kanban_compact.py', root / 'tools/kanban_compact_policy.py')
    temp.replace(target)
    verification = root / 'agent/verification_stop.py'
    if not (backup / 'verification_stop.py').exists():shutil.copy2(verification, backup / 'verification_stop.py')
    shutil.copy2(source / 'hermes_research_artifacts.py', root / 'agent/research_artifact_policy.py')
    staged = verification.with_suffix('.py.staged')
    staged.write_text(patch_verification(verification.read_text()))
    py_compile.compile(str(staged), doraise=True); staged.replace(verification)
    plugin = profile / 'plugins/public-research'
    if plugin.exists() and not (backup / 'public-research').exists():shutil.copytree(plugin, backup / 'public-research')
    shutil.copytree(source / 'hermes-public-research', plugin, dirs_exist_ok=True)
    py_compile.compile(str(plugin / '__init__.py'), doraise=True)
    config_path = profile / 'config.yaml'
    config = yaml.safe_load(config_path.read_text())
    if config.get('plugins') is None:
        if not (backup / 'config.yaml').exists():shutil.copy2(config_path, backup / 'config.yaml')
        # Preserve the existing YAML and all model/account/permission settings.
        config_path.write_text(config_path.read_text().rstrip() + '\nplugins:\n  enabled:\n    - public-research\n')
    else:
        assert 'public-research' in config['plugins'].get('enabled', []), 'Merge existing plugin allowlist explicitly'
    agents = profile / 'AGENTS.md'
    if not (backup / 'AGENTS.md').exists():shutil.copy2(agents, backup / 'AGENTS.md')
    marker = '## Пять тендеров: компактные запросы 15 октября 2026'
    text = agents.read_text()
    if marker not in text:
        brief = '''## Пять тендеров: компактные запросы 15 октября 2026
Для карточки t_fb6e836e актуальны TASK.md и REQUEST_BATCH.md её рабочей папки.
Это прямое последнее поручение пользователя, заменяющее старые указания о GUI.
kanban_show вызывай только compact=true; не загружай полный журнал комментариев,
worker_context, старые AGENTS/SKILL про Google AI/Chrome или все1202строки в контекст.
Работай только текущими10строками REQUEST_BATCH.md, затем следующими10.
Поиск web_search; первичные HTTPS страницы public_page_read. Никаких curl,
terminal, Python-скриптов, редактирования кода, desktop/Chrome/browser_lock.
При отказе инструмента фиксируй конкретный источник и продолжай другие строки;
CAPTCHA/вход/403/лимит не обходи. Два URL прежнего отказа не повторяй.
Пиши только данные checkpoint/result/evidence; не создавай проверочные скрипты.
Сводка в Telegram1228838420 после каждых50НОВЫХ завершённых позиций по ledger,
без стартовых/периодических статусов. Цены только с первичными доказательствами.
Прочие профили/задачи сохраняют свои прежние правила.

'''
        agents.write_text(brief + text)
    print('Installed; backup:', backup, 'at', datetime.datetime.now().isoformat())


if __name__ == '__main__':main()
