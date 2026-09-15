from __future__ import annotations

import concurrent.futures
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import tender_scenarios as scenarios
import server


class TenderScenarioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_patch = patch.object(scenarios, 'DB_PATH', Path(self.tmp.name) / 'scenarios.sqlite3')
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.source = {'tender_id': '12345678', 'version': 'a' * 64, 'title': 'Поставка',
                       'initial_price_kopecks': 500000, 'rows_total': 5, 'rows_priced': 1,
                       'known_market_kopecks': 10000, 'source_warning': 'Не все источники проверены'}

    def conditions(self, **updates):
        return {**{key: '0' for key in scenarios.MONEY_FIELDS}, 'revenue': '100.01', 'labour': '30.02',
                'materials': '20.01', 'scope_confirmed': True, 'tax_basis_confirmed': True,
                'basis_note': 'Полный состав проверен по документам, цены уточнены вручную', **updates}

    def payload(self, **updates):
        return {'scenario': 'base', 'expected_version': 0, 'operation_id': uuid.uuid4().hex,
                'source_version': self.source['version'], 'conditions': self.conditions(), **updates}

    def test_money_is_exact_and_unknown_is_not_zero(self):
        result = scenarios.calculate(scenarios.normalize(self.conditions()))
        self.assertEqual(result['profit_kopecks'], 4998)
        self.assertEqual(result['margin_percent'], '49.98')
        for field in scenarios.COST_FIELDS:
            with self.subTest(field=field):
                incomplete = scenarios.calculate(scenarios.normalize(self.conditions(**{field: ''})))
                self.assertIsNone(incomplete['profit_kopecks'])
                self.assertIn(field, incomplete['missing'])
        self.assertEqual(scenarios.money('1,01'), 101)
        self.assertEqual(scenarios.money('0'), 0)
        self.assertIsNone(scenarios.money(None))

    def test_negative_profit_vat_and_reserve_are_separate(self):
        result = scenarios.calculate(scenarios.normalize(self.conditions(materials='80', reserve='10', taxes='5', output_vat='20', input_vat='8')))
        self.assertEqual(result['profit_kopecks'], -2501)
        self.assertEqual(result['revenue_gross_kopecks'], 12001)
        self.assertEqual(result['cost_gross_kopecks'], 13302)
        self.assertEqual(result['status'], 'calculated')

    def test_no_guessed_defaults_or_confirmations(self):
        result = scenarios.calculate(scenarios.normalize({}))
        self.assertIsNone(result['profit_kopecks'])
        self.assertIsNone(result['known_cost_kopecks'])
        self.assertIsNone(result['cost_gross_kopecks'])
        self.assertIn('scope_confirmed', result['missing'])
        self.assertIn('tax_basis_confirmed', result['missing'])
        self.assertEqual(scenarios.calculate(scenarios.normalize(self.conditions(revenue='0')))['missing'], ['positive_revenue'])

    def test_bad_amounts_and_unknown_fields_are_rejected(self):
        for value in [True, 1.2, 'NaN', 'Infinity', '-1', '1.001', '1e3', '9999999999999', [], {}]:
            with self.subTest(value=value), self.assertRaises(scenarios.ScenarioError):
                scenarios.money(value)
        for value in [{'profit_kopecks': 100000}, {'scope_confirmed': 'true'}, {'basis_note': []}]:
            with self.assertRaises(scenarios.ScenarioError):
                scenarios.normalize(value)

    def test_save_retry_reopen_history_and_request_business_date(self):
        payload = self.payload()
        with patch.object(scenarios, 'today_iso', return_value='2026-09-30'):
            self.assertEqual(scenarios.save('12345678', 901, payload, self.source)['saved_version'], 1)
        changed_source = {**self.source, 'version': 'b' * 64}
        # Lost response is retried as the same operation even if sources changed afterwards.
        self.assertTrue(scenarios.save('12345678', 901, payload, changed_source)['duplicate'])
        payload2 = self.payload(expected_version=1, conditions=self.conditions(materials='25'))
        with patch.object(scenarios, 'today_iso', return_value='2026-10-01'):
            scenarios.save('12345678', 902, payload2, self.source)
        reopened = scenarios.state('12345678', self.source)
        self.assertEqual(len(reopened['history']), 2)
        self.assertEqual(reopened['scenarios']['base']['actor_id'], 902)
        self.assertEqual(reopened['history'][0]['business_date'], '2026-10-01')
        self.assertEqual(reopened['history'][1]['business_date'], '2026-09-30')
        self.assertEqual(reopened['history'][1]['conditions']['materials'], 2001)
        stale = scenarios.state('12345678', changed_source)['scenarios']['base']
        self.assertIsNone(stale['result']['profit_kopecks'])
        self.assertIn('source_changed', stale['result']['missing'])

    def test_conflicts_do_not_overwrite_or_duplicate(self):
        payload = self.payload()
        scenarios.save('12345678', 901, payload, self.source)
        for change in ({'conditions': self.conditions(materials='24')}, {'scenario': 'careful'}):
            with self.assertRaisesRegex(scenarios.ScenarioError, 'operation_conflict'):
                scenarios.save('12345678', 901, {**payload, **change}, self.source)
        with self.assertRaisesRegex(scenarios.ScenarioError, 'version_conflict'):
            scenarios.save('12345678', 902, self.payload(), self.source)
        with self.assertRaisesRegex(scenarios.ScenarioError, 'source_changed'):
            scenarios.save('12345678', 901, self.payload(expected_version=1, source_version='z'), self.source)
        self.assertEqual(len(scenarios.state('12345678', self.source)['history']), 1)

    def test_simultaneous_saves_only_one_wins(self):
        scenarios.state('12345678', self.source)
        def save_once(_):
            try:
                scenarios.save('12345678', 901, self.payload(), self.source)
                return 'saved'
            except scenarios.ScenarioError as error:
                return error.code
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            self.assertCountEqual(list(pool.map(save_once, range(2))), ['saved', 'version_conflict'])

    def test_scenarios_are_independent_and_incomplete_draft_can_be_saved(self):
        scenarios.save('12345678', 901, self.payload(), self.source)
        scenarios.save('12345678', 901, self.payload(scenario='careful', conditions=self.conditions(materials='90')), self.source)
        scenarios.save('12345678', 901, self.payload(scenario='optimistic', conditions={}), self.source)
        state = scenarios.state('12345678', self.source)['scenarios']
        self.assertEqual(state['base']['result']['profit_kopecks'], 4998)
        self.assertEqual(state['careful']['result']['profit_kopecks'], -2001)
        self.assertIsNone(state['optimistic']['result']['profit_kopecks'])
        self.assertEqual([row['version'] for row in state.values()], [1, 1, 1])

    def request(self, role, method='GET', payload=None, suffix='', headers=None):
        handler = object.__new__(server.PMBIHandler)
        user = {'id': 901, 'role': role} if role else None
        handler.headers = {'Host': 'crm.example', 'X-Forwarded-Proto': 'https', **(headers or {})}
        handler.current_user = lambda: user
        handler.require_user = lambda: user
        handler.read_json = lambda maximum: payload
        responses = []
        handler.send_json = lambda status, data: responses.append((int(status), data))
        with patch.object(scenarios, 'fetch_source', return_value=self.source) as fetch:
            server.PMBIHandler.handle_api(handler, method, '/api/autobot/tenders/12345678/economics' + suffix)
            return responses, fetch.call_count

    def test_permissions_before_reading_sources_body_or_private_storage(self):
        for role in ('foreman', 'financier', 'accountant', 'worker', 'customer', 'guest'):
            for method in ('GET', 'POST'):
                with self.subTest(role=role, method=method):
                    responses, fetched = self.request(role, method, self.payload())
                    self.assertEqual(responses[0][0], 403)
                    self.assertEqual(set(responses[0][1]), {'error'})
                    self.assertEqual(fetched, 0)
        self.assertFalse(scenarios.DB_PATH.exists())
        for role in ('main_admin', 'admin', 'director'):
            self.assertEqual(self.request(role)[0][0][0], 200)

    def test_cross_site_write_is_rejected_before_sources(self):
        response, fetched = self.request('admin', 'POST', self.payload(), headers={'Origin': 'https://elsewhere.example'})
        self.assertEqual(response[0][0], 403)
        self.assertEqual(fetched, 0)

    def test_anonymous_authentication_and_source_outage(self):
        import auth
        handler = object.__new__(server.PMBIHandler)
        handler.headers = {'Host': 'crm.example'}
        handler.current_user = lambda: None
        responses = []
        handler.send_json = lambda status, data: responses.append((int(status), data))
        with patch.object(auth, 'current_user', return_value=None), patch.object(auth, 'clerk_enabled', return_value=False), patch.object(scenarios, 'fetch_source') as fetch:
            server.PMBIHandler.handle_api(handler, 'GET', '/api/autobot/tenders/12345678/economics')
            self.assertEqual(responses, [(401, {'error': 'auth_required'})])
            fetch.assert_not_called()
        self.assertFalse(scenarios.DB_PATH.exists())
        scenarios.save('12345678', 901, self.payload(), self.source)
        handler.current_user = lambda: {'id': 901, 'role': 'director'}
        handler.require_user = handler.current_user
        with patch.object(scenarios, 'fetch_source', side_effect=scenarios.ScenarioError('source_unavailable', 503)):
            server.PMBIHandler.handle_api(handler, 'GET', '/api/autobot/tenders/12345678/economics')
        result = responses[-1][1]
        self.assertEqual(result['source_error'], 'source_unavailable')
        self.assertEqual(result['scenarios']['base']['conditions']['revenue'], 10001)
        self.assertIsNone(result['scenarios']['base']['result']['profit_kopecks'])

    def test_preview_does_not_save_and_api_write_uses_real_actor(self):
        response, _ = self.request('admin', 'POST', {'conditions': self.conditions(), 'source_version': self.source['version']}, '/preview')
        self.assertEqual(response[0][1]['result']['profit_kopecks'], 4998)
        self.assertFalse(scenarios.DB_PATH.exists())
        response, _ = self.request('admin', 'POST', self.payload())
        self.assertEqual(response[0][1]['scenarios']['base']['actor_id'], 901)
        self.assertEqual(self.request('admin', 'GET', suffix='/preview')[0][0][0], 404)


if __name__ == '__main__':
    unittest.main()
