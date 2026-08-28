from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import smtplib
import sqlite3
import threading
import time
import urllib.parse
import urllib.request
import urllib.error
from email.message import EmailMessage
from http import HTTPStatus
from pathlib import Path

import jwt
from PIL import Image, UnidentifiedImageError
from sqlite_config import connect_database


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
AVATARS_DIR = DATA_DIR / "avatars"
AVATAR_MAX_BYTES = 5 * 1024 * 1024
AVATAR_MAX_PIXELS = 20_000_000
AVATAR_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
AVATAR_FORMATS = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WEBP",
    "image/gif": "GIF",
}


def load_env_file(path: Path | None = None) -> None:
    env_path = path or (PROJECT_ROOT / ".env")
    if not env_path.is_file():
        return
    try:
        lines = env_path.read_text(encoding="utf-8-sig").splitlines()
    except OSError:
        return
    for line in lines:
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[key] = value


load_env_file()


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)) or default)
    except (TypeError, ValueError):
        return default


def save_avatar_upload(handler, avatar_item, user_id: int) -> tuple[bool, str | None]:
    if avatar_item is None or not getattr(avatar_item, "filename", ""):
        return True, None

    mime_type = str(getattr(avatar_item, "type", "") or "").split(";", 1)[0].strip().lower()
    ext = AVATAR_EXTENSIONS.get(mime_type)
    if not ext:
        handler.send_json(
            HTTPStatus.BAD_REQUEST,
            {"error": "bad_avatar_type", "message": "Загрузите PNG, JPG, WEBP или GIF"},
        )
        return False, None

    content = avatar_item.file.read(AVATAR_MAX_BYTES + 1)
    if not content:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "empty_avatar"})
        return False, None
    if len(content) > AVATAR_MAX_BYTES:
        handler.send_json(
            HTTPStatus.BAD_REQUEST,
            {"error": "avatar_too_large", "message": "Аватарка должна быть меньше 5 МБ"},
        )
        return False, None

    try:
        with Image.open(io.BytesIO(content)) as image:
            if (
                str(image.format or "").upper() != AVATAR_FORMATS[mime_type]
                or image.width <= 0
                or image.height <= 0
                or image.width * image.height > AVATAR_MAX_PIXELS
            ):
                raise ValueError("bad_avatar_image")
            image.verify()
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_avatar_image"})
        return False, None

    storage_name = f"user_{user_id}_{now_ts()}_{secrets.token_hex(6)}{ext}"
    try:
        AVATARS_DIR.mkdir(parents=True, exist_ok=True)
        (AVATARS_DIR / storage_name).write_bytes(content)
    except OSError as error:
        handler.send_json(
            HTTPStatus.SERVICE_UNAVAILABLE,
            {
                "error": "avatar_storage_unavailable",
                "message": "Не удалось сохранить аватарку на сервере. Проверьте права на папку data/avatars.",
                "detail": str(error),
            },
        )
        return False, None

    return True, f"/api/auth/avatar/{storage_name}"

LOGIN_PATH = "/login"
DEFAULT_AUTH_PATH = "/app/dashboard"
SESSION_COOKIE = "pmbi_session"
SESSION_TTL_SECONDS = 60 * 60 * 12
REMEMBER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
PASSWORD_ITERATIONS = 220_000
TEMP_PASSWORD_LENGTH = 12
PASSWORD_RESET_EMAIL_LIMIT = 5
PASSWORD_RESET_IP_LIMIT = 20
PASSWORD_RESET_WINDOW_SECONDS = 60 * 60
PASSWORD_CHANGE_BAD_ATTEMPT_LIMIT = 8
PASSWORD_CHANGE_WINDOW_SECONDS = 15 * 60
LOGIN_ACCOUNT_ATTEMPT_LIMIT = 10
LOGIN_IP_ATTEMPT_LIMIT = 60
LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60

PMBI_PUBLIC_BASE_URL = (os.environ.get("PMBI_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
PMBI_FORCE_SECURE_COOKIES = (os.environ.get("PMBI_FORCE_SECURE_COOKIES", "") or "").strip().lower() in {"1", "true", "yes", "on"}
PMBI_TRUST_PROXY_HEADERS = (os.environ.get("PMBI_TRUST_PROXY_HEADERS", "") or "").strip().lower() in {"1", "true", "yes", "on"}
PMBI_SMTP_HOST = (os.environ.get("PMBI_SMTP_HOST", "") or "").strip()
PMBI_SMTP_PORT = env_int("PMBI_SMTP_PORT", 587)
PMBI_SMTP_USERNAME = (os.environ.get("PMBI_SMTP_USERNAME", "") or "").strip()
PMBI_SMTP_PASSWORD = re.sub(r"\s+", "", (os.environ.get("PMBI_SMTP_PASSWORD", "") or ""))
PMBI_SMTP_FROM = (os.environ.get("PMBI_SMTP_FROM", "") or PMBI_SMTP_USERNAME).strip()
PMBI_SMTP_USE_SSL = (os.environ.get("PMBI_SMTP_USE_SSL", "") or "").strip().lower() in {"1", "true", "yes", "on"}
PMBI_SMTP_USE_TLS = (os.environ.get("PMBI_SMTP_USE_TLS", "1") or "").strip().lower() in {"1", "true", "yes", "on"}
PMBI_MAIL_PROVIDER = (os.environ.get("PMBI_MAIL_PROVIDER", "smtp") or "smtp").strip().lower()
PMBI_RESEND_API_KEY = (os.environ.get("PMBI_RESEND_API_KEY", "") or "").strip()
PMBI_RESEND_FROM = (os.environ.get("PMBI_RESEND_FROM", "") or PMBI_SMTP_FROM).strip()
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
    "main_admin": ["*"],
    "admin": ["*"],
    "director": ["*"],
    "foreman": ["/app", "/app/dashboard", "/app/daily-tasks", "/app/projects", "/app/schedule", "/app/logs", "/app/warehouse", "/app/suppliers"],
    "buyer": ["/app", "/app/dashboard", "/app/daily-tasks", "/app/projects", "/app/logs", "/app/warehouse", "/app/suppliers"],
    "purchaser": ["/app", "/app/dashboard", "/app/daily-tasks", "/app/projects", "/app/logs", "/app/warehouse", "/app/suppliers"],
    "financier": ["/app", "/app/dashboard", "/app/daily-tasks", "/app/projects"],
    "accountant": ["/app", "/app/dashboard", "/app/daily-tasks", "/app/projects"],
    "client": ["/app", "/app/dashboard", "/app/projects", "/app/schedule", "/app/logs"],
    "customer": ["/app", "/app/dashboard", "/app/projects", "/app/schedule", "/app/logs"],
    "guest": ["/app/projects"],
}

ROLE_LABELS = {
    "main_admin": "Главный Админ",
    "admin": "Администратор",
    "director": "Директор",
    "foreman": "Прораб",
    "purchaser": "Закупщик",
    "buyer": "Закупщик",
    "financier": "Ответственный за финплан",
    "accountant": "Бухгалтер",
    "customer": "Заказчик",
    "client": "Заказчик",
    "guest": "Гость",
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
    "guest": "Гостевой доступ только к отчётам и графику одного назначенного объекта.",
}

ALL_MODULES = [
    "dashboard",
    "daily_tasks",
    "projects",
    "autobot",
    "companies",
    "schedule",
    "logs",
    "warehouse",
    "suppliers",
    "users",
]

DEFAULT_ROLE_PERMISSIONS = {
    "main_admin": {"fullAccess": True, "modules": ALL_MODULES, "projects": "edit", "dailyTasks": "all", "manageUsers": True, "manageRoles": True},
    "admin": {"fullAccess": True, "modules": ALL_MODULES, "projects": "edit", "dailyTasks": "all", "manageUsers": True, "manageRoles": True},
    "director": {"fullAccess": True, "modules": ALL_MODULES, "projects": "edit", "dailyTasks": "all", "manageUsers": True, "manageRoles": True},
    "foreman": {"modules": ["dashboard", "daily_tasks", "projects", "schedule", "logs", "warehouse", "suppliers", "users"], "projects": "edit", "dailyTasks": "own"},
    "purchaser": {"modules": ["dashboard", "daily_tasks", "projects", "logs", "warehouse", "suppliers", "users"], "projects": "view", "suppliers": "edit", "dailyTasks": "own"},
    "buyer": {"modules": ["dashboard", "daily_tasks", "projects", "logs", "warehouse", "suppliers", "users"], "projects": "view", "suppliers": "edit", "dailyTasks": "own"},
    "financier": {"modules": ["dashboard", "daily_tasks", "projects", "users"], "projects": "view", "dailyTasks": "own"},
    "accountant": {"modules": ["dashboard", "daily_tasks", "projects", "users"], "projects": "view", "dailyTasks": "own"},
    "customer": {"modules": ["dashboard", "projects", "schedule", "logs", "users"], "projects": "view"},
    "client": {"modules": ["dashboard", "projects", "schedule", "logs", "users"], "projects": "view"},
    "guest": {"modules": ["projects"], "projects": "view", "guest": True},
}

LEGACY_ROLE_ALIASES = {
    "buyer": "purchaser",
    "client": "customer",
}
ROLE_CODES = tuple(ROLE_LABELS.keys())
PUBLIC_STATIC_PATHS = {"/", "/index.html", LOGIN_PATH, "/robots.txt"}
AUTH_RATE_LIMITS: dict[str, list[int]] = {}

PROCUREMENT_PRICE_ROLES = {"main_admin", "admin", "director"}
PROJECT_ECONOMICS_ROLES = {"main_admin", "admin", "director"}
PROCUREMENT_PRICE_FIELDS = {
    "plannedPrice",
    "planned_price",
    "estimateUnitPrice",
    "estimate_unit_price",
    "estimateTotal",
    "estimate_total",
    "marketPrice",
    "market_price",
    "marketPriceText",
    "market_price_text",
    "marketSource",
    "market_source",
    "marketAnalyzedAt",
    "market_analyzed_at",
    "marketEstimateVersion",
    "market_estimate_version",
    "marketPriceIsFresh",
    "market_price_is_fresh",
    "marketPriceIsStale",
    "market_price_is_stale",
    "sources",
    "sourceCount",
    "source_count",
    "enteredPrice",
    "entered_price",
    "marginPercent",
    "margin_percent",
    "activeOffer",
    "active_offer",
    "procurementLimit",
    "procurement_limit",
    "limitCheck",
    "limit_check",
    "estimateVersion",
    "estimate_version",
    "analyzedAt",
    "analyzed_at",
    "deltaPerUnit",
    "delta_per_unit",
    "deltaTotal",
    "delta_total",
    "compareToEstimate",
    "compare_to_estimate",
    "priceChanged",
    "price_changed",
    "priceDelta",
    "price_delta",
}
AUTH_RATE_LIMIT_LOCK = threading.Lock()


def now_ts() -> int:
    return int(time.time())


def handler_client_ip(handler) -> str:
    if PMBI_TRUST_PROXY_HEADERS:
        forwarded_for = str(handler.headers.get("X-Forwarded-For", "") or "").split(",", 1)[0].strip()
        if forwarded_for:
            return forwarded_for[:80]
    try:
        return str(handler.client_address[0] or "")
    except Exception:
        return "unknown"


def auth_rate_limit_key(bucket: str, key: str) -> str:
    return f"{bucket}:{str(key or '').strip().lower()}"


def auth_rate_limited(bucket: str, key: str, limit: int, window_seconds: int) -> bool:
    current = now_ts()
    cutoff = current - window_seconds
    cache_key = auth_rate_limit_key(bucket, key)
    with AUTH_RATE_LIMIT_LOCK:
        attempts = [timestamp for timestamp in AUTH_RATE_LIMITS.get(cache_key, []) if timestamp >= cutoff]
        if len(attempts) >= limit:
            AUTH_RATE_LIMITS[cache_key] = attempts
            return True
        attempts.append(current)
        AUTH_RATE_LIMITS[cache_key] = attempts
        if len(AUTH_RATE_LIMITS) > 1000:
            stale_keys = [
                item_key
                for item_key, item_attempts in AUTH_RATE_LIMITS.items()
                if not item_attempts or max(item_attempts) < cutoff
            ]
            for item_key in stale_keys:
                AUTH_RATE_LIMITS.pop(item_key, None)
        return False


def clear_auth_rate_limit(bucket: str, key: str) -> None:
    with AUTH_RATE_LIMIT_LOCK:
        AUTH_RATE_LIMITS.pop(auth_rate_limit_key(bucket, key), None)


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return connect_database(DB_PATH)


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


def validate_new_password(password: str) -> tuple[bool, str | None]:
    if len(password) < 8:
        return False, "password_too_short"
    if len(password) > 128:
        return False, "password_too_long"
    return True, None


def generate_temporary_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(TEMP_PASSWORD_LENGTH))


def smtp_configured() -> bool:
    if not (PMBI_SMTP_HOST and PMBI_SMTP_FROM):
        return False
    return bool(PMBI_SMTP_PASSWORD) if PMBI_SMTP_USERNAME else True


def mail_configured() -> bool:
    if PMBI_MAIL_PROVIDER == "resend":
        return bool(PMBI_RESEND_API_KEY and PMBI_RESEND_FROM)
    return smtp_configured()


def password_reset_email_text(login: str, temporary_password: str) -> str:
    return "\n".join(
        [
            "Здравствуйте.",
            "",
            "Для вашей учетной записи PM.bi был выпущен новый временный пароль.",
            f"Логин: {login}",
            f"Временный пароль: {temporary_password}",
            "",
            "Войдите с этим паролем и смените его в личном кабинете.",
            "Если вы не запрашивали восстановление, сообщите администратору.",
        ]
    )


def send_password_reset_email_resend(email: str, login: str, temporary_password: str) -> None:
    payload = json.dumps(
        {
            "from": PMBI_RESEND_FROM,
            "to": [email],
            "subject": "PM.bi: новый пароль для входа",
            "text": password_reset_email_text(login, temporary_password),
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {PMBI_RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "pmbi-crm/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status >= 400:
                raise RuntimeError(f"resend_http_{response.status}")
    except urllib.error.HTTPError as error:
        detail = error.read(800).decode("utf-8", errors="replace")
        raise RuntimeError(f"resend_http_{error.code}: {detail}") from error


def send_password_reset_email(email: str, login: str, temporary_password: str) -> None:
    if not mail_configured():
        raise RuntimeError("mail_not_configured")
    if PMBI_MAIL_PROVIDER == "resend":
        send_password_reset_email_resend(email, login, temporary_password)
        return
    message = EmailMessage()
    message["Subject"] = "PM.bi: новый пароль для входа"
    message["From"] = PMBI_SMTP_FROM
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "Здравствуйте.",
                "",
                "Для вашей учетной записи PM.bi был выпущен новый временный пароль.",
                f"Логин: {login}",
                f"Временный пароль: {temporary_password}",
                "",
                "Войдите с этим паролем и смените его в личном кабинете.",
                "Если вы не запрашивали восстановление, сообщите администратору.",
            ]
        )
    )
    smtp_class = smtplib.SMTP_SSL if PMBI_SMTP_USE_SSL else smtplib.SMTP
    with smtp_class(PMBI_SMTP_HOST, PMBI_SMTP_PORT, timeout=15) as smtp:
        if PMBI_SMTP_USE_TLS and not PMBI_SMTP_USE_SSL:
            smtp.starttls()
        if PMBI_SMTP_USERNAME:
            smtp.login(PMBI_SMTP_USERNAME, PMBI_SMTP_PASSWORD)
        smtp.send_message(message)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def normalize_role(role: str | None) -> str:
    role_code = str(role or "").strip()
    return LEGACY_ROLE_ALIASES.get(role_code, role_code)


def split_user_name(value: str | None, first_name: str | None = None, last_name: str | None = None) -> tuple[str, str]:
    first = str(first_name or "").strip()
    last = str(last_name or "").strip()
    if first or last:
        return first, last
    parts = re.sub(r"\s+", " ", str(value or "").strip()).split(" ", 1)
    if not parts or not parts[0]:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def display_user_name(value: str | None = None, first_name: str | None = None, last_name: str | None = None, fallback: str = "") -> str:
    first, last = split_user_name(value, first_name, last_name)
    display = " ".join(part for part in [last, first] if part).strip()
    return display or str(value or fallback or "").strip()


def row_display_name(row: sqlite3.Row) -> str:
    return display_user_name(
        row["name"] if "name" in row.keys() else "",
        row["first_name"] if "first_name" in row.keys() else "",
        row["last_name"] if "last_name" in row.keys() else "",
        row["login"] if "login" in row.keys() else "",
    )


def default_permissions_for_role(role: str | None) -> dict:
    role_code = normalize_role(role)
    payload = DEFAULT_ROLE_PERMISSIONS.get(role_code, {"modules": ["dashboard"]})
    return json.loads(json.dumps(payload, ensure_ascii=False))


def normalize_permissions(value: object, role: str | None = None) -> dict:
    base = default_permissions_for_role(role)
    if isinstance(value, str) and value.strip():
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = {}
    if not isinstance(value, dict):
        value = {}
    merged = {**base, **value}
    modules = merged.get("modules")
    if merged.get("fullAccess"):
        merged["modules"] = list(ALL_MODULES)
        merged["manageUsers"] = True
        merged["manageRoles"] = True
        merged["projects"] = "edit"
        merged["dailyTasks"] = "all"
    elif isinstance(modules, list):
        merged["modules"] = [str(item) for item in modules if str(item)]
    else:
        merged["modules"] = list(base.get("modules", ["dashboard"]))
    return merged


def role_permissions_from_db(con: sqlite3.Connection, role_code: str) -> dict:
    role_code = normalize_role(role_code)
    try:
        row = con.execute("SELECT permissions FROM roles WHERE code = ?", (role_code,)).fetchone()
        if row and "permissions" in row.keys():
            return normalize_permissions(row["permissions"], role_code)
    except sqlite3.Error:
        pass
    return default_permissions_for_role(role_code)


def merge_permissions(items: list[dict]) -> dict:
    merged: dict = {"modules": []}
    for item in items:
        perms = normalize_permissions(item)
        if perms.get("fullAccess"):
            return normalize_permissions({"fullAccess": True}, "admin")
        merged["modules"] = sorted(set(merged.get("modules", [])) | set(perms.get("modules", [])))
        for key in ("manageUsers", "manageRoles"):
            merged[key] = bool(merged.get(key) or perms.get(key))
        for key in ("projects", "suppliers", "dailyTasks"):
            current = merged.get(key)
            incoming = perms.get(key)
            if incoming == "edit" or incoming == "all":
                merged[key] = incoming
            elif not current and incoming:
                merged[key] = incoming
    return merged


def user_permissions(user: dict) -> dict:
    if not user:
        return {"modules": []}
    if isinstance(user.get("permissions"), dict):
        return normalize_permissions(user["permissions"], user.get("role"))
    roles = [normalize_role(user.get("role"))] + [
        normalize_role(role.get("code") if isinstance(role, dict) else role)
        for role in user.get("roles", [])
    ]
    roles = list(dict.fromkeys([role for role in roles if role]))
    try:
        with db() as con:
            return merge_permissions([role_permissions_from_db(con, role) for role in roles])
    except sqlite3.Error:
        return merge_permissions([default_permissions_for_role(role) for role in roles])


def user_can_manage_roles(user: dict) -> bool:
    return user_is_main_admin(user)


def user_can_manage_users(user: dict) -> bool:
    return user_is_main_admin(user)


def user_is_hidden_admin(user: dict | sqlite3.Row | None) -> bool:
    if not user:
        return False
    login = str(user["login"] if isinstance(user, sqlite3.Row) else user.get("login", "")).strip().lower()
    role = normalize_role(user["role"] if isinstance(user, sqlite3.Row) else user.get("role"))
    return login == "admin" or role == "admin"


def user_is_main_admin_account(user: dict | sqlite3.Row | None) -> bool:
    if not user:
        return False
    login = str(user["login"] if isinstance(user, sqlite3.Row) else user.get("login", "")).strip().lower()
    role = normalize_role(user["role"] if isinstance(user, sqlite3.Row) else user.get("role"))
    if login == "admin" or role == "main_admin":
        return True
    if not isinstance(user, sqlite3.Row):
        return user_has_any_role(user, {"main_admin"})
    return False


def user_payload(row: sqlite3.Row) -> dict:
    keys = set(row.keys())
    role = normalize_role(row["role"])
    if str(row["login"] or "").strip().lower() == "admin":
        role = "admin"
    roles = [role]
    permissions = merge_permissions([default_permissions_for_role(role)])
    try:
        with db() as con:
            role_rows = con.execute(
                """
                SELECT r.code, r.permissions
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = ?
                ORDER BY r.id
                """,
                (row["id"],),
            ).fetchall()
            roles = [normalize_role(role_row["code"]) for role_row in role_rows] or roles
            permissions = merge_permissions([normalize_permissions(role_row["permissions"], role_row["code"]) for role_row in role_rows]) if role_rows else permissions
    except sqlite3.Error:
        roles = [role]
        permissions = merge_permissions([default_permissions_for_role(role)])
    if role == "admin":
        roles = ["admin"]
        permissions = normalize_permissions({"fullAccess": True}, "admin")
    can_view_procurement_prices = bool(set(roles) & PROCUREMENT_PRICE_ROLES)
    permissions["canViewProcurementPrices"] = can_view_procurement_prices
    if not can_view_procurement_prices:
        permissions["modules"] = [
            module for module in permissions.get("modules", [])
            if module != "autobot"
        ]
    legacy_name = row["name"] if "name" in keys else ""
    first_name_value = row["first_name"] if "first_name" in keys else ""
    last_name_value = row["last_name"] if "last_name" in keys else ""
    login = row["login"] if "login" in keys else "User"
    first_name, last_name = split_user_name(
        legacy_name,
        first_name_value,
        last_name_value,
    )
    display_name = display_user_name(legacy_name, first_name, last_name, login)
    return {
        "id": row["id"],
        "login": login,
        "email": row["email"] if "email" in keys else None,
        "phone": row["phone"] if "phone" in keys else None,
        "clerkUserId": row["clerk_user_id"] if "clerk_user_id" in keys else None,
        "role": role,
        "roles": sorted(set(roles)),
        "roleLabel": ROLE_LABELS.get(role, role),
        "permissions": permissions,
        "firstName": first_name,
        "lastName": last_name,
        "displayName": display_name,
        "name": display_name,
        "avatarUrl": row["avatar_url"] if "avatar_url" in keys else None,
        "isGuest": role == "guest" or "guest" in set(roles),
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
    user_roles.update(normalize_role(role.get("code") if isinstance(role, dict) else role) for role in user.get("roles", []))
    return bool(user_roles & roles)


def user_is_guest(user: dict | None) -> bool:
    return bool(user) and (bool(user.get("isGuest")) or user_has_any_role(user, {"guest"}))


def user_default_path(user: dict | None) -> str:
    return "/app/projects" if user_is_guest(user) else DEFAULT_AUTH_PATH


def guest_api_allowed(method: str, path: str) -> bool:
    """Guest API policy is intentionally default-deny and exact-route based."""

    method = str(method or "").upper()
    if (method, path) in {
        ("POST", "/api/auth/login"),
        ("POST", "/api/auth/logout"),
        ("POST", "/api/auth/request-password-reset"),
        ("GET", "/api/auth/me"),
        ("GET", "/api/projects"),
    }:
        return True
    if method == "GET" and re.fullmatch(r"/api/documents/\d+/view", path):
        return True
    return method == "GET" and bool(
        re.fullmatch(r"/api/projects/\d+/(?:daily-logs|production-schedule)", path)
    )


def user_is_main_admin(user: dict) -> bool:
    return user_is_main_admin_account(user) or user_is_hidden_admin(user)


def user_can_view_procurement_prices(user: dict | None) -> bool:
    if not user:
        return False
    return user_is_main_admin(user) or user_has_any_role(user, PROCUREMENT_PRICE_ROLES)


def user_can_view_project_economics(user: dict | None) -> bool:
    if not user:
        return False
    return user_is_main_admin(user) or user_has_any_role(user, PROJECT_ECONOMICS_ROLES)


def user_can_manage_project_economics(user: dict | None) -> bool:
    return user_can_view_project_economics(user)


def user_can_submit_procurement_price(user: dict | None) -> bool:
    if not user:
        return False
    return user_can_view_procurement_prices(user) or not user_has_any_role(user, {"customer", "client"})


def payload_has_procurement_prices(value: object) -> bool:
    if isinstance(value, dict):
        return any(
            str(key) in PROCUREMENT_PRICE_FIELDS or payload_has_procurement_prices(item)
            for key, item in value.items()
        )
    if isinstance(value, (list, tuple)):
        return any(payload_has_procurement_prices(item) for item in value)
    return False


def redact_procurement_prices(value: object, user: dict | None) -> object:
    if user_can_view_procurement_prices(user):
        return value
    if isinstance(value, dict):
        return {
            key: redact_procurement_prices(item, user)
            for key, item in value.items()
            if str(key) not in PROCUREMENT_PRICE_FIELDS
        }
    if isinstance(value, list):
        return [redact_procurement_prices(item, user) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_procurement_prices(item, user) for item in value)
    return value


def user_can_open(user: dict, path: str) -> bool:
    if path in PUBLIC_STATIC_PATHS:
        return True
    if user_is_guest(user):
        return path == "/app/projects"
    if path == "/app/autobot" and not user_can_view_procurement_prices(user):
        return False
    if path == "/app":
        return not user_is_guest(user)
    if path == "/app/users" and not user_is_guest(user):
        return True
    module_by_path = {
        "/app/dashboard": "dashboard",
        "/app/daily-tasks": "daily_tasks",
        "/app/projects": "projects",
        "/app/autobot": "autobot",
        "/app/companies": "companies",
        "/app/schedule": "schedule",
        "/app/logs": "logs",
        "/app/warehouse": "warehouse",
        "/app/suppliers": "suppliers",
        "/app/users": "users",
    }
    module = module_by_path.get(path)
    if module:
        return module in set(user_permissions(user).get("modules", []))
    user_roles = {normalize_role(user.get("role"))}
    user_roles.update(normalize_role(role.get("code") if isinstance(role, dict) else role) for role in user.get("roles", []))
    return any(role_can_open(role, path) for role in user_roles)


def user_can_manage_documents(user: dict) -> bool:
    return bool(user_permissions(user).get("fullAccess")) or user_has_any_role(user, {"admin", "director", "foreman", "purchaser", "financier", "accountant"})


def user_can_manage_suppliers(user: dict) -> bool:
    perms = user_permissions(user)
    return perms.get("suppliers") == "edit" or bool(perms.get("fullAccess")) or user_has_any_role(user, {"admin", "director", "foreman", "purchaser"})


def user_can_manage_finances(user: dict) -> bool:
    return user_can_view_procurement_prices(user)


def user_can_view_finances(user: dict) -> bool:
    return user_can_view_procurement_prices(user)


def can_see_finances(user: dict) -> bool:
    return user_can_view_finances(user)


def user_can_pay_invoices(user: dict) -> bool:
    return user_has_any_role(user, {"admin", "director"})


def user_can_manage_schedule(user: dict) -> bool:
    return "schedule" in set(user_permissions(user).get("modules", [])) and (user_permissions(user).get("projects") == "edit" or user_has_any_role(user, {"admin", "director", "foreman"}))


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
        "clerkAfterSignOutUrl": "/",
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


def _resolve_current_user_from_clerk(handler) -> tuple[dict | None, str | None]:
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
    first_name = str(clerk_user.get("first_name") or "").strip()
    last_name = str(clerk_user.get("last_name") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
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
                first_name = CASE WHEN trim(COALESCE(first_name, '')) = '' AND ? != '' THEN ? ELSE first_name END,
                last_name = CASE WHEN trim(COALESCE(last_name, '')) = '' AND ? != '' THEN ? ELSE last_name END,
                name = CASE WHEN trim(COALESCE(name, '')) = '' AND ? != '' THEN ? ELSE name END,
                    updated_at = ?
            WHERE id = ?
            """,
            (clerk_user_id, email, phone, first_name, first_name, last_name, last_name, full_name, full_name, now_ts(), row["id"]),
        )
        con.commit()
        refreshed = con.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
    return user_payload(refreshed), None


def current_user_from_clerk(handler) -> tuple[dict | None, str | None]:
    """Resolve Clerk authentication at most once for one HTTP request."""

    cache_attribute = "_pmbi_clerk_auth_result"
    if hasattr(handler, cache_attribute):
        return getattr(handler, cache_attribute)
    result = _resolve_current_user_from_clerk(handler)
    setattr(handler, cache_attribute, result)
    return result


def current_user(handler) -> dict | None:
    cache_attribute = "_pmbi_current_user"
    if hasattr(handler, cache_attribute):
        return getattr(handler, cache_attribute)
    if clerk_enabled():
        user, _error = current_user_from_clerk(handler)
        if user:
            setattr(handler, cache_attribute, user)
            return user
    token = session_token(handler)
    if not token:
        setattr(handler, cache_attribute, None)
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
        user = user_payload(row) if row else None
    setattr(handler, cache_attribute, user)
    return user


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
    if not user_has_any_role(user, roles) and not user_permissions(user).get("fullAccess"):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return None
    return user


def session_cookie_secure_attr(handler) -> str:
    forwarded_proto = str(handler.headers.get("X-Forwarded-Proto", "") or "").split(",", 1)[0].strip().lower()
    is_https = forwarded_proto == "https" or PMBI_FORCE_SECURE_COOKIES
    return "; Secure" if is_https else ""


def set_session_cookie(handler, token: str, max_age: int = SESSION_TTL_SECONDS) -> None:
    handler.send_header(
        "Set-Cookie",
        f"{SESSION_COOKIE}={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Lax{session_cookie_secure_attr(handler)}",
    )


def clear_session_cookie(handler) -> None:
    handler.send_header(
        "Set-Cookie",
        f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax{session_cookie_secure_attr(handler)}",
    )


def api_login(handler) -> None:
    previous_session_token = session_token(handler)
    content_type = handler.headers.get("Content-Type", "")
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
            "login": form_value("login"),
            "password": form_value("password"),
            "rememberMe": form_value("rememberMe").strip().lower()
            in {"1", "true", "yes", "on"},
        }
        avatar_item = form["avatar"] if "avatar" in form else None
        if isinstance(avatar_item, list):
            avatar_item = avatar_item[0] if avatar_item else None
        if avatar_item is not None and getattr(avatar_item, "filename", ""):
            handler.send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": "login_avatar_not_supported"},
            )
            return
    else:
        payload = handler.read_json()
    login = str(payload.get("login", "")).strip()
    password = str(payload.get("password", ""))
    remember_me = bool(payload.get("rememberMe") or payload.get("remember_me"))
    login_rate_key = login.casefold() or "<empty>"
    client_ip = handler_client_ip(handler)
    account_limited = auth_rate_limited(
        "login_account",
        login_rate_key,
        LOGIN_ACCOUNT_ATTEMPT_LIMIT,
        LOGIN_ATTEMPT_WINDOW_SECONDS,
    )
    ip_limited = auth_rate_limited(
        "login_ip",
        client_ip,
        LOGIN_IP_ATTEMPT_LIMIT,
        LOGIN_ATTEMPT_WINDOW_SECONDS,
    )
    if account_limited or ip_limited:
        handler.send_json(
            HTTPStatus.TOO_MANY_REQUESTS,
            {"error": "too_many_login_attempts"},
        )
        return
    session_ttl = REMEMBER_SESSION_TTL_SECONDS if remember_me else SESSION_TTL_SECONDS
    with db() as con:
        row = con.execute(
            "SELECT * FROM users WHERE login = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
            (login,),
        ).fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            handler.send_json(HTTPStatus.UNAUTHORIZED, {"error": "bad_credentials"})
            return
        if clerk_enabled() and normalize_role(row["role"]) != "guest":
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "clerk_enabled"})
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
                timestamp + session_ttl,
                handler.headers.get("User-Agent", ""),
                handler.client_address[0],
            ),
        )
        con.execute(
            "INSERT INTO audit_log (user_id, action, entity, created_at) VALUES (?, 'login', 'user', ?)",
            (row["id"], now_ts()),
        )
        if previous_session_token:
            try:
                con.execute(
                    "DELETE FROM guest_sessions WHERE token_hash = ?",
                    (token_hash(previous_session_token),),
                )
            except sqlite3.Error:
                pass
        con.commit()

    clear_auth_rate_limit("login_account", login_rate_key)
    clear_auth_rate_limit("login_ip", client_ip)

    body = json.dumps({"user": user_payload(row)}, ensure_ascii=False).encode("utf-8")
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    set_session_cookie(handler, token, session_ttl)
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def api_request_password_reset(handler) -> None:
    if clerk_enabled():
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "clerk_enabled"})
        return
    payload = handler.read_json()
    email = str(payload.get("email", payload.get("login", "")) or "").strip().lower()
    if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        handler.send_json(
            HTTPStatus.BAD_REQUEST,
            {"error": "bad_email", "message": "Введите email, указанный в учетной записи."},
        )
        return
    if not mail_configured():
        handler.send_json(
            HTTPStatus.SERVICE_UNAVAILABLE,
            {
                "error": "mail_not_configured",
                "message": "Отправка почты не настроена. Обратитесь к администратору.",
            },
        )
        return
    if auth_rate_limited("password_reset_email", email, PASSWORD_RESET_EMAIL_LIMIT, PASSWORD_RESET_WINDOW_SECONDS) or auth_rate_limited(
        "password_reset_ip",
        handler_client_ip(handler),
        PASSWORD_RESET_IP_LIMIT,
        PASSWORD_RESET_WINDOW_SECONDS,
    ):
        handler.send_json(
            HTTPStatus.TOO_MANY_REQUESTS,
            {
                "error": "too_many_password_resets",
                "message": "Слишком много запросов восстановления. Попробуйте позже.",
            },
        )
        return

    generic_payload = {
        "ok": True,
        "message": "Если такой email есть в системе, новый пароль отправлен на почту.",
    }
    with db() as con:
        row = con.execute(
            "SELECT * FROM users WHERE lower(email) = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
            (email,),
        ).fetchone()
        if not row:
            handler.send_json(HTTPStatus.OK, generic_payload)
            return
        temporary_password = generate_temporary_password()
        try:
            send_password_reset_email(str(row["email"]), str(row["login"]), temporary_password)
        except smtplib.SMTPAuthenticationError:
            handler.send_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {
                    "error": "smtp_auth_failed",
                    "message": "Gmail не принял SMTP-пароль. Укажите в .env пароль приложения Google, а не обычный пароль от почты.",
                },
            )
            return
        except Exception:
            handler.send_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {
                    "error": "mail_send_failed",
                    "message": "Не удалось отправить письмо. Попробуйте позже или обратитесь к администратору.",
                },
            )
            return
        con.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (hash_password(temporary_password), now_ts(), row["id"]),
        )
        con.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        con.execute(
            "INSERT INTO audit_log (user_id, action, entity, created_at) VALUES (?, 'password_reset', 'user', ?)",
            (row["id"], now_ts()),
        )
        con.commit()
    handler.send_json(HTTPStatus.OK, generic_payload)


def api_change_password(handler) -> None:
    if clerk_enabled():
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "clerk_enabled"})
        return
    user = require_user(handler)
    if not user:
        return
    payload = handler.read_json()
    current_password = str(payload.get("currentPassword", payload.get("current_password", "")) or "")
    new_password = str(payload.get("newPassword", payload.get("new_password", "")) or "")
    if not current_password:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "current_password_required", "message": "Введите текущий пароль."})
        return
    ok, password_error = validate_new_password(new_password)
    if not ok:
        handler.send_json(
            HTTPStatus.BAD_REQUEST,
            {
                "error": password_error,
                "message": "Новый пароль должен быть от 8 до 128 символов.",
            },
        )
        return
    if hmac.compare_digest(current_password, new_password):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "same_password", "message": "Новый пароль должен отличаться от текущего."})
        return
    change_rate_key = f"{user['id']}:{handler_client_ip(handler)}"
    if auth_rate_limited("password_change", change_rate_key, PASSWORD_CHANGE_BAD_ATTEMPT_LIMIT, PASSWORD_CHANGE_WINDOW_SECONDS):
        handler.send_json(
            HTTPStatus.TOO_MANY_REQUESTS,
            {
                "error": "too_many_password_change_attempts",
                "message": "Слишком много попыток смены пароля. Попробуйте позже.",
            },
        )
        return

    with db() as con:
        row = con.execute(
            "SELECT * FROM users WHERE id = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
            (user["id"],),
        ).fetchone()
        if not row or not verify_password(current_password, row["password_hash"]):
            handler.send_json(HTTPStatus.UNAUTHORIZED, {"error": "bad_current_password", "message": "Текущий пароль указан неверно."})
            return
        con.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (hash_password(new_password), now_ts(), row["id"]),
        )
        token = session_token(handler)
        if token:
            con.execute(
                "DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?",
                (row["id"], token_hash(token)),
            )
        else:
            con.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        con.execute(
            "INSERT INTO audit_log (user_id, action, entity, created_at) VALUES (?, 'password_change', 'user', ?)",
            (row["id"], now_ts()),
        )
        con.commit()
    clear_auth_rate_limit("password_change", change_rate_key)
    handler.send_json(HTTPStatus.OK, {"ok": True})


def api_logout(handler) -> None:
    token = session_token(handler)
    if token:
        with db() as con:
            con.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
            try:
                con.execute("DELETE FROM guest_sessions WHERE token_hash = ?", (token_hash(token),))
            except sqlite3.Error:
                pass
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
        }
        if "avatar_url" in form:
            payload["avatar_url"] = form_value("avatar_url")
        if "avatarUrl" in form:
            payload["avatarUrl"] = form_value("avatarUrl")

        avatar_item = form["avatar"] if "avatar" in form else None
        if isinstance(avatar_item, list):
            avatar_item = avatar_item[0] if avatar_item else None
        ok, avatar_url_from_upload = save_avatar_upload(handler, avatar_item, int(user["id"]))
        if not ok:
            return
    else:
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

    has_avatar_url = avatar_url_from_upload is not None or "avatar_url" in payload or "avatarUrl" in payload
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
        if "first_name" in columns:
            updates.append("first_name = ?")
            values.append(first_name)
        if "last_name" in columns:
            updates.append("last_name = ?")
            values.append(last_name)
        if "avatar_url" in columns and has_avatar_url:
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
