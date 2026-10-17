"""Phone-readable Markdown blocks, reused from the original CodexZu formatter."""
import re

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
