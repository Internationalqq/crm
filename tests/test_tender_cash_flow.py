from __future__ import annotations

import copy
import unittest

import test_tender_scenarios as fixtures
from tender_scenarios import ScenarioError
import tender_scenarios as scenarios


class TenderCashFlowTests(unittest.TestCase):
    setUp = fixtures.TenderScenarioTests.setUp
    conditions = fixtures.TenderScenarioTests.conditions
    payload = fixtures.TenderScenarioTests.payload
    request = fixtures.TenderScenarioTests.request

    def schedule(self, **updates):
        return {'opening_cash': '20.01', 'confirmed': True, 'payments': [
            {'kind': 'receipt', 'on': '2026-10-01', 'amount': '30.01', 'note': 'Аванс'},
            {'kind': 'payment', 'on': '2026-10-05', 'amount': '50.03', 'note': 'Исполнение'},
            {'kind': 'receipt', 'on': '2026-10-20', 'amount': '70', 'note': 'Окончательный расчёт'}],
            'securities': [], **updates}

    def result(self, schedule, **updates):
        return scenarios.calculate(scenarios.normalize(self.conditions(cash_flow=schedule, **updates)))

    def test_one_kopeck_cash_gap_with_profitable_tender(self):
        result = self.result(self.schedule())
        cash = result['cash_flow']
        self.assertEqual(result['profit_kopecks'], 4998)
        self.assertEqual(cash['status'], 'calculated')
        self.assertEqual(cash['cash_gap_kopecks'], 1)
        self.assertEqual(cash['min_balance_kopecks'], -1)
        self.assertEqual(cash['first_gap_on'], '2026-10-05')
        self.assertEqual(cash['worst_gap_on'], '2026-10-05')
        self.assertEqual(cash['closing_balance_kopecks'], 6999)
        self.assertEqual([row['balance_kopecks'] for row in cash['days']], [5002, -1, 6999])

    def test_security_affects_cash_and_returns_without_changing_profit(self):
        schedule = self.schedule(securities=[{'amount': '10', 'paid_on': '2026-09-30',
                                              'returned_on': '2026-10-30', 'note': 'Обеспечение'}])
        result = self.result(schedule)
        self.assertEqual(result['profit_kopecks'], 4998)
        self.assertEqual(result['cash_flow']['cash_gap_kopecks'], 1001)
        self.assertEqual(result['cash_flow']['closing_balance_kopecks'], 6999)
        days = result['cash_flow']['days']
        self.assertEqual(days[0]['security_out_kopecks'], 1000)
        self.assertEqual(days[-1]['security_returned_kopecks'], 1000)
        # Commission is an ordinary expense and is not added to the security.
        schedule['payments'][1]['amount'] = '52.03'
        with_fee = self.result(schedule, fees='2')
        self.assertEqual(with_fee['profit_kopecks'], 4798)
        self.assertEqual(with_fee['cash_flow']['cash_gap_kopecks'], 1201)
        self.assertEqual(with_fee['cash_flow']['closing_balance_kopecks'], 6799)

    def test_vat_cash_settlement_is_separate_from_net_profit_and_gross_cost(self):
        schedule = self.schedule()
        schedule['payments'][1]['amount'] = '58.03'
        schedule['payments'][2]['amount'] = '90'
        schedule['payments'].append({'kind': 'vat_payment', 'on': '2026-10-25', 'amount': '12'})
        result = self.result(schedule, output_vat='20', input_vat='8')
        self.assertEqual(result['profit_kopecks'], 4998)
        self.assertEqual(result['cash_flow']['scheduled_payments_kopecks'], 5803)
        self.assertEqual(result['cash_flow']['closing_balance_kopecks'], 6999)
        self.assertEqual(result['cash_flow']['days'][-1]['vat_paid_kopecks'], 1200)
        schedule['payments'].append({'kind': 'vat_refund', 'on': '2026-10-30', 'amount': '1.01'})
        self.assertEqual(self.result(schedule, output_vat='20', input_vat='8')['cash_flow']['closing_balance_kopecks'], 7100)

    def test_missing_or_changed_input_never_produces_ready_cash_gap(self):
        cases = [({'opening_cash': ''}, 'opening_cash'), ({'confirmed': False}, 'cash_confirmation'),
                 ({'payments': [{'kind': 'receipt', 'amount': '100.01'}]}, 'cash_payment_details'),
                 ({'securities': [{'amount': '10', 'paid_on': '2026-10-01'}]}, 'cash_security_details'),
                 ({'payments': []}, 'cash_receipts_mismatch')]
        for updates, missing in cases:
            with self.subTest(missing=missing):
                result = self.result(self.schedule(**updates))
                self.assertEqual(result['profit_kopecks'], 4998)
                self.assertIsNone(result['cash_flow']['cash_gap_kopecks'])
                self.assertIn(missing, result['cash_flow']['missing'])
                self.assertEqual(result['cash_flow']['days'], [])
        self.assertIn('cash_vat_basis', self.result(self.schedule(), input_vat='')['cash_flow']['missing'])
        self.assertIn('cash_payments_mismatch', self.result(self.schedule(), materials='21')['cash_flow']['missing'])
        normalized = scenarios.normalize(self.conditions(cash_flow=self.schedule()))
        self.assertIn('economic_conditions', scenarios.calculate(normalized, source_current=False)['cash_flow']['missing'])

    def test_same_day_is_aggregated_independently_of_input_order(self):
        schedule = self.schedule(opening_cash='0', securities=[{'amount': '10', 'paid_on': '2026-10-01', 'returned_on': '2026-10-01'}])
        for row in schedule['payments']:
            row['on'] = '2026-10-01'
        cash = self.result(schedule)['cash_flow']
        self.assertEqual(cash['cash_gap_kopecks'], 0)
        self.assertIsNone(cash['first_gap_on'])
        self.assertEqual(len(cash['days']), 1)
        self.assertEqual(cash['closing_balance_kopecks'], 4998)
        schedule['payments'].reverse()
        self.assertEqual(self.result(schedule)['cash_flow'], cash)

    def test_invalid_rows_and_dates_are_rejected_without_guessing(self):
        bad = [{'confirmed': 'true'}, {'opening_cash': -1}, {'balance': '1'}, {'payments': {}},
               {'payments': [{'kind': 'profit', 'on': '2026-10-01', 'amount': '100'}]},
               {'payments': [{'kind': 'receipt', 'on': '2026-02-29'}]},
               {'payments': [{'kind': 'receipt', 'on': '01.10.2026'}]},
               {'payments': [{'kind': 'receipt', 'note': '<script>' * 100}]},
               {'payments': [{'kind': 'receipt', 'amount': '1.001'}]},
               {'payments': [{'kind': 'receipt'}] * 61},
               {'securities': [{'amount': '10', 'paid_on': '2026-11-01', 'returned_on': '2026-10-01'}]},
               {'securities': [{'amount': '1', 'profit': '1'}]}, {'securities': [{}] * 21}]
        for updates in bad:
            with self.subTest(updates=updates), self.assertRaises(ScenarioError):
                self.result(self.schedule(**updates))
        result = self.result({})
        self.assertIsNone(result['cash_flow']['cash_gap_kopecks'])
        self.assertIn('opening_cash', result['cash_flow']['missing'])

    def test_legacy_conditions_and_clients_keep_existing_schedule_and_history(self):
        legacy = self.conditions()
        self.assertNotIn('cash_flow', scenarios.normalize(legacy))
        self.assertEqual(scenarios.calculate(scenarios.normalize(legacy))['cash_flow']['status'], 'not_started')
        payload = self.payload(conditions=self.conditions(cash_flow=self.schedule()))
        before = copy.deepcopy(payload)
        scenarios.save('12345678', 901, payload, self.source)
        self.assertEqual(payload, before)
        self.assertTrue(scenarios.save('12345678', 901, payload, self.source)['duplicate'])
        scenarios.save('12345678', 901, self.payload(expected_version=1), self.source)
        current = scenarios.state('12345678', self.source)
        self.assertEqual(current['scenarios']['base']['conditions']['cash_flow']['opening_cash'], 2001)
        self.assertEqual(current['scenarios']['base']['result']['cash_flow']['cash_gap_kopecks'], 1)
        clear = self.payload(expected_version=2, conditions=self.conditions(cash_flow=None))
        scenarios.save('12345678', 901, clear, self.source)
        current = scenarios.state('12345678', self.source)
        self.assertEqual(len(current['history']), 3)
        self.assertIsNone(current['scenarios']['base']['conditions']['cash_flow'])
        self.assertEqual(current['history'][1]['conditions']['cash_flow']['opening_cash'], 2001)

    def test_cash_flow_version_conflict_and_private_api(self):
        payload = self.payload(conditions=self.conditions(cash_flow=self.schedule()))
        responses, _ = self.request('director', 'POST', payload)
        self.assertEqual(responses[0][0], 200)
        self.assertEqual(responses[0][1]['scenarios']['base']['result']['cash_flow']['cash_gap_kopecks'], 1)
        other = self.payload(conditions=self.conditions(cash_flow=self.schedule(opening_cash='100')))
        responses, _ = self.request('admin', 'POST', other)
        self.assertEqual(responses[0][0], 409)
        for role in ('foreman', 'financier', 'accountant', 'worker', 'guest'):
            responses, fetched = self.request(role)
            self.assertEqual(responses[0], (403, {'error': 'guest_forbidden' if role == 'guest' else 'economics_forbidden'}))
            self.assertEqual(fetched, 0)
        self.assertEqual(scenarios.state('12345678', self.source)['scenarios']['base']['version'], 1)

    def test_legacy_budget_or_source_change_requires_cash_reconfirmation(self):
        scenarios.save('12345678', 901, self.payload(conditions=self.conditions(cash_flow=self.schedule())), self.source)
        # Same total, different composition: matching totals cannot validate the dates.
        scenarios.save('12345678', 901, self.payload(expected_version=1,
            conditions=self.conditions(materials='21.01', labour='29.02')), self.source)
        current = scenarios.state('12345678', self.source)
        self.assertEqual(current['scenarios']['base']['result']['profit_kopecks'], 4998)
        self.assertIn('cash_confirmation', current['scenarios']['base']['result']['cash_flow']['missing'])
        self.assertTrue(current['history'][1]['conditions']['cash_flow']['confirmed'])
        scenarios.save('12345678', 901, self.payload(expected_version=2,
            conditions=self.conditions(cash_flow=self.schedule())), self.source)
        source = {**self.source, 'version': 'changed-source'}
        scenarios.save('12345678', 901, self.payload(expected_version=3, source_version=source['version']), source)
        self.assertIn('cash_confirmation', scenarios.state('12345678', source)['scenarios']['base']['result']['cash_flow']['missing'])


if __name__ == '__main__':
    unittest.main()
