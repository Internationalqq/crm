"""Separate this research queue's known output files from coding edits."""
import os
from pathlib import Path
import re

PROFILE = Path('/Users/egor/.hermes/profiles/commercial')
WORKSPACE = PROFILE / 'workspace/latest-five-tenders-20261015'


def is_research_output(path, workspace=WORKSPACE):
    try:
        original = Path(path).absolute().relative_to(workspace.absolute())
        if '..' in original.parts:
            return False
        relative = Path(path).resolve().relative_to(workspace.resolve()).as_posix()
        if original.as_posix() != relative:
            return False
    except (OSError, ValueError, RuntimeError):
        return False
    if relative in {'state.json', 'result.json', 'positions.csv', 'SUMMARY.md', 'batch-reporting.json'}:
        return True
    return bool(re.fullmatch(
        r'(?:results/\d{19}/[a-f0-9]{32}/[a-f0-9]{64}/result\.json'
        r'|attempts/run-\d+/batch-\d{3}-\d{3}\.json'
        r'|checkpoints/run\d+-processed\d+\.json)', relative))


def coding_paths(paths):
    """No env/config switch disables verification, including mixed code edits."""
    if (os.environ.get('HERMES_KANBAN_TASK') != 't_fb6e836e'
            or Path(os.environ.get('HERMES_HOME', '')).resolve() != PROFILE.resolve()):
        return list(paths)
    return [p for p in paths if not is_research_output(p)]


def patch_source(source):
    needle = '    paths = sorted({str(p) for p in changed_paths if p})'
    replacement = '''    from agent.research_artifact_policy import coding_paths
    paths = sorted(set(coding_paths(str(p) for p in changed_paths if p)))'''
    if 'from agent.research_artifact_policy import coding_paths' not in source:
        assert source.count(needle) == 1
        source = source.replace(needle, replacement)
    return source
