"""Apply only the documented residual of the cumulative 397 list."""
import csv
from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('recovery', HERE / 'backfill_karabash_20261015.py')
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)


def main():
    path = HERE / 'karabash397_20261015.csv'
    rows = list(csv.DictReader(path.open(encoding='utf-8'), delimiter=';'))
    assert len(rows) == 55 and [int(x['row']) for x in rows] == list(range(1, 56))
    total = sum(Decimal(x['quantity']) * Decimal(x['price_rub']) for x in rows)
    assert total == Decimal('37413'), 'source_sum_mismatch'
    events = {x['id']: r.field.api('/' + str(x['id']))['item'] for x in [{'id': 7}, {'id': 11}, {'id': 2}]}
    assert all(x['status'] == 'applied' and x['project_id'] == 10 for x in events.values())
    assert len(events[7]['data']['lines']) == 4
    assert events[11]['data']['lines'][0]['qty'] == '50'
    assert '125' in events[11]['data']['lines'][0]['title']
    assert '34111' in events[11]['data']['lines'][1]['title'] and events[11]['data']['lines'][1]['qty'] == '3'
    excluded = {2: (7, '1'), 3: (7, '1'), 4: (7, '3'), 5: (7, '1'),
                26: (11, '10'), 44: (11, '10'), 37: (11, '1')}
    # Six earlier Luga discs may be included in the unbranded cumulative20.
    # Do not manufacture their identity or count them twice; the other14 are a lower bound.
    held = {8: Decimal(6)}
    lines = []; mapping = []
    for row in rows:
        n = int(row['row']); quantity = Decimal(row['quantity'])
        prior = Decimal(excluded[n][1]) if n in excluded else Decimal(0)
        uncertain = held.get(n, Decimal(0)); residual = quantity - prior - uncertain
        assert residual >= 0
        if residual:
            lines.append(r.line(row['title'], format(residual, 'f'), row['unit'], row['item_type']))
        mapping.append(dict(row, already_recorded=str(prior), existing_event_id=excluded[n][0] if n in excluded else None,
                            held_uncertain=str(uncertain), residual=str(residual)))
    assert len(lines) == 48
    residual_value = sum(Decimal(x['residual']) * Decimal(x['price_rub']) for x in mapping)
    assert residual_value == Decimal('33611')
    plan = {'document': '397', 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'document_sum_rub': str(total), 'residual_document_value_rub': str(residual_value),
            'note': 'Document comparison only; no financial/payment posting and no invented receipt prices.', 'rows': mapping}
    (r.WORK / '397-line-reconciliation.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2))
    event = {'event_key': 'receipt-397-residual', 'kind': 'receipt', 'project_id': 10, 'location': 'project',
             'title': 'Карабаш — неучтённый остаток накопительного списка №397 от 12.10; подтверждён 15.10.2026',
             'event_date': '2026-10-15', 'data': {'fact_quote': 'Все получили в карабаш',
              'lines': lines, 'questions': [], 'delivery_status': 'complete'}}
    applied = r.post(r.GROUP + ':137', event, [r.GROUP + ':132'])
    question = '6 кругов 125×1,2×22: в приходе №2 уже есть 6 Луга; в накопительном списке №397 марка не указана. Из общего количества20 проведён только достоверный остаток14. Для оставшихся6 нужно установить, включены ли в список ранее принятые Луга. Не приходовать повторно без сверки.'
    pending = {'event_key': 'receipt-397-disc-identity', 'kind': 'receipt', 'project_id': 10, 'location': 'project',
               'title': 'Карабаш — №397: 6 кругов требуют сопоставления с приходом №2',
               'event_date': '2026-10-15', 'data': {'fact_quote': 'Все получили в карабаш',
                'lines': [r.line('Круг отрезной 125×1,2×22, марка в списке397 не указана', 6)], 'questions': [question]}}
    draft = r.post(r.GROUP + ':137', pending, [r.GROUP + ':132'], apply=False)
    (r.WORK / '397-result.json').write_text(json.dumps({'applied': applied, 'held': draft}, ensure_ascii=False, indent=2))
    print(json.dumps({'applied': applied['id'], 'lines': len(applied['data']['lines']), 'held': draft['id'],
                      'document_total': str(total), 'residual_value': str(residual_value), 'excluded_rows': len(excluded)}))


if __name__ == '__main__':
    main()
