import importlib.util
from pathlib import Path
import unittest
from types import SimpleNamespace

sp = importlib.util.spec_from_file_location('pilot', Path(__file__).with_name('mechanical_pilot.py'))
pilot = importlib.util.module_from_spec(sp)
sp.loader.exec_module(pilot)


class ExtractionTests(unittest.TestCase):
    def test_only_proven_translation_popup_close_is_selected(self):
        elements=[{'role':'AXWindow','label':'Перевести эту страницу?','bounds':[100,100,340,87]},
                  {'role':'AXButton','label':'Параметры перевода'},
                  {'role':'AXRadioButton','label':'английский'},
                  {'role':'AXRadioButton','label':'русский'},
                  {'role':'AXButton','label':'Закрыть','index':4,'bounds':[390,112,28,32]}]
        self.assertEqual(pilot.translation_close(elements),4)
        self.assertIsNone(pilot.translation_close([{**elements[0],'label':'Войти'},*elements[1:]]))
        self.assertIsNone(pilot.translation_close(elements+[elements[-1]]))
        self.assertIsNone(pilot.translation_close([*elements[:-1],{**elements[-1],'bounds':[900,112,28,32]}]))
    def test_navigation_timeout_is_bounded_and_success_returns_fresh_capture(self):
        now=[0];calls=[]
        def sleep(seconds):now[0]+=seconds
        def capture():
            calls.append(now[0]);return SimpleNamespace(window_title='query - Google'),['fresh']
        self.assertIsNone(pilot.wait_source_navigation(capture,'query',1,lambda:now[0],sleep))
        self.assertEqual(calls,[0,.5,1])
        result=pilot.wait_source_navigation(lambda:(SimpleNamespace(window_title='Product'),['product']),'query',1,lambda:now[0],sleep)
        self.assertEqual(result[1],['product'])
    def test_native_title_preserves_quotes_without_accepting_multiple_windows(self):
        title='ATEN 17" console - Google Chrome'
        self.assertEqual(pilot.captured_title('ATEN 17',[{'role':'AXWindow','label':title}]),title)
        self.assertEqual(pilot.captured_title('fallback',[{'role':'AXWindow','label':'a'},{'role':'AXWindow','label':'b'}]),'fallback')
    def test_mirrored_visible_link_is_one_target_but_distinct_links_are_ambiguous(self):
        a={'role':'AXLink','label':'Перейти 1','bounds':[10,20,50,40],'index':1}
        self.assertEqual(pilot.observed_link([a,{**a,'index':2}],'Перейти 1')['index'],1)
        with self.assertRaises(RuntimeError):
            pilot.observed_link([a,{**a,'bounds':[90,20,50,40]}],'Перейти 1')
        with self.assertRaises(RuntimeError):
            pilot.observed_link([{**a,'bounds':[0,0,0,0]}]*2,'Перейти 1')
    def parse(self, *labels):
        return pilot.extract([{'role': 'AXStaticText', 'label': x} for x in labels])['candidates']

    def test_money_and_explicit_unit(self):
        z = self.parse('Арт. БОН-19-1-24-В', '2 400 руб.', 'Цена указана за шт.')
        self.assertEqual(z[0]['price_rub'], 2400)
        self.assertEqual(z[0]['unit'], 'шт')
        self.assertIn('БОН-19-1-24-В', z[0]['context'])

    def test_missing_price_is_not_zero(self):
        self.assertEqual(self.parse('Уточняйте цену', 'Артикул 2400', '0 ₽'), [])

    def test_does_not_infer_unit_or_accept_match(self):
        z = self.parse('Другая модель', '36 655 ₽')
        self.assertIsNone(z[0]['unit'])
        self.assertEqual(z[0]['status'], 'unreviewed_candidate')

    def test_multiple_prices_remain_candidates(self):
        self.assertEqual([x['price_rub'] for x in self.parse('Было 4 000 ₽', 'Сейчас 3 000,50 ₽')], [4000, 3000.5])

    def test_split_currency_is_paired_before_deduplication(self):
        self.assertEqual([x['price_rub'] for x in self.parse('112 190','₽','Другой товар','15 990','₽')], [112190,15990])

    def test_delivery_and_historical_prices_are_flagged(self):
        self.assertIn('delivery_or_delivery_threshold',self.parse('Доставка в ваш город','от 590 руб.')[0]['flags'])
        self.assertIn('historical_price',self.parse('Снят с поставок, последняя цена','4 914 ₽')[0]['flags'])

    def test_search_snippet_is_not_a_primary_source(self):
        self.assertFalse(pilot.primary_url('https://www.google.com/search?q=thing'))
        self.assertFalse(pilot.primary_url('https://user:pass@shop.ru/item'))
        self.assertFalse(pilot.primary_url('http://shop.ru/item'))
        self.assertTrue(pilot.primary_url('https://shop.ru/item'))


if __name__ == '__main__':unittest.main()
