"""Render common Codex Markdown as Telegram text and UTF-16 message entities."""
import re

TELEGRAM_STYLE = (
    'Оформляй ответ для чтения с телефона в Telegram. Сначала короткий вывод, '
    'затем нужные подробности. Не используй Markdown-таблицы, строки с колонками '
    'через | и длинные сплошные абзацы. Сравнения оформляй отдельными '
    'пронумерованными блоками с пустой строкой между ними. Используй умеренно '
    'смысловые иконки: 📌 для вывода, 🏢 для компании, 💰 для цены, 📍 для региона, '
    '🔗 для источника, ⚠️ для ограничения. Название варианта и цену выделяй '
    'жирным, сайт делай кликабельным; условия давай короткими строками. '
    'Пример:\n📌 **Найдено 5 вариантов**\n\n'
    '🏢 **1. Название**\n📍 Город\n💰 **от 400 ₽/м²**\n'
    '🔗 [Открыть прайс](https://example.com)\n⚠️ Материалы оплачиваются отдельно.\n'
    'Это пример оформления, не источник фактов. Не выделяй жирным целые абзацы. '
    'Сохраняй запрошенные подробности, единицы измерения и ограничения; '
    'не сокращай смысл ради оформления. '
    'Для большого сравнения (от 4 вариантов с ценами или характеристиками) '
    'добавляй красивую PNG-карточку с ровными колонками, значками и итогом. '
    'Создай JSON в рабочей папке: title, summary, rows (массив объектов '
    'name, price, notes), footer. Все значения — фактические строки из исследования. '
    'Запусти C:/Users/UserVik/.cache/codex-runtimes/codex-primary-runtime/'
    'dependencies/python/python.exe C:/Users/UserVik/CodexWorkspace/tools/comparison_card.py '
    'путь_к_JSON путь_к_PNG. Добавь PNG через MEDIA: полный_путь в конце ответа. '
    'Если карточка не создана, сообщи об этом без заявления об отправке. '
    'В тексте оставь краткий вывод и кликабельные источники; картинка дополняет '
    'их, а не заменяет. Используй нейтральные значки, не выдавай их за логотипы компаний. ')


def table_cells(line):
    # Pipes inside inline code and escaped pipes are content, not column borders.
    cells, value, ticks, escaped = [], [], 0, False
    line = line.strip()
    if line.startswith('|'):
        line = line[1:]
    if line.endswith('|') and not line.endswith('\\|'):
        line = line[:-1]
    for char in line:
        if char == '|' and not ticks and not escaped:
            cells.append(''.join(value).strip())
            value = []
        else:
            value.append(char)
            if char == '`' and not escaped:
                ticks = 1 - ticks
        escaped = char == '\\' and not escaped
    cells.append(''.join(value).strip())
    return cells


def readable_blocks(markdown):
    lines, result, index, fence = markdown.splitlines(keepends=True), [], 0, None
    while index < len(lines):
        line = lines[index]
        marker = re.match(r'^\s*(`{3,}|~{3,})', line)
        if marker:
            if fence is None:
                fence = marker.group(1)[0]
            elif marker.group(1)[0] == fence:
                fence = None
            result.append(line)
            index += 1
            continue
        if not fence and '|' in line and index + 1 < len(lines):
            headers = table_cells(line)
            separator = table_cells(lines[index + 1])
            if len(headers) > 1 and len(headers) == len(separator) and all(
                    re.fullmatch(r':?-{3,}:?', cell) for cell in separator):
                end, rows = index + 2, []
                while end < len(lines) and '|' in lines[end] and lines[end].strip():
                    rows.append(table_cells(lines[end]))
                    end += 1
                if rows and all(len(row) == len(headers) for row in rows):
                    cards = []
                    for number, row in enumerate(rows, 1):
                        # Keep cell Markdown outside the title's bold span (not nested **).
                        fields = ['**' + str(number) + '.** ' + row[0]]
                        fields.extend('**' + label + ':** ' + (value or '—')
                                      for label, value in zip(headers[1:], row[1:]))
                        cards.append('\n'.join(fields))
                    result.append('\n' + '\n\n'.join(cards) + '\n\n')
                    index = end
                    continue
        if not fence:
            line = re.sub(r'^#{1,6}\s+(.+?)(?:\r?\n)?$', r'**\1**\n', line)
        result.append(line)
        index += 1
    return ''.join(result)


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
    text, entities = render(readable_blocks(markdown))
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
        if end < len(text):
            # Prefer a paragraph boundary, then a line or word; keep every character.
            fragment = text[start:end]
            for separator in ('\n\n', '\n', ' '):
                boundary = fragment.rfind(separator)
                if boundary >= len(fragment) // 2:
                    end = start + boundary + len(separator)
                    length = units(text[start:end])
                    break
        chunk_entities = []
        for item in entities:
            left = max(offset, item['offset'])
            right = min(offset + length, item['offset'] + item['length'])
            if left < right:
                chunk_entities.append(dict(item, offset=left - offset, length=right - left))
        yield {'text': text[start:end], 'entities': chunk_entities}
        start, offset = end, offset + length
