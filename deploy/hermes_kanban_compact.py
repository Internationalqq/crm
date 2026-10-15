"""Bounded Kanban worker view; complete history remains explicitly available."""


def compact_view(task, comments, runs, parents, children):
    def cap(value, limit=1600):
        text = str(value or '')
        return text if len(text) <= limit else text[:limit] + ' [truncated; full view: compact=false]'

    return {
        'task': {k: getattr(task, k, None) for k in
                 ('id', 'title', 'assignee', 'status', 'workspace_path', 'current_run_id')},
        'body': task.body,
        'parents': parents, 'children': children,
        'comments': [{'author': c.author, 'body': cap(c.body, 2400)} for c in comments[-2:]],
        'latest_run': ([{'id': runs[-1].id, 'status': runs[-1].status,
                         'summary': cap(runs[-1].summary), 'error': cap(runs[-1].error)}]
                       if runs else []),
        'history_counts': {'comments': len(comments), 'runs': len(runs)},
        'instruction': 'Compact view. Read current TASK.md and checkpoint in workspace. '
                       'Use compact=false only when older history is needed; history is preserved.',
    }


def patch_source(source):
    marker = '            def _task_dict(t):'
    insertion = '''            # Research workers need current state, not a duplicated full history.
            compact = args.get("compact", os.environ.get("HERMES_KANBAN_TASK") == "t_fb6e836e")
            if compact:
                from tools.kanban_compact_policy import compact_view
                return json.dumps(compact_view(task, comments, runs, parents, children), ensure_ascii=False)

'''
    if 'from tools.kanban_compact_policy import compact_view' not in source:
        assert source.count(marker) == 1
        source = source.replace(marker, insertion + marker)
        start = source.index('KANBAN_SHOW_SCHEMA =')
        end = source.index('KANBAN_LIST_SCHEMA =', start)
        section = source[start:end]
        needle = '            "board": _board_schema_prop(),'
        assert section.count(needle) == 1
        section = section.replace(needle, needle + '''
            "compact": {
                "type": "boolean",
                "description": "Bounded history, preserving full assignment. Default true only for Ivan tender task t_fb6e836e. False returns preserved full history.",
            },''')
        source = source[:start] + section + source[end:]
    return source
