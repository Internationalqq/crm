"""Dated tender cash assumptions; no project payments or profit mutations."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
import re

PAYMENT_KINDS = ('receipt', 'payment', 'vat_payment', 'vat_refund')


class CashFlowError(ValueError):
    pass


def _day(value):
    if value is None or value == '':
        return None
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', value):
        raise CashFlowError('bad_cash_date')
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        raise CashFlowError('bad_cash_date') from None


def _note(value):
    if not isinstance(value, str) or len(value) > 500:
        raise CashFlowError('bad_cash_note')
    return value.strip()


def normalize(value, *, money):
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) - {'opening_cash', 'confirmed', 'payments', 'securities'}:
        raise CashFlowError('bad_cash_flow')
    if type(value.get('confirmed', False)) is not bool:
        raise CashFlowError('bad_cash_confirmation')
    payments, securities = value.get('payments', []), value.get('securities', [])
    if not isinstance(payments, list) or not isinstance(securities, list) or len(payments) > 60 or len(securities) > 20:
        raise CashFlowError('cash_flow_limit')
    result = {'opening_cash': money(value.get('opening_cash')), 'confirmed': value.get('confirmed', False),
              'payments': [], 'securities': []}
    for row in payments:
        if not isinstance(row, dict) or set(row) - {'kind', 'on', 'amount', 'note'} or row.get('kind') not in PAYMENT_KINDS:
            raise CashFlowError('bad_cash_payment')
        result['payments'].append({'kind': row['kind'], 'on': _day(row.get('on')), 'amount': money(row.get('amount')),
                                   'note': _note(row.get('note', ''))})
    for row in securities:
        if not isinstance(row, dict) or set(row) - {'paid_on', 'returned_on', 'amount', 'note'}:
            raise CashFlowError('bad_cash_security')
        paid, returned = _day(row.get('paid_on')), _day(row.get('returned_on'))
        if paid and returned and returned < paid:
            raise CashFlowError('security_return_before_payment')
        result['securities'].append({'paid_on': paid, 'returned_on': returned, 'amount': money(row.get('amount')),
                                     'note': _note(row.get('note', ''))})
    return result


def calculate(schedule, *, revenue_gross, cost_gross, conditions_ready):
    result = {'status': 'not_started', 'missing': [], 'scheduled_receipts_kopecks': None,
              'scheduled_payments_kopecks': None, 'expected_receipts_kopecks': revenue_gross,
              'expected_payments_kopecks': cost_gross, 'cash_gap_kopecks': None,
              'min_balance_kopecks': None, 'closing_balance_kopecks': None,
              'first_gap_on': None, 'worst_gap_on': None, 'days': []}
    if schedule is None:
        return result
    missing = []
    if schedule['opening_cash'] is None:
        missing.append('opening_cash')
    if not schedule['confirmed']:
        missing.append('cash_confirmation')
    if not conditions_ready:
        missing.append('economic_conditions')
    if revenue_gross is None or cost_gross is None:
        missing.append('cash_vat_basis')
    payments, securities = schedule['payments'], schedule['securities']
    if any(row['amount'] is None or row['on'] is None for row in payments):
        missing.append('cash_payment_details')
    if any(row['amount'] is None or row['paid_on'] is None or row['returned_on'] is None for row in securities):
        missing.append('cash_security_details')
    receipts = sum(row['amount'] for row in payments if row['kind'] == 'receipt' and row['amount'] is not None)
    expenses = sum(row['amount'] for row in payments if row['kind'] == 'payment' and row['amount'] is not None)
    result.update(scheduled_receipts_kopecks=receipts, scheduled_payments_kopecks=expenses)
    if revenue_gross is not None and receipts != revenue_gross:
        missing.append('cash_receipts_mismatch')
    if cost_gross is not None and expenses != cost_gross:
        missing.append('cash_payments_mismatch')
    result.update(status='incomplete' if missing else 'calculated', missing=missing)
    if missing:
        return result

    ledger = defaultdict(lambda: {'receipts_kopecks': 0, 'payments_kopecks': 0,
        'vat_paid_kopecks': 0, 'vat_refunded_kopecks': 0, 'security_out_kopecks': 0, 'security_returned_kopecks': 0})
    columns = {'receipt': 'receipts_kopecks', 'payment': 'payments_kopecks',
               'vat_payment': 'vat_paid_kopecks', 'vat_refund': 'vat_refunded_kopecks'}
    for row in payments:
        ledger[row['on']][columns[row['kind']]] += row['amount']
    for row in securities:
        ledger[row['paid_on']]['security_out_kopecks'] += row['amount']
        ledger[row['returned_on']]['security_returned_kopecks'] += row['amount']
    balance = minimum = schedule['opening_cash']
    for day, row in sorted(ledger.items()):
        received = row['receipts_kopecks'] + row['vat_refunded_kopecks'] + row['security_returned_kopecks']
        paid = row['payments_kopecks'] + row['vat_paid_kopecks'] + row['security_out_kopecks']
        balance += received - paid
        if balance < minimum:
            minimum = balance
            result['worst_gap_on'] = day if balance < 0 else None
        if balance < 0 and result['first_gap_on'] is None:
            result['first_gap_on'] = day
        result['days'].append({'on': day, **row, 'in_kopecks': received, 'out_kopecks': paid, 'balance_kopecks': balance})
    result.update(cash_gap_kopecks=max(0, -minimum), min_balance_kopecks=minimum, closing_balance_kopecks=balance)
    return result
