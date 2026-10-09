"""Private, single-owner Telegram text interface to a persistent Codex CLI thread."""
import argparse
import json
from pathlib import Path
import secrets
import sqlite3
import time
import sys
import urllib.error
import urllib.request
# Bundled Python enables safe_path; load only our explicitly installed sibling module.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from streaming import LiveReply, run_codex
from attachments import AttachmentError, prepare, select_attachment


def authorized(message, owner):
    return (message.get('chat', {}).get('type') == 'private'
            and message.get('from', {}).get('id') == owner
            and message.get('chat', {}).get('id') == owner)


class Bridge:
    def __init__(self, home, workspace, codex, crm=None):
        self.home, self.workspace, self.codex = Path(home), workspace, codex
        self.crm = crm
        self.token = (self.home / 'bot-token.txt').read_text(encoding='utf-8-sig').strip()
        self.db = sqlite3.connect(self.home / 'state.sqlite')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY, prompt TEXT, status TEXT, result TEXT);
            CREATE TABLE IF NOT EXISTS attachments (job_id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
        ''')
        self.db.execute("UPDATE jobs SET status='interrupted' WHERE status='running'")
        self.db.commit()

    def get(self, key, default=None):
        row = self.db.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
        return row[0] if row else default

    def set(self, key, value):
        with self.db:
            self.db.execute('INSERT OR REPLACE INTO settings VALUES (?,?)', (key, str(value)))

    def api(self, method, payload):
        request = urllib.request.Request(
            'https://api.telegram.org/bot' + self.token + '/' + method,
            data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError('Telegram HTTP ' + str(error.code)) from None
        except Exception as error:
            raise RuntimeError('Telegram transport ' + type(error).__name__) from None
        if not result.get('ok'):
            raise RuntimeError('Telegram request rejected')
        return result['result']

    def send(self, text):
        for offset in range(0, len(text), 3500):
            self.api('sendMessage', {'chat_id': int(self.get('owner')), 'text': text[offset:offset+3500]})

    def accept(self, update):
        message = update.get('message', {})
        text = message.get('text') or message.get('caption') or ''
        owner = self.get('owner')
        if not owner:
            pairing = self.get('pairing')
            if (message.get('chat', {}).get('type') == 'private'
                    and pairing and secrets.compare_digest(text.encode('utf-8'), ('/start ' + pairing).encode('utf-8'))
                    and time.time() < float(self.get('pairing_expires', '0'))
                    and message.get('from', {}).get('id') == message.get('chat', {}).get('id')):
                self.set('owner', message['from']['id'])
                self.set('pairing', '')
                self.send('Подключено ✅ Пришли задачу текстом, голосовым, с фото или файлом. CRM открою по задаче. /status — состояние.')
            elif text == '/start' and message.get('chat', {}).get('type') == 'private':
                self.api('sendMessage', {'chat_id': message['chat']['id'],
                                        'text': 'Для привязки отправь /start и одноразовый код из чата Codex. Без кода задачи не выполняются.'})
            return
        if not authorized(message, int(owner)):
            return
        attachment = select_attachment(message)
        if text == '/status':
            counts = dict(self.db.execute('SELECT status,count(*) FROM jobs GROUP BY status'))
            state = 'Работа приостановлена после сбоя.' if self.get('halted') else 'Codex подключён.'
            self.send(state + ' Задачи: ' + json.dumps(counts, ensure_ascii=False))
        elif text.startswith('/start'):
            self.send('На связи. Пришли текст, фото, документ или голосовое с задачей.')
        elif not text and not attachment:
            self.send('Пришли текст, фото, документ или голосовое. Этот тип сообщения пока не поддерживается.')
        elif len(text) <= 12000:
            with self.db:
                self.db.execute('INSERT OR IGNORE INTO jobs VALUES (?, ?, ?, NULL)',
                                (update['update_id'], text, 'queued'))
                if attachment:
                    self.db.execute('INSERT OR IGNORE INTO attachments VALUES (?, ?)',
                                    (update['update_id'], json.dumps(attachment)))

    def work(self):
        if self.get('halted'):
            return
        row = self.db.execute("SELECT id,prompt FROM jobs WHERE status='queued' ORDER BY id LIMIT 1").fetchone()
        if not row:
            return
        job_id, prompt = row
        with self.db:
            self.db.execute("UPDATE jobs SET status='running' WHERE id=?", (job_id,))
        output = self.home / ('answer-' + str(job_id) + '.txt')
        events = self.home / ('events-' + str(job_id) + '.jsonl')
        thread = self.get('thread')
        instructions = ('Ты универсальный помощник Codex по личным поручениям владельца через Telegram. '
                        'Задачи могут касаться любых тем: вопросы, поиск, тексты, файлы, код, агенты и проекты. '
                        'Рабочая папка общего назначения: ' + self.workspace + '. '
                        'Выбирай контекст по текущей задаче и истории разговора. '
                        'Не считай каждую задачу связанной с CRM и не исследуй её без необходимости. '
                        + ('Проект CRM PM.bi расположен в ' + self.crm + '. Если задача касается CRM, '
                           'сначала прочитай его AGENTS.md и следуй применимым инструкциям. ' if self.crm else '')
                        + 'Отвечай кратко по-русски. По ходу работы давай короткие полезные обновления '
                        'обычным языком. В окончательном ответе оставляй краткий результат, проверки '
                        'и существенные ограничения; не повторяй весь ход работы. Не читай токены, '
                        'файлы секретов Telegram-моста и не меняй его доступ. Если разрешений '
                        'не хватает, сообщи точно, не обходи ограничения. Не выполняй параллельно '
                        'другую задачу пользователя.\n\nЗадача:\n' + prompt)
        status = 'failed'
        live = LiveReply(self.api, int(self.get('owner')))
        try:
            inputs = []
            attachment = self.db.execute('SELECT payload FROM attachments WHERE job_id=?', (job_id,)).fetchone()
            if attachment:
                note, inputs = prepare(self.api, self.token, self.workspace, job_id, json.loads(attachment[0]))
                instructions += note
                if not prompt:
                    instructions += '\nЕсли для выполнения задачи не хватает контекста, задай один короткий вопрос.'
            options = {'extra_inputs': inputs} if inputs else {}
            answer = run_codex(self.codex, self.workspace, self.crm, thread, instructions, events,
                               lambda value: self.set('thread', value), live.feed, **options)
            output.write_text(answer, encoding='utf-8')
            status = 'completed'
        except AttachmentError as error:
            answer = str(error)
        except Exception as error:
            self.set('halted', '1')
            answer = 'Задача остановилась: ' + type(error).__name__ + '. Повторных действий не выполнял.'
        with self.db:
            self.db.execute('UPDATE jobs SET status=?,result=? WHERE id=?', (status, answer, job_id))
        try:
            live.finish(answer)
        except RuntimeError:
            with self.db:
                self.db.execute("UPDATE jobs SET status='delivery_unknown' WHERE id=?", (job_id,))

    def run(self):
        info = self.api('getWebhookInfo', {})
        if info.get('url'):
            raise RuntimeError('Existing webhook: stop without replacing it')
        print('ready', flush=True)
        while True:
            try:
                updates = self.api('getUpdates', {'offset': int(self.get('offset', '0')),
                                                  'timeout': 20, 'allowed_updates': ['message']})
                for update in updates:
                    self.accept(update)
                    self.set('offset', update['update_id'] + 1)
                self.work()
            except RuntimeError as error:
                print(str(error), flush=True)
                if 'HTTP 401' in str(error) or 'HTTP 409' in str(error):
                    raise SystemExit(1)
                time.sleep(10)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', required=True)
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--codex', required=True)
    parser.add_argument('--crm', help='Known CRM project to open only for relevant tasks')
    parser.add_argument('--pair', action='store_true')
    args = parser.parse_args()
    import msvcrt
    lock = open(Path(args.home) / 'worker.lock', 'a+b')
    lock.seek(0)
    lock.write(b'0')
    lock.flush()
    lock.seek(0)
    msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    bridge = Bridge(args.home, args.workspace, args.codex, args.crm)
    if args.pair and not bridge.get('owner'):
        code = secrets.token_hex(12)
        bridge.set('pairing', code)
        bridge.set('pairing_expires', time.time() + 1800)
        print('PAIRING=' + code, flush=True)
    bridge.run()


if __name__ == '__main__':
    main()
