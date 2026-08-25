from __future__ import annotations

import json
import math
import mimetypes
import re
import secrets
import sqlite3
import time
from datetime import date, timedelta
from http import HTTPStatus
from pathlib import Path

from auth import user_can_manage_documents, user_can_manage_schedule, user_has_any_role
from projects import serialize_project
from schedule_tasks import (
    build_procurement_alerts,
    build_section_schedule_forecast,
    classify_scope,
    material_summary_rows,
    normalize_schedule_text,
    parse_iso_date,
)
from warehouse import normalize_estimate_item_kind
from sqlite_config import configure_connection

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
TODAY_ISO = date.today().isoformat()
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

DAILY_LOG_MATERIAL_ACTION_TYPES = {
    "material_purchase": "purchase",
    "material_receipt": "receipt",
    "material_use": "use",
}


def user_can_apply_daily_log_material_actions(user: dict) -> bool:
    return user_can_manage_schedule(user) or user_has_any_role(user, {"purchaser"})


def now_ts() -> int:
    return int(time.time())


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    return configure_connection(connection)


def ensure_daily_log_actions_schema(con: sqlite3.Connection) -> None:
    """Add the idempotent daily-report action journal to an existing database."""

    daily_log_columns = {
        str(row["name"])
        for row in con.execute("PRAGMA table_info(daily_logs)").fetchall()
    }
    if "client_request_id" not in daily_log_columns:
        con.execute("ALTER TABLE daily_logs ADD COLUMN client_request_id TEXT")

    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS daily_log_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE RESTRICT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            action_type TEXT NOT NULL CHECK(action_type IN (
                'material_purchase', 'material_receipt', 'material_use'
            )),
            estimate_item_id INTEGER NOT NULL REFERENCES estimate_items(id) ON DELETE RESTRICT,
            material_title_snapshot TEXT NOT NULL,
            material_unit_snapshot TEXT NOT NULL,
            qty REAL NOT NULL CHECK(qty > 0),
            client_action_id TEXT NOT NULL,
            stock_move_id INTEGER NOT NULL UNIQUE REFERENCES stock_moves(id) ON DELETE RESTRICT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(project_id, client_action_id)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_client_request
            ON daily_logs(project_id, client_request_id)
            WHERE client_request_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_daily_log_actions_log
            ON daily_log_actions(daily_log_id, id);
        CREATE INDEX IF NOT EXISTS idx_daily_log_actions_project_material
            ON daily_log_actions(project_id, estimate_item_id, id);
        """
    )


def parse_path_int(path: str, index: int) -> int | None:
    parts = path.strip("/").split("/")
    try:
        return int(parts[index])
    except (IndexError, TypeError, ValueError):
        return None


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


EXECUTIVE_TEMPLATE_RULES = {
    "hidden_work_act": {
        "title": "Акт скрытых работ",
        "doc_type": "hidden_work_act",
        "categories": {"concrete", "masonry", "roof", "facade", "electrical", "plumbing", "ventilation", "landscape"},
        "optional": False,
        "default_notes": "Подготовить акт скрытых работ по этапу, проверить объемы и подписи стройконтроля.",
    },
    "inspection_act": {
        "title": "Акт осмотра",
        "doc_type": "inspection_act",
        "categories": {"prep", "concrete", "masonry", "roof", "facade", "landscape", "handover"},
        "optional": False,
        "default_notes": "Нужен акт осмотра/освидетельствования перед закрытием этапа.",
    },
    "executive": {
        "title": "Исполнительная документация",
        "doc_type": "executive",
        "categories": {"electrical", "plumbing", "ventilation", "handover"},
        "optional": False,
        "default_notes": "Собрать исполнительную документацию и приложить схемы, фото, подтверждающие листы.",
    },
    "technical_solution": {
        "title": "Техрешение",
        "doc_type": "technical_solution",
        "categories": {"general"},
        "optional": True,
        "default_notes": "Использовать, если на этапе выявлено расхождение проекта, сметы или факта работ.",
    },
}


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^\w.\- ]+", "_", name or "").strip().strip(".")
    return cleaned or "document"


def project_documents_dir(project_id: int) -> Path:
    path = DOCUMENTS_DIR / f"project_{project_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def document_extension(name: str) -> str:
    return Path(name or "").suffix.lower()[:16]


def executive_templates_for_stage(stage: sqlite3.Row | dict) -> list[dict]:
    title = str(stage["title"] if isinstance(stage, sqlite3.Row) else stage.get("title", ""))
    stage_kind = str(stage["stage_kind"] if isinstance(stage, sqlite3.Row) else stage.get("stage_kind", "work") or "work")
    progress = int(stage["progress"] if isinstance(stage, sqlite3.Row) else stage.get("progress", 0) or 0)
    status_code = str(stage["status_code"] if isinstance(stage, sqlite3.Row) else stage.get("status_code", "not_started") or "not_started")
    category = classify_scope(title)
    if stage_kind == "section":
        return []

    templates: list[dict] = []
    for code, config in EXECUTIVE_TEMPLATE_RULES.items():
        categories = set(config.get("categories", set()))
        is_match = category in categories or "general" in categories
        if not is_match:
            continue
        if code == "technical_solution":
            if status_code not in {"problem", "paused", "blocked"} and progress < 25:
                continue
        elif status_code == "not_started" and progress <= 0:
            continue
        templates.append(
            {
                "code": code,
                "title": config["title"],
                "doc_type": config["doc_type"],
                "optional": bool(config.get("optional")),
                "default_notes": config.get("default_notes", ""),
            }
        )
    return templates


def executive_ready_status(status: str | None) -> bool:
    return str(status or "").strip() in {"reviewed", "approved", "signed", "ready"}


def api_project_notifications(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    today = date.today().isoformat()
    today_date = parse_iso_date(today) or date(2026, 7, 26)
    soon_limit = (today_date + timedelta(days=2)).isoformat()
    with db() as con:
        project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        open_tasks = con.execute(
            """
            SELECT t.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS assignee_name
            FROM tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.project_id = ? AND t.status != 'done'
            ORDER BY t.due_at IS NULL, t.due_at ASC, t.id DESC
            """,
            (project_id,),
        ).fetchall()
        latest_log = con.execute(
            """
            SELECT id, report_date, title, blockers, created_at
            FROM daily_logs
            WHERE project_id = ?
            ORDER BY report_date DESC, id DESC
            LIMIT 1
            """,
            (project_id,),
        ).fetchone()
        blocker_logs = con.execute(
            """
            SELECT id, report_date, title, blockers
            FROM daily_logs
            WHERE project_id = ? AND TRIM(COALESCE(blockers, '')) != ''
            ORDER BY report_date DESC, id DESC
            LIMIT 3
            """,
            (project_id,),
        ).fetchall()
        materials = []
        section_start_dates: dict[str, str] = {}
        if user["role"] == "customer":
            stage_rows = con.execute(
                """
                SELECT id, title, parent_id, stage_kind, status_code, planned_start, planned_end, progress, responsible
                FROM work_stages
                WHERE project_id = ? AND is_client_visible = 1
                ORDER BY position, id
                """,
                (project_id,),
            ).fetchall()
        else:
            stage_rows = con.execute(
                """
                SELECT id, title, parent_id, stage_kind, status_code, planned_start, planned_end, progress, responsible
                FROM work_stages
                WHERE project_id = ?
                ORDER BY position, id
                """,
                (project_id,),
            ).fetchall()
            materials = material_summary_rows(con, project_id)
            work_rows = con.execute(
                """
                SELECT id, title, unit, planned_qty, item_kind, section_title
                FROM estimate_items
                WHERE project_id = ?
                ORDER BY id
                """,
                (project_id,),
            ).fetchall()
            work_items = [row for row in work_rows if normalize_estimate_item_kind(row["item_kind"]) == "work"]
            if project and work_items:
                forecast_start = parse_iso_date(project["started_at"]) or today_date
                forecast = build_section_schedule_forecast(project, work_items, forecast_start)
                for section in forecast.get("sections", []):
                    title = str(section.get("title") or "").strip()
                    start_date = str(section.get("startDate") or "").strip()
                    if title and start_date:
                        section_start_dates[title] = start_date
    stage_items = [dict(row) for row in stage_rows]
    stage_map = {int(item["id"]): item for item in stage_items if item.get("id") is not None}

    def stage_section_title(item: dict) -> str:
        current = item
        root = item
        guard = 0
        while current and current.get("parent_id") and guard < 32:
            parent = stage_map.get(int(current["parent_id"]))
            if not parent:
                break
            root = parent
            current = parent
            guard += 1
        title = str((root or item).get("title") or item.get("title") or "").strip()
        return title or "График работ"

    stage_matches = []
    for item in stage_items:
        normalized_title = normalize_schedule_text(item.get("title"))
        if normalized_title:
            stage_matches.append((len(normalized_title), normalized_title, item))
    stage_matches.sort(reverse=True, key=lambda entry: entry[0])

    def annotate_task_section(item: dict) -> dict:
        text = normalize_schedule_text(" ".join([str(item.get("title") or ""), str(item.get("description") or "")]))
        for _, normalized_title, stage in stage_matches:
            if normalized_title and normalized_title in text:
                item["stageTitle"] = str(stage.get("title") or "").strip()
                item["sectionTitle"] = stage_section_title(stage)
                return item
        item["sectionTitle"] = "Задачи объекта"
        return item

    overdue_tasks = []
    due_soon_tasks = []
    for row in open_tasks:
        item = annotate_task_section(dict(row))
        due_at = str(item.get("due_at") or "")
        if due_at and due_at < today:
            overdue_tasks.append(item)
        elif due_at and due_at <= soon_limit:
            due_soon_tasks.append(item)
    problem_stages = []
    for item in stage_items:
        item["sectionTitle"] = stage_section_title(item)
        status_code = str(item.get("status_code") or "")
        progress = int(item.get("progress") or 0)
        planned_end = str(item.get("planned_end") or "")
        if status_code == "blocked" or (planned_end and planned_end < today and progress < 100):
            problem_stages.append(item)
    procurement = build_procurement_alerts(materials, stage_rows, today_date, section_start_dates) if user["role"] != "customer" else {"items": [], "summary": {"critical": 0, "soon": 0, "watch": 0}}
    shortage_alerts = []
    for material in materials:
        if normalize_estimate_item_kind(material.get("itemKind")) == "work":
            continue
        missing_qty = float(material.get("missingQty") or 0)
        if missing_qty <= 0:
            continue
        work_date = str(
            material.get("stageStartDate")
            or material.get("needByDate")
            or material.get("stageEndDate")
            or ""
        )
        parsed_work_date = parse_iso_date(work_date)
        shortage_alerts.append(
            {
                "materialId": int(material.get("id") or 0),
                "title": str(material.get("title") or ""),
                "unit": str(material.get("unit") or ""),
                "missingQty": missing_qty,
                "sectionTitle": str(material.get("sectionTitle") or ""),
                "stageTitle": str(material.get("stageTitle") or ""),
                "needByDate": str(material.get("needByDate") or ""),
                "workDate": work_date,
                "daysUntilWork": (parsed_work_date - today_date).days if parsed_work_date else None,
            }
        )
    shortage_alerts.sort(
        key=lambda item: (
            item["daysUntilWork"] is None,
            item["daysUntilWork"] if item["daysUntilWork"] is not None else 10**9,
            item["title"],
        )
    )
    data = {
        "today": today,
        "missingDailyReport": False if user["role"] == "customer" else not bool(latest_log and latest_log["report_date"] == today),
        "latestDailyLog": dict(latest_log) if latest_log else None,
        "overdueTasks": overdue_tasks[:8],
        "dueSoonTasks": due_soon_tasks[:8],
        "blockerLogs": [dict(row) for row in blocker_logs],
        "problemStages": problem_stages[:8],
        "shortageAlerts": shortage_alerts,
        "procurementAlerts": procurement["items"],
        "procurementSummary": procurement["summary"],
    }
    handler.send_json(HTTPStatus.OK, data)


def api_project_documents(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        if user["role"] == "customer":
            rows = con.execute(
                """
                SELECT d.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS uploaded_by_name, s.title AS stage_title
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by
                LEFT JOIN work_stages s ON s.id = d.stage_id
                WHERE d.project_id = ? AND d.is_client_visible = 1
                ORDER BY d.id DESC
                """,
                (project_id,),
            ).fetchall()
        else:
            rows = con.execute(
                """
                SELECT d.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS uploaded_by_name, s.title AS stage_title
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by
                LEFT JOIN work_stages s ON s.id = d.stage_id
                WHERE d.project_id = ?
                ORDER BY d.id DESC
                """,
                (project_id,),
            ).fetchall()
    documents = []
    for row in rows:
        item = dict(row)
        item["download_url"] = f"/api/documents/{row['id']}/download"
        item["view_url"] = f"/api/documents/{row['id']}/view"
        item["can_preview"] = bool(row["storage_path"]) and str(row["mime_type"] or "").startswith(("image/", "text/")) or str(row["file_ext"] or "") == ".pdf"
        documents.append(item)
    handler.send_json(HTTPStatus.OK, {"documents": documents})


def api_project_executive_docs(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return

    with db() as con:
        project = con.execute("SELECT id, title FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        stages = con.execute(
            """
            SELECT id, title, stage_kind, status_code, progress, planned_end, fact_end, parent_id
            FROM work_stages
            WHERE project_id = ?
            ORDER BY position ASC, id ASC
            """,
            (project_id,),
        ).fetchall()
        docs = con.execute(
            """
            SELECT id, title, doc_type, status, stage_id, template_code, is_client_visible, created_at
            FROM documents
            WHERE project_id = ?
            ORDER BY id DESC
            """,
            (project_id,),
        ).fetchall()

    docs_by_stage: dict[int, list[dict]] = {}
    for row in docs:
        stage_id = int(row["stage_id"] or 0)
        if not stage_id:
            continue
        docs_by_stage.setdefault(stage_id, []).append(dict(row))

    checklist = []
    required_total = 0
    ready_total = 0
    for stage in stages:
        stage_templates = executive_templates_for_stage(stage)
        if not stage_templates:
            continue
        stage_docs = docs_by_stage.get(int(stage["id"]), [])
        items = []
        for template in stage_templates:
            same_docs = [
                item for item in stage_docs
                if str(item.get("template_code") or item.get("doc_type") or "") == template["code"]
            ]
            ready_count = sum(1 for item in same_docs if executive_ready_status(item.get("status")))
            required_total += 0 if template["optional"] else 1
            ready_total += 0 if template["optional"] else min(ready_count, 1)
            items.append(
                {
                    "code": template["code"],
                    "title": template["title"],
                    "docType": template["doc_type"],
                    "optional": template["optional"],
                    "defaultNotes": template["default_notes"],
                    "existingCount": len(same_docs),
                    "readyCount": ready_count,
                    "isReady": ready_count > 0,
                }
            )
        checklist.append(
            {
                "stageId": int(stage["id"]),
                "stageTitle": stage["title"],
                "stageKind": stage["stage_kind"],
                "statusCode": stage["status_code"],
                "progress": int(stage["progress"] or 0),
                "plannedEnd": stage["planned_end"],
                "factEnd": stage["fact_end"],
                "items": items,
            }
        )

    handler.send_json(
        HTTPStatus.OK,
        {
            "project": {"id": int(project["id"]), "title": project["title"]},
            "canManage": user_can_manage_documents(user),
            "summary": {
                "stages": len(checklist),
                "required": required_total,
                "ready": ready_total,
                "missing": max(0, required_total - ready_total),
            },
            "checklist": checklist,
        },
    )


def api_create_project_executive_doc(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_documents(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return

    payload = handler.read_json()
    template_code = str(payload.get("template_code", payload.get("templateCode", ""))).strip()
    stage_id = int(payload.get("stage_id", payload.get("stageId", 0)) or 0)
    if template_code not in EXECUTIVE_TEMPLATE_RULES:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_template_code"})
        return
    if not stage_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
        return

    template = EXECUTIVE_TEMPLATE_RULES[template_code]
    with db() as con:
        stage = con.execute(
            """
            SELECT id, project_id, title, stage_kind, status_code, progress
            FROM work_stages
            WHERE id = ? AND project_id = ?
            """,
            (stage_id, project_id),
        ).fetchone()
        if not stage:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "stage_not_found"})
            return
        allowed_templates = {item["code"] for item in executive_templates_for_stage(stage)}
        if template_code not in allowed_templates:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "template_not_allowed_for_stage"})
            return

        existing_count = con.execute(
            """
            SELECT COUNT(*) FROM documents
            WHERE project_id = ? AND stage_id = ? AND (template_code = ? OR doc_type = ?)
            """,
            (project_id, stage_id, template_code, template["doc_type"]),
        ).fetchone()[0]
        suffix = f" #{existing_count + 1}" if existing_count else ""
        title = f"{template['title']} — {stage['title']}{suffix}"
        title = f"{template['title']} - {stage['title']}{suffix}"
        notes_parts = [template["default_notes"]]
        custom_notes = str(payload.get("notes", "")).strip()
        if custom_notes:
            notes_parts.append(custom_notes)
        cur = con.execute(
            """
            INSERT INTO documents (
                project_id, title, doc_type, status, notes, uploaded_by,
                is_client_visible, created_at, updated_at, stage_id, template_code, generated_by_system
            )
            VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                project_id,
                title,
                template["doc_type"],
                "\n".join(part for part in notes_parts if part).strip() or None,
                user["id"],
                0,
                now_ts(),
                now_ts(),
                stage_id,
                template_code,
            ),
        )
        create_audit(
            con,
            user["id"],
            "create_executive_document",
            "document",
            cur.lastrowid,
            {"project_id": project_id, "stage_id": stage_id, "template_code": template_code},
        )
        row = con.execute(
            """
            SELECT d.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS uploaded_by_name, s.title AS stage_title
            FROM documents d
            LEFT JOIN users u ON u.id = d.uploaded_by
            LEFT JOIN work_stages s ON s.id = d.stage_id
            WHERE d.id = ?
            """,
            (cur.lastrowid,),
        ).fetchone()
        con.commit()

    item = dict(row)
    item["download_url"] = f"/api/documents/{row['id']}/download"
    item["view_url"] = f"/api/documents/{row['id']}/view"
    item["can_preview"] = False
    handler.send_json(HTTPStatus.CREATED, {"document": item})


def api_upload_project_document(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_documents(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return

    form = handler.read_multipart()
    upload = form["file"] if "file" in form else None
    if upload is None or not getattr(upload, "file", None) or not getattr(upload, "filename", ""):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "file_required"})
        return

    original_name = sanitize_filename(upload.filename)
    raw = upload.file.read()
    if not raw:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "empty_file"})
        return
    if len(raw) > MAX_UPLOAD_BYTES:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "upload_too_large"})
        return

    doc_type = str(form.getfirst("doc_type", "file")).strip() or "file"
    status = str(form.getfirst("status", "draft")).strip() or "draft"
    is_client_visible = 1 if str(form.getfirst("is_client_visible", "0")).strip() in {"1", "true", "yes", "on"} else 0
    title = str(form.getfirst("title", "")).strip() or Path(original_name).stem
    notes = str(form.getfirst("notes", "")).strip() or None
    file_ext = document_extension(original_name)
    mime_type = upload.type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    storage_name = f"{now_ts()}_{secrets.token_hex(8)}{file_ext}"
    file_path = project_documents_dir(project_id) / storage_name
    file_path.write_bytes(raw)

    with db() as con:
        cur = con.execute(
            """
            INSERT INTO documents (
                project_id, title, doc_type, status, original_name, storage_name, storage_path,
                mime_type, file_ext, size_bytes, notes, uploaded_by, is_client_visible, created_at, updated_at,
                stage_id, template_code, generated_by_system
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            (
                project_id,
                title,
                doc_type,
                status,
                original_name,
                storage_name,
                str(file_path.relative_to(PROJECT_ROOT)),
                mime_type,
                file_ext,
                len(raw),
                notes,
                user["id"],
                is_client_visible,
                now_ts(),
                now_ts(),
                int(str(form.getfirst("stage_id", "0")).strip() or "0") or None,
                str(form.getfirst("template_code", "")).strip() or None,
            ),
        )
        create_audit(
            con,
            user["id"],
            "upload_document",
            "document",
            cur.lastrowid,
            {"project_id": project_id, "title": title, "doc_type": doc_type},
        )
        row = con.execute(
            """
            SELECT d.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS uploaded_by_name, s.title AS stage_title
            FROM documents d
            LEFT JOIN users u ON u.id = d.uploaded_by
            LEFT JOIN work_stages s ON s.id = d.stage_id
            WHERE d.id = ?
            """,
            (cur.lastrowid,),
        ).fetchone()
        con.commit()

    item = dict(row)
    item["download_url"] = f"/api/documents/{row['id']}/download"
    item["view_url"] = f"/api/documents/{row['id']}/view"
    item["can_preview"] = str(item["mime_type"] or "").startswith(("image/", "text/")) or str(item["file_ext"] or "") == ".pdf"
    handler.send_json(HTTPStatus.CREATED, {"document": item})


def api_document_file(handler, path: str, inline: bool) -> None:
    document_id = parse_path_int(path, 2)
    if not document_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_id"})
        return
    user = handler.require_user()
    if not user:
        return
    with db() as con:
        row = con.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if not row:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "document_not_found"})
        return
    if not handler.can_access_project(user, int(row["project_id"])):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
        return
    if user["role"] == "customer" and int(row["is_client_visible"] or 0) != 1:
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
        return
    storage_path = row["storage_path"]
    if not storage_path:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "file_not_uploaded"})
        return
    file_path = (PROJECT_ROOT / storage_path).resolve()
    try:
        file_path.relative_to(PROJECT_ROOT.resolve())
    except ValueError:
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
        return
    if not file_path.is_file():
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "file_missing"})
        return
    can_inline = str(row["mime_type"] or "").startswith(("image/", "text/")) or str(row["file_ext"] or "") == ".pdf"
    handler.send_file(
        file_path,
        str(row["mime_type"] or "application/octet-stream"),
        str(row["original_name"] or row["title"] or f"document-{document_id}"),
        inline=inline and can_inline,
    )


def api_project_daily_logs(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        if user["role"] == "customer":
            rows = con.execute(
                """
                SELECT l.*,
                       COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS author_name,
                       EXISTS(SELECT 1 FROM daily_log_actions action WHERE action.daily_log_id = l.id) AS has_applied_actions
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
                SELECT l.*,
                       COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS author_name,
                       EXISTS(SELECT 1 FROM daily_log_actions action WHERE action.daily_log_id = l.id) AS has_applied_actions
                FROM daily_logs l
                LEFT JOIN users u ON u.id = l.created_by
                WHERE l.project_id = ?
                ORDER BY l.report_date DESC, l.id DESC
                """,
                (project_id,),
            ).fetchall()
    handler.send_json(HTTPStatus.OK, {"logs": [dict(row) for row in rows]})


def normalize_daily_log_client_id(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    if len(text) > 200 or any(ord(character) < 32 for character in text):
        return None
    return text


def normalize_confirmed_material_actions(payload: dict) -> tuple[list[dict], dict | None]:
    raw_actions = payload.get("confirmed_actions", payload.get("confirmedActions", []))
    if raw_actions is None:
        raw_actions = []
    if not isinstance(raw_actions, list):
        return [], {"error": "bad_confirmed_actions"}
    if len(raw_actions) > 100:
        return [], {"error": "too_many_confirmed_actions"}

    actions: list[dict] = []
    seen_client_ids: set[str] = set()
    for index, raw_action in enumerate(raw_actions):
        if not isinstance(raw_action, dict):
            return [], {"error": "bad_confirmed_action", "actionIndex": index}
        action_type = str(
            raw_action.get("action_type", raw_action.get("actionType", raw_action.get("type", "")))
            or ""
        ).strip()
        if action_type not in DAILY_LOG_MATERIAL_ACTION_TYPES:
            return [], {"error": "bad_confirmed_action_type", "actionIndex": index}
        client_action_raw = raw_action.get("client_action_id", raw_action.get("clientActionId"))
        client_action_id = normalize_daily_log_client_id(client_action_raw)
        if not client_action_id:
            return [], {"error": "bad_client_action_id", "actionIndex": index}
        if client_action_id in seen_client_ids:
            return [], {"error": "duplicate_client_action_id", "actionIndex": index}
        seen_client_ids.add(client_action_id)
        estimate_item_raw = raw_action.get("estimate_item_id", raw_action.get("estimateItemId"))
        qty_raw = raw_action.get("qty", raw_action.get("quantity"))
        try:
            if isinstance(estimate_item_raw, bool) or isinstance(qty_raw, bool):
                raise ValueError
            estimate_item_id = int(estimate_item_raw)
            qty = float(qty_raw)
        except (TypeError, ValueError, OverflowError):
            return [], {"error": "bad_confirmed_action_values", "actionIndex": index}
        if estimate_item_id <= 0:
            return [], {"error": "bad_estimate_item_id", "actionIndex": index}
        if not math.isfinite(qty) or qty <= 0:
            return [], {"error": "bad_qty", "actionIndex": index}
        actions.append(
            {
                "action_type": action_type,
                "move_type": DAILY_LOG_MATERIAL_ACTION_TYPES[action_type],
                "estimate_item_id": estimate_item_id,
                "qty": qty,
                "client_action_id": client_action_id,
                "action_index": index,
            }
        )
    return actions, None


def daily_log_applied_actions(con: sqlite3.Connection, daily_log_id: int) -> list[dict]:
    rows = con.execute(
        """
        SELECT action.id, action.action_type, action.estimate_item_id,
               action.material_title_snapshot, action.material_unit_snapshot,
               action.qty, action.client_action_id, action.stock_move_id,
               move.move_type
        FROM daily_log_actions action
        JOIN stock_moves move ON move.id = action.stock_move_id
        WHERE action.daily_log_id = ?
        ORDER BY action.id
        """,
        (daily_log_id,),
    ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "type": str(row["action_type"]),
            "estimateItemId": int(row["estimate_item_id"]),
            "materialTitle": str(row["material_title_snapshot"]),
            "unit": str(row["material_unit_snapshot"]),
            "qty": float(row["qty"]),
            "clientActionId": str(row["client_action_id"]),
            "stockMoveId": int(row["stock_move_id"]),
            "moveType": str(row["move_type"]),
        }
        for row in rows
    ]


def send_daily_log_replay(handler, project_id: int, user: dict, client_request_id: str) -> bool:
    with db() as con:
        log_row = con.execute(
            """
            SELECT l.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS author_name
            FROM daily_logs l
            LEFT JOIN users u ON u.id = l.created_by
            WHERE l.project_id = ? AND l.client_request_id = ?
            """,
            (project_id, client_request_id),
        ).fetchone()
        if not log_row:
            return False
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        applied_actions = daily_log_applied_actions(con, int(log_row["id"]))
    log_payload = dict(log_row)
    log_payload["has_applied_actions"] = 1 if applied_actions else 0
    handler.send_json(
        HTTPStatus.OK,
        {
            "id": int(log_row["id"]),
            "log": log_payload,
            "project": serialize_project(project_row, user),
            "appliedActions": applied_actions,
            "idempotentReplay": True,
        },
    )
    return True


def api_create_daily_log(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if user["role"] in {"customer"}:
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    title = str(payload.get("title", "")).strip()
    work_done = str(payload.get("work_done", "")).strip()
    if not title or not work_done:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_and_work_required"})
        return
    client_request_raw = payload.get("client_request_id", payload.get("clientRequestId"))
    client_request_id = normalize_daily_log_client_id(client_request_raw)
    if client_request_raw not in (None, "") and not client_request_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_client_request_id"})
        return
    confirmed_actions, actions_error = normalize_confirmed_material_actions(payload)
    if actions_error:
        handler.send_json(HTTPStatus.BAD_REQUEST, actions_error)
        return
    if confirmed_actions and not user_can_apply_daily_log_material_actions(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "daily_log_actions_forbidden"})
        return
    report_date = str(payload.get("report_date", "")).strip() or date.today().isoformat()
    parsed_report_date = parse_iso_date(report_date)
    if not parsed_report_date or parsed_report_date.isoformat() != report_date:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_report_date"})
        return
    try:
        workers_count = max(0, int(payload.get("workers_count", 0) or 0))
    except (TypeError, ValueError):
        workers_count = 0
    progress_percent_raw = payload.get("progress_percent", payload.get("progressPercent"))
    try:
        progress_percent = max(0.0, min(100.0, float(progress_percent_raw))) if progress_percent_raw not in (None, "", False) else None
    except (TypeError, ValueError):
        progress_percent = None
    if client_request_id and send_daily_log_replay(handler, project_id, user, client_request_id):
        return

    timestamp = now_ts()
    try:
        with db() as con:
            con.execute("BEGIN IMMEDIATE")
            material_ids = sorted({int(action["estimate_item_id"]) for action in confirmed_actions})
            material_by_id: dict[int, sqlite3.Row] = {}
            material_summary_by_id = {
                int(item["id"]): item
                for item in material_summary_rows(con, project_id)
            } if material_ids else {}
            if material_ids:
                placeholders = ",".join("?" for _ in material_ids)
                rows = con.execute(
                    f"""
                    SELECT id, title, unit, item_kind, COALESCE(is_deleted, 0) AS is_deleted
                    FROM estimate_items
                    WHERE project_id = ? AND id IN ({placeholders})
                    """,
                    (project_id, *material_ids),
                ).fetchall()
                material_by_id = {int(row["id"]): row for row in rows}

            for action in confirmed_actions:
                material = material_by_id.get(int(action["estimate_item_id"]))
                if not material or int(material["is_deleted"] or 0) == 1:
                    handler.send_json(
                        HTTPStatus.BAD_REQUEST,
                        {
                            "error": "estimate_item_project_mismatch",
                            "actionIndex": int(action["action_index"]),
                        },
                    )
                    return
                if normalize_estimate_item_kind(material["item_kind"]) == "work":
                    handler.send_json(
                        HTTPStatus.BAD_REQUEST,
                        {
                            "error": "estimate_item_not_material",
                            "actionIndex": int(action["action_index"]),
                        },
                    )
                    return

            quantity_state = {
                material_id: {
                    "planned": float(material_summary_by_id[material_id].get("plannedQty") or 0),
                    "purchased": float(material_summary_by_id[material_id].get("purchasedQty") or 0),
                    "received": float(material_summary_by_id[material_id].get("receivedQty") or 0),
                    "used": float(material_summary_by_id[material_id].get("usedQty") or 0),
                    "writeoff": float(material_summary_by_id[material_id].get("writeoffQty") or 0),
                }
                for material_id in material_ids
                if material_id in material_summary_by_id
            }
            for action in confirmed_actions:
                material_id = int(action["estimate_item_id"])
                values = quantity_state.get(material_id)
                if not values or values["planned"] <= 0:
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "daily_log_action_no_quantity_limit",
                            "actionIndex": int(action["action_index"]),
                        },
                    )
                    return
                action_type = str(action["action_type"])
                if action_type == "material_purchase":
                    allowed_qty = max(values["planned"] - max(values["purchased"], values["received"]), 0)
                elif action_type == "material_receipt":
                    allowed_qty = max(values["planned"] - values["received"], 0)
                else:
                    allowed_qty = max(values["received"] - values["used"] - values["writeoff"], 0)
                requested_qty = float(action["qty"])
                if requested_qty > allowed_qty + 1e-9:
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "daily_log_action_qty_exceeds_limit",
                            "actionIndex": int(action["action_index"]),
                            "allowedQty": allowed_qty,
                        },
                    )
                    return
                if action_type == "material_purchase":
                    values["purchased"] += requested_qty
                elif action_type == "material_receipt":
                    values["received"] += requested_qty
                else:
                    values["used"] += requested_qty

            client_action_ids = [str(action["client_action_id"]) for action in confirmed_actions]
            if client_action_ids:
                placeholders = ",".join("?" for _ in client_action_ids)
                duplicate = con.execute(
                    f"""
                    SELECT client_action_id
                    FROM daily_log_actions
                    WHERE project_id = ? AND client_action_id IN ({placeholders})
                    LIMIT 1
                    """,
                    (project_id, *client_action_ids),
                ).fetchone()
                if duplicate:
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "client_action_already_applied",
                            "clientActionId": str(duplicate["client_action_id"]),
                        },
                    )
                    return

            cur = con.execute(
                """
                INSERT INTO daily_logs (
                    project_id, report_date, title, work_done, workers_count, equipment, blockers, next_steps,
                    progress_percent, raw_input, is_client_visible, client_request_id,
                    created_by, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    progress_percent,
                    str(payload.get("raw_input", payload.get("rawInput", ""))).strip() or None,
                    1 if payload.get("is_client_visible", True) else 0,
                    client_request_id,
                    user["id"],
                    timestamp,
                    timestamp,
                ),
            )
            daily_log_id = int(cur.lastrowid)

            for action in confirmed_actions:
                material = material_by_id[int(action["estimate_item_id"])]
                source_key = f"daily_log_action:{action['client_action_id']}"
                move_cur = con.execute(
                    """
                    INSERT INTO stock_moves (
                        project_id, estimate_item_id, move_type, qty, price, comment,
                        created_by, created_at, source_type, source_id, source_key,
                        material_title_snapshot, material_unit_snapshot
                    )
                    VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'daily_log_action', ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        int(action["estimate_item_id"]),
                        str(action["move_type"]),
                        float(action["qty"]),
                        f"Подтверждено в дневном отчёте «{title}»",
                        user["id"],
                        timestamp,
                        daily_log_id,
                        source_key,
                        str(material["title"] or ""),
                        str(material["unit"] or ""),
                    ),
                )
                action_cur = con.execute(
                    """
                    INSERT INTO daily_log_actions (
                        daily_log_id, project_id, action_type, estimate_item_id,
                        material_title_snapshot, material_unit_snapshot, qty,
                        client_action_id, stock_move_id, created_by, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        daily_log_id,
                        project_id,
                        str(action["action_type"]),
                        int(action["estimate_item_id"]),
                        str(material["title"] or ""),
                        str(material["unit"] or ""),
                        float(action["qty"]),
                        str(action["client_action_id"]),
                        int(move_cur.lastrowid),
                        user["id"],
                        timestamp,
                    ),
                )
                con.execute(
                    """
                    INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                    VALUES (?, 'apply_daily_log_material_action', 'daily_log_action', ?, ?, ?)
                    """,
                    (
                        user["id"],
                        int(action_cur.lastrowid),
                        json.dumps(
                            {
                                "project_id": project_id,
                                "daily_log_id": daily_log_id,
                                "action_type": action["action_type"],
                                "estimate_item_id": action["estimate_item_id"],
                                "qty": action["qty"],
                                "client_action_id": action["client_action_id"],
                                "stock_move_id": int(move_cur.lastrowid),
                            },
                            ensure_ascii=False,
                        ),
                        timestamp,
                    ),
                )

            if progress_percent is not None:
                status = "completed" if progress_percent >= 100 else ("active" if progress_percent > 0 else None)
                if status:
                    con.execute(
                        "UPDATE projects SET progress = ?, status = ?, updated_at = ? WHERE id = ?",
                        (int(round(progress_percent)), status, timestamp, project_id),
                    )
                else:
                    con.execute(
                        "UPDATE projects SET progress = ?, updated_at = ? WHERE id = ?",
                        (int(round(progress_percent)), timestamp, project_id),
                    )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_daily_log', 'daily_log', ?, ?, ?)
                """,
                (
                    user["id"],
                    daily_log_id,
                    json.dumps(
                        {
                            "project_id": project_id,
                            "title": title,
                            "progress_percent": progress_percent,
                            "client_request_id": client_request_id,
                            "applied_action_count": len(confirmed_actions),
                        },
                        ensure_ascii=False,
                    ),
                    timestamp,
                ),
            )
            log_row = con.execute(
                """
                SELECT l.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS author_name
                FROM daily_logs l
                LEFT JOIN users u ON u.id = l.created_by
                WHERE l.id = ?
                """,
                (daily_log_id,),
            ).fetchone()
            project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            applied_actions = daily_log_applied_actions(con, daily_log_id)
            con.commit()
    except sqlite3.IntegrityError as error:
        if client_request_id and "daily_logs.project_id, daily_logs.client_request_id" in str(error):
            if send_daily_log_replay(handler, project_id, user, client_request_id):
                return
        handler.send_json(HTTPStatus.CONFLICT, {"error": "daily_log_action_conflict"})
        return
    log_payload = dict(log_row)
    log_payload["has_applied_actions"] = 1 if applied_actions else 0
    handler.send_json(
        HTTPStatus.CREATED,
        {
            "id": daily_log_id,
            "log": log_payload,
            "project": serialize_project(project_row, user),
            "appliedActions": applied_actions,
            "idempotentReplay": False,
        },
    )


def api_delete_daily_log(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    log_id = parse_path_int(path, 4)
    if not project_id or not log_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_log_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if user["role"] in {"customer"}:
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    with db() as con:
        log_row = con.execute(
            "SELECT * FROM daily_logs WHERE id = ? AND project_id = ?",
            (log_id, project_id),
        ).fetchone()
        if not log_row:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "log_not_found"})
            return
        applied_action = con.execute(
            "SELECT 1 FROM daily_log_actions WHERE daily_log_id = ? LIMIT 1",
            (log_id,),
        ).fetchone()
        if applied_action:
            handler.send_json(
                HTTPStatus.CONFLICT,
                {"error": "daily_log_has_applied_actions"},
            )
            return
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        con.execute("DELETE FROM daily_logs WHERE id = ?", (log_id,))
        latest_progress_row = con.execute(
            """
            SELECT progress_percent
            FROM daily_logs
            WHERE project_id = ? AND progress_percent IS NOT NULL
            ORDER BY report_date DESC, id DESC
            LIMIT 1
            """,
            (project_id,),
        ).fetchone()
        if latest_progress_row and latest_progress_row["progress_percent"] is not None:
            progress_value = int(round(float(latest_progress_row["progress_percent"] or 0)))
            status_value = "completed" if progress_value >= 100 else ("active" if progress_value > 0 else None)
            if status_value:
                con.execute(
                    "UPDATE projects SET progress = ?, status = ?, updated_at = ? WHERE id = ?",
                    (progress_value, status_value, now_ts(), project_id),
                )
            else:
                con.execute(
                    "UPDATE projects SET progress = ?, updated_at = ? WHERE id = ?",
                    (progress_value, now_ts(), project_id),
                )
        else:
            current_status = str(project_row["status"] or "") if project_row else ""
            fallback_status = "Подготовка" if current_status in {"active", "completed"} else current_status
            con.execute(
                "UPDATE projects SET progress = 0, status = ?, updated_at = ? WHERE id = ?",
                (fallback_status or "Подготовка", now_ts(), project_id),
            )
        con.execute(
            """
            INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
            VALUES (?, 'delete_daily_log', 'daily_log', ?, ?, ?)
            """,
            (
                user["id"],
                log_id,
                json.dumps(
                    {
                        "project_id": project_id,
                        "title": log_row["title"],
                        "report_date": log_row["report_date"],
                        "deleted_log": dict(log_row),
                    },
                    ensure_ascii=False,
                ),
                now_ts(),
            ),
        )
        refreshed_project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        con.commit()
    handler.send_json(
        HTTPStatus.OK,
        {
            "ok": True,
            "deletedId": log_id,
            "project": serialize_project(refreshed_project, user) if refreshed_project else None,
        },
    )


def api_project_chats(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        if user["role"] == "customer":
            rows = con.execute(
                "SELECT * FROM chats WHERE project_id = ? AND chat_type = 'client' ORDER BY id",
                (project_id,),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM chats WHERE project_id = ? ORDER BY CASE chat_type WHEN 'team' THEN 0 ELSE 1 END, id",
                (project_id,),
            ).fetchall()
    handler.send_json(HTTPStatus.OK, {"chats": [dict(row) for row in rows]})


def can_access_chat(handler, user: dict, chat_id: int) -> bool:
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
    if not handler.can_access_project(user, int(row["project_id"])):
        return False
    return not (user["role"] == "customer" and row["chat_type"] != "client")


def api_chat_messages(handler, path: str) -> None:
    chat_id = parse_path_int(path, 2)
    if not chat_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_chat_id"})
        return
    user = handler.require_user()
    if not user:
        return
    if not handler.can_access_chat(user, chat_id):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "chat_forbidden"})
        return
    with db() as con:
        rows = con.execute(
            """
            SELECT m.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name, 'Система') AS author_name, COALESCE(u.role, 'system') AS author_role
            FROM chat_messages m
            LEFT JOIN users u ON u.id = m.user_id
            WHERE m.chat_id = ?
            ORDER BY m.id
            """,
            (chat_id,),
        ).fetchall()
    handler.send_json(HTTPStatus.OK, {"messages": [dict(row) for row in rows]})


def api_create_chat_message(handler, path: str) -> None:
    chat_id = parse_path_int(path, 2)
    if not chat_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_chat_id"})
        return
    user = handler.require_user()
    if not user:
        return
    if not handler.can_access_chat(user, chat_id):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "chat_forbidden"})
        return
    payload = handler.read_json()
    body = str(payload.get("body", "")).strip()
    if not body:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "body_required"})
        return
    with db() as con:
        cur = con.execute(
            "INSERT INTO chat_messages (chat_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
            (chat_id, user["id"], body, now_ts()),
        )
        con.commit()
    handler.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})
