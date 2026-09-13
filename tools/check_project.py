"""Run CRM checks in a fresh source copy, without the working database or .env."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import uuid


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--suite', choices=('python', 'frontend', 'all'), default='all')
    parser.add_argument('--python-pattern', action='append', default=[])
    parser.add_argument('--frontend-pattern', action='append', default=[])
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    run = root / 'tmp' / 'checks' / (time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6])
    source = run / 'source'
    source.mkdir(parents=True)
    for name in ('backend', 'frontend', 'tests', 'tools', 'deploy'):
        shutil.copytree(root / name, source / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.env'))
    for name in ('docker-compose.yml', '.env.docker.example'):
        shutil.copy2(root / name, source / name)
    # Do not inherit real integration credentials into test subprocesses.
    env = {key: value for key, value in os.environ.items()
           if not key.upper().startswith(('PMBI_', 'CLERK_', 'SMTP_', 'RESEND_', 'OPENAI_'))}
    env.update(PYTHONIOENCODING='utf-8', PMBI_HOST='127.0.0.1', PMBI_ADMIN_PASSWORD='Isolated-test-bootstrap-2026!')
    jobs = []
    if args.suite in ('python', 'all'):
        for pattern in args.python_pattern or ['test_*.py']:
            jobs.append(('python-' + pattern, [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', pattern]))
    if args.suite in ('frontend', 'all'):
        node = shutil.which('node')
        if not node:
            parser.error('Node.js is required for frontend checks')
        files = sorted({file for pattern in args.frontend_pattern or ['*frontend*tests.js']
                        for file in (source / 'tests').glob(pattern) if file.is_file()})
        if not files:
            parser.error('No frontend tests matched')
        jobs.extend((file.stem, [node, str(file)]) for file in files)
    results = []
    print(f'Isolated checks: {run.relative_to(root)}', flush=True)
    for name, command in jobs:
        log = run / (re.sub(r'[^A-Za-z0-9_.-]', '_', name) + '.log')
        started = time.monotonic()
        with log.open('w', encoding='utf-8') as output:
            result = subprocess.run(command, cwd=source, env=env, stdout=output, stderr=subprocess.STDOUT)
        content = log.read_text(encoding='utf-8', errors='replace')
        count = re.search(r'Ran (\d+) tests?', content)
        exit_code = result.returncode
        if name.startswith('python-') and (not count or int(count[1]) == 0):
            exit_code = exit_code or 2
        record = {'name': name, 'exit_code': exit_code, 'seconds': round(time.monotonic() - started, 2),
                  'log': log.name, 'failures': re.findall(r'^(?:FAIL|ERROR): (.+)$', content, flags=re.M)}
        if count:
            record['tests'] = int(count[1])
        results.append(record)
        (run / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'{"PASS" if exit_code == 0 else "FAIL"} {name} ({record["seconds"]}s)', flush=True)
    failures = sum(result['exit_code'] != 0 for result in results)
    print(f'{len(results) - failures} passed; {failures} failed. Logs: {run.relative_to(root)}', flush=True)
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
