from __future__ import annotations

import io
import json
import logging
import math
import mimetypes
import os
import re
import secrets
import sqlite3
import time
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from auth import user_can_manage_documents, user_can_manage_schedule, user_has_any_role, user_is_guest
from operational_quantities import operational_quantity_plan
from projects import serialize_project
from schedule_tasks import (
    build_procurement_alerts,
    build_section_schedule_forecast,
    classify_scope,
    material_summary_rows,
    normalize_schedule_text,
    parse_iso_date,
    recalc_project_progress,
)
from warehouse import normalize_estimate_item_kind, resolved_estimate_item_kind
from sqlite_config import connect_database

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
TODAY_ISO = date.today().isoformat()
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
DOCUMENT_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
DOCUMENT_TYPES = frozenset({
    "contract", "estimate", "project_doc", "hidden_work_act", "inspection_act",
    "executive", "technical_solution", "act", "service_act", "invoice",
    "delivery_note", "upd", "transport_waybill", "route_sheet", "cash_receipt",
    "photo_report", "letter", "correspondence", "archive", "finance", "other",
    "file",
})
DOCUMENT_STATUSES = frozenset({
    "draft", "submitted", "reviewed", "approved", "signed", "ready", "accepted",
    "internal",
})
DOCUMENT_PROTECTED_STATUSES = frozenset({
    "submitted", "reviewed", "approved", "signed", "ready", "accepted",
})
DOCUMENT_STATUS_RANK = {
    "draft": 0,
    "submitted": 1,
    "reviewed": 2,
    "approved": 3,
    "signed": 4,
    "ready": 5,
    "accepted": 5,
}
DOCUMENT_INLINE_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
    ".txt": "text/plain; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".csv": "text/plain; charset=utf-8",
}
LOGGER = logging.getLogger(__name__)

DAILY_LOG_MATERIAL_ACTION_TYPES = {
    "material_purchase": "purchase",
    "material_receipt": "receipt",
    "material_use": "use",
}
DAILY_LOG_WORK_ACTION_TYPE = "work_progress"
DAILY_LOG_WORK_QUANTITY_MODES = frozenset({"delta_qty", "target_qty", "target_percent"})

DAILY_LOG_RESOURCE_LIMIT = 40
DAILY_LOG_PHOTO_LIMIT = 8
DAILY_LOG_PHOTO_MAX_BYTES = 20 * 1024 * 1024
DAILY_LOG_PHOTO_MAX_PIXELS = 40_000_000
DAILY_LOG_PHOTO_MAX_EDGE = 1920
ATTENTION_REPORT_HOUR = 17
ATTENTION_SOON_DAYS = 3
DAILY_LOG_IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

DAILY_LOG_SECTION_PROGRESS_TITLES = {
    "Групповое завершение работ",
    "Работы раздела возвращены в работу",
    "Групповое закрытие раздела",
    "Раздел снят с выполнения",
}


def daily_log_entry_kind(row: sqlite3.Row | dict) -> str:
    """Separate authored field reports from automatic section progress events."""

    payload = dict(row)
    if bool(int(payload.get("_is_authored_report") or 0)):
        return "field_report"

    raw_input = payload.get("raw_input")
    try:
        source = json.loads(raw_input) if isinstance(raw_input, str) else raw_input
    except (TypeError, ValueError, json.JSONDecodeError):
        source = None
    if not isinstance(source, dict):
        return "field_report"

    explicit_kind = str(source.get("entry_kind") or "").strip().lower()
    completed = source.get("completed")
    item_count = source.get("items")
    has_progress_shape = (
        "section_id" in source
        and isinstance(completed, bool)
        and isinstance(item_count, (int, float))
        and not isinstance(item_count, bool)
    )
    has_progress_identity = (
        explicit_kind == "section_progress"
        or str(source.get("item_kind") or "").strip().lower() in {"work", "material"}
        or str(payload.get("title") or "").strip() in DAILY_LOG_SECTION_PROGRESS_TITLES
    )
    return "section_progress" if has_progress_shape and has_progress_identity else "field_report"


def has_daily_field_report(rows: list[sqlite3.Row | dict]) -> bool:
    """Return whether the rows contain an authored daily field report."""

    return any(daily_log_entry_kind(row) == "field_report" for row in rows)


def attention_timezone(offset_hours: object = None) -> timezone:
    """Use the configured business timezone for attention-center boundaries."""

    raw_offset = os.environ.get("PMBI_TZ_OFFSET_HOURS", "5") if offset_hours is None else offset_hours
    try:
        normalized_offset = int(raw_offset)
    except (TypeError, ValueError):
        normalized_offset = 5
    normalized_offset = max(-23, min(23, normalized_offset))
    return timezone(timedelta(hours=normalized_offset))


def build_attention_clock(
    current: datetime | None = None,
    offset_hours: object = None,
) -> dict:
    """Build stable server-side evening and midnight refresh boundaries."""

    business_timezone = attention_timezone(offset_hours)
    if current is None:
        local_now = datetime.now(business_timezone)
    elif current.tzinfo is None:
        local_now = current.replace(tzinfo=business_timezone)
    else:
        local_now = current.astimezone(business_timezone)

    evening_boundary = local_now.replace(
        hour=ATTENTION_REPORT_HOUR,
        minute=0,
        second=0,
        microsecond=0,
    )
    report_reminder_active = local_now >= evening_boundary
    if report_reminder_active:
        next_refresh = (local_now + timedelta(days=1)).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
    else:
        next_refresh = evening_boundary
    return {
        "serverNow": local_now.isoformat(timespec="seconds"),
        "today": local_now.date().isoformat(),
        "reportReminderActive": report_reminder_active,
        "nextAttentionRefreshAt": next_refresh.isoformat(timespec="seconds"),
    }


def project_requires_daily_report(
    project: sqlite3.Row | dict | None,
    user: sqlite3.Row | dict,
    today_date: date,
) -> bool:
    """Only operational, already-started projects require an evening report."""

    if not project:
        return False
    user_payload = dict(user) if user else {}
    role = str(user_payload.get("role") or "").strip().casefold()
    if role in {"customer", "client", "guest"}:
        return False
    payload = dict(project)
    status = str(payload.get("status") or "").strip().casefold().replace("ё", "е")
    if status not in {"в работе", "active", "активен", "in_progress", "in progress", "started"}:
        return False
    try:
        if float(payload.get("progress") or 0) >= 100:
            return False
    except (TypeError, ValueError):
        pass
    started_at = parse_iso_date(str(payload.get("started_at") or ""))
    return not started_at or started_at <= today_date


def project_allows_schedule_attention(project: sqlite3.Row | dict | None) -> bool:
    """Keep schedule prompts off stopped, closed, and fully completed projects."""

    if not project:
        return False
    payload = dict(project)
    status = str(payload.get("status") or "").strip().casefold().replace("ё", "е")
    inactive_statuses = {
        "завершен",
        "завершено",
        "закрыт",
        "закрыто",
        "на паузе",
        "приостановлен",
        "приостановлено",
        "отменен",
        "отменено",
        "completed",
        "complete",
        "done",
        "closed",
        "paused",
        "pause",
        "on_hold",
        "on hold",
        "cancelled",
        "canceled",
        "archived",
    }
    if status in inactive_statuses:
        return False
    try:
        return float(payload.get("progress") or 0) < 100
    except (TypeError, ValueError):
        return True


def build_schedule_alerts(
    stages: list[sqlite3.Row | dict],
    today_date: date,
    soon_days: int = ATTENTION_SOON_DAYS,
) -> list[dict]:
    """Classify the most specific actionable stages without parent duplicates."""

    stage_items = [dict(row) for row in stages]
    stage_by_id: dict[int, dict] = {}
    for item in stage_items:
        try:
            stage_id = int(item.get("id") or 0)
        except (TypeError, ValueError):
            continue
        if stage_id:
            stage_by_id[stage_id] = item

    def root_title(item: dict) -> str:
        current = item
        root = item
        seen: set[int] = set()
        while current.get("parent_id"):
            try:
                parent_id = int(current.get("parent_id") or 0)
            except (TypeError, ValueError):
                break
            if not parent_id or parent_id in seen:
                break
            seen.add(parent_id)
            parent = stage_by_id.get(parent_id)
            if not parent:
                break
            root = parent
            current = parent
        return str(root.get("title") or item.get("title") or "График работ").strip() or "График работ"

    soon_limit = today_date + timedelta(days=max(0, int(soon_days)))
    timing_rank = {
        "blocked": 0,
        "overdue": 1,
        "due_today": 2,
        "starts_today": 3,
        "today": 4,
        "soon": 5,
    }
    alerts: list[dict] = []
    for item in stage_items:
        try:
            stage_id = int(item.get("id") or 0)
        except (TypeError, ValueError):
            continue
        if not stage_id:
            continue
        status_code = str(item.get("status_code") or "").strip().casefold()
        try:
            progress = max(0, min(100, int(item.get("progress") or 0)))
        except (TypeError, ValueError):
            progress = 0
        if progress >= 100 or status_code in {"completed", "approved", "done"}:
            continue

        planned_start_text = str(item.get("planned_start") or "").strip()
        planned_end_text = str(item.get("planned_end") or "").strip()
        planned_start = parse_iso_date(planned_start_text)
        planned_end = parse_iso_date(planned_end_text)
        timing = ""
        if status_code == "blocked":
            timing = "blocked"
        elif status_code == "overdue" or (planned_end and planned_end < today_date):
            timing = "overdue"
        elif planned_end == today_date:
            timing = "due_today"
        elif planned_start == today_date and progress <= 0 and status_code not in {"started", "in_progress"}:
            timing = "starts_today"
        else:
            is_today = bool(
                (planned_start and planned_end and planned_start <= today_date <= planned_end)
                or (
                    planned_start
                    and planned_start <= today_date
                    and not planned_end
                    and (status_code in {"started", "in_progress"} or progress > 0)
                )
            )
            if is_today:
                timing = "today"
            elif planned_start and today_date < planned_start <= soon_limit:
                timing = "soon"
        if not timing:
            continue

        alerts.append(
            {
                "id": stage_id,
                "title": str(item.get("title") or "Этап работ").strip() or "Этап работ",
                "parentId": item.get("parent_id"),
                "stageKind": str(item.get("stage_kind") or "section").strip() or "section",
                "sectionTitle": root_title(item),
                "statusCode": status_code or "not_started",
                "plannedStart": planned_start_text,
                "plannedEnd": planned_end_text,
                "progress": progress,
                "responsible": str(item.get("responsible") or "").strip(),
                "timing": timing,
                "daysUntilStart": (planned_start - today_date).days if planned_start else None,
                "daysUntilEnd": (planned_end - today_date).days if planned_end else None,
            }
        )

    actionable_ids = {int(item.get("id") or 0) for item in alerts}
    alert_by_id = {int(item.get("id") or 0): item for item in alerts}
    actionable_ancestor_ids: set[int] = set()
    for alert in alerts:
        current = stage_by_id.get(int(alert.get("id") or 0))
        seen: set[int] = set()
        while current and current.get("parent_id"):
            try:
                parent_id = int(current.get("parent_id") or 0)
            except (TypeError, ValueError):
                break
            if not parent_id or parent_id in seen:
                break
            seen.add(parent_id)
            if parent_id in actionable_ids:
                parent_alert = alert_by_id[parent_id]
                parent_timing = str(parent_alert.get("timing") or "")
                descendant_timing = str(alert.get("timing") or "")
                descendant_is_at_least_as_urgent = timing_rank.get(descendant_timing, 9) <= timing_rank.get(parent_timing, 9)
                if descendant_is_at_least_as_urgent:
                    actionable_ancestor_ids.add(parent_id)
            current = stage_by_id.get(parent_id)
    alerts = [item for item in alerts if int(item.get("id") or 0) not in actionable_ancestor_ids]

    alerts.sort(
        key=lambda item: (
            timing_rank.get(str(item.get("timing") or ""), 9),
            str(item.get("plannedStart") or item.get("plannedEnd") or "9999-12-31"),
            str(item.get("title") or "").casefold(),
            int(item.get("id") or 0),
        )
    )
    return alerts


def daily_log_payload(
    row: sqlite3.Row | dict,
    *,
    guest_view: bool = False,
    authored_report: bool | None = None,
) -> dict:
    payload = dict(row)
    if authored_report is not None:
        payload["_is_authored_report"] = 1 if authored_report else 0
    payload["entry_kind"] = daily_log_entry_kind(payload)
    payload.pop("_is_authored_report", None)
    workforce = stored_daily_log_resources(payload.pop("workers_json", None), "workforce")
    equipment_entries = stored_daily_log_resources(payload.pop("equipment_json", None), "equipment")
    payload["workforce"] = workforce
    payload["equipment_entries"] = equipment_entries
    payload["worker_hours"] = round(
        sum(float(entry["count"]) * float(entry["hours"]) for entry in workforce),
        2,
    )
    payload["equipment_hours"] = round(
        sum(float(entry["count"]) * float(entry["hours"]) for entry in equipment_entries),
        2,
    )
    payload.setdefault("photos", [])
    if guest_view:
        payload.pop("raw_input", None)
        payload.pop("created_by", None)
        payload.pop("client_request_id", None)
    return payload


def normalize_daily_log_resources(
    raw_entries: object,
    kind: str,
) -> tuple[list[dict], dict | None]:
    """Validate repeatable workforce/equipment rows from a report request."""

    if raw_entries in (None, ""):
        return [], None
    if not isinstance(raw_entries, list):
        return [], {"error": f"bad_{kind}_entries"}
    if len(raw_entries) > DAILY_LOG_RESOURCE_LIMIT:
        return [], {"error": f"too_many_{kind}_entries"}

    label_key = "role" if kind == "workforce" else "name"
    normalized: list[dict] = []
    for index, raw_entry in enumerate(raw_entries):
        if not isinstance(raw_entry, dict):
            return [], {"error": f"bad_{kind}_entry", "entryIndex": index}
        label = str(
            raw_entry.get(label_key)
            or raw_entry.get("type")
            or raw_entry.get("title")
            or ""
        ).strip()
        count_raw = raw_entry.get("count", raw_entry.get("quantity", 1))
        hours_raw = raw_entry.get("hours", raw_entry.get("shift_hours", raw_entry.get("shiftHours")))
        if not label and count_raw in (None, "", 0, "0") and hours_raw in (None, "", 0, "0"):
            continue
        if not label or len(label) > 120:
            return [], {"error": f"bad_{kind}_label", "entryIndex": index}
        try:
            if isinstance(count_raw, bool) or isinstance(hours_raw, bool):
                raise ValueError
            count_number = float(count_raw)
            count = int(count_number)
            hours = float(hours_raw)
        except (TypeError, ValueError, OverflowError):
            return [], {"error": f"bad_{kind}_values", "entryIndex": index}
        if not math.isfinite(count_number) or count_number != count or count < 1 or count > 999:
            return [], {"error": f"bad_{kind}_count", "entryIndex": index}
        if not math.isfinite(hours) or hours <= 0 or hours > 24:
            return [], {"error": f"bad_{kind}_hours", "entryIndex": index}
        normalized.append({label_key: label, "count": count, "hours": round(hours, 2)})
    return normalized, None


def stored_daily_log_resources(value: object, kind: str) -> list[dict]:
    if isinstance(value, str):
        try:
            value = json.loads(value or "[]")
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
    entries, error = normalize_daily_log_resources(value if isinstance(value, list) else [], kind)
    return [] if error else entries


def daily_log_photo_payload(row: sqlite3.Row | dict) -> dict:
    item = dict(row)
    document_id = int(item["id"])
    return {
        "id": document_id,
        "title": str(item.get("title") or item.get("original_name") or "Фото отчёта"),
        "original_name": str(item.get("original_name") or ""),
        "mime_type": str(item.get("mime_type") or "image/jpeg"),
        "size_bytes": int(item.get("size_bytes") or 0),
        "view_url": f"/api/documents/{document_id}/view",
    }


def attach_daily_log_photos(
    con: sqlite3.Connection,
    logs: list[dict],
    *,
    visible_only: bool = False,
) -> None:
    log_ids = [int(log.get("id") or 0) for log in logs if int(log.get("id") or 0) > 0]
    if not log_ids:
        return
    placeholders = ",".join("?" for _ in log_ids)
    visibility_sql = "AND d.is_client_visible = 1" if visible_only else ""
    rows = con.execute(
        f"""
        SELECT link.daily_log_id, d.id, d.title, d.original_name, d.mime_type, d.size_bytes
        FROM daily_log_photos link
        JOIN documents d ON d.id = link.document_id
        WHERE link.daily_log_id IN ({placeholders})
          {visibility_sql}
        ORDER BY link.id
        """,
        log_ids,
    ).fetchall()
    photos_by_log: dict[int, list[dict]] = {log_id: [] for log_id in log_ids}
    for row in rows:
        photos_by_log.setdefault(int(row["daily_log_id"]), []).append(daily_log_photo_payload(row))
    for log in logs:
        log["photos"] = photos_by_log.get(int(log.get("id") or 0), [])


def user_can_apply_daily_log_material_actions(user: dict) -> bool:
    return user_can_manage_schedule(user) or user_has_any_role(user, {"purchaser"})


def user_can_apply_daily_log_work_actions(user: dict) -> bool:
    return user_can_manage_schedule(user)


def now_ts() -> int:
    return int(time.time())


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return connect_database(DB_PATH)


def ensure_daily_log_actions_schema(con: sqlite3.Connection) -> None:
    """Add the idempotent daily-report action journal to an existing database."""

    daily_log_columns = {
        str(row["name"])
        for row in con.execute("PRAGMA table_info(daily_logs)").fetchall()
    }
    if "client_request_id" not in daily_log_columns:
        con.execute("ALTER TABLE daily_logs ADD COLUMN client_request_id TEXT")
    if "workers_json" not in daily_log_columns:
        con.execute("ALTER TABLE daily_logs ADD COLUMN workers_json TEXT NOT NULL DEFAULT '[]'")
    if "equipment_json" not in daily_log_columns:
        con.execute("ALTER TABLE daily_logs ADD COLUMN equipment_json TEXT NOT NULL DEFAULT '[]'")

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

        CREATE TABLE IF NOT EXISTS daily_log_work_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE RESTRICT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            action_type TEXT NOT NULL CHECK(action_type = 'work_progress'),
            estimate_item_id INTEGER NOT NULL REFERENCES estimate_items(id) ON DELETE RESTRICT,
            work_title_snapshot TEXT NOT NULL,
            work_unit_snapshot TEXT NOT NULL,
            quantity_mode TEXT NOT NULL CHECK(quantity_mode IN (
                'delta_qty', 'target_qty', 'target_percent'
            )),
            input_value REAL NOT NULL CHECK(input_value > 0),
            qty REAL NOT NULL CHECK(qty > 0),
            actual_before REAL NOT NULL CHECK(actual_before >= 0),
            actual_after REAL NOT NULL CHECK(actual_after > actual_before),
            planned_qty_snapshot REAL NOT NULL CHECK(planned_qty_snapshot > 0),
            client_action_id TEXT NOT NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(project_id, client_action_id)
        );
        CREATE INDEX IF NOT EXISTS idx_daily_log_work_actions_log
            ON daily_log_work_actions(daily_log_id, id);
        CREATE INDEX IF NOT EXISTS idx_daily_log_work_actions_project_work
            ON daily_log_work_actions(project_id, estimate_item_id, id);

        CREATE TABLE IF NOT EXISTS daily_log_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            document_id INTEGER NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
            client_photo_id TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(daily_log_id, document_id)
        );
        CREATE INDEX IF NOT EXISTS idx_daily_log_photos_log
            ON daily_log_photos(daily_log_id, id);
        CREATE INDEX IF NOT EXISTS idx_daily_log_photos_document
            ON daily_log_photos(document_id);
        CREATE TRIGGER IF NOT EXISTS trg_daily_log_photos_document_unique
        BEFORE INSERT ON daily_log_photos
        WHEN EXISTS (
            SELECT 1 FROM daily_log_photos existing
            WHERE existing.document_id = NEW.document_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'daily_log_photo_document_in_use');
        END;
        CREATE TRIGGER IF NOT EXISTS trg_daily_log_photos_document_update_unique
        BEFORE UPDATE OF document_id ON daily_log_photos
        WHEN NEW.document_id <> OLD.document_id AND EXISTS (
            SELECT 1 FROM daily_log_photos existing
            WHERE existing.document_id = NEW.document_id
              AND existing.id <> OLD.id
        )
        BEGIN
            SELECT RAISE(ABORT, 'daily_log_photo_document_in_use');
        END;
        """
    )
    daily_log_photo_columns = {
        str(row["name"])
        for row in con.execute("PRAGMA table_info(daily_log_photos)").fetchall()
    }
    if "client_photo_id" not in daily_log_photo_columns:
        con.execute("ALTER TABLE daily_log_photos ADD COLUMN client_photo_id TEXT")
    con.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_log_photos_client_id
        ON daily_log_photos(daily_log_id, client_photo_id)
        WHERE client_photo_id IS NOT NULL
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


def document_inline_content_type(row: sqlite3.Row | dict) -> str | None:
    item = dict(row)
    extension = str(item.get("file_ext") or "").strip().lower()
    if not extension:
        extension = document_extension(str(item.get("original_name") or ""))
    return DOCUMENT_INLINE_CONTENT_TYPES.get(extension)


def resolve_document_storage_path(project_id: int, storage_path: str) -> Path:
    candidate = Path(storage_path)
    file_path = (candidate if candidate.is_absolute() else PROJECT_ROOT / candidate).resolve()
    documents_root = DOCUMENTS_DIR.resolve()
    allowed_directory = (DOCUMENTS_DIR / f"project_{project_id}").resolve()
    allowed_directory.relative_to(documents_root)
    file_path.relative_to(allowed_directory)
    return file_path


def document_payload(row: sqlite3.Row | dict) -> dict:
    item = dict(row)
    item["download_url"] = f"/api/documents/{item['id']}/download"
    item["view_url"] = f"/api/documents/{item['id']}/view"
    item["can_preview"] = bool(item.get("storage_path")) and bool(document_inline_content_type(item))
    return item


def document_reference_summary(con: sqlite3.Connection, document_id: int) -> list[dict]:
    """Find every live foreign-key reference before destructive deletion."""

    references: list[dict] = []
    tables = con.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    for table_row in tables:
        table_name = str(table_row["name"])
        quoted_table = '"' + table_name.replace('"', '""') + '"'
        for foreign_key in con.execute(f"PRAGMA foreign_key_list({quoted_table})").fetchall():
            if str(foreign_key["table"]) != "documents":
                continue
            column_name = str(foreign_key["from"])
            quoted_column = '"' + column_name.replace('"', '""') + '"'
            count = int(
                con.execute(
                    f"SELECT COUNT(*) FROM {quoted_table} WHERE {quoted_column} = ?",
                    (document_id,),
                ).fetchone()[0]
            )
            if count:
                references.append({"table": table_name, "column": column_name, "count": count})
    return references


def record_document_file_cleanup_failure(
    *,
    user_id: int,
    document_id: int,
    project_id: int,
    storage_path: str,
    error: BaseException,
) -> None:
    LOGGER.warning(
        "Document %s was deleted but its managed file could not be removed",
        document_id,
        exc_info=(type(error), error, error.__traceback__),
    )
    try:
        with db() as con:
            create_audit(
                con,
                user_id,
                "document_file_cleanup_failed",
                "document",
                document_id,
                {
                    "project_id": project_id,
                    "storage_path": storage_path,
                    "error": type(error).__name__,
                },
            )
            con.commit()
    except (OSError, sqlite3.Error):
        LOGGER.exception("Could not audit file cleanup failure for document %s", document_id)


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
    return str(status or "").strip() in {"reviewed", "approved", "signed", "ready", "accepted"}


def api_project_notifications(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    attention_clock = build_attention_clock()
    today = str(attention_clock["today"])
    today_date = parse_iso_date(today) or date.today()
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
        today_logs = con.execute(
            """
            SELECT l.*,
                   EXISTS(
                       SELECT 1 FROM audit_log authored
                       WHERE authored.action = 'create_daily_log'
                         AND authored.entity = 'daily_log'
                         AND authored.entity_id = l.id
                   ) AS _is_authored_report
            FROM daily_logs l
            WHERE l.project_id = ? AND l.report_date = ?
            ORDER BY l.id DESC
            """,
            (project_id, today),
        ).fetchall()
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
    schedule_alerts = build_schedule_alerts(stage_items, today_date) if project_allows_schedule_attention(project) else []
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
    daily_report_required = project_requires_daily_report(project, user, today_date)
    missing_daily_report = daily_report_required and not has_daily_field_report(today_logs)
    data = {
        "today": today,
        "serverNow": attention_clock["serverNow"],
        "reportReminderActive": bool(missing_daily_report and attention_clock["reportReminderActive"]),
        "nextAttentionRefreshAt": attention_clock["nextAttentionRefreshAt"],
        "missingDailyReport": missing_daily_report,
        "latestDailyLog": dict(latest_log) if latest_log else None,
        "overdueTasks": overdue_tasks[:8],
        "dueSoonTasks": due_soon_tasks[:8],
        "blockerLogs": [dict(row) for row in blocker_logs],
        "problemStages": problem_stages[:8],
        "scheduleAlerts": schedule_alerts,
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
        documents.append(document_payload(row))
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

    item = document_payload(row)
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

    doc_type = (str(form.getfirst("doc_type", "file")).strip() or "file").lower()
    status = (str(form.getfirst("status", "draft")).strip() or "draft").lower()
    if doc_type not in DOCUMENT_TYPES:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_type"})
        return
    if status not in DOCUMENT_STATUSES:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_status"})
        return
    is_client_visible = 1 if str(form.getfirst("is_client_visible", "0")).strip() in {"1", "true", "yes", "on"} else 0
    title = str(form.getfirst("title", "")).strip() or Path(original_name).stem
    notes = str(form.getfirst("notes", "")).strip() or None
    if len(title) > 240:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_title_too_long"})
        return
    if notes and len(notes) > 4000:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_notes_too_long"})
        return
    raw_stage_id = str(form.getfirst("stage_id", "0")).strip()
    try:
        stage_id = int(raw_stage_id or "0") or None
    except ValueError:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
        return
    if stage_id is not None and stage_id < 0:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
        return
    template_code = str(form.getfirst("template_code", "")).strip() or None
    file_ext = document_extension(original_name)
    mime_type = upload.type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    storage_name = f"{now_ts()}_{secrets.token_hex(8)}{file_ext}"
    file_path = project_documents_dir(project_id) / storage_name

    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        stage = None
        if stage_id is not None:
            stage = con.execute(
                "SELECT * FROM work_stages WHERE id = ? AND project_id = ?",
                (stage_id, project_id),
            ).fetchone()
            if not stage:
                con.rollback()
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_stage_not_found"})
                return
        if template_code:
            template = EXECUTIVE_TEMPLATE_RULES.get(template_code)
            allowed_template_codes = {
                item["code"] for item in executive_templates_for_stage(stage)
            } if stage else set()
            if (
                not stage
                or not template
                or str(template["doc_type"]) != doc_type
                or template_code not in allowed_template_codes
            ):
                con.rollback()
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_template"})
                return

        try:
            file_path.write_bytes(raw)
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
                    stage_id,
                    template_code,
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
        except Exception:
            con.rollback()
            try:
                if file_path.is_file():
                    file_path.unlink()
            except OSError:
                LOGGER.exception("Could not clean up failed upload for project %s", project_id)
            raise

    item = document_payload(row)
    handler.send_json(HTTPStatus.CREATED, {"document": item})


def api_update_document(handler, path: str) -> None:
    document_id = parse_path_int(path, 2)
    if not document_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_id"})
        return
    user = handler.require_user()
    if not user:
        return

    payload = handler.read_json()
    if not isinstance(payload, dict):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_payload_must_be_object"})
        return
    immutable_fields = {
        "id", "project_id", "projectId", "uploaded_by", "uploadedBy",
        "original_name", "originalName", "storage_name", "storageName",
        "storage_path", "storagePath", "mime_type", "mimeType", "file_ext",
        "fileExt", "size_bytes", "sizeBytes", "template_code", "templateCode",
        "generated_by_system", "generatedBySystem", "created_at", "createdAt",
    }
    if any(field in payload for field in immutable_fields):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "immutable_document_field"})
        return

    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not row:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "document_not_found"})
            return
        project_id = int(row["project_id"])
        if not handler.can_access_project(user, project_id):
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
            return
        if not user_can_manage_documents(user):
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return

        title = str(payload.get("title", row["title"]) or "").strip()
        if not title:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_title_required"})
            return
        if len(title) > 240:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_title_too_long"})
            return

        current_doc_type = str(row["doc_type"] or "").strip().lower()
        current_status = str(row["status"] or "").strip().lower()
        doc_type = str(payload.get("doc_type", payload.get("docType", current_doc_type)) or "").strip().lower()
        status = str(payload.get("status", current_status) or "").strip().lower()
        if (
            not DOCUMENT_CODE_RE.fullmatch(doc_type)
            or (doc_type not in DOCUMENT_TYPES and doc_type != current_doc_type)
        ):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_type"})
            return
        if (
            not DOCUMENT_CODE_RE.fullmatch(status)
            or (status not in DOCUMENT_STATUSES and status != current_status)
        ):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_status"})
            return

        if current_status in DOCUMENT_PROTECTED_STATUSES:
            if doc_type != current_doc_type:
                handler.send_json(HTTPStatus.CONFLICT, {"error": "document_classification_locked"})
                return
            current_rank = DOCUMENT_STATUS_RANK[current_status]
            next_rank = DOCUMENT_STATUS_RANK.get(status)
            if next_rank is None or next_rank < current_rank:
                handler.send_json(HTTPStatus.CONFLICT, {"error": "document_status_regression"})
                return

        notes_value = payload.get("notes", row["notes"])
        notes = str(notes_value or "").strip() or None
        if notes and len(notes) > 4000:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_notes_too_long"})
            return

        visibility_key = "is_client_visible" if "is_client_visible" in payload else "isClientVisible"
        if visibility_key in payload:
            visibility_value = payload[visibility_key]
            if not isinstance(visibility_value, bool):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_visibility"})
                return
            is_client_visible = 1 if visibility_value else 0
        else:
            is_client_visible = int(row["is_client_visible"] or 0)

        stage_key = "stage_id" if "stage_id" in payload else "stageId"
        if stage_key in payload:
            raw_stage_id = payload[stage_key]
            if raw_stage_id is None or raw_stage_id == "" or raw_stage_id == 0 or raw_stage_id == "0":
                stage_id = None
            else:
                try:
                    stage_id = int(raw_stage_id)
                except (TypeError, ValueError):
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
                    return
                if stage_id <= 0:
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
                    return
                stage = con.execute(
                    "SELECT 1 FROM work_stages WHERE id = ? AND project_id = ?",
                    (stage_id, project_id),
                ).fetchone()
                if not stage:
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "document_stage_not_found"})
                    return
        else:
            stage_id = row["stage_id"]

        before = {
            "title": row["title"],
            "doc_type": row["doc_type"],
            "status": row["status"],
            "notes": row["notes"],
            "is_client_visible": int(row["is_client_visible"] or 0),
            "stage_id": row["stage_id"],
        }
        after = {
            "title": title,
            "doc_type": doc_type,
            "status": status,
            "notes": notes,
            "is_client_visible": is_client_visible,
            "stage_id": stage_id,
        }
        if doc_type != current_doc_type or status != current_status:
            references = document_reference_summary(con, document_id)
            if references:
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {
                        "error": "document_classification_in_use",
                        "reference_count": sum(int(item["count"]) for item in references),
                    },
                )
                return
        timestamp = now_ts()
        con.execute(
            """
            UPDATE documents
            SET title = ?, doc_type = ?, status = ?, notes = ?,
                is_client_visible = ?, stage_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                title, doc_type, status, notes, is_client_visible,
                stage_id, timestamp, document_id,
            ),
        )
        create_audit(
            con,
            user["id"],
            "update_document",
            "document",
            document_id,
            {"project_id": project_id, "before": before, "after": after},
        )
        updated = con.execute(
            """
            SELECT d.*, COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS uploaded_by_name, s.title AS stage_title
            FROM documents d
            LEFT JOIN users u ON u.id = d.uploaded_by
            LEFT JOIN work_stages s ON s.id = d.stage_id
            WHERE d.id = ?
            """,
            (document_id,),
        ).fetchone()
        con.commit()

    handler.send_json(HTTPStatus.OK, {"document": document_payload(updated)})


def api_delete_document(handler, path: str) -> None:
    document_id = parse_path_int(path, 2)
    if not document_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_id"})
        return
    user = handler.require_user()
    if not user:
        return

    deleted: dict | None = None
    remaining_storage_paths: list[str] = []
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not row:
            con.rollback()
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "document_not_found"})
            return
        project_id = int(row["project_id"])
        if not handler.can_access_project(user, project_id):
            con.rollback()
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
            return
        if not user_can_manage_documents(user):
            con.rollback()
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return

        if str(row["status"] or "").strip().lower() != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "document_not_deletable"})
            return

        references = document_reference_summary(con, document_id)
        if references:
            con.rollback()
            handler.send_json(
                HTTPStatus.CONFLICT,
                {
                    "error": "document_in_use",
                    "reference_count": sum(int(item["count"]) for item in references),
                },
            )
            return

        deleted = dict(row)
        remaining_storage_paths = [
            str(item["storage_path"])
            for item in con.execute(
                """
                SELECT storage_path
                FROM documents
                WHERE id <> ? AND TRIM(COALESCE(storage_path, '')) <> ''
                """,
                (document_id,),
            ).fetchall()
        ]
        create_audit(
            con,
            user["id"],
            "delete_document",
            "document",
            document_id,
            {
                "project_id": project_id,
                "deleted_document": {
                    "title": row["title"],
                    "doc_type": row["doc_type"],
                    "status": row["status"],
                    "original_name": row["original_name"],
                    "storage_path": row["storage_path"],
                    "is_client_visible": int(row["is_client_visible"] or 0),
                },
            },
        )
        try:
            con.execute("DELETE FROM documents WHERE id = ?", (document_id,))
            con.commit()
        except sqlite3.IntegrityError:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "document_in_use"})
            return

    file_deleted = False
    file_cleanup_failed = False
    storage_path = str((deleted or {}).get("storage_path") or "").strip()
    if storage_path:
        try:
            file_path = resolve_document_storage_path(project_id, storage_path)
        except (OSError, RuntimeError, ValueError) as error:
            file_cleanup_failed = True
            record_document_file_cleanup_failure(
                user_id=user["id"],
                document_id=document_id,
                project_id=project_id,
                storage_path=storage_path,
                error=error,
            )
        else:
            shared_file = False
            for other_storage_path in remaining_storage_paths:
                try:
                    other_candidate = Path(other_storage_path)
                    other_file_path = (
                        other_candidate if other_candidate.is_absolute() else PROJECT_ROOT / other_candidate
                    ).resolve()
                except (OSError, RuntimeError, ValueError):
                    continue
                if other_file_path == file_path:
                    shared_file = True
                    break
            if not shared_file:
                try:
                    if file_path.is_file():
                        file_path.unlink()
                        file_deleted = True
                except OSError as error:
                    file_cleanup_failed = True
                    record_document_file_cleanup_failure(
                        user_id=user["id"],
                        document_id=document_id,
                        project_id=project_id,
                        storage_path=storage_path,
                        error=error,
                    )

    handler.send_json(
        HTTPStatus.OK,
        {
            "ok": True,
            "deleted_id": document_id,
            "project_id": project_id,
            "file_deleted": file_deleted,
            "file_cleanup_failed": file_cleanup_failed,
        },
    )


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
        guest_report_photo = None
        if row and user_is_guest(user):
            guest_report_photo = con.execute(
                """
                SELECT 1
                FROM daily_log_photos photo
                JOIN daily_logs log ON log.id = photo.daily_log_id
                WHERE photo.document_id = ?
                  AND photo.project_id = ?
                  AND log.project_id = photo.project_id
                  AND log.is_client_visible = 1
                LIMIT 1
                """,
                (document_id, int(row["project_id"])),
            ).fetchone()
    if not row:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "document_not_found"})
        return
    project_id = int(row["project_id"])
    if not handler.can_access_project(user, project_id):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
        return
    if user_is_guest(user) and not guest_report_photo:
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
        return
    if (user["role"] == "customer" or user_is_guest(user)) and int(row["is_client_visible"] or 0) != 1:
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
        return
    storage_path = row["storage_path"]
    if not storage_path:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "file_not_uploaded"})
        return
    try:
        file_path = resolve_document_storage_path(project_id, str(storage_path))
    except (OSError, RuntimeError, ValueError):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "document_forbidden"})
        return
    if not file_path.is_file():
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "file_missing"})
        return
    inline_content_type = document_inline_content_type(row)
    serve_inline = bool(inline and inline_content_type)
    handler.send_file(
        file_path,
        inline_content_type if serve_inline else "application/octet-stream",
        str(row["original_name"] or row["title"] or f"document-{document_id}"),
        inline=serve_inline,
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
        if user_is_guest(user):
            rows = con.execute(
                """
                SELECT l.id, l.project_id, l.report_date, l.title, l.work_done,
                       l.workers_count, l.equipment, l.blockers, l.next_steps,
                       l.progress_percent, l.raw_input, l.is_client_visible,
                       l.workers_json, l.equipment_json,
                       l.created_at, l.updated_at,
                       'Команда объекта' AS author_name,
                       (
                           EXISTS(SELECT 1 FROM daily_log_actions action WHERE action.daily_log_id = l.id)
                           OR EXISTS(SELECT 1 FROM daily_log_work_actions action WHERE action.daily_log_id = l.id)
                       ) AS has_applied_actions,
                       EXISTS(
                           SELECT 1 FROM audit_log authored
                           WHERE authored.action = 'create_daily_log'
                             AND authored.entity = 'daily_log'
                             AND authored.entity_id = l.id
                       ) AS _is_authored_report
                FROM daily_logs l
                WHERE l.project_id = ? AND l.is_client_visible = 1
                ORDER BY l.report_date DESC, l.id DESC
                """,
                (project_id,),
            ).fetchall()
        elif user["role"] == "customer":
            rows = con.execute(
                """
                SELECT l.*,
                       COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.name) AS author_name,
                       (
                           EXISTS(SELECT 1 FROM daily_log_actions action WHERE action.daily_log_id = l.id)
                           OR EXISTS(SELECT 1 FROM daily_log_work_actions action WHERE action.daily_log_id = l.id)
                       ) AS has_applied_actions,
                       EXISTS(
                           SELECT 1 FROM audit_log authored
                           WHERE authored.action = 'create_daily_log'
                             AND authored.entity = 'daily_log'
                             AND authored.entity_id = l.id
                       ) AS _is_authored_report
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
                       (
                           EXISTS(SELECT 1 FROM daily_log_actions action WHERE action.daily_log_id = l.id)
                           OR EXISTS(SELECT 1 FROM daily_log_work_actions action WHERE action.daily_log_id = l.id)
                       ) AS has_applied_actions,
                       EXISTS(
                           SELECT 1 FROM audit_log authored
                           WHERE authored.action = 'create_daily_log'
                             AND authored.entity = 'daily_log'
                             AND authored.entity_id = l.id
                       ) AS _is_authored_report
                FROM daily_logs l
                LEFT JOIN users u ON u.id = l.created_by
                WHERE l.project_id = ?
                ORDER BY l.report_date DESC, l.id DESC
                """,
                (project_id,),
            ).fetchall()
        guest_view = user_is_guest(user)
        restricted_view = guest_view or user["role"] == "customer"
        log_payloads = [daily_log_payload(row, guest_view=restricted_view) for row in rows]
        attach_daily_log_photos(
            con,
            log_payloads,
            visible_only=restricted_view,
        )
    handler.send_json(
        HTTPStatus.OK,
        {"logs": log_payloads},
    )


def normalize_daily_log_client_id(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    if len(text) > 200 or any(ord(character) < 32 for character in text):
        return None
    return text


def normalize_confirmed_actions(
    payload: dict,
) -> tuple[list[dict], list[dict], dict | None]:
    raw_actions = payload.get("confirmed_actions", payload.get("confirmedActions", []))
    if raw_actions is None:
        raw_actions = []
    if not isinstance(raw_actions, list):
        return [], [], {"error": "bad_confirmed_actions"}
    if len(raw_actions) > 100:
        return [], [], {"error": "too_many_confirmed_actions"}

    material_actions: list[dict] = []
    work_actions: list[dict] = []
    seen_client_ids: set[str] = set()
    for index, raw_action in enumerate(raw_actions):
        if not isinstance(raw_action, dict):
            return [], [], {"error": "bad_confirmed_action", "actionIndex": index}
        action_type = str(
            raw_action.get("action_type", raw_action.get("actionType", raw_action.get("type", "")))
            or ""
        ).strip()
        if action_type not in DAILY_LOG_MATERIAL_ACTION_TYPES and action_type != DAILY_LOG_WORK_ACTION_TYPE:
            return [], [], {"error": "bad_confirmed_action_type", "actionIndex": index}
        client_action_raw = raw_action.get("client_action_id", raw_action.get("clientActionId"))
        client_action_id = normalize_daily_log_client_id(client_action_raw)
        if not client_action_id:
            return [], [], {"error": "bad_client_action_id", "actionIndex": index}
        if client_action_id in seen_client_ids:
            return [], [], {"error": "duplicate_client_action_id", "actionIndex": index}
        seen_client_ids.add(client_action_id)
        estimate_item_raw = raw_action.get("estimate_item_id", raw_action.get("estimateItemId"))
        try:
            if isinstance(estimate_item_raw, bool):
                raise ValueError
            estimate_item_id = int(estimate_item_raw)
        except (TypeError, ValueError, OverflowError):
            return [], [], {"error": "bad_confirmed_action_values", "actionIndex": index}
        if estimate_item_id <= 0:
            return [], [], {"error": "bad_estimate_item_id", "actionIndex": index}

        if action_type in DAILY_LOG_MATERIAL_ACTION_TYPES:
            qty_raw = raw_action.get("qty", raw_action.get("quantity"))
            try:
                if isinstance(qty_raw, bool):
                    raise ValueError
                qty = float(qty_raw)
            except (TypeError, ValueError, OverflowError):
                return [], [], {"error": "bad_confirmed_action_values", "actionIndex": index}
            if not math.isfinite(qty) or qty <= 0:
                return [], [], {"error": "bad_qty", "actionIndex": index}
            material_actions.append(
                {
                    "action_type": action_type,
                    "move_type": DAILY_LOG_MATERIAL_ACTION_TYPES[action_type],
                    "estimate_item_id": estimate_item_id,
                    "qty": qty,
                    "client_action_id": client_action_id,
                    "action_index": index,
                }
            )
            continue

        quantity_mode = str(
            raw_action.get("quantity_mode", raw_action.get("quantityMode", "")) or ""
        ).strip()
        if quantity_mode not in DAILY_LOG_WORK_QUANTITY_MODES:
            return [], [], {
                "error": "bad_work_quantity_mode",
                "actionIndex": index,
            }
        input_raw = next(
            (
                raw_action[key]
                for key in ("input_value", "inputValue", "qty", "value", "quantity")
                if key in raw_action
            ),
            None,
        )
        try:
            if isinstance(input_raw, bool):
                raise ValueError
            input_value = float(input_raw)
        except (TypeError, ValueError, OverflowError):
            return [], [], {"error": "bad_work_input_value", "actionIndex": index}
        if not math.isfinite(input_value) or input_value <= 0:
            return [], [], {"error": "bad_work_input_value", "actionIndex": index}
        if quantity_mode == "target_percent" and input_value > 100:
            return [], [], {"error": "bad_work_percent", "actionIndex": index}
        work_actions.append(
            {
                "action_type": DAILY_LOG_WORK_ACTION_TYPE,
                "estimate_item_id": estimate_item_id,
                "quantity_mode": quantity_mode,
                "input_value": input_value,
                "client_action_id": client_action_id,
                "action_index": index,
            }
        )
    return material_actions, work_actions, None


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
    actions = [
        {
            "id": int(row["id"]),
            "kind": "material",
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
    work_rows = con.execute(
        """
        SELECT id, action_type, estimate_item_id, work_title_snapshot,
               work_unit_snapshot, quantity_mode, input_value, qty,
               actual_before, actual_after, planned_qty_snapshot,
               client_action_id
        FROM daily_log_work_actions
        WHERE daily_log_id = ?
        ORDER BY id
        """,
        (daily_log_id,),
    ).fetchall()
    actions.extend(
        {
            "id": int(row["id"]),
            "kind": "work",
            "type": str(row["action_type"]),
            "estimateItemId": int(row["estimate_item_id"]),
            "workTitle": str(row["work_title_snapshot"]),
            "unit": str(row["work_unit_snapshot"]),
            "quantityMode": str(row["quantity_mode"]),
            "inputValue": float(row["input_value"]),
            "qty": float(row["qty"]),
            "actualBefore": float(row["actual_before"]),
            "actualAfter": float(row["actual_after"]),
            "plannedQty": float(row["planned_qty_snapshot"]),
            "clientActionId": str(row["client_action_id"]),
        }
        for row in work_rows
    )
    return actions


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
        log_payload = daily_log_payload(log_row, authored_report=True)
        attach_daily_log_photos(
            con,
            [log_payload],
            visible_only=user_is_guest(user) or user["role"] == "customer",
        )
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
    if user["role"] in {"customer"} or user_is_guest(user):
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
    confirmed_actions, confirmed_work_actions, actions_error = normalize_confirmed_actions(payload)
    if actions_error:
        handler.send_json(HTTPStatus.BAD_REQUEST, actions_error)
        return
    if confirmed_actions and not user_can_apply_daily_log_material_actions(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "daily_log_actions_forbidden"})
        return
    if confirmed_work_actions and not user_can_apply_daily_log_work_actions(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "daily_log_work_actions_forbidden"})
        return
    report_date = str(payload.get("report_date", "")).strip() or str(build_attention_clock()["today"])
    parsed_report_date = parse_iso_date(report_date)
    if not parsed_report_date or parsed_report_date.isoformat() != report_date:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_report_date"})
        return
    try:
        workers_count = max(0, int(payload.get("workers_count", 0) or 0))
    except (TypeError, ValueError):
        workers_count = 0
    workforce, workforce_error = normalize_daily_log_resources(
        payload.get("workforce", payload.get("worker_entries", payload.get("workerEntries"))),
        "workforce",
    )
    if workforce_error:
        handler.send_json(HTTPStatus.BAD_REQUEST, workforce_error)
        return
    equipment_entries, equipment_error = normalize_daily_log_resources(
        payload.get("equipment_entries", payload.get("equipmentEntries")),
        "equipment",
    )
    if equipment_error:
        handler.send_json(HTTPStatus.BAD_REQUEST, equipment_error)
        return
    if workforce:
        workers_count = sum(int(entry["count"]) for entry in workforce)
    equipment_text = str(payload.get("equipment", "")).strip()
    if equipment_entries:
        equipment_text = "; ".join(
            f"{entry['name']} — {entry['count']} ед., {entry['hours']:g} ч"
            for entry in equipment_entries
        )
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
            work_ids = sorted({int(action["estimate_item_id"]) for action in confirmed_work_actions})
            material_by_id: dict[int, sqlite3.Row] = {}
            work_by_id: dict[int, sqlite3.Row] = {}
            material_summary_by_id = {
                int(item["id"]): item
                for item in material_summary_rows(con, project_id)
            } if material_ids else {}
            if material_ids:
                placeholders = ",".join("?" for _ in material_ids)
                rows = con.execute(
                    f"""
                    SELECT id, title, unit, item_kind, item_kind_override,
                           COALESCE(is_deleted, 0) AS is_deleted
                    FROM estimate_items
                    WHERE project_id = ? AND id IN ({placeholders})
                    """,
                    (project_id, *material_ids),
                ).fetchall()
                material_by_id = {int(row["id"]): row for row in rows}
            if work_ids:
                placeholders = ",".join("?" for _ in work_ids)
                rows = con.execute(
                    f"""
                    SELECT id, title, unit, item_kind, item_kind_override,
                           planned_qty, actual_qty,
                           is_completed, COALESCE(is_deleted, 0) AS is_deleted
                    FROM estimate_items
                    WHERE project_id = ? AND id IN ({placeholders})
                    """,
                    (project_id, *work_ids),
                ).fetchall()
                work_by_id = {int(row["id"]): row for row in rows}

            client_action_ids = [
                str(action["client_action_id"])
                for action in (*confirmed_actions, *confirmed_work_actions)
            ]
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
                if not duplicate:
                    duplicate = con.execute(
                        f"""
                        SELECT client_action_id
                        FROM daily_log_work_actions
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
                if normalize_estimate_item_kind(resolved_estimate_item_kind(material)) == "work":
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

            work_quantity_state: dict[int, dict] = {}
            for work_id in work_ids:
                work = work_by_id.get(work_id)
                if not work or int(work["is_deleted"] or 0) == 1:
                    action = next(
                        item for item in confirmed_work_actions
                        if int(item["estimate_item_id"]) == work_id
                    )
                    handler.send_json(
                        HTTPStatus.BAD_REQUEST,
                        {
                            "error": "estimate_item_project_mismatch",
                            "actionIndex": int(action["action_index"]),
                        },
                    )
                    return
                if normalize_estimate_item_kind(resolved_estimate_item_kind(work)) != "work":
                    action = next(
                        item for item in confirmed_work_actions
                        if int(item["estimate_item_id"]) == work_id
                    )
                    handler.send_json(
                        HTTPStatus.BAD_REQUEST,
                        {
                            "error": "estimate_item_not_work",
                            "actionIndex": int(action["action_index"]),
                        },
                    )
                    return
                plan = operational_quantity_plan(work["planned_qty"], work["unit"])
                planned_qty = float(plan["total_qty"] or 0)
                if planned_qty <= 0:
                    action = next(
                        item for item in confirmed_work_actions
                        if int(item["estimate_item_id"]) == work_id
                    )
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "daily_log_work_action_no_quantity_limit",
                            "actionIndex": int(action["action_index"]),
                        },
                    )
                    return
                current_qty = (
                    planned_qty
                    if int(work["is_completed"] or 0) == 1
                    else max(float(work["actual_qty"] or 0), 0)
                )
                work_quantity_state[work_id] = {
                    "planned": planned_qty,
                    "current": min(current_qty, planned_qty),
                    "unit": str(plan["unit"] or work["unit"] or ""),
                }

            for action in confirmed_work_actions:
                work_id = int(action["estimate_item_id"])
                values = work_quantity_state[work_id]
                planned_qty = float(values["planned"])
                current_qty = float(values["current"])
                input_value = float(action["input_value"])
                quantity_mode = str(action["quantity_mode"])
                if quantity_mode == "delta_qty":
                    requested_qty = input_value
                elif quantity_mode == "target_qty":
                    requested_qty = input_value - current_qty
                else:
                    requested_qty = planned_qty * input_value / 100.0 - current_qty
                allowed_qty = max(planned_qty - current_qty, 0)
                if requested_qty <= 1e-9:
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "daily_log_work_action_no_positive_delta",
                            "actionIndex": int(action["action_index"]),
                            "currentQty": current_qty,
                            "plannedQty": planned_qty,
                        },
                    )
                    return
                if requested_qty > allowed_qty + 1e-9:
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "daily_log_work_action_qty_exceeds_limit",
                            "actionIndex": int(action["action_index"]),
                            "allowedQty": allowed_qty,
                            "currentQty": current_qty,
                            "plannedQty": planned_qty,
                        },
                    )
                    return
                actual_after = min(current_qty + requested_qty, planned_qty)
                applied_qty = actual_after - current_qty
                action["qty"] = applied_qty
                action["actual_before"] = current_qty
                action["actual_after"] = actual_after
                action["planned_qty"] = planned_qty
                action["unit"] = values["unit"]
                values["current"] = actual_after

            cur = con.execute(
                """
                INSERT INTO daily_logs (
                    project_id, report_date, title, work_done, workers_count, equipment, blockers, next_steps,
                    progress_percent, raw_input, is_client_visible, client_request_id,
                    workers_json, equipment_json, created_by, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    report_date,
                    title,
                    work_done,
                    workers_count,
                    equipment_text,
                    str(payload.get("blockers", "")).strip(),
                    str(payload.get("next_steps", "")).strip(),
                    progress_percent,
                    str(payload.get("raw_input", payload.get("rawInput", ""))).strip() or None,
                    1 if payload.get("is_client_visible", True) else 0,
                    client_request_id,
                    json.dumps(workforce, ensure_ascii=False),
                    json.dumps(equipment_entries, ensure_ascii=False),
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

            for action in confirmed_work_actions:
                work = work_by_id[int(action["estimate_item_id"])]
                actual_after = float(action["actual_after"])
                planned_qty = float(action["planned_qty"])
                con.execute(
                    """
                    UPDATE estimate_items
                    SET actual_qty = ?, is_completed = ?, updated_at = ?
                    WHERE id = ? AND project_id = ?
                    """,
                    (
                        actual_after,
                        1 if actual_after >= planned_qty - 1e-9 else 0,
                        timestamp,
                        int(action["estimate_item_id"]),
                        project_id,
                    ),
                )
                action_cur = con.execute(
                    """
                    INSERT INTO daily_log_work_actions (
                        daily_log_id, project_id, action_type, estimate_item_id,
                        work_title_snapshot, work_unit_snapshot,
                        quantity_mode, input_value, qty, actual_before,
                        actual_after, planned_qty_snapshot, client_action_id,
                        created_by, created_at
                    )
                    VALUES (?, ?, 'work_progress', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        daily_log_id,
                        project_id,
                        int(action["estimate_item_id"]),
                        str(work["title"] or ""),
                        str(action["unit"] or work["unit"] or ""),
                        str(action["quantity_mode"]),
                        float(action["input_value"]),
                        float(action["qty"]),
                        float(action["actual_before"]),
                        actual_after,
                        planned_qty,
                        str(action["client_action_id"]),
                        user["id"],
                        timestamp,
                    ),
                )
                con.execute(
                    """
                    INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                    VALUES (?, 'apply_daily_log_work_action', 'daily_log_work_action', ?, ?, ?)
                    """,
                    (
                        user["id"],
                        int(action_cur.lastrowid),
                        json.dumps(
                            {
                                "project_id": project_id,
                                "daily_log_id": daily_log_id,
                                "action_type": DAILY_LOG_WORK_ACTION_TYPE,
                                "estimate_item_id": action["estimate_item_id"],
                                "quantity_mode": action["quantity_mode"],
                                "input_value": action["input_value"],
                                "qty": action["qty"],
                                "actual_before": action["actual_before"],
                                "actual_after": action["actual_after"],
                                "planned_qty": action["planned_qty"],
                                "client_action_id": action["client_action_id"],
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
            if confirmed_work_actions:
                recalc_project_progress(con, project_id)
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
                            "applied_action_count": len(confirmed_actions) + len(confirmed_work_actions),
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
    log_payload = daily_log_payload(log_row, authored_report=True)
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


def daily_log_image_type(raw: bytes) -> tuple[str, str] | None:
    if raw.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return None


def compress_daily_log_image(raw: bytes) -> bytes | None:
    """Decode, orient, resize and strip metadata from a field-report photo."""

    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.width <= 0 or source.height <= 0:
                return None
            if source.width * source.height > DAILY_LOG_PHOTO_MAX_PIXELS:
                return None
            source.load()
            image = ImageOps.exif_transpose(source)
            image.thumbnail(
                (DAILY_LOG_PHOTO_MAX_EDGE, DAILY_LOG_PHOTO_MAX_EDGE),
                Image.Resampling.LANCZOS,
            )
            has_alpha = image.mode in {"RGBA", "LA"} or (
                image.mode == "P" and "transparency" in image.info
            )
            image = image.convert("RGBA" if has_alpha else "RGB")
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=80, method=6)
            return output.getvalue()
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError, ValueError):
        return None


def api_upload_daily_log_photo(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    daily_log_id = parse_path_int(path, 4)
    if not project_id or not daily_log_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_daily_log_photo_path"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if user["role"] in {"customer"} or user_is_guest(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return

    form = handler.read_multipart()
    client_photo_raw = str(form.getfirst("client_photo_id", "")).strip()
    client_photo_id = normalize_daily_log_client_id(client_photo_raw)
    if not client_photo_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_client_photo_id"})
        return
    upload = form["file"] if "file" in form else None
    if upload is None or not getattr(upload, "file", None) or not getattr(upload, "filename", ""):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "file_required"})
        return
    raw = upload.file.read()
    if not raw:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "empty_file"})
        return
    if len(raw) > DAILY_LOG_PHOTO_MAX_BYTES:
        handler.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "daily_log_photo_too_large"})
        return
    if not daily_log_image_type(raw):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_daily_log_photo_format"})
        return
    compressed = compress_daily_log_image(raw)
    if not compressed:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_daily_log_photo_format"})
        return

    raw = compressed
    file_ext, mime_type = ".webp", "image/webp"
    uploaded_name = sanitize_filename(str(getattr(upload, "filename", "") or "report-photo"))
    original_name = (Path(uploaded_name).stem or "report-photo") + file_ext
    timestamp = now_ts()
    storage_name = f"{timestamp}_{secrets.token_hex(8)}{file_ext}"
    file_path = project_documents_dir(project_id) / storage_name
    try:
        storage_path = str(file_path.relative_to(PROJECT_ROOT))
    except ValueError:
        storage_path = str(file_path)

    try:
        with db() as con:
            con.execute("BEGIN IMMEDIATE")
            log_row = con.execute(
                "SELECT id, report_date, is_client_visible FROM daily_logs WHERE id = ? AND project_id = ?",
                (daily_log_id, project_id),
            ).fetchone()
            if not log_row:
                con.rollback()
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "daily_log_not_found"})
                return
            existing_photo = con.execute(
                """
                SELECT d.id, d.title, d.original_name, d.mime_type, d.size_bytes
                FROM daily_log_photos link
                JOIN documents d ON d.id = link.document_id
                WHERE link.daily_log_id = ? AND link.client_photo_id = ?
                """,
                (daily_log_id, client_photo_id),
            ).fetchone()
            if existing_photo:
                con.rollback()
                handler.send_json(
                    HTTPStatus.OK,
                    {
                        "photo": daily_log_photo_payload(existing_photo),
                        "daily_log_id": daily_log_id,
                        "idempotentReplay": True,
                    },
                )
                return
            photo_count = int(
                con.execute(
                    "SELECT COUNT(*) FROM daily_log_photos WHERE daily_log_id = ?",
                    (daily_log_id,),
                ).fetchone()[0]
            )
            if photo_count >= DAILY_LOG_PHOTO_LIMIT:
                con.rollback()
                handler.send_json(HTTPStatus.CONFLICT, {"error": "daily_log_photo_limit"})
                return

            file_path.write_bytes(raw)
            title = f"Фото к отчёту за {log_row['report_date']}"
            document_cur = con.execute(
                """
                INSERT INTO documents (
                    project_id, title, doc_type, status, original_name, storage_name, storage_path,
                    mime_type, file_ext, size_bytes, notes, uploaded_by, is_client_visible,
                    created_at, updated_at, generated_by_system
                )
                VALUES (?, ?, 'photo_report', 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    project_id,
                    title,
                    original_name,
                    storage_name,
                    storage_path,
                    mime_type,
                    file_ext,
                    len(raw),
                    f"Прикреплено к дневному отчёту #{daily_log_id}",
                    user["id"],
                    int(log_row["is_client_visible"] or 0),
                    timestamp,
                    timestamp,
                ),
            )
            document_id = int(document_cur.lastrowid)
            con.execute(
                """
                INSERT INTO daily_log_photos (
                    daily_log_id, project_id, document_id, client_photo_id, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (daily_log_id, project_id, document_id, client_photo_id, user["id"], timestamp),
            )
            create_audit(
                con,
                user["id"],
                "attach_daily_log_photo",
                "daily_log",
                daily_log_id,
                {
                    "project_id": project_id,
                    "document_id": document_id,
                    "size_bytes": len(raw),
                },
            )
            photo_row = con.execute(
                "SELECT id, title, original_name, mime_type, size_bytes FROM documents WHERE id = ?",
                (document_id,),
            ).fetchone()
            con.commit()
    except Exception:
        try:
            if file_path.is_file():
                file_path.unlink()
        except OSError:
            LOGGER.exception("Could not clean up a failed report photo for project %s", project_id)
        raise

    handler.send_json(
        HTTPStatus.CREATED,
        {
            "photo": daily_log_photo_payload(photo_row),
            "daily_log_id": daily_log_id,
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
    if user["role"] in {"customer"} or user_is_guest(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    with db() as con:
        # Serialize deletion with photo uploads so no document/file can be
        # attached after the cleanup snapshot and become orphaned.
        con.execute("BEGIN IMMEDIATE")
        log_row = con.execute(
            "SELECT * FROM daily_logs WHERE id = ? AND project_id = ?",
            (log_id, project_id),
        ).fetchone()
        if not log_row:
            con.rollback()
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "log_not_found"})
            return
        applied_action = con.execute(
            """
            SELECT 1 FROM daily_log_actions WHERE daily_log_id = ?
            UNION ALL
            SELECT 1 FROM daily_log_work_actions WHERE daily_log_id = ?
            LIMIT 1
            """,
            (log_id, log_id),
        ).fetchone()
        if applied_action:
            con.rollback()
            handler.send_json(
                HTTPStatus.CONFLICT,
                {"error": "daily_log_has_applied_actions"},
            )
            return
        report_photo_rows = con.execute(
            """
            SELECT d.id, d.storage_path
            FROM daily_log_photos link
            JOIN documents d ON d.id = link.document_id
            WHERE link.daily_log_id = ?
            """,
            (log_id,),
        ).fetchall()
        for photo_row in report_photo_rows:
            external_references = [
                reference
                for reference in document_reference_summary(con, int(photo_row["id"]))
                if not (
                    reference["table"] == "daily_log_photos"
                    and reference["column"] == "document_id"
                )
            ]
            other_report_link = con.execute(
                """
                SELECT 1
                FROM daily_log_photos
                WHERE document_id = ? AND daily_log_id <> ?
                LIMIT 1
                """,
                (int(photo_row["id"]), log_id),
            ).fetchone()
            if other_report_link:
                external_references.append(
                    {"table": "daily_log_photos", "column": "document_id", "count": 1}
                )
            if external_references:
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {
                        "error": "daily_log_photo_in_use",
                        "documentId": int(photo_row["id"]),
                        "referenceCount": sum(int(item["count"]) for item in external_references),
                    },
                )
                return
        if report_photo_rows:
            placeholders = ",".join("?" for _ in report_photo_rows)
            con.execute(
                f"DELETE FROM documents WHERE id IN ({placeholders})",
                [int(row["id"]) for row in report_photo_rows],
            )
        con.execute("DELETE FROM daily_logs WHERE id = ?", (log_id,))
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
                        "deleted_photo_count": len(report_photo_rows),
                        "deleted_log": dict(log_row),
                    },
                    ensure_ascii=False,
                ),
                now_ts(),
            ),
        )
        refreshed_project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        con.commit()
    photo_cleanup_failed = False
    for photo_row in report_photo_rows:
        storage_path = str(photo_row["storage_path"] or "").strip()
        if not storage_path:
            continue
        try:
            photo_path = resolve_document_storage_path(project_id, storage_path)
            if photo_path.is_file():
                photo_path.unlink()
        except (OSError, RuntimeError, ValueError) as error:
            photo_cleanup_failed = True
            record_document_file_cleanup_failure(
                user_id=user["id"],
                document_id=int(photo_row["id"]),
                project_id=project_id,
                storage_path=storage_path,
                error=error,
            )
    handler.send_json(
        HTTPStatus.OK,
        {
            "ok": True,
            "deletedId": log_id,
            "deletedPhotoCount": len(report_photo_rows),
            "photoCleanupFailed": photo_cleanup_failed,
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
