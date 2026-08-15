from __future__ import annotations

import json
import sqlite3
import time
from http import HTTPStatus
from pathlib import Path

from auth import ROLE_LABELS, display_user_name, normalize_role, user_has_any_role, user_is_hidden_admin, user_is_main_admin


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "pmbi.sqlite3"


def now_ts() -> int:
    return int(time.time())


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def table_exists(con: sqlite3.Connection, table: str) -> bool:
    row = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def delete_project_rows(con: sqlite3.Connection, table: str, column: str, project_id: int) -> None:
    if not table_exists(con, table):
        return
    con.execute(f"DELETE FROM {table} WHERE {column} = ?", (project_id,))


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


def parse_path_int(path: str, index: int) -> int | None:
    parts = path.strip("/").split("/")
    try:
        return int(parts[index])
    except (IndexError, TypeError, ValueError):
        return None


def normalize_project_description(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    compact = text.lower()
    if compact.startswith("импортировано из auto_bot по отдельной смете."):
        return None
    return text


def serialize_project(row: sqlite3.Row, user: dict) -> dict:
    data = dict(row)
    data["description"] = normalize_project_description(data.get("description"))
    role = user["role"]
    if role == "customer":
        for key in ["budget", "paid", "spent", "director_id", "foreman_id", "buyer_id", "client_user_id"]:
            data.pop(key, None)
    elif role == "purchaser":
        for key in ["paid", "spent"]:
            data.pop(key, None)
    elif role == "foreman":
        data.pop("paid", None)
    try:
        with db() as con:
            assigned_rows = con.execute(
                """
                SELECT user_id
                FROM object_assignments
                WHERE object_id = ? AND role_code = 'foreman'
                ORDER BY is_primary DESC, assigned_at DESC, id DESC
                """,
                (row["id"],),
            ).fetchall()
            data["assigned_foremen"] = [assigned_row["user_id"] for assigned_row in assigned_rows]
    except sqlite3.Error:
        data["assigned_foremen"] = []
    data["scheduleControl"] = project_schedule_payload(row)
    return data


def project_schedule_payload(row: sqlite3.Row | dict) -> dict:
    getter = row.__getitem__ if isinstance(row, sqlite3.Row) else row.get
    return {
        "internal": {
            "status": str(getter("internal_schedule_status") or "draft"),
            "version": int(getter("internal_schedule_version") or 1),
            "approvedAt": getter("internal_schedule_approved_at"),
        },
        "customer": {
            "status": str(getter("customer_schedule_status") or "draft"),
            "version": int(getter("customer_schedule_version") or 1),
            "approvedAt": getter("customer_schedule_approved_at"),
        },
        "generatedAt": getter("schedule_generated_at"),
    }


def set_project_foremen(
    con: sqlite3.Connection,
    project_id: int,
    foreman_ids: list[int],
    assigned_by: int,
) -> list[int]:
    project = con.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        raise ValueError("project_not_found")
    cleaned_ids = list(dict.fromkeys(int(item) for item in foreman_ids if int(item) > 0))
    if cleaned_ids:
        placeholders = ",".join("?" for _ in cleaned_ids)
        rows = con.execute(
            f"""
            SELECT DISTINCT u.id
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            WHERE u.id IN ({placeholders})
              AND u.is_active = 1
              AND (u.role = 'foreman' OR r.code = 'foreman')
            ORDER BY u.id
            """,
            cleaned_ids,
        ).fetchall()
        valid_ids = [int(row["id"]) for row in rows]
        if len(valid_ids) != len(cleaned_ids):
            raise ValueError("foreman_not_found")
    else:
        valid_ids = []

    previous_rows = con.execute(
        "SELECT user_id FROM object_assignments WHERE object_id = ? AND role_code = 'foreman'",
        (project_id,),
    ).fetchall()
    previous_ids = [int(row["user_id"]) for row in previous_rows]
    con.execute(
        "DELETE FROM object_assignments WHERE object_id = ? AND role_code = 'foreman'",
        (project_id,),
    )
    for foreman_id in valid_ids:
        con.execute(
            """
            INSERT OR IGNORE INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
            VALUES (?, ?, 'foreman', 'РџСЂРѕСЂР°Р± РѕР±СЉРµРєС‚Р°', ?, ?, ?)
            """,
            (project_id, foreman_id, 1 if foreman_id == valid_ids[0] else 0, assigned_by, now_ts()),
        )
        con.execute(
            "INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)",
            (foreman_id, project_id),
        )
    for foreman_id in previous_ids:
        if foreman_id in valid_ids:
            continue
        has_other_assignment = con.execute(
            "SELECT 1 FROM object_assignments WHERE object_id = ? AND user_id = ? LIMIT 1",
            (project_id, foreman_id),
        ).fetchone()
        if not has_other_assignment:
            con.execute(
                "DELETE FROM user_project_access WHERE user_id = ? AND project_id = ?",
                (foreman_id, project_id),
            )
    con.execute(
        "UPDATE projects SET foreman_id = ?, updated_at = ? WHERE id = ?",
        (valid_ids[0] if valid_ids else None, now_ts(), project_id),
    )
    return valid_ids


def api_projects(handler) -> None:
    user = handler.require_user()
    if not user:
        return
    with db() as con:
        if user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"}):
            rows = con.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
        elif user_has_any_role(user, {"foreman"}):
            rows = con.execute(
                """
                SELECT DISTINCT p.*
                FROM projects p
                LEFT JOIN object_assignments own_oa
                    ON own_oa.object_id = p.id
                    AND own_oa.user_id = ?
                    AND own_oa.role_code = 'foreman'
                WHERE own_oa.id IS NOT NULL
                   OR NOT EXISTS (
                        SELECT 1
                        FROM object_assignments foreman_oa
                        WHERE foreman_oa.object_id = p.id
                          AND foreman_oa.role_code = 'foreman'
                   )
                ORDER BY p.id DESC
                """,
                (user["id"],),
            ).fetchall()
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
        projects = [serialize_project(row, user) for row in rows]
    handler.send_json(HTTPStatus.OK, {"projects": projects})


def api_create_project(handler) -> None:
    user = handler.require_user()
    if not user:
        return
    if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"})):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    title = str(payload.get("title", "")).strip()
    address = str(payload.get("address", "")).strip()
    client_name = str(payload.get("client_name", payload.get("clientName", ""))).strip()
    customer_company_id = payload.get("customer_company_id", payload.get("customerCompanyId"))
    own_legal_entity_id = payload.get("own_legal_entity_id", payload.get("ownLegalEntityId"))
    try:
        customer_company_id = int(customer_company_id) if customer_company_id else None
        own_legal_entity_id = int(own_legal_entity_id) if own_legal_entity_id else None
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_company_id"})
        return
    if not title or not address:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_address_client_required"})
        return
    budget = float(payload.get("budget", 0) or 0)
    started_at = str(payload.get("started_at", payload.get("startedAt", ""))).strip() or None
    deadline_at = str(payload.get("deadline_at", payload.get("deadlineAt", ""))).strip() or None
    city = str(payload.get("city", "")).strip() or None
    region = str(payload.get("region", "")).strip() or None
    contract_date = str(payload.get("contract_date", payload.get("contractDate", ""))).strip() or None
    description = str(payload.get("description", "")).strip() or None
    with db() as con:
        customer_company = None
        own_company = None
        if customer_company_id:
            customer_company = con.execute(
                "SELECT id, name FROM companies WHERE id = ? AND type IN ('client','other')",
                (customer_company_id,),
            ).fetchone()
            if not customer_company:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "customer_company_not_found"})
                return
            if not client_name:
                client_name = customer_company["name"]
        if own_legal_entity_id:
            own_company = con.execute(
                "SELECT id FROM companies WHERE id = ? AND type = 'own_legal_entity'",
                (own_legal_entity_id,),
            ).fetchone()
            if not own_company:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "own_legal_entity_not_found"})
                return
        if not client_name:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_address_client_required"})
            return
        client_id = None
        if customer_company_id:
            client_row = con.execute("SELECT id FROM clients WHERE company_id = ?", (customer_company_id,)).fetchone()
            if client_row:
                client_id = client_row["id"]
            else:
                client_cur = con.execute(
                    "INSERT INTO clients (company_id, name) VALUES (?, ?)",
                    (customer_company_id, client_name),
                )
                client_id = client_cur.lastrowid
        cur = con.execute(
            """
            INSERT INTO projects (
                title, client_id, customer_company_id, own_legal_entity_id,
                address, city, region, client_name, contract_no, contract_date,
                director_id, status, progress, budget, paid, spent,
                started_at, deadline_at, description, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Подготовка', 0, ?, 0, 0, ?, ?, ?, ?, ?)
            """,
            (
                title,
                client_id,
                customer_company_id,
                own_legal_entity_id,
                address,
                city,
                region,
                client_name,
                str(payload.get("contract_no", payload.get("contractNo", ""))).strip() or None,
                contract_date,
                user["id"] if user_has_any_role(user, {"director"}) else None,
                budget,
                started_at,
                deadline_at,
                description,
                now_ts(),
                now_ts(),
            ),
        )
        project_id = cur.lastrowid
        con.execute(
            """
            INSERT OR IGNORE INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (project_id, user["id"], user["role"], "Создатель объекта и руководитель запуска", user["id"], now_ts()),
        )
        con.execute(
            "INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)",
            (user["id"], project_id),
        )
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
        create_audit(con, user["id"], "create_project", "project", project_id, {"title": title})
        con.commit()
        row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    handler.send_json(HTTPStatus.CREATED, {"project": serialize_project(row, user)})


def api_update_project(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_user()
    if not user:
        return
    if not can_access_project(handler, user, project_id):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    with db() as con:
        current = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not current:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return

        title = str(payload.get("title", current["title"] or "")).strip()
        address = str(payload.get("address", current["address"] or "")).strip()
        client_name = str(payload.get("client_name", payload.get("clientName", current["client_name"] or ""))).strip()
        status = str(payload.get("status", current["status"] or "")).strip() or "Подготовка"
        contract_no = str(payload.get("contract_no", payload.get("contractNo", current["contract_no"] or ""))).strip() or None
        contract_date = str(payload.get("contract_date", payload.get("contractDate", current["contract_date"] or ""))).strip() or None
        started_at = str(payload.get("started_at", payload.get("startedAt", current["started_at"] or ""))).strip() or None
        deadline_at = str(payload.get("deadline_at", payload.get("deadlineAt", current["deadline_at"] or ""))).strip() or None
        city = str(payload.get("city", current["city"] or "")).strip() or None
        region = str(payload.get("region", current["region"] or "")).strip() or None
        description = str(payload.get("description", current["description"] or "")).strip() or None

        if not title or not address or not client_name:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_address_client_required"})
            return

        try:
            budget_value = payload.get("budget", current["budget"])
            budget = float(budget_value or 0)
        except (TypeError, ValueError):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_budget"})
            return

        con.execute(
            """
            UPDATE projects
            SET
                title = ?,
                address = ?,
                city = ?,
                region = ?,
                client_name = ?,
                contract_no = ?,
                contract_date = ?,
                status = ?,
                budget = ?,
                started_at = ?,
                deadline_at = ?,
                description = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                title,
                address,
                city,
                region,
                client_name,
                contract_no,
                contract_date,
                status,
                budget,
                started_at,
                deadline_at,
                description,
                now_ts(),
                project_id,
            ),
        )
        create_audit(con, user["id"], "update_project", "project", project_id, {"title": title, "status": status})
        con.commit()
        row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    handler.send_json(HTTPStatus.OK, {"project": serialize_project(row, user)})


def api_delete_project(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_user()
    if not user:
        return
    if not (user_is_main_admin(user) or user_has_any_role(user, {"admin"})):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    with db() as con:
        current = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not current:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        title = current["title"] or ""
        if table_exists(con, "chat_messages") and table_exists(con, "chats"):
            con.execute(
                "DELETE FROM chat_messages WHERE chat_id IN (SELECT id FROM chats WHERE project_id = ?)",
                (project_id,),
            )
        for table in [
            "finance_entries",
            "documents",
            "daily_logs",
            "tasks",
            "material_schedule_snapshots",
            "supplier_offers",
            "warehouse_transfers",
            "stock_moves",
            "estimate_items",
            "work_stages",
            "chats",
            "user_project_access",
        ]:
            delete_project_rows(con, table, "project_id", project_id)
        delete_project_rows(con, "object_assignments", "object_id", project_id)
        con.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        create_audit(con, user["id"], "delete_project", "project", project_id, {"title": title})
        con.commit()
    handler.send_json(HTTPStatus.OK, {"ok": True, "deleted_id": project_id})


def can_access_project(handler, user: dict, project_id: int) -> bool:
    if user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"}):
        return True
    with db() as con:
        if user_has_any_role(user, {"foreman"}):
            row = con.execute(
                """
                SELECT 1
                FROM projects p
                WHERE p.id = ?
                  AND (
                    EXISTS (
                        SELECT 1
                        FROM object_assignments own_oa
                        WHERE own_oa.object_id = p.id
                          AND own_oa.user_id = ?
                          AND own_oa.role_code = 'foreman'
                    )
                    OR NOT EXISTS (
                        SELECT 1
                        FROM object_assignments foreman_oa
                        WHERE foreman_oa.object_id = p.id
                          AND foreman_oa.role_code = 'foreman'
                    )
                  )
                """,
                (project_id, user["id"]),
            ).fetchone()
        else:
            row = con.execute(
                """
                SELECT 1
                FROM user_project_access
                WHERE user_id = ? AND project_id = ?
                UNION
                SELECT 1
                FROM object_assignments
                WHERE user_id = ? AND object_id = ?
                """,
                (user["id"], project_id, user["id"], project_id),
            ).fetchone()
    return bool(row)


def require_project_access(handler, project_id: int) -> dict | None:
    user = handler.require_user()
    if not user:
        return None
    if not handler.can_access_project(user, project_id):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "project_forbidden"})
        return None
    return user


def api_project_detail(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
        return
    handler.send_json(HTTPStatus.OK, {"project": serialize_project(row, user)})


def api_project_assignments(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        rows = con.execute(
            """
            SELECT oa.*, u.name AS user_name, u.first_name AS user_first_name, u.last_name AS user_last_name, u.login AS user_login, u.role AS user_role, r.name AS assignment_role_name
            FROM object_assignments oa
            JOIN users u ON u.id = oa.user_id
            LEFT JOIN roles r ON r.code = oa.role_code
            WHERE oa.object_id = ?
            ORDER BY oa.is_primary DESC, oa.assigned_at DESC, oa.id DESC
            """,
            (project_id,),
        ).fetchall()
    handler.send_json(
        HTTPStatus.OK,
        {
            "assignments": [
                {
                    "id": row["id"],
                    "objectId": row["object_id"],
                    "userId": row["user_id"],
                    "userName": display_user_name(row["user_name"], row["user_first_name"], row["user_last_name"], row["user_login"]),
                    "userLogin": row["user_login"],
                    "roleCode": normalize_role(row["role_code"]),
                    "roleLabel": ROLE_LABELS.get(normalize_role(row["role_code"]), row["assignment_role_name"] or row["role_code"]),
                    "responsibility": row["responsibility"],
                    "isPrimary": bool(row["is_primary"]),
                    "assignedAt": row["assigned_at"],
                }
                for row in rows
                if not user_is_hidden_admin({"login": row["user_login"], "role": row["user_role"]}) or user_is_hidden_admin(user)
            ]
        },
    )


def api_create_project_assignment(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    admin = handler.require_role({"admin", "director"})
    if not admin:
        return
    payload = handler.read_json()
    try:
        user_id = int(payload.get("user_id", payload.get("userId")))
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_user_id"})
        return
    role_code = normalize_role(str(payload.get("role_code", payload.get("roleCode", ""))).strip())
    responsibility = str(payload.get("responsibility", "")).strip() or None
    is_primary = 1 if payload.get("is_primary", payload.get("isPrimary", False)) else 0
    with db() as con:
        role_row = con.execute("SELECT name FROM roles WHERE code = ?", (role_code,)).fetchone()
        if not role_row:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_role"})
            return
        project = con.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        assignee = con.execute("SELECT id, role FROM users WHERE id = ? AND is_active = 1", (user_id,)).fetchone()
        if not project:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        if not assignee:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "user_not_found"})
            return
        if is_primary:
            con.execute(
                "UPDATE object_assignments SET is_primary = 0 WHERE object_id = ? AND role_code = ?",
                (project_id, role_code),
            )
        cur = con.execute(
            """
            INSERT INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(object_id, user_id, role_code) DO UPDATE SET
                responsibility = excluded.responsibility,
                is_primary = excluded.is_primary,
                assigned_by = excluded.assigned_by,
                assigned_at = excluded.assigned_at
            """,
            (project_id, user_id, role_code, responsibility, is_primary, admin["id"], now_ts()),
        )
        con.execute(
            "INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)",
            (user_id, project_id),
        )
        if role_code == "director":
            con.execute("UPDATE projects SET director_id = ?, updated_at = ? WHERE id = ?", (user_id, now_ts(), project_id))
        elif role_code == "foreman":
            con.execute("UPDATE projects SET foreman_id = ?, updated_at = ? WHERE id = ?", (user_id, now_ts(), project_id))
        elif role_code == "purchaser":
            con.execute("UPDATE projects SET buyer_id = ?, updated_at = ? WHERE id = ?", (user_id, now_ts(), project_id))
        elif role_code == "customer":
            con.execute("UPDATE projects SET client_user_id = ?, updated_at = ? WHERE id = ?", (user_id, now_ts(), project_id))
        create_audit(
            con,
            admin["id"],
            "assign_user_to_project",
            "object_assignment",
            cur.lastrowid,
            {"project_id": project_id, "user_id": user_id, "role_code": role_code},
        )
        con.commit()
    handler.send_json(HTTPStatus.CREATED, {"ok": True})
