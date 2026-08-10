from __future__ import annotations

import cgi
import html
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date, timedelta
from http import HTTPStatus
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

from auth import (
    DEFAULT_AUTH_PATH,
    LOGIN_PATH,
    PUBLIC_STATIC_PATHS,
    ROLE_CODES,
    ROLE_DESCRIPTIONS,
    ROLE_LABELS,
    auth_config as auth_core_config,
    api_login as auth_api_login,
    api_logout as auth_api_logout,
    api_me as auth_api_me,
    clerk_api_request,
    clerk_enabled,
    clerk_sign_in_script as auth_clerk_sign_in_script,
    current_user as auth_current_user,
    current_user_from_clerk as auth_current_user_from_clerk,
    hash_password,
    normalize_role,
    require_role as auth_require_role,
    require_user as auth_require_user,
    split_person_name,
    user_can_open,
    user_has_any_role,
)
from projects import (
    api_create_project as projects_api_create_project,
    api_create_project_assignment as projects_api_create_project_assignment,
    api_delete_project as projects_api_delete_project,
    api_project_assignments as projects_api_project_assignments,
    api_project_detail as projects_api_project_detail,
    api_projects as projects_api_projects,
    api_update_project as projects_api_update_project,
    can_access_project as projects_can_access_project,
    project_schedule_payload,
    require_project_access as projects_require_project_access,
    serialize_project,
    set_project_foremen as projects_set_project_foremen,
)
from warehouse import (
    api_clear_supplier_selection as warehouse_api_clear_supplier_selection,
    api_companies as warehouse_api_companies,
    api_create_company as warehouse_api_create_company,
    api_create_market_counterparty as warehouse_api_create_market_counterparty,
    api_create_supplier_offer as warehouse_api_create_supplier_offer,
    api_project_supplier_offers as warehouse_api_project_supplier_offers,
    api_project_warehouse_matches as warehouse_api_project_warehouse_matches,
    api_update_supplier_offer as warehouse_api_update_supplier_offer,
    api_warehouse_issue as warehouse_api_warehouse_issue,
    api_warehouse_items as warehouse_api_warehouse_items,
    api_warehouse_list as warehouse_api_warehouse_list,
    api_warehouse_receipt as warehouse_api_warehouse_receipt,
    api_warehouse_transfer as warehouse_api_warehouse_transfer,
    seed_warehouse_items,
)

from finance import (
    api_create_finance_entry as finance_api_create_finance_entry,
    api_pay_invoice as finance_api_pay_invoice,
    api_project_finances as finance_api_project_finances,
    api_update_finance_entry as finance_api_update_finance_entry,
    api_upload_finance_invoice as finance_api_upload_finance_invoice,
    recalc_project_finance_totals as finance_recalc_project_finance_totals,
)

from schedule_tasks import (
    api_create_project_stage as schedule_api_create_project_stage,
    api_create_task as schedule_api_create_task,
    api_material_schedule as schedule_api_material_schedule,
    api_project_section_bulk_complete as schedule_api_project_section_bulk_complete,
    api_update_estimate_item_completion as schedule_api_update_estimate_item_completion,
    api_project_auto_schedule as schedule_api_project_auto_schedule,
    api_project_schedule_status as schedule_api_project_schedule_status,
    api_project_section_schedule_forecast as schedule_api_project_section_schedule_forecast,
    api_project_stages as schedule_api_project_stages,
    api_project_tasks as schedule_api_project_tasks,
    api_save_material_schedule as schedule_api_save_material_schedule,
    api_update_project_schedule_status as schedule_api_update_project_schedule_status,
    api_update_stage as schedule_api_update_stage,
    api_update_task as schedule_api_update_task,
    build_material_schedule_payload,
    build_procurement_alerts,
    build_section_schedule_forecast,
    material_summary_rows,
    mark_project_schedule_draft,
    parse_iso_date,
)

from communications_docs import (
    api_chat_messages as comm_api_chat_messages,
    api_create_chat_message as comm_api_create_chat_message,
    api_create_daily_log as comm_api_create_daily_log,
    api_create_project_executive_doc as comm_api_create_project_executive_doc,
    api_delete_daily_log as comm_api_delete_daily_log,
    api_document_file as comm_api_document_file,
    api_project_chats as comm_api_project_chats,
    api_project_daily_logs as comm_api_project_daily_logs,
    api_project_documents as comm_api_project_documents,
    api_project_executive_docs as comm_api_project_executive_docs,
    api_project_notifications as comm_api_project_notifications,
    api_upload_project_document as comm_api_upload_project_document,
    can_access_chat as comm_can_access_chat,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEPLOY_ROOT = PROJECT_ROOT / "deploy"
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
FRONTEND_TEMPLATES = FRONTEND_ROOT / "templates"
FRONTEND_PAGES = FRONTEND_ROOT / "pages"
FRONTEND_ASSETS = FRONTEND_ROOT / "assets"
DATA_DIR = PROJECT_ROOT / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
BOOTSTRAP_PATH = DATA_DIR / "INITIAL_ADMIN.txt"

HOST = os.environ.get("PMBI_HOST", "127.0.0.1")
PORT = int(os.environ.get("PMBI_PORT", os.environ.get("PORT", "8080")))
PMBI_PUBLIC_BASE_URL = (os.environ.get("PMBI_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
PMBI_AUTOBOT_BASE_URL = (os.environ.get("PMBI_AUTOBOT_BASE_URL", "http://127.0.0.1:8765") or "").strip().rstrip("/")


APP_PAGES = {
    "/app": ("dashboard", "Панель"),
    "/app/dashboard": ("dashboard", "Панель"),
    "/app/projects": ("projects", "Объекты"),
    "/app/companies": ("companies", "Компании"),
    "/app/warehouse": ("warehouse", "Склад"),
    "/app/schedule": ("schedule", "График работ"),
    "/app/logs": ("logs", "Журнал работ"),
    "/app/chats": ("chats", "Чаты"),
    "/app/users": ("users", "Пользователи"),
    "/app/reports": ("reports", "Отчётность"),
}

APP_PAGES["/app/suppliers"] = ("suppliers", "Контрагенты")

APP_PAGES["/app/autobot"] = ("autobot", "AutoBot")

DIRECTOR_ACTION_BLOCK_RE = re.compile(
    r"<(?P<tag>section|button)\b(?=[^>]*\sdata-director-action\b)[\s\S]*?</(?P=tag)>",
    re.IGNORECASE,
)

STAGE_CATEGORY_KEYWORDS = {
    "prep": ["подготов", "демонтаж", "временн", "мобилиз", "размет", "геодез"],
    "concrete": ["котлован", "землян", "фундамент", "бетон", "монолит", "арматур", "стяжк"],
    "masonry": ["кладк", "кирпич", "блок", "перегород", "каркас", "сварк", "металлоконструк"],
    "roof": ["кровл", "крыша", "гидроизоляц", "утеплен"],
    "facade": ["фасад", "витраж", "остеклен", "окн", "двер"],
    "electrical": ["электр", "кабель", "щит", "слаботоч", "освещен"],
    "plumbing": ["сантех", "водоснаб", "канализ", "отоплен", "труб", "радиатор"],
    "ventilation": ["вентиляц", "дымоудал", "кондицион", "чиллер"],
    "finishing": ["отдел", "штукатур", "шпаклев", "плитк", "окраск", "ламинат", "потол", "дверн"],
    "landscape": ["благоустрой", "асфальт", "бордюр", "озеленен", "наруж"],
    "handover": ["пуск", "исполн", "сдач", "акт", "комис", "документ"],
}




def now_ts() -> int:
    return int(time.time())


TODAY_ISO = date.today().isoformat()


def normalize_estimate_item_kind(value: object) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return "material"
    work_markers = ("work", "works", "service", "services", "labor", "labour", "job", "работ", "услуг", "труд")
    material_markers = ("material", "materials", "supply", "goods", "equipment", "матер", "товар", "оборуд")
    work_markers = work_markers + (
        "\u0440\u0430\u0431\u043e\u0442",
        "\u0443\u0441\u043b\u0443\u0433",
        "\u0442\u0440\u0443\u0434",
    )
    material_markers = material_markers + (
        "\u043c\u0430\u0442\u0435\u0440",
        "\u0442\u043e\u0432\u0430\u0440",
        "\u043e\u0431\u043e\u0440\u0443\u0434",
    )
    if any(marker in text for marker in work_markers):
        return "work"
    if any(marker in text for marker in material_markers):
        return "material"
    return "material"


def estimate_unit_multiplier(unit: object) -> float:
    match = re.match(r"^\s*(\d+(?:[\.,]\d+)?)\s+\S+", str(unit or "").strip())
    if not match:
        return 1.0
    try:
        multiplier = float(match.group(1).replace(",", "."))
    except ValueError:
        return 1.0
    return multiplier if multiplier > 1 else 1.0


def normalize_estimate_planned_qty(unit: object, qty: object) -> float:
    try:
        value = float(qty or 0)
    except (TypeError, ValueError):
        return 0.0
    multiplier = estimate_unit_multiplier(unit)
    if multiplier >= 100 and value >= multiplier:
        return value / multiplier
    return value


def normalize_estimate_planned_values(unit: object, qty: object, price: object) -> tuple[float, float]:
    try:
        raw_qty = float(qty or 0)
    except (TypeError, ValueError):
        raw_qty = 0.0
    try:
        raw_price = float(price or 0)
    except (TypeError, ValueError):
        raw_price = 0.0
    planned_qty = normalize_estimate_planned_qty(unit, raw_qty)
    if raw_qty > 0 and planned_qty > 0 and planned_qty != raw_qty:
        raw_price *= raw_qty / planned_qty
    return planned_qty, raw_price


FUZZY_MATCH_THRESHOLD = 0.70


def normalize_fuzzy_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower().replace("ё", "е")
    text = re.sub(r"\bпровод\b", "кабель", text)
    text = re.sub(r"\bпровода\b", "кабель", text)
    text = re.sub(r"(?<=\d)[xх×](?=\d)", "x", text)
    text = re.sub(r"(?<=\d)[,.](?=\d)", ".", text)
    text = re.sub(r"[^0-9a-zа-я.]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def levenshtein_distance(left: str, right: str) -> int:
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for i, left_char in enumerate(left, 1):
        current = [i]
        for j, right_char in enumerate(right, 1):
            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + (0 if left_char == right_char else 1),
                )
            )
        previous = current
    return previous[-1]


def dice_coefficient(left: str, right: str) -> float:
    def bigrams(text: str) -> list[str]:
        compact = re.sub(r"\s+", "", text)
        if len(compact) < 2:
            return [compact] if compact else []
        return [compact[index : index + 2] for index in range(len(compact) - 1)]

    left_bigrams = bigrams(left)
    right_bigrams = bigrams(right)
    if not left_bigrams or not right_bigrams:
        return 0.0
    right_counts: dict[str, int] = {}
    for gram in right_bigrams:
        right_counts[gram] = right_counts.get(gram, 0) + 1
    overlap = 0
    for gram in left_bigrams:
        count = right_counts.get(gram, 0)
        if count:
            overlap += 1
            right_counts[gram] = count - 1
    return (2.0 * overlap) / (len(left_bigrams) + len(right_bigrams))


def fuzzy_similarity(left_value: object, right_value: object) -> float:
    left = normalize_fuzzy_text(left_value)
    right = normalize_fuzzy_text(right_value)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    if left in right or right in left:
        short = min(len(left), len(right))
        long = max(len(left), len(right))
        return max(0.82, short / long)
    lev = 1.0 - (levenshtein_distance(left, right) / max(len(left), len(right), 1))
    dice = dice_coefficient(left, right)
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    token_score = len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)
    return max(lev, dice, token_score)


def extract_labeled_note_value(notes: object, labels: tuple[str, ...]) -> str | None:
    text = str(notes or "").strip()
    if not text:
        return None
    normalized_labels = tuple(str(label).strip().lower() for label in labels if str(label).strip())
    for chunk in re.split(r"[;\n]+", text):
        part = chunk.strip()
        if not part:
            continue
        lowered = part.lower()
        for label in normalized_labels:
            colon_prefix = f"{label}:"
            if lowered.startswith(colon_prefix):
                value = part[len(colon_prefix):].strip()
                return value or None
            dash_prefix = f"{label} -"
            if lowered.startswith(dash_prefix):
                value = part[len(dash_prefix):].strip()
                return value or None
    return None


def payload_get(source: dict | sqlite3.Row | None, *keys: str) -> object:
    if not source:
        return None
    if isinstance(source, sqlite3.Row):
        row_keys = source.keys()
        for key in keys:
            if key in row_keys:
                return source[key]
        return None
    for key in keys:
        if key in source:
            return source.get(key)
    return None


def parse_path_int(path: str, index: int) -> int | None:
    parts = path.strip("/").split("/")
    try:
        return int(parts[index])
    except (IndexError, TypeError, ValueError):
        return None


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def ensure_columns(con: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    existing = {row["name"] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, definition in columns.items():
        if name not in existing:
            con.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


def create_audit(
    con: sqlite3.Connection,
    user_id: int | None,
    action: str,
    entity: str | None = None,
    entity_id: int | None = None,
    payload: dict | None = None,
) -> None:
    con.execute(
        """
        INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, action, entity, entity_id, json.dumps(payload or {}, ensure_ascii=False), now_ts()),
    )


def user_unique_conflict(con: sqlite3.Connection, email: str | None, phone: str | None, exclude_user_id: int | None = None) -> dict | None:
    exclude_sql = " AND id <> ?" if exclude_user_id else ""
    exclude_args = (exclude_user_id,) if exclude_user_id else ()
    if email:
        row = con.execute(
            "SELECT id FROM users WHERE lower(email) = ?" + exclude_sql,
            (email.lower(),) + exclude_args,
        ).fetchone()
        if row:
            return {"error": "email_already_used", "message": "Этот Email уже зарегистрирован в системе"}
    if phone:
        row = con.execute(
            "SELECT id FROM users WHERE phone = ?" + exclude_sql,
            (phone,) + exclude_args,
        ).fetchone()
        if row:
            return {"error": "phone_already_used", "message": "Этот номер телефона уже используется"}
    return None


def valid_user_email(email: str | None) -> bool:
    return bool(email and re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def valid_user_phone(phone: str | None) -> bool:
    return bool(phone and re.match(r"^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$", phone))


def migrate_users_table(con: sqlite3.Connection) -> None:
    create_sql_row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    ).fetchone()
    create_sql = create_sql_row["sql"] if create_sql_row else ""
    if "CHECK(role IN ('director','foreman','buyer','client'))" not in create_sql:
        return

    con.execute("ALTER TABLE users RENAME TO users_legacy")
    con.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT NOT NULL UNIQUE,
            email TEXT,
            phone TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER
        )
        """
    )
    con.execute(
        """
        INSERT INTO users (id, login, password_hash, role, name, status, is_active, created_at, updated_at)
        SELECT id, login, password_hash, role, name,
               CASE WHEN is_active = 1 THEN 'active' ELSE 'blocked' END,
               is_active, created_at, created_at
        FROM users_legacy
        """
    )
    # Keep the legacy table until foreign keys in already-created tables are
    # rebuilt to point back to users. SQLite rewrites FK targets on rename.


def table_exists(con: sqlite3.Connection, table: str) -> bool:
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone() is not None


def table_sql(con: sqlite3.Connection, table: str) -> str:
    row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row["sql"] if row and row["sql"] else ""


def rebuild_table(con: sqlite3.Connection, table: str, create_sql: str) -> None:
    old_table = f"{table}__old"
    con.execute(f"DROP TABLE IF EXISTS {old_table}")
    con.execute("PRAGMA legacy_alter_table = ON")
    con.execute(f"ALTER TABLE {table} RENAME TO {old_table}")
    con.execute(create_sql)
    old_columns = [row["name"] for row in con.execute(f"PRAGMA table_info({old_table})").fetchall()]
    new_columns = [row["name"] for row in con.execute(f"PRAGMA table_info({table})").fetchall()]
    common_columns = [column for column in new_columns if column in old_columns]
    if common_columns:
        column_sql = ", ".join(common_columns)
        con.execute(f"INSERT INTO {table} ({column_sql}) SELECT {column_sql} FROM {old_table}")
    con.execute(f"DROP TABLE {old_table}")
    con.execute("PRAGMA legacy_alter_table = OFF")


def repair_legacy_user_references(con: sqlite3.Connection) -> None:
    affected = [
        table
        for table in [
            "sessions",
            "projects",
            "user_project_access",
            "stock_moves",
            "tasks",
            "chat_messages",
            "daily_logs",
            "audit_log",
            "object_assignments",
            "user_roles",
        ]
        if table_exists(con, table) and "users_legacy" in table_sql(con, table)
    ]
    if not affected:
        return

    con.execute("PRAGMA foreign_keys = OFF")
    con.execute("PRAGMA legacy_alter_table = ON")
    schemas = {
        "sessions": """
            CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                user_agent TEXT,
                ip TEXT
            )
        """,
        "projects": """
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
                customer_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                own_legal_entity_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                address TEXT NOT NULL,
                city TEXT,
                region TEXT,
                client_name TEXT NOT NULL,
                contract_no TEXT,
                contract_date TEXT,
                director_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                foreman_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                budget REAL NOT NULL DEFAULT 0,
                paid REAL NOT NULL DEFAULT 0,
                spent REAL NOT NULL DEFAULT 0,
                started_at TEXT,
                deadline_at TEXT,
                internal_schedule_status TEXT NOT NULL DEFAULT 'draft',
                internal_schedule_version INTEGER NOT NULL DEFAULT 1,
                internal_schedule_approved_at TEXT,
                customer_schedule_status TEXT NOT NULL DEFAULT 'draft',
                customer_schedule_version INTEGER NOT NULL DEFAULT 1,
                customer_schedule_approved_at TEXT,
                schedule_generated_at TEXT,
                description TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            )
        """,
        "user_project_access": """
            CREATE TABLE user_project_access (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, project_id)
            )
        """,
        "stock_moves": """
            CREATE TABLE stock_moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                move_type TEXT NOT NULL CHECK(move_type IN ('purchase','receipt','use','writeoff')),
                qty REAL NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                comment TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            )
        """,
        "tasks": """
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                priority TEXT NOT NULL DEFAULT 'normal',
                assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                due_at TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            )
        """,
        "chat_messages": """
            CREATE TABLE chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """,
        "daily_logs": """
            CREATE TABLE daily_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                report_date TEXT NOT NULL,
                title TEXT NOT NULL,
                work_done TEXT NOT NULL DEFAULT '',
                workers_count INTEGER NOT NULL DEFAULT 0,
                equipment TEXT NOT NULL DEFAULT '',
                blockers TEXT NOT NULL DEFAULT '',
                next_steps TEXT NOT NULL DEFAULT '',
                is_client_visible INTEGER NOT NULL DEFAULT 1,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            )
        """,
        "audit_log": """
            CREATE TABLE audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                entity TEXT,
                entity_id INTEGER,
                payload TEXT,
                created_at INTEGER NOT NULL
            )
        """,
        "object_assignments": """
            CREATE TABLE object_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_code TEXT NOT NULL,
                responsibility TEXT,
                is_primary INTEGER NOT NULL DEFAULT 0,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_at INTEGER NOT NULL,
                UNIQUE(object_id, user_id, role_code)
            )
        """,
        "user_roles": """
            CREATE TABLE user_roles (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, role_id)
            )
        """,
    }
    for table in affected:
        rebuild_table(con, table, schemas[table])
    if table_exists(con, "users_legacy"):
        con.execute("DROP TABLE users_legacy")
    con.execute("PRAGMA legacy_alter_table = OFF")
    con.execute("PRAGMA foreign_keys = ON")


def init_db() -> None:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT NOT NULL UNIQUE,
                email TEXT,
                phone TEXT,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS user_roles (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, role_id)
            );

            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('own_legal_entity','client','supplier','contractor','other')),
                name TEXT NOT NULL,
                inn TEXT,
                kpp TEXT,
                ogrn TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                notes TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                user_agent TEXT,
                ip TEXT
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
                customer_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                own_legal_entity_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                address TEXT NOT NULL,
                city TEXT,
                region TEXT,
                client_name TEXT NOT NULL,
                contract_no TEXT,
                contract_date TEXT,
                director_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                foreman_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                budget REAL NOT NULL DEFAULT 0,
                paid REAL NOT NULL DEFAULT 0,
                spent REAL NOT NULL DEFAULT 0,
                started_at TEXT,
                deadline_at TEXT,
                internal_schedule_status TEXT NOT NULL DEFAULT 'draft',
                internal_schedule_version INTEGER NOT NULL DEFAULT 1,
                internal_schedule_approved_at TEXT,
                customer_schedule_status TEXT NOT NULL DEFAULT 'draft',
                customer_schedule_version INTEGER NOT NULL DEFAULT 1,
                customer_schedule_approved_at TEXT,
                schedule_generated_at TEXT,
                description TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS object_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_code TEXT NOT NULL,
                responsibility TEXT,
                is_primary INTEGER NOT NULL DEFAULT 0,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_at INTEGER NOT NULL,
                UNIQUE(object_id, user_id, role_code)
            );

            CREATE TABLE IF NOT EXISTS user_project_access (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, project_id)
            );

            CREATE TABLE IF NOT EXISTS estimate_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                unit TEXT NOT NULL,
                planned_qty REAL NOT NULL,
                planned_price REAL NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS stock_moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                move_type TEXT NOT NULL CHECK(move_type IN ('purchase','receipt','use','writeoff')),
                qty REAL NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                comment TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS warehouse_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL DEFAULT 'material' CHECK(item_type IN ('material','tool')),
                category TEXT,
                name TEXT NOT NULL,
                sku TEXT,
                unit TEXT NOT NULL DEFAULT 'шт',
                qty REAL NOT NULL DEFAULT 0,
                condition_status TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS warehouse_transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                warehouse_item_id INTEGER NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                qty REAL NOT NULL,
                unit TEXT NOT NULL,
                comment TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS supplier_offers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                candidate_type TEXT NOT NULL DEFAULT 'supplier',
                candidate_name TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'manual',
                source_url TEXT,
                contact_name TEXT,
                phone TEXT,
                price REAL NOT NULL DEFAULT 0,
                qty REAL NOT NULL DEFAULT 0,
                unit TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS material_schedule_snapshots (
                project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
                payload TEXT NOT NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS work_stages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                parent_id INTEGER,
                stage_kind TEXT NOT NULL DEFAULT 'section',
                status_code TEXT NOT NULL DEFAULT 'not_started',
                planned_start TEXT,
                planned_end TEXT,
                customer_start TEXT,
                customer_end TEXT,
                fact_start TEXT,
                fact_end TEXT,
                progress INTEGER NOT NULL DEFAULT 0,
                responsible TEXT,
                notes TEXT,
                is_client_visible INTEGER NOT NULL DEFAULT 1,
                depends_on_materials INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                priority TEXT NOT NULL DEFAULT 'normal',
                assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                due_at TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                chat_type TEXT NOT NULL CHECK(chat_type IN ('team','client')),
                title TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                doc_type TEXT NOT NULL DEFAULT 'file',
                status TEXT NOT NULL DEFAULT 'draft',
                original_name TEXT,
                storage_name TEXT,
                storage_path TEXT,
                mime_type TEXT,
                file_ext TEXT,
                size_bytes INTEGER,
                notes TEXT,
                uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                is_client_visible INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS finance_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                direction TEXT NOT NULL CHECK(direction IN ('income','expense')),
                category TEXT,
                payment_kind TEXT NOT NULL DEFAULT 'cash' CHECK(payment_kind IN ('cash','bank_no_vat','bank_vat')),
                vat_percent REAL NOT NULL DEFAULT 0,
                amount REAL NOT NULL DEFAULT 0,
                planned_date TEXT,
                paid_date TEXT,
                counterparty_name TEXT,
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','approved','paid','cancelled')),
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS daily_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                report_date TEXT NOT NULL,
                title TEXT NOT NULL,
                work_done TEXT NOT NULL DEFAULT '',
                workers_count INTEGER NOT NULL DEFAULT 0,
                equipment TEXT NOT NULL DEFAULT '',
                blockers TEXT NOT NULL DEFAULT '',
                next_steps TEXT NOT NULL DEFAULT '',
                progress_percent REAL,
                raw_input TEXT,
                is_client_visible INTEGER NOT NULL DEFAULT 1,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                entity TEXT,
                entity_id INTEGER,
                payload TEXT,
                created_at INTEGER NOT NULL
            );
            """
        )

        migrate_users_table(con)
        repair_legacy_user_references(con)

        ensure_columns(
            con,
            "users",
            {
                "email": "TEXT",
                "phone": "TEXT",
                "clerk_user_id": "TEXT",
                "status": "TEXT NOT NULL DEFAULT 'active'",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "projects",
            {
                "client_id": "INTEGER REFERENCES clients(id) ON DELETE SET NULL",
                "customer_company_id": "INTEGER REFERENCES companies(id) ON DELETE SET NULL",
                "own_legal_entity_id": "INTEGER REFERENCES companies(id) ON DELETE SET NULL",
                "city": "TEXT",
                "region": "TEXT",
                "contract_no": "TEXT",
                "contract_date": "TEXT",
                "director_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "foreman_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "buyer_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "client_user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "budget": "REAL NOT NULL DEFAULT 0",
                "paid": "REAL NOT NULL DEFAULT 0",
                "spent": "REAL NOT NULL DEFAULT 0",
                "internal_schedule_status": "TEXT NOT NULL DEFAULT 'draft'",
                "internal_schedule_version": "INTEGER NOT NULL DEFAULT 1",
                "internal_schedule_approved_at": "TEXT",
                "customer_schedule_status": "TEXT NOT NULL DEFAULT 'draft'",
                "customer_schedule_version": "INTEGER NOT NULL DEFAULT 1",
                "customer_schedule_approved_at": "TEXT",
                "schedule_generated_at": "TEXT",
                "description": "TEXT",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "finance_entries",
            {
                "category": "TEXT",
                "payment_kind": "TEXT NOT NULL DEFAULT 'cash'",
                "vat_percent": "REAL NOT NULL DEFAULT 0",
                "planned_date": "TEXT",
                "paid_date": "TEXT",
                "counterparty_name": "TEXT",
                "company_id": "INTEGER REFERENCES companies(id) ON DELETE SET NULL",
                "document_id": "INTEGER REFERENCES documents(id) ON DELETE SET NULL",
                "status": "TEXT NOT NULL DEFAULT 'planned'",
                "notes": "TEXT",
                "created_by": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "documents",
            {
                "original_name": "TEXT",
                "storage_name": "TEXT",
                "storage_path": "TEXT",
                "mime_type": "TEXT",
                "file_ext": "TEXT",
                "size_bytes": "INTEGER",
                "notes": "TEXT",
                "uploaded_by": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "stage_id": "INTEGER REFERENCES work_stages(id) ON DELETE SET NULL",
                "template_code": "TEXT",
                "generated_by_system": "INTEGER NOT NULL DEFAULT 0",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "estimate_items",
            {
                "stage_id": "INTEGER REFERENCES work_stages(id) ON DELETE SET NULL",
                "item_kind": "TEXT NOT NULL DEFAULT 'material'",
                "section_title": "TEXT",
                "article": "TEXT",
                "procurement_status": "TEXT NOT NULL DEFAULT 'Купить'",
                "warehouse_source": "TEXT",
                "warehouse_item_id": "INTEGER REFERENCES warehouse_items(id) ON DELETE SET NULL",
                "delivery_days": "INTEGER",
                "need_by_date": "TEXT",
                "notes": "TEXT",
                "is_completed": "INTEGER NOT NULL DEFAULT 0",
                "actual_qty": "REAL NOT NULL DEFAULT 0",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "warehouse_items",
            {
                "item_type": "TEXT NOT NULL DEFAULT 'material'",
                "category": "TEXT",
                "name": "TEXT NOT NULL DEFAULT ''",
                "sku": "TEXT",
                "unit": "TEXT NOT NULL DEFAULT 'шт'",
                "qty": "REAL NOT NULL DEFAULT 0",
                "condition_status": "TEXT",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "work_stages",
            {
                "parent_id": "INTEGER",
                "stage_kind": "TEXT NOT NULL DEFAULT 'section'",
                "status_code": "TEXT NOT NULL DEFAULT 'not_started'",
                "customer_start": "TEXT",
                "customer_end": "TEXT",
                "notes": "TEXT",
                "is_client_visible": "INTEGER NOT NULL DEFAULT 1",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "tasks",
            {
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "daily_logs",
            {
                "progress_percent": "REAL",
                "raw_input": "TEXT",
                "updated_at": "INTEGER",
            },
        )

        for code in ROLE_CODES:
            con.execute(
                """
                INSERT INTO roles (code, name, description)
                VALUES (?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description
                """,
                (code, ROLE_LABELS[code], ROLE_DESCRIPTIONS.get(code, "")),
            )

        user_rows = con.execute("SELECT id, role FROM users").fetchall()
        for row in user_rows:
            role_code = row["role"]
            role = con.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
            if role:
                con.execute(
                    """
                    INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (row["id"], role["id"], now_ts()),
                )

        if table_exists(con, "projects") and table_exists(con, "object_assignments"):
            con.execute(
                """
                INSERT OR IGNORE INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
                SELECT id, foreman_id, 'foreman', 'РџСЂРѕСЂР°Р± РѕР±СЉРµРєС‚Р°', 1, director_id, COALESCE(created_at, ?)
                FROM projects
                WHERE foreman_id IS NOT NULL
                """,
                (now_ts(),),
            )
            con.execute(
                """
                INSERT OR IGNORE INTO user_project_access (user_id, project_id)
                SELECT foreman_id, id
                FROM projects
                WHERE foreman_id IS NOT NULL
                """
            )

        seed_warehouse_items(con)

        user_count = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if user_count == 0:
            bootstrap_password = os.environ.get("PMBI_ADMIN_PASSWORD") or secrets.token_urlsafe(18)
            admin_cur = con.execute(
                """
                INSERT INTO users (login, password_hash, role, name, status, created_at, updated_at)
                VALUES (?, ?, 'director', 'Главный администратор', 'active', ?, ?)
                """,
                ("admin", hash_password(bootstrap_password), now_ts(), now_ts()),
            )
            director_role = con.execute("SELECT id FROM roles WHERE code = 'director'").fetchone()
            if director_role:
                con.execute(
                    """
                    INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (admin_cur.lastrowid, director_role["id"], now_ts()),
                )
            con.commit()
            BOOTSTRAP_PATH.write_text(
                "PM.bi initial admin\n"
                "login: admin\n"
                f"password: {bootstrap_password}\n\n"
                "Delete this file after creating your real users.\n",
                encoding="utf-8",
            )

        con.commit()



















































def normalize_market_title_key(value: str | None) -> str:
    text = str(value or "").strip().lower().replace("ё", "е")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[^0-9a-zа-я]+", " ", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def extract_estimate_id_from_project(project: sqlite3.Row | dict) -> str | None:
    contract_no = str(payload_get(project, "contract_no") or "")
    match = re.search(r"ESTIMATE-([A-Za-z0-9]+)", contract_no)
    if match:
        return match.group(1)
    description = str(payload_get(project, "description") or "")
    match = re.search(r"/estimates/([A-Za-z0-9]+)", description)
    if match:
        return match.group(1)
    return None


def estimate_position_from_notes(notes: str | None, estimate_id: str | None = None) -> int | None:
    raw = str(notes or "")
    if not raw:
        return None
    patterns = []
    if estimate_id:
        patterns.append(re.escape(estimate_id) + r";\s*[^;]*:\s*(\d+)")
    patterns.append(r";\s*[^;]*:\s*(\d+);\s*[^;]*Excel")
    for pattern in patterns:
        match = re.search(pattern, raw, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except (TypeError, ValueError):
                pass
    return None


def strip_html_fragment(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_money_value(value: str | None) -> float | None:
    raw = str(value or "").strip().lower()
    if not raw or raw in {"—", "-", "nan", "none"}:
        return None
    raw = raw.replace("\xa0", " ").replace("₽", "").replace("руб.", "").replace("руб", "")
    raw = re.sub(r"[^0-9,.; -]", "", raw)
    numbers = []
    for chunk in re.split(r"[;|/]", raw):
        cleaned = chunk.replace(" ", "").replace(",", ".")
        if not cleaned:
            continue
        try:
            numbers.append(float(cleaned))
        except ValueError:
            continue
    if not numbers:
        return None
    return min(numbers)


def offer_domain_label(url: str | None) -> str:
    try:
        host = urllib.parse.urlparse(str(url or "")).netloc.lower()
    except ValueError:
        return ""
    return host.removeprefix("www.")


def parse_market_view_html(html_text: str, market_type: str) -> list[dict]:
    articles = re.findall(r"<article class=\"item\">(.*?)</article>", html_text, flags=re.S | re.I)
    rows: list[dict] = []
    for article in articles:
        title_match = re.search(r"<div class=\"item-title\">(.*?)</div>", article, flags=re.S | re.I)
        index_match = re.search(r"<div class=\"item-index\">(.*?)</div>", article, flags=re.S | re.I)
        meta_match = re.search(r"<div class=\"meta\">(.*?)</div>\s*(?:<div class=\"offers\">|<div class=\"status-note\">)", article, flags=re.S | re.I)
        offers_match = re.search(r"<div class=\"offers\">(.*?)</div>\s*(?:<div class=\"status-note\">|</article>)", article, flags=re.S | re.I)
        status_match = re.search(r"<div class=\"status-note\">(.*?)</div>", article, flags=re.S | re.I)
        kind_match = re.search(r"<span class=\"tag\">(.*?)</span>\s*</div>\s*<div class=\"meta\">", article, flags=re.S | re.I)
        title = strip_html_fragment(title_match.group(1) if title_match else "")
        if not title:
            continue
        try:
            position_index = int(strip_html_fragment(index_match.group(1) if index_match else "0") or 0)
        except ValueError:
            position_index = 0
        meta_tags = [
            strip_html_fragment(chunk)
            for chunk in re.findall(r"<span class=\"tag\">(.*?)</span>", meta_match.group(1) if meta_match else "", flags=re.S | re.I)
        ]
        meta_map: dict[str, str] = {}
        for tag in meta_tags:
            if ":" not in tag:
                continue
            key, value = tag.split(":", 1)
            meta_map[key.strip().lower()] = value.strip()

        offers: list[dict] = []
        offers_html = offers_match.group(1) if offers_match else ""
        for block in re.split(r"<div class=\"offer\">", offers_html, flags=re.I)[1:]:
            link_match = re.search(r"<a href=\"([^\"]+)\"[^>]*>(.*?)</a>", block, flags=re.S | re.I)
            price_match = re.search(r"<div class=\"num\">(.*?)</div>", block, flags=re.S | re.I)
            snippet_match = re.search(r"<div class=\"offer-snippet\">(.*?)</div>", block, flags=re.S | re.I)
            url = html.unescape(link_match.group(1)) if link_match else ""
            title_text = strip_html_fragment(link_match.group(2) if link_match else "")
            price_value = parse_money_value(strip_html_fragment(price_match.group(1) if price_match else ""))
            offers.append(
                {
                    "title": title_text or offer_domain_label(url) or "Источник",
                    "url": url,
                    "domain": offer_domain_label(url),
                    "price": price_value,
                    "snippet": strip_html_fragment(snippet_match.group(1) if snippet_match else ""),
                }
            )

        estimate_unit_price = parse_money_value(meta_map.get("смета за ед.") or meta_map.get("смета за ед"))
        estimate_total = parse_money_value(meta_map.get("смета всего"))
        market_price = parse_money_value(meta_map.get("рынок"))
        if market_price is None:
            offer_prices = [offer["price"] for offer in offers if offer.get("price") is not None]
            market_price = min(offer_prices) if offer_prices else None

        rows.append(
            {
                "positionIndex": position_index or None,
                "title": title,
                "titleKey": normalize_market_title_key(title),
                "marketType": market_type,
                "kindLabel": strip_html_fragment(kind_match.group(1) if kind_match else ""),
                "qtyText": meta_map.get("кол-во", ""),
                "unitText": meta_map.get("ед.", ""),
                "estimateUnitPrice": estimate_unit_price,
                "estimateTotal": estimate_total,
                "marketPrice": market_price,
                "marketPriceText": meta_map.get("рынок", ""),
                "offers": offers,
                "statusNote": strip_html_fragment(status_match.group(1) if status_match else ""),
            }
        )
    return rows


def fetch_autobot_market_rows(estimate_id: str, market_type: str) -> list[dict]:
    url = f"{PMBI_AUTOBOT_BASE_URL}/estimates/{urllib.parse.quote(estimate_id)}/market-view?market_type={urllib.parse.quote(market_type)}"
    request = urllib.request.Request(url, headers={"User-Agent": "PM.bi/1.0", "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        html_text = response.read().decode(charset, errors="replace")
    return parse_market_view_html(html_text, market_type)


def build_project_market_analysis(con: sqlite3.Connection, project_id: int, kind: str) -> dict:
    project = con.execute("SELECT id, contract_no, description FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        raise ValueError("project_not_found")
    estimate_id = extract_estimate_id_from_project(project)
    if not estimate_id:
        raise LookupError("estimate_not_linked")

    market_types = ["work"] if kind == "work" else ["material", "product", "service", "other"]
    market_rows: list[dict] = []
    for market_type in market_types:
        market_rows.extend(fetch_autobot_market_rows(estimate_id, market_type))

    items = material_summary_rows(con, project_id)
    if kind == "work":
        items = [item for item in items if normalize_estimate_item_kind(item.get("itemKind")) == "work"]
    else:
        items = [item for item in items if normalize_estimate_item_kind(item.get("itemKind")) != "work"]

    market_by_index: dict[int, dict] = {}
    market_by_title: dict[str, dict] = {}
    for row in market_rows:
        if row.get("positionIndex"):
            market_by_index[int(row["positionIndex"])] = row
        market_by_title[row["titleKey"]] = row

    merged_rows: list[dict] = []
    for item in items:
        position_index = estimate_position_from_notes(str(item.get("notes") or ""), estimate_id)
        title_key = normalize_market_title_key(str(item.get("title") or ""))
        market_row = None
        if kind == "work" and position_index and position_index in market_by_index:
            market_row = market_by_index[position_index]
        if not market_row and title_key and title_key in market_by_title:
            market_row = market_by_title[title_key]
        offers = list((market_row or {}).get("offers") or [])
        market_price = (market_row or {}).get("marketPrice")
        estimate_unit_price = float(item.get("plannedPrice") or 0)
        merged_rows.append(
            {
                "estimateItemId": int(item.get("id") or 0),
                "positionIndex": position_index,
                "title": str(item.get("title") or ""),
                "titleKey": title_key,
                "sectionTitle": str(item.get("sectionTitle") or "").strip(),
                "stageTitle": str(item.get("stageTitle") or "").strip(),
                "unit": str(item.get("unit") or "").strip(),
                "plannedQty": float(item.get("plannedQty") or 0),
                "estimateUnitPrice": estimate_unit_price,
                "estimateTotal": round(float(item.get("plannedQty") or 0) * estimate_unit_price, 2),
                "marketPrice": market_price,
                "marketPriceText": (market_row or {}).get("marketPriceText") or "",
                "marketType": (market_row or {}).get("marketType") or "",
                "statusNote": (market_row or {}).get("statusNote") or "",
                "sources": offers[:3],
                "sourceCount": len(offers),
                "deltaPerUnit": round(market_price - estimate_unit_price, 2) if market_price is not None and estimate_unit_price else None,
                "hasMarketData": market_row is not None,
            }
        )

    merged_rows.sort(
        key=lambda row: (
            str(row.get("sectionTitle") or ""),
            int(row.get("positionIndex") or 10**9),
            str(row.get("title") or ""),
        )
    )
    coverage = sum(1 for row in merged_rows if row["hasMarketData"])
    return {
        "projectId": project_id,
        "estimateId": estimate_id,
        "kind": kind,
        "rows": merged_rows,
        "summary": {
            "total": len(merged_rows),
            "withMarketData": coverage,
            "withoutMarketData": max(0, len(merged_rows) - coverage),
        },
    }










































class PMBIHandler(BaseHTTPRequestHandler):
    server_version = "PMBIBackend/1.0"

    def log_message(self, fmt: str, *args) -> None:
        try:
            if sys.stdout:
                sys.stdout.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))
        except (AttributeError, OSError):
            pass

    def do_GET(self) -> None:
        path = self.clean_path()
        if path in {"/", "/index.html"}:
            self.redirect(DEFAULT_AUTH_PATH)
            return
        if path.startswith("/api/"):
            self.handle_api("GET", path)
            return
        if path == "/login" or path.startswith("/app"):
            self.serve_app(path)
            return
        if path.startswith("/assets/"):
            self.serve_asset(path)
            return
        self.serve_static(path)

    def do_POST(self) -> None:
        path = self.clean_path()
        if path.startswith("/api/"):
            self.handle_api("POST", path)
            return
        self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def do_DELETE(self) -> None:
        path = self.clean_path()
        if path.startswith("/api/"):
            self.handle_api("DELETE", path)
            return
        self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def clean_path(self) -> str:
        parsed = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(parsed.path)
        if path.endswith("/") and path != "/":
            path = path[:-1]
        return path or "/"

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 1024 * 1024:
            raise ValueError("Payload too large")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def read_multipart(self) -> cgi.FieldStorage:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            raise ValueError("empty_upload")
        if length > MAX_UPLOAD_BYTES:
            raise ValueError("upload_too_large")
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise ValueError("multipart_required")
        return cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": str(length),
            },
            keep_blank_values=True,
        )

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file_path: Path, content_type: str, download_name: str, inline: bool = False) -> None:
        body = file_path.read_bytes()
        disposition = "inline" if inline else "attachment"
        quoted_name = urllib.parse.quote(download_name)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header(
            "Content-Disposition",
            f"{disposition}; filename*=UTF-8''{quoted_name}",
        )
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def session_token(self) -> str | None:
        from auth import session_token as auth_session_token
        return auth_session_token(self)

    def bearer_token(self) -> str | None:
        from auth import bearer_token as auth_bearer_token
        return auth_bearer_token(self)

    def clerk_cookie_token(self) -> str | None:
        from auth import clerk_cookie_token as auth_clerk_cookie_token
        return auth_clerk_cookie_token(self)

    def auth_config(self) -> dict[str, object]:
        return auth_core_config()

    def auth_config_script(self) -> str:
        payload = json.dumps(self.auth_config(), ensure_ascii=False)
        return f"<script>window.__PMBI_AUTH__ = {payload};</script>"

    def clerk_sign_in_script(self) -> str:
        return auth_clerk_sign_in_script()

    def current_user_from_clerk(self) -> tuple[dict | None, str | None]:
        return auth_current_user_from_clerk(self)

    def current_user(self) -> dict | None:
        return auth_current_user(self)

    def require_user(self) -> dict | None:
        return auth_require_user(self)

    def require_role(self, roles: set[str]) -> dict | None:
        return auth_require_role(self, roles)

    def set_session_cookie(self, token: str) -> None:
        from auth import set_session_cookie as auth_set_session_cookie
        auth_set_session_cookie(self, token)

    def clear_session_cookie(self) -> None:
        from auth import clear_session_cookie as auth_clear_session_cookie
        auth_clear_session_cookie(self)

    def handle_api(self, method: str, path: str) -> None:
        try:
            if method == "POST" and path == "/api/auth/login":
                self.api_login()
            elif method == "POST" and path == "/api/auth/logout":
                self.api_logout()
            elif method == "GET" and path == "/api/auth/me":
                self.api_me()
            elif method == "GET" and path == "/api/roles":
                self.api_roles()
            elif method == "POST" and path == "/api/users/manage":
                self.api_users_manage()
            elif method == "DELETE" and path.startswith("/api/users/manage/"):
                self.api_delete_managed_user(path)
            elif method == "POST" and path == "/api/finance/pay-invoice":
                self.api_pay_invoice()
            elif method == "POST" and path == "/api/admin/users":
                self.api_create_user()
            elif method == "GET" and path == "/api/admin/users":
                self.api_users()
            elif method == "GET" and path == "/api/companies":
                self.api_companies()
            elif method == "POST" and path == "/api/companies":
                self.api_create_company()
            elif method == "GET" and path == "/api/projects":
                self.api_projects()
            elif method == "POST" and path == "/api/projects":
                self.api_create_project()
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/update"):
                self.api_update_project(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/delete"):
                self.api_delete_project(path)
            elif method == "GET" and path == "/api/dashboard":
                self.api_dashboard()
            elif method == "GET" and path in {"/api/warehouse-items", "/api/warehouse"}:
                self.api_warehouse_items()
            elif method == "POST" and path == "/api/warehouse-items/receipt":
                self.api_warehouse_receipt()
            elif method == "POST" and path.startswith("/api/warehouse-items/") and path.endswith("/transfer"):
                self.api_warehouse_transfer(path)
            elif method == "POST" and path.startswith("/api/warehouse/") and path.endswith("/issue"):
                self.api_warehouse_issue(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.count("/") == 3:
                self.api_project_detail(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/assignments"):
                self.api_project_assignments(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/assignments"):
                self.api_create_project_assignment(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/materials-summary"):
                self.api_materials_summary(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/warehouse-matches"):
                self.api_project_warehouse_matches(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/material-schedule"):
                self.api_material_schedule(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/material-schedule"):
                self.api_save_material_schedule(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/materials"):
                self.api_create_material(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/bootstrap"):
                self.api_project_bootstrap(path)
            elif method == "POST" and path.startswith("/api/materials/") and path.endswith("/update"):
                self.api_update_material(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/supplier-offers"):
                self.api_project_supplier_offers(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/market-analysis"):
                self.api_project_market_analysis(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/market-counterparty"):
                self.api_create_market_counterparty(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/supplier-offers"):
                self.api_create_supplier_offer(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/supplier-offers/clear-selection"):
                self.api_clear_supplier_selection(path)
            elif method == "POST" and path.startswith("/api/supplier-offers/") and path.endswith("/update"):
                self.api_update_supplier_offer(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/finances"):
                self.api_project_finances(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/finances"):
                self.api_create_finance_entry(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/finances/invoice-upload"):
                self.api_upload_finance_invoice(path)
            elif method == "POST" and path.startswith("/api/finances/") and path.endswith("/update"):
                self.api_update_finance_entry(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/estimate-import"):
                self.api_import_estimate(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/auto-schedule"):
                self.api_project_auto_schedule(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/section-schedule-forecast"):
                self.api_project_section_schedule_forecast(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/progress-item"):
                schedule_api_update_estimate_item_completion(self, path)
            elif method == "POST" and path.startswith("/api/projects/") and "bulk-complete" in path:
                schedule_api_project_section_bulk_complete(self, path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/schedule-status"):
                self.api_project_schedule_status(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/schedule-status"):
                self.api_update_project_schedule_status(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/analysis"):
                self.api_project_analysis(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/stages"):
                self.api_project_stages(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/stages"):
                self.api_create_project_stage(path)
            elif method == "POST" and path.startswith("/api/stages/") and path.endswith("/update"):
                self.api_update_stage(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/tasks"):
                self.api_project_tasks(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/tasks"):
                self.api_create_task(path)
            elif method == "POST" and path.startswith("/api/tasks/") and path.endswith("/update"):
                self.api_update_task(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/notifications"):
                self.api_project_notifications(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/documents"):
                self.api_project_documents(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/documents"):
                self.api_upload_project_document(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/executive-docs"):
                self.api_project_executive_docs(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/executive-docs"):
                self.api_create_project_executive_doc(path)
            elif method == "GET" and path.startswith("/api/documents/") and path.endswith("/download"):
                self.api_document_file(path, inline=False)
            elif method == "GET" and path.startswith("/api/documents/") and path.endswith("/view"):
                self.api_document_file(path, inline=True)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/daily-logs"):
                self.api_project_daily_logs(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/daily-logs"):
                self.api_create_daily_log(path)
            elif method == "POST" and path.startswith("/api/projects/") and "/daily-logs/" in path and path.endswith("/delete"):
                self.api_delete_daily_log(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/chats"):
                self.api_project_chats(path)
            elif method == "GET" and path.startswith("/api/chats/") and path.endswith("/messages"):
                self.api_chat_messages(path)
            elif method == "POST" and path.startswith("/api/chats/") and path.endswith("/messages"):
                self.api_create_chat_message(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/stock-moves"):
                self.api_create_stock_move(path)
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        except json.JSONDecodeError:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def api_login(self) -> None:
        auth_api_login(self)

    def api_logout(self) -> None:
        auth_api_logout(self)

    def api_me(self) -> None:
        auth_api_me(self)

    def api_roles(self) -> None:
        user = self.require_user()
        if not user:
            return
        with db() as con:
            rows = con.execute("SELECT code, name, description FROM roles ORDER BY id").fetchall()
        self.send_json(HTTPStatus.OK, {"roles": [dict(row) for row in rows]})

    def api_create_user(self) -> None:
        admin = self.require_role({"admin", "director"})
        if not admin:
            return
        payload = self.read_json()
        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", ""))
        requested_roles = payload.get("roles")
        if isinstance(requested_roles, list):
            role_codes = [normalize_role(str(item).strip()) for item in requested_roles if str(item).strip()]
        else:
            role_codes = [normalize_role(str(payload.get("role", "")).strip())]
        role_codes = list(dict.fromkeys(role_codes))
        role = role_codes[0] if role_codes else ""
        name = str(payload.get("name", "")).strip() or login
        email = str(payload.get("email", "")).strip().lower() or None
        phone = str(payload.get("phone", "")).strip() or None
        if (
            not login
            or len(password) < 10
            or not role_codes
            or any(role_code not in ROLE_LABELS for role_code in role_codes)
            or (clerk_enabled() and not email)
        ):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_user_data"})
            return
        if not valid_user_email(email):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_email", "message": "Введите корректный Email"})
            return
        if not valid_user_phone(phone):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_phone", "message": "Введите корректный номер телефона"})
            return
        clerk_user_id = None
        with db() as con:
            existing_login = con.execute("SELECT id FROM users WHERE login = ?", (login,)).fetchone()
            if existing_login:
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            unique_conflict = user_unique_conflict(con, email, phone)
            if unique_conflict:
                self.send_json(HTTPStatus.CONFLICT, unique_conflict)
                return
            if clerk_enabled() and email:
                existing_email = con.execute("SELECT id FROM users WHERE lower(email) = ?", (email.lower(),)).fetchone()
                if existing_email:
                    self.send_json(HTTPStatus.CONFLICT, {"error": "email_already_used", "message": "Этот Email уже зарегистрирован в системе"})
                    return
        if clerk_enabled():
            first_name, last_name = split_person_name(name)
            clerk_payload = {
                "email_address": [email],
                "password": password,
                "username": login,
                "first_name": first_name,
                "last_name": last_name,
                "skip_password_checks": False,
                "skip_password_requirement": False,
            }
            try:
                clerk_user = clerk_api_request("/users", method="POST", payload=clerk_payload)
                clerk_user_id = str(clerk_user.get("id") or "").strip() or None
            except Exception as error:
                self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "clerk_create_user_failed", "detail": str(error)})
                return
        with db() as con:
            try:
                cur = con.execute(
                    """
                    INSERT INTO users (login, email, phone, clerk_user_id, password_hash, role, name, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                    """,
                    (login, email, phone, clerk_user_id, hash_password(password), role, name, now_ts(), now_ts()),
                )
            except sqlite3.IntegrityError:
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            for role_code in role_codes:
                role_row = con.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
                if role_row:
                    con.execute(
                        """
                        INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                        VALUES (?, ?, ?)
                        """,
                        (cur.lastrowid, role_row["id"], now_ts()),
                    )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_user', 'user', ?, ?, ?)
                """,
                (admin["id"], cur.lastrowid, json.dumps({"login": login, "roles": role_codes}, ensure_ascii=False), now_ts()),
            )
            con.commit()
        self.send_json(
            HTTPStatus.CREATED,
            {
                "id": cur.lastrowid,
                "login": login,
                "email": email,
                "phone": phone,
                "clerkUserId": clerk_user_id,
                "role": role,
                "roles": role_codes,
                "name": name,
            },
        )

    def api_users(self) -> None:
        admin = self.require_role({"admin", "director"})
        if not admin:
            return
        with db() as con:
            rows = con.execute(
                """
                SELECT id, login, email, phone, clerk_user_id, role, name, status, is_active, created_at
                FROM users
                WHERE is_active = 1
                ORDER BY id
                """
            ).fetchall()
            role_rows = con.execute(
                """
                SELECT ur.user_id, r.code, r.name
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                ORDER BY r.id
                """
            ).fetchall()
            roles_by_user: dict[int, list[dict]] = {}
            for role_row in role_rows:
                roles_by_user.setdefault(int(role_row["user_id"]), []).append({
                    "code": normalize_role(role_row["code"]),
                    "name": ROLE_LABELS.get(normalize_role(role_row["code"]), role_row["name"]),
                })
        self.send_json(
            HTTPStatus.OK,
            {
                "users": [
                    {
                        "id": row["id"],
                        "login": row["login"],
                        "email": row["email"],
                        "phone": row["phone"],
                        "clerkUserId": row["clerk_user_id"],
                        "role": normalize_role(row["role"]),
                        "roles": roles_by_user.get(int(row["id"]), [{"code": normalize_role(row["role"]), "name": ROLE_LABELS.get(normalize_role(row["role"]), row["role"])}]),
                        "roleLabel": ROLE_LABELS.get(normalize_role(row["role"]), row["role"]),
                        "name": row["name"],
                        "status": row["status"],
                        "isActive": bool(row["is_active"]),
                        "createdAt": row["created_at"],
                    }
                    for row in rows
                ]
            },
        )


    def api_users_manage(self) -> None:
        director = self.require_role({"director"})
        if not director:
            return
        payload = self.read_json()
        action = str(payload.get("action", "create_foreman")).strip() or "create_foreman"

        if action in {"set_project_foremen", "set_access"}:
            try:
                project_id = int(payload.get("project_id", payload.get("projectId")))
                foreman_ids = payload.get("foreman_ids", payload.get("foremanIds", []))
                if not isinstance(foreman_ids, list):
                    raise ValueError("bad_foreman_ids")
                foreman_ids = [int(item) for item in foreman_ids]
            except (TypeError, ValueError):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_access_payload"})
                return
            with db() as con:
                try:
                    assigned = self.set_project_foremen(con, project_id, foreman_ids, int(director["id"]))
                except ValueError as error:
                    status = HTTPStatus.NOT_FOUND if str(error) == "project_not_found" else HTTPStatus.BAD_REQUEST
                    self.send_json(status, {"error": str(error)})
                    return
                create_audit(
                    con,
                    director["id"],
                    "set_project_foremen",
                    "project",
                    project_id,
                    {"foreman_ids": assigned},
                )
                con.commit()
            self.send_json(HTTPStatus.OK, {"ok": True, "projectId": project_id, "assigned_foremen": assigned})
            return

        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", ""))
        name = str(payload.get("name", "")).strip() or login
        email = str(payload.get("email", "")).strip().lower() or None
        phone = str(payload.get("phone", "")).strip() or None
        project_ids = payload.get("project_ids", payload.get("projectIds", []))
        if project_ids is None:
            project_ids = []
        if not isinstance(project_ids, list):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_ids"})
            return
        try:
            project_ids = list(dict.fromkeys(int(item) for item in project_ids if int(item) > 0))
        except (TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_ids"})
            return
        if not login or len(password) < 10 or (clerk_enabled() and not email):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_user_data"})
            return
        if not valid_user_email(email):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_email", "message": "Введите корректный Email"})
            return
        if not valid_user_phone(phone):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_phone", "message": "Введите корректный номер телефона"})
            return

        clerk_user_id = None
        with db() as con:
            existing_login = con.execute("SELECT id FROM users WHERE login = ?", (login,)).fetchone()
            if existing_login:
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            unique_conflict = user_unique_conflict(con, email, phone)
            if unique_conflict:
                self.send_json(HTTPStatus.CONFLICT, unique_conflict)
                return
            if clerk_enabled() and email:
                existing_email = con.execute("SELECT id FROM users WHERE lower(email) = ?", (email.lower(),)).fetchone()
                if existing_email:
                    self.send_json(HTTPStatus.CONFLICT, {"error": "email_already_used", "message": "Этот Email уже зарегистрирован в системе"})
                    return
            if project_ids:
                placeholders = ",".join("?" for _ in project_ids)
                existing_project_count = con.execute(
                    f"SELECT COUNT(*) FROM projects WHERE id IN ({placeholders})",
                    project_ids,
                ).fetchone()[0]
                if int(existing_project_count or 0) != len(project_ids):
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "project_not_found"})
                    return

        if clerk_enabled():
            first_name, last_name = split_person_name(name)
            try:
                clerk_user = clerk_api_request(
                    "/users",
                    method="POST",
                    payload={
                        "email_address": [email],
                        "password": password,
                        "username": login,
                        "first_name": first_name,
                        "last_name": last_name,
                        "skip_password_checks": False,
                        "skip_password_requirement": False,
                    },
                )
                clerk_user_id = str(clerk_user.get("id") or "").strip() or None
            except Exception as error:
                self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "clerk_create_user_failed", "detail": str(error)})
                return

        with db() as con:
            try:
                cur = con.execute(
                    """
                    INSERT INTO users (login, email, phone, clerk_user_id, password_hash, role, name, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'foreman', ?, 'active', ?, ?)
                    """,
                    (login, email, phone, clerk_user_id, hash_password(password), name, now_ts(), now_ts()),
                )
            except sqlite3.IntegrityError:
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            role_row = con.execute("SELECT id FROM roles WHERE code = 'foreman'").fetchone()
            if role_row:
                con.execute(
                    """
                    INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (cur.lastrowid, role_row["id"], now_ts()),
                )
            for project_id in project_ids:
                con.execute(
                    """
                    INSERT OR IGNORE INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
                    VALUES (?, ?, 'foreman', 'РџСЂРѕСЂР°Р± РѕР±СЉРµРєС‚Р°', 0, ?, ?)
                    """,
                    (project_id, cur.lastrowid, director["id"], now_ts()),
                )
                con.execute(
                    "INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)",
                    (cur.lastrowid, project_id),
                )
                con.execute(
                    "UPDATE projects SET foreman_id = COALESCE(foreman_id, ?), updated_at = ? WHERE id = ?",
                    (cur.lastrowid, now_ts(), project_id),
                )
            create_audit(
                con,
                director["id"],
                "create_foreman",
                "user",
                cur.lastrowid,
                {"login": login, "project_ids": project_ids},
            )
            con.commit()
        self.send_json(
            HTTPStatus.CREATED,
            {
                "id": cur.lastrowid,
                "login": login,
                "email": email,
                "phone": phone,
                "clerkUserId": clerk_user_id,
                "role": "foreman",
                "roles": ["foreman"],
                "name": name,
                "projectIds": project_ids,
            },
        )


    def api_delete_managed_user(self, path: str) -> None:
        actor = self.require_user()
        if not actor:
            return
        if normalize_role(actor.get("role")) != "admin":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden", "message": "\u0423\u0434\u0430\u043b\u044f\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432 \u043c\u043e\u0436\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440"})
            return
        user_id = parse_path_int(path, 3)
        if not user_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_user_id"})
            return
        if int(actor.get("id") or 0) == int(user_id):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "cannot_delete_self", "message": "\u041d\u0435\u043b\u044c\u0437\u044f \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442"})
            return
        with db() as con:
            user_row = con.execute("SELECT id, login, name FROM users WHERE id = ? AND is_active = 1", (user_id,)).fetchone()
            if not user_row:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "user_not_found", "message": "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d"})
                return
            con.execute("DELETE FROM object_assignments WHERE user_id = ?", (user_id,))
            con.execute("DELETE FROM user_project_access WHERE user_id = ?", (user_id,))
            con.execute("DELETE FROM user_roles WHERE user_id = ?", (user_id,))
            con.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            con.execute(
                "UPDATE projects SET foreman_id = NULL, updated_at = ? WHERE foreman_id = ?",
                (now_ts(), user_id),
            )
            con.execute(
                "UPDATE users SET is_active = 0, status = 'deleted', updated_at = ? WHERE id = ?",
                (now_ts(), user_id),
            )
            create_audit(
                con,
                actor["id"],
                "delete_user",
                "user",
                user_id,
                {"login": user_row["login"], "name": user_row["name"]},
            )
            con.commit()
        self.send_json(HTTPStatus.OK, {"ok": True, "id": user_id})









    def api_companies(self) -> None:
        warehouse_api_companies(self)

    def api_create_company(self) -> None:
        warehouse_api_create_company(self)

    def api_project_warehouse_matches(self, path: str) -> None:
        warehouse_api_project_warehouse_matches(self, path)

    def api_warehouse_items(self) -> None:
        warehouse_api_warehouse_items(self)

    def api_warehouse_list(self) -> None:
        warehouse_api_warehouse_list(self)

    def api_warehouse_receipt(self) -> None:
        warehouse_api_warehouse_receipt(self)

    def api_warehouse_transfer(self, path: str) -> None:
        warehouse_api_warehouse_transfer(self, path)

    def api_warehouse_issue(self, path: str) -> None:
        warehouse_api_warehouse_issue(self, path)

    def api_project_supplier_offers(self, path: str) -> None:
        warehouse_api_project_supplier_offers(self, path)

    def api_create_market_counterparty(self, path: str) -> None:
        warehouse_api_create_market_counterparty(self, path)

    def api_create_supplier_offer(self, path: str) -> None:
        warehouse_api_create_supplier_offer(self, path)

    def api_clear_supplier_selection(self, path: str) -> None:
        warehouse_api_clear_supplier_selection(self, path)

    def api_update_supplier_offer(self, path: str) -> None:
        warehouse_api_update_supplier_offer(self, path)

    def set_project_foremen(
        self,
        con: sqlite3.Connection,
        project_id: int,
        foreman_ids: list[int],
        assigned_by: int,
    ) -> list[int]:
        return projects_set_project_foremen(con, project_id, foreman_ids, assigned_by)

    def api_projects(self) -> None:
        projects_api_projects(self)

    def api_create_project(self) -> None:
        projects_api_create_project(self)

    def api_update_project(self, path: str) -> None:
        projects_api_update_project(self, path)

    def api_delete_project(self, path: str) -> None:
        projects_api_delete_project(self, path)

    def can_access_project(self, user: dict, project_id: int) -> bool:
        return projects_can_access_project(self, user, project_id)

    def require_project_access(self, project_id: int) -> dict | None:
        return projects_require_project_access(self, project_id)

    def api_project_detail(self, path: str) -> None:
        projects_api_project_detail(self, path)

    def api_project_assignments(self, path: str) -> None:
        projects_api_project_assignments(self, path)

    def api_create_project_assignment(self, path: str) -> None:
        projects_api_create_project_assignment(self, path)

    def api_dashboard(self) -> None:
        user = self.require_user()
        if not user:
            return
        with db() as con:
            if user_has_any_role(user, {"admin", "director"}):
                projects = con.execute("SELECT * FROM projects").fetchall()
            elif user_has_any_role(user, {"foreman"}):
                projects = con.execute(
                    """
                    SELECT DISTINCT p.*
                    FROM projects p
                    JOIN object_assignments oa ON oa.object_id = p.id
                    WHERE oa.user_id = ? AND oa.role_code = 'foreman'
                    ORDER BY p.id DESC
                    """,
                    (user["id"],),
                ).fetchall()
            else:
                projects = con.execute(
                    """
                    SELECT p.*
                    FROM projects p
                    LEFT JOIN user_project_access a ON a.project_id = p.id
                    LEFT JOIN object_assignments oa ON oa.object_id = p.id
                    WHERE a.user_id = ? OR oa.user_id = ?
                    GROUP BY p.id
                    """,
                    (user["id"], user["id"]),
                ).fetchall()
            project_ids = [row["id"] for row in projects]
            total_budget = sum(float(row["budget"] or 0) for row in projects)
            total_paid = sum(float(row["paid"] or 0) for row in projects)
            total_spent = sum(float(row["spent"] or 0) for row in projects)
            active = sum(1 for row in projects if "работ" in str(row["status"]).lower())
            shortages = 0
            critical_items = []
            for project in projects:
                for item in material_summary_rows(con, int(project["id"])):
                    if item["missingQty"] > 0:
                        work_date = item.get("stageStartDate") or item.get("needByDate") or item.get("stageEndDate") or ""
                        parsed_work_date = parse_iso_date(str(work_date or ""))
                        shortages += 1
                        critical_items.append({
                            "projectId": project["id"],
                            "projectTitle": project["title"],
                            "title": item["title"],
                            "missingQty": item["missingQty"],
                            "unit": item["unit"],
                            "sectionTitle": item.get("sectionTitle") or "",
                            "stageTitle": item.get("stageTitle") or "",
                            "needByDate": item.get("needByDate") or "",
                            "workDate": work_date,
                            "daysUntilWork": (parsed_work_date - parse_iso_date(TODAY_ISO)).days if parsed_work_date and parse_iso_date(TODAY_ISO) else None,
                        })
            open_tasks = 0
            if project_ids:
                placeholders = ",".join("?" for _ in project_ids)
                open_tasks = con.execute(
                    f"SELECT COUNT(*) FROM tasks WHERE project_id IN ({placeholders}) AND status != 'done'",
                    project_ids,
                ).fetchone()[0]
                task_rows = con.execute(
                    f"""
                    SELECT t.title, t.status, t.priority, t.due_at, t.created_at, p.title AS project_title
                    FROM tasks t
                    JOIN projects p ON p.id = t.project_id
                    WHERE t.project_id IN ({placeholders})
                    ORDER BY CASE WHEN t.status = 'done' THEN 1 ELSE 0 END, t.due_at IS NULL, t.due_at ASC, t.id DESC
                    LIMIT 6
                    """,
                    project_ids,
                ).fetchall()
                document_rows = con.execute(
                    f"""
                    SELECT d.title, d.doc_type, d.status, d.created_at, p.title AS project_title
                    FROM documents d
                    JOIN projects p ON p.id = d.project_id
                    WHERE d.project_id IN ({placeholders})
                    {"" if user["role"] != "customer" else "AND d.is_client_visible = 1"}
                    ORDER BY d.id DESC
                    LIMIT 5
                    """,
                    project_ids,
                ).fetchall()
                daily_log_rows = con.execute(
                    f"""
                    SELECT l.title, l.report_date, l.work_done, l.created_at, p.title AS project_title
                    FROM daily_logs l
                    JOIN projects p ON p.id = l.project_id
                    WHERE l.project_id IN ({placeholders})
                    {"" if user["role"] != "customer" else "AND l.is_client_visible = 1"}
                    ORDER BY l.report_date DESC, l.id DESC
                    LIMIT 6
                    """,
                    project_ids,
                ).fetchall()
                if user["role"] == "customer":
                    message_rows = con.execute(
                        f"""
                        SELECT m.body, m.created_at, c.title AS chat_title, p.title AS project_title
                        FROM chat_messages m
                        JOIN chats c ON c.id = m.chat_id
                        JOIN projects p ON p.id = c.project_id
                        WHERE c.project_id IN ({placeholders}) AND c.chat_type = 'client'
                        ORDER BY m.id DESC
                        LIMIT 5
                        """,
                        project_ids,
                    ).fetchall()
                    stock_rows = []
                else:
                    message_rows = con.execute(
                        f"""
                        SELECT m.body, m.created_at, c.title AS chat_title, p.title AS project_title
                        FROM chat_messages m
                        JOIN chats c ON c.id = m.chat_id
                        JOIN projects p ON p.id = c.project_id
                        WHERE c.project_id IN ({placeholders})
                        ORDER BY m.id DESC
                        LIMIT 5
                        """,
                        project_ids,
                    ).fetchall()
                    stock_rows = con.execute(
                        f"""
                        SELECT sm.move_type, sm.qty, sm.comment, sm.created_at, e.title AS material_title, e.unit, p.title AS project_title
                        FROM stock_moves sm
                        JOIN estimate_items e ON e.id = sm.estimate_item_id
                        JOIN projects p ON p.id = sm.project_id
                        WHERE sm.project_id IN ({placeholders})
                        ORDER BY sm.id DESC
                        LIMIT 5
                        """,
                        project_ids,
                    ).fetchall()
            else:
                task_rows = []
                document_rows = []
                daily_log_rows = []
                message_rows = []
                stock_rows = []
            recent_activity = []
            for row in task_rows:
                recent_activity.append({
                    "kind": "task",
                    "title": row["title"],
                    "text": f"{row['project_title']} · {row['priority']} · до {row['due_at'] or 'без срока'}",
                    "createdAt": row["created_at"],
                })
            for row in document_rows:
                recent_activity.append({
                    "kind": "document",
                    "title": row["title"],
                    "text": f"{row['project_title']} · {row['status']}",
                    "createdAt": row["created_at"],
                })
            for row in daily_log_rows:
                recent_activity.append({
                    "kind": "log",
                    "title": row["title"],
                    "text": f"{row['project_title']} · {row['report_date']} · {row['work_done'][:80]}",
                    "createdAt": row["created_at"],
                })
            for row in message_rows:
                recent_activity.append({
                    "kind": "message",
                    "title": row["chat_title"],
                    "text": f"{row['project_title']} · {row['body'][:90]}",
                    "createdAt": row["created_at"],
                })
            for row in stock_rows:
                move_label = {
                    "purchase": "Закупка",
                    "receipt": "Поступление",
                    "use": "Использовано",
                    "writeoff": "Списание",
                }.get(row["move_type"], row["move_type"])
                recent_activity.append({
                    "kind": "stock",
                    "title": row["material_title"],
                    "text": f"{row['project_title']} · {move_label} {row['qty']} {row['unit']}",
                    "createdAt": row["created_at"],
                })
            recent_activity = sorted(recent_activity, key=lambda item: item["createdAt"] or 0, reverse=True)[:8]
            today_actions = []
            if critical_items and user["role"] != "customer":
                first = critical_items[0]
                today_actions.append(f"Закрыть нехватку: {first['title']} — нужно ещё {first['missingQty']} {first['unit']}.")
            if open_tasks:
                today_actions.append(f"Разобрать открытые задачи: {open_tasks} шт. по активным объектам.")
            if user_has_any_role(user, {"admin", "director"}) and total_paid - total_spent < 0:
                today_actions.append("Проверить кассовый разрыв: расходы сейчас выше оплат.")
            if user["role"] == "purchaser":
                today_actions.append("Обновить поступления и списания на складе, чтобы смета показывала реальные остатки.")
            if user["role"] == "customer":
                today_actions.append("Проверить график работ, видимые документы и сообщения команды по объекту.")
            if not today_actions:
                today_actions.append("Критических блокеров нет — держим график и фиксируем факт каждый день.")
        data = {
            "projectsCount": len(projects),
            "activeProjects": active,
            "avgProgress": round(sum(float(row["progress"] or 0) for row in projects) / len(projects), 1) if projects else 0,
            "shortagesCount": 0 if user["role"] == "customer" else shortages,
            "openTasksCount": open_tasks,
            "criticalItems": [] if user["role"] == "customer" else critical_items[:10],
            "todayActions": today_actions[:6],
            "recentActivity": recent_activity,
            "projects": [serialize_project(row, user) for row in projects[:6]],
        }
        if user_has_any_role(user, {"admin", "director"}):
            data.update({
                "totalBudget": total_budget,
                "totalPaid": total_paid,
                "totalSpent": total_spent,
                "profitNow": total_paid - total_spent,
            })
        self.send_json(HTTPStatus.OK, data)






    def api_materials_summary(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            items = material_summary_rows(con, project_id)
        self.send_json(HTTPStatus.OK, {"items": items})







    def api_create_material(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not user_has_any_role(user, {"admin", "director"}):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        unit = str(payload.get("unit", "")).strip() or "шт"
        planned_qty, planned_price = normalize_estimate_planned_values(
            unit,
            payload.get("planned_qty", payload.get("plannedQty", 0)),
            payload.get("planned_price", payload.get("plannedPrice", 0)),
        )
        if not title or planned_qty <= 0:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_and_qty_required"})
            return
        with db() as con:
            existing = con.execute(
                "SELECT id FROM estimate_items WHERE project_id = ? AND lower(title) = lower(?) AND unit = ?",
                (project_id, title, unit),
            ).fetchone()
            if existing:
                self.send_json(HTTPStatus.CONFLICT, {"error": "material_exists"})
                return
            cur = con.execute(
                """
                INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price, item_kind)
                VALUES (?, ?, ?, ?, ?, 'material')
                """,
                (project_id, title, unit, planned_qty, planned_price),
            )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_material', 'estimate_item', ?, ?, ?)
                """,
                (user["id"], cur.lastrowid, json.dumps({"project_id": project_id, "title": title}, ensure_ascii=False), now_ts()),
            )
            con.commit()
            items = material_summary_rows(con, project_id)
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid, "items": items})

    def api_update_material(self, path: str) -> None:
        material_id = parse_path_int(path, 2)
        if not material_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_material_id"})
            return
        payload = self.read_json()
        with db() as con:
            material = con.execute("SELECT * FROM estimate_items WHERE id = ?", (material_id,)).fetchone()
            if not material:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "material_not_found"})
                return
            user = self.require_project_access(int(material["project_id"]))
            if not user:
                return
            if user["role"] == "customer":
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
                return
            stage_id = payload.get("stage_id", payload.get("stageId", material["stage_id"]))
            try:
                stage_id = int(stage_id) if stage_id not in (None, "", 0, "0") else None
            except (TypeError, ValueError):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
                return
            if stage_id:
                stage = con.execute(
                    "SELECT id FROM work_stages WHERE id = ? AND project_id = ?",
                    (stage_id, material["project_id"]),
                ).fetchone()
                if not stage:
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "stage_not_found"})
                    return
            raw_delivery_days = payload.get("delivery_days", payload.get("deliveryDays", material["delivery_days"]))
            try:
                delivery_days = int(raw_delivery_days) if raw_delivery_days not in (None, "") else None
            except (TypeError, ValueError):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_delivery_days"})
                return
            if delivery_days is not None:
                delivery_days = max(0, min(delivery_days, 90))
            merged_material = dict(material)
            merged_material.update(payload)
            con.execute(
                """
                UPDATE estimate_items
                SET title = ?, unit = ?, planned_qty = ?, planned_price = ?, stage_id = ?, item_kind = ?, section_title = ?, delivery_days = ?, need_by_date = ?, notes = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    str(payload.get("title", material["title"])).strip() or material["title"],
                    str(payload.get("unit", material["unit"])).strip() or material["unit"],
                    max(0.01, normalize_estimate_planned_qty(
                        payload.get("unit", material["unit"]),
                        payload.get("planned_qty", payload.get("plannedQty", material["planned_qty"])),
                    )),
                    max(0.0, float(payload.get("planned_price", payload.get("plannedPrice", material["planned_price"])) or 0)),
                    stage_id,
                    resolved_estimate_item_kind(merged_material),
                    resolved_estimate_section_title(merged_material),
                    delivery_days,
                    str(payload.get("need_by_date", payload.get("needByDate", material["need_by_date"] or ""))).strip() or None,
                    str(payload.get("notes", material["notes"] or "")).strip() or None,
                    now_ts(),
                    material_id,
                ),
            )
            create_audit(
                con,
                user["id"],
                "update_material",
                "estimate_item",
                material_id,
                {"project_id": material["project_id"], "stage_id": stage_id},
            )
            con.commit()
            items = material_summary_rows(con, int(material["project_id"]))
        self.send_json(HTTPStatus.OK, {"id": material_id, "items": items})


    def api_project_market_analysis(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] == "customer":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        kind = str((params.get("kind") or ["material"])[0] or "material").strip().lower()
        if kind not in {"material", "work"}:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_kind"})
            return
        try:
            with db() as con:
                payload = build_project_market_analysis(con, project_id, kind)
        except LookupError as exc:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": str(exc)})
            return
        except urllib.error.URLError:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "autobot_unavailable"})
            return
        except Exception:
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "market_analysis_failed"})
            return
        self.send_json(HTTPStatus.OK, payload)





    def api_project_bootstrap(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not user_has_any_role(user, {"admin", "director"}):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        project_payload = payload.get("project") if isinstance(payload.get("project"), dict) else {}
        stages_payload = payload.get("stages") if isinstance(payload.get("stages"), list) else []
        materials_payload = payload.get("materials") if isinstance(payload.get("materials"), list) else []
        tasks_payload = payload.get("tasks") if isinstance(payload.get("tasks"), list) else []
        replace_existing = bool(payload.get("replace_existing", payload.get("replaceExisting", True)))
        if not stages_payload and not materials_payload and not tasks_payload and not project_payload:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bootstrap_payload_empty"})
            return

        with db() as con:
            project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not project:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                return

            # Update core project fields from the parsed tender/estimate package.
            if project_payload:
                updates = (
                    str(project_payload.get("title", project["title"])).strip() or project["title"],
                    str(project_payload.get("address", project["address"])).strip() or project["address"],
                    str(project_payload.get("client_name", project_payload.get("clientName", project["client_name"]))).strip() or project["client_name"],
                    str(project_payload.get("contract_no", project_payload.get("contractNo", project["contract_no"] or ""))).strip() or None,
                    str(project_payload.get("contract_date", project_payload.get("contractDate", project["contract_date"] or ""))).strip() or None,
                    str(project_payload.get("city", project["city"] or "")).strip() or None,
                    str(project_payload.get("region", project["region"] or "")).strip() or None,
                    float(project_payload.get("budget", project["budget"] or 0) or 0),
                    str(project_payload.get("started_at", project_payload.get("startedAt", project["started_at"] or ""))).strip() or None,
                    str(project_payload.get("deadline_at", project_payload.get("deadlineAt", project["deadline_at"] or ""))).strip() or None,
                    str(project_payload.get("description", project["description"] or "")).strip() or None,
                    now_ts(),
                    project_id,
                )
                con.execute(
                    """
                    UPDATE projects
                    SET title = ?, address = ?, client_name = ?, contract_no = ?, contract_date = ?,
                        city = ?, region = ?, budget = ?, started_at = ?, deadline_at = ?, description = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    updates,
                )

            if replace_existing:
                con.execute("DELETE FROM work_stages WHERE project_id = ?", (project_id,))
                con.execute("DELETE FROM estimate_items WHERE project_id = ?", (project_id,))
                con.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))

            stage_map: dict[str, int] = {}

            def insert_stage_nodes(nodes: list[dict], parent_id: int | None = None, depth: int = 0) -> None:
                for index, item in enumerate(nodes, start=1):
                    if not isinstance(item, dict):
                        continue
                    title = str(item.get("title", "")).strip()
                    if not title:
                        continue
                    stage_kind = str(item.get("stage_kind", item.get("stageKind", ("section" if depth == 0 else "work")))).strip() or "work"
                    status_code = str(item.get("status_code", item.get("statusCode", "not_started"))).strip() or "not_started"
                    key = str(item.get("key", item.get("code", title))).strip() or title
                    cur = con.execute(
                        """
                        INSERT INTO work_stages (
                            project_id, title, position, parent_id, stage_kind, status_code,
                            planned_start, planned_end, customer_start, customer_end, progress,
                            responsible, notes, is_client_visible, depends_on_materials, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            project_id,
                            title,
                            int(item.get("position", index) or index),
                            parent_id,
                            stage_kind,
                            status_code,
                            str(item.get("planned_start", item.get("plannedStart", ""))).strip() or None,
                            str(item.get("planned_end", item.get("plannedEnd", ""))).strip() or None,
                            str(item.get("customer_start", item.get("customerStart", ""))).strip() or None,
                            str(item.get("customer_end", item.get("customerEnd", ""))).strip() or None,
                            max(0, min(100, int(item.get("progress", 0) or 0))),
                            str(item.get("responsible", "")).strip() or None,
                            str(item.get("notes", "")).strip() or None,
                            1 if item.get("is_client_visible", item.get("isClientVisible", True)) else 0,
                            1 if item.get("depends_on_materials", item.get("dependsOnMaterials", False)) else 0,
                            now_ts(),
                            now_ts(),
                        ),
                    )
                    stage_id = int(cur.lastrowid)
                    stage_map[key] = stage_id
                    stage_map[title] = stage_id
                    children = item.get("children") if isinstance(item.get("children"), list) else []
                    if children:
                        insert_stage_nodes(children, stage_id, depth + 1)

            insert_stage_nodes(stages_payload)

            for item in materials_payload:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                if not title:
                    continue
                stage_ref = str(item.get("stage_key", item.get("stageKey", item.get("stage_title", item.get("stageTitle", ""))))).strip()
                stage_id = stage_map.get(stage_ref) if stage_ref else None
                item_kind = resolved_estimate_item_kind(item)
                section_title = resolved_estimate_section_title(item)
                unit = str(item.get("unit", "шт")).strip() or "шт"
                planned_qty, planned_price = normalize_estimate_planned_values(
                    unit,
                    item.get("planned_qty", item.get("plannedQty", 0)),
                    item.get("planned_price", item.get("plannedPrice", 0)),
                )
                con.execute(
                    """
                    INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price, stage_id, item_kind, section_title, need_by_date, notes, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        title,
                        unit,
                        max(0.01, planned_qty),
                        max(0.0, planned_price),
                        stage_id,
                        item_kind,
                        section_title,
                        str(item.get("need_by_date", item.get("needByDate", ""))).strip() or None,
                        str(item.get("notes", "")).strip() or None,
                        now_ts(),
                    ),
                )

            for item in tasks_payload:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                if not title:
                    continue
                assignee_id = item.get("assignee_id", item.get("assigneeId"))
                try:
                    assignee_id = int(assignee_id) if assignee_id not in (None, "", 0, "0") else None
                except (TypeError, ValueError):
                    assignee_id = None
                con.execute(
                    """
                    INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_at, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        title,
                        str(item.get("description", "")).strip(),
                        str(item.get("status", "open")).strip() or "open",
                        str(item.get("priority", "normal")).strip() or "normal",
                        assignee_id,
                        str(item.get("due_at", item.get("dueAt", ""))).strip() or None,
                        user["id"],
                        now_ts(),
                        now_ts(),
                    ),
                )

            # If parser didn't send tasks, generate minimal startup tasks from imported structure.
            if not tasks_payload:
                generated = []
                if stages_payload:
                    generated.append(("Подтвердить график и структуру этапов", "Проверить импортированные разделы и сроки объекта", "high"))
                if materials_payload:
                    generated.append(("Проверить потребность по материалам", "Сверить импортированные материалы и даты потребности", "high"))
                if project_payload.get("contract_no") or project_payload.get("contract_date"):
                    generated.append(("Проверить договорные условия объекта", "Убедиться, что предстроительные условия и даты старта учтены", "normal"))
                for title, description, priority in generated:
                    con.execute(
                        """
                        INSERT INTO tasks (project_id, title, description, status, priority, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, 'open', ?, ?, ?, ?)
                        """,
                        (project_id, title, description, priority, user["id"], now_ts(), now_ts()),
                    )

            create_audit(
                con,
                user["id"],
                "bootstrap_project",
                "project",
                project_id,
                {
                    "replace_existing": replace_existing,
                    "stages": len(stages_payload),
                    "materials": len(materials_payload),
                    "tasks": len(tasks_payload),
                },
            )
            mark_project_schedule_draft(con, project_id)
            con.commit()
            project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            stages = con.execute("SELECT COUNT(*) FROM work_stages WHERE project_id = ?", (project_id,)).fetchone()[0]
            materials = con.execute("SELECT COUNT(*) FROM estimate_items WHERE project_id = ?", (project_id,)).fetchone()[0]
            tasks = con.execute("SELECT COUNT(*) FROM tasks WHERE project_id = ?", (project_id,)).fetchone()[0]

        self.send_json(
            HTTPStatus.OK,
            {
                "project": serialize_project(project_row, user),
                "summary": {"stages": stages, "materials": materials, "tasks": tasks},
            },
        )

    def api_import_estimate(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not user_has_any_role(user, {"admin", "director"}):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return

        payload = self.read_json()
        items = payload.get("items")
        replace = bool(payload.get("replace", False))
        if not isinstance(items, list) or not items:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "items_required"})
            return

        normalized = []
        for item in items:
            title = str(item.get("title", "")).strip()
            unit = str(item.get("unit", "")).strip() or "шт"
            planned_qty, planned_price = normalize_estimate_planned_values(
                unit,
                item.get("planned_qty", item.get("plannedQty", 0)),
                item.get("planned_price", item.get("plannedPrice", 0)),
            )
            if not title or planned_qty <= 0:
                continue
            item_kind = resolved_estimate_item_kind(item)
            section_title = resolved_estimate_section_title(item)
            normalized.append((project_id, title, unit, planned_qty, planned_price, item_kind, section_title))

        if not normalized:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "no_valid_items"})
            return

        with db() as con:
            if replace:
                con.execute("DELETE FROM estimate_items WHERE project_id = ?", (project_id,))
            imported = 0
            for normalized_item in normalized:
                _, title, unit, planned_qty, planned_price, item_kind, section_title = normalized_item
                existing = con.execute(
                    "SELECT id FROM estimate_items WHERE project_id = ? AND lower(title) = lower(?) AND unit = ?",
                    (project_id, title, unit),
                ).fetchone()
                if existing:
                    con.execute(
                        """
                        UPDATE estimate_items
                        SET planned_qty = ?, planned_price = ?, item_kind = ?, section_title = ?
                        WHERE id = ?
                        """,
                        (planned_qty, planned_price, item_kind, section_title, existing["id"]),
                    )
                else:
                    con.execute(
                        """
                        INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price, item_kind, section_title)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        normalized_item,
                    )
                imported += 1
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'import_estimate', 'project', ?, ?, ?)
                """,
                (
                    user["id"],
                    project_id,
                    json.dumps({"count": imported, "replace": replace}, ensure_ascii=False),
                    now_ts(),
                ),
            )
            con.commit()

            summary = material_summary_rows(con, project_id)
        self.send_json(HTTPStatus.CREATED, {"imported": imported, "items": summary})





    def api_project_analysis(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            materials = material_summary_rows(con, project_id)
            open_tasks = con.execute(
                "SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status != 'done'",
                (project_id,),
            ).fetchone()[0]
            stages = con.execute(
                "SELECT * FROM work_stages WHERE project_id = ? ORDER BY position",
                (project_id,),
            ).fetchall()
        if not project:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return

        shortages = [item for item in materials if item["missingQty"] > 0]
        low_stock = [
            item for item in materials
            if item["stockQty"] <= max(item["plannedQty"] * 0.1, 1) and item["usageProgress"] < 100
        ]
        avg_stage_progress = round(sum(float(stage["progress"]) for stage in stages) / len(stages), 1) if stages else float(project["progress"] or 0)
        material_purchase_progress = round(
            sum(item["purchaseProgress"] for item in materials) / len(materials),
            1,
        ) if materials else 0

        risks = []
        actions = []
        if shortages:
            for item in shortages:
                risks.append({
                    "level": "critical",
                    "title": f"Не хватает: {item['title']}",
                    "text": f"По смете нужно {item['plannedQty']} {item['unit']}, закрыто закупкой/поступлением {max(item['purchasedQty'], item['receivedQty'])}. Не хватает {item['missingQty']} {item['unit']}.",
                })
                actions.append(f"Создать заявку на закупку: {item['title']} — {item['missingQty']} {item['unit']}.")
        if low_stock:
            for item in low_stock:
                risks.append({
                    "level": "warning",
                    "title": f"Малый остаток: {item['title']}",
                    "text": f"Остаток {item['stockQty']} {item['unit']}, использовано {item['usedQty']} из {item['plannedQty']}.",
                })
        if open_tasks:
            actions.append(f"Проверить открытые задачи по объекту: {open_tasks}.")
        if not actions:
            actions.append("Критичных действий сейчас нет. Продолжать контроль списаний и графика.")

        payload = {
            "projectId": project_id,
            "projectProgress": project["progress"],
            "stageProgress": avg_stage_progress,
            "materialPurchaseProgress": material_purchase_progress,
            "shortagesCount": len(shortages),
            "openTasksCount": open_tasks,
            "risks": risks,
            "actions": actions,
        }
        if user["role"] == "customer":
            payload["risks"] = [risk for risk in risks if risk["level"] != "critical"][:2]
            payload["actions"] = ["Команда ведёт контроль материалов и графика. Критичные внутренние действия скрыты."]
        self.send_json(HTTPStatus.OK, payload)








    def api_material_schedule(self, path: str) -> None:
        return schedule_api_material_schedule(self, path)

    def api_save_material_schedule(self, path: str) -> None:
        return schedule_api_save_material_schedule(self, path)

    def api_project_auto_schedule(self, path: str) -> None:
        return schedule_api_project_auto_schedule(self, path)

    def api_project_section_schedule_forecast(self, path: str) -> None:
        return schedule_api_project_section_schedule_forecast(self, path)

    def api_project_schedule_status(self, path: str) -> None:
        return schedule_api_project_schedule_status(self, path)

    def api_update_project_schedule_status(self, path: str) -> None:
        return schedule_api_update_project_schedule_status(self, path)

    def api_project_stages(self, path: str) -> None:
        return schedule_api_project_stages(self, path)

    def api_create_project_stage(self, path: str) -> None:
        return schedule_api_create_project_stage(self, path)

    def api_update_stage(self, path: str) -> None:
        return schedule_api_update_stage(self, path)

    def api_project_tasks(self, path: str) -> None:
        return schedule_api_project_tasks(self, path)

    def api_create_task(self, path: str) -> None:
        return schedule_api_create_task(self, path)

    def api_update_task(self, path: str) -> None:
        return schedule_api_update_task(self, path)









    def recalc_project_finance_totals(self, con: sqlite3.Connection, project_id: int) -> None:
        return finance_recalc_project_finance_totals(self, con, project_id)

    def api_project_finances(self, path: str) -> None:
        return finance_api_project_finances(self, path)

    def api_create_finance_entry(self, path: str) -> None:
        return finance_api_create_finance_entry(self, path)

    def api_upload_finance_invoice(self, path: str) -> None:
        return finance_api_upload_finance_invoice(self, path)

    def api_update_finance_entry(self, path: str) -> None:
        return finance_api_update_finance_entry(self, path)

    def api_pay_invoice(self) -> None:
        return finance_api_pay_invoice(self)














    def api_project_notifications(self, path: str) -> None:
        return comm_api_project_notifications(self, path)

    def api_project_documents(self, path: str) -> None:
        return comm_api_project_documents(self, path)

    def api_project_executive_docs(self, path: str) -> None:
        return comm_api_project_executive_docs(self, path)

    def api_create_project_executive_doc(self, path: str) -> None:
        return comm_api_create_project_executive_doc(self, path)

    def api_upload_project_document(self, path: str) -> None:
        return comm_api_upload_project_document(self, path)

    def api_document_file(self, path: str, inline: bool) -> None:
        return comm_api_document_file(self, path, inline)

    def api_project_daily_logs(self, path: str) -> None:
        return comm_api_project_daily_logs(self, path)

    def api_create_daily_log(self, path: str) -> None:
        return comm_api_create_daily_log(self, path)

    def api_delete_daily_log(self, path: str) -> None:
        return comm_api_delete_daily_log(self, path)

    def api_project_chats(self, path: str) -> None:
        return comm_api_project_chats(self, path)

    def can_access_chat(self, user: dict, chat_id: int) -> bool:
        return comm_can_access_chat(self, user, chat_id)

    def api_chat_messages(self, path: str) -> None:
        return comm_api_chat_messages(self, path)

    def api_create_chat_message(self, path: str) -> None:
        return comm_api_create_chat_message(self, path)

    def api_create_stock_move(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] == "customer":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        move_type = str(payload.get("move_type", "")).strip()
        if move_type not in {"purchase", "receipt", "use", "writeoff"}:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_move_type"})
            return
        qty = float(payload.get("qty", 0) or 0)
        if qty <= 0:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_qty"})
            return
        with db() as con:
            cur = con.execute(
                """
                INSERT INTO stock_moves (project_id, estimate_item_id, move_type, qty, price, comment, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    payload.get("estimate_item_id"),
                    move_type,
                    qty,
                    float(payload.get("price", 0) or 0),
                    str(payload.get("comment", "")).strip(),
                    user["id"],
                    now_ts(),
                ),
            )
            con.commit()
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})

    def render_template(self, template_name: str, variables: dict[str, str]) -> bytes:
        template = (FRONTEND_TEMPLATES / template_name).read_text(encoding="utf-8")
        for key, value in variables.items():
            template = template.replace("{{" + key + "}}", value)
        return template.encode("utf-8")

    def project_cards_fallback_html(self, user: dict) -> str:
        with db() as con:
            if user_has_any_role(user, {"admin", "director", "foreman"}):
                rows = con.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
            else:
                rows = con.execute(
                    """
                    SELECT p.*
                    FROM projects p
                    JOIN user_project_access a ON a.project_id = p.id
                    WHERE a.user_id = ?
                    ORDER BY p.id DESC
                    """,
                    (user["id"],),
                ).fetchall()

        if not rows:
            return '<div class="muted">Объекты пока не найдены.</div>'

        def esc(value: object) -> str:
            return html.escape("" if value is None else str(value), quote=True)

        def project_money(value: object) -> str:
            if value is None:
                return "Скрыто"
            try:
                amount = float(value or 0)
            except (TypeError, ValueError):
                return esc(value)
            formatted = f"{amount:,.0f}".replace(",", " ")
            return f"{formatted} ₽"

        def project_progress(value: object) -> int:
            try:
                return max(0, min(100, int(round(float(value or 0)))))
            except (TypeError, ValueError):
                return 0

        def is_completed(row: sqlite3.Row) -> bool:
            status = str(row["status"] or "").lower()
            return project_progress(row["progress"]) >= 100 or "сдан" in status or "заверш" in status

        sorted_rows = sorted(rows, key=lambda row: (1 if is_completed(row) else 0, -int(row["id"])))
        cards: list[str] = []
        for row in sorted_rows:
            progress = project_progress(row["progress"])
            completed = is_completed(row)
            status_badge = (
                '<span class="badge success">Завершен</span>'
                if completed
                else f'<span class="badge">{esc(row["status"] or "В работе")}</span>'
            )
            cards.append(
                f'<article class="project-card {"project-completed" if completed else ""}" data-project-id="{esc(row["id"])}">'
                '<div class="project-top">'
                f'<div><h3>{esc(row["title"])}</h3><p>{esc(row["address"] or "Адрес не указан")}</p></div>'
                f'<div class="project-card-tools"><div class="project-badges">{status_badge}</div></div>'
                '</div>'
                '<div class="meta-grid">'
                f'<div><span>Заказчик</span><strong>{esc(row["client_name"] or "Не указан")}</strong></div>'
                f'<div><span>Бюджет</span><strong>{project_money(row["budget"])}</strong></div>'
                f'<div><span>Дедлайн</span><strong>{esc(row["deadline_at"] or "—")}</strong></div>'
                '</div>'
                '<div class="progress-strong">'
                f'<div class="progress-strong-head"><span>Готовность объекта</span><strong>{progress}%</strong></div>'
                f'<div class="progress-strong-track"><i style="width:{progress}%"></i></div>'
                '</div>'
                '</article>'
            )
        return "".join(cards)

    def strip_role_content(self, content: str, user: dict) -> str:
        if not user_has_any_role(user, {"admin", "director"}):
            content = DIRECTOR_ACTION_BLOCK_RE.sub("", content)
        return content

    def send_html(self, body: bytes, status: int = HTTPStatus.OK) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def serve_app(self, path: str) -> None:
        if path == "/login":
            self.send_html(
                self.render_template(
                    "login.html",
                    {
                        "auth_config": self.auth_config_script(),
                        "auth_head": self.clerk_sign_in_script(),
                    },
                )
            )
            return

        user = self.current_user()
        if not user:
            self.redirect(f"{LOGIN_PATH}?next={urllib.parse.quote(path, safe='/')}")
            return
        if not user_can_open(user, path):
            self.redirect(DEFAULT_AUTH_PATH + "?restricted=1")
            return

        page_info = APP_PAGES.get(path)
        if not page_info:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        page_name, title = page_info
        content_path = FRONTEND_PAGES / f"{page_name}.html"
        if not content_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Page not found")
            return

        content = self.strip_role_content(content_path.read_text(encoding="utf-8"), user)
        if page_name == "autobot":
            content = content.replace(
                "{{autobot_url}}",
                html.escape(PMBI_AUTOBOT_BASE_URL or "http://127.0.0.1:8765", quote=True),
            )
        if page_name == "projects":
            content = content.replace(
                '<div class="projects-grid" data-projects-list></div>',
                f'<div class="projects-grid" data-projects-list>{self.project_cards_fallback_html(user)}</div>',
            )
        body = self.render_template(
            "base.html",
            {
                "title": title,
                "page": page_name,
                "auth_config": self.auth_config_script(),
                "auth_head": self.clerk_sign_in_script(),
                "content": content,
            },
        )
        self.send_html(body)

    def serve_asset(self, path: str) -> None:
        relative = path.removeprefix("/assets/").lstrip("/")
        candidate = (FRONTEND_ASSETS / relative).resolve()
        try:
            candidate.relative_to(FRONTEND_ASSETS.resolve())
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return
        if not candidate.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        content_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        if candidate.suffix.lower() in {".html", ".js", ".css", ".json", ".txt"}:
            content_type += "; charset=utf-8"
        body = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path: str) -> None:
        user = self.current_user()
        is_page_request = path.endswith(".html") or "." not in Path(path).name
        if path not in PUBLIC_STATIC_PATHS and not user:
            if is_page_request:
                next_path = urllib.parse.quote(path, safe="/")
                self.redirect(f"{LOGIN_PATH}?next={next_path}")
            else:
                self.send_error(HTTPStatus.UNAUTHORIZED, "Authentication required")
            return

        if user and is_page_request and not user_can_open(user, path):
            if path.endswith(".html") or "." not in Path(path).name:
                self.redirect(DEFAULT_AUTH_PATH + "?restricted=1")
            else:
                self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return

        file_path = self.resolve_static_path(path)
        if not file_path:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        if file_path.suffix.lower() in {".html", ".js", ".css", ".json", ".txt"}:
            content_type += "; charset=utf-8"
        body = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def resolve_static_path(self, path: str) -> Path | None:
        rel = path.lstrip("/") or "index.html"
        candidate = (DEPLOY_ROOT / rel).resolve()
        try:
            candidate.relative_to(DEPLOY_ROOT.resolve())
        except ValueError:
            return None
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.is_file():
            return None
        return candidate


def main() -> None:
    init_db()
    print(f"PM.bi backend: http://{HOST}:{PORT}/")
    print(f"Database: {DB_PATH}")
    if BOOTSTRAP_PATH.exists():
        print(f"Initial admin credentials: {BOOTSTRAP_PATH}")
    print("Press Ctrl+C to stop the server.")
    ThreadingHTTPServer((HOST, PORT), PMBIHandler).serve_forever()


def resolved_estimate_item_kind(item: dict | sqlite3.Row) -> str:
    note_value = (
        extract_labeled_note_value(payload_get(item, "notes"), ("\u0422\u0438\u043f", "Type"))
        or extract_labeled_note_value(payload_get(item, "notes"), ("Type",))
    )
    if note_value:
        return normalize_estimate_item_kind(note_value)
    raw_value = (
        payload_get(item, "item_kind")
        or payload_get(item, "itemKind")
        or payload_get(item, "type")
        or payload_get(item, "type_label")
        or payload_get(item, "typeLabel")
        or payload_get(item, "position_type")
        or payload_get(item, "positionType")
        or ""
    )
    raw_text = str(raw_value or "").strip()
    if raw_text:
        return normalize_estimate_item_kind(raw_text)
    return normalize_estimate_item_kind(note_value)


def resolved_estimate_section_title(item: dict | sqlite3.Row) -> str | None:
    def normalize_section_title_text(value: object) -> str | None:
        text = re.sub(r"\s+", " ", str(value or "").strip())
        if not text:
            return None
        duplicate_match = re.fullmatch(r"(.+?)\s+\1", text)
        if duplicate_match:
            text = duplicate_match.group(1).strip()
        return text or None

    direct_value = (
        payload_get(item, "section_title")
        or payload_get(item, "sectionTitle")
        or payload_get(item, "section_name")
        or payload_get(item, "sectionName")
        or payload_get(item, "section")
        or payload_get(item, "chapter")
        or ""
    )
    direct_text = normalize_section_title_text(direct_value)
    if direct_text:
        return direct_text
    note_text = (
        extract_labeled_note_value(payload_get(item, "notes"), ("\u0420\u0430\u0437\u0434\u0435\u043b", "Section", "Chapter"))
        or extract_labeled_note_value(payload_get(item, "notes"), ("Section", "Chapter"))
    )
    return normalize_section_title_text(note_text)


if __name__ == "__main__":
    main()
