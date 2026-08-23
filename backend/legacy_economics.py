from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from http import HTTPStatus
from pathlib import Path

import economics


SNAPSHOT_FORMAT_VERSION = 1
MONEY_SCALE = Decimal("100")
INTEGER_QUANTUM = Decimal("1")

BUDGET_CLASSIFICATIONS = {
    "contract_revenue_candidate",
    "target_cost_candidate",
    "reference_only",
    "ignore",
}
ESTIMATE_CLASSIFICATIONS = {
    "customer_commercial",
    "internal_cost",
    "mixed",
    "unknown",
}
TARGET_KINDS = {"revenue", "target_cost", "reference_only", "ignore"}
SOURCE_KINDS = {"project_budget", "estimate_item", "manual"}
VAT_MODES = {"net", "gross", "no_vat", "unknown"}
RESOLUTION_TYPES = {"acknowledged_warning", "excluded_source", "not_applicable"}
OPEN_REVIEW_STATUSES = {"unreviewed", "ready_for_review", "blocked_anomaly"}
TERMINAL_REVIEW_STATUSES = {"confirmed", "ignored"}
EVIDENCE_KEY_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")


def ensure_legacy_economics_schema(con: sqlite3.Connection) -> None:
    """Create the parallel, immutable legacy-classification store.

    This function intentionally does not read from or mutate any legacy column.
    It is safe to call repeatedly during application startup.
    """

    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS project_legacy_economics_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            format_version INTEGER NOT NULL DEFAULT 1 CHECK(format_version = 1),
            source_content_hash TEXT NOT NULL CHECK(length(source_content_hash) = 71),
            snapshot_hash TEXT NOT NULL UNIQUE CHECK(length(snapshot_hash) = 71),
            budget_sql_type TEXT NOT NULL,
            budget_sql_literal TEXT NOT NULL,
            budget_decimal TEXT,
            budget_kopecks INTEGER,
            paid_sql_type TEXT NOT NULL,
            paid_sql_literal TEXT NOT NULL,
            paid_decimal TEXT,
            paid_kopecks INTEGER,
            spent_sql_type TEXT NOT NULL,
            spent_sql_literal TEXT NOT NULL,
            spent_decimal TEXT,
            spent_kopecks INTEGER,
            estimate_item_count INTEGER NOT NULL CHECK(estimate_item_count >= 0),
            estimate_total_kopecks INTEGER,
            captured_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            captured_at INTEGER NOT NULL CHECK(captured_at > 0),
            UNIQUE(project_id, source_content_hash)
        );

        CREATE TABLE IF NOT EXISTS project_legacy_estimate_snapshot_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER NOT NULL
                REFERENCES project_legacy_economics_snapshots(id) ON DELETE CASCADE,
            position INTEGER NOT NULL CHECK(position > 0),
            source_estimate_item_id INTEGER NOT NULL CHECK(source_estimate_item_id > 0),
            title TEXT NOT NULL,
            unit TEXT NOT NULL,
            item_kind TEXT NOT NULL,
            section_title TEXT,
            article TEXT,
            planned_qty_sql_type TEXT NOT NULL,
            planned_qty_sql_literal TEXT NOT NULL,
            planned_qty_decimal TEXT,
            planned_price_sql_type TEXT NOT NULL,
            planned_price_sql_literal TEXT NOT NULL,
            planned_price_decimal TEXT,
            line_amount_kopecks INTEGER,
            observed_updated_at INTEGER,
            row_content_hash TEXT NOT NULL CHECK(length(row_content_hash) = 71),
            UNIQUE(snapshot_id, position),
            UNIQUE(snapshot_id, source_estimate_item_id)
        );

        CREATE TABLE IF NOT EXISTS project_legacy_migration_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            snapshot_id INTEGER NOT NULL
                REFERENCES project_legacy_economics_snapshots(id) ON DELETE RESTRICT,
            attempt_no INTEGER NOT NULL CHECK(attempt_no > 0),
            revision_no INTEGER NOT NULL DEFAULT 1 CHECK(revision_no > 0),
            status TEXT NOT NULL CHECK(status IN (
                'unreviewed','ready_for_review','blocked_anomaly','confirmed','ignored'
            )),
            budget_classification TEXT CHECK(budget_classification IS NULL OR budget_classification IN (
                'contract_revenue_candidate','target_cost_candidate','reference_only','ignore'
            )),
            estimate_classification TEXT CHECK(estimate_classification IS NULL OR estimate_classification IN (
                'customer_commercial','internal_cost','mixed','unknown'
            )),
            default_vat_mode TEXT CHECK(default_vat_mode IS NULL OR default_vat_mode IN (
                'net','gross','no_vat','unknown'
            )),
            default_vat_rate_basis_points INTEGER
                CHECK(default_vat_rate_basis_points IS NULL OR
                      default_vat_rate_basis_points BETWEEN 0 AND 10000),
            sources_comparable INTEGER CHECK(sources_comparable IS NULL OR sources_comparable IN (0,1)),
            effective_from TEXT,
            discrepancy_comment TEXT,
            decision_hash TEXT CHECK(decision_hash IS NULL OR length(decision_hash) = 71),
            generated_baseline_id INTEGER UNIQUE
                REFERENCES project_financial_baselines(id) ON DELETE RESTRICT,
            created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            updated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
            confirmed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
            confirmed_at INTEGER,
            ignored_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
            ignored_at INTEGER,
            ignore_reason TEXT,
            UNIQUE(snapshot_id, attempt_no),
            CHECK(
                (status = 'confirmed' AND generated_baseline_id IS NOT NULL
                    AND decision_hash IS NOT NULL AND confirmed_by IS NOT NULL
                    AND confirmed_at IS NOT NULL AND ignored_by IS NULL
                    AND ignored_at IS NULL AND ignore_reason IS NULL)
                OR
                (status = 'ignored' AND generated_baseline_id IS NULL
                    AND confirmed_by IS NULL AND confirmed_at IS NULL
                    AND ignored_by IS NOT NULL AND ignored_at IS NOT NULL
                    AND length(trim(ignore_reason)) > 0)
                OR
                (status IN ('unreviewed','ready_for_review','blocked_anomaly')
                    AND generated_baseline_id IS NULL AND decision_hash IS NULL
                    AND confirmed_by IS NULL AND confirmed_at IS NULL
                    AND ignored_by IS NULL AND ignored_at IS NULL
                    AND ignore_reason IS NULL)
            )
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_legacy_review_one_open
            ON project_legacy_migration_reviews(project_id)
            WHERE status IN ('unreviewed','ready_for_review','blocked_anomaly');

        CREATE TABLE IF NOT EXISTS project_legacy_migration_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL
                REFERENCES project_legacy_migration_reviews(id) ON DELETE CASCADE,
            evidence_key TEXT NOT NULL CHECK(length(trim(evidence_key)) > 0),
            evidence_kind TEXT NOT NULL DEFAULT 'document',
            document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
            document_title_snapshot TEXT NOT NULL,
            original_name_snapshot TEXT,
            storage_path_snapshot TEXT,
            size_bytes_snapshot INTEGER,
            content_hash TEXT CHECK(content_hash IS NULL OR length(content_hash) = 71),
            source_reference TEXT NOT NULL DEFAULT '',
            captured_at INTEGER NOT NULL CHECK(captured_at > 0),
            UNIQUE(review_id, evidence_key)
        );

        CREATE TABLE IF NOT EXISTS project_legacy_migration_decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL
                REFERENCES project_legacy_migration_reviews(id) ON DELETE CASCADE,
            source_key TEXT NOT NULL CHECK(length(trim(source_key)) > 0),
            source_kind TEXT NOT NULL CHECK(source_kind IN ('project_budget','estimate_item','manual')),
            snapshot_item_id INTEGER
                REFERENCES project_legacy_estimate_snapshot_items(id) ON DELETE RESTRICT,
            target_kind TEXT NOT NULL CHECK(target_kind IN ('revenue','target_cost','reference_only','ignore')),
            position INTEGER NOT NULL CHECK(position > 0),
            title TEXT NOT NULL CHECK(length(trim(title)) > 0),
            section_title TEXT,
            unit TEXT,
            quantity_decimal TEXT,
            line_type TEXT CHECK(line_type IS NULL OR line_type IN ('direct_cost','management_reserve')),
            cost_code TEXT,
            source_amount_kopecks INTEGER,
            vat_mode TEXT NOT NULL CHECK(vat_mode IN ('net','gross','no_vat','unknown')),
            vat_rate_basis_points INTEGER NOT NULL DEFAULT 0
                CHECK(vat_rate_basis_points BETWEEN 0 AND 10000),
            net_amount_kopecks INTEGER,
            vat_amount_kopecks INTEGER,
            gross_amount_kopecks INTEGER,
            evidence_key TEXT,
            comment TEXT NOT NULL DEFAULT '',
            generated_revenue_line_id INTEGER UNIQUE
                REFERENCES project_revenue_lines(id) ON DELETE RESTRICT,
            generated_budget_line_id INTEGER UNIQUE
                REFERENCES project_budget_lines(id) ON DELETE RESTRICT,
            created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            updated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
            UNIQUE(review_id, source_key),
            CHECK(
                (source_kind = 'estimate_item' AND snapshot_item_id IS NOT NULL)
                OR (source_kind IN ('project_budget','manual') AND snapshot_item_id IS NULL)
            ),
            CHECK(
                (net_amount_kopecks IS NULL AND vat_amount_kopecks IS NULL
                    AND gross_amount_kopecks IS NULL)
                OR
                (net_amount_kopecks IS NOT NULL AND vat_amount_kopecks IS NOT NULL
                    AND gross_amount_kopecks = net_amount_kopecks + vat_amount_kopecks)
            ),
            CHECK(vat_mode <> 'no_vat' OR
                  (vat_rate_basis_points = 0 AND COALESCE(vat_amount_kopecks, 0) = 0)),
            CHECK(NOT (generated_revenue_line_id IS NOT NULL
                       AND generated_budget_line_id IS NOT NULL))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_legacy_decision_one_budget
            ON project_legacy_migration_decisions(review_id)
            WHERE source_kind = 'project_budget';

        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_legacy_decision_one_item
            ON project_legacy_migration_decisions(review_id, snapshot_item_id)
            WHERE source_kind = 'estimate_item';

        CREATE TABLE IF NOT EXISTS project_legacy_migration_anomalies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER NOT NULL
                REFERENCES project_legacy_economics_snapshots(id) ON DELETE CASCADE,
            scope_kind TEXT NOT NULL CHECK(scope_kind IN ('project_budget','estimate','estimate_item')),
            snapshot_item_id INTEGER
                REFERENCES project_legacy_estimate_snapshot_items(id) ON DELETE RESTRICT,
            code TEXT NOT NULL CHECK(length(trim(code)) > 0),
            severity TEXT NOT NULL CHECK(severity IN ('blocking','warning')),
            fingerprint TEXT NOT NULL CHECK(length(fingerprint) = 71),
            details_json TEXT NOT NULL DEFAULT '{}',
            detected_at INTEGER NOT NULL CHECK(detected_at > 0),
            UNIQUE(snapshot_id, fingerprint)
        );

        CREATE TABLE IF NOT EXISTS project_legacy_migration_anomaly_resolutions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL
                REFERENCES project_legacy_migration_reviews(id) ON DELETE CASCADE,
            anomaly_id INTEGER NOT NULL
                REFERENCES project_legacy_migration_anomalies(id) ON DELETE RESTRICT,
            resolution TEXT NOT NULL CHECK(resolution IN (
                'acknowledged_warning','excluded_source','not_applicable'
            )),
            comment TEXT NOT NULL CHECK(length(trim(comment)) > 0),
            resolved_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            resolved_at INTEGER NOT NULL CHECK(resolved_at > 0),
            UNIQUE(review_id, anomaly_id)
        );

        CREATE INDEX IF NOT EXISTS idx_project_legacy_snapshots_project
            ON project_legacy_economics_snapshots(project_id, captured_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_project_legacy_reviews_project
            ON project_legacy_migration_reviews(project_id, created_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_project_legacy_snapshot_items_snapshot
            ON project_legacy_estimate_snapshot_items(snapshot_id, position, id);
        CREATE INDEX IF NOT EXISTS idx_project_legacy_anomalies_snapshot
            ON project_legacy_migration_anomalies(snapshot_id, severity, id);

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_snapshot_update_guard
        BEFORE UPDATE ON project_legacy_economics_snapshots
        BEGIN
            SELECT RAISE(ABORT, 'legacy_economics_snapshot_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_snapshot_delete_guard
        BEFORE DELETE ON project_legacy_economics_snapshots
        BEGIN
            SELECT RAISE(ABORT, 'legacy_economics_snapshot_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_snapshot_item_update_guard
        BEFORE UPDATE ON project_legacy_estimate_snapshot_items
        BEGIN
            SELECT RAISE(ABORT, 'legacy_estimate_snapshot_item_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_snapshot_item_delete_guard
        BEFORE DELETE ON project_legacy_estimate_snapshot_items
        BEGIN
            SELECT RAISE(ABORT, 'legacy_estimate_snapshot_item_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_anomaly_update_guard
        BEFORE UPDATE ON project_legacy_migration_anomalies
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_anomaly_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_anomaly_delete_guard
        BEFORE DELETE ON project_legacy_migration_anomalies
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_anomaly_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_review_project_guard
        BEFORE INSERT ON project_legacy_migration_reviews
        WHEN NOT EXISTS (
            SELECT 1 FROM project_legacy_economics_snapshots snapshot
            WHERE snapshot.id = NEW.snapshot_id AND snapshot.project_id = NEW.project_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_review_project_mismatch');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_review_terminal_guard
        BEFORE UPDATE ON project_legacy_migration_reviews
        WHEN OLD.status IN ('confirmed','ignored')
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_review_is_terminal');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_review_delete_guard
        BEFORE DELETE ON project_legacy_migration_reviews
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_review_cannot_be_deleted');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_decision_item_guard
        BEFORE INSERT ON project_legacy_migration_decisions
        WHEN NEW.snapshot_item_id IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM project_legacy_estimate_snapshot_items item
            JOIN project_legacy_migration_reviews review ON review.snapshot_id = item.snapshot_id
            WHERE item.id = NEW.snapshot_item_id AND review.id = NEW.review_id
        )
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_decision_snapshot_mismatch');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_management_reserve_insert_guard
        BEFORE INSERT ON project_legacy_migration_decisions
        WHEN NEW.target_kind = 'target_cost'
             AND NEW.line_type = 'management_reserve'
             AND NEW.source_kind <> 'manual'
        BEGIN
            SELECT RAISE(ABORT, 'legacy_management_reserve_requires_manual_source');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_management_reserve_update_guard
        BEFORE UPDATE ON project_legacy_migration_decisions
        WHEN NEW.target_kind = 'target_cost'
             AND NEW.line_type = 'management_reserve'
             AND NEW.source_kind <> 'manual'
        BEGIN
            SELECT RAISE(ABORT, 'legacy_management_reserve_requires_manual_source');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_decision_terminal_insert_guard
        BEFORE INSERT ON project_legacy_migration_decisions
        WHEN COALESCE((SELECT status FROM project_legacy_migration_reviews WHERE id = NEW.review_id), '')
             IN ('confirmed','ignored')
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_decisions_are_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_decision_terminal_update_guard
        BEFORE UPDATE ON project_legacy_migration_decisions
        WHEN COALESCE((SELECT status FROM project_legacy_migration_reviews WHERE id = OLD.review_id), '')
             IN ('confirmed','ignored')
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_decisions_are_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_decision_terminal_delete_guard
        BEFORE DELETE ON project_legacy_migration_decisions
        WHEN COALESCE((SELECT status FROM project_legacy_migration_reviews WHERE id = OLD.review_id), '')
             IN ('confirmed','ignored')
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_decisions_are_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_evidence_terminal_insert_guard
        BEFORE INSERT ON project_legacy_migration_evidence
        WHEN COALESCE((SELECT status FROM project_legacy_migration_reviews WHERE id = NEW.review_id), '')
             IN ('confirmed','ignored')
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_evidence_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_evidence_terminal_update_guard
        BEFORE UPDATE ON project_legacy_migration_evidence
        WHEN COALESCE((SELECT status FROM project_legacy_migration_reviews WHERE id = OLD.review_id), '')
             IN ('confirmed','ignored')
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_evidence_is_immutable');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_project_legacy_evidence_terminal_delete_guard
        BEFORE DELETE ON project_legacy_migration_evidence
        WHEN COALESCE((SELECT status FROM project_legacy_migration_reviews WHERE id = OLD.review_id), '')
             IN ('confirmed','ignored')
        BEGIN
            SELECT RAISE(ABORT, 'legacy_migration_evidence_is_immutable');
        END;
        """
    )


def _canonical_json(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def _sha256(value: object) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(value)).hexdigest()


def _canonical_decimal(value: object) -> tuple[Decimal | None, str | None]:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, None
    if not number.is_finite():
        return None, None
    if number == 0:
        return Decimal(0), "0"
    return number, format(number.normalize(), "f")


def _decimal_to_kopecks(value: Decimal | None) -> int | None:
    if value is None:
        return None
    return int((value * MONEY_SCALE).quantize(INTEGER_QUANTUM, rounding=ROUND_HALF_UP))


def _exact_int(value: object, error: str, *, minimum: int | None = None) -> int:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(error) from exc
    if not number.is_finite() or number != number.to_integral_value():
        raise ValueError(error)
    result = int(number)
    if minimum is not None and result < minimum:
        raise ValueError(error)
    return result


def _optional_bool(value: object) -> int | None:
    if value is None or value == "":
        return None
    if value in (True, 1, "1", "true", "True"):
        return 1
    if value in (False, 0, "0", "false", "False"):
        return 0
    raise ValueError("bad_sources_comparable")


def _normalized_key(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().lower().replace("ё", "е")
    text = re.sub(r"[^0-9a-zа-я]+", " ", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def _source_state(con: sqlite3.Connection, project_id: int) -> dict | None:
    project = con.execute(
        """
        SELECT id,
               budget, typeof(budget) AS budget_sql_type, quote(budget) AS budget_sql_literal,
               paid, typeof(paid) AS paid_sql_type, quote(paid) AS paid_sql_literal,
               spent, typeof(spent) AS spent_sql_type, quote(spent) AS spent_sql_literal
        FROM projects WHERE id = ?
        """,
        (project_id,),
    ).fetchone()
    if not project:
        return None
    rows = con.execute(
        """
        SELECT id, title, unit, planned_qty, planned_price,
               typeof(planned_qty) AS planned_qty_sql_type,
               quote(planned_qty) AS planned_qty_sql_literal,
               typeof(planned_price) AS planned_price_sql_type,
               quote(planned_price) AS planned_price_sql_literal,
               COALESCE(item_kind, 'material') AS item_kind,
               section_title, article, updated_at
        FROM estimate_items
        WHERE project_id = ?
        ORDER BY id
        """,
        (project_id,),
    ).fetchall()

    budget_value, budget_decimal = _canonical_decimal(project["budget"])
    paid_value, paid_decimal = _canonical_decimal(project["paid"])
    spent_value, spent_decimal = _canonical_decimal(project["spent"])
    normalized_items: list[dict] = []
    hash_items: list[dict] = []
    total: int | None = 0
    for position, row in enumerate(rows, start=1):
        qty_value, qty_decimal = _canonical_decimal(row["planned_qty"])
        price_value, price_decimal = _canonical_decimal(row["planned_price"])
        line_amount = (
            _decimal_to_kopecks(qty_value * price_value)
            if qty_value is not None and price_value is not None
            else None
        )
        if line_amount is None:
            total = None
        elif total is not None:
            total += line_amount
        row_hash_payload = {
            "id": int(row["id"]),
            "title": str(row["title"] or ""),
            "unit": str(row["unit"] or ""),
            "plannedQty": {
                "type": str(row["planned_qty_sql_type"]),
                "literal": str(row["planned_qty_sql_literal"]),
                "decimal": qty_decimal,
            },
            "plannedPrice": {
                "type": str(row["planned_price_sql_type"]),
                "literal": str(row["planned_price_sql_literal"]),
                "decimal": price_decimal,
            },
            "itemKind": str(row["item_kind"] or "material"),
            "sectionTitle": row["section_title"],
            "article": row["article"],
        }
        hash_items.append(row_hash_payload)
        normalized_items.append(
            {
                "position": position,
                "source_estimate_item_id": int(row["id"]),
                "title": str(row["title"] or ""),
                "unit": str(row["unit"] or ""),
                "item_kind": str(row["item_kind"] or "material"),
                "section_title": row["section_title"],
                "article": row["article"],
                "planned_qty_sql_type": str(row["planned_qty_sql_type"]),
                "planned_qty_sql_literal": str(row["planned_qty_sql_literal"]),
                "planned_qty_decimal": qty_decimal,
                "planned_price_sql_type": str(row["planned_price_sql_type"]),
                "planned_price_sql_literal": str(row["planned_price_sql_literal"]),
                "planned_price_decimal": price_decimal,
                "line_amount_kopecks": line_amount,
                "observed_updated_at": row["updated_at"],
                "row_content_hash": _sha256(row_hash_payload),
            }
        )

    source_payload = {
        "schemaVersion": SNAPSHOT_FORMAT_VERSION,
        "projectId": project_id,
        "project": {
            "budget": {
                "type": str(project["budget_sql_type"]),
                "literal": str(project["budget_sql_literal"]),
                "decimal": budget_decimal,
            },
            "paid": {
                "type": str(project["paid_sql_type"]),
                "literal": str(project["paid_sql_literal"]),
                "decimal": paid_decimal,
            },
            "spent": {
                "type": str(project["spent_sql_type"]),
                "literal": str(project["spent_sql_literal"]),
                "decimal": spent_decimal,
            },
        },
        "estimateItems": hash_items,
    }
    return {
        "source_content_hash": _sha256(source_payload),
        "budget_sql_type": str(project["budget_sql_type"]),
        "budget_sql_literal": str(project["budget_sql_literal"]),
        "budget_decimal": budget_decimal,
        "budget_kopecks": _decimal_to_kopecks(budget_value),
        "paid_sql_type": str(project["paid_sql_type"]),
        "paid_sql_literal": str(project["paid_sql_literal"]),
        "paid_decimal": paid_decimal,
        "paid_kopecks": _decimal_to_kopecks(paid_value),
        "spent_sql_type": str(project["spent_sql_type"]),
        "spent_sql_literal": str(project["spent_sql_literal"]),
        "spent_decimal": spent_decimal,
        "spent_kopecks": _decimal_to_kopecks(spent_value),
        "estimate_total_kopecks": total,
        "items": normalized_items,
    }


def _anomaly_fingerprint(
    snapshot_id: int,
    scope_kind: str,
    code: str,
    snapshot_item_id: int | None,
    details: dict,
) -> str:
    return _sha256(
        {
            "snapshotId": snapshot_id,
            "scopeKind": scope_kind,
            "snapshotItemId": snapshot_item_id,
            "code": code,
            "details": details,
        }
    )


def _insert_anomaly(
    con: sqlite3.Connection,
    snapshot_id: int,
    *,
    scope_kind: str,
    code: str,
    severity: str,
    snapshot_item_id: int | None,
    details: dict,
    timestamp: int,
) -> None:
    con.execute(
        """
        INSERT OR IGNORE INTO project_legacy_migration_anomalies (
            snapshot_id, scope_kind, snapshot_item_id, code, severity,
            fingerprint, details_json, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            snapshot_id,
            scope_kind,
            snapshot_item_id,
            code,
            severity,
            _anomaly_fingerprint(snapshot_id, scope_kind, code, snapshot_item_id, details),
            json.dumps(details, ensure_ascii=False, sort_keys=True),
            timestamp,
        ),
    )


def _detect_snapshot_anomalies(
    con: sqlite3.Connection, snapshot_id: int, timestamp: int
) -> None:
    snapshot = con.execute(
        "SELECT * FROM project_legacy_economics_snapshots WHERE id = ?", (snapshot_id,)
    ).fetchone()
    items = con.execute(
        """
        SELECT * FROM project_legacy_estimate_snapshot_items
        WHERE snapshot_id = ? ORDER BY position, id
        """,
        (snapshot_id,),
    ).fetchall()
    if not snapshot:
        return
    budget = snapshot["budget_kopecks"]
    total = snapshot["estimate_total_kopecks"]
    if budget is None:
        _insert_anomaly(
            con,
            snapshot_id,
            scope_kind="project_budget",
            code="invalid_legacy_budget",
            severity="blocking",
            snapshot_item_id=None,
            details={"sqlLiteral": snapshot["budget_sql_literal"]},
            timestamp=timestamp,
        )
    elif int(budget) < 0:
        _insert_anomaly(
            con,
            snapshot_id,
            scope_kind="project_budget",
            code="negative_legacy_budget",
            severity="blocking",
            snapshot_item_id=None,
            details={"amountKopecks": int(budget)},
            timestamp=timestamp,
        )

    duplicate_groups: dict[tuple[str, ...], list[sqlite3.Row]] = {}
    for item in items:
        item_id = int(item["id"])
        qty, _ = _canonical_decimal(item["planned_qty_decimal"])
        price, _ = _canonical_decimal(item["planned_price_decimal"])
        if qty is None or price is None:
            _insert_anomaly(
                con,
                snapshot_id,
                scope_kind="estimate_item",
                code="invalid_estimate_number",
                severity="blocking",
                snapshot_item_id=item_id,
                details={"sourceEstimateItemId": int(item["source_estimate_item_id"])},
                timestamp=timestamp,
            )
        else:
            if qty < 0:
                _insert_anomaly(
                    con,
                    snapshot_id,
                    scope_kind="estimate_item",
                    code="negative_estimate_quantity",
                    severity="blocking",
                    snapshot_item_id=item_id,
                    details={"quantity": item["planned_qty_decimal"]},
                    timestamp=timestamp,
                )
            if price < 0:
                _insert_anomaly(
                    con,
                    snapshot_id,
                    scope_kind="estimate_item",
                    code="negative_estimate_price",
                    severity="blocking",
                    snapshot_item_id=item_id,
                    details={"price": item["planned_price_decimal"]},
                    timestamp=timestamp,
                )
            if price == 0:
                _insert_anomaly(
                    con,
                    snapshot_id,
                    scope_kind="estimate_item",
                    code="zero_estimate_price",
                    severity="warning",
                    snapshot_item_id=item_id,
                    details={"sourceEstimateItemId": int(item["source_estimate_item_id"])},
                    timestamp=timestamp,
                )
        if _normalized_key(item["unit"]) in {"", "-", "?", "n a", "na"}:
            _insert_anomaly(
                con,
                snapshot_id,
                scope_kind="estimate_item",
                code="suspicious_estimate_unit",
                severity="warning",
                snapshot_item_id=item_id,
                details={"unit": str(item["unit"] or "")},
                timestamp=timestamp,
            )
        duplicate_key = (
            _normalized_key(item["title"]),
            _normalized_key(item["unit"]),
            _normalized_key(item["article"]),
            str(item["planned_qty_decimal"] or ""),
            str(item["planned_price_decimal"] or ""),
        )
        if duplicate_key[0]:
            duplicate_groups.setdefault(duplicate_key, []).append(item)

    for duplicate_items in duplicate_groups.values():
        if len(duplicate_items) < 2:
            continue
        source_ids = [int(item["source_estimate_item_id"]) for item in duplicate_items]
        for item in duplicate_items:
            _insert_anomaly(
                con,
                snapshot_id,
                scope_kind="estimate_item",
                code="probable_duplicate_estimate_item",
                severity="warning",
                snapshot_item_id=int(item["id"]),
                details={"sourceEstimateItemIds": source_ids},
                timestamp=timestamp,
            )

    if items and (total is None or int(total) <= 0):
        _insert_anomaly(
            con,
            snapshot_id,
            scope_kind="estimate",
            code="nonpositive_estimate_total",
            severity="blocking",
            snapshot_item_id=None,
            details={"estimateTotalKopecks": total},
            timestamp=timestamp,
        )
    if budget is not None and total is not None and int(budget) > 0 and int(total) > 0:
        budget_value = int(budget)
        total_value = int(total)
        if total_value * 100 < budget_value * 80 or total_value * 100 > budget_value * 120:
            _insert_anomaly(
                con,
                snapshot_id,
                scope_kind="estimate",
                code="estimate_budget_ratio_out_of_range",
                severity="blocking",
                snapshot_item_id=None,
                details={
                    "budgetKopecks": budget_value,
                    "estimateTotalKopecks": total_value,
                },
                timestamp=timestamp,
            )
        elif total_value != budget_value:
            _insert_anomaly(
                con,
                snapshot_id,
                scope_kind="estimate",
                code="estimate_budget_difference",
                severity="warning",
                snapshot_item_id=None,
                details={
                    "budgetKopecks": budget_value,
                    "estimateTotalKopecks": total_value,
                    "differenceKopecks": total_value - budget_value,
                },
                timestamp=timestamp,
            )
        for item in items:
            line_amount = item["line_amount_kopecks"]
            if line_amount is not None and abs(int(line_amount)) > budget_value * 10:
                _insert_anomaly(
                    con,
                    snapshot_id,
                    scope_kind="estimate_item",
                    code="estimate_line_exceeds_budget_tenfold",
                    severity="blocking",
                    snapshot_item_id=int(item["id"]),
                    details={
                        "lineAmountKopecks": int(line_amount),
                        "budgetKopecks": budget_value,
                    },
                    timestamp=timestamp,
                )


def _snapshot_status(con: sqlite3.Connection, snapshot_id: int) -> str:
    blocker = con.execute(
        """
        SELECT 1 FROM project_legacy_migration_anomalies
        WHERE snapshot_id = ? AND severity = 'blocking' LIMIT 1
        """,
        (snapshot_id,),
    ).fetchone()
    return "blocked_anomaly" if blocker else "ready_for_review"


def _capture_snapshot(
    con: sqlite3.Connection, project_id: int, user_id: int
) -> tuple[sqlite3.Row, bool]:
    state = _source_state(con, project_id)
    if state is None:
        raise LookupError("project_not_found")
    existing = con.execute(
        """
        SELECT * FROM project_legacy_economics_snapshots
        WHERE project_id = ? AND source_content_hash = ?
        """,
        (project_id, state["source_content_hash"]),
    ).fetchone()
    if existing:
        return existing, False

    timestamp = economics.now_ts()
    snapshot_hash = _sha256(
        {
            "sourceContentHash": state["source_content_hash"],
            "capturedAt": timestamp,
            "capturedBy": user_id,
        }
    )
    cursor = con.execute(
        """
        INSERT INTO project_legacy_economics_snapshots (
            project_id, format_version, source_content_hash, snapshot_hash,
            budget_sql_type, budget_sql_literal, budget_decimal, budget_kopecks,
            paid_sql_type, paid_sql_literal, paid_decimal, paid_kopecks,
            spent_sql_type, spent_sql_literal, spent_decimal, spent_kopecks,
            estimate_item_count, estimate_total_kopecks, captured_by, captured_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            SNAPSHOT_FORMAT_VERSION,
            state["source_content_hash"],
            snapshot_hash,
            state["budget_sql_type"],
            state["budget_sql_literal"],
            state["budget_decimal"],
            state["budget_kopecks"],
            state["paid_sql_type"],
            state["paid_sql_literal"],
            state["paid_decimal"],
            state["paid_kopecks"],
            state["spent_sql_type"],
            state["spent_sql_literal"],
            state["spent_decimal"],
            state["spent_kopecks"],
            len(state["items"]),
            state["estimate_total_kopecks"],
            user_id,
            timestamp,
        ),
    )
    snapshot_id = int(cursor.lastrowid)
    for item in state["items"]:
        con.execute(
            """
            INSERT INTO project_legacy_estimate_snapshot_items (
                snapshot_id, position, source_estimate_item_id, title, unit,
                item_kind, section_title, article, planned_qty_sql_type,
                planned_qty_sql_literal, planned_qty_decimal,
                planned_price_sql_type, planned_price_sql_literal,
                planned_price_decimal, line_amount_kopecks,
                observed_updated_at, row_content_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                snapshot_id,
                item["position"],
                item["source_estimate_item_id"],
                item["title"],
                item["unit"],
                item["item_kind"],
                item["section_title"],
                item["article"],
                item["planned_qty_sql_type"],
                item["planned_qty_sql_literal"],
                item["planned_qty_decimal"],
                item["planned_price_sql_type"],
                item["planned_price_sql_literal"],
                item["planned_price_decimal"],
                item["line_amount_kopecks"],
                item["observed_updated_at"],
                item["row_content_hash"],
            ),
        )
    _detect_snapshot_anomalies(con, snapshot_id, timestamp)
    return con.execute(
        "SELECT * FROM project_legacy_economics_snapshots WHERE id = ?", (snapshot_id,)
    ).fetchone(), True


def _document_file_hash(storage_path: object) -> str | None:
    text = str(storage_path or "").strip()
    if not text:
        return None
    path = Path(text)
    if not path.is_absolute():
        path = economics.PROJECT_ROOT / path
    try:
        resolved = path.resolve(strict=True)
        if not resolved.is_file():
            return None
        digest = hashlib.sha256()
        with resolved.open("rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
        return "sha256:" + digest.hexdigest()
    except OSError:
        return None


def _normalize_vat_amount(
    source_amount_kopecks: int | None, vat_mode: str, vat_rate_basis_points: int
) -> tuple[int | None, int | None, int | None]:
    if (
        source_amount_kopecks is None
        or source_amount_kopecks < 0
        or vat_mode == "unknown"
        or vat_mode not in VAT_MODES
        or vat_rate_basis_points < 0
        or vat_rate_basis_points > 10000
        or (vat_mode == "no_vat" and vat_rate_basis_points != 0)
    ):
        return None, None, None
    rate = Decimal(vat_rate_basis_points) / Decimal(10000)
    if vat_mode == "gross":
        gross = source_amount_kopecks
        net = (
            int(
                (Decimal(gross) / (Decimal(1) + rate)).quantize(
                    INTEGER_QUANTUM, rounding=ROUND_HALF_UP
                )
            )
            if rate
            else gross
        )
        vat = gross - net
    else:
        net = source_amount_kopecks
        vat = (
            int((Decimal(net) * rate).quantize(INTEGER_QUANTUM, rounding=ROUND_HALF_UP))
            if vat_mode == "net" and rate
            else 0
        )
        gross = net + vat
    return net, vat, gross


def _parse_details(value: object) -> dict:
    try:
        parsed = json.loads(str(value or "{}"))
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _serialize_snapshot_item(row: sqlite3.Row) -> dict:
    return {
        "id": int(row["id"]),
        "position": int(row["position"]),
        "sourceEstimateItemId": int(row["source_estimate_item_id"]),
        "title": str(row["title"]),
        "unit": str(row["unit"]),
        "itemKind": str(row["item_kind"]),
        "sectionTitle": row["section_title"],
        "article": row["article"],
        "plannedQty": row["planned_qty_decimal"],
        "plannedPrice": row["planned_price_decimal"],
        "lineAmountKopecks": row["line_amount_kopecks"],
        "rowContentHash": str(row["row_content_hash"]),
    }


def _serialize_decision(row: sqlite3.Row) -> dict:
    return {
        "id": int(row["id"]),
        "sourceKey": str(row["source_key"]),
        "sourceKind": str(row["source_kind"]),
        "snapshotItemId": row["snapshot_item_id"],
        "targetKind": str(row["target_kind"]),
        "position": int(row["position"]),
        "title": str(row["title"]),
        "sectionTitle": row["section_title"],
        "unit": row["unit"],
        "quantity": row["quantity_decimal"],
        "lineType": row["line_type"],
        "costCode": row["cost_code"],
        "sourceAmountKopecks": row["source_amount_kopecks"],
        "vatMode": str(row["vat_mode"]),
        "vatRateBasisPoints": int(row["vat_rate_basis_points"]),
        "netAmountKopecks": row["net_amount_kopecks"],
        "vatAmountKopecks": row["vat_amount_kopecks"],
        "grossAmountKopecks": row["gross_amount_kopecks"],
        "evidenceKey": row["evidence_key"],
        "comment": str(row["comment"]),
        "generatedRevenueLineId": row["generated_revenue_line_id"],
        "generatedBudgetLineId": row["generated_budget_line_id"],
    }


def _load_review_bundle(con: sqlite3.Connection, review_id: int) -> dict | None:
    review = con.execute(
        "SELECT * FROM project_legacy_migration_reviews WHERE id = ?", (review_id,)
    ).fetchone()
    if not review:
        return None
    snapshot = con.execute(
        "SELECT * FROM project_legacy_economics_snapshots WHERE id = ?",
        (review["snapshot_id"],),
    ).fetchone()
    items = con.execute(
        """
        SELECT * FROM project_legacy_estimate_snapshot_items
        WHERE snapshot_id = ? ORDER BY position, id
        """,
        (review["snapshot_id"],),
    ).fetchall()
    decisions = con.execute(
        """
        SELECT * FROM project_legacy_migration_decisions
        WHERE review_id = ? ORDER BY position, id
        """,
        (review_id,),
    ).fetchall()
    evidence = con.execute(
        """
        SELECT * FROM project_legacy_migration_evidence
        WHERE review_id = ? ORDER BY evidence_key, id
        """,
        (review_id,),
    ).fetchall()
    anomalies = con.execute(
        """
        SELECT anomaly.*, resolution.resolution, resolution.comment AS resolution_comment,
               resolution.resolved_by, resolution.resolved_at
        FROM project_legacy_migration_anomalies anomaly
        LEFT JOIN project_legacy_migration_anomaly_resolutions resolution
          ON resolution.anomaly_id = anomaly.id AND resolution.review_id = ?
        WHERE anomaly.snapshot_id = ?
        ORDER BY CASE anomaly.severity WHEN 'blocking' THEN 0 ELSE 1 END,
                 anomaly.id
        """,
        (review_id, review["snapshot_id"]),
    ).fetchall()
    return {
        "review": review,
        "snapshot": snapshot,
        "items": items,
        "decisions": decisions,
        "evidence": evidence,
        "anomalies": anomalies,
    }


def _serialize_review(bundle: dict, *, source_changed: bool | None = None) -> dict:
    review = bundle["review"]
    snapshot = bundle["snapshot"]
    payload = {
        "id": int(review["id"]),
        "projectId": int(review["project_id"]),
        "snapshotId": int(review["snapshot_id"]),
        "attemptNo": int(review["attempt_no"]),
        "revisionNo": int(review["revision_no"]),
        "status": str(review["status"]),
        "budgetClassification": review["budget_classification"],
        "estimateClassification": review["estimate_classification"],
        "defaultVatMode": review["default_vat_mode"],
        "defaultVatRateBasisPoints": review["default_vat_rate_basis_points"],
        "sourcesComparable": (
            bool(review["sources_comparable"])
            if review["sources_comparable"] is not None
            else None
        ),
        "effectiveFrom": review["effective_from"],
        "discrepancyComment": review["discrepancy_comment"],
        "decisionHash": review["decision_hash"],
        "generatedBaselineId": review["generated_baseline_id"],
        "createdBy": int(review["created_by"]),
        "createdAt": int(review["created_at"]),
        "updatedBy": int(review["updated_by"]),
        "updatedAt": int(review["updated_at"]),
        "confirmedBy": review["confirmed_by"],
        "confirmedAt": review["confirmed_at"],
        "ignoredBy": review["ignored_by"],
        "ignoredAt": review["ignored_at"],
        "ignoreReason": review["ignore_reason"],
        "snapshot": {
            "sourceContentHash": str(snapshot["source_content_hash"]),
            "snapshotHash": str(snapshot["snapshot_hash"]),
            "capturedAt": int(snapshot["captured_at"]),
            "legacyBudget": snapshot["budget_decimal"],
            "legacyBudgetKopecks": snapshot["budget_kopecks"],
            "legacyPaid": snapshot["paid_decimal"],
            "legacyPaidKopecks": snapshot["paid_kopecks"],
            "legacySpent": snapshot["spent_decimal"],
            "legacySpentKopecks": snapshot["spent_kopecks"],
            "estimateItemCount": int(snapshot["estimate_item_count"]),
            "estimateTotalKopecks": snapshot["estimate_total_kopecks"],
            "items": [_serialize_snapshot_item(item) for item in bundle["items"]],
        },
        "decisions": [_serialize_decision(item) for item in bundle["decisions"]],
        "evidence": [
            {
                "id": int(item["id"]),
                "key": str(item["evidence_key"]),
                "kind": str(item["evidence_kind"]),
                "documentId": int(item["document_id"]),
                "documentTitle": str(item["document_title_snapshot"]),
                "originalName": item["original_name_snapshot"],
                "sizeBytes": item["size_bytes_snapshot"],
                "contentHash": item["content_hash"],
                "sourceReference": str(item["source_reference"]),
            }
            for item in bundle["evidence"]
        ],
        "anomalies": [
            {
                "id": int(item["id"]),
                "scopeKind": str(item["scope_kind"]),
                "snapshotItemId": item["snapshot_item_id"],
                "code": str(item["code"]),
                "severity": str(item["severity"]),
                "details": _parse_details(item["details_json"]),
                "resolution": item["resolution"],
                "resolutionComment": item["resolution_comment"],
                "resolvedBy": item["resolved_by"],
                "resolvedAt": item["resolved_at"],
            }
            for item in bundle["anomalies"]
        ],
    }
    if source_changed is not None:
        payload["sourceChanged"] = source_changed
    return payload


def _require_review_access(handler, con: sqlite3.Connection, review_id: int) -> tuple[sqlite3.Row, dict] | None:
    review = con.execute(
        "SELECT * FROM project_legacy_migration_reviews WHERE id = ?", (review_id,)
    ).fetchone()
    if not review:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "legacy_migration_review_not_found"})
        return None
    user = economics.require_economics_access(
        handler, int(review["project_id"]), manage=True
    )
    if not user:
        return None
    return review, user


def api_project_legacy_economics_migration(handler, path: str) -> None:
    project_id = economics.parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = economics.require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    with economics.db() as con:
        ensure_legacy_economics_schema(con)
        rows = con.execute(
            """
            SELECT id FROM project_legacy_migration_reviews
            WHERE project_id = ? ORDER BY created_at DESC, id DESC
            """,
            (project_id,),
        ).fetchall()
        if not rows:
            project = con.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not project:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                return
            handler.send_json(HTTPStatus.OK, {"status": "not_scanned", "review": None, "history": []})
            return
        current_bundle = _load_review_bundle(con, int(rows[0]["id"]))
        current_state = _source_state(con, project_id)
        source_changed = bool(
            current_state
            and current_state["source_content_hash"]
            != current_bundle["snapshot"]["source_content_hash"]
        )
        history = []
        for row in rows:
            review = con.execute(
                """
                SELECT id, snapshot_id, attempt_no, revision_no, status,
                       generated_baseline_id, created_at, updated_at,
                       confirmed_at, ignored_at
                FROM project_legacy_migration_reviews WHERE id = ?
                """,
                (row["id"],),
            ).fetchone()
            history.append(dict(review))
        payload = {
            "status": str(current_bundle["review"]["status"]),
            "review": _serialize_review(current_bundle, source_changed=source_changed),
            "history": history,
        }
    handler.send_json(HTTPStatus.OK, payload)


def api_scan_project_legacy_economics(handler, path: str) -> None:
    project_id = economics.parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = economics.require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    with economics.db() as con:
        ensure_legacy_economics_schema(con)
        try:
            con.execute("BEGIN IMMEDIATE")
            confirmed_review = con.execute(
                """
                SELECT * FROM project_legacy_migration_reviews
                WHERE project_id = ? AND status = 'confirmed'
                      AND generated_baseline_id IS NOT NULL
                ORDER BY confirmed_at DESC, id DESC LIMIT 1
                """,
                (project_id,),
            ).fetchone()
            if confirmed_review:
                bundle = _load_review_bundle(con, int(confirmed_review["id"]))
                live_state = _source_state(con, project_id)
                live_hash = (
                    str(live_state["source_content_hash"])
                    if live_state is not None
                    else None
                )
                source_changed = bool(
                    live_hash
                    != str(bundle["snapshot"]["source_content_hash"])
                )
                con.commit()
                handler.send_json(
                    HTTPStatus.OK,
                    {
                        "status": "already_migrated",
                        "review": _serialize_review(
                            bundle, source_changed=source_changed
                        ),
                        "snapshotCreated": False,
                        "reviewCreated": False,
                        "idempotentReplay": True,
                        "alreadyMigrated": True,
                        "sourceChanged": source_changed,
                        "liveSourceContentHash": live_hash,
                        "generatedBaselineId": int(
                            confirmed_review["generated_baseline_id"]
                        ),
                    },
                )
                return
            snapshot, snapshot_created = _capture_snapshot(con, project_id, int(user["id"]))
            open_review = con.execute(
                """
                SELECT * FROM project_legacy_migration_reviews
                WHERE project_id = ? AND status IN (
                    'unreviewed','ready_for_review','blocked_anomaly'
                ) ORDER BY id DESC LIMIT 1
                """,
                (project_id,),
            ).fetchone()
            if open_review and int(open_review["snapshot_id"]) == int(snapshot["id"]):
                review = open_review
                review_created = False
            elif open_review:
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {
                        "error": "legacy_migration_open_review_exists",
                        "reviewId": int(open_review["id"]),
                    },
                )
                return
            else:
                attempt_no = int(
                    con.execute(
                        """
                        SELECT COALESCE(MAX(attempt_no), 0) + 1
                        FROM project_legacy_migration_reviews WHERE snapshot_id = ?
                        """,
                        (snapshot["id"],),
                    ).fetchone()[0]
                )
                timestamp = economics.now_ts()
                cursor = con.execute(
                    """
                    INSERT INTO project_legacy_migration_reviews (
                        project_id, snapshot_id, attempt_no, revision_no, status,
                        created_by, created_at, updated_by, updated_at
                    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        snapshot["id"],
                        attempt_no,
                        _snapshot_status(con, int(snapshot["id"])),
                        user["id"],
                        timestamp,
                        user["id"],
                        timestamp,
                    ),
                )
                review_id = int(cursor.lastrowid)
                economics.create_audit(
                    con,
                    int(user["id"]),
                    "scan_legacy_economics",
                    review_id,
                    {
                        "project_id": project_id,
                        "snapshot_id": int(snapshot["id"]),
                        "source_content_hash": str(snapshot["source_content_hash"]),
                        "snapshot_created": snapshot_created,
                    },
                    entity="project_legacy_migration_review",
                )
                review = con.execute(
                    "SELECT * FROM project_legacy_migration_reviews WHERE id = ?",
                    (review_id,),
                ).fetchone()
                review_created = True
            con.commit()
            bundle = _load_review_bundle(con, int(review["id"]))
        except (sqlite3.IntegrityError, ValueError) as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
        except LookupError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": str(exc)})
            return
    handler.send_json(
        HTTPStatus.CREATED if review_created else HTTPStatus.OK,
        {
            "review": _serialize_review(bundle, source_changed=False),
            "snapshotCreated": snapshot_created,
            "reviewCreated": review_created,
            "idempotentReplay": not snapshot_created and not review_created,
        },
    )


def _parse_evidence(
    con: sqlite3.Connection, project_id: int, payload: object
) -> list[dict]:
    if not isinstance(payload, list):
        raise ValueError("bad_legacy_migration_evidence")
    result = []
    keys: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("bad_legacy_migration_evidence")
        key = str(item.get("key", item.get("evidenceKey", ""))).strip()
        if not EVIDENCE_KEY_RE.fullmatch(key) or key in keys:
            raise ValueError("bad_legacy_evidence_key")
        keys.add(key)
        try:
            document_id = economics.optional_positive_int(
                item.get("documentId", item.get("document_id"))
            )
        except (TypeError, ValueError) as exc:
            raise ValueError("bad_legacy_evidence_document_id") from exc
        if document_id is None:
            raise ValueError("bad_legacy_evidence_document_id")
        document = con.execute(
            "SELECT * FROM documents WHERE id = ? AND project_id = ?",
            (document_id, project_id),
        ).fetchone()
        if not document:
            raise ValueError("legacy_evidence_document_not_found")
        result.append(
            {
                "evidence_key": key,
                "evidence_kind": str(item.get("kind", "document")).strip() or "document",
                "document_id": document_id,
                "document_title_snapshot": str(document["title"] or ""),
                "original_name_snapshot": document["original_name"],
                "storage_path_snapshot": document["storage_path"],
                "size_bytes_snapshot": document["size_bytes"],
                "content_hash": _document_file_hash(document["storage_path"]),
                "source_reference": str(
                    item.get("sourceReference", item.get("source_reference", ""))
                ).strip(),
            }
        )
    return result


def _decision_vat(
    item: dict, default_mode: str | None, default_rate: int | None
) -> tuple[str, int]:
    mode = str(
        item.get("vatMode", item.get("vat_mode", default_mode or "unknown"))
    ).strip()
    if mode not in VAT_MODES:
        raise ValueError("bad_legacy_vat_mode")
    rate = _exact_int(
        item.get(
            "vatRateBasisPoints",
            item.get("vat_rate_basis_points", default_rate if default_rate is not None else 0),
        ),
        "bad_legacy_vat_rate",
        minimum=0,
    )
    if rate > 10000 or (mode == "no_vat" and rate != 0):
        raise ValueError("bad_legacy_vat_rate")
    return mode, rate


def _parse_decisions(
    con: sqlite3.Connection,
    bundle: dict,
    payload: object,
    *,
    default_vat_mode: str | None,
    default_vat_rate: int | None,
) -> list[dict]:
    if not isinstance(payload, list):
        raise ValueError("bad_legacy_migration_decisions")
    snapshot = bundle["snapshot"]
    snapshot_items = {int(row["id"]): row for row in bundle["items"]}
    decisions: list[dict] = []
    source_keys: set[str] = set()
    budget_seen = False
    item_ids: set[int] = set()
    manual_keys: set[str] = set()
    for fallback_position, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError("bad_legacy_migration_decision")
        source_kind = str(item.get("sourceKind", item.get("source_kind", ""))).strip()
        target_kind = str(item.get("targetKind", item.get("target_kind", ""))).strip()
        if source_kind not in SOURCE_KINDS:
            raise ValueError("bad_legacy_source_kind")
        if target_kind not in TARGET_KINDS:
            raise ValueError("bad_legacy_target_kind")
        snapshot_item = None
        snapshot_item_id = None
        if source_kind == "project_budget":
            if budget_seen:
                raise ValueError("duplicate_legacy_budget_decision")
            budget_seen = True
            source_key = "project_budget"
            source_amount = snapshot["budget_kopecks"]
            default_title = "Legacy-бюджет"
            default_section = None
            default_unit = None
            quantity_decimal = None
        elif source_kind == "estimate_item":
            try:
                snapshot_item_id = economics.optional_positive_int(
                    item.get("snapshotItemId", item.get("snapshot_item_id"))
                )
            except (TypeError, ValueError) as exc:
                raise ValueError("bad_legacy_snapshot_item_id") from exc
            snapshot_item = snapshot_items.get(int(snapshot_item_id or 0))
            if not snapshot_item or int(snapshot_item_id) in item_ids:
                raise ValueError("bad_legacy_snapshot_item_id")
            item_ids.add(int(snapshot_item_id))
            source_key = f"estimate_item:{int(snapshot_item_id)}"
            source_amount = snapshot_item["line_amount_kopecks"]
            default_title = str(snapshot_item["title"])
            default_section = snapshot_item["section_title"]
            default_unit = str(snapshot_item["unit"])
            quantity_decimal = snapshot_item["planned_qty_decimal"]
        else:
            client_key = str(item.get("clientKey", item.get("client_key", ""))).strip()
            if not EVIDENCE_KEY_RE.fullmatch(client_key) or client_key in manual_keys:
                raise ValueError("bad_legacy_manual_line_key")
            manual_keys.add(client_key)
            source_key = f"manual:{client_key}"
            source_amount = _exact_int(
                item.get("sourceAmountKopecks", item.get("source_amount_kopecks")),
                "bad_legacy_manual_amount",
                minimum=0,
            )
            default_title = ""
            default_section = None
            default_unit = None
            quantity_raw = item.get("quantity")
            if quantity_raw in (None, ""):
                quantity_decimal = None
            else:
                quantity_value, quantity_decimal = _canonical_decimal(quantity_raw)
                if quantity_value is None or quantity_value < 0:
                    raise ValueError("bad_legacy_manual_quantity")
        if source_key in source_keys:
            raise ValueError("duplicate_legacy_source_decision")
        source_keys.add(source_key)
        title = str(item.get("title", default_title)).strip()
        if not title:
            raise ValueError("legacy_decision_title_required")
        mode, rate = _decision_vat(item, default_vat_mode, default_vat_rate)
        net, vat, gross = _normalize_vat_amount(source_amount, mode, rate)
        position = _exact_int(item.get("position", fallback_position), "bad_legacy_position", minimum=1)
        line_type = str(item.get("lineType", item.get("line_type", "direct_cost"))).strip()
        if target_kind == "target_cost" and line_type not in {"direct_cost", "management_reserve"}:
            raise ValueError("bad_legacy_line_type")
        if (
            target_kind == "target_cost"
            and line_type == "management_reserve"
            and source_kind != "manual"
        ):
            raise ValueError("legacy_management_reserve_requires_manual_source")
        if target_kind != "target_cost":
            line_type = None
        decisions.append(
            {
                "source_key": source_key,
                "source_kind": source_kind,
                "snapshot_item_id": snapshot_item_id,
                "target_kind": target_kind,
                "position": position,
                "title": title,
                "section_title": str(
                    item.get("sectionTitle", item.get("section_title", default_section or ""))
                ).strip()
                or None,
                "unit": str(item.get("unit", default_unit or "")).strip() or None,
                "quantity_decimal": quantity_decimal,
                "line_type": line_type,
                "cost_code": str(item.get("costCode", item.get("cost_code", ""))).strip()
                or None,
                "source_amount_kopecks": source_amount,
                "vat_mode": mode,
                "vat_rate_basis_points": rate,
                "net_amount_kopecks": net,
                "vat_amount_kopecks": vat,
                "gross_amount_kopecks": gross,
                "evidence_key": str(
                    item.get("evidenceKey", item.get("evidence_key", ""))
                ).strip()
                or None,
                "comment": str(item.get("comment", "")).strip(),
            }
        )
    return decisions


def _review_issue(bundle: dict) -> str | None:
    review = bundle["review"]
    if review["budget_classification"] not in BUDGET_CLASSIFICATIONS:
        return "legacy_budget_classification_required"
    if review["estimate_classification"] not in ESTIMATE_CLASSIFICATIONS:
        return "legacy_estimate_classification_required"
    try:
        date.fromisoformat(str(review["effective_from"] or ""))
    except ValueError:
        return "legacy_effective_from_required"
    if review["sources_comparable"] is None:
        return "legacy_sources_comparable_decision_required"
    snapshot = bundle["snapshot"]
    if (
        snapshot["budget_kopecks"] is not None
        and snapshot["estimate_total_kopecks"] is not None
        and int(snapshot["budget_kopecks"]) != int(snapshot["estimate_total_kopecks"])
        and not str(review["discrepancy_comment"] or "").strip()
    ):
        return "legacy_discrepancy_comment_required"

    decisions = bundle["decisions"]
    budget_decisions = [row for row in decisions if row["source_kind"] == "project_budget"]
    if len(budget_decisions) != 1:
        return "legacy_budget_decision_required"
    item_decisions = {
        int(row["snapshot_item_id"]): row
        for row in decisions
        if row["source_kind"] == "estimate_item"
    }
    if set(item_decisions) != {int(row["id"]) for row in bundle["items"]}:
        return "legacy_all_estimate_items_must_be_classified"

    budget_decision = budget_decisions[0]
    budget_class = str(review["budget_classification"])
    allowed_budget_targets = {
        "contract_revenue_candidate": {"revenue", "reference_only", "ignore"},
        "target_cost_candidate": {"target_cost", "reference_only", "ignore"},
        "reference_only": {"reference_only"},
        "ignore": {"ignore"},
    }[budget_class]
    if budget_decision["target_kind"] not in allowed_budget_targets:
        return "legacy_budget_target_mismatch"

    estimate_class = str(review["estimate_classification"])
    allowed_estimate_targets = {
        "customer_commercial": {"revenue", "reference_only", "ignore"},
        "internal_cost": {"target_cost", "reference_only", "ignore"},
        "mixed": TARGET_KINDS,
        "unknown": {"reference_only", "ignore"},
    }[estimate_class]
    if any(row["target_kind"] not in allowed_estimate_targets for row in item_decisions.values()):
        return "legacy_estimate_target_mismatch"

    evidence = {str(row["evidence_key"]): row for row in bundle["evidence"]}
    revenue_total = 0
    target_total = 0
    included_budget_targets: set[str] = set()
    included_estimate_targets: set[str] = set()
    for decision in decisions:
        target = str(decision["target_kind"])
        if target not in {"revenue", "target_cost"}:
            continue
        if not str(decision["comment"] or "").strip():
            return "legacy_decision_comment_required"
        if decision["vat_mode"] == "unknown":
            return "legacy_vat_mode_required"
        if decision["net_amount_kopecks"] is None or int(decision["net_amount_kopecks"]) <= 0:
            return "positive_legacy_migration_amount_required"
        evidence_row = evidence.get(str(decision["evidence_key"] or ""))
        if not evidence_row:
            return "legacy_evidence_required"
        if not str(evidence_row["source_reference"] or "").strip():
            return "legacy_evidence_reference_required"
        if not evidence_row["content_hash"]:
            return "legacy_evidence_file_required"
        if target == "revenue":
            revenue_total += int(decision["net_amount_kopecks"])
        else:
            target_total += int(decision["net_amount_kopecks"])
        if decision["source_kind"] == "project_budget":
            included_budget_targets.add(target)
        elif decision["source_kind"] == "estimate_item":
            included_estimate_targets.add(target)
    if included_budget_targets & included_estimate_targets:
        return "duplicate_legacy_aggregate_scope"
    if revenue_total <= 0:
        return "positive_baseline_revenue_required"
    if target_total <= 0:
        return "positive_baseline_target_cost_required"

    resolution_by_anomaly = {
        int(row["id"]): row for row in bundle["anomalies"] if row["resolution"]
    }
    for anomaly in bundle["anomalies"]:
        snapshot_item_id = anomaly["snapshot_item_id"]
        affected_excluded = False
        if snapshot_item_id is not None:
            decision = item_decisions.get(int(snapshot_item_id))
            affected_excluded = bool(
                decision and decision["target_kind"] in {"reference_only", "ignore"}
            )
        elif anomaly["scope_kind"] == "project_budget":
            affected_excluded = budget_decision["target_kind"] in {"reference_only", "ignore"}
        elif anomaly["scope_kind"] == "estimate":
            affected_excluded = all(
                row["target_kind"] in {"reference_only", "ignore"}
                for row in item_decisions.values()
            )
        if affected_excluded:
            continue
        resolution = resolution_by_anomaly.get(int(anomaly["id"]))
        if not resolution:
            return "legacy_anomaly_resolution_required"
        resolution_type = str(resolution["resolution"])
        if anomaly["severity"] == "warning":
            if resolution_type != "acknowledged_warning":
                return "legacy_warning_must_be_acknowledged"
        else:
            if (
                anomaly["code"] == "estimate_budget_ratio_out_of_range"
                and resolution_type == "not_applicable"
                and review["sources_comparable"] == 0
                and str(review["discrepancy_comment"] or "").strip()
            ):
                continue
            return "legacy_blocking_anomaly_unresolved"
    return None


def _review_status_from_bundle(bundle: dict) -> str:
    item_decisions = {
        int(row["snapshot_item_id"]): row
        for row in bundle["decisions"]
        if row["source_kind"] == "estimate_item"
    }
    budget_decision = next(
        (row for row in bundle["decisions"] if row["source_kind"] == "project_budget"),
        None,
    )
    resolutions = {
        int(row["id"]): row for row in bundle["anomalies"] if row["resolution"]
    }
    for anomaly in bundle["anomalies"]:
        if anomaly["severity"] != "blocking":
            continue
        if anomaly["snapshot_item_id"] is not None:
            decision = item_decisions.get(int(anomaly["snapshot_item_id"]))
            if decision and decision["target_kind"] in {"reference_only", "ignore"}:
                continue
        elif anomaly["scope_kind"] == "project_budget":
            if budget_decision and budget_decision["target_kind"] in {"reference_only", "ignore"}:
                continue
        elif anomaly["code"] == "estimate_budget_ratio_out_of_range":
            resolution = resolutions.get(int(anomaly["id"]))
            if (
                resolution
                and resolution["resolution"] == "not_applicable"
                and bundle["review"]["sources_comparable"] == 0
                and str(bundle["review"]["discrepancy_comment"] or "").strip()
            ):
                continue
        return "blocked_anomaly"
    return "ready_for_review"


def api_update_project_legacy_economics_review(handler, path: str) -> None:
    review_id = economics.parse_path_int(path, 2)
    if not review_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_legacy_migration_review_id"})
        return
    payload = handler.read_json()
    with economics.db() as con:
        ensure_legacy_economics_schema(con)
        loaded = _require_review_access(handler, con, review_id)
        if not loaded:
            return
        review, user = loaded
        if review["status"] in TERMINAL_REVIEW_STATUSES:
            handler.send_json(HTTPStatus.CONFLICT, {"error": "legacy_migration_review_is_terminal"})
            return
        try:
            expected_revision = _exact_int(
                payload.get("expectedRevision", payload.get("expected_revision")),
                "legacy_expected_revision_required",
                minimum=1,
            )
        except ValueError as exc:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        if expected_revision != int(review["revision_no"]):
            handler.send_json(HTTPStatus.CONFLICT, {"error": "legacy_review_revision_conflict"})
            return
        snapshot = con.execute(
            "SELECT * FROM project_legacy_economics_snapshots WHERE id = ?",
            (review["snapshot_id"],),
        ).fetchone()
        expected_hash = str(
            payload.get("expectedSourceContentHash", payload.get("expected_source_content_hash", ""))
        ).strip()
        if not expected_hash or expected_hash != str(snapshot["source_content_hash"]):
            handler.send_json(HTTPStatus.CONFLICT, {"error": "legacy_source_hash_conflict"})
            return
        try:
            budget_classification = str(
                payload.get("budgetClassification", review["budget_classification"] or "")
            ).strip() or None
            estimate_classification = str(
                payload.get("estimateClassification", review["estimate_classification"] or "")
            ).strip() or None
            if budget_classification is not None and budget_classification not in BUDGET_CLASSIFICATIONS:
                raise ValueError("bad_legacy_budget_classification")
            if estimate_classification is not None and estimate_classification not in ESTIMATE_CLASSIFICATIONS:
                raise ValueError("bad_legacy_estimate_classification")
            default_vat_mode = str(
                payload.get("defaultVatMode", review["default_vat_mode"] or "unknown")
            ).strip()
            if default_vat_mode not in VAT_MODES:
                raise ValueError("bad_legacy_vat_mode")
            default_vat_rate = _exact_int(
                payload.get(
                    "defaultVatRateBasisPoints",
                    review["default_vat_rate_basis_points"]
                    if review["default_vat_rate_basis_points"] is not None
                    else 0,
                ),
                "bad_legacy_vat_rate",
                minimum=0,
            )
            if default_vat_rate > 10000 or (
                default_vat_mode == "no_vat" and default_vat_rate != 0
            ):
                raise ValueError("bad_legacy_vat_rate")
            sources_comparable = _optional_bool(
                payload.get("sourcesComparable", review["sources_comparable"])
            )
            effective_from = economics.baseline_effective_date(
                payload.get("effectiveFrom", review["effective_from"])
            )
            discrepancy_comment = str(
                payload.get("discrepancyComment", review["discrepancy_comment"] or "")
            ).strip() or None
            existing_bundle = _load_review_bundle(con, review_id)
            evidence_payload = payload.get("evidence")
            decisions_payload = payload.get("decisions")
            resolutions_payload = payload.get("resolutions")
            parsed_evidence = (
                _parse_evidence(con, int(review["project_id"]), evidence_payload)
                if evidence_payload is not None
                else None
            )
            parsed_decisions = (
                _parse_decisions(
                    con,
                    existing_bundle,
                    decisions_payload,
                    default_vat_mode=default_vat_mode,
                    default_vat_rate=default_vat_rate,
                )
                if decisions_payload is not None
                else None
            )
            if resolutions_payload is not None and not isinstance(resolutions_payload, list):
                raise ValueError("bad_legacy_anomaly_resolutions")
        except (TypeError, ValueError) as exc:
            error = str(exc)
            status = (
                HTTPStatus.CONFLICT
                if error == "legacy_management_reserve_requires_manual_source"
                else HTTPStatus.BAD_REQUEST
            )
            handler.send_json(status, {"error": error})
            return

        try:
            con.execute("BEGIN IMMEDIATE")
            current = con.execute(
                "SELECT * FROM project_legacy_migration_reviews WHERE id = ?", (review_id,)
            ).fetchone()
            if int(current["revision_no"]) != expected_revision:
                con.rollback()
                handler.send_json(HTTPStatus.CONFLICT, {"error": "legacy_review_revision_conflict"})
                return
            timestamp = economics.now_ts()
            if parsed_decisions is not None:
                con.execute(
                    "DELETE FROM project_legacy_migration_decisions WHERE review_id = ?",
                    (review_id,),
                )
            if parsed_evidence is not None:
                con.execute(
                    "DELETE FROM project_legacy_migration_evidence WHERE review_id = ?",
                    (review_id,),
                )
                for item in parsed_evidence:
                    con.execute(
                        """
                        INSERT INTO project_legacy_migration_evidence (
                            review_id, evidence_key, evidence_kind, document_id,
                            document_title_snapshot, original_name_snapshot,
                            storage_path_snapshot, size_bytes_snapshot, content_hash,
                            source_reference, captured_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            review_id,
                            item["evidence_key"],
                            item["evidence_kind"],
                            item["document_id"],
                            item["document_title_snapshot"],
                            item["original_name_snapshot"],
                            item["storage_path_snapshot"],
                            item["size_bytes_snapshot"],
                            item["content_hash"],
                            item["source_reference"],
                            timestamp,
                        ),
                    )
            if parsed_decisions is not None:
                for item in parsed_decisions:
                    con.execute(
                        """
                        INSERT INTO project_legacy_migration_decisions (
                            review_id, source_key, source_kind, snapshot_item_id,
                            target_kind, position, title, section_title, unit,
                            quantity_decimal, line_type, cost_code,
                            source_amount_kopecks, vat_mode, vat_rate_basis_points,
                            net_amount_kopecks, vat_amount_kopecks,
                            gross_amount_kopecks, evidence_key, comment,
                            created_by, created_at, updated_by, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            review_id,
                            item["source_key"],
                            item["source_kind"],
                            item["snapshot_item_id"],
                            item["target_kind"],
                            item["position"],
                            item["title"],
                            item["section_title"],
                            item["unit"],
                            item["quantity_decimal"],
                            item["line_type"],
                            item["cost_code"],
                            item["source_amount_kopecks"],
                            item["vat_mode"],
                            item["vat_rate_basis_points"],
                            item["net_amount_kopecks"],
                            item["vat_amount_kopecks"],
                            item["gross_amount_kopecks"],
                            item["evidence_key"],
                            item["comment"],
                            user["id"],
                            timestamp,
                            user["id"],
                            timestamp,
                        ),
                    )
            if resolutions_payload is not None:
                con.execute(
                    "DELETE FROM project_legacy_migration_anomaly_resolutions WHERE review_id = ?",
                    (review_id,),
                )
                anomaly_ids = {
                    int(row["id"])
                    for row in con.execute(
                        """
                        SELECT id FROM project_legacy_migration_anomalies
                        WHERE snapshot_id = ?
                        """,
                        (review["snapshot_id"],),
                    ).fetchall()
                }
                seen: set[int] = set()
                for item in resolutions_payload:
                    if not isinstance(item, dict):
                        raise ValueError("bad_legacy_anomaly_resolution")
                    anomaly_id = _exact_int(
                        item.get("anomalyId", item.get("anomaly_id")),
                        "bad_legacy_anomaly_id",
                        minimum=1,
                    )
                    resolution = str(item.get("resolution", "")).strip()
                    comment = str(item.get("comment", "")).strip()
                    if (
                        anomaly_id not in anomaly_ids
                        or anomaly_id in seen
                        or resolution not in RESOLUTION_TYPES
                        or not comment
                    ):
                        raise ValueError("bad_legacy_anomaly_resolution")
                    seen.add(anomaly_id)
                    con.execute(
                        """
                        INSERT INTO project_legacy_migration_anomaly_resolutions (
                            review_id, anomaly_id, resolution, comment,
                            resolved_by, resolved_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (review_id, anomaly_id, resolution, comment, user["id"], timestamp),
                    )
            con.execute(
                """
                UPDATE project_legacy_migration_reviews
                SET budget_classification = ?, estimate_classification = ?,
                    default_vat_mode = ?, default_vat_rate_basis_points = ?,
                    sources_comparable = ?, effective_from = ?,
                    discrepancy_comment = ?, revision_no = revision_no + 1,
                    updated_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    budget_classification,
                    estimate_classification,
                    default_vat_mode,
                    default_vat_rate,
                    sources_comparable,
                    effective_from,
                    discrepancy_comment,
                    user["id"],
                    timestamp,
                    review_id,
                ),
            )
            provisional_bundle = _load_review_bundle(con, review_id)
            new_status = _review_status_from_bundle(provisional_bundle)
            con.execute(
                "UPDATE project_legacy_migration_reviews SET status = ? WHERE id = ?",
                (new_status, review_id),
            )
            economics.create_audit(
                con,
                int(user["id"]),
                "update_legacy_economics_review",
                review_id,
                {
                    "project_id": int(review["project_id"]),
                    "expected_revision": expected_revision,
                    "new_revision": expected_revision + 1,
                    "budget_classification": budget_classification,
                    "estimate_classification": estimate_classification,
                    "sources_comparable": (
                        bool(sources_comparable) if sources_comparable is not None else None
                    ),
                    "evidence_replaced": parsed_evidence is not None,
                    "decisions_replaced": parsed_decisions is not None,
                    "resolutions_replaced": resolutions_payload is not None,
                },
                entity="project_legacy_migration_review",
            )
            con.commit()
            bundle = _load_review_bundle(con, review_id)
        except (sqlite3.IntegrityError, ValueError) as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
    handler.send_json(HTTPStatus.OK, {"review": _serialize_review(bundle)})


def api_ignore_project_legacy_economics_review(handler, path: str) -> None:
    review_id = economics.parse_path_int(path, 2)
    if not review_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_legacy_migration_review_id"})
        return
    payload = handler.read_json()
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "legacy_ignore_reason_required"})
        return
    with economics.db() as con:
        ensure_legacy_economics_schema(con)
        try:
            con.execute("BEGIN IMMEDIATE")
            loaded = _require_review_access(handler, con, review_id)
            if not loaded:
                con.rollback()
                return
            review, user = loaded
            if review["status"] == "ignored":
                bundle = _load_review_bundle(con, review_id)
                con.commit()
                handler.send_json(
                    HTTPStatus.OK,
                    {"review": _serialize_review(bundle), "idempotentReplay": True},
                )
                return
            if review["status"] == "confirmed":
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {"error": "legacy_migration_review_is_terminal"},
                )
                return
            try:
                expected_revision = _exact_int(
                    payload.get("expectedRevision", payload.get("expected_revision")),
                    "legacy_expected_revision_required",
                    minimum=1,
                )
            except ValueError as exc:
                con.rollback()
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            if expected_revision != int(review["revision_no"]):
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT, {"error": "legacy_review_revision_conflict"}
                )
                return
            timestamp = economics.now_ts()
            cursor = con.execute(
                """
                UPDATE project_legacy_migration_reviews
                SET status = 'ignored', revision_no = revision_no + 1,
                    ignored_by = ?, ignored_at = ?, ignore_reason = ?,
                    updated_by = ?, updated_at = ?
                WHERE id = ? AND revision_no = ?
                      AND status IN ('unreviewed','ready_for_review','blocked_anomaly')
                """,
                (
                    user["id"],
                    timestamp,
                    reason,
                    user["id"],
                    timestamp,
                    review_id,
                    expected_revision,
                ),
            )
            if cursor.rowcount != 1:
                current = con.execute(
                    "SELECT status, revision_no FROM project_legacy_migration_reviews WHERE id = ?",
                    (review_id,),
                ).fetchone()
                con.rollback()
                if current and current["status"] == "ignored":
                    with economics.db() as replay_con:
                        ensure_legacy_economics_schema(replay_con)
                        bundle = _load_review_bundle(replay_con, review_id)
                    handler.send_json(
                        HTTPStatus.OK,
                        {"review": _serialize_review(bundle), "idempotentReplay": True},
                    )
                elif current and current["status"] == "confirmed":
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {"error": "legacy_migration_review_is_terminal"},
                    )
                else:
                    handler.send_json(
                        HTTPStatus.CONFLICT,
                        {"error": "legacy_review_revision_conflict"},
                    )
                return
            economics.create_audit(
                con,
                int(user["id"]),
                "ignore_legacy_economics_review",
                review_id,
                {"project_id": int(review["project_id"]), "reason": reason},
                entity="project_legacy_migration_review",
            )
            con.commit()
            bundle = _load_review_bundle(con, review_id)
        except sqlite3.IntegrityError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
    handler.send_json(HTTPStatus.OK, {"review": _serialize_review(bundle)})


def _verify_evidence(con: sqlite3.Connection, bundle: dict) -> str | None:
    project_id = int(bundle["review"]["project_id"])
    for evidence in bundle["evidence"]:
        document = con.execute(
            "SELECT * FROM documents WHERE id = ? AND project_id = ?",
            (evidence["document_id"], project_id),
        ).fetchone()
        if not document:
            return "legacy_evidence_document_not_found"
        current_hash = _document_file_hash(document["storage_path"])
        if not current_hash:
            return "legacy_evidence_file_required"
        if current_hash != evidence["content_hash"]:
            return "legacy_evidence_changed"
    return None


def _decision_hash(bundle: dict) -> str:
    review = bundle["review"]
    return _sha256(
        {
            "snapshotHash": str(bundle["snapshot"]["snapshot_hash"]),
            "budgetClassification": review["budget_classification"],
            "estimateClassification": review["estimate_classification"],
            "defaultVatMode": review["default_vat_mode"],
            "defaultVatRateBasisPoints": review["default_vat_rate_basis_points"],
            "sourcesComparable": review["sources_comparable"],
            "effectiveFrom": review["effective_from"],
            "discrepancyComment": review["discrepancy_comment"],
            "evidence": [
                {
                    "key": row["evidence_key"],
                    "documentId": row["document_id"],
                    "contentHash": row["content_hash"],
                    "sourceReference": row["source_reference"],
                }
                for row in sorted(bundle["evidence"], key=lambda item: str(item["evidence_key"]))
            ],
            "decisions": [
                {
                    key: row[key]
                    for key in (
                        "source_key",
                        "source_kind",
                        "snapshot_item_id",
                        "target_kind",
                        "position",
                        "title",
                        "section_title",
                        "unit",
                        "quantity_decimal",
                        "line_type",
                        "cost_code",
                        "source_amount_kopecks",
                        "vat_mode",
                        "vat_rate_basis_points",
                        "net_amount_kopecks",
                        "vat_amount_kopecks",
                        "gross_amount_kopecks",
                        "evidence_key",
                        "comment",
                    )
                }
                for row in sorted(bundle["decisions"], key=lambda item: (int(item["position"]), int(item["id"])))
            ],
            "resolutions": [
                {
                    "anomalyId": row["id"],
                    "resolution": row["resolution"],
                    "comment": row["resolution_comment"],
                }
                for row in bundle["anomalies"]
                if row["resolution"]
            ],
        }
    )


def _unit_net_kopecks(net_amount: int, quantity_decimal: object) -> int | None:
    quantity, _ = _canonical_decimal(quantity_decimal)
    if quantity is None or quantity <= 0:
        return None
    return int(
        (Decimal(net_amount) / quantity).quantize(INTEGER_QUANTUM, rounding=ROUND_HALF_UP)
    )


def _source_reference(bundle: dict, decision: sqlite3.Row) -> str:
    snapshot = bundle["snapshot"]
    item_hash = "none"
    if decision["snapshot_item_id"] is not None:
        item = next(
            row for row in bundle["items"] if int(row["id"]) == int(decision["snapshot_item_id"])
        )
        item_hash = str(item["row_content_hash"])
    evidence = next(
        row
        for row in bundle["evidence"]
        if str(row["evidence_key"]) == str(decision["evidence_key"])
    )
    return (
        f"legacy-snapshot:{int(snapshot['id'])}:"
        f"{snapshot['source_content_hash']}:{decision['source_key']}:"
        f"{item_hash}|{evidence['source_reference']}"
    )


def _insert_baseline_from_review(
    con: sqlite3.Connection, bundle: dict, user_id: int
) -> tuple[int, int]:
    review = bundle["review"]
    project_id = int(review["project_id"])
    version_no = int(
        con.execute(
            """
            SELECT COALESCE(MAX(version_no), 0) + 1
            FROM project_financial_baselines WHERE project_id = ?
            """,
            (project_id,),
        ).fetchone()[0]
    )
    evidence_by_key = {str(row["evidence_key"]): row for row in bundle["evidence"]}
    included = [
        row for row in bundle["decisions"] if row["target_kind"] in {"revenue", "target_cost"}
    ]
    primary_document_id = int(evidence_by_key[str(included[0]["evidence_key"])]["document_id"])
    timestamp = economics.now_ts()
    cursor = con.execute(
        """
        INSERT INTO project_financial_baselines (
            project_id, version_no, status, currency_code, source_snapshot_hash,
            source_document_id, effective_from, reason, created_by,
            created_at, updated_at
        ) VALUES (?, ?, 'draft', 'RUB', 'sha256:draft', ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            version_no,
            primary_document_id,
            review["effective_from"],
            f"Legacy migration review #{int(review['id'])}, snapshot #{int(review['snapshot_id'])}",
            user_id,
            timestamp,
            timestamp,
        ),
    )
    baseline_id = int(cursor.lastrowid)
    revenue_position = 0
    budget_position = 0
    for decision in sorted(included, key=lambda row: (int(row["position"]), int(row["id"]))):
        evidence = evidence_by_key[str(decision["evidence_key"])]
        estimate_item_id = None
        if decision["source_kind"] == "estimate_item":
            snapshot_item = next(
                row for row in bundle["items"] if int(row["id"]) == int(decision["snapshot_item_id"])
            )
            estimate_item_id = int(snapshot_item["source_estimate_item_id"])
        quantity = None
        quantity_value, _ = _canonical_decimal(decision["quantity_decimal"])
        if quantity_value is not None:
            quantity = float(quantity_value)
        net_amount = int(decision["net_amount_kopecks"])
        unit_net = _unit_net_kopecks(net_amount, decision["quantity_decimal"])
        source_reference = _source_reference(bundle, decision)
        if decision["target_kind"] == "revenue":
            revenue_position += 1
            source_type = (
                "estimate"
                if decision["source_kind"] == "estimate_item"
                else "contract"
                if decision["source_kind"] == "project_budget"
                else "manual"
            )
            line_cursor = con.execute(
                """
                INSERT INTO project_revenue_lines (
                    baseline_id, position, estimate_item_id, title, section_title,
                    unit, quantity, unit_price_net_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                    source_vat_mode, source_type, source_document_id,
                    source_reference, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    baseline_id,
                    revenue_position,
                    estimate_item_id,
                    decision["title"],
                    decision["section_title"],
                    decision["unit"],
                    quantity,
                    unit_net,
                    net_amount,
                    decision["vat_rate_basis_points"],
                    decision["vat_amount_kopecks"],
                    decision["gross_amount_kopecks"],
                    decision["vat_mode"],
                    source_type,
                    evidence["document_id"],
                    source_reference,
                    user_id,
                    timestamp,
                ),
            )
            con.execute(
                """
                UPDATE project_legacy_migration_decisions
                SET generated_revenue_line_id = ?, updated_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (line_cursor.lastrowid, user_id, timestamp, decision["id"]),
            )
        else:
            budget_position += 1
            source_type = (
                "estimate"
                if decision["source_kind"] == "estimate_item"
                else "policy"
                if decision["source_kind"] == "project_budget"
                or decision["line_type"] == "management_reserve"
                else "manual"
            )
            line_cursor = con.execute(
                """
                INSERT INTO project_budget_lines (
                    baseline_id, position, line_type, cost_code, estimate_item_id,
                    title, section_title, unit, quantity, unit_cost_net_kopecks,
                    net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, source_type,
                    source_document_id, source_reference, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    baseline_id,
                    budget_position,
                    decision["line_type"] or "direct_cost",
                    decision["cost_code"],
                    estimate_item_id,
                    decision["title"],
                    decision["section_title"],
                    decision["unit"],
                    quantity,
                    unit_net,
                    net_amount,
                    decision["vat_rate_basis_points"],
                    decision["vat_amount_kopecks"],
                    decision["gross_amount_kopecks"],
                    decision["vat_mode"],
                    source_type,
                    evidence["document_id"],
                    source_reference,
                    user_id,
                    timestamp,
                ),
            )
            con.execute(
                """
                UPDATE project_legacy_migration_decisions
                SET generated_budget_line_id = ?, updated_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (line_cursor.lastrowid, user_id, timestamp, decision["id"]),
            )
    issue = economics.baseline_submission_issue(con, baseline_id)
    if issue:
        raise ValueError(issue)
    baseline_hash = economics.refresh_baseline_snapshot_hash(con, baseline_id)
    con.execute(
        """
        UPDATE project_financial_baselines
        SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
        WHERE id = ?
        """,
        (user_id, timestamp, timestamp, baseline_id),
    )
    economics.create_audit(
        con,
        user_id,
        "create_financial_baseline_from_legacy_review",
        baseline_id,
        {
            "project_id": project_id,
            "version_no": version_no,
            "legacy_review_id": int(review["id"]),
            "legacy_snapshot_id": int(review["snapshot_id"]),
            "baseline_snapshot_hash": baseline_hash,
        },
        entity="project_financial_baseline",
    )
    economics.create_audit(
        con,
        user_id,
        "submit_financial_baseline",
        baseline_id,
        {
            "project_id": project_id,
            "version_no": version_no,
            "source_snapshot_hash": baseline_hash,
            "legacy_review_id": int(review["id"]),
        },
        entity="project_financial_baseline",
    )
    return baseline_id, version_no


def api_confirm_project_legacy_economics_review(handler, path: str) -> None:
    review_id = economics.parse_path_int(path, 2)
    if not review_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_legacy_migration_review_id"})
        return
    payload = handler.read_json()
    with economics.db() as con:
        ensure_legacy_economics_schema(con)
        loaded = _require_review_access(handler, con, review_id)
        if not loaded:
            return
        review, user = loaded
        if review["status"] == "confirmed" and review["generated_baseline_id"] is not None:
            baseline_id = int(review["generated_baseline_id"])
            baseline, revenue, budget, events = economics.load_baseline_details(con, baseline_id)
            handler.send_json(
                HTTPStatus.OK,
                {
                    "review": _serialize_review(_load_review_bundle(con, review_id)),
                    "baseline": economics.serialize_financial_baseline(
                        baseline, revenue, budget, events
                    ),
                    "idempotentReplay": True,
                },
            )
            return
        if review["status"] == "ignored":
            handler.send_json(HTTPStatus.CONFLICT, {"error": "legacy_migration_review_is_terminal"})
            return
        try:
            expected_revision = _exact_int(
                payload.get("expectedRevision", payload.get("expected_revision")),
                "legacy_expected_revision_required",
                minimum=1,
            )
        except ValueError as exc:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        expected_hash = str(
            payload.get("expectedSourceContentHash", payload.get("expected_source_content_hash", ""))
        ).strip()
        if expected_revision != int(review["revision_no"]):
            handler.send_json(HTTPStatus.CONFLICT, {"error": "legacy_review_revision_conflict"})
            return
        try:
            con.execute("BEGIN IMMEDIATE")
            bundle = _load_review_bundle(con, review_id)
            review = bundle["review"]
            if int(review["revision_no"]) != expected_revision:
                raise ValueError("legacy_review_revision_conflict")
            if expected_hash != str(bundle["snapshot"]["source_content_hash"]):
                raise ValueError("legacy_source_hash_conflict")
            live_state = _source_state(con, int(review["project_id"]))
            if (
                not live_state
                or live_state["source_content_hash"]
                != bundle["snapshot"]["source_content_hash"]
            ):
                raise ValueError("legacy_source_changed_rescan_required")
            issue = _review_issue(bundle)
            if issue:
                raise ValueError(issue)
            issue = _verify_evidence(con, bundle)
            if issue:
                raise ValueError(issue)
            existing_baseline = con.execute(
                """
                SELECT id, status FROM project_financial_baselines
                WHERE project_id = ? ORDER BY version_no DESC, id DESC LIMIT 1
                """,
                (review["project_id"],),
            ).fetchone()
            if existing_baseline:
                raise ValueError("project_financial_baseline_already_exists")
            calculated_decision_hash = _decision_hash(bundle)
            baseline_id, version_no = _insert_baseline_from_review(
                con, bundle, int(user["id"])
            )
            timestamp = economics.now_ts()
            con.execute(
                """
                UPDATE project_legacy_migration_reviews
                SET status = 'confirmed', revision_no = revision_no + 1,
                    decision_hash = ?, generated_baseline_id = ?,
                    confirmed_by = ?, confirmed_at = ?,
                    updated_by = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    calculated_decision_hash,
                    baseline_id,
                    user["id"],
                    timestamp,
                    user["id"],
                    timestamp,
                    review_id,
                ),
            )
            economics.create_audit(
                con,
                int(user["id"]),
                "confirm_legacy_economics_review",
                review_id,
                {
                    "project_id": int(review["project_id"]),
                    "snapshot_id": int(review["snapshot_id"]),
                    "source_content_hash": str(bundle["snapshot"]["source_content_hash"]),
                    "decision_hash": calculated_decision_hash,
                    "generated_baseline_id": baseline_id,
                    "baseline_version_no": version_no,
                },
                entity="project_legacy_migration_review",
            )
            con.commit()
            confirmed_bundle = _load_review_bundle(con, review_id)
            baseline, revenue, budget, events = economics.load_baseline_details(con, baseline_id)
        except (sqlite3.IntegrityError, ValueError) as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
    handler.send_json(
        HTTPStatus.CREATED,
        {
            "review": _serialize_review(confirmed_bundle),
            "baseline": economics.serialize_financial_baseline(
                baseline, revenue, budget, events
            ),
            "idempotentReplay": False,
        },
    )


__all__ = [
    "ensure_legacy_economics_schema",
    "api_project_legacy_economics_migration",
    "api_scan_project_legacy_economics",
    "api_update_project_legacy_economics_review",
    "api_ignore_project_legacy_economics_review",
    "api_confirm_project_legacy_economics_review",
]
