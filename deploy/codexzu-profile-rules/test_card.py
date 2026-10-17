"""A rendered price card must be a readable PNG on the deployment host."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

@unittest.skipUnless(importlib.util.find_spec('PIL'), 'Pillow is checked in the installed Mac runtime')
class CardTests(unittest.TestCase):
 def test_card_contains_prices_without_missing_currency_glyph(self):
  from PIL import Image
  path=Path(__file__).resolve().parents[1]/'telegram-codex/comparison_card.py'
  if not path.exists():path=Path.home()/'.hermes/profiles/codexzu/workspace/tools/comparison_card.py'
  spec=importlib.util.spec_from_file_location('card',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'card.png';m.create_card({'title':'Цены','summary':'Проверка','rows':[{'name':'Материал','price':'от 400 ₽/м²','notes':'Без доставки'}],'footer':'Тест'},out)
   with Image.open(out) as im:self.assertEqual(im.format,'PNG');self.assertEqual(im.width,1600);self.assertGreater(im.height,400)
if __name__=='__main__':unittest.main()
