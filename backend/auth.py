from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import urllib.parse
import urllib.request
from http import HTTPStatus
from pathlib import Path

import jwt


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
AVATARS_DIR = DATA_DIR / "avatars"
AVATAR_MAX_BYTES = 5 * 1024 * 1024
AVATAR_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

LOGIN_PATH = "/login"
DEFAULT_AUTH_PATH = "/app/dashboard"
SESSION_COOKIE = "pmbi_session"
SESSION_TTL_SECONDS = 60 * 60 * 12
PASSWORD_ITERATIONS = 220_000

PMBI_PUBLIC_BASE_URL = (os.environ.get("PMBI_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
CLERK_PUBLISHABLE_KEY = (os.environ.get("CLERK_PUBLISHABLE_KEY", "") or "").strip()
CLERK_SECRET_KEY = (os.environ.get("CLERK_SECRET_KEY", "") or "").strip()
CLERK_JWT_KEY = (os.environ.get("CLERK_JWT_KEY", "") or "").replace("\\n", "\n").strip()
CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = (
    os.environ.get("CLERK_SIGN_IN_FALLBACK_REDIRECT_URL", "") or DEFAULT_AUTH_PATH
).strip() or DEFAULT_AUTH_PATH
CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = (
    os.environ.get("CLERK_SIGN_UP_FALLBACK_REDIRECT_URL", "") or DEFAULT_AUTH_PATH
).strip() or DEFAULT_AUTH_PATH
CLERK_AUTHORIZED_PARTIES = {
    item.strip().rstrip("/")
    for item in (os.environ.get("CLERK_AUTHORIZED_PARTIES", "") or "").split(",")
    if item.strip()
}
if PMBI_PUBLIC_BASE_URL:
    CLERK_AUTHORIZED_PARTIES.add(PMBI_PUBLIC_BASE_URL)
CLERK_ADMIN_EMAILS = {
    item.strip().lower()
    for item in (os.environ.get("CLERK_ADMIN_EMAILS", "") or "").split(",")
    if item.strip()
}
CLERK_API_BASE = "https://api.clerk.com/v1"

ROLE_ALLOWED_PREFIXES = {
    "admin": ["*"],
    "director": ["*"],
    "foreman": ["/app", "/app/dashboard", "/app/projects", "/app/autobot", "/app/schedule", "/app/logs", "/app/warehouse", "/app/suppliers", "/app/chats"],
    "buyer": ["/app", "/app/dashboard", "/app/projects", "/app/autobot", "/app/logs", "/app/warehouse", "/app/suppliers", "/app/chats"],
    "purchaser": ["/app", "/app/dashboard", "/app/projects", "/app/autobot", "/app/logs", "/app/warehouse", "/app/suppliers", "/app/chats"],
    "financier": ["/app", "/app/dashboard", "/app/projects", "/app/autobot", "/app/reports"],
    "accountant": ["/app", "/app/dashboard", "/app/projects", "/app/autobot", "/app/reports"],
    "client": ["/app", "/app/dashboard", "/app/projects", "/app/schedule", "/app/logs", "/app/chats"],
    "customer": ["/app", "/app/dashboard", "/app/projects", "/app/schedule", "/app/logs", "/app/chats"],
}

ROLE_LABELS = {
    "admin": "Администратор",
    "director": "Директор",
    "foreman": "Прораб",
    "purchaser": "Закупщик",
    "buyer": "Закупщик",
    "financier": "Ответственный за финплан",
    "accountant": "Бухгалтер",
    "customer": "Заказчик",
    "client": "Заказчик",
}

ROLE_DESCRIPTIONS = {
    "admin": "Технический администратор с полным доступом.",
    "director": "Руководитель: видит все объекты, назначает роли и контролирует систему.",
    "foreman": "Прораб/куратор: ведет назначенные объекты и ежедневные отчеты.",
    "purchaser": "Закупщик/снабженец: отвечает за поставщиков, материалы и поставки.",
    "buyer": "Закупщик/снабженец: устаревший код роли для совместимости.",
    "financier": "Ответственный за финпланы и платежи.",
    "accountant": "Бухгалтер: работает с финансовыми и подтверждающими документами.",
    "customer": "Заказчик: ограниченный доступ к своим объектам.",
    "client": "Заказчик: устаревший код роли для совместимости.",
}

LEGACY_ROLE_ALIASES = {
    "buyer": "purchaser",
    "client": "customer",
}
ROLE_CODES = tuple(ROLE_LABELS.keys())
PUBLIC_STATIC_PATHS = {"/", "/index.html", LOGIN_PATH, "/robots.txt"}


def now_ts() -> int:
    return int(time.time())


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${b64url(salt)}${b64url(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_b64, digest_b64 = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_b64 + "=" * (-len(salt_b64) % 4))
        expected = base64.urlsafe_b64decode(digest_b64 + "=" * (-len(digest_b64) % 4))
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def normalize_role(role: str | None) -> str:
    role_code = str(role or "").strip()
    return LEGACY_ROLE_ALIASES.get(role_code, role_code)


def user_payload(row: sqlite3.Row) -> dict:
    role = normalize_role(row["role"])
    if str(row["login"] or "").strip().lower() == "admin":
        role = "admin"
    roles = [role]
    try:
        with db() as con:
            role_rows = con.execute(
                """
                SELECT r.code
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = ?
                ORDER BY r.id
                """,
                (row["id"],),
            ).fetchall()
            roles = [normalize_role(role_row["code"]) for role_row in role_rows] or roles
    except sqlite3.Error:
        roles = [role]
    if role == "admin":
        roles = ["admin"]
    return {
        "id": row["id"],
        "login": row["login"],
        "email": row["email"] if "email" in row.keys() else None,
        "phone": row["phone"] if "phone" in row.keys() else None,
        "clerkUserId": row["clerk_user_id"] if "clerk_user_id" in row.keys() else None,
        "role": role,
        "roles": sorted(set(roles)),
        "roleLabel": ROLE_LABELS.get(role, role),
        "name": row["name"],
        "avatarUrl": row["avatar_url"] if "avatar_url" in row.keys() else None,
    }


def clerk_enabled() -> bool:
    return bool(CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY and CLERK_JWT_KEY)


def split_person_name(full_name: str) -> tuple[str, str]:
    cleaned = re.sub(r"\s+", " ", str(full_name or "").strip())
    if not cleaned:
        return "", ""
    parts = cleaned.split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def verify_clerk_session_token(token: str) -> dict | None:
    if not clerk_enabled() or not token:
        return None
    try:
        claims = jwt.decode(
            token,
            CLERK_JWT_KEY,
            algorithms=["RS256"],
            options={"require": ["sub", "exp", "iat", "nbf"], "verify_aud": False},
        )
    except Exception:
        return None
    azp = str(claims.get("azp") or "").rstrip("/")
    if CLERK_AUTHORIZED_PARTIES and azp and azp not in CLERK_AUTHORIZED_PARTIES:
        return None
    return claims


def clerk_api_request(path: str, *, method: str = "GET", payload: dict | None = None) -> dict:
    if not CLERK_SECRET_KEY:
        raise ValueError("clerk_secret_key_missing")
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        CLERK_API_BASE + path,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {CLERK_SECRET_KEY}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        raw = response.read().decode("utf-8") or "{}"
    return json.loads(raw)


def clerk_primary_email(user_data: dict) -> str | None:
    primary_id = user_data.get("primary_email_address_id")
    email_rows = user_data.get("email_addresses") or []
    for item in email_rows:
        if item.get("id") == primary_id:
            value = str(item.get("email_address") or "").strip().lower()
            if value:
                return value
    for item in email_rows:
        value = str(item.get("email_address") or "").strip().lower()
        if value:
            return value
    return None


def clerk_primary_phone(user_data: dict) -> str | None:
    primary_id = user_data.get("primary_phone_number_id")
    phone_rows = user_data.get("phone_numbers") or []
    for item in phone_rows:
        if item.get("id") == primary_id:
            value = str(item.get("phone_number") or "").strip()
            if value:
                return value
    for item in phone_rows:
        value = str(item.get("phone_number") or "").strip()
        if value:
            return value
    return None


def role_can_open(role: str, path: str) -> bool:
    if path in PUBLIC_STATIC_PATHS:
        return True
    allowed = ROLE_ALLOWED_PREFIXES.get(role, [])
    if "*" in allowed:
        return True
    return any(path == prefix or (prefix.endswith("/") and path.startswith(prefix)) for prefix in allowed)


def user_has_any_role(user: dict, roles: set[str]) -> bool:
    user_roles = {normalize_role(user.get("role"))}
    user_roles.update(normalize_role(role) for role in user.get("roles", []))
    return bool(user_roles & roles)


def user_can_open(user: dict, path: str) -> bool:
    user_roles = {normalize_role(user.get("role"))}
    user_roles.update(normalize_role(role) for role in user.get("roles", []))
    return any(role_can_open(role, path) for role in user_roles)


def user_can_manage_documents(user: dict) -> bool:
    return user_has_any_role(user, {"admin", "director", "foreman", "purchaser", "financier", "accountant"})


def user_can_manage_suppliers(user: dict) -> bool:
    return user_has_any_role(user, {"admin", "director", "foreman", "purchaser"})


def user_can_manage_finances(user: dict) -> bool:
    return user_has_any_role(user, {"admin", "director", "financier", "accountant"})


def user_can_view_finances(user: dict) -> bool:
    return user_can_manage_finances(user) or user_has_any_role(user, {"foreman"})


def can_see_finances(user: dict) -> bool:
    return user_can_view_finances(user)


def user_can_pay_invoices(user: dict) -> bool:
    return user_has_any_role(user, {"director"})


def user_can_manage_schedule(user: dict) -> bool:
    return user_has_any_role(user, {"admin", "director", "foreman"})


def session_token(handler) -> str | None:
    cookie_header = handler.headers.get("Cookie", "")
    if not cookie_header:
        return None
    from http.cookies import SimpleCookie
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    morsel = cookie.get(SESSION_COOKIE)
    return morsel.value if morsel else None


def bearer_token(handler) -> str | None:
    header = handler.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    return token or None


def clerk_cookie_token(handler) -> str | None:
    cookie_header = handler.headers.get("Cookie", "")
    if not cookie_header:
        return None
    from http.cookies import SimpleCookie
    cookie = SimpleCookie()
    cookie.load(cookie_header)
    for name in ("__session", "__clerk_db_jwt"):
        morsel = cookie.get(name)
        if morsel and morsel.value:
            return morsel.value
    return None


def auth_config() -> dict[str, object]:
    return {
        "clerkEnabled": clerk_enabled(),
        "clerkPublishableKey": CLERK_PUBLISHABLE_KEY,
        "clerkSignInFallbackRedirectUrl": CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
        "clerkSignUpFallbackRedirectUrl": CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
        "clerkAfterSignOutUrl": LOGIN_PATH,
    }


def clerk_sign_in_script() -> str:
    if not clerk_enabled():
        return ""
    return (
        '<script async crossorigin="anonymous" '
        'data-clerk-publishable-key="'
        + CLERK_PUBLISHABLE_KEY
        + '" src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"></script>'
    )


def current_user_from_clerk(handler) -> tuple[dict | None, str | None]:
    token = bearer_token(handler) or clerk_cookie_token(handler)
    if not token:
        return None, None
    claims = verify_clerk_session_token(token)
    if not claims:
        return None, "bad_clerk_token"
    clerk_user_id = str(claims.get("sub") or "").strip()
    if not clerk_user_id:
        return None, "bad_clerk_token"
    with db() as con:
        row = con.execute(
            "SELECT * FROM users WHERE clerk_user_id = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
            (clerk_user_id,),
        ).fetchone()
        if row:
            return user_payload(row), None
    try:
        clerk_user = clerk_api_request(f"/users/{urllib.parse.quote(clerk_user_id, safe='')}")
    except Exception:
        return None, "clerk_lookup_failed"
    email = clerk_primary_email(clerk_user)
    phone = clerk_primary_phone(clerk_user)
    full_name = str(clerk_user.get("first_name") or "").strip()
    last_name = str(clerk_user.get("last_name") or "").strip()
    if last_name:
        full_name = (full_name + " " + last_name).strip()
    with db() as con:
        row = None
        if email:
            row = con.execute(
                "SELECT * FROM users WHERE lower(email) = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
                (email.lower(),),
            ).fetchone()
        if not row and email and email.lower() in CLERK_ADMIN_EMAILS:
            row = con.execute(
                """
                SELECT *
                FROM users
                WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0 AND lower(login) = 'admin'
                ORDER BY id
                LIMIT 1
                """
            ).fetchone()
        if not row:
            return None, "clerk_user_not_provisioned"
        con.execute(
            """
            UPDATE users
            SET clerk_user_id = ?, email = COALESCE(?, email), phone = COALESCE(?, phone),
                name = CASE WHEN trim(COALESCE(name, '')) = '' AND ? != '' THEN ? ELSE name END,
                    updated_at = ?
            WHERE id = ?
            """,
            (clerk_user_id, email, phone, full_name, full_name, now_ts(), row["id"]),
        )
        con.commit()
        refreshed = con.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
    return user_payload(refreshed), None


def current_user(handler) -> dict | None:
    if clerk_enabled():
        user, _error = current_user_from_clerk(handler)
        if user:
            return user
    token = session_token(handler)
    if not token:
        return None
    with db() as con:
        row = con.execute(
            """
            SELECT u.*
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1 AND COALESCE(u.is_deleted, 0) = 0
            """,
            (token_hash(token), now_ts()),
        ).fetchone()
        if not row:
            return None
        return user_payload(row)


def require_user(handler) -> dict | None:
    if clerk_enabled():
        user, error = current_user_from_clerk(handler)
        if user:
            return user
        if error:
            status = HTTPStatus.FORBIDDEN if error == "clerk_user_not_provisioned" else HTTPStatus.UNAUTHORIZED
            handler.send_json(status, {"error": error})
            return None
    user = current_user(handler)
    if not user:
        handler.send_json(HTTPStatus.UNAUTHORIZED, {"error": "auth_required"})
        return None
    return user


def require_role(handler, roles: set[str]) -> dict | None:
    user = require_user(handler)
    if not user:
        return None
    if not user_has_any_role(user, roles):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return None
    return user


def set_session_cookie(handler, token: str) -> None:
    handler.send_header(
        "Set-Cookie",
        f"{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax",
    )


def clear_session_cookie(handler) -> None:
    handler.send_header(
        "Set-Cookie",
        f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    )


def api_login(handler) -> None:
    if clerk_enabled():
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "clerk_enabled"})
        return
    content_type = handler.headers.get("Content-Type", "")
    avatar_url_from_upload = None
    if "multipart/form-data" in content_type:
        form = handler.read_multipart()

        def form_value(name: str) -> str:
            item = form[name] if name in form else None
            if item is None:
                return ""
            if isinstance(item, list):
                item = item[0] if item else None
            if item is None:
                return ""
            return str(getattr(item, "value", "") or "")

        payload = {
            "first_name": form_value("first_name"),
            "last_name": form_value("last_name"),
            "name": form_value("name"),
            "avatar_url": form_value("avatar_url"),
        }
        avatar_item = form["avatar"] if "avatar" in form else None
        if isinstance(avatar_item, list):
            avatar_item = avatar_item[0] if avatar_item else None
        if avatar_item is not None and getattr(avatar_item, "filename", ""):
            mime_type = str(getattr(avatar_item, "type", "") or "").split(";", 1)[0].strip().lower()
            ext = AVATAR_EXTENSIONS.get(mime_type)
            if not ext:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_avatar_type", "message": "Загрузите PNG, JPG, WEBP или GIF"})
                return
            content = avatar_item.file.read(AVATAR_MAX_BYTES + 1)
            if len(content) > AVATAR_MAX_BYTES:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "avatar_too_large", "message": "Аватарка должна быть меньше 5 МБ"})
                return
            AVATARS_DIR.mkdir(parents=True, exist_ok=True)
            storage_name = f"user_{user['id']}_{now_ts()}_{secrets.token_hex(6)}{ext}"
            (AVATARS_DIR / storage_name).write_bytes(content)
            avatar_url_from_upload = f"/api/auth/avatar/{storage_name}"
    else:
        payload = handler.read_json()
    login = str(payload.get("login", "")).strip()
    password = str(payload.get("password", ""))
    with db() as con:
        row = con.execute(
            "SELECT * FROM users WHERE login = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
            (login,),
        ).fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            handler.send_json(HTTPStatus.UNAUTHORIZED, {"error": "bad_credentials"})
            return
        token = secrets.token_urlsafe(32)
        timestamp = now_ts()
        con.execute(
            """
            INSERT INTO sessions (user_id, token_hash, created_at, expires_at, user_agent, ip)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                token_hash(token),
                timestamp,
                timestamp + SESSION_TTL_SECONDS,
                handler.headers.get("User-Agent", ""),
                handler.client_address[0],
            ),
        )
        con.execute(
            "INSERT INTO audit_log (user_id, action, entity, created_at) VALUES (?, 'login', 'user', ?)",
            (row["id"], now_ts()),
        )
        con.commit()

    body = json.dumps({"user": user_payload(row)}, ensure_ascii=False).encode("utf-8")
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    set_session_cookie(handler, token)
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def api_logout(handler) -> None:
    token = session_token(handler)
    if token:
        with db() as con:
            con.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
            con.commit()
    body = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    clear_session_cookie(handler)
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def api_me(handler) -> None:
    if clerk_enabled():
        user, error = current_user_from_clerk(handler)
        if user:
            handler.send_json(HTTPStatus.OK, {"user": user})
            return
        if error:
            status = HTTPStatus.FORBIDDEN if error == "clerk_user_not_provisioned" else HTTPStatus.UNAUTHORIZED
            handler.send_json(status, {"error": error})
            return
    user = current_user(handler)
    if not user:
        handler.send_json(HTTPStatus.UNAUTHORIZED, {"error": "auth_required"})
        return
    handler.send_json(HTTPStatus.OK, {"user": user})


def api_update_profile(handler) -> None:
    user = require_user(handler)
    if not user:
        return

    payload = handler.read_json()
    first_name = re.sub(r"\s+", " ", str(payload.get("first_name", "") or "").strip())
    last_name = re.sub(r"\s+", " ", str(payload.get("last_name", "") or "").strip())
    name = re.sub(r"\s+", " ", str(payload.get("name", "") or "").strip())
    if not name:
        name = (first_name + " " + last_name).strip()
    if not name:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "name_required", "message": "Укажите имя"})
        return
    if len(name) > 160:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "name_too_long", "message": "Имя слишком длинное"})
        return

    avatar_url = avatar_url_from_upload or str(payload.get("avatar_url", payload.get("avatarUrl", "")) or "").strip()
    if avatar_url and not (re.match(r"^https?://", avatar_url, re.IGNORECASE) or avatar_url.startswith("/api/auth/avatar/")):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_avatar_url", "message": "Аватарка должна быть ссылкой http/https"})
        return
    if len(avatar_url) > 2048:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "avatar_url_too_long", "message": "Ссылка на аватарку слишком длинная"})
        return

    with db() as con:
        columns = {row["name"] for row in con.execute("PRAGMA table_info(users)").fetchall()}
        updates = ["name = ?", "updated_at = ?"]
        values = [name, now_ts()]
        if "avatar_url" in columns:
            updates.append("avatar_url = ?")
            values.append(avatar_url or None)
        values.append(user["id"])
        con.execute(
            "UPDATE users SET " + ", ".join(updates) + " WHERE id = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
            values,
        )
        con.commit()
        row = con.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

    if not row:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "user_not_found"})
        return
    handler.send_json(HTTPStatus.OK, {"user": user_payload(row)})


def api_avatar_file(handler, path: str) -> None:
    filename = path.rsplit("/", 1)[-1]
    if not re.match(r"^user_\d+_\d+_[a-f0-9]{12}\.(png|jpg|webp|gif)$", filename):
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        return
    file_path = AVATARS_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        return
    mime_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(file_path.suffix.lower(), "application/octet-stream")
    handler.send_file(file_path, mime_type, filename, inline=True)
