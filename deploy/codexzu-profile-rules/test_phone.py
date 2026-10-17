import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('phone_format',Path(__file__).with_name('phone_format.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class PhoneTests(unittest.TestCase):
 def test_comparison_preserves_price_and_link(self):
  text='| Вариант | Цена |\n|---|---|\n| [Фирма](https://example.com) | от 400 ₽/м² |\n'
  out=m.readable_blocks(text);self.assertIn('[Фирма](https://example.com)',out);self.assertIn('от 400 ₽/м²',out);self.assertNotIn('|---|',out)
 def test_code_table_is_preserved(self):
  text='```text\n| a | b |\n|---|---|\n| 1 | 2 |\n```';self.assertEqual(m.readable_blocks(text),text)
 def test_malformed_table_is_preserved(self):
  text='|a|b|\n|---|---|\n|1|2|3|\n';self.assertEqual(m.readable_blocks(text),text)
 def test_regular_message_untouched(self):self.assertEqual(m.readable_blocks('Готово: 42 ₽.'),'Готово: 42 ₽.')
if __name__=='__main__':unittest.main()
