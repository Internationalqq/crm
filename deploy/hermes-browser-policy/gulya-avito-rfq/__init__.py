"""Same guarded RFQ helper; return its screenshot in the same model turn."""
import base64
from contextlib import contextmanager
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

HOME = Path('/Users/egor/.hermes/profiles/gulya')
WORKSPACE = HOME / 'workspace/gabions-20261008'
HELPER = Path('/Users/egor/.hermes/team-browser-access/avito_rfq_step.py')
TASK = 't_b4b6d0c9'
BOARD = 'construction-team'
STEPS = ('inspect', 'fill', 'send', 'confirm', 'submit', 'scan', 'run_batch')


@contextmanager
def execution_lock():
    """Reject overlapping steps, even from separate worker processes."""
    # Keep the inode: unlinking a flock file would permit a second lock owner.
    with (WORKSPACE / '.rfq-step.lock').open('a+b') as guard:
        if os.name == 'nt':
            import msvcrt
            guard.seek(0)
            msvcrt.locking(guard.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(guard.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            if os.name == 'nt':
                guard.seek(0)
                msvcrt.locking(guard.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(guard.fileno(), fcntl.LOCK_UN)


def in_scope():
    return (Path(os.environ.get('HERMES_HOME', '')).resolve() == HOME.resolve()
            and os.environ.get('HERMES_PROFILE') == 'gulya'
            and os.environ.get('HERMES_KANBAN_TASK') == TASK
            and os.environ.get('HERMES_KANBAN_BOARD') == BOARD)


def compact_card(raw):
    """Keep the canonical instructions/handoffs once; never delete history."""
    data = json.loads(raw)
    if 'task' not in data or not data.get('worker_context'):
        return raw
    return json.dumps({
        'task': {k: v for k, v in data['task'].items() if k not in ('title', 'body')},
        'worker_context': data['worker_context'],
        'parents': data['parents'], 'children': data['children'],
        'history_counts': {k: len(data[k]) for k in ('comments', 'runs', 'events')},
        'history_note': 'Canonical worker_context includes bounded recent history. '
                        'Use compact=false for the full original response.',
    }, ensure_ascii=False)


def with_image(result):
    path = result.get('image_path') or result.get('image')
    if not path:
        return json.dumps(result, ensure_ascii=False)
    image = Path(path).resolve()
    if not image.is_relative_to((WORKSPACE / 'speed-benchmark-20261008').resolve()):
        raise ValueError('Evidence outside this campaign')
    if image.stat().st_size > 12 * 1024 * 1024:
        raise ValueError('Evidence image too large; inspect the saved file')
    raw = image.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if result.get('image_sha256') and result['image_sha256'] != digest:
        raise ValueError('Evidence changed after capture')
    if raw.startswith(b'\x89PNG\r\n\x1a\n'):
        mime = 'image/png'
    elif raw.startswith(b'\xff\xd8\xff'):
        mime = 'image/jpeg'
    else:
        raise ValueError('Evidence is not a PNG/JPEG')
    text = json.dumps({**result, 'image_sha256': digest}, ensure_ascii=False)
    return {'_multimodal': True, 'text_summary': text, 'content': [
        {'type': 'text', 'text': text},
        {'type': 'image_url', 'image_url': {
            'url': 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii')}},
    ]}


def handle(args, **_):
    # Guard again at invocation, not just schema discovery.
    if not in_scope():
        return json.dumps({'status': 'refused', 'reason': 'Outside the assigned campaign'})
    try:
        with execution_lock():
            return guarded_step(args)
    except OSError:
        return json.dumps({'status': 'needs_inspection', 'automatic_retry': False,
                           'reason': 'RFQ execution lock unavailable. Another step may '
                                     'be active; inspect its outcome, do not replay.'})


def guarded_step(args):
    try:
        step = args.get('step')
        if step not in STEPS:
            raise ValueError('Unknown RFQ step')
        lock_arg = args.get('lock_file')
        if not isinstance(lock_arg, str) or not lock_arg:
            raise ValueError('Own lock file required')
        lock = (WORKSPACE / lock_arg).resolve()
        if not lock.is_relative_to(WORKSPACE.resolve()):
            raise ValueError('Lock file outside this campaign')
        command = [sys.executable, str(HELPER), step, '--lock-file', str(lock)]
        for key, flag in [('supplier', '--supplier'),
                          ('reviewed_image_sha256', '--reviewed-image-sha256'),
                          ('approved_plan_sha256', '--approved-plan-sha256')]:
            if args.get(key) is not None:
                if not isinstance(args[key], str):
                    raise ValueError('String argument required: ' + key)
                command.extend([flag, args[key]])
        completed = subprocess.run(command, cwd=WORKSPACE, capture_output=True,
                                   text=True, timeout=600 if step in ('scan', 'run_batch') else 110, check=False)
        # cua-driver may print its version notice before the helper JSON.
        lines = [line for line in completed.stdout.splitlines() if line.startswith('{')]
        if not lines:
            raise ValueError('No helper result; inspect saved pending state, do not replay')
        result = json.loads(lines[-1])
        if not isinstance(result, dict):
            raise ValueError('Invalid helper result')
        if completed.returncode != 0:
            return json.dumps({'status': 'needs_inspection',
                               'reason': result.get('reason', 'Helper failed'),
                               'automatic_retry': False}, ensure_ascii=False)
        return with_image(result)
    except subprocess.TimeoutExpired:
        return json.dumps({'status': 'needs_inspection', 'automatic_retry': False,
                           'reason': 'Step timed out; inspect actual chat and saved pending. '
                                     'Never repeat Fill or Send without resolving its outcome.'})
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return json.dumps({'status': 'needs_inspection', 'reason': str(exc),
                           'automatic_retry': False}, ensure_ascii=False)


SCHEMA = {
    'name': 'avito_rfq_step',
    'description': 'Prefer scan → review the returned seller candidates once → run_batch '
                   'with approved_plan_sha256 for up to 10 suitable new sellers within '
                   'the remaining campaign limit. Batch opens each observed card/chat, '
                   'requires loaded empty history, submits and verifies delivery locally, '
                   'returns to search and continues without model calls between sellers. '
                   'Any ambiguity/unknown send/access restriction stops for inspection. '
                   'Never blindly retry a batch. Or use inspect → visually review the recipient/history → submit '
                   'for this authorized gabion campaign. Submit locally pastes the '
                   'approved text, checks actual editor/recipient, sends ONCE, and '
                   'records only exact outgoing + delivery receipt + empty editor. '
                   'No model call is needed between Paste and Send. If delivery '
                   'remains unknown, inspect the result and never repeat submit. '
                   'Legacy fill/send/confirm remain available for an existing draft. '
                   'The image is already included: no separate image-loading call. '
                   'Supply the SHA-256 only after actually examining that image. '
                   'Unknown send must be inspected, never repeated. Same own GUI lock '
                   'and campaign limit apply. A tool success is not delivery evidence.',
    'parameters': {'type': 'object', 'properties': {
        'step': {'type': 'string', 'enum': list(STEPS)},
        'lock_file': {'type': 'string'},
        'supplier': {'type': 'string'},
        'reviewed_image_sha256': {'type': 'string'},
        'approved_plan_sha256': {'type': 'string'},
    }, 'required': ['step', 'lock_file'], 'additionalProperties': False},
}


def register(ctx):
    if not in_scope():
        return
    from tools import kanban_tools
    original_show = kanban_tools._handle_show
    schema = copy.deepcopy(kanban_tools.KANBAN_SHOW_SCHEMA)
    schema['parameters']['properties']['compact'] = {
        'type': 'boolean', 'default': True,
        'description': 'Return the canonical worker instructions once, without '
                       'duplicating the history arrays. Full history is preserved.'}

    def show(args, **kwargs):
        if not in_scope():
            return original_show(args, **kwargs)
        raw = original_show(args, **kwargs)
        return compact_card(raw) if args.get('compact', True) is True else raw

    ctx.register_tool('kanban_show', 'kanban', schema, show,
                      check_fn=kanban_tools._check_kanban_mode, override=True)
    ctx.register_tool('avito_rfq_step', 'gulya-avito-rfq', SCHEMA, handle,
                      check_fn=in_scope, description='Existing RFQ steps with inline screenshot')
