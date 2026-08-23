from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from typing import Iterable


SNAPSHOT_SOURCE_KINDS = {"original", "ai"}
REVIEW_STATUSES = {"confirmed", "needs_correction", "accepted_deviation"}


def ensure_estimate_reconciliation_schema(con: sqlite3.Connection) -> None:
    """Create the immutable estimate-version store used by reconciliation."""

    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS estimate_reconciliation_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            source_kind TEXT NOT NULL CHECK(source_kind IN ('original','ai')),
            version_no INTEGER NOT NULL CHECK(version_no > 0),
            source_label TEXT NOT NULL DEFAULT '',
            source_reference TEXT NOT NULL DEFAULT '',
            content_hash TEXT NOT NULL CHECK(length(content_hash) = 71),
            item_count INTEGER NOT NULL CHECK(item_count > 0),
            captured_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            captured_at INTEGER NOT NULL CHECK(captured_at > 0),
            UNIQUE(project_id, source_kind, version_no),
            UNIQUE(project_id, source_kind, content_hash)
        );

        CREATE TABLE IF NOT EXISTS estimate_reconciliation_snapshot_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER NOT NULL
                REFERENCES estimate_reconciliation_snapshots(id) ON DELETE CASCADE,
            position INTEGER NOT NULL CHECK(position > 0),
            source_estimate_item_id INTEGER,
            title TEXT NOT NULL CHECK(length(trim(title)) > 0),
            normalized_title TEXT NOT NULL,
            unit TEXT NOT NULL,
            normalized_unit TEXT NOT NULL,
            planned_qty REAL NOT NULL CHECK(planned_qty >= 0),
            planned_price REAL NOT NULL DEFAULT 0 CHECK(planned_price >= 0),
            item_kind TEXT NOT NULL CHECK(item_kind IN ('material','work')),
            section_title TEXT NOT NULL DEFAULT '',
            article TEXT NOT NULL DEFAULT '',
            normalized_article TEXT NOT NULL DEFAULT '',
            row_hash TEXT NOT NULL CHECK(length(row_hash) = 71),
            UNIQUE(snapshot_id, position)
        );

        CREATE TABLE IF NOT EXISTS estimate_reconciliation_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            original_snapshot_id INTEGER NOT NULL
                REFERENCES estimate_reconciliation_snapshots(id) ON DELETE CASCADE,
            ai_snapshot_id INTEGER NOT NULL
                REFERENCES estimate_reconciliation_snapshots(id) ON DELETE CASCADE,
            row_key TEXT NOT NULL CHECK(length(row_key) = 71),
            status TEXT NOT NULL CHECK(status IN (
                'confirmed','needs_correction','accepted_deviation'
            )),
            comment TEXT NOT NULL DEFAULT '',
            reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at INTEGER NOT NULL CHECK(reviewed_at > 0),
            UNIQUE(original_snapshot_id, ai_snapshot_id, row_key)
        );

        CREATE INDEX IF NOT EXISTS idx_estimate_reconciliation_snapshots_project
            ON estimate_reconciliation_snapshots(project_id, source_kind, version_no DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_estimate_reconciliation_items_snapshot
            ON estimate_reconciliation_snapshot_items(snapshot_id, position, id);
        CREATE INDEX IF NOT EXISTS idx_estimate_reconciliation_reviews_pair
            ON estimate_reconciliation_reviews(original_snapshot_id, ai_snapshot_id, row_key);

        CREATE TRIGGER IF NOT EXISTS trg_estimate_reconciliation_snapshot_update_guard
        BEFORE UPDATE ON estimate_reconciliation_snapshots
        BEGIN
            SELECT RAISE(ABORT, 'estimate_reconciliation_snapshot_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_estimate_reconciliation_item_update_guard
        BEFORE UPDATE ON estimate_reconciliation_snapshot_items
        BEGIN
            SELECT RAISE(ABORT, 'estimate_reconciliation_snapshot_item_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_estimate_reconciliation_review_project_guard
        BEFORE INSERT ON estimate_reconciliation_reviews
        BEGIN
            SELECT CASE WHEN NOT EXISTS (
                SELECT 1
                FROM estimate_reconciliation_snapshots original
                JOIN estimate_reconciliation_snapshots ai ON ai.id = NEW.ai_snapshot_id
                WHERE original.id = NEW.original_snapshot_id
                  AND original.project_id = NEW.project_id
                  AND ai.project_id = NEW.project_id
                  AND original.source_kind = 'original'
                  AND ai.source_kind = 'ai'
            ) THEN RAISE(ABORT, 'estimate_reconciliation_snapshot_project_mismatch') END;
        END;
        """
    )


def _text(value: object) -> str:
    return str(value or "").strip()


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", _text(value)).lower().replace("ё", "е")
    text = re.sub(r"[^0-9a-zа-я]+", " ", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def normalize_unit(value: object) -> str:
    text = normalize_text(value)
    aliases = {
        "м2": "м2",
        "м 2": "м2",
        "м²": "м2",
        "кв м": "м2",
        "м3": "м3",
        "м 3": "м3",
        "м³": "м3",
        "куб м": "м3",
        "шт.": "шт",
        "штука": "шт",
        "штук": "шт",
    }
    return aliases.get(text, text)


def normalize_kind(value: object) -> str:
    return "work" if _text(value).lower() in {"work", "works", "работа", "работы"} else "material"


def _number(value: object, *, minimum: float = 0.0) -> float:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        number = 0.0
    return max(minimum, number)


def normalize_snapshot_items(items: Iterable[dict]) -> list[dict]:
    normalized: list[dict] = []
    for source in items:
        if not isinstance(source, dict):
            continue
        title = _text(source.get("title") or source.get("name"))
        if not title:
            continue
        unit = _text(source.get("unit")) or "шт"
        quantity = _number(
            source.get("planned_qty", source.get("plannedQty", source.get("quantity", source.get("qty", 0))))
        )
        price = _number(
            source.get("planned_price", source.get("plannedPrice", source.get("price", 0)))
        )
        item_kind = normalize_kind(source.get("item_kind", source.get("itemKind", source.get("kind"))))
        article = _text(
            source.get("article")
            or source.get("sku")
            or source.get("code")
            or source.get("basis")
            or source.get("basis_code")
            or source.get("basisCode")
        )
        source_item_id = source.get("source_estimate_item_id", source.get("sourceEstimateItemId", source.get("id")))
        try:
            source_item_id = int(source_item_id) if source_item_id not in (None, "") else None
        except (TypeError, ValueError):
            source_item_id = None
        row = {
            "position": len(normalized) + 1,
            "source_estimate_item_id": source_item_id,
            "title": title,
            "normalized_title": normalize_text(title),
            "unit": unit,
            "normalized_unit": normalize_unit(unit),
            "planned_qty": quantity,
            "planned_price": price,
            "item_kind": item_kind,
            "section_title": _text(
                source.get("section_title", source.get("sectionTitle", source.get("section", "")))
            ),
            "article": article,
            "normalized_article": normalize_text(article),
        }
        row_source = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        row["row_hash"] = f"sha256:{hashlib.sha256(row_source.encode('utf-8')).hexdigest()}"
        normalized.append(row)
    return normalized


def live_estimate_items(con: sqlite3.Connection, project_id: int) -> list[dict]:
    rows = con.execute(
        """
        SELECT id, title, unit, planned_qty, planned_price, item_kind, section_title, article
        FROM estimate_items
        WHERE project_id = ?
        ORDER BY id
        """,
        (project_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def capture_snapshot(
    con: sqlite3.Connection,
    project_id: int,
    source_kind: str,
    items: Iterable[dict],
    captured_by: int | None,
    captured_at: int,
    source_label: str = "",
    source_reference: str = "",
) -> tuple[sqlite3.Row, bool]:
    if source_kind not in SNAPSHOT_SOURCE_KINDS:
        raise ValueError("bad_snapshot_source_kind")
    normalized = normalize_snapshot_items(items)
    if not normalized:
        raise ValueError("snapshot_items_required")
    content_source = json.dumps(
        [
            {
                key: item[key]
                for key in (
                    "title", "normalized_title", "unit", "normalized_unit", "planned_qty",
                    "planned_price", "item_kind", "section_title", "article", "normalized_article",
                )
            }
            for item in normalized
        ],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    content_hash = f"sha256:{hashlib.sha256(content_source.encode('utf-8')).hexdigest()}"
    existing = con.execute(
        """
        SELECT * FROM estimate_reconciliation_snapshots
        WHERE project_id = ? AND source_kind = ? AND content_hash = ?
        """,
        (project_id, source_kind, content_hash),
    ).fetchone()
    if existing:
        return existing, False
    version_no = int(
        con.execute(
            """
            SELECT COALESCE(MAX(version_no), 0) + 1
            FROM estimate_reconciliation_snapshots
            WHERE project_id = ? AND source_kind = ?
            """,
            (project_id, source_kind),
        ).fetchone()[0]
    )
    cursor = con.execute(
        """
        INSERT INTO estimate_reconciliation_snapshots (
            project_id, source_kind, version_no, source_label, source_reference,
            content_hash, item_count, captured_by, captured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            source_kind,
            version_no,
            _text(source_label)[:200],
            _text(source_reference)[:500],
            content_hash,
            len(normalized),
            captured_by,
            captured_at,
        ),
    )
    snapshot_id = int(cursor.lastrowid)
    con.executemany(
        """
        INSERT INTO estimate_reconciliation_snapshot_items (
            snapshot_id, position, source_estimate_item_id, title, normalized_title,
            unit, normalized_unit, planned_qty, planned_price, item_kind,
            section_title, article, normalized_article, row_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                snapshot_id,
                item["position"],
                item["source_estimate_item_id"],
                item["title"],
                item["normalized_title"],
                item["unit"],
                item["normalized_unit"],
                item["planned_qty"],
                item["planned_price"],
                item["item_kind"],
                item["section_title"],
                item["article"],
                item["normalized_article"],
                item["row_hash"],
            )
            for item in normalized
        ],
    )
    return con.execute(
        "SELECT * FROM estimate_reconciliation_snapshots WHERE id = ?",
        (snapshot_id,),
    ).fetchone(), True


def capture_live_snapshot(
    con: sqlite3.Connection,
    project_id: int,
    source_kind: str,
    captured_by: int | None,
    captured_at: int,
    source_label: str = "",
    source_reference: str = "",
) -> tuple[sqlite3.Row, bool]:
    return capture_snapshot(
        con,
        project_id,
        source_kind,
        live_estimate_items(con, project_id),
        captured_by,
        captured_at,
        source_label,
        source_reference,
    )


def _snapshot_payload(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    return {
        "id": int(row["id"]),
        "sourceKind": str(row["source_kind"]),
        "versionNo": int(row["version_no"]),
        "sourceLabel": str(row["source_label"] or ""),
        "sourceReference": str(row["source_reference"] or ""),
        "contentHash": str(row["content_hash"]),
        "itemCount": int(row["item_count"]),
        "capturedBy": int(row["captured_by"]) if row["captured_by"] is not None else None,
        "capturedAt": int(row["captured_at"]),
    }


def _latest_snapshot(con: sqlite3.Connection, project_id: int, source_kind: str) -> sqlite3.Row | None:
    return con.execute(
        """
        SELECT * FROM estimate_reconciliation_snapshots
        WHERE project_id = ? AND source_kind = ?
        ORDER BY version_no DESC, id DESC
        LIMIT 1
        """,
        (project_id, source_kind),
    ).fetchone()


def _snapshot_items(con: sqlite3.Connection, snapshot_id: int) -> list[dict]:
    return [
        dict(row)
        for row in con.execute(
            """
            SELECT * FROM estimate_reconciliation_snapshot_items
            WHERE snapshot_id = ?
            ORDER BY position, id
            """,
            (snapshot_id,),
        ).fetchall()
    ]


def _identity(item: dict) -> str:
    article = str(item.get("normalized_article") or "")
    if article:
        return f"article:{article}|{item['item_kind']}"
    return f"title:{item['normalized_title']}|{item['normalized_unit']}|{item['item_kind']}"


def _row_key(original: dict | None, ai: dict | None) -> str:
    source = json.dumps(
        {
            "original": int(original["position"]) if original else None,
            "ai": int(ai["position"]) if ai else None,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return f"sha256:{hashlib.sha256(source.encode('utf-8')).hexdigest()}"


def _match_items(original_items: list[dict], ai_items: list[dict]) -> list[tuple[dict | None, dict | None]]:
    unmatched_ai = set(range(len(ai_items)))
    matches: list[tuple[dict | None, dict | None]] = []
    ai_indexes: dict[tuple, list[int]] = defaultdict(list)
    for index, item in enumerate(ai_items):
        keys = []
        if item["normalized_article"]:
            keys.append(("article", item["normalized_article"], item["item_kind"]))
        keys.extend(
            [
                ("full", item["normalized_title"], item["normalized_unit"], item["item_kind"]),
                ("title_kind", item["normalized_title"], item["item_kind"]),
                ("title", item["normalized_title"]),
            ]
        )
        for key in keys:
            ai_indexes[key].append(index)

    for original in original_items:
        keys = []
        if original["normalized_article"]:
            keys.append(("article", original["normalized_article"], original["item_kind"]))
        keys.extend(
            [
                ("full", original["normalized_title"], original["normalized_unit"], original["item_kind"]),
                ("title_kind", original["normalized_title"], original["item_kind"]),
                ("title", original["normalized_title"]),
            ]
        )
        chosen = None
        for key in keys:
            candidates = [index for index in ai_indexes.get(key, []) if index in unmatched_ai]
            if candidates:
                chosen = min(candidates, key=lambda index: abs(int(ai_items[index]["position"]) - int(original["position"])))
                break
        if chosen is None:
            matches.append((original, None))
        else:
            unmatched_ai.remove(chosen)
            matches.append((original, ai_items[chosen]))
    matches.extend((None, ai_items[index]) for index in sorted(unmatched_ai))
    return matches


def _item_payload(item: dict | None, can_view_prices: bool) -> dict | None:
    if item is None:
        return None
    payload = {
        "position": int(item["position"]),
        "title": str(item["title"]),
        "unit": str(item["unit"]),
        "plannedQty": float(item["planned_qty"]),
        "itemKind": str(item["item_kind"]),
        "sectionTitle": str(item["section_title"] or ""),
        "article": str(item["article"] or ""),
    }
    if can_view_prices:
        payload["plannedPrice"] = float(item["planned_price"])
    return payload


def _differences(original: dict, ai: dict) -> list[str]:
    differences = []
    if original["normalized_title"] != ai["normalized_title"]:
        differences.append("title")
    if original["normalized_unit"] != ai["normalized_unit"]:
        differences.append("unit")
    if abs(float(original["planned_qty"]) - float(ai["planned_qty"])) > 0.000001:
        differences.append("quantity")
    if original["item_kind"] != ai["item_kind"]:
        differences.append("kind")
    if normalize_text(original["section_title"]) != normalize_text(ai["section_title"]):
        differences.append("section")
    if original["normalized_article"] != ai["normalized_article"]:
        differences.append("article")
    return differences


def build_reconciliation(
    con: sqlite3.Connection,
    project_id: int,
    can_view_prices: bool,
) -> dict:
    original_snapshot = _latest_snapshot(con, project_id, "original")
    ai_snapshot = _latest_snapshot(con, project_id, "ai")
    base = {
        "ready": bool(original_snapshot and ai_snapshot),
        "originalSnapshot": _snapshot_payload(original_snapshot),
        "aiSnapshot": _snapshot_payload(ai_snapshot),
        "rows": [],
        "summary": {
            "totalRows": 0,
            "exact": 0,
            "changed": 0,
            "missingInAi": 0,
            "addedByAi": 0,
            "duplicates": 0,
            "reviewed": 0,
            "needsCorrection": 0,
        },
    }
    if can_view_prices:
        base["summary"]["priceChanged"] = 0
    if not original_snapshot or not ai_snapshot:
        return base

    original_items = _snapshot_items(con, int(original_snapshot["id"]))
    ai_items = _snapshot_items(con, int(ai_snapshot["id"]))
    original_identity_counts = Counter(_identity(item) for item in original_items)
    ai_identity_counts = Counter(_identity(item) for item in ai_items)
    review_rows = con.execute(
        """
        SELECT review.*, user.name AS reviewer_name, user.first_name, user.last_name
        FROM estimate_reconciliation_reviews review
        LEFT JOIN users user ON user.id = review.reviewed_by
        WHERE review.original_snapshot_id = ? AND review.ai_snapshot_id = ?
        """,
        (int(original_snapshot["id"]), int(ai_snapshot["id"])),
    ).fetchall()
    reviews = {str(row["row_key"]): row for row in review_rows}

    rows = []
    for original, ai in _match_items(original_items, ai_items):
        operational_differences = _differences(original, ai) if original and ai else []
        duplicate_original = bool(original and original_identity_counts[_identity(original)] > 1)
        duplicate_ai = bool(ai and ai_identity_counts[_identity(ai)] > 1)
        if original is None:
            status = "added_by_ai"
        elif ai is None:
            status = "missing_in_ai"
        elif duplicate_original or duplicate_ai:
            status = "duplicate"
        elif operational_differences:
            status = "changed"
        else:
            status = "exact"
        row_key = _row_key(original, ai)
        review = reviews.get(row_key)
        price_changed = bool(
            original
            and ai
            and abs(float(original["planned_price"]) - float(ai["planned_price"])) > 0.000001
        )
        row_payload = {
            "rowKey": row_key,
            "status": status,
            "itemKind": str((ai or original or {}).get("item_kind") or "material"),
            "original": _item_payload(original, can_view_prices),
            "ai": _item_payload(ai, can_view_prices),
            "differences": operational_differences,
            "duplicateOriginal": duplicate_original,
            "duplicateAi": duplicate_ai,
            "review": None,
        }
        if can_view_prices:
            row_payload["priceChanged"] = price_changed
            row_payload["priceDelta"] = (
                round(float(ai["planned_price"]) - float(original["planned_price"]), 2)
                if original and ai
                else None
            )
        if review:
            reviewer_name = " ".join(
                value for value in (str(review["first_name"] or "").strip(), str(review["last_name"] or "").strip()) if value
            ) or str(review["reviewer_name"] or "")
            row_payload["review"] = {
                "status": str(review["status"]),
                "comment": str(review["comment"] or ""),
                "reviewedBy": int(review["reviewed_by"]) if review["reviewed_by"] is not None else None,
                "reviewedByName": reviewer_name,
                "reviewedAt": int(review["reviewed_at"]),
            }
        rows.append(row_payload)

    summary = base["summary"]
    summary["totalRows"] = len(rows)
    for row in rows:
        status = row["status"]
        if status == "exact":
            summary["exact"] += 1
        elif status == "changed":
            summary["changed"] += 1
        elif status == "missing_in_ai":
            summary["missingInAi"] += 1
        elif status == "added_by_ai":
            summary["addedByAi"] += 1
        elif status == "duplicate":
            summary["duplicates"] += 1
        if row["review"]:
            summary["reviewed"] += 1
            if row["review"]["status"] == "needs_correction":
                summary["needsCorrection"] += 1
        if can_view_prices and row.get("priceChanged"):
            summary["priceChanged"] += 1
    base["rows"] = rows
    return base


def save_review(
    con: sqlite3.Connection,
    project_id: int,
    original_snapshot_id: int,
    ai_snapshot_id: int,
    row_key: str,
    status: str,
    comment: str,
    reviewed_by: int | None,
    reviewed_at: int,
) -> sqlite3.Row:
    if status not in REVIEW_STATUSES:
        raise ValueError("bad_reconciliation_review_status")
    comment = _text(comment)[:1000]
    if status in {"needs_correction", "accepted_deviation"} and not comment:
        raise ValueError("reconciliation_comment_required")
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", str(row_key or "")):
        raise ValueError("bad_reconciliation_row_key")
    con.execute(
        """
        INSERT INTO estimate_reconciliation_reviews (
            project_id, original_snapshot_id, ai_snapshot_id, row_key, status,
            comment, reviewed_by, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(original_snapshot_id, ai_snapshot_id, row_key) DO UPDATE SET
            status = excluded.status,
            comment = excluded.comment,
            reviewed_by = excluded.reviewed_by,
            reviewed_at = excluded.reviewed_at
        """,
        (
            project_id,
            original_snapshot_id,
            ai_snapshot_id,
            row_key,
            status,
            comment,
            reviewed_by,
            reviewed_at,
        ),
    )
    return con.execute(
        """
        SELECT * FROM estimate_reconciliation_reviews
        WHERE original_snapshot_id = ? AND ai_snapshot_id = ? AND row_key = ?
        """,
        (original_snapshot_id, ai_snapshot_id, row_key),
    ).fetchone()
