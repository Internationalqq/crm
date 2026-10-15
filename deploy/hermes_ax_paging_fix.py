"""Add bounded AX capture pages without changing element identity or input guards."""
import argparse
from pathlib import Path


def replace_once(text, old, new, previous=None):
    if new in text:
        return text
    if previous is not None and text.count(previous) == 1:
        return text.replace(previous, new)
    if text.count(old) != 1:
        raise ValueError('Hermes source changed; inspect before applying AX pagination')
    return text.replace(old, new)


def apply(root, backup):
    folder = root / 'tools/computer_use'
    target = folder / 'tool.py'
    original = target.read_text(encoding='utf-8')
    updated = replace_once(original,
        'return _capture_response(cap, max_elements=_coerce_max_elements(args.get("max_elements")))',
        'return _capture_response(cap, max_elements=_coerce_max_elements(args.get("max_elements")), element_offset=args.get("element_offset", 0))')
    updated = replace_once(updated,
        'def _capture_response(cap: CaptureResult, max_elements: int = _DEFAULT_MAX_ELEMENTS) -> Any:\n    total_elements = len(cap.elements)\n    visible_elements = cap.elements[:max_elements]',
        '''def _capture_response(cap: CaptureResult, max_elements: int = _DEFAULT_MAX_ELEMENTS, element_offset: int = 0) -> Any:
    total_elements = len(cap.elements)
    try:
        element_offset = max(0, int(element_offset)) if cap.mode == "ax" else 0
    except (ValueError, TypeError, OverflowError):
        element_offset = 0
    visible_elements = cap.elements[element_offset:element_offset + max_elements]''')
    updated = replace_once(updated,
        'f"raise max_elements or pass app= to narrow)"',
        'f"read next_element_offset: non-null means another AX page, null means end; indices stay unchanged)"',
        previous='f"use capture mode=ax, element_offset={element_offset + len(visible_elements)} to read the next page; indices stay unchanged)"')
    updated = replace_once(updated,
        '"total_elements": total_elements,\n        "summary": summary,',
        '"total_elements": total_elements,\n        "element_offset": element_offset,\n        "next_element_offset": element_offset + len(visible_elements) if element_offset + len(visible_elements) < total_elements else None,\n        "summary": summary,')
    schema = folder / 'schema.py'
    old_schema = schema.read_text(encoding='utf-8')
    new_schema = replace_once(old_schema, '            "max_elements": {', '''            "element_offset": {
                "type": "integer", "minimum": 0, "default": 0,
                "description": "For action=capture, mode=ax only: read a bounded page starting at this offset. Use next_element_offset from the previous response. Each call captures fresh state; use only the returned original element indices/tokens for subsequent actions. Other capture modes and capture_after ignore this option."
            },
            "max_elements": {''')
    changes = [(target, original, updated), (schema, old_schema, new_schema)]
    for path, _, source in changes:
        compile(source, str(path), 'exec')
    backup.mkdir(parents=True, exist_ok=True)
    for path, before, after in changes:
        saved = backup / path.name
        if not saved.exists():
            saved.write_text(before, encoding='utf-8')
        stage = path.with_suffix('.ax-staged')
        stage.write_text(after, encoding='utf-8')
        stage.replace(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args()
    apply(args.root, args.backup)
    print('Bounded AX capture pages installed; input guards unchanged')
