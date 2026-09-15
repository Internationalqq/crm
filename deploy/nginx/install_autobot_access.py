"""Install the reviewed AutoBot auth includes, preserving existing proxy rules."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile


PUBLIC_STATIC = {'= /static/embed_bridge.js', '~ ^/static/(autobot-ui|tenders|tender_detail).css$'}


def block_end(text: str, start: int) -> int:
    depth, quote, escaped, comment = 0, '', False, False
    for index in range(start, len(text)):
        char = text[index]
        if comment:
            comment = char != '\n'
            continue
        if escaped:
            escaped = False
            continue
        if char == '\\':
            escaped = True
            continue
        if quote:
            if char == quote:
                quote = ''
            continue
        if char in "\"'":
            quote = char
        elif char == '#':
            comment = True
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return index + 1
    raise ValueError('Unclosed Nginx location')


def protected_config(text: str, include_root: str = '/opt/crm/deploy/nginx') -> tuple[str, list[str]]:
    protected = []
    edits = []
    guard = f'include {include_root}/autobot-protected.conf;'
    for match in re.finditer(r'(?m)^[ \t]*location[ \t]+([^\n{]+?)\s*\{', text):
        selector = match.group(1).strip()
        end = block_end(text, match.end() - 1)
        body = text[match.end():end]
        if not re.search(r'(?m)^\s*proxy_pass\s+http://127\.0\.0\.1:8765(?:/[^;]*)?\s*;', body):
            continue
        if selector in PUBLIC_STATIC:
            continue
        protected.append(selector)
        if guard not in body:
            edits.append((match.end(), '\n        ' + guard))
    if len(protected) < 6 or '/autobot/' not in protected or '/estimates' not in protected:
        raise ValueError('AutoBot proxy layout changed; review before installation')
    for offset, addition in reversed(edits):
        text = text[:offset] + addition + text[offset:]
    server_include = f'include {include_root}/autobot-access.conf;'
    if server_include not in text:
        match = re.search(r'(?m)^\s*server_name\s+[^;]+;', text)
        if not match:
            raise ValueError('HTTPS server_name not found')
        text = text[:match.end()] + '\n    ' + server_include + text[match.end():]
    return text, protected


def atomic_write(path: Path, data: bytes) -> None:
    mode = stat.S_IMODE(path.stat().st_mode)
    descriptor, filename = tempfile.mkstemp(prefix='.autobot-access-', dir=path.parent)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(filename, mode)
    os.replace(filename, path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--backup-dir', required=True)
    parser.add_argument('--expected-sha256', required=True)
    args = parser.parse_args()
    path = Path(args.config).resolve(strict=True)
    before = path.read_bytes()
    if hashlib.sha256(before).hexdigest() != args.expected_sha256:
        raise SystemExit('Nginx config changed after review')
    updated, locations = protected_config(before.decode('utf-8'))
    after = updated.encode('utf-8')
    if before == after:
        print('AutoBot access already installed')
        return
    backup_dir = Path(args.backup_dir).resolve()
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / 'nginx-before-autobot-access.conf'
    with backup.open('xb') as stream:
        stream.write(before)
    os.chmod(backup, 0o600)
    atomic_write(path, after)
    try:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except BaseException:
        atomic_write(path, before)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        raise
    print('AutoBot access installed for', len(locations), 'locations; previous config:', backup)


if __name__ == '__main__':
    main()
