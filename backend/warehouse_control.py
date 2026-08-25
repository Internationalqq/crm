from __future__ import annotations

import json
import re
import sqlite3
import time
from datetime import date


FACT_SOURCE_TYPES = {"work_fact", "work_fact_reversal"}


def _table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {str(row["name"]) for row in con.execute(f"PRAGMA table_info({table})").fetchall()}


def ensure_warehouse_control_schema(con: sqlite3.Connection) -> None:
    """Create immutable journals and enrich legacy moves without changing their quantities."""

    stock_columns = _table_columns(con, "stock_moves")
    if "source_type" not in stock_columns:
        con.execute("ALTER TABLE stock_moves ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'")
    if "source_id" not in stock_columns:
        con.execute("ALTER TABLE stock_moves ADD COLUMN source_id INTEGER")
    if "source_key" not in stock_columns:
        con.execute("ALTER TABLE stock_moves ADD COLUMN source_key TEXT")
    if "material_title_snapshot" not in stock_columns:
        con.execute("ALTER TABLE stock_moves ADD COLUMN material_title_snapshot TEXT")
    if "material_unit_snapshot" not in stock_columns:
        con.execute("ALTER TABLE stock_moves ADD COLUMN material_unit_snapshot TEXT")

    con.execute(
        """
        UPDATE stock_moves
        SET material_title_snapshot = COALESCE(
                NULLIF(material_title_snapshot, ''),
                (SELECT item.title FROM estimate_items item WHERE item.id = stock_moves.estimate_item_id)
            ),
            material_unit_snapshot = COALESCE(
                NULLIF(material_unit_snapshot, ''),
                (SELECT item.unit FROM estimate_items item WHERE item.id = stock_moves.estimate_item_id)
            )
        WHERE estimate_item_id IS NOT NULL
          AND (NULLIF(material_title_snapshot, '') IS NULL OR NULLIF(material_unit_snapshot, '') IS NULL)
        """
    )

    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS work_material_norms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            work_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
            material_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
            work_title_snapshot TEXT NOT NULL,
            work_unit_snapshot TEXT NOT NULL,
            material_title_snapshot TEXT NOT NULL,
            material_unit_snapshot TEXT NOT NULL,
            qty_per_work_unit REAL NOT NULL CHECK(qty_per_work_unit > 0),
            waste_percent REAL NOT NULL DEFAULT 0 CHECK(waste_percent BETWEEN 0 AND 100),
            is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            updated_at INTEGER NOT NULL CHECK(updated_at >= created_at)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_work_material_norms_live_pair
            ON work_material_norms(project_id, work_item_id, material_item_id)
            WHERE work_item_id IS NOT NULL AND material_item_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS project_work_facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            work_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
            entry_kind TEXT NOT NULL CHECK(entry_kind IN ('fact','reversal')),
            reverses_fact_id INTEGER UNIQUE REFERENCES project_work_facts(id) ON DELETE CASCADE,
            report_date TEXT NOT NULL CHECK(length(report_date) = 10),
            quantity REAL NOT NULL CHECK(quantity > 0),
            work_title_snapshot TEXT NOT NULL,
            work_unit_snapshot TEXT NOT NULL,
            section_title_snapshot TEXT NOT NULL DEFAULT '',
            comment TEXT NOT NULL DEFAULT '',
            idempotency_key TEXT NOT NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            UNIQUE(project_id, idempotency_key),
            CHECK(
                (entry_kind = 'fact' AND reverses_fact_id IS NULL)
                OR (entry_kind = 'reversal' AND reverses_fact_id IS NOT NULL)
            )
        );

        CREATE TABLE IF NOT EXISTS project_work_fact_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fact_id INTEGER NOT NULL REFERENCES project_work_facts(id) ON DELETE CASCADE,
            norm_id INTEGER REFERENCES work_material_norms(id) ON DELETE SET NULL,
            material_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
            material_title_snapshot TEXT NOT NULL,
            material_unit_snapshot TEXT NOT NULL,
            qty_per_work_unit REAL NOT NULL CHECK(qty_per_work_unit > 0),
            waste_percent REAL NOT NULL CHECK(waste_percent BETWEEN 0 AND 100),
            expected_qty REAL NOT NULL CHECK(expected_qty <> 0),
            stock_move_id INTEGER UNIQUE REFERENCES stock_moves(id) ON DELETE SET NULL,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            UNIQUE(fact_id, material_title_snapshot, material_unit_snapshot)
        );

        CREATE INDEX IF NOT EXISTS idx_project_work_facts_project_date
            ON project_work_facts(project_id, report_date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_project_work_facts_work_item
            ON project_work_facts(work_item_id, id);
        CREATE INDEX IF NOT EXISTS idx_project_work_fact_materials_fact
            ON project_work_fact_materials(fact_id, id);
        CREATE INDEX IF NOT EXISTS idx_project_work_fact_materials_material
            ON project_work_fact_materials(material_item_id, id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_moves_source_key
            ON stock_moves(project_id, source_type, source_key)
            WHERE source_key IS NOT NULL;

        CREATE TRIGGER IF NOT EXISTS trg_stock_move_fill_material_snapshot
        AFTER INSERT ON stock_moves
        WHEN NEW.estimate_item_id IS NOT NULL
          AND (NULLIF(NEW.material_title_snapshot, '') IS NULL OR NULLIF(NEW.material_unit_snapshot, '') IS NULL)
        BEGIN
            UPDATE stock_moves
            SET material_title_snapshot = COALESCE(
                    NULLIF(material_title_snapshot, ''),
                    (SELECT item.title FROM estimate_items item WHERE item.id = NEW.estimate_item_id)
                ),
                material_unit_snapshot = COALESCE(
                    NULLIF(material_unit_snapshot, ''),
                    (SELECT item.unit FROM estimate_items item WHERE item.id = NEW.estimate_item_id)
                )
            WHERE id = NEW.id;
        END;

        DROP TRIGGER IF EXISTS trg_project_work_fact_update_guard;
        CREATE TRIGGER trg_project_work_fact_update_guard
        BEFORE UPDATE ON project_work_facts
        WHEN NEW.project_id IS NOT OLD.project_id
          OR (
              NEW.work_item_id IS NOT OLD.work_item_id
              AND NOT (OLD.work_item_id IS NOT NULL AND NEW.work_item_id IS NULL)
          )
          OR NEW.entry_kind IS NOT OLD.entry_kind
          OR NEW.reverses_fact_id IS NOT OLD.reverses_fact_id
          OR NEW.report_date IS NOT OLD.report_date
          OR NEW.quantity IS NOT OLD.quantity
          OR NEW.work_title_snapshot IS NOT OLD.work_title_snapshot
          OR NEW.work_unit_snapshot IS NOT OLD.work_unit_snapshot
          OR NEW.section_title_snapshot IS NOT OLD.section_title_snapshot
          OR NEW.comment IS NOT OLD.comment
          OR NEW.idempotency_key IS NOT OLD.idempotency_key
          OR NEW.created_by IS NOT OLD.created_by
          OR NEW.created_at IS NOT OLD.created_at
        BEGIN
            SELECT RAISE(ABORT, 'project_work_fact_is_immutable');
        END;

        DROP TRIGGER IF EXISTS trg_project_work_fact_material_update_guard;
        CREATE TRIGGER trg_project_work_fact_material_update_guard
        BEFORE UPDATE ON project_work_fact_materials
        WHEN NEW.fact_id IS NOT OLD.fact_id
          OR (
              NEW.norm_id IS NOT OLD.norm_id
              AND NOT (OLD.norm_id IS NOT NULL AND NEW.norm_id IS NULL)
          )
          OR (
              NEW.material_item_id IS NOT OLD.material_item_id
              AND NOT (OLD.material_item_id IS NOT NULL AND NEW.material_item_id IS NULL)
          )
          OR (
              NEW.stock_move_id IS NOT OLD.stock_move_id
              AND NOT (OLD.stock_move_id IS NOT NULL AND NEW.stock_move_id IS NULL)
          )
          OR NEW.material_title_snapshot IS NOT OLD.material_title_snapshot
          OR NEW.material_unit_snapshot IS NOT OLD.material_unit_snapshot
          OR NEW.qty_per_work_unit IS NOT OLD.qty_per_work_unit
          OR NEW.waste_percent IS NOT OLD.waste_percent
          OR NEW.expected_qty IS NOT OLD.expected_qty
          OR NEW.created_at IS NOT OLD.created_at
        BEGIN
            SELECT RAISE(ABORT, 'project_work_fact_material_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_work_material_norm_project_guard_insert
        BEFORE INSERT ON work_material_norms
        BEGIN
            SELECT CASE WHEN NOT EXISTS (
                SELECT 1 FROM estimate_items work
                WHERE work.id = NEW.work_item_id AND work.project_id = NEW.project_id
            ) THEN RAISE(ABORT, 'work_norm_project_mismatch') END;
            SELECT CASE WHEN NOT EXISTS (
                SELECT 1 FROM estimate_items material
                WHERE material.id = NEW.material_item_id AND material.project_id = NEW.project_id
            ) THEN RAISE(ABORT, 'material_norm_project_mismatch') END;
        END;

        DROP TRIGGER IF EXISTS trg_work_material_norm_project_guard_update;
        CREATE TRIGGER trg_work_material_norm_project_guard_update
        BEFORE UPDATE OF project_id, work_item_id, material_item_id ON work_material_norms
        BEGIN
            SELECT CASE WHEN NEW.work_item_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM estimate_items work
                WHERE work.id = NEW.work_item_id AND work.project_id = NEW.project_id
            ) THEN RAISE(ABORT, 'work_norm_project_mismatch') END;
            SELECT CASE WHEN NEW.material_item_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM estimate_items material
                WHERE material.id = NEW.material_item_id AND material.project_id = NEW.project_id
            ) THEN RAISE(ABORT, 'material_norm_project_mismatch') END;
        END;
        """
    )
    migrate_legacy_purchase_receipts(con)


def migrate_legacy_purchase_receipts(con: sqlite3.Connection) -> int:
    """Preserve stock entered by the old UI where ``purchase`` also meant receipt."""

    migration_key = "20260824_purchase_order_receipt_split_v1"
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS system_migrations (
            migration_key TEXT PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )
        """
    )
    if con.execute(
        "SELECT 1 FROM system_migrations WHERE migration_key = ?",
        (migration_key,),
    ).fetchone():
        return 0

    legacy_rows = con.execute(
        """
        SELECT purchase.project_id, purchase.estimate_item_id,
               SUM(purchase.qty) AS purchase_qty,
               MAX(purchase.created_by) AS created_by
        FROM stock_moves purchase
        WHERE purchase.move_type = 'purchase'
          AND purchase.estimate_item_id IS NOT NULL
          AND COALESCE(purchase.source_type, 'manual') <> 'daily_log_action'
        GROUP BY purchase.project_id, purchase.estimate_item_id
        HAVING SUM(purchase.qty) > 0
           AND NOT EXISTS (
               SELECT 1
               FROM stock_moves receipt
               WHERE receipt.project_id = purchase.project_id
                 AND receipt.estimate_item_id = purchase.estimate_item_id
                 AND receipt.move_type = 'receipt'
           )
        """
    ).fetchall()
    timestamp = int(time.time())
    created = 0
    for row in legacy_rows:
        source_key = f"legacy-purchase-receipt:{int(row['estimate_item_id'])}"
        cursor = con.execute(
            """
            INSERT OR IGNORE INTO stock_moves (
                project_id, estimate_item_id, move_type, qty, price, comment,
                created_by, created_at, source_type, source_id, source_key
            ) VALUES (?, ?, 'receipt', ?, 0, ?, ?, ?, 'legacy_purchase_receipt_backfill', ?, ?)
            """,
            (
                int(row["project_id"]),
                int(row["estimate_item_id"]),
                float(row["purchase_qty"]),
                "Перенос старого прихода после разделения заказа и поставки",
                row["created_by"],
                timestamp,
                int(row["estimate_item_id"]),
                source_key,
            ),
        )
        created += max(int(cursor.rowcount or 0), 0)
    con.execute(
        "INSERT INTO system_migrations (migration_key, applied_at) VALUES (?, ?)",
        (migration_key, timestamp),
    )
    return created


def _float(value: object, default: float = 0.0) -> float:
    try:
        return float(value if value not in (None, "") else default)
    except (TypeError, ValueError):
        return default


def _kind(value: object) -> str:
    return "work" if str(value or "").strip().lower() in {"work", "works", "работа", "работы"} else "material"


def _iso_date(value: object) -> str:
    text = str(value or "").strip()
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError as exc:
        raise ValueError("bad_work_fact_date") from exc


def _display_user(row: sqlite3.Row | dict) -> str:
    keys = row.keys() if isinstance(row, sqlite3.Row) else row.keys()
    first = str(row["first_name"] or "").strip() if "first_name" in keys else ""
    last = str(row["last_name"] or "").strip() if "last_name" in keys else ""
    return " ".join(value for value in (first, last) if value) or str(row["user_name"] or "").strip()


def _estimate_rows(con: sqlite3.Connection, project_id: int) -> tuple[list[dict], list[dict]]:
    estimate_columns = _table_columns(con, "estimate_items")
    table_names = {
        str(row["name"])
        for row in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    }
    has_estimate_sources = "estimate_source_id" in estimate_columns and "project_estimates" in table_names
    live_where = " AND COALESCE(e.is_deleted, 0) = 0" if "is_deleted" in estimate_columns else ""
    source_select = """
            , e.estimate_source_id,
            source.source_type AS estimate_source_type,
            source.source_key AS estimate_source_key,
            source.external_id AS estimate_source_external_id,
            source.tender_id AS estimate_tender_id,
            source.title AS estimate_title,
            source.file_name AS estimate_file_name,
            source.source_reference AS estimate_source_reference
    """ if has_estimate_sources else ""
    source_join = (
        "LEFT JOIN project_estimates source ON source.id = e.estimate_source_id AND source.project_id = e.project_id"
        if has_estimate_sources else ""
    )
    rows = con.execute(
        f"""
        SELECT e.id, e.title, e.unit, e.planned_qty, e.actual_qty, e.item_kind, e.section_title
               {source_select}
        FROM estimate_items e
        {source_join}
        WHERE e.project_id = ?{live_where}
        ORDER BY e.id
        """,
        (project_id,),
    ).fetchall()
    works = []
    materials = []
    for row in rows:
        source_id = row["estimate_source_id"] if has_estimate_sources else None
        payload = {
            "id": int(row["id"]),
            "title": str(row["title"] or ""),
            "unit": str(row["unit"] or ""),
            "plannedQty": _float(row["planned_qty"]),
            "actualQty": _float(row["actual_qty"]),
            "itemKind": _kind(row["item_kind"]),
            "sectionTitle": str(row["section_title"] or ""),
            "estimateSourceId": int(source_id) if source_id is not None else None,
            "estimateSourceType": (
                str(row["estimate_source_type"] or ("estimate" if source_id is not None else "legacy"))
                if has_estimate_sources else "legacy"
            ),
            "estimateSourceKey": str(row["estimate_source_key"] or "") if has_estimate_sources else "",
            "estimateSourceExternalId": str(row["estimate_source_external_id"] or "") if has_estimate_sources else "",
            "estimateTenderId": str(row["estimate_tender_id"] or "") if has_estimate_sources else "",
            "estimateTitle": str(row["estimate_title"] or "Ранее загруженная смета") if has_estimate_sources else "Ранее загруженная смета",
            "estimateFileName": str(row["estimate_file_name"] or "Смета объекта") if has_estimate_sources else "Смета объекта",
            "estimateSourceReference": str(row["estimate_source_reference"] or "") if has_estimate_sources else "",
        }
        (works if payload["itemKind"] == "work" else materials).append(payload)
    return works, materials


def _stock_totals(con: sqlite3.Connection, project_id: int) -> dict[int, dict]:
    rows = con.execute(
        """
        SELECT estimate_item_id,
               COALESCE(SUM(CASE WHEN move_type = 'purchase' THEN qty ELSE 0 END), 0) AS purchased_qty,
               COALESCE(SUM(CASE WHEN move_type = 'receipt' THEN qty ELSE 0 END), 0) AS received_qty,
               COALESCE(SUM(CASE WHEN move_type = 'use' THEN qty ELSE 0 END), 0) AS used_qty,
               COALESCE(SUM(CASE WHEN move_type = 'writeoff' THEN qty ELSE 0 END), 0) AS writeoff_qty,
               COALESCE(SUM(CASE WHEN move_type = 'use' AND source_type IN ('work_fact','work_fact_reversal') THEN qty ELSE 0 END), 0) AS fact_used_qty
        FROM stock_moves
        WHERE project_id = ? AND estimate_item_id IS NOT NULL
        GROUP BY estimate_item_id
        """,
        (project_id,),
    ).fetchall()
    return {
        int(row["estimate_item_id"]): {
            "purchasedQty": _float(row["purchased_qty"]),
            "receivedQty": _float(row["received_qty"]),
            "usedQty": _float(row["used_qty"]),
            "writeoffQty": _float(row["writeoff_qty"]),
            "factUsedQty": _float(row["fact_used_qty"]),
        }
        for row in rows
    }


def _fact_quantity_by_work(con: sqlite3.Connection, project_id: int) -> dict[int, float]:
    rows = con.execute(
        """
        SELECT COALESCE(original.work_item_id, fact.work_item_id) AS work_item_id,
               COALESCE(SUM(CASE WHEN fact.entry_kind = 'fact' THEN fact.quantity ELSE -fact.quantity END), 0) AS quantity
        FROM project_work_facts fact
        LEFT JOIN project_work_facts original ON original.id = fact.reverses_fact_id
        WHERE fact.project_id = ?
        GROUP BY COALESCE(original.work_item_id, fact.work_item_id)
        """,
        (project_id,),
    ).fetchall()
    return {
        int(row["work_item_id"]): _float(row["quantity"])
        for row in rows
        if row["work_item_id"] is not None
    }


def _norm_payload(row: sqlite3.Row) -> dict:
    return {
        "id": int(row["id"]),
        "workItemId": int(row["work_item_id"]) if row["work_item_id"] is not None else None,
        "materialItemId": int(row["material_item_id"]) if row["material_item_id"] is not None else None,
        "workTitle": str(row["work_title_snapshot"]),
        "workUnit": str(row["work_unit_snapshot"]),
        "materialTitle": str(row["material_title_snapshot"]),
        "materialUnit": str(row["material_unit_snapshot"]),
        "qtyPerWorkUnit": _float(row["qty_per_work_unit"]),
        "wastePercent": _float(row["waste_percent"]),
        "isActive": bool(row["is_active"]),
        "updatedAt": int(row["updated_at"]),
    }


def build_warehouse_control(con: sqlite3.Connection, project_id: int) -> dict:
    works, materials = _estimate_rows(con, project_id)
    fact_quantities = _fact_quantity_by_work(con, project_id)
    for work in works:
        work["factQty"] = round(fact_quantities.get(int(work["id"]), 0.0), 6)
        work["remainingQty"] = round(max(float(work["plannedQty"]) - float(work["factQty"]), 0.0), 6)
        work["overrunQty"] = round(max(float(work["factQty"]) - float(work["plannedQty"]), 0.0), 6)

    stock = _stock_totals(con, project_id)
    material_payload = []
    for material in materials:
        totals = stock.get(int(material["id"]), {})
        purchased = _float(totals.get("purchasedQty"))
        received = _float(totals.get("receivedQty"))
        used = _float(totals.get("usedQty"))
        writeoff = _float(totals.get("writeoffQty"))
        fact_used = _float(totals.get("factUsedQty"))
        # A purchase order is not physical stock. Only an accepted receipt can
        # cover consumption; otherwise the difference must stay visible as a risk.
        available_base = received
        balance = available_base - used - writeoff
        manual_consumption = used - fact_used + writeoff
        item = dict(material)
        item.update(
            {
                "purchasedQty": round(purchased, 6),
                "receivedQty": round(received, 6),
                "factUsedQty": round(fact_used, 6),
                "manualUsedQty": round(manual_consumption, 6),
                "writeoffQty": round(writeoff, 6),
                "stockBalanceQty": round(balance, 6),
                "stockQty": round(max(balance, 0.0), 6),
                "unaccountedQty": round(max(-balance, 0.0), 6),
                "hasReceipt": received > 0,
            }
        )
        material_payload.append(item)

    norm_rows = con.execute(
        """
        SELECT * FROM work_material_norms
        WHERE project_id = ?
        ORDER BY is_active DESC, work_title_snapshot, material_title_snapshot, id
        """,
        (project_id,),
    ).fetchall()
    norms = [_norm_payload(row) for row in norm_rows]

    fact_rows = con.execute(
        """
        SELECT fact.*, user.name AS user_name, user.first_name, user.last_name
        FROM project_work_facts fact
        LEFT JOIN users user ON user.id = fact.created_by
        WHERE fact.project_id = ?
        ORDER BY fact.report_date DESC, fact.id DESC
        LIMIT 100
        """,
        (project_id,),
    ).fetchall()
    reversed_ids = {
        int(row["reverses_fact_id"])
        for row in fact_rows
        if row["entry_kind"] == "reversal" and row["reverses_fact_id"] is not None
    }
    facts = []
    for row in fact_rows:
        line_rows = con.execute(
            """
            SELECT * FROM project_work_fact_materials
            WHERE fact_id = ? ORDER BY id
            """,
            (row["id"],),
        ).fetchall()
        facts.append(
            {
                "id": int(row["id"]),
                "entryKind": str(row["entry_kind"]),
                "reversesFactId": int(row["reverses_fact_id"]) if row["reverses_fact_id"] is not None else None,
                "workItemId": int(row["work_item_id"]) if row["work_item_id"] is not None else None,
                "workTitle": str(row["work_title_snapshot"]),
                "workUnit": str(row["work_unit_snapshot"]),
                "sectionTitle": str(row["section_title_snapshot"] or ""),
                "reportDate": str(row["report_date"]),
                "quantity": _float(row["quantity"]),
                "comment": str(row["comment"] or ""),
                "createdByName": _display_user(row),
                "createdAt": int(row["created_at"]),
                "isReversed": int(row["id"]) in reversed_ids,
                "materials": [
                    {
                        "materialItemId": int(line["material_item_id"]) if line["material_item_id"] is not None else None,
                        "materialTitle": str(line["material_title_snapshot"]),
                        "materialUnit": str(line["material_unit_snapshot"]),
                        "qtyPerWorkUnit": _float(line["qty_per_work_unit"]),
                        "wastePercent": _float(line["waste_percent"]),
                        "expectedQty": _float(line["expected_qty"]),
                    }
                    for line in line_rows
                ],
            }
        )

    movement_rows = con.execute(
        """
        SELECT move.id, move.estimate_item_id, move.move_type, move.qty,
               move.comment, move.created_at, move.source_type,
               COALESCE(NULLIF(move.material_title_snapshot, ''), item.title) AS item_title,
               COALESCE(NULLIF(move.material_unit_snapshot, ''), item.unit) AS item_unit,
               user.name AS user_name, user.first_name, user.last_name
        FROM stock_moves move
        LEFT JOIN estimate_items item ON item.id = move.estimate_item_id
        LEFT JOIN users user ON user.id = move.created_by
        WHERE move.project_id = ?
        ORDER BY move.created_at DESC, move.id DESC
        LIMIT 200
        """,
        (project_id,),
    ).fetchall()
    movements = [
        {
            "id": int(row["id"]),
            "materialItemId": int(row["estimate_item_id"]) if row["estimate_item_id"] is not None else None,
            "materialTitle": str(row["item_title"] or "Удалённая позиция"),
            "materialUnit": str(row["item_unit"] or ""),
            "moveType": str(row["move_type"]),
            "qty": _float(row["qty"]),
            "comment": str(row["comment"] or ""),
            "sourceType": str(row["source_type"] or "manual"),
            "createdByName": _display_user(row),
            "createdAt": int(row["created_at"]),
        }
        for row in movement_rows
    ]

    active_norm_work_ids = {int(norm["workItemId"]) for norm in norms if norm["isActive"] and norm["workItemId"]}
    risk_materials = [item for item in material_payload if item["unaccountedQty"] > 0]
    planned_materials = [item for item in material_payload if item["plannedQty"] > 0]
    return {
        "works": works,
        "materials": material_payload,
        "norms": norms,
        "facts": facts,
        "movements": movements,
        "summary": {
            "materialsCount": len(material_payload),
            "fullyReceivedMaterials": sum(
                1 for item in planned_materials if item["receivedQty"] >= item["plannedQty"]
            ),
            "needReceiptMaterials": sum(
                1 for item in planned_materials if item["receivedQty"] < item["plannedQty"]
            ),
            "inStockMaterials": sum(1 for item in material_payload if item["stockBalanceQty"] > 0),
            "worksCount": len(works),
            "configuredWorks": len(active_norm_work_ids),
            "factsCount": sum(1 for fact in facts if fact["entryKind"] == "fact" and not fact["isReversed"]),
            "riskMaterials": len(risk_materials),
            "overrunWorks": sum(1 for work in works if work["overrunQty"] > 0),
        },
    }


def upsert_work_material_norm(
    con: sqlite3.Connection,
    project_id: int,
    work_item_id: int,
    material_item_id: int,
    qty_per_work_unit: float,
    waste_percent: float,
    is_active: bool,
    actor_id: int | None,
    timestamp: int,
) -> tuple[sqlite3.Row, bool]:
    if qty_per_work_unit <= 0 or qty_per_work_unit > 1_000_000:
        raise ValueError("bad_material_norm_quantity")
    if waste_percent < 0 or waste_percent > 100:
        raise ValueError("bad_material_norm_waste")
    work = con.execute(
        "SELECT * FROM estimate_items WHERE id = ? AND project_id = ?",
        (work_item_id, project_id),
    ).fetchone()
    material = con.execute(
        "SELECT * FROM estimate_items WHERE id = ? AND project_id = ?",
        (material_item_id, project_id),
    ).fetchone()
    if not work or _kind(work["item_kind"]) != "work":
        raise ValueError("work_item_not_found")
    if not material or _kind(material["item_kind"]) != "material":
        raise ValueError("material_item_not_found")
    existing = con.execute(
        """
        SELECT * FROM work_material_norms
        WHERE project_id = ? AND work_item_id = ? AND material_item_id = ?
        """,
        (project_id, work_item_id, material_item_id),
    ).fetchone()
    if existing:
        con.execute(
            """
            UPDATE work_material_norms
            SET qty_per_work_unit = ?, waste_percent = ?, is_active = ?,
                work_title_snapshot = ?, work_unit_snapshot = ?,
                material_title_snapshot = ?, material_unit_snapshot = ?,
                updated_by = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                qty_per_work_unit,
                waste_percent,
                1 if is_active else 0,
                str(work["title"]),
                str(work["unit"]),
                str(material["title"]),
                str(material["unit"]),
                actor_id,
                timestamp,
                int(existing["id"]),
            ),
        )
        norm_id = int(existing["id"])
        created = False
    else:
        cursor = con.execute(
            """
            INSERT INTO work_material_norms (
                project_id, work_item_id, material_item_id,
                work_title_snapshot, work_unit_snapshot,
                material_title_snapshot, material_unit_snapshot,
                qty_per_work_unit, waste_percent, is_active,
                created_by, updated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                work_item_id,
                material_item_id,
                str(work["title"]),
                str(work["unit"]),
                str(material["title"]),
                str(material["unit"]),
                qty_per_work_unit,
                waste_percent,
                1 if is_active else 0,
                actor_id,
                actor_id,
                timestamp,
                timestamp,
            ),
        )
        norm_id = int(cursor.lastrowid)
        created = True
    return con.execute("SELECT * FROM work_material_norms WHERE id = ?", (norm_id,)).fetchone(), created


def _refresh_work_actual(con: sqlite3.Connection, project_id: int, work_item_id: int | None, timestamp: int) -> None:
    if not work_item_id:
        return
    row = con.execute(
        "SELECT planned_qty FROM estimate_items WHERE id = ? AND project_id = ?",
        (work_item_id, project_id),
    ).fetchone()
    if not row:
        return
    total = _fact_quantity_by_work(con, project_id).get(work_item_id, 0.0)
    planned = _float(row["planned_qty"])
    progress_actual = min(max(total, 0.0), planned) if planned > 0 else max(total, 0.0)
    con.execute(
        """
        UPDATE estimate_items
        SET actual_qty = ?, is_completed = ?, updated_at = ?
        WHERE id = ? AND project_id = ?
        """,
        (progress_actual, 1 if planned > 0 and total >= planned else 0, timestamp, work_item_id, project_id),
    )


def create_work_fact(
    con: sqlite3.Connection,
    project_id: int,
    work_item_id: int,
    report_date: str,
    quantity: float,
    comment: str,
    idempotency_key: str,
    actor_id: int | None,
    timestamp: int,
) -> tuple[sqlite3.Row, bool]:
    report_date = _iso_date(report_date)
    if quantity <= 0 or quantity > 1_000_000_000:
        raise ValueError("bad_work_fact_quantity")
    idempotency_key = str(idempotency_key or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{8,100}", idempotency_key):
        raise ValueError("bad_work_fact_idempotency_key")
    existing = con.execute(
        "SELECT * FROM project_work_facts WHERE project_id = ? AND idempotency_key = ?",
        (project_id, idempotency_key),
    ).fetchone()
    if existing:
        same_request = (
            str(existing["entry_kind"]) == "fact"
            and int(existing["work_item_id"] or 0) == int(work_item_id)
            and str(existing["report_date"]) == report_date
            and abs(_float(existing["quantity"]) - quantity) < 1e-9
            and str(existing["comment"] or "") == str(comment or "").strip()[:1000]
        )
        if not same_request:
            raise ValueError("work_fact_idempotency_conflict")
        return existing, False
    work = con.execute(
        "SELECT * FROM estimate_items WHERE id = ? AND project_id = ?",
        (work_item_id, project_id),
    ).fetchone()
    if not work or _kind(work["item_kind"]) != "work":
        raise ValueError("work_item_not_found")
    norms = con.execute(
        """
        SELECT norm.*, material.title AS current_material_title,
               material.unit AS current_material_unit
        FROM work_material_norms norm
        JOIN estimate_items material
          ON material.id = norm.material_item_id AND material.project_id = norm.project_id
        WHERE norm.project_id = ? AND norm.work_item_id = ? AND norm.is_active = 1
        ORDER BY norm.id
        """,
        (project_id, work_item_id),
    ).fetchall()
    if not norms:
        raise ValueError("work_material_norms_required")
    cursor = con.execute(
        """
        INSERT INTO project_work_facts (
            project_id, work_item_id, entry_kind, reverses_fact_id, report_date,
            quantity, work_title_snapshot, work_unit_snapshot, section_title_snapshot,
            comment, idempotency_key, created_by, created_at
        ) VALUES (?, ?, 'fact', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            work_item_id,
            report_date,
            quantity,
            str(work["title"]),
            str(work["unit"]),
            str(work["section_title"] or ""),
            str(comment or "").strip()[:1000],
            idempotency_key,
            actor_id,
            timestamp,
        ),
    )
    fact_id = int(cursor.lastrowid)
    for norm in norms:
        expected_qty = quantity * _float(norm["qty_per_work_unit"]) * (1 + _float(norm["waste_percent"]) / 100)
        source_key = f"work_fact:{fact_id}:{int(norm['material_item_id'])}"
        move_cursor = con.execute(
            """
            INSERT INTO stock_moves (
                project_id, estimate_item_id, move_type, qty, price, comment,
                created_by, created_at, source_type, source_id, source_key
            ) VALUES (?, ?, 'use', ?, 0, ?, ?, ?, 'work_fact', ?, ?)
            """,
            (
                project_id,
                int(norm["material_item_id"]),
                expected_qty,
                f"Автосписание по факту работ №{fact_id}: {work['title']}",
                actor_id,
                timestamp,
                fact_id,
                source_key,
            ),
        )
        con.execute(
            """
            INSERT INTO project_work_fact_materials (
                fact_id, norm_id, material_item_id, material_title_snapshot,
                material_unit_snapshot, qty_per_work_unit, waste_percent,
                expected_qty, stock_move_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                fact_id,
                int(norm["id"]),
                int(norm["material_item_id"]),
                str(norm["current_material_title"] or norm["material_title_snapshot"]),
                str(norm["current_material_unit"] or norm["material_unit_snapshot"]),
                _float(norm["qty_per_work_unit"]),
                _float(norm["waste_percent"]),
                expected_qty,
                int(move_cursor.lastrowid),
                timestamp,
            ),
        )
    _refresh_work_actual(con, project_id, work_item_id, timestamp)
    return con.execute("SELECT * FROM project_work_facts WHERE id = ?", (fact_id,)).fetchone(), True


def reverse_work_fact(
    con: sqlite3.Connection,
    project_id: int,
    fact_id: int,
    reason: str,
    idempotency_key: str,
    actor_id: int | None,
    timestamp: int,
) -> tuple[sqlite3.Row, bool]:
    reason = str(reason or "").strip()
    if not reason:
        raise ValueError("work_fact_reversal_reason_required")
    idempotency_key = str(idempotency_key or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{8,100}", idempotency_key):
        raise ValueError("bad_work_fact_idempotency_key")
    duplicate = con.execute(
        "SELECT * FROM project_work_facts WHERE project_id = ? AND idempotency_key = ?",
        (project_id, idempotency_key),
    ).fetchone()
    if duplicate:
        if str(duplicate["entry_kind"]) != "reversal" or int(duplicate["reverses_fact_id"] or 0) != int(fact_id):
            raise ValueError("work_fact_idempotency_conflict")
        return duplicate, False
    original = con.execute(
        """
        SELECT * FROM project_work_facts
        WHERE id = ? AND project_id = ? AND entry_kind = 'fact'
        """,
        (fact_id, project_id),
    ).fetchone()
    if not original:
        raise ValueError("work_fact_not_found")
    already_reversed = con.execute(
        "SELECT * FROM project_work_facts WHERE reverses_fact_id = ?",
        (fact_id,),
    ).fetchone()
    if already_reversed:
        return already_reversed, False
    cursor = con.execute(
        """
        INSERT INTO project_work_facts (
            project_id, work_item_id, entry_kind, reverses_fact_id, report_date,
            quantity, work_title_snapshot, work_unit_snapshot, section_title_snapshot,
            comment, idempotency_key, created_by, created_at
        ) VALUES (?, ?, 'reversal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            original["work_item_id"],
            fact_id,
            date.today().isoformat(),
            _float(original["quantity"]),
            str(original["work_title_snapshot"]),
            str(original["work_unit_snapshot"]),
            str(original["section_title_snapshot"] or ""),
            reason[:1000],
            idempotency_key,
            actor_id,
            timestamp,
        ),
    )
    reversal_id = int(cursor.lastrowid)
    lines = con.execute(
        "SELECT * FROM project_work_fact_materials WHERE fact_id = ? ORDER BY id",
        (fact_id,),
    ).fetchall()
    for line in lines:
        restored_qty = -abs(_float(line["expected_qty"]))
        material_key = int(line["material_item_id"]) if line["material_item_id"] is not None else int(line["id"])
        source_key = f"work_fact_reversal:{reversal_id}:{material_key}"
        move_cursor = con.execute(
            """
            INSERT INTO stock_moves (
                project_id, estimate_item_id, move_type, qty, price, comment,
                created_by, created_at, source_type, source_id, source_key
            ) VALUES (?, ?, 'use', ?, 0, ?, ?, ?, 'work_fact_reversal', ?, ?)
            """,
            (
                project_id,
                line["material_item_id"],
                restored_qty,
                f"Сторно факта работ №{fact_id}: {reason[:300]}",
                actor_id,
                timestamp,
                reversal_id,
                source_key,
            ),
        )
        con.execute(
            """
            INSERT INTO project_work_fact_materials (
                fact_id, norm_id, material_item_id, material_title_snapshot,
                material_unit_snapshot, qty_per_work_unit, waste_percent,
                expected_qty, stock_move_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                reversal_id,
                line["norm_id"],
                line["material_item_id"],
                str(line["material_title_snapshot"]),
                str(line["material_unit_snapshot"]),
                _float(line["qty_per_work_unit"]),
                _float(line["waste_percent"]),
                restored_qty,
                int(move_cursor.lastrowid),
                timestamp,
            ),
        )
    _refresh_work_actual(con, project_id, original["work_item_id"], timestamp)
    return con.execute("SELECT * FROM project_work_facts WHERE id = ?", (reversal_id,)).fetchone(), True


def audit_payload(action: str, **values: object) -> str:
    return json.dumps({"action": action, **values}, ensure_ascii=False)
