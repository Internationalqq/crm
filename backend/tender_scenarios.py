"""Tender participation assumptions; separate from approved project economics."""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

from auth import user_can_view_project_economics
from business_time import today_iso
from sqlite_config import connect_database

DB_PATH = Path(__file__).resolve().parents[1] / 'data' / 'tender_scenarios.sqlite3'
SCENARIOS = ('base', 'careful', 'optimistic')
COST_FIELDS = ('materials', 'labour', 'equipment', 'delivery', 'overhead', 'fees', 'financing', 'reserve', 'taxes')
MONEY_FIELDS = ('revenue', *COST_FIELDS, 'output_vat', 'input_vat')
MAX_KOPECKS = 100_000_000_000_000
ROUTE = re.compile(r'/api/autobot/tenders/([0-9]{8,25})/economics(?:/(preview))?')


class ScenarioError(ValueError):
    def __init__(self, code, status=400):
        self.code, self.status = code, status
        super().__init__(code)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def money(value):
    """UI sends decimal ruble strings; never round a binary-float calculation."""
    if value is None or value == '':
        return None
    if not isinstance(value, str) or not re.fullmatch(r'\d{1,13}(?:[.,]\d{1,2})?', value.strip()):
        raise ScenarioError('bad_money')
    try:
        result = int((Decimal(value.strip().replace(',', '.')) * 100).to_integral_exact())
    except (InvalidOperation, ValueError):
        raise ScenarioError('bad_money') from None
    if result > MAX_KOPECKS:
        raise ScenarioError('money_limit')
    return result


def normalize(payload):
    allowed = {*MONEY_FIELDS, 'scope_confirmed', 'tax_basis_confirmed', 'basis_note'}
    if not isinstance(payload, dict) or set(payload) - allowed:
        raise ScenarioError('unknown_condition')
    result = {key: money(payload.get(key)) for key in MONEY_FIELDS}
    for key in ('scope_confirmed', 'tax_basis_confirmed'):
        if type(payload.get(key, False)) is not bool:
            raise ScenarioError('bad_confirmation')
        result[key] = payload.get(key, False)
    note = payload.get('basis_note', '')
    if not isinstance(note, str) or len(note) > 4000:
        raise ScenarioError('bad_basis_note')
    result['basis_note'] = note.strip()
    return result


def calculate(conditions, *, source_current=True):
    missing = [key for key in ('revenue', *COST_FIELDS) if conditions[key] is None]
    if conditions['revenue'] == 0:
        missing.append('positive_revenue')
    for key in ('scope_confirmed', 'tax_basis_confirmed', 'basis_note'):
        if not conditions[key]:
            missing.append(key)
    if not source_current:
        missing.append('source_changed')
    amounts = [conditions[key] for key in COST_FIELDS if conditions[key] is not None]
    known = sum(amounts)
    result = {'status': 'incomplete' if missing else 'calculated', 'missing': missing,
              'known_cost_kopecks': known if amounts else None, 'profit_kopecks': None, 'margin_percent': None,
              'revenue_gross_kopecks': None, 'cost_gross_kopecks': None}
    if not missing:
        profit = conditions['revenue'] - known
        result.update(profit_kopecks=profit, margin_percent=str(
            (Decimal(profit) * 100 / conditions['revenue']).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)))
    if conditions['revenue'] is not None and conditions['output_vat'] is not None:
        result['revenue_gross_kopecks'] = conditions['revenue'] + conditions['output_vat']
    if all(conditions[key] is not None for key in COST_FIELDS) and conditions['input_vat'] is not None:
        result['cost_gross_kopecks'] = known + conditions['input_vat']
    return result


def database():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = connect_database(DB_PATH)
    con.execute('''CREATE TABLE IF NOT EXISTS tender_scenario_versions (
        tender_id TEXT NOT NULL, scenario TEXT NOT NULL, version INTEGER NOT NULL,
        operation_id TEXT NOT NULL UNIQUE, digest TEXT NOT NULL, actor_id INTEGER NOT NULL,
        business_date TEXT NOT NULL, created_at INTEGER NOT NULL,
        conditions_json TEXT NOT NULL, source_json TEXT NOT NULL,
        PRIMARY KEY(tender_id, scenario, version))''')
    return con


def fetch_source(base_url, tender_id):
    if not base_url:
        raise ScenarioError('source_unavailable', 503)
    request = urllib.request.Request(base_url.rstrip('/') + '/api/tenders/' + tender_id + '/economics-source',
                                     headers={'Accept': 'application/json'}, method='GET')
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(200_001)
            if len(raw) > 200_000:
                raise ValueError('too large')
            source = json.loads(raw)
        if not isinstance(source, dict) or source.get('tender_id') != tender_id or not re.fullmatch(r'[a-f0-9]{64}', str(source.get('version', ''))):
            raise ValueError('bad source')
        # Only defined context fields can enter the economic response/history.
        return {key: source.get(key) for key in ('tender_id', 'version', 'title', 'initial_price_kopecks',
                'rows_total', 'rows_priced', 'known_market_kopecks', 'source_warning')}
    except urllib.error.HTTPError as error:
        raise ScenarioError('tender_not_found' if error.code == 404 else 'source_unavailable',
                            404 if error.code == 404 else 503) from None
    except (OSError, ValueError, TimeoutError):
        raise ScenarioError('source_unavailable', 503) from None


def serialize(row, source):
    conditions, snapshot = json.loads(row['conditions_json']), json.loads(row['source_json'])
    current = bool(source and source['version'] == snapshot['version'])
    return {'scenario': row['scenario'], 'version': row['version'], 'actor_id': row['actor_id'],
            'business_date': row['business_date'], 'created_at': row['created_at'],
            'conditions': conditions, 'source': snapshot, 'source_current': current,
            'result': calculate(conditions, source_current=current)}


def state(tender_id, source, source_error=None):
    with database() as con:
        # Ten recent revisions per scenario; current versions are always included.
        history = []
        for scenario in SCENARIOS:
            rows = con.execute('SELECT * FROM tender_scenario_versions WHERE tender_id=? AND scenario=? ORDER BY version DESC LIMIT 10',
                               (tender_id, scenario)).fetchall()
            history.extend(serialize(row, source) for row in rows)
    latest = {name: next((row for row in history if row['scenario'] == name), None) for name in SCENARIOS}
    return {'ok': True, 'source': source, 'source_error': source_error, 'scenarios': latest, 'history': history}


def save(tender_id, user_id, payload, source):
    if not isinstance(payload, dict) or set(payload) - {'scenario', 'expected_version', 'operation_id', 'source_version', 'conditions'}:
        raise ScenarioError('bad_request')
    scenario, expected = payload.get('scenario'), payload.get('expected_version')
    if scenario not in SCENARIOS or type(expected) is not int or not 0 <= expected <= 2_000_000_000:
        raise ScenarioError('bad_version')
    operation = payload.get('operation_id')
    if not isinstance(operation, str) or not re.fullmatch(r'[a-f0-9-]{32,36}', operation):
        raise ScenarioError('bad_operation')
    conditions = normalize(payload.get('conditions'))
    digest = hashlib.sha256(canonical({'tender_id': tender_id, 'actor_id': user_id, **payload}).encode()).hexdigest()
    with database() as con:
        con.execute('BEGIN IMMEDIATE')
        previous = con.execute('SELECT digest, version FROM tender_scenario_versions WHERE operation_id=?', (operation,)).fetchone()
        if previous:
            if previous['digest'] != digest:
                raise ScenarioError('operation_conflict', 409)
            return {'saved_version': previous['version'], 'duplicate': True}
        if payload.get('source_version') != source['version']:
            raise ScenarioError('source_changed', 409)
        version = con.execute('SELECT COALESCE(MAX(version),0) FROM tender_scenario_versions WHERE tender_id=? AND scenario=?', (tender_id, scenario)).fetchone()[0]
        if version != expected:
            raise ScenarioError('version_conflict', 409)
        con.execute('INSERT INTO tender_scenario_versions VALUES (?,?,?,?,?,?,?,?,?,?)',
                    (tender_id, scenario, version + 1, operation, digest, user_id, today_iso(), int(time.time()),
                     canonical(conditions), canonical(source)))
    return {'saved_version': version + 1, 'duplicate': False}


def handle(handler, method, path, base_url):
    match = ROUTE.fullmatch(path)
    if not match or method not in {'GET', 'POST'} or (match[2] and method != 'POST'):
        return False
    user = handler.require_user()
    if not user:
        return True
    if not user_can_view_project_economics(user):
        handler.send_json(403, {'error': 'economics_forbidden'})
        return True
    tid = match[1]
    try:
        try:
            source = fetch_source(base_url, tid)
            source_error = None
        except ScenarioError as error:
            if method != 'GET' or error.status == 404:
                raise
            source, source_error = None, error.code
        if method == 'GET':
            result = state(tid, source, source_error)
        else:
            payload = handler.read_json(16_384)
            if match[2]:
                if not isinstance(payload, dict) or set(payload) - {'conditions', 'source_version'}:
                    raise ScenarioError('bad_request')
                if payload.get('source_version') != source['version']:
                    raise ScenarioError('source_changed', 409)
                result = {'ok': True, 'result': calculate(normalize(payload.get('conditions')))}
            else:
                saved = save(tid, int(user['id']), payload, source)
                result = {**state(tid, source), **saved}
        handler.send_json(200, result)
    except ScenarioError as error:
        handler.send_json(error.status, {'error': error.code})
    return True
