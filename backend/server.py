from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
import urllib.parse
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEPLOY_ROOT = PROJECT_ROOT / "deploy"
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
FRONTEND_TEMPLATES = FRONTEND_ROOT / "templates"
FRONTEND_PAGES = FRONTEND_ROOT / "pages"
FRONTEND_ASSETS = FRONTEND_ROOT / "assets"
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
BOOTSTRAP_PATH = DATA_DIR / "INITIAL_ADMIN.txt"

HOST = os.environ.get("PMBI_HOST", "127.0.0.1")
PORT = int(os.environ.get("PMBI_PORT", os.environ.get("PORT", "8080")))
SESSION_COOKIE = "pmbi_session"
SESSION_TTL_SECONDS = 60 * 60 * 12
PASSWORD_ITERATIONS = 220_000

LOGIN_PATH = "/login"
DEFAULT_AUTH_PATH = "/app/dashboard"


ROLE_ALLOWED_PREFIXES = {
    "director": ["*"],
    "foreman": [
        "/app",
        "/app/dashboard",
        "/app/projects",
        "/app/schedule",
        "/app/logs",
        "/app/warehouse",
        "/app/chats",
    ],
    "buyer": [
        "/app",
        "/app/dashboard",
        "/app/projects",
        "/app/logs",
        "/app/warehouse",
        "/app/chats",
    ],
    "client": [
        "/app",
        "/app/dashboard",
        "/app/projects",
        "/app/schedule",
        "/app/logs",
        "/app/chats",
    ],
}

ROLE_LABELS = {
    "director": "Директор",
    "foreman": "Прораб",
    "buyer": "Закупщик",
    "client": "Заказчик",
}

PUBLIC_STATIC_PATHS = {
    "/",
    "/index.html",
    LOGIN_PATH,
    "/robots.txt",
}

APP_PAGES = {
    "/app": ("dashboard", "Панель"),
    "/app/dashboard": ("dashboard", "Панель"),
    "/app/projects": ("projects", "Объекты"),
    "/app/warehouse": ("warehouse", "Склад"),
    "/app/schedule": ("schedule", "График работ"),
    "/app/logs": ("logs", "Журнал работ"),
    "/app/chats": ("chats", "Чаты"),
    "/app/users": ("users", "Пользователи"),
    "/app/reports": ("reports", "Отчётность"),
}

DIRECTOR_ACTION_BLOCK_RE = re.compile(
    r"<(?P<tag>section|button)\b(?=[^>]*\sdata-director-action\b)[\s\S]*?</(?P=tag)>",
    re.IGNORECASE,
)


def now_ts() -> int:
    return int(time.time())


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


def init_db() -> None:
    with db() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('director','foreman','buyer','client')),
                name TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
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
                address TEXT NOT NULL,
                client_name TEXT NOT NULL,
                contract_no TEXT,
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
                created_at INTEGER NOT NULL
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

            CREATE TABLE IF NOT EXISTS work_stages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                planned_start TEXT,
                planned_end TEXT,
                fact_start TEXT,
                fact_end TEXT,
                progress INTEGER NOT NULL DEFAULT 0,
                responsible TEXT,
                depends_on_materials INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
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
                is_client_visible INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
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
                is_client_visible INTEGER NOT NULL DEFAULT 1,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
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

        ensure_columns(
            con,
            "projects",
            {
                "contract_no": "TEXT",
                "director_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "foreman_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "buyer_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "client_user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "budget": "REAL NOT NULL DEFAULT 0",
                "paid": "REAL NOT NULL DEFAULT 0",
                "spent": "REAL NOT NULL DEFAULT 0",
            },
        )

        user_count = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if user_count == 0:
            bootstrap_password = os.environ.get("PMBI_ADMIN_PASSWORD") or secrets.token_urlsafe(18)
            con.execute(
                """
                INSERT INTO users (login, password_hash, role, name, created_at)
                VALUES (?, ?, 'director', 'Главный администратор', ?)
                """,
                ("admin", hash_password(bootstrap_password), now_ts()),
            )
            con.commit()
            BOOTSTRAP_PATH.write_text(
                "PM.bi initial admin\n"
                "login: admin\n"
                f"password: {bootstrap_password}\n\n"
                "Delete this file after creating your real users.\n",
                encoding="utf-8",
            )

        project_count = con.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        if project_count == 0:
            cur = con.execute(
                """
                INSERT INTO projects (title, address, client_name, status, progress, budget, paid, spent, started_at, deadline_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "ЖК Северный — монтаж инженерных сетей",
                    "Екатеринбург, ул. Строителей, 18",
                    "ООО Северный Заказчик",
                    "В работе",
                    64,
                    8_500_000,
                    5_100_000,
                    3_640_000,
                    "2026-07-01",
                    "2026-10-20",
                    now_ts(),
                ),
            )
            project_id = cur.lastrowid
            items = [
                ("Труба ПНД 110", "м", 1000, 420),
                ("Фитинги комплект", "шт", 120, 280),
                ("Кабель ВВГнг 3x2.5", "м", 650, 95),
            ]
            for title, unit, qty, price in items:
                item_cur = con.execute(
                    """
                    INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (project_id, title, unit, qty, price),
                )
                item_id = item_cur.lastrowid
                if title.startswith("Труба"):
                    con.executemany(
                        """
                        INSERT INTO stock_moves (project_id, estimate_item_id, move_type, qty, price, comment, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        [
                            (project_id, item_id, "purchase", 800, 390, "Закуплено по заявке", now_ts()),
                            (project_id, item_id, "receipt", 800, 390, "Поступило на объект", now_ts()),
                            (project_id, item_id, "use", 700, 390, "Списано в монтаж", now_ts()),
                        ],
                    )
            con.commit()

        seed_crm_data(con)


def first_project_id(con: sqlite3.Connection) -> int | None:
    row = con.execute("SELECT id FROM projects ORDER BY id LIMIT 1").fetchone()
    return int(row["id"]) if row else None


def seed_crm_data(con: sqlite3.Connection) -> None:
    project_id = first_project_id(con)
    if not project_id:
        return

    con.execute(
        """
        UPDATE projects
        SET budget = CASE WHEN budget = 0 THEN 8500000 ELSE budget END,
            paid = CASE WHEN paid = 0 THEN 5100000 ELSE paid END,
            spent = CASE WHEN spent = 0 THEN 3640000 ELSE spent END,
            contract_no = COALESCE(contract_no, 'PM-2026-071')
        WHERE id = ?
        """,
        (project_id,),
    )

    if con.execute("SELECT COUNT(*) FROM work_stages WHERE project_id = ?", (project_id,)).fetchone()[0] == 0:
        stages = [
            ("Подготовка", 1, "2026-07-01", "2026-07-05", 100, "Директор", 0),
            ("Закупка материалов", 2, "2026-07-03", "2026-07-20", 80, "Закупщик", 1),
            ("Монтаж инженерных сетей", 3, "2026-07-12", "2026-08-25", 64, "Прораб", 1),
            ("Проверка и исполнительная документация", 4, "2026-08-20", "2026-09-10", 20, "Прораб", 0),
            ("Сдача объекта и акты", 5, "2026-09-10", "2026-10-20", 0, "Директор", 0),
        ]
        con.executemany(
            """
            INSERT INTO work_stages (project_id, title, position, planned_start, planned_end, progress, responsible, depends_on_materials, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *stage, now_ts()) for stage in stages],
        )

    if con.execute("SELECT COUNT(*) FROM tasks WHERE project_id = ?", (project_id,)).fetchone()[0] == 0:
        tasks = [
            ("Докупить трубу ПНД 110 — 200 м", "Не хватает до сметы. Критично для монтажа инженерных сетей.", "open", "high", "2026-07-25"),
            ("Подготовить фотоотчёт заказчику", "Показать текущий этап работ без внутренней финансовой информации.", "open", "normal", "2026-07-23"),
            ("Сверить списание материалов с прорабом", "Списано 700 м труб, остаток на объекте 100 м.", "in_progress", "normal", "2026-07-24"),
        ]
        con.executemany(
            """
            INSERT INTO tasks (project_id, title, description, status, priority, due_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *task, now_ts()) for task in tasks],
        )

    if con.execute("SELECT COUNT(*) FROM documents WHERE project_id = ?", (project_id,)).fetchone()[0] == 0:
        docs = [
            ("Договор подряда PM-2026-071", "contract", "signed", 1),
            ("Акт выполненных работ — этап инженерных сетей", "act", "draft", 0),
            ("Фотоотчёт для заказчика", "photo_report", "ready", 1),
            ("Внутренняя финансовая сводка", "finance", "internal", 0),
        ]
        con.executemany(
            """
            INSERT INTO documents (project_id, title, doc_type, status, is_client_visible, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *doc, now_ts()) for doc in docs],
        )

    if con.execute("SELECT COUNT(*) FROM daily_logs WHERE project_id = ?", (project_id,)).fetchone()[0] == 0:
        logs = [
            (
                "2026-07-20",
                "Монтаж инженерных сетей — смена 1",
                "Смонтировали магистральные участки трубопровода, подготовили трассы под кабельные линии, приняли часть крепежа на объект.",
                7,
                "Перфораторы, лазерный уровень, стремянки",
                "Нужна дозакупка трубы ПНД 110, чтобы не остановить следующий участок.",
                "Закрыть нехватку материалов и продолжить монтаж по секции Б.",
                1,
            ),
            (
                "2026-07-21",
                "Проверка трасс и списание материалов",
                "Проверили проложенные трассы, списали фактически использованные материалы, подготовили фотоотчёт для заказчика.",
                5,
                "Измерительный инструмент, шуруповёрты",
                "Часть фитингов нужно привезти до конца недели.",
                "Сверить склад с закупщиком и обновить график работ.",
                0,
            ),
        ]
        con.executemany(
            """
            INSERT INTO daily_logs (project_id, report_date, title, work_done, workers_count, equipment, blockers, next_steps, is_client_visible, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(project_id, *log, now_ts()) for log in logs],
        )

    if con.execute("SELECT COUNT(*) FROM chats WHERE project_id = ?", (project_id,)).fetchone()[0] == 0:
        team_cur = con.execute(
            "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'team', 'Внутренний чат команды', ?)",
            (project_id, now_ts()),
        )
        client_cur = con.execute(
            "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'client', 'Чат с заказчиком', ?)",
            (project_id, now_ts()),
        )
        con.executemany(
            """
            INSERT INTO chat_messages (chat_id, body, created_at)
            VALUES (?, ?, ?)
            """,
            [
                (team_cur.lastrowid, "По трубам остаток 100 м, до сметы не хватает 200 м. Нужна закупка.", now_ts()),
                (team_cur.lastrowid, "Если не привезти материал до пятницы, будет простой по инженерным сетям.", now_ts()),
                (client_cur.lastrowid, "Работы идут по графику. Подготовим фотоотчёт по текущему этапу.", now_ts()),
            ],
        )

    con.commit()


def user_payload(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "login": row["login"],
        "role": row["role"],
        "roleLabel": ROLE_LABELS.get(row["role"], row["role"]),
        "name": row["name"],
    }


def role_can_open(role: str, path: str) -> bool:
    if path in PUBLIC_STATIC_PATHS:
        return True
    allowed = ROLE_ALLOWED_PREFIXES.get(role, [])
    if "*" in allowed:
        return True
    return any(path == prefix or (prefix.endswith("/") and path.startswith(prefix)) for prefix in allowed)


def serialize_project(row: sqlite3.Row, user: dict) -> dict:
    data = dict(row)
    role = user["role"]
    if role == "client":
        for key in ["budget", "paid", "spent", "director_id", "foreman_id", "buyer_id", "client_user_id"]:
            data.pop(key, None)
    elif role == "buyer":
        for key in ["paid", "spent"]:
            data.pop(key, None)
    elif role == "foreman":
        data.pop("paid", None)
    return data


def material_summary_rows(con: sqlite3.Connection, project_id: int) -> list[dict]:
    rows = con.execute(
        """
        SELECT
            e.id,
            e.title,
            e.unit,
            e.planned_qty,
            COALESCE(SUM(CASE WHEN s.move_type = 'purchase' THEN s.qty ELSE 0 END), 0) AS purchased_qty,
            COALESCE(SUM(CASE WHEN s.move_type = 'receipt' THEN s.qty ELSE 0 END), 0) AS received_qty,
            COALESCE(SUM(CASE WHEN s.move_type = 'use' THEN s.qty ELSE 0 END), 0) AS used_qty
        FROM estimate_items e
        LEFT JOIN stock_moves s ON s.estimate_item_id = e.id
        WHERE e.project_id = ?
        GROUP BY e.id
        ORDER BY e.id
        """,
        (project_id,),
    ).fetchall()
    items = []
    for row in rows:
        planned = float(row["planned_qty"])
        purchased = float(row["purchased_qty"])
        received = float(row["received_qty"])
        used = float(row["used_qty"])
        covered = max(purchased, received)
        stock_base = received if received else purchased
        stock = max(stock_base - used, 0)
        missing = max(planned - covered, 0)
        usage_progress = round(min(100, used / planned * 100), 1) if planned else 0
        purchase_progress = round(min(100, covered / planned * 100), 1) if planned else 0
        items.append(
            {
                "id": row["id"],
                "title": row["title"],
                "unit": row["unit"],
                "plannedQty": planned,
                "purchasedQty": purchased,
                "receivedQty": received,
                "usedQty": used,
                "stockQty": stock,
                "missingQty": missing,
                "usageProgress": usage_progress,
                "purchaseProgress": purchase_progress,
            }
        )
    return items


class PMBIHandler(BaseHTTPRequestHandler):
    server_version = "PMBIBackend/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))

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

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def session_token(self) -> str | None:
        cookie_header = self.headers.get("Cookie")
        if not cookie_header:
            return None
        cookie = SimpleCookie(cookie_header)
        morsel = cookie.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def current_user(self) -> dict | None:
        token = self.session_token()
        if not token:
            return None
        with db() as con:
            row = con.execute(
                """
                SELECT u.*
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1
                """,
                (token_hash(token), now_ts()),
            ).fetchone()
            if not row:
                return None
            return user_payload(row)

    def require_user(self) -> dict | None:
        user = self.current_user()
        if not user:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "auth_required"})
            return None
        return user

    def require_role(self, roles: set[str]) -> dict | None:
        user = self.require_user()
        if not user:
            return None
        if user["role"] not in roles:
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return None
        return user

    def set_session_cookie(self, token: str) -> None:
        self.send_header(
            "Set-Cookie",
            f"{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax",
        )

    def clear_session_cookie(self) -> None:
        self.send_header(
            "Set-Cookie",
            f"{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
        )

    def handle_api(self, method: str, path: str) -> None:
        try:
            if method == "POST" and path == "/api/auth/login":
                self.api_login()
            elif method == "POST" and path == "/api/auth/logout":
                self.api_logout()
            elif method == "GET" and path == "/api/auth/me":
                self.api_me()
            elif method == "POST" and path == "/api/admin/users":
                self.api_create_user()
            elif method == "GET" and path == "/api/admin/users":
                self.api_users()
            elif method == "GET" and path == "/api/projects":
                self.api_projects()
            elif method == "POST" and path == "/api/projects":
                self.api_create_project()
            elif method == "GET" and path == "/api/dashboard":
                self.api_dashboard()
            elif method == "GET" and path.startswith("/api/projects/") and path.count("/") == 3:
                self.api_project_detail(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/materials-summary"):
                self.api_materials_summary(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/materials"):
                self.api_create_material(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/estimate-import"):
                self.api_import_estimate(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/analysis"):
                self.api_project_analysis(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/stages"):
                self.api_project_stages(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/tasks"):
                self.api_project_tasks(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/tasks"):
                self.api_create_task(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/documents"):
                self.api_project_documents(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/daily-logs"):
                self.api_project_daily_logs(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/daily-logs"):
                self.api_create_daily_log(path)
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
        payload = self.read_json()
        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", ""))
        with db() as con:
            row = con.execute(
                "SELECT * FROM users WHERE login = ? AND is_active = 1",
                (login,),
            ).fetchone()
            if not row or not verify_password(password, row["password_hash"]):
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "bad_credentials"})
                return

            token = secrets.token_urlsafe(32)
            con.execute(
                """
                INSERT INTO sessions (user_id, token_hash, created_at, expires_at, user_agent, ip)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    token_hash(token),
                    now_ts(),
                    now_ts() + SESSION_TTL_SECONDS,
                    self.headers.get("User-Agent", ""),
                    self.client_address[0],
                ),
            )
            con.execute(
                "INSERT INTO audit_log (user_id, action, entity, created_at) VALUES (?, 'login', 'user', ?)",
                (row["id"], now_ts()),
            )
            con.commit()

        body = json.dumps({"user": user_payload(row)}, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.set_session_cookie(token)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def api_logout(self) -> None:
        token = self.session_token()
        if token:
            with db() as con:
                con.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))
                con.commit()
        body = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.clear_session_cookie()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def api_me(self) -> None:
        user = self.current_user()
        if not user:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "auth_required"})
            return
        self.send_json(HTTPStatus.OK, {"user": user})

    def api_create_user(self) -> None:
        admin = self.require_role({"director"})
        if not admin:
            return
        payload = self.read_json()
        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", ""))
        role = str(payload.get("role", "")).strip()
        name = str(payload.get("name", "")).strip() or login
        if not login or len(password) < 10 or role not in ROLE_LABELS:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_user_data"})
            return
        with db() as con:
            try:
                cur = con.execute(
                    """
                    INSERT INTO users (login, password_hash, role, name, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (login, hash_password(password), role, name, now_ts()),
                )
            except sqlite3.IntegrityError:
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_user', 'user', ?, ?, ?)
                """,
                (admin["id"], cur.lastrowid, json.dumps({"login": login, "role": role}, ensure_ascii=False), now_ts()),
            )
            con.commit()
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid, "login": login, "role": role, "name": name})

    def api_users(self) -> None:
        admin = self.require_role({"director"})
        if not admin:
            return
        with db() as con:
            rows = con.execute(
                """
                SELECT id, login, role, name, is_active, created_at
                FROM users
                ORDER BY id
                """
            ).fetchall()
        self.send_json(
            HTTPStatus.OK,
            {
                "users": [
                    {
                        "id": row["id"],
                        "login": row["login"],
                        "role": row["role"],
                        "roleLabel": ROLE_LABELS.get(row["role"], row["role"]),
                        "name": row["name"],
                        "isActive": bool(row["is_active"]),
                        "createdAt": row["created_at"],
                    }
                    for row in rows
                ]
            },
        )

    def api_projects(self) -> None:
        user = self.require_user()
        if not user:
            return
        with db() as con:
            if user["role"] == "director":
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
                if not rows and user["role"] in {"foreman", "buyer"}:
                    rows = con.execute("SELECT * FROM projects ORDER BY id DESC LIMIT 20").fetchall()
            projects = [serialize_project(row, user) for row in rows]
        self.send_json(HTTPStatus.OK, {"projects": projects})

    def api_create_project(self) -> None:
        user = self.require_user()
        if not user:
            return
        if user["role"] != "director":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        address = str(payload.get("address", "")).strip()
        client_name = str(payload.get("client_name", payload.get("clientName", ""))).strip()
        if not title or not address or not client_name:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_address_client_required"})
            return
        budget = float(payload.get("budget", 0) or 0)
        started_at = str(payload.get("started_at", payload.get("startedAt", ""))).strip() or None
        deadline_at = str(payload.get("deadline_at", payload.get("deadlineAt", ""))).strip() or None
        with db() as con:
            cur = con.execute(
                """
                INSERT INTO projects (title, address, client_name, contract_no, director_id, status, progress, budget, paid, spent, started_at, deadline_at, created_at)
                VALUES (?, ?, ?, ?, ?, 'Подготовка', 0, ?, 0, 0, ?, ?, ?)
                """,
                (
                    title,
                    address,
                    client_name,
                    str(payload.get("contract_no", payload.get("contractNo", ""))).strip() or None,
                    user["id"] if user["role"] == "director" else None,
                    budget,
                    started_at,
                    deadline_at,
                    now_ts(),
                ),
            )
            project_id = cur.lastrowid
            default_stages = [
                ("Подготовка", 1, started_at, None, 0, "Директор", 0),
                ("Закупка материалов", 2, started_at, None, 0, "Закупщик", 1),
                ("Основные работы", 3, None, deadline_at, 0, "Прораб", 1),
                ("Исполнительная документация", 4, None, deadline_at, 0, "Прораб", 0),
                ("Сдача объекта", 5, None, deadline_at, 0, "Директор", 0),
            ]
            con.executemany(
                """
                INSERT INTO work_stages (project_id, title, position, planned_start, planned_end, progress, responsible, depends_on_materials, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [(project_id, *stage, now_ts()) for stage in default_stages],
            )
            con.execute(
                "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'team', 'Внутренний чат команды', ?)",
                (project_id, now_ts()),
            )
            con.execute(
                "INSERT INTO chats (project_id, chat_type, title, created_at) VALUES (?, 'client', 'Чат с заказчиком', ?)",
                (project_id, now_ts()),
            )
            con.execute(
                """
                INSERT INTO documents (project_id, title, doc_type, status, is_client_visible, created_at)
                VALUES (?, 'Договор подряда', 'contract', 'draft', 0, ?)
                """,
                (project_id, now_ts()),
            )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_project', 'project', ?, ?, ?)
                """,
                (user["id"], project_id, json.dumps({"title": title}, ensure_ascii=False), now_ts()),
            )
            con.commit()
            row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        self.send_json(HTTPStatus.CREATED, {"project": serialize_project(row, user)})

    def api_dashboard(self) -> None:
        user = self.require_user()
        if not user:
            return
        with db() as con:
            if user["role"] == "director":
                projects = con.execute("SELECT * FROM projects").fetchall()
            else:
                projects = con.execute(
                    """
                    SELECT p.*
                    FROM projects p
                    LEFT JOIN user_project_access a ON a.project_id = p.id
                    WHERE a.user_id = ? OR ? IN ('foreman','buyer')
                    GROUP BY p.id
                    """,
                    (user["id"], user["role"]),
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
                        shortages += 1
                        critical_items.append({
                            "projectId": project["id"],
                            "projectTitle": project["title"],
                            "title": item["title"],
                            "missingQty": item["missingQty"],
                            "unit": item["unit"],
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
                    {"" if user["role"] != "client" else "AND d.is_client_visible = 1"}
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
                    {"" if user["role"] != "client" else "AND l.is_client_visible = 1"}
                    ORDER BY l.report_date DESC, l.id DESC
                    LIMIT 6
                    """,
                    project_ids,
                ).fetchall()
                if user["role"] == "client":
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
            if critical_items and user["role"] != "client":
                first = critical_items[0]
                today_actions.append(f"Закрыть нехватку: {first['title']} — нужно ещё {first['missingQty']} {first['unit']}.")
            if open_tasks:
                today_actions.append(f"Разобрать открытые задачи: {open_tasks} шт. по активным объектам.")
            if user["role"] == "director" and total_paid - total_spent < 0:
                today_actions.append("Проверить кассовый разрыв: расходы сейчас выше оплат.")
            if user["role"] == "buyer":
                today_actions.append("Обновить поступления и списания на складе, чтобы смета показывала реальные остатки.")
            if user["role"] == "client":
                today_actions.append("Проверить график работ, видимые документы и сообщения команды по объекту.")
            if not today_actions:
                today_actions.append("Критических блокеров нет — держим график и фиксируем факт каждый день.")
        data = {
            "projectsCount": len(projects),
            "activeProjects": active,
            "avgProgress": round(sum(float(row["progress"] or 0) for row in projects) / len(projects), 1) if projects else 0,
            "shortagesCount": 0 if user["role"] == "client" else shortages,
            "openTasksCount": open_tasks,
            "criticalItems": [] if user["role"] == "client" else critical_items[:10],
            "todayActions": today_actions[:6],
            "recentActivity": recent_activity,
            "projects": [serialize_project(row, user) for row in projects[:6]],
        }
        if user["role"] == "director":
            data.update({
                "totalBudget": total_budget,
                "totalPaid": total_paid,
                "totalSpent": total_spent,
                "profitNow": total_paid - total_spent,
            })
        self.send_json(HTTPStatus.OK, data)

    def parse_project_id(self, path: str) -> int | None:
        parts = path.strip("/").split("/")
        try:
            return int(parts[2])
        except (IndexError, ValueError):
            return None

    def parse_chat_id(self, path: str) -> int | None:
        parts = path.strip("/").split("/")
        try:
            return int(parts[2])
        except (IndexError, ValueError):
            return None

    def can_access_project(self, user: dict, project_id: int) -> bool:
        if user["role"] == "director":
            return True
        with db() as con:
            row = con.execute(
                "SELECT 1 FROM user_project_access WHERE user_id = ? AND project_id = ?",
                (user["id"], project_id),
            ).fetchone()
        if row:
            return True
        return user["role"] in {"foreman", "buyer"}

    def require_project_access(self, project_id: int) -> dict | None:
        user = self.require_user()
        if not user:
            return None
        if not self.can_access_project(user, project_id):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "project_forbidden"})
            return None
        return user

    def api_project_detail(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        self.send_json(HTTPStatus.OK, {"project": serialize_project(row, user)})

    def api_materials_summary(self, path: str) -> None:
        project_id = self.parse_project_id(path)
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
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] != "director":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        unit = str(payload.get("unit", "")).strip() or "шт"
        planned_qty = float(payload.get("planned_qty", payload.get("plannedQty", 0)) or 0)
        planned_price = float(payload.get("planned_price", payload.get("plannedPrice", 0)) or 0)
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
                INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price)
                VALUES (?, ?, ?, ?, ?)
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

    def api_import_estimate(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] != "director":
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
            planned_qty = float(item.get("planned_qty", item.get("plannedQty", 0)) or 0)
            planned_price = float(item.get("planned_price", item.get("plannedPrice", 0)) or 0)
            if not title or planned_qty <= 0:
                continue
            normalized.append((project_id, title, unit, planned_qty, planned_price))

        if not normalized:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "no_valid_items"})
            return

        with db() as con:
            if replace:
                con.execute("DELETE FROM estimate_items WHERE project_id = ?", (project_id,))
            imported = 0
            for normalized_item in normalized:
                _, title, unit, planned_qty, planned_price = normalized_item
                existing = con.execute(
                    "SELECT id FROM estimate_items WHERE project_id = ? AND lower(title) = lower(?) AND unit = ?",
                    (project_id, title, unit),
                ).fetchone()
                if existing:
                    con.execute(
                        """
                        UPDATE estimate_items
                        SET planned_qty = ?, planned_price = ?
                        WHERE id = ?
                        """,
                        (planned_qty, planned_price, existing["id"]),
                    )
                else:
                    con.execute(
                        """
                        INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price)
                        VALUES (?, ?, ?, ?, ?)
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
        project_id = self.parse_project_id(path)
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
        if user["role"] == "client":
            payload["risks"] = [risk for risk in risks if risk["level"] != "critical"][:2]
            payload["actions"] = ["Команда ведёт контроль материалов и графика. Критичные внутренние действия скрыты."]
        self.send_json(HTTPStatus.OK, payload)

    def api_project_stages(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            rows = con.execute(
                "SELECT * FROM work_stages WHERE project_id = ? ORDER BY position, id",
                (project_id,),
            ).fetchall()
        self.send_json(HTTPStatus.OK, {"stages": [dict(row) for row in rows]})

    def api_project_tasks(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] == "client":
            self.send_json(HTTPStatus.OK, {"tasks": []})
            return
        with db() as con:
            rows = con.execute(
                """
                SELECT t.*, u.name AS assignee_name
                FROM tasks t
                LEFT JOIN users u ON u.id = t.assignee_id
                WHERE t.project_id = ?
                ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, t.id DESC
                """,
                (project_id,),
            ).fetchall()
        self.send_json(HTTPStatus.OK, {"tasks": [dict(row) for row in rows]})

    def api_create_task(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] != "director":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        if not title:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_required"})
            return
        with db() as con:
            cur = con.execute(
                """
                INSERT INTO tasks (project_id, title, description, status, priority, due_at, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    title,
                    str(payload.get("description", "")).strip(),
                    str(payload.get("status", "open")).strip() or "open",
                    str(payload.get("priority", "normal")).strip() or "normal",
                    str(payload.get("due_at", "")).strip() or None,
                    user["id"],
                    now_ts(),
                ),
            )
            con.commit()
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})

    def api_project_documents(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            if user["role"] == "client":
                rows = con.execute(
                    "SELECT * FROM documents WHERE project_id = ? AND is_client_visible = 1 ORDER BY id DESC",
                    (project_id,),
                ).fetchall()
            else:
                rows = con.execute(
                    "SELECT * FROM documents WHERE project_id = ? ORDER BY id DESC",
                    (project_id,),
                ).fetchall()
        self.send_json(HTTPStatus.OK, {"documents": [dict(row) for row in rows]})

    def api_project_daily_logs(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            if user["role"] == "client":
                rows = con.execute(
                    """
                    SELECT l.*, u.name AS author_name
                    FROM daily_logs l
                    LEFT JOIN users u ON u.id = l.created_by
                    WHERE l.project_id = ? AND l.is_client_visible = 1
                    ORDER BY l.report_date DESC, l.id DESC
                    """,
                    (project_id,),
                ).fetchall()
            else:
                rows = con.execute(
                    """
                    SELECT l.*, u.name AS author_name
                    FROM daily_logs l
                    LEFT JOIN users u ON u.id = l.created_by
                    WHERE l.project_id = ?
                    ORDER BY l.report_date DESC, l.id DESC
                    """,
                    (project_id,),
                ).fetchall()
        self.send_json(HTTPStatus.OK, {"logs": [dict(row) for row in rows]})

    def api_create_daily_log(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] in {"client", "buyer"}:
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        work_done = str(payload.get("work_done", "")).strip()
        if not title or not work_done:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_and_work_required"})
            return
        report_date = str(payload.get("report_date", "")).strip() or time.strftime("%Y-%m-%d")
        try:
            workers_count = max(0, int(payload.get("workers_count", 0) or 0))
        except (TypeError, ValueError):
            workers_count = 0
        with db() as con:
            cur = con.execute(
                """
                INSERT INTO daily_logs (project_id, report_date, title, work_done, workers_count, equipment, blockers, next_steps, is_client_visible, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    report_date,
                    title,
                    work_done,
                    workers_count,
                    str(payload.get("equipment", "")).strip(),
                    str(payload.get("blockers", "")).strip(),
                    str(payload.get("next_steps", "")).strip(),
                    1 if payload.get("is_client_visible", True) else 0,
                    user["id"],
                    now_ts(),
                ),
            )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_daily_log', 'daily_log', ?, ?, ?)
                """,
                (user["id"], cur.lastrowid, json.dumps({"project_id": project_id, "title": title}, ensure_ascii=False), now_ts()),
            )
            con.commit()
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})

    def api_project_chats(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            if user["role"] == "client":
                rows = con.execute(
                    "SELECT * FROM chats WHERE project_id = ? AND chat_type = 'client' ORDER BY id",
                    (project_id,),
                ).fetchall()
            else:
                rows = con.execute(
                    "SELECT * FROM chats WHERE project_id = ? ORDER BY CASE chat_type WHEN 'team' THEN 0 ELSE 1 END, id",
                    (project_id,),
                ).fetchall()
        self.send_json(HTTPStatus.OK, {"chats": [dict(row) for row in rows]})

    def can_access_chat(self, user: dict, chat_id: int) -> bool:
        with db() as con:
            row = con.execute(
                """
                SELECT c.project_id, c.chat_type
                FROM chats c
                WHERE c.id = ?
                """,
                (chat_id,),
            ).fetchone()
        if not row:
            return False
        if not self.can_access_project(user, int(row["project_id"])):
            return False
        return not (user["role"] == "client" and row["chat_type"] != "client")

    def api_chat_messages(self, path: str) -> None:
        chat_id = self.parse_chat_id(path)
        if not chat_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_chat_id"})
            return
        user = self.require_user()
        if not user:
            return
        if not self.can_access_chat(user, chat_id):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "chat_forbidden"})
            return
        with db() as con:
            rows = con.execute(
                """
                SELECT m.*, COALESCE(u.name, 'Система') AS author_name, COALESCE(u.role, 'system') AS author_role
                FROM chat_messages m
                LEFT JOIN users u ON u.id = m.user_id
                WHERE m.chat_id = ?
                ORDER BY m.id
                """,
                (chat_id,),
            ).fetchall()
        self.send_json(HTTPStatus.OK, {"messages": [dict(row) for row in rows]})

    def api_create_chat_message(self, path: str) -> None:
        chat_id = self.parse_chat_id(path)
        if not chat_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_chat_id"})
            return
        user = self.require_user()
        if not user:
            return
        if not self.can_access_chat(user, chat_id):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "chat_forbidden"})
            return
        payload = self.read_json()
        body = str(payload.get("body", "")).strip()
        if not body:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "body_required"})
            return
        with db() as con:
            cur = con.execute(
                "INSERT INTO chat_messages (chat_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
                (chat_id, user["id"], body, now_ts()),
            )
            con.commit()
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})

    def api_create_stock_move(self, path: str) -> None:
        project_id = self.parse_project_id(path)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] == "client":
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

    def strip_role_content(self, content: str, user: dict) -> str:
        if user["role"] != "director":
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
            self.send_html(self.render_template("login.html", {}))
            return

        user = self.current_user()
        if not user:
            self.redirect(f"{LOGIN_PATH}?next={urllib.parse.quote(path, safe='/')}")
            return
        if not role_can_open(user["role"], path):
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
        body = self.render_template(
            "base.html",
            {
                "title": title,
                "page": page_name,
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

        if user and is_page_request and not role_can_open(user["role"], path):
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


if __name__ == "__main__":
    main()
