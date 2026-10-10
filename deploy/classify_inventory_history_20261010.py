"""Bounded, audited legacy type repair; see PROJECT_INVENTORY_BACKFILL_2026-10-10.md."""
import argparse
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import time

TARGETS = {
    2: [(9, 'Плоскогубцы 105 мм МИНИ FIT 51125', '2', 'шт'),
        (10, 'Крюк для вязки арматуры 245 мм СИБРТЕХ 84873', '1', 'шт')],
    3: [(4, 'Молоток слесарный 200 г, квадратный боек, деревянная ручка Победит 2535220', '1', 'шт')],
}


def repair(con, actor):
    con.row_factory = sqlite3.Row
    changes = []
    # Check every target before the first update.
    for ident, targets in TARGETS.items():
        row = con.execute('SELECT * FROM field_events WHERE id=?', (ident,)).fetchone()
        assert row and (row['project_id'], row['status'], row['kind'], row['location']) == (10, 'applied', 'receipt', 'project'), 'unexpected_event'
        data = json.loads(row['data_json'])
        changed = []
        for index, title, qty, unit in targets:
            line = data['lines'][index]
            assert (line['title'], line['qty'], line['unit']) == (title, qty, unit), 'unexpected_line'
            assert not line.get('estimate_item_id'), 'estimated_line_requires_different_plan'
            assert line.get('item_type', 'material') in ('material', 'tool'), 'unexpected_type'
            if line.get('item_type') != 'tool':
                line['item_type'] = 'tool'
                changed.append(index)
        if changed:
            changes.append((row, data, changed))
    for row, data, indexes in changes:
        con.execute('UPDATE field_events SET data_json=?,revision=revision+1,updated_at=? WHERE id=?',
                    (json.dumps(data, ensure_ascii=False, sort_keys=True), int(time.time()), row['id']))
        evidence = {'plan': 'PROJECT_INVENTORY_BACKFILL_2026-10-10.md', 'line_indexes': indexes,
                    'before_data_json': row['data_json'], 'after_data_json': data}
        con.execute('INSERT INTO audit_log(user_id,action,entity,entity_id,payload,created_at) VALUES(?,?,?,?,?,?)',
                    (actor, 'classify_legacy_inventory', 'field_event', row['id'], json.dumps(evidence, ensure_ascii=False), int(time.time())))
    return len(changes)


def invariants(con):
    return {table: con.execute('SELECT * FROM '+table+' ORDER BY id').fetchall()
            for table in ('stock_moves', 'warehouse_items', 'finance_entries', 'estimate_items')}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', required=True)
    parser.add_argument('--actor', type=int, required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup')
    parser.add_argument('--backend', default=str(Path(__file__).resolve().parent.parent/'backend'))
    args = parser.parse_args()
    with sqlite3.connect('file:'+str(Path(args.db).resolve())+'?mode=ro', uri=True) as src:
        assert src.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert not src.execute('PRAGMA foreign_key_check').fetchall()
        with tempfile.TemporaryDirectory(prefix='crm-inventory-classification-') as tmp:
            proof = Path(tmp)/'proof.sqlite3'
            with sqlite3.connect(proof) as con:
                src.backup(con)
                before = invariants(con)
                con.execute('BEGIN IMMEDIATE')
                first = repair(con, args.actor)
                con.commit()
                con.row_factory = None
                assert invariants(con) == before, 'protected_tables_changed'
                con.execute('BEGIN IMMEDIATE')
                assert repair(con, args.actor) == 0, 'repeat_not_idempotent'
                con.commit()
            with sqlite3.connect(proof) as con:
                assert con.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
                assert not con.execute('PRAGMA foreign_key_check').fetchall()
                for ident, targets in TARGETS.items():
                    data = json.loads(con.execute('SELECT data_json FROM field_events WHERE id=?', (ident,)).fetchone()[0])
                    assert all(data['lines'][index]['item_type'] == 'tool' for index, *_ in targets)
                sys.path.insert(0, args.backend)
                import field_intake
                con.row_factory = sqlite3.Row
                inventory = field_intake.project_inventory(con, 10)
                balances = field_intake.balances(con, [10])
                for targets in TARGETS.values():
                    for _, title, qty, unit in targets:
                        rows = [r for r in inventory if r['title'] == title]
                        assert len(rows) == 1 and (rows[0]['itemKind'], rows[0]['quantity'], rows[0]['status']) == ('tool', float(qty), 'on_site'), 'inventory_type_not_corrected'
                        rows = [r for r in balances if r['name'] == title and r['project_id'] == 10]
                        assert len(rows) == 1 and (rows[0]['item_type'], rows[0]['qty']) == ('tool', float(qty)), 'balance_type_not_corrected'
        if args.apply:
            assert args.backup, 'backup_required'
            backup = Path(args.backup)
            assert not backup.exists(), 'backup_already_exists'
            with sqlite3.connect(backup) as dst:
                src.backup(dst)
    actual = None
    if args.apply:
        with sqlite3.connect(args.db) as con:
            con.execute('PRAGMA foreign_keys=ON')
            con.execute('BEGIN IMMEDIATE')
            actual = repair(con, args.actor)
            con.commit()
    print(json.dumps({'copy_verification': 'PASS', 'repeat_and_reopen': 'PASS', 'events_to_change': first,
                      'applied_events': actual, 'protected_tables': 'unchanged'}))


if __name__ == '__main__':
    main()
