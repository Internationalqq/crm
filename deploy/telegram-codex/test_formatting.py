import unittest
from formatting import message_chunks, readable_blocks, render, units
from streaming import LiveReply


class FormattingTests(unittest.TestCase):
    def test_screenshot_bold_and_link(self):
        text, entities = render('Бро, **оплаты сейчас нет** — [Spotify](https://support.spotify.com/us/article/where-spotify-is-available/).')
        self.assertEqual(text, 'Бро, оплаты сейчас нет — Spotify.')
        self.assertEqual(entities[0], {'type': 'bold', 'offset': 5, 'length': 17})
        self.assertEqual(entities[1]['type'], 'text_link')
        self.assertTrue(entities[1]['url'].endswith('available/'))

    def test_unicode_offsets_and_nested_italic(self):
        text, entities = render('😀 **жирный _курсив_**')
        self.assertEqual(text, '😀 жирный курсив')
        self.assertEqual(entities[0]['offset'], 3)
        self.assertEqual(entities[1], {'type': 'italic', 'offset': 10, 'length': 6})

    def test_code_is_literal_and_html_is_text(self):
        text, entities = render('`**literal**`\n```python\nx < 2\n```\n<b>plain</b>')
        self.assertEqual(text, '**literal**\nx < 2\n\n<b>plain</b>')
        self.assertEqual([e['type'] for e in entities], ['code', 'pre'])

    def test_partial_stream_and_plain_underscores(self):
        self.assertEqual(render('**ещё не закончено')[0], '**ещё не закончено')
        self.assertEqual(render('some_file_name')[0], 'some_file_name')

    def test_chunking_preserves_bold_across_boundary_and_emoji(self):
        chunks = list(message_chunks('**' + '😀' * 2000 + '**'))
        self.assertEqual(''.join(c['text'] for c in chunks), '😀' * 2000)
        self.assertEqual([units(c['text']) for c in chunks], [3500, 500])
        self.assertEqual(chunks[1]['entities'], [{'type': 'bold', 'offset': 0, 'length': 500}])

    def test_links_with_parentheses(self):
        text, entities = render('[Wiki](https://example.com/Foo_(bar))')
        self.assertEqual(text, 'Wiki')
        self.assertEqual(entities[0]['url'], 'https://example.com/Foo_(bar)')

    def test_inline_code_in_bold_does_not_create_invalid_entities(self):
        text, entities = render('**Проверь `file.py`**')
        self.assertEqual(text, 'Проверь file.py')
        self.assertEqual([e['type'] for e in entities], ['bold'])

    def test_final_edit_and_followup_chunks_are_formatted(self):
        calls = []
        live = LiveReply(lambda method, payload: calls.append((method, payload)) or {'message_id': 7}, 123)
        live.publish('**Проверяю**')
        live.finish('**' + 'я' * 3600 + '**')
        self.assertEqual([method for method, _ in calls], ['sendMessage', 'editMessageText', 'sendMessage'])
        self.assertTrue(all(payload['entities'][0]['type'] == 'bold' for _, payload in calls))
        self.assertEqual(calls[-1][1]['text'], 'я' * 100)

    def test_price_table_becomes_separate_readable_blocks_without_losing_facts(self):
        source = ('Вывод: точной цены нет.\n\n'
                  '| Подрядчик | Цена | Источник | Условия |\n'
                  '|---|---:|---|---|\n'
                  '| **ГТВ — Рыбинск** | от 400 ₽/м² | [Прайс](https://example.com) | от 1 млн ₽; материалы отдельно |\n'
                  '| Кронвест | от 490 ₽/м² | [Сайт](https://example.org) | цена за круговой рисунок не подтверждена |\n')
        chunks = list(message_chunks(source))
        text = ''.join(chunk['text'] for chunk in chunks)
        self.assertNotIn('|', text)
        self.assertIn('1. ГТВ — Рыбинск', text)
        self.assertIn('Цена: от 400 ₽/м²', text)
        self.assertIn('от 1 млн ₽; материалы отдельно', text)
        self.assertIn('\n\n2. Кронвест', text)
        self.assertIn('цена за круговой рисунок не подтверждена', text)
        self.assertEqual(sum(e['type'] == 'text_link' for c in chunks for e in c['entities']), 2)

    def test_code_table_and_malformed_table_stay_literal(self):
        source = '```text\n| A | B |\n|---|---|\n|1|2|\n```\n'
        self.assertEqual(readable_blocks(source), source)
        malformed = '| A | B |\n|---|---|\n|1|2|3|\n'
        self.assertEqual(readable_blocks(malformed), malformed)

    def test_table_inline_code_and_escaped_pipes_are_not_columns(self):
        source = '| A | B |\n|---|---|\n| `a|b` | x\\|y |\n'
        result = readable_blocks(source)
        self.assertIn('`a|b`', result)
        self.assertIn('x\\|y', result)
        self.assertNotIn('|---', result)

    def test_heading_is_bold_and_chunk_prefers_paragraph_boundary(self):
        chunks = list(message_chunks('## Вывод\n\n' + 'а' * 2000 + '\n\n' + 'б' * 2000))
        self.assertTrue(chunks[0]['text'].endswith('\n\n'))
        self.assertTrue(chunks[1]['text'].startswith('б'))
        self.assertEqual(chunks[0]['entities'][0], {'type': 'bold', 'offset': 0, 'length': 5})
        self.assertEqual(''.join(c['text'] for c in chunks), 'Вывод\n\n' + 'а' * 2000 + '\n\n' + 'б' * 2000)


if __name__ == '__main__':
    unittest.main()
