import importlib.util
from pathlib import Path
import unittest
from types import SimpleNamespace
import tempfile
import json

sp = importlib.util.spec_from_file_location('pilot', Path(__file__).with_name('mechanical_pilot.py'))
pilot = importlib.util.module_from_spec(sp)
sp.loader.exec_module(pilot)


class ExtractionTests(unittest.TestCase):
    def test_batch_cleanup_requires_durable_packet_and_collected_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            b=Path(directory);w=b/'mechanical-pipeline-20261009';(w/'packets').mkdir(parents=True)
            (b/'mechanical-pilot-20261009').mkdir()
            for n in [78,79]:
                raw=w/'raw'/str(n);raw.mkdir(parents=True)
                pilot.save(raw/'ai-source-1.json',{'title':f'item{n} - Google Chrome','url':f'https://shop.ru/{n}','status':'read'})
            pilot.save(w/'packets/batch-0001.json',{'items':[{'position':78},{'position':79}]})
            pilot.save(w/'raw/78/collected.json',{'position':78})
            self.assertEqual(pilot.cleanup_targets(b),{})
            self.assertEqual(pilot.cleanup_targets(b,True),{'item78':{'https://shop.ru/78'}})
    def test_block_detection_ignores_background_tabs_but_preserves_real_denials(self):
        background=[{'role':'AXRadioButton','label':'Доступ ограничен: проблема с IP'},
                    {'role':'AXMenuItem','label':'403 Forbidden'},
                    {'role':'AXHeading','label':'Бортовой камень'}]
        self.assertFalse(pilot.active_page_blocked('https://smeta.ai/item','Бортовой камень - Google Chrome',background))
        for role,label in [('AXHeading','Доступ ограничен'),('AXStaticText','403 Forbidden'),('AXCheckBox','Я не робот')]:
            self.assertTrue(pilot.active_page_blocked('https://shop.ru/item','Product',background+[{'role':role,'label':label}]))
        self.assertTrue(pilot.active_page_blocked('https://shop.ru/item','shop.ru: ошибка сети - Google Chrome',background))
        for address in ['https://shop.ru/captcha','https://shop.ru/login','https://www.google.com/sorry/index']:
            self.assertTrue(pilot.active_page_blocked(address,'Product',background))
    def test_cleanup_candidates_preserve_duplicates_pinned_and_saved_exclusions(self):
        tabs=[{'label':'ready','pinned':False},{'label':'duplicate'},{'label':'duplicate'},
              {'label':'pin','pinned':True},{'label':'form'},{'label':'unknown'}]
        targets={k:set() for k in ['ready','duplicate','pin','form']}
        self.assertEqual(pilot.cleanup_candidates(tabs,targets,['form']),[tabs[0]])
    def test_cleanup_bounded_identity_scan_keeps_explicit_full_field_checks(self):
        params={'pid':1,'window_id':2}
        self.assertEqual(pilot.cleanup_scan_args('get_window_state',params),{**params,'max_depth':12,'max_elements':3000})
        self.assertEqual(params,{'pid':1,'window_id':2})
        full={**params,'max_depth':25,'max_elements':15000}
        self.assertIs(pilot.cleanup_scan_args('get_window_state',full),full)
        self.assertIs(pilot.cleanup_scan_args('click',params),params)
        native=[{'element_index':98,'role':'AXTextArea','label':'draft','value':'unfinished'}]
        self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',pilot.with_native_field_values([],native),{'Product':{'https://shop.ru/product'}}))
    def test_tab_count_ignores_product_radios_and_unknown_popovers(self):
        window={'element_index':0,'role':'AXWindow','label':'Product - Google Chrome'}
        tab={'element_index':310,'role':'AXRadioButton','parent_index':0,'depth':2,'label':'Saved source'}
        page={'element_index':90,'role':'AXRadioButton','parent_index':7,'depth':4,'in_web_content':True,'label':'Blue'}
        self.assertEqual(pilot.native_browser_tabs([window,tab,page]),[tab])
        with self.assertRaises(RuntimeError):pilot.native_browser_tabs([{**window,'label':'Unknown popup'},tab])
        self.assertEqual(len(pilot.native_browser_tabs([window,{**tab,'pinned':True}])),1)
    def test_close_verification_waits_for_stale_strip_but_rejects_missing_proof(self):
        stale=[{'label':'owned'},{'label':'other'}];fresh=[{'label':'other'}]
        captures=iter([stale,fresh])
        self.assertEqual(pilot.verified_closed_tabs(2,'owned',lambda:next(captures)),fresh)
        for wrong in [stale,[{'label':'owned'}],[]]:
            with self.assertRaises(RuntimeError):pilot.verified_closed_tabs(2,'owned',lambda:wrong)
    def test_completed_google_query_can_close_but_next_question_draft_cannot(self):
        targets={'Search':{'query:exact'}}
        elements=[{'role':'AXTextField','label':'Поиск','value':'exact'},
                  {'role':'AXTextArea','label':'Задайте вопрос','value':'Задайте вопрос'}]
        self.assertTrue(pilot.close_is_safe('Search','https://www.google.com/search?q=exact',elements,targets))
        for value in [None,'new question draft']:
            self.assertFalse(pilot.close_is_safe('Search','https://www.google.com/search?q=exact',[elements[0],{**elements[1],'value':value}],targets))
        self.assertFalse(pilot.close_is_safe('Search','https://www.google.com/search?q=other',elements,targets))
        self.assertFalse(pilot.close_is_safe('Search','https://evilgoogle.com/search?q=exact',elements,targets))
        self.assertTrue(pilot.close_is_safe('Search','https://www.google.com/search?q=exact',[{'role':'AXTextArea','label':'Найти','value':'exact'}],targets))
        self.assertFalse(pilot.close_is_safe('Search','https://www.google.com/search?q=exact',[{'role':'AXTextArea','label':'Найти','value':'new query draft'}],targets))
    def test_notification_dismiss_only_exact_bounded_close_not_permission_choice(self):
        es=[{'role':'AXWindow','label':'Сайт www.vseinstrumenti.ru запрашивает следующее разрешение: Показ уведомлений','bounds':[121,105,320,178]},
            {'role':'AXButton','label':'Закрыть','index':2,'bounds':[401,125,24,22]},
            {'role':'AXButton','label':'Блокировать'},{'role':'AXButton','label':'Разрешить'}]
        self.assertEqual(pilot.notification_close(es),2)
        self.assertIsNone(pilot.notification_close([{**es[0],'label':'Вход'},*es[1:]]))
        self.assertIsNone(pilot.notification_close([es[0],{**es[1],'bounds':[999,125,24,22]},*es[2:]]))
        self.assertIsNone(pilot.notification_close(es+[es[1]]))
    def test_cleanup_native_values_keep_unknown_and_filled_forms_protected(self):
        targets={'Product':{'https://shop.ru/product'}}
        fields=[{'index':26,'role':'AXTextField','label':'Введите название, категорию или артикул','attributes':{}}]
        native=[{'element_index':26,'role':'AXTextField','label':fields[0]['label'],'value':fields[0]['label']}]
        safe=pilot.with_native_field_values(fields,native)
        self.assertTrue(pilot.close_is_safe('Product','https://shop.ru/product',safe,targets))
        self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',fields,targets))
        for changed in [{'value':'draft'},{'element_index':27},{'label':'Other field'}]:
            self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',pilot.with_native_field_values(fields,[{**native[0],**changed}]),targets))
        self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',[{'role':'AXTextField','label':'name','value':'name'}],targets))
    def test_cleanup_inventory_excludes_unfinished_and_blocked_positions(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);(base/'mechanical-pilot-20261009').mkdir()
            work=base/'mechanical-pipeline-20261009';(work/'packets').mkdir(parents=True)
            (work/'packets/batch-0001.review.json').write_text(json.dumps({'items':[{'position':77}]}))
            for n,status in [(77,'read'),(78,'read'),(79,'blocked_source')]:
                raw=work/'raw'/str(n);raw.mkdir(parents=True)
                (raw/'ai-source-1.json').write_text(json.dumps({'status':status,'title':'Product'+str(n)+' - Google Chrome','url':'https://shop.ru/'+str(n)}))
            self.assertEqual(pilot.cleanup_targets(base),{'Product77':{'https://shop.ru/77'}})
    def test_cleanup_only_saved_url_without_challenge_or_unfinished_form(self):
        targets={'Product':{'https://shop.ru/product'}}
        self.assertTrue(pilot.close_is_safe('Product','https://shop.ru/product',[],targets))
        self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/other',[],targets))
        self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',[{'role':'AXTextArea','label':'draft'}],targets))
        self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',[{'role':'AXHeading','label':'Access Denied'}],targets))
        for blocked in ['401 Unauthorized','ERR_CERT_AUTHORITY_INVALID','Доступ ограничен']:
            self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',[{'role':'AXHeading','label':blocked}],targets))
        self.assertFalse(pilot.close_is_safe('Product','https://shop.ru/product',[{'role':'AXTextField','label':'name','value':'John'}],targets))
        self.assertTrue(pilot.close_is_safe('Search','https://www.google.com/search?q=exact',[],{'Search':{'query:exact'}}))
        self.assertFalse(pilot.close_is_safe('Search','https://evilgoogle.com/search?q=exact',[],{'Search':{'query:exact'}}))
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
