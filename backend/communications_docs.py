from __future__ import annotations

import json
import mimetypes
import re
import secrets
import sqlite3
import time
from datetime import date, timedelta
from http import HTTPStatus
from pathlib import Path

from auth import user_can_manage_documents
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

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
TODAY_ISO = date.today().isoformat()
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def now_ts() -> int:
    return int(time.time())


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


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
    today = TODAY_ISO
    today_date = parse_iso_date(today) or date(2026, 7, 26)
    soon_limit = (today_date + timedelta(days=2)).isoformat()
    with db() as con:
        project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        open_tasks = con.execute(
            """
            SELECT t.*, u.name AS assignee_name
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
    data = {
        "today": today,
        "missingDailyReport": False if user["role"] == "customer" else not bool(latest_log and latest_log["report_date"] == today),
        "latestDailyLog": dict(latest_log) if latest_log else None,
        "overdueTasks": overdue_tasks[:8],
        "dueSoonTasks": due_soon_tasks[:8],
        "blockerLogs": [dict(row) for row in blocker_logs],
        "problemStages": problem_stages[:8],
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
                SELECT d.*, u.name AS uploaded_by_name, s.title AS stage_title
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
                SELECT d.*, u.name AS uploaded_by_name, s.title AS stage_title
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
            SELECT d.*, u.name AS uploaded_by_name, s.title AS stage_title
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
            SELECT d.*, u.name AS uploaded_by_name, s.title AS stage_title
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
    handler.send_json(HTTPStatus.OK, {"logs": [dict(row) for row in rows]})


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
    report_date = str(payload.get("report_date", "")).strip() or time.strftime("%Y-%m-%d")
    try:
        workers_count = max(0, int(payload.get("workers_count", 0) or 0))
    except (TypeError, ValueError):
        workers_count = 0
    progress_percent_raw = payload.get("progress_percent", payload.get("progressPercent"))
    try:
        progress_percent = max(0.0, min(100.0, float(progress_percent_raw))) if progress_percent_raw not in (None, "", False) else None
    except (TypeError, ValueError):
        progress_percent = None
    with db() as con:
        cur = con.execute(
            """
            INSERT INTO daily_logs (
                project_id, report_date, title, work_done, workers_count, equipment, blockers, next_steps,
                progress_percent, raw_input, is_client_visible, created_by, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                user["id"],
                now_ts(),
                now_ts(),
            ),
        )
        if progress_percent is not None:
            status = "completed" if progress_percent >= 100 else ("active" if progress_percent > 0 else None)
            if status:
                con.execute(
                    "UPDATE projects SET progress = ?, status = ?, updated_at = ? WHERE id = ?",
                    (int(round(progress_percent)), status, now_ts(), project_id),
                )
            else:
                con.execute(
                    "UPDATE projects SET progress = ?, updated_at = ? WHERE id = ?",
                    (int(round(progress_percent)), now_ts(), project_id),
                )
        con.execute(
            """
            INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
            VALUES (?, 'create_daily_log', 'daily_log', ?, ?, ?)
            """,
            (user["id"], cur.lastrowid, json.dumps({"project_id": project_id, "title": title, "progress_percent": progress_percent}, ensure_ascii=False), now_ts()),
        )
        log_row = con.execute(
            """
            SELECT l.*, u.name AS author_name
            FROM daily_logs l
            LEFT JOIN users u ON u.id = l.created_by
            WHERE l.id = ?
            """,
            (cur.lastrowid,),
        ).fetchone()
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        con.commit()
    handler.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid, "log": dict(log_row), "project": serialize_project(project_row, user)})


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
            SELECT m.*, COALESCE(u.name, 'Система') AS author_name, COALESCE(u.role, 'system') AS author_role
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
