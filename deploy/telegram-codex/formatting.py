"""Render common Codex Markdown as Telegram text and UTF-16 message entities."""
import re


TOKEN = re.compile(
    r'```[^\n`]*\n(?P<pre>[\s\S]*?)```'
    r'|`(?P<code>[^`\n]+)`'
    r'|\[(?P<label>[^\]\n]+)\]\((?P<url>https?://(?:[^\s()]|\([^\s()]*\))+)\)'
    r'|\*\*(?P<bold>[\s\S]+?)\*\*'
    r'|__(?P<bold_under>[\s\S]+?)__'
    r'|~~(?P<strike>[\s\S]+?)~~'
    r'|(?<!\w)\*(?P<italic>[^*\n]+)\*(?!\w)'
    r'|(?<!\w)_(?P<italic_under>[^_\n]+)_(?!\w)')


def units(text):
    return len(text.encode('utf-16-le')) // 2


def render(text, depth=0):
    parts, entities, end, offset = [], [], 0, 0
    for match in TOKEN.finditer(text):
        plain = text[end:match.start()]
        parts.append(plain)
        offset += units(plain)
        kind = match.lastgroup
        value = match.group(kind)
        if kind == 'url':
            value = match.group('label')
            entity = {'type': 'text_link', 'url': match.group('url')}
        else:
            entity = {'type': {'bold_under': 'bold', 'italic_under': 'italic',
                               'strike': 'strikethrough'}.get(kind, kind)}
        nested = []
        if kind not in ('pre', 'code') and depth < 10:
            value, nested = render(value, depth + 1)
            # Telegram disallows nesting code/pre inside other formatting entities.
            nested = [item for item in nested if item['type'] not in ('pre', 'code')
                      and not (kind == 'url' and item['type'] == 'text_link')]
        length = units(value)
        if length:
            entities.append(dict(entity, offset=offset, length=length))
            entities.extend(dict(item, offset=item['offset'] + offset) for item in nested)
        parts.append(value)
        offset += length
        end = match.end()
    parts.append(text[end:])
    return ''.join(parts), entities


def message_chunks(markdown, limit=3500):
    text, entities = render(markdown)
    # Split rendered text, so a formatting span can cross a message boundary.
    start, offset = 0, 0
    while start < len(text):
        end, length = start, 0
        while end < len(text):
            width = units(text[end])
            if length + width > limit:
                break
            length += width
            end += 1
        chunk_entities = []
        for item in entities:
            left = max(offset, item['offset'])
            right = min(offset + length, item['offset'] + item['length'])
            if left < right:
                chunk_entities.append(dict(item, offset=left - offset, length=right - left))
        yield {'text': text[start:end], 'entities': chunk_entities}
        start, offset = end, offset + length
