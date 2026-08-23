from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
from pathlib import PurePath
from typing import Any


SOURCE_TYPES = {"estimate", "tender", "manual", "legacy"}


def now_ts() -> int:
    return int(time.time())


def table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {str(row["name"]) for row in con.execute(f"PRAGMA table_info({table})").fetchall()}


def _value(source: dict | None, *keys: str) -> Any:
    if not isinstance(source, dict):
        return None
    for key in keys:
        if key in source:
            return source.get(key)
    return None


def _text(value: object, limit: int = 500) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())[:limit]


def _file_name(value: object) -> str:
    raw = _text(value, 1000)
    if not raw:
        return ""
    # PurePath follows the host OS only, while AutoBot can send both Linux and
    # Windows paths. Split both separators explicitly and keep the source name.
    return re.split(r"[/\\]+", raw)[-1][:500]


def _file_title(file_name: str) -> str:
    if not file_name:
        return ""
    name = PurePath(file_name).name
    suffix = PurePath(name).suffix
    return (name[: -len(suffix)] if suffix else name).strip(" ._-")[:500]


def _source_type(value: object) -> str:
    normalized = _text(value, 40).lower()
    return normalized if normalized in SOURCE_TYPES else "estimate"


def _stable_file_key(base_key: str, file_name: str) -> str:
    normalized = file_name.strip().casefold()
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    return f"{base_key}:file:{digest}"[:300]


def ensure_project_estimates_schema(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS project_estimates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            source_type TEXT NOT NULL DEFAULT 'estimate',
            source_key TEXT NOT NULL,
            external_id TEXT,
            tender_id TEXT,
            title TEXT NOT NULL,
            file_name TEXT,
            source_reference TEXT,
            metadata TEXT NOT NULL DEFAULT '{}',
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER,
            UNIQUE(project_id, source_type, source_key)
        );
        """
    )
    item_columns = table_columns(con, "estimate_items")
    if "estimate_source_id" not in item_columns:
        con.execute(
            "ALTER TABLE estimate_items ADD COLUMN estimate_source_id "
            "INTEGER REFERENCES project_estimates(id) ON DELETE SET NULL"
        )
    if "source_item_key" not in item_columns:
        con.execute("ALTER TABLE estimate_items ADD COLUMN source_item_key TEXT")
    if "is_deleted" not in item_columns:
        con.execute("ALTER TABLE estimate_items ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")

    con.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_project_estimates_project_source
            ON project_estimates(project_id, source_type, source_key, id);
        CREATE INDEX IF NOT EXISTS idx_estimate_items_project_source
            ON estimate_items(project_id, estimate_source_id, id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_items_source_item_key
            ON estimate_items(estimate_source_id, source_item_key)
            WHERE estimate_source_id IS NOT NULL AND source_item_key IS NOT NULL;
        """
    )

    # Existing installations had estimate rows directly under a project. Keep
    # them intact and make their origin explicit instead of trying to infer a
    # filename that was never stored.
    timestamp = now_ts()
    con.execute(
        """
        INSERT OR IGNORE INTO project_estimates (
            project_id, source_type, source_key, title, file_name,
            metadata, created_at, updated_at
        )
        SELECT DISTINCT e.project_id, 'legacy', 'legacy:' || e.project_id,
               'Ранее загруженная смета', 'Смета объекта', '{}', ?, ?
        FROM estimate_items e
        WHERE e.estimate_source_id IS NULL
        """,
        (timestamp, timestamp),
    )
    con.execute(
        """
        UPDATE estimate_items
        SET estimate_source_id = (
            SELECT source.id
            FROM project_estimates source
            WHERE source.project_id = estimate_items.project_id
              AND source.source_type = 'legacy'
              AND source.source_key = 'legacy:' || estimate_items.project_id
        )
        WHERE estimate_source_id IS NULL
        """
    )


def estimate_source_descriptor(
    default_source: dict | None,
    item: dict | None = None,
    *,
    project_id: int,
) -> dict:
    base = dict(default_source or {})
    row = item if isinstance(item, dict) else {}

    source_type = _source_type(
        _value(row, "estimate_source_type", "estimateSourceType", "source_type", "sourceType")
        or _value(base, "source_type", "sourceType", "type")
    )
    external_id = _text(
        _value(row, "source_external_id", "sourceExternalId", "external_id", "externalId", "estimate_id", "estimateId")
        or _value(base, "external_id", "externalId", "estimate_id", "estimateId", "id"),
        300,
    )
    tender_id = _text(
        _value(row, "tender_id", "tenderId") or _value(base, "tender_id", "tenderId"),
        120,
    )
    file_name = _file_name(
        _value(row, "estimate_file_name", "estimateFileName", "source_file", "sourceFile", "file_name", "fileName")
        or _value(base, "file_name", "fileName", "original_filename", "originalFilename")
    )
    row_key = _text(
        _value(row, "estimate_source_key", "estimateSourceKey", "source_key", "sourceKey"),
        300,
    )
    base_key = _text(_value(base, "source_key", "sourceKey", "key"), 300) or external_id or tender_id or f"manual:{project_id}"
    source_key = row_key or (_stable_file_key(base_key, file_name) if file_name else base_key)
    title = _text(
        _value(row, "estimate_title", "estimateTitle", "file_title", "fileTitle")
        or _value(base, "title", "estimate_title", "estimateTitle")
        or _file_title(file_name)
        or (f"Смета тендера {tender_id}" if tender_id else "Смета объекта"),
        500,
    )
    source_reference = _text(
        _value(row, "source_reference", "sourceReference", "source_url", "sourceUrl")
        or _value(base, "source_reference", "sourceReference", "source_url", "sourceUrl"),
        2000,
    )
    metadata = _value(base, "metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    return {
        "source_type": source_type,
        "source_key": source_key[:300],
        "external_id": external_id or None,
        "tender_id": tender_id or None,
        "title": title,
        "file_name": file_name or None,
        "source_reference": source_reference or None,
        "metadata": metadata,
    }


def upsert_project_estimate(
    con: sqlite3.Connection,
    project_id: int,
    descriptor: dict,
    actor_id: int | None,
) -> sqlite3.Row:
    timestamp = now_ts()
    source_type = _source_type(descriptor.get("source_type"))
    source_key = _text(descriptor.get("source_key"), 300) or f"manual:{project_id}"
    title = _text(descriptor.get("title"), 500) or "Смета объекта"
    con.execute(
        """
        INSERT INTO project_estimates (
            project_id, source_type, source_key, external_id, tender_id,
            title, file_name, source_reference, metadata,
            created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, source_type, source_key) DO UPDATE SET
            external_id = COALESCE(excluded.external_id, project_estimates.external_id),
            tender_id = COALESCE(excluded.tender_id, project_estimates.tender_id),
            title = CASE WHEN trim(excluded.title) <> '' THEN excluded.title ELSE project_estimates.title END,
            file_name = COALESCE(excluded.file_name, project_estimates.file_name),
            source_reference = COALESCE(excluded.source_reference, project_estimates.source_reference),
            metadata = CASE WHEN excluded.metadata <> '{}' THEN excluded.metadata ELSE project_estimates.metadata END,
            updated_at = excluded.updated_at
        """,
        (
            project_id,
            source_type,
            source_key,
            descriptor.get("external_id"),
            descriptor.get("tender_id"),
            title,
            descriptor.get("file_name"),
            descriptor.get("source_reference"),
            json.dumps(descriptor.get("metadata") or {}, ensure_ascii=False),
            actor_id,
            timestamp,
            timestamp,
        ),
    )
    return con.execute(
        """
        SELECT * FROM project_estimates
        WHERE project_id = ? AND source_type = ? AND source_key = ?
        """,
        (project_id, source_type, source_key),
    ).fetchone()


def source_item_key(item: dict, index: int) -> str:
    explicit = _text(
        _value(item, "source_item_key", "sourceItemKey", "item_key", "itemKey"),
        300,
    )
    if explicit:
        return explicit
    position = _text(
        _value(item, "excel_row", "excelRow", "item_no", "itemNo", "position", "position_index", "positionIndex"),
        80,
    ) or str(index)
    identity = "|".join(
        [
            position,
            _text(_value(item, "article", "code", "basis_code", "basisCode"), 200).casefold(),
            _text(item.get("title"), 500).casefold(),
            _text(item.get("unit"), 80).casefold(),
        ]
    )
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    return f"row:{position}:{digest}"[:300]


def serialize_project_estimate(row: sqlite3.Row | dict) -> dict:
    data = dict(row)
    metadata: dict = {}
    try:
        parsed = json.loads(data.get("metadata") or "{}")
        if isinstance(parsed, dict):
            metadata = parsed
    except (TypeError, ValueError, json.JSONDecodeError):
        metadata = {}
    return {
        "id": int(data.get("id") or 0),
        "projectId": int(data.get("project_id") or 0),
        "sourceType": str(data.get("source_type") or "estimate"),
        "sourceKey": str(data.get("source_key") or ""),
        "externalId": str(data.get("external_id") or ""),
        "tenderId": str(data.get("tender_id") or ""),
        "title": str(data.get("title") or "Смета объекта"),
        "fileName": str(data.get("file_name") or ""),
        "sourceReference": str(data.get("source_reference") or ""),
        "metadata": metadata,
        "itemCount": int(data.get("item_count") or 0),
        "materialCount": int(data.get("material_count") or 0),
        "workCount": int(data.get("work_count") or 0),
        "sectionCount": int(data.get("section_count") or 0),
        "estimateTotal": float(data.get("estimate_total") or 0),
        "createdAt": data.get("created_at"),
        "updatedAt": data.get("updated_at"),
    }


def list_project_estimates(con: sqlite3.Connection, project_id: int) -> list[dict]:
    rows = con.execute(
        """
        SELECT source.*,
               COUNT(item.id) AS item_count,
               SUM(CASE WHEN item.id IS NULL THEN 0 WHEN lower(COALESCE(item.item_kind, 'material')) = 'work' THEN 0 ELSE 1 END) AS material_count,
               SUM(CASE WHEN item.id IS NULL THEN 0 WHEN lower(COALESCE(item.item_kind, 'material')) = 'work' THEN 1 ELSE 0 END) AS work_count,
               COUNT(DISTINCT CASE WHEN item.id IS NULL THEN NULL ELSE COALESCE(NULLIF(trim(item.section_title), ''), 'Без раздела') END) AS section_count,
               COALESCE(SUM(item.planned_qty * item.planned_price), 0) AS estimate_total
        FROM project_estimates source
        LEFT JOIN estimate_items item
          ON item.estimate_source_id = source.id
         AND COALESCE(item.is_deleted, 0) = 0
        WHERE source.project_id = ?
        GROUP BY source.id
        ORDER BY source.id
        """,
        (project_id,),
    ).fetchall()
    return [serialize_project_estimate(row) for row in rows]
