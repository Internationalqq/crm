import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('ivan', Path(__file__).with_name('ivan_pilot_session.py'))
ivan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ivan)


class SearchSpeedTests(unittest.TestCase):
    def test_search_compression_preserves_limits_model_and_source_config(self):
        config = dict(model=dict(default='gpt-6-astra', provider='openai-codex'),
                      compression=dict(enabled=True, threshold=0.5, protect_last_n=20),
                      agent=dict(max_turns=60))
        changed = ivan.search_session_config(config)
        self.assertEqual(changed['compression']['threshold'], 0.7)
        self.assertEqual(config['compression']['threshold'], 0.5)
        self.assertEqual(changed['model'], config['model'])
        self.assertEqual(changed['agent'], config['agent'])
        self.assertTrue(changed['compression']['enabled'])
        self.assertEqual(changed['compression']['protect_last_n'], 20)

    def test_public_query_semicolon(self):
        self.assertTrue(ivan.reading_text('Дай пять сайтов крепежа М20; отдельные анкерные болты М8 не подходят.'))

    def test_input_boundaries(self):
        for text in ['javascript:alert(1)', 'https://u:p@example.org',
                     'https://mail.example.org', 'query | command',
                     'query `command`', 'query\ncommand', 'x' * 1001]:
            with self.subTest(text=text):
                self.assertFalse(ivan.reading_text(text))

    def test_same_app_and_expiry_required(self):
        consent = dict(scope='volga-google-public-product-search', starts_at=1, expires_at=10)
        args = dict(app='Google Chrome', text='товар; регион')
        self.assertEqual(ivan.decide(consent, 'type', args, 5), 'approve_once')
        self.assertEqual(ivan.decide(consent, 'type', {**args, 'app': 'Firefox'}, 5), 'deny')
        self.assertEqual(ivan.decide(consent, 'type', args, 10), 'deny')

    def test_fast_input_preserves_target_and_explicit_delay(self):
        args = dict(pid=10, window_id=20, text='товар', element_token='fresh')
        self.assertEqual(ivan.chrome_pointer_args('type_text', args), {**args, 'delay_ms': 0})
        self.assertNotIn('delay_ms', args)
        self.assertEqual(ivan.chrome_pointer_args('type_text', {**args, 'delay_ms': 20})['delay_ms'], 20)
        self.assertEqual(ivan.chrome_pointer_args('set_value', args), args)


if __name__ == '__main__':
    unittest.main()
