"""Existing-account email login; durable limits and atomic one-time redemption."""
import hashlib
import hmac
import json
import re
import secrets

import auth

CODE_TTL = 600
RESEND_DELAY = 60
MAX_ATTEMPTS = 5
EMAIL_HOURLY_LIMIT = 5
IP_HOURLY_LIMIT = 30
VERIFY_IP_LIMIT = 60


def ensure_schema(con):
    con.execute('''CREATE TABLE IF NOT EXISTS email_login_challenges (
        challenge_hash TEXT PRIMARY KEY, email_key TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL, ip_key TEXT NOT NULL,
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, ready INTEGER NOT NULL DEFAULT 0,
        used_at INTEGER)''')
    con.execute('CREATE INDEX IF NOT EXISTS email_login_email_time ON email_login_challenges(email_key,created_at)')
    con.execute('CREATE INDEX IF NOT EXISTS email_login_ip_time ON email_login_challenges(ip_key,created_at)')
    con.execute('''CREATE TABLE IF NOT EXISTS email_login_attempts (
        id INTEGER PRIMARY KEY, ip_key TEXT NOT NULL, created_at INTEGER NOT NULL)''')
    con.execute('CREATE INDEX IF NOT EXISTS email_login_attempt_ip ON email_login_attempts(ip_key,created_at)')


def code_digest(challenge, code):
    # The high-entropy key is returned to this browser, never stored in the DB.
    # A database leak alone cannot brute-force the six-digit code's hash.
    return hmac.new(challenge.encode(), code.encode(), hashlib.sha256).hexdigest()


def available(handler):
    if auth.clerk_enabled() or not auth.mail_configured():
        handler.send_json(503, {'error':'email_login_unavailable',
            'message':'Вход по почте временно недоступен. Войдите с паролем.'})
        return False
    return True


def limited(handler, seconds=RESEND_DELAY):
    handler.send_json(429, {'error':'email_login_rate_limited',
        'message':'Слишком много запросов. Подождите перед новой попыткой.',
        'retryAfter':max(1, int(seconds))})


def send_code(email, code):
    text = f'Ваш код для входа в PM.bi: {code}\n\nКод действует 10 минут и используется один раз.\nНикому не сообщайте код. Если вы не запрашивали вход, просто проигнорируйте письмо.'
    html = f'''<!doctype html><html lang="ru"><body style="margin:0;background:#f7f9fc;color:#18273b;font-family:Arial,sans-serif">
    <div style="max-width:460px;margin:32px auto;padding:32px;background:#fff;border-radius:12px">
    <p style="font-size:22px;font-weight:bold;color:#2258d6">PM.bi</p>
    <h1 style="font-size:24px">Код для входа</h1>
    <p style="font-size:16px;line-height:1.5">Введите этот код на странице входа в CRM:</p>
    <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#2258d6">{code}</p>
    <p style="font-size:16px;line-height:1.5">Код действует 10 минут и используется один раз.</p>
    <p style="font-size:14px;line-height:1.5;color:#526176">Никому не сообщайте код. Если вы не запрашивали вход, просто проигнорируйте письмо.</p>
    </div></body></html>'''
    auth.send_email(email, 'PM.bi: код для входа', text, html)


def request_code(handler):
    if not available(handler): return
    payload = handler.read_json()
    email = str(payload.get('email', '')).strip().lower() if isinstance(payload, dict) else ''
    if len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):
        handler.send_json(400, {'error':'invalid_email','message':'Введите корректный адрес почты.'})
        return
    timestamp = auth.now_ts()
    email_key = auth.token_hash(email)
    ip_key = auth.token_hash(auth.handler_client_ip(handler))
    challenge = secrets.token_urlsafe(32)
    identity = auth.token_hash(challenge)
    code = f'{secrets.randbelow(1_000_000):06d}'
    with auth.db() as con:
        ensure_schema(con)
        con.execute('BEGIN IMMEDIATE')
        con.execute('DELETE FROM email_login_challenges WHERE created_at < ?', (timestamp-86400,))
        times = [r[0] for r in con.execute('SELECT created_at FROM email_login_challenges WHERE email_key=? AND created_at>? ORDER BY created_at', (email_key,timestamp-3600))]
        if times and timestamp-times[-1]<RESEND_DELAY:
            limited(handler, times[-1]+RESEND_DELAY-timestamp)
            return
        if len(times)>=EMAIL_HOURLY_LIMIT:
            limited(handler, times[0]+3600-timestamp)
            return
        ip_times = [r[0] for r in con.execute('SELECT created_at FROM email_login_challenges WHERE ip_key=? AND created_at>? ORDER BY created_at', (ip_key,timestamp-3600))]
        if len(ip_times)>=IP_HOURLY_LIMIT:
            limited(handler, ip_times[0]+3600-timestamp)
            return
        users = con.execute("SELECT id,email FROM users WHERE lower(trim(email))=? AND is_active=1 AND COALESCE(is_deleted,0)=0 LIMIT 2", (email,)).fetchall()
        user = users[0] if len(users)==1 else None
        con.execute('UPDATE email_login_challenges SET used_at=? WHERE email_key=? AND used_at IS NULL', (timestamp,email_key))
        con.execute('''INSERT INTO email_login_challenges
            (challenge_hash,email_key,user_id,code_hash,ip_key,created_at,expires_at)
            VALUES (?,?,?,?,?,?,?)''', (identity,email_key,user['id'] if user else None,code_digest(challenge,code),ip_key,timestamp,timestamp+CODE_TTL))
    delivered = False
    try:
        if user:
            send_code(email, code)
        delivered = True
    except Exception:
        # Do not log transport exceptions: providers may echo recipient/content.
        # The public response is identical for absent accounts and failed mail.
        pass
    with auth.db() as con:
        con.execute('UPDATE email_login_challenges SET ready=?, used_at=CASE WHEN ?=0 THEN ? ELSE used_at END WHERE challenge_hash=?', (int(delivered),int(delivered),auth.now_ts(),identity))
        if user:
            action = 'email_login_code_requested' if delivered else 'email_login_delivery_failed'
            con.execute("INSERT INTO audit_log(user_id,action,entity,created_at) VALUES (?,?,'user',?)", (user['id'],action,auth.now_ts()))
    now = auth.now_ts()
    handler.send_json(202, {'challenge':challenge,'expiresIn':max(0,timestamp+CODE_TTL-now),
        'resendAfter':max(0,timestamp+RESEND_DELAY-now),
        'message':'Если для этой почты открыт доступ в CRM, письмо с кодом придёт в течение минуты.'})


def invalid(handler):
    handler.send_json(401, {'error':'invalid_email_code',
        'message':'Код не подошёл или уже использован. Проверьте последнее письмо или запросите новый код.'})


def verify_code(handler):
    if not available(handler): return
    payload = handler.read_json()
    challenge = str(payload.get('challenge','')) if isinstance(payload,dict) else ''
    code = str(payload.get('code','')).strip() if isinstance(payload,dict) else ''
    if not re.fullmatch(r'[A-Za-z0-9_-]{43}',challenge) or not re.fullmatch(r'[0-9]{6}',code):
        handler.send_json(400, {'error':'invalid_code_format','message':'Введите шесть цифр из письма.'})
        return
    timestamp=auth.now_ts();ip_key=auth.token_hash(auth.handler_client_ip(handler))
    identity=auth.token_hash(challenge)
    with auth.db() as con:
        ensure_schema(con)
        con.execute('BEGIN IMMEDIATE')
        con.execute('DELETE FROM email_login_attempts WHERE created_at<=?', (timestamp-600,))
        times=[r[0] for r in con.execute('SELECT created_at FROM email_login_attempts WHERE ip_key=? ORDER BY created_at', (ip_key,))]
        if len(times)>=VERIFY_IP_LIMIT:
            limited(handler,times[0]+600-timestamp)
            return
        con.execute('INSERT INTO email_login_attempts(ip_key,created_at) VALUES (?,?)',(ip_key,timestamp))
        item=con.execute('SELECT * FROM email_login_challenges WHERE challenge_hash=?',(identity,)).fetchone()
        if not item or item['used_at'] is not None or not item['ready']:
            invalid(handler);return
        if item['expires_at']<=timestamp:
            handler.send_json(410, {'error':'email_code_expired','message':'Срок действия кода истёк. Запросите новый код.'})
            return
        attempts=item['attempts']+1
        con.execute('UPDATE email_login_challenges SET attempts=? WHERE challenge_hash=?',(attempts,identity))
        matches=hmac.compare_digest(item['code_hash'],code_digest(challenge,code))
        if attempts>MAX_ATTEMPTS or not matches:
            if attempts>=MAX_ATTEMPTS:
                con.execute('UPDATE email_login_challenges SET used_at=? WHERE challenge_hash=?',(timestamp,identity))
                handler.send_json(429, {'error':'email_code_locked','message':'Лимит попыток исчерпан. Запросите новый код.'})
            else: invalid(handler)
            return
        user=con.execute('SELECT * FROM users WHERE id=? AND is_active=1 AND COALESCE(is_deleted,0)=0',(item['user_id'],)).fetchone()
        if not user or auth.token_hash(str(user['email'] or '').strip().lower())!=item['email_key']:
            invalid(handler);return
        # Recheck uniqueness too: an administrator might change accounts after send.
        duplicates=con.execute('SELECT count(*) FROM users WHERE lower(trim(email))=? AND is_active=1 AND COALESCE(is_deleted,0)=0',(str(user['email']).strip().lower(),)).fetchone()[0]
        if duplicates!=1: invalid(handler);return
        con.execute('UPDATE email_login_challenges SET used_at=? WHERE challenge_hash=?',(timestamp,identity))
        token=secrets.token_urlsafe(32)
        con.execute('''INSERT INTO sessions(user_id,token_hash,created_at,expires_at,user_agent,ip)
            VALUES (?,?,?,?,?,?)''',(user['id'],auth.token_hash(token),timestamp,timestamp+auth.SESSION_TTL_SECONDS,handler.headers.get('User-Agent',''),auth.handler_client_ip(handler)))
        previous=auth.session_token(handler)
        if previous and con.execute("SELECT 1 FROM sqlite_master WHERE name='guest_sessions'").fetchone():
            con.execute('DELETE FROM guest_sessions WHERE token_hash=?',(auth.token_hash(previous),))
        con.execute("INSERT INTO audit_log(user_id,action,entity,created_at) VALUES (?,'email_login','user',?)",(user['id'],timestamp))
    body=json.dumps({'user':auth.user_payload(user)},ensure_ascii=False).encode('utf-8')
    handler.send_response(200)
    handler.send_header('Content-Type','application/json; charset=utf-8')
    handler.send_header('Cache-Control','no-store')
    auth.set_session_cookie(handler,token,auth.SESSION_TTL_SECONDS)
    handler.send_header('Content-Length',str(len(body)))
    handler.end_headers();handler.wfile.write(body)
