"""Render a factual comparison JSON as a clean PNG; run with bundled Pillow Python."""
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont


def create_card(data, output):
    rows = data['rows']
    if not isinstance(rows, list) or not 1 <= len(rows) <= 20:
        raise ValueError('Use 1–20 rows per card; split larger comparisons.')
    def value(item, key):
        result = item.get(key, '')
        if not isinstance(result, str) or len(result) > 2000:
            raise ValueError('Card fields must be strings of at most 2000 characters.')
        return result
    regular = 'C:/Windows/Fonts/segoeui.ttf'
    bold = 'C:/Windows/Fonts/segoeuib.ttf'
    font = ImageFont.truetype(regular, 28)
    strong = ImageFont.truetype(bold, 29)
    heading = ImageFont.truetype(bold, 44)
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    def wrap(text, face, width):
        lines = []
        for paragraph in text.split('\n'):
            line = ''
            for char in paragraph:
                if line and probe.textlength(line + char, font=face) > width:
                    space = line.rfind(' ')
                    if space > len(line) // 2:
                        lines.append(line[:space])
                        line = line[space + 1:]
                    else:
                        lines.append(line)
                        line = ''
                line += char
            lines.append(line)
        return lines
    title = wrap(value(data, 'title'), heading, 1440)
    summary = wrap(value(data, 'summary'), font, 1440)
    footer = wrap(value(data, 'footer'), strong, 1360)
    formatted = []
    for row in rows:
        cells = [wrap(value(row, key), face, width) for key, face, width in
                 [('name', strong, 430), ('price', strong, 240), ('notes', font, 610)]]
        formatted.append((cells, max(100, max(map(len, cells)) * 42 + 48)))
    top = 90 + len(title) * 60 + 25 + len(summary) * 42 + 55
    footer_y = top + 70 + sum(height for _, height in formatted) + 35
    height = footer_y + len(footer) * 42 + 95
    if height > 7000:
        raise ValueError('Card too tall; split rows across multiple cards.')
    canvas = Image.new('RGB', (1600, height), '#f4f7fb')
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((32, 32, 1568, height - 32), radius=28, fill='white')
    draw.rounded_rectangle((80, 80, 88, 80 + len(title) * 60), radius=4, fill='#376be6')
    def lines_at(lines, x, y, face, color, step=42):
        for line in lines:
            draw.text((x, y), line, font=face, fill=color)
            y += step
    lines_at(title, 108, 78, heading, '#182338', 60)
    lines_at(summary, 80, 105 + len(title) * 60, font, '#586579')
    draw.rounded_rectangle((70, top, 1530, top + 62), radius=12, fill='#eef3fc')
    for label, x in [('Сайт / вариант', 140), ('Цена / значение', 630), ('Что важно', 900)]:
        draw.text((x, top + 12), label, font=strong, fill='#526079')
    y = top + 70
    for number, (cells, row_height) in enumerate(formatted, 1):
        draw.ellipse((80, y + 25, 120, y + 65), fill='#e8effe')
        draw.text((100, y + 44), str(number), anchor='mm', font=font, fill='#376be6')
        for cell, x, face, color in zip(cells, (140, 630, 900), (strong, strong, font),
                                       ('#285ab8', '#182338', '#455268')):
            lines_at(cell, x, y + 24, face, color)
        y += row_height
        draw.line((80, y, 1520, y), fill='#e8edf5', width=2)
    draw.rounded_rectangle((70, footer_y - 10, 1530, height - 65), radius=14, fill='#eef3fc')
    lines_at(footer, 100, footer_y + 12, strong, '#253957')
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, 'PNG')
    return output


if __name__ == '__main__':
    source = Path(sys.argv[1])
    if source.stat().st_size > 200000:
        raise ValueError('Comparison JSON too large')
    create_card(json.loads(source.read_text(encoding='utf-8-sig')), sys.argv[2])
