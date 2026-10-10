"""Attach local workspace results to Telegram, with durable no-blind-retry receipts."""
import hashlib
import json
from pathlib import Path
import re
import secrets
import struct
import urllib.request


def split_files(text):
    paths = []
    def media(match):
        paths.append(match.group(1).strip().strip('"'))
        return ''
    text = re.sub(r'(?m)^MEDIA:\s*(.+)$', media, text)
    def link(match):
        paths.append(match.group(2).strip('<>'))
        return match.group(1)
    text = re.sub(r'\[([^\]]+)\]\((<?[A-Za-z]:[/\\][^\n)]+>?)\)', link, text)
    return text.strip(), list(dict.fromkeys(paths))


def public_preview(text):
    # Hide complete and still-streaming file directives and local filesystem links.
    text = re.sub(r'(?m)^MEDIA:[^\n]*(?:\n|$)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([A-Za-z]:[^\n)]*(?:\)|$)', r'\1', text)
    return text


def allowed_file(value, workspace):
    root = Path(workspace).resolve()
    path = Path(value).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('Файл не найден в рабочей папке. Сохрани результат в CodexWorkspace.')
    if path.name.startswith('.env') or any(part in ('.ssh', '.codex', 'secrets') for part in path.relative_to(root).parts):
        raise ValueError('Служебный файл с секретами нельзя прикрепить.')
    if path.stat().st_size > 50 * 1024 * 1024:
        raise ValueError('Файл больше 50 МБ и не отправлен.')
    return path


def upload(token, owner, path, content):
    boundary = 'codex-' + secrets.token_hex(16)
    filename = re.sub(r'[\r\n"\\]', '_', path.name)
    photo = False
    if content.startswith(b'\x89PNG\r\n\x1a\n') and len(content) >= 24 and len(content) <= 10 * 1024 * 1024:
        width, height = struct.unpack('>II', content[16:24])
        photo = min(width, height) > 0 and width + height <= 10000 and max(width, height) / min(width, height) <= 20
    field, method = ('photo', 'sendPhoto') if photo else ('document', 'sendDocument')
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n{owner}\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            'Content-Type: application/octet-stream\r\n\r\n').encode('utf-8')
    body += content + f'\r\n--{boundary}--\r\n'.encode()
    request = urllib.request.Request('https://api.telegram.org/bot' + token + '/' + method, data=body,
                                     headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.load(response)
        if not result.get('ok'):
            raise ValueError('rejected')
        return result['result']['message_id']
    except Exception:
        raise RuntimeError('Отправка файла не подтверждена. Автоматически повторять её не буду.') from None


def deliver(db, token, owner, workspace, job_id, value):
    path = allowed_file(value, workspace)
    try:
        with path.open('rb') as source:
            content = source.read(50 * 1024 * 1024 + 1)
    except OSError:
        raise ValueError('Не удалось прочитать готовый файл для отправки.') from None
    if len(content) > 50 * 1024 * 1024:
        raise ValueError('Файл больше 50 МБ и не отправлен.')
    digest = hashlib.sha256(content).hexdigest()
    key = str(job_id) + ':' + hashlib.sha256((str(path) + digest).encode()).hexdigest()
    db.execute('''CREATE TABLE IF NOT EXISTS outgoing_files (
        key TEXT PRIMARY KEY, path TEXT, sha256 TEXT, status TEXT, message_id INTEGER)''')
    previous = db.execute('SELECT status,message_id FROM outgoing_files WHERE key=?', (key,)).fetchone()
    if previous:
        if previous[0] == 'sent':
            return previous[1]
        raise RuntimeError('Предыдущая отправка файла не подтверждена; повтор не выполняется.')
    with db:
        db.execute('INSERT INTO outgoing_files VALUES (?,?,?,?,NULL)', (key, str(path), digest, 'sending'))
    try:
        message_id = upload(token, owner, path, content)
    except RuntimeError:
        with db:
            db.execute("UPDATE outgoing_files SET status='unknown' WHERE key=?", (key,))
        raise
    with db:
        db.execute("UPDATE outgoing_files SET status='sent',message_id=? WHERE key=?", (message_id, key))
    return message_id
