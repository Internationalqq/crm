from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from http import HTTPStatus
from pathlib import Path

from auth import user_can_manage_project_economics, user_can_view_project_economics
from sqlite_config import configure_connection


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
MONEY_QUANTUM = Decimal("0.01")


def now_ts() -> int:
    return int(time.time())


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return configure_connection(sqlite3.connect(DB_PATH))


def parse_path_int(path: str, index: int) -> int | None:
    parts = path.strip("/").split("/")
    try:
        return int(parts[index])
    except (IndexError, TypeError, ValueError):
        return None


def create_audit(
    con: sqlite3.Connection,
    user_id: int,
    action: str,
    entity_id: int,
    payload: dict,
    entity: str = "project_commitment",
) -> None:
    con.execute(
        """
        INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, action, entity, entity_id, json.dumps(payload, ensure_ascii=False), now_ts()),
    )


def create_commitment_event(
    con: sqlite3.Connection,
    commitment_id: int,
    project_id: int,
    action: str,
    actor_id: int,
    details: dict | None = None,
) -> None:
    con.execute(
        """
        INSERT INTO project_commitment_events (
            commitment_id, project_id, action, actor_id, details, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            commitment_id,
            project_id,
            action,
            actor_id,
            json.dumps(details or {}, ensure_ascii=False),
            now_ts(),
        ),
    )


def decimal_value(value: object) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("invalid_decimal") from exc
    if not result.is_finite():
        raise ValueError("invalid_decimal")
    return result


def decimal_to_kopecks(value: Decimal) -> int:
    return int((value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP) * 100).to_integral_exact())


def normalize_offer_amounts(
    price: object,
    quantity: object,
    vat_mode: str,
    vat_rate_basis_points: int,
) -> dict[str, int | float]:
    price_value = decimal_value(price)
    quantity_value = decimal_value(quantity)
    if price_value <= 0 or quantity_value <= 0:
        raise ValueError("price_and_quantity_must_be_positive")
    if vat_mode not in {"net", "gross", "no_vat"}:
        raise ValueError("bad_vat_mode")
    if vat_rate_basis_points < 0 or vat_rate_basis_points > 10000:
        raise ValueError("bad_vat_rate")
    if vat_mode == "no_vat" and vat_rate_basis_points != 0:
        raise ValueError("no_vat_rate_must_be_zero")

    rate = Decimal(vat_rate_basis_points) / Decimal(10000)
    source_unit_price_kopecks = decimal_to_kopecks(price_value)
    source_total = price_value * quantity_value

    if vat_mode == "gross":
        gross_amount_kopecks = decimal_to_kopecks(source_total)
        net_total = source_total / (Decimal(1) + rate) if rate else source_total
        net_amount_kopecks = decimal_to_kopecks(net_total)
        vat_amount_kopecks = gross_amount_kopecks - net_amount_kopecks
        unit_net = price_value / (Decimal(1) + rate) if rate else price_value
    else:
        net_amount_kopecks = decimal_to_kopecks(source_total)
        vat_amount_kopecks = (
            decimal_to_kopecks(source_total * rate)
            if vat_mode == "net" and vat_rate_basis_points
            else 0
        )
        gross_amount_kopecks = net_amount_kopecks + vat_amount_kopecks
        unit_net = price_value

    return {
        "quantity": float(quantity_value),
        "source_unit_price_kopecks": source_unit_price_kopecks,
        "unit_cost_net_kopecks": decimal_to_kopecks(unit_net),
        "net_amount_kopecks": net_amount_kopecks,
        "vat_amount_kopecks": vat_amount_kopecks,
        "gross_amount_kopecks": gross_amount_kopecks,
    }


def require_economics_access(handler, project_id: int, *, manage: bool) -> dict | None:
    user = handler.require_project_access(project_id)
    if not user:
        return None
    allowed = (
        user_can_manage_project_economics(user)
        if manage
        else user_can_view_project_economics(user)
    )
    if not allowed:
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return None
    return user


BASELINE_REVENUE_SOURCE_TYPES = {"estimate", "contract", "manual"}
BASELINE_BUDGET_SOURCE_TYPES = {"estimate", "policy", "manual"}
BASELINE_VAT_MODES = {"net", "gross", "no_vat"}
BASELINE_SUCCESSOR_MAPPING_KINDS = {"carry_forward", "merge", "reclassified"}


def exact_nonnegative_int(value: object, error: str) -> int:
    try:
        number = decimal_value(value)
    except ValueError as exc:
        raise ValueError(error) from exc
    integral = number.to_integral_value()
    if number != integral or integral < 0:
        raise ValueError(error)
    return int(integral)


def baseline_effective_date(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("bad_effective_from") from exc
    return text


def baseline_line_amounts(payload: dict) -> dict[str, int]:
    vat_mode = str(payload_value(payload, "vatMode", "source_vat_mode", "")).strip()
    if vat_mode not in BASELINE_VAT_MODES:
        raise ValueError("bad_vat_mode")
    vat_rate = exact_nonnegative_int(
        payload_value(payload, "vatRateBasisPoints", "vat_rate_basis_points", 0),
        "bad_vat_rate",
    )
    if vat_rate > 10000:
        raise ValueError("bad_vat_rate")
    if vat_mode == "no_vat" and vat_rate != 0:
        raise ValueError("no_vat_rate_must_be_zero")
    source_amount = exact_nonnegative_int(
        payload_value(
            payload,
            "sourceAmountKopecks",
            "source_amount_kopecks",
            payload_value(payload, "amountKopecks", "amount_kopecks"),
        ),
        "bad_source_amount",
    )
    rate = Decimal(vat_rate) / Decimal(10000)
    if vat_mode == "gross":
        gross = source_amount
        net = int(
            (Decimal(gross) / (Decimal(1) + rate)).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        ) if rate else gross
        vat = gross - net
    else:
        net = source_amount
        vat = int(
            (Decimal(net) * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        ) if vat_mode == "net" and vat_rate else 0
        gross = net + vat
    return {
        "net_amount_kopecks": net,
        "vat_rate_basis_points": vat_rate,
        "vat_amount_kopecks": vat,
        "gross_amount_kopecks": gross,
    }


def normalize_baseline_line(payload: object, *, line_kind: str) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("bad_baseline_line")
    title = str(payload.get("title", "")).strip()
    source_reference = str(
        payload_value(payload, "sourceReference", "source_reference", "")
    ).strip()
    if not title:
        raise ValueError("baseline_line_title_required")
    if not source_reference:
        raise ValueError("baseline_line_source_reference_required")
    source_type = str(payload_value(payload, "sourceType", "source_type", "")).strip()
    allowed_source_types = (
        BASELINE_REVENUE_SOURCE_TYPES
        if line_kind == "revenue"
        else BASELINE_BUDGET_SOURCE_TYPES
    )
    if source_type not in allowed_source_types:
        raise ValueError(f"bad_{line_kind}_source_type")
    try:
        estimate_item_id = optional_positive_int(
            payload_value(payload, "estimateItemId", "estimate_item_id")
        )
        source_document_id = optional_positive_int(
            payload_value(payload, "sourceDocumentId", "source_document_id")
        )
    except (TypeError, ValueError) as exc:
        raise ValueError("bad_baseline_relation_id") from exc
    quantity_raw = payload.get("quantity")
    quantity: float | None = None
    quantity_decimal: Decimal | None = None
    if quantity_raw not in (None, ""):
        try:
            quantity_decimal = decimal_value(quantity_raw)
        except ValueError as exc:
            raise ValueError("bad_baseline_quantity") from exc
        if quantity_decimal < 0:
            raise ValueError("bad_baseline_quantity")
        quantity = float(quantity_decimal)
    amounts = baseline_line_amounts(payload)
    unit_net_kopecks = None
    if quantity_decimal is not None and quantity_decimal > 0:
        unit_net_kopecks = int(
            (Decimal(amounts["net_amount_kopecks"]) / quantity_decimal).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
    line = {
        "estimate_item_id": estimate_item_id,
        "title": title,
        "section_title": str(
            payload_value(payload, "sectionTitle", "section_title", "")
        ).strip() or None,
        "unit": str(payload.get("unit", "")).strip() or None,
        "quantity": quantity,
        "unit_net_kopecks": unit_net_kopecks,
        "source_vat_mode": str(
            payload_value(payload, "vatMode", "source_vat_mode", "")
        ).strip(),
        "source_type": source_type,
        "source_document_id": source_document_id,
        "source_reference": source_reference,
        **amounts,
    }
    if line_kind == "budget":
        line_type = str(payload_value(payload, "lineType", "line_type", "direct_cost")).strip()
        if line_type not in {"direct_cost", "management_reserve"}:
            raise ValueError("bad_budget_line_type")
        if line_type == "management_reserve" and estimate_item_id is not None:
            raise ValueError("management_reserve_cannot_reference_estimate_item")
        line["line_type"] = line_type
        line["cost_code"] = str(
            payload_value(payload, "costCode", "cost_code", "")
        ).strip() or None
    return line


def validate_baseline_relation_ids(
    con: sqlite3.Connection,
    project_id: int,
    *,
    source_document_id: int | None,
    estimate_item_id: int | None = None,
) -> str | None:
    if source_document_id is not None:
        document = con.execute(
            "SELECT 1 FROM documents WHERE id = ? AND project_id = ?",
            (source_document_id, project_id),
        ).fetchone()
        if not document:
            return "baseline_source_document_not_found"
    if estimate_item_id is not None:
        estimate_item = con.execute(
            "SELECT 1 FROM estimate_items WHERE id = ? AND project_id = ?",
            (estimate_item_id, project_id),
        ).fetchone()
        if not estimate_item:
            return "baseline_estimate_item_not_found"
    return None


def baseline_snapshot_hash(con: sqlite3.Connection, baseline_id: int) -> str:
    baseline = con.execute(
        """
        SELECT project_id, version_no, currency_code, source_document_id,
               effective_from, reason
        FROM project_financial_baselines WHERE id = ?
        """,
        (baseline_id,),
    ).fetchone()
    revenue = [
        dict(row)
        for row in con.execute(
            "SELECT * FROM project_revenue_lines WHERE baseline_id = ? ORDER BY position, id",
            (baseline_id,),
        ).fetchall()
    ]
    budget = [
        dict(row)
        for row in con.execute(
            "SELECT * FROM project_budget_lines WHERE baseline_id = ? ORDER BY position, id",
            (baseline_id,),
        ).fetchall()
    ]
    budget_successors = [
        dict(row)
        for row in con.execute(
            """
            SELECT from_baseline_id, to_baseline_id, source_budget_line_id,
                   target_budget_line_id, mapping_kind, quantity_factor, reason
            FROM project_budget_line_successors
            WHERE to_baseline_id = ?
            ORDER BY source_budget_line_id, target_budget_line_id, id
            """,
            (baseline_id,),
        ).fetchall()
    ]
    revenue_successors = [
        dict(row)
        for row in con.execute(
            """
            SELECT from_baseline_id, to_baseline_id, source_revenue_line_id,
                   target_revenue_line_id, mapping_kind, reason
            FROM project_revenue_line_successors
            WHERE to_baseline_id = ?
            ORDER BY source_revenue_line_id, target_revenue_line_id, id
            """,
            (baseline_id,),
        ).fetchall()
    ]
    for line in revenue + budget:
        line.pop("id", None)
        line.pop("baseline_id", None)
        line.pop("created_by", None)
        line.pop("created_at", None)
    snapshot = {
        "baseline": dict(baseline) if baseline else {},
        "revenueLines": revenue,
        "budgetLines": budget,
        "budgetSuccessors": budget_successors,
        "revenueSuccessors": revenue_successors,
    }
    canonical = json.dumps(
        snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(canonical).hexdigest()


def refresh_baseline_snapshot_hash(con: sqlite3.Connection, baseline_id: int) -> str:
    snapshot_hash = baseline_snapshot_hash(con, baseline_id)
    con.execute(
        "UPDATE project_financial_baselines SET source_snapshot_hash = ? WHERE id = ?",
        (snapshot_hash, baseline_id),
    )
    return snapshot_hash


def serialize_baseline_line(row: sqlite3.Row, *, line_kind: str) -> dict:
    source_amount = (
        int(row["gross_amount_kopecks"])
        if row["source_vat_mode"] == "gross"
        else int(row["net_amount_kopecks"])
    )
    payload = {
        "id": int(row["id"]),
        "position": int(row["position"]),
        "estimateItemId": row["estimate_item_id"],
        "title": str(row["title"]),
        "sectionTitle": row["section_title"],
        "unit": row["unit"],
        "quantity": float(row["quantity"]) if row["quantity"] is not None else None,
        "unitNetKopecks": row[
            "unit_price_net_kopecks" if line_kind == "revenue" else "unit_cost_net_kopecks"
        ],
        "sourceAmountKopecks": source_amount,
        "netAmountKopecks": int(row["net_amount_kopecks"]),
        "vatRateBasisPoints": int(row["vat_rate_basis_points"]),
        "vatAmountKopecks": int(row["vat_amount_kopecks"]),
        "grossAmountKopecks": int(row["gross_amount_kopecks"]),
        "vatMode": str(row["source_vat_mode"]),
        "sourceType": str(row["source_type"]),
        "sourceDocumentId": row["source_document_id"],
        "sourceReference": str(row["source_reference"]),
    }
    if line_kind == "budget":
        payload["lineType"] = str(row["line_type"])
        payload["costCode"] = row["cost_code"]
    return payload


def baseline_audit_events(con: sqlite3.Connection, baseline_id: int) -> list[dict]:
    rows = con.execute(
        """
        SELECT log.id, log.action, log.payload, log.created_at,
               log.user_id, actor.name AS actor_name, actor.login AS actor_login
        FROM audit_log log
        LEFT JOIN users actor ON actor.id = log.user_id
        WHERE log.entity = 'project_financial_baseline' AND log.entity_id = ?
        ORDER BY log.created_at, log.id
        """,
        (baseline_id,),
    ).fetchall()
    result = []
    for row in rows:
        try:
            details = json.loads(row["payload"] or "{}")
        except (TypeError, ValueError):
            details = {}
        result.append({
            "id": int(row["id"]),
            "action": str(row["action"]),
            "actorId": row["user_id"],
            "actorName": str(row["actor_name"] or row["actor_login"] or ""),
            "details": details,
            "createdAt": int(row["created_at"]),
        })
    return result


def load_baseline_details(
    con: sqlite3.Connection, baseline_id: int
) -> tuple[sqlite3.Row | None, list[sqlite3.Row], list[sqlite3.Row], list[dict]]:
    baseline = con.execute(
        "SELECT * FROM project_financial_baselines WHERE id = ?", (baseline_id,)
    ).fetchone()
    if not baseline:
        return None, [], [], []
    revenue = con.execute(
        "SELECT * FROM project_revenue_lines WHERE baseline_id = ? ORDER BY position, id",
        (baseline_id,),
    ).fetchall()
    budget = con.execute(
        "SELECT * FROM project_budget_lines WHERE baseline_id = ? ORDER BY position, id",
        (baseline_id,),
    ).fetchall()
    return baseline, revenue, budget, baseline_audit_events(con, baseline_id)


def load_baseline_successor_mappings(
    con: sqlite3.Connection, baseline_id: int
) -> dict[str, list[dict]]:
    budget_rows = con.execute(
        """
        SELECT mapping.*, source.title AS source_title, target.title AS target_title
        FROM project_budget_line_successors mapping
        JOIN project_budget_lines source ON source.id = mapping.source_budget_line_id
        JOIN project_budget_lines target ON target.id = mapping.target_budget_line_id
        WHERE mapping.to_baseline_id = ?
        ORDER BY source.position, mapping.id
        """,
        (baseline_id,),
    ).fetchall()
    revenue_rows = con.execute(
        """
        SELECT mapping.*, source.title AS source_title, target.title AS target_title
        FROM project_revenue_line_successors mapping
        JOIN project_revenue_lines source ON source.id = mapping.source_revenue_line_id
        JOIN project_revenue_lines target ON target.id = mapping.target_revenue_line_id
        WHERE mapping.to_baseline_id = ?
        ORDER BY source.position, mapping.id
        """,
        (baseline_id,),
    ).fetchall()
    return {
        "budget": [
            {
                "id": int(row["id"]),
                "fromBaselineId": int(row["from_baseline_id"]),
                "toBaselineId": int(row["to_baseline_id"]),
                "sourceBudgetLineId": int(row["source_budget_line_id"]),
                "targetBudgetLineId": int(row["target_budget_line_id"]),
                "sourceTitle": str(row["source_title"]),
                "targetTitle": str(row["target_title"]),
                "mappingKind": str(row["mapping_kind"]),
                "quantityFactor": float(row["quantity_factor"]),
                "reason": str(row["reason"]),
                "createdBy": int(row["created_by"]),
                "createdAt": int(row["created_at"]),
            }
            for row in budget_rows
        ],
        "revenue": [
            {
                "id": int(row["id"]),
                "fromBaselineId": int(row["from_baseline_id"]),
                "toBaselineId": int(row["to_baseline_id"]),
                "sourceRevenueLineId": int(row["source_revenue_line_id"]),
                "targetRevenueLineId": int(row["target_revenue_line_id"]),
                "sourceTitle": str(row["source_title"]),
                "targetTitle": str(row["target_title"]),
                "mappingKind": str(row["mapping_kind"]),
                "reason": str(row["reason"]),
                "createdBy": int(row["created_by"]),
                "createdAt": int(row["created_at"]),
            }
            for row in revenue_rows
        ],
    }


def serialize_financial_baseline(
    baseline: sqlite3.Row,
    revenue: list[sqlite3.Row],
    budget: list[sqlite3.Row],
    events: list[dict],
    successor_mappings: dict[str, list[dict]] | None = None,
) -> dict:
    revenue_net = sum(int(row["net_amount_kopecks"]) for row in revenue)
    revenue_vat = sum(int(row["vat_amount_kopecks"]) for row in revenue)
    budget_net = sum(int(row["net_amount_kopecks"]) for row in budget)
    budget_vat = sum(int(row["vat_amount_kopecks"]) for row in budget)
    return {
        "id": int(baseline["id"]),
        "projectId": int(baseline["project_id"]),
        "versionNo": int(baseline["version_no"]),
        "status": str(baseline["status"]),
        "currencyCode": str(baseline["currency_code"]),
        "sourceSnapshotHash": str(baseline["source_snapshot_hash"]),
        "sourceDocumentId": baseline["source_document_id"],
        "effectiveFrom": baseline["effective_from"],
        "reason": str(baseline["reason"]),
        "createdBy": int(baseline["created_by"]),
        "submittedBy": baseline["submitted_by"],
        "submittedAt": baseline["submitted_at"],
        "approvedBy": baseline["approved_by"],
        "approvedAt": baseline["approved_at"],
        "supersededByBaselineId": baseline["superseded_by_baseline_id"],
        "supersededAt": baseline["superseded_at"],
        "createdAt": int(baseline["created_at"]),
        "updatedAt": int(baseline["updated_at"]),
        "totals": {
            "revenueNetKopecks": revenue_net,
            "revenueVatKopecks": revenue_vat,
            "revenueGrossKopecks": revenue_net + revenue_vat,
            "targetCostNetKopecks": budget_net,
            "targetCostVatKopecks": budget_vat,
            "targetCostGrossKopecks": budget_net + budget_vat,
        },
        "revenueLines": [
            serialize_baseline_line(row, line_kind="revenue") for row in revenue
        ],
        "budgetLines": [
            serialize_baseline_line(row, line_kind="budget") for row in budget
        ],
        "successorMappings": successor_mappings or {"budget": [], "revenue": []},
        "events": events,
    }


def insert_normalized_baseline_lines(
    con: sqlite3.Connection,
    baseline: sqlite3.Row,
    *,
    revenue_lines: list[dict] | None,
    budget_lines: list[dict] | None,
    user_id: int,
) -> str | None:
    project_id = int(baseline["project_id"])
    timestamp = now_ts()
    if revenue_lines is not None:
        con.execute("DELETE FROM project_revenue_lines WHERE baseline_id = ?", (baseline["id"],))
        for position, line in enumerate(revenue_lines, start=1):
            issue = validate_baseline_relation_ids(
                con,
                project_id,
                source_document_id=line["source_document_id"],
                estimate_item_id=line["estimate_item_id"],
            )
            if issue:
                return issue
            con.execute(
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
                    baseline["id"], position, line["estimate_item_id"], line["title"],
                    line["section_title"], line["unit"], line["quantity"],
                    line["unit_net_kopecks"], line["net_amount_kopecks"],
                    line["vat_rate_basis_points"], line["vat_amount_kopecks"],
                    line["gross_amount_kopecks"], line["source_vat_mode"],
                    line["source_type"], line["source_document_id"],
                    line["source_reference"], user_id, timestamp,
                ),
            )
    if budget_lines is not None:
        con.execute("DELETE FROM project_budget_lines WHERE baseline_id = ?", (baseline["id"],))
        for position, line in enumerate(budget_lines, start=1):
            issue = validate_baseline_relation_ids(
                con,
                project_id,
                source_document_id=line["source_document_id"],
                estimate_item_id=line["estimate_item_id"],
            )
            if issue:
                return issue
            con.execute(
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
                    baseline["id"], position, line["line_type"], line["cost_code"],
                    line["estimate_item_id"], line["title"], line["section_title"],
                    line["unit"], line["quantity"], line["unit_net_kopecks"],
                    line["net_amount_kopecks"], line["vat_rate_basis_points"],
                    line["vat_amount_kopecks"], line["gross_amount_kopecks"],
                    line["source_vat_mode"], line["source_type"],
                    line["source_document_id"], line["source_reference"], user_id,
                    timestamp,
                ),
            )
    return None


def baseline_submission_issue(con: sqlite3.Connection, baseline_id: int) -> str | None:
    baseline = con.execute(
        "SELECT * FROM project_financial_baselines WHERE id = ?", (baseline_id,)
    ).fetchone()
    if not baseline:
        return "financial_baseline_not_found"
    if not str(baseline["effective_from"] or "").strip():
        return "baseline_effective_from_required"
    revenue = int(con.execute(
        "SELECT COALESCE(SUM(net_amount_kopecks), 0) FROM project_revenue_lines WHERE baseline_id = ?",
        (baseline_id,),
    ).fetchone()[0])
    budget = int(con.execute(
        "SELECT COALESCE(SUM(net_amount_kopecks), 0) FROM project_budget_lines WHERE baseline_id = ?",
        (baseline_id,),
    ).fetchone()[0])
    if revenue <= 0:
        return "positive_baseline_revenue_required"
    if budget <= 0:
        return "positive_baseline_target_cost_required"
    return None


def resolved_budget_line_map(
    con: sqlite3.Connection,
    project_id: int,
    target_baseline_id: int,
) -> dict[int, tuple[int, Decimal]]:
    line_rows = con.execute(
        """
        SELECT line.id, line.baseline_id
        FROM project_budget_lines line
        JOIN project_financial_baselines baseline ON baseline.id = line.baseline_id
        WHERE baseline.project_id = ?
        """,
        (project_id,),
    ).fetchall()
    line_baselines = {int(row["id"]): int(row["baseline_id"]) for row in line_rows}
    successor_rows = con.execute(
        """
        SELECT mapping.source_budget_line_id, mapping.target_budget_line_id,
               mapping.quantity_factor
        FROM project_budget_line_successors mapping
        JOIN project_financial_baselines target
          ON target.id = mapping.to_baseline_id
        WHERE mapping.project_id = ?
          AND (target.status IN ('approved','superseded') OR target.id = ?)
        """,
        (project_id, target_baseline_id),
    ).fetchall()
    successors = {
        int(row["source_budget_line_id"]): (
            int(row["target_budget_line_id"]),
            decimal_value(row["quantity_factor"]),
        )
        for row in successor_rows
    }
    resolved: dict[int, tuple[int, Decimal]] = {}
    for source_line_id in line_baselines:
        current_line_id = source_line_id
        quantity_factor = Decimal(1)
        visited: set[int] = set()
        while line_baselines.get(current_line_id) != target_baseline_id:
            if current_line_id in visited or len(visited) > 100:
                break
            visited.add(current_line_id)
            successor = successors.get(current_line_id)
            if not successor:
                break
            current_line_id, step_factor = successor
            quantity_factor *= step_factor
        if line_baselines.get(current_line_id) == target_baseline_id:
            resolved[source_line_id] = (current_line_id, quantity_factor)
    return resolved


def resolved_revenue_line_map(
    con: sqlite3.Connection,
    project_id: int,
    target_baseline_id: int,
) -> dict[int, int]:
    line_rows = con.execute(
        """
        SELECT line.id, line.baseline_id
        FROM project_revenue_lines line
        JOIN project_financial_baselines baseline ON baseline.id = line.baseline_id
        WHERE baseline.project_id = ?
        """,
        (project_id,),
    ).fetchall()
    line_baselines = {int(row["id"]): int(row["baseline_id"]) for row in line_rows}
    successor_rows = con.execute(
        """
        SELECT mapping.source_revenue_line_id, mapping.target_revenue_line_id
        FROM project_revenue_line_successors mapping
        JOIN project_financial_baselines target
          ON target.id = mapping.to_baseline_id
        WHERE mapping.project_id = ?
          AND (target.status IN ('approved','superseded') OR target.id = ?)
        """,
        (project_id, target_baseline_id),
    ).fetchall()
    successors = {
        int(row["source_revenue_line_id"]): int(row["target_revenue_line_id"])
        for row in successor_rows
    }
    resolved: dict[int, int] = {}
    for source_line_id in line_baselines:
        current_line_id = source_line_id
        visited: set[int] = set()
        while line_baselines.get(current_line_id) != target_baseline_id:
            if current_line_id in visited or len(visited) > 100:
                break
            visited.add(current_line_id)
            successor = successors.get(current_line_id)
            if successor is None:
                break
            current_line_id = successor
        if line_baselines.get(current_line_id) == target_baseline_id:
            resolved[source_line_id] = current_line_id
    return resolved


def project_operational_identity_snapshot(
    con: sqlite3.Connection, project_id: int
) -> tuple[tuple, tuple, tuple]:
    commitments = tuple(
        tuple(row)
        for row in con.execute(
            """
            SELECT commitment.id, commitment.baseline_id, commitment.status,
                   line.id, line.budget_line_id, line.net_amount_kopecks
            FROM project_commitments commitment
            JOIN project_commitment_lines line ON line.commitment_id = commitment.id
            WHERE commitment.project_id = ?
            ORDER BY commitment.id, line.id
            """,
            (project_id,),
        ).fetchall()
    )
    actual = tuple(
        tuple(row)
        for row in con.execute(
            """
            SELECT id, baseline_id, budget_line_id, commitment_id,
                   commitment_line_id, entry_kind, status, net_amount_kopecks
            FROM project_actual_cost_entries
            WHERE project_id = ? ORDER BY id
            """,
            (project_id,),
        ).fetchall()
    )
    allocations = tuple(
        tuple(row)
        for row in con.execute(
            """
            SELECT id, target_type, target_revenue_line_id, target_commitment_id,
                   target_actual_cost_entry_id, entry_kind, status,
                   net_amount_kopecks, gross_amount_kopecks
            FROM project_payment_allocations
            WHERE project_id = ? ORDER BY id
            """,
            (project_id,),
        ).fetchall()
    )
    return commitments, actual, allocations


def baseline_replacement_issue(
    con: sqlite3.Connection,
    approved_baseline_id: int,
    replacement_baseline_id: int,
) -> dict | None:
    old = con.execute(
        "SELECT project_id FROM project_financial_baselines WHERE id = ?",
        (approved_baseline_id,),
    ).fetchone()
    if not old:
        return {"error": "financial_baseline_not_found"}
    project_id = int(old["project_id"])

    pending_commitments = [
        int(row[0])
        for row in con.execute(
            """
            SELECT id FROM project_commitments
            WHERE project_id = ? AND status IN ('draft','pending_approval')
            ORDER BY id
            """,
            (project_id,),
        ).fetchall()
    ]
    pending_actual = [
        int(row[0])
        for row in con.execute(
            """
            SELECT id FROM project_actual_cost_entries
            WHERE project_id = ? AND status IN ('draft','pending_approval')
            ORDER BY id
            """,
            (project_id,),
        ).fetchall()
    ]
    pending_allocations = [
        int(row[0])
        for row in con.execute(
            """
            SELECT DISTINCT allocation.id
            FROM project_payment_allocations allocation
            LEFT JOIN project_revenue_lines revenue
              ON revenue.id = allocation.target_revenue_line_id
            LEFT JOIN project_commitments commitment
              ON commitment.id = allocation.target_commitment_id
            LEFT JOIN project_actual_cost_entries actual
              ON actual.id = allocation.target_actual_cost_entry_id
            WHERE allocation.status IN ('draft','pending_approval')
              AND allocation.project_id = ?
            ORDER BY allocation.id
            """,
            (project_id,),
        ).fetchall()
    ]
    if pending_commitments or pending_actual or pending_allocations:
        return {
            "error": "baseline_replacement_requires_operational_mapping",
            "reason": "pending_operational_workflow",
            "pendingCommitmentIds": pending_commitments,
            "pendingActualCostIds": pending_actual,
            "pendingPaymentAllocationIds": pending_allocations,
        }

    operational_budget_source_ids = {
        int(row[0])
        for row in con.execute(
            """
            SELECT line.budget_line_id
            FROM project_commitment_lines line
            JOIN project_commitments commitment ON commitment.id = line.commitment_id
            WHERE commitment.project_id = ? AND commitment.status = 'approved'
            UNION
            SELECT budget_line_id
            FROM project_actual_cost_entries
            WHERE project_id = ? AND status = 'approved'
            """,
            (project_id, project_id),
        ).fetchall()
    }
    old_budget_resolution = resolved_budget_line_map(
        con, project_id, approved_baseline_id
    )
    unresolved_old_budget = sorted(
        source_id
        for source_id in operational_budget_source_ids
        if source_id not in old_budget_resolution
    )
    if unresolved_old_budget:
        return {
            "error": "baseline_replacement_requires_operational_mapping",
            "reason": "existing_successor_chain_incomplete",
            "missingBudgetLineIds": unresolved_old_budget,
            "missingRevenueLineIds": [],
        }
    required_budget_ids = {
        int(old_budget_resolution[source_id][0])
        for source_id in operational_budget_source_ids
    }
    mapped_budget_ids = {
        int(row[0])
        for row in con.execute(
            """
            SELECT source_budget_line_id
            FROM project_budget_line_successors
            WHERE from_baseline_id = ? AND to_baseline_id = ?
            """,
            (approved_baseline_id, replacement_baseline_id),
        ).fetchall()
    }
    operational_revenue_source_ids = {
        int(row[0])
        for row in con.execute(
            """
            SELECT DISTINCT allocation.target_revenue_line_id
            FROM project_payment_allocations allocation
            JOIN project_revenue_lines revenue
              ON revenue.id = allocation.target_revenue_line_id
            WHERE allocation.project_id = ? AND allocation.status = 'approved'
              AND allocation.target_revenue_line_id IS NOT NULL
            """,
            (project_id,),
        ).fetchall()
    }
    old_revenue_resolution = resolved_revenue_line_map(
        con, project_id, approved_baseline_id
    )
    unresolved_old_revenue = sorted(
        source_id
        for source_id in operational_revenue_source_ids
        if source_id not in old_revenue_resolution
    )
    if unresolved_old_revenue:
        return {
            "error": "baseline_replacement_requires_operational_mapping",
            "reason": "existing_successor_chain_incomplete",
            "missingBudgetLineIds": [],
            "missingRevenueLineIds": unresolved_old_revenue,
        }
    required_revenue_ids = {
        int(old_revenue_resolution[source_id])
        for source_id in operational_revenue_source_ids
    }
    mapped_revenue_ids = {
        int(row[0])
        for row in con.execute(
            """
            SELECT source_revenue_line_id
            FROM project_revenue_line_successors
            WHERE from_baseline_id = ? AND to_baseline_id = ?
            """,
            (approved_baseline_id, replacement_baseline_id),
        ).fetchall()
    }
    missing_budget = sorted(required_budget_ids - mapped_budget_ids)
    missing_revenue = sorted(required_revenue_ids - mapped_revenue_ids)
    if missing_budget or missing_revenue:
        return {
            "error": "baseline_replacement_requires_operational_mapping",
            "reason": "successor_mapping_incomplete",
            "missingBudgetLineIds": missing_budget,
            "missingRevenueLineIds": missing_revenue,
        }

    budget_resolution = resolved_budget_line_map(
        con, project_id, replacement_baseline_id
    )
    revenue_resolution = resolved_revenue_line_map(
        con, project_id, replacement_baseline_id
    )
    unresolved_budget = sorted(
        source_id
        for source_id in operational_budget_source_ids
        if source_id not in budget_resolution
    )
    unresolved_revenue = sorted(
        source_id
        for source_id in operational_revenue_source_ids
        if source_id not in revenue_resolution
    )
    if unresolved_budget or unresolved_revenue:
        return {
            "error": "baseline_replacement_requires_operational_mapping",
            "reason": "successor_chain_incomplete",
            "missingBudgetLineIds": unresolved_budget,
            "missingRevenueLineIds": unresolved_revenue,
        }
    return None


def api_project_financial_baselines(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=False)
    if not user:
        return
    with db() as con:
        rows = con.execute(
            """
            SELECT id FROM project_financial_baselines
            WHERE project_id = ? ORDER BY version_no DESC, id DESC
            """,
            (project_id,),
        ).fetchall()
        baselines = []
        for item in rows:
            baseline, revenue, budget, events = load_baseline_details(con, int(item["id"]))
            mappings = load_baseline_successor_mappings(con, int(item["id"]))
            baselines.append(
                serialize_financial_baseline(baseline, revenue, budget, events, mappings)
            )
    handler.send_json(HTTPStatus.OK, {"baselines": baselines})


def api_create_financial_baseline(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
        return
    try:
        source_document_id = optional_positive_int(
            payload_value(payload, "sourceDocumentId", "source_document_id")
        )
        clone_from_id = optional_positive_int(
            payload_value(payload, "cloneFromBaselineId", "clone_from_baseline_id")
        )
        effective_from = baseline_effective_date(
            payload_value(payload, "effectiveFrom", "effective_from")
        )
    except (TypeError, ValueError) as exc:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        return
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        issue = validate_baseline_relation_ids(
            con, project_id, source_document_id=source_document_id
        )
        if issue:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": issue})
            return
        clone = None
        if clone_from_id is not None:
            clone = con.execute(
                """
                SELECT * FROM project_financial_baselines
                WHERE id = ? AND project_id = ? AND status IN ('approved','superseded')
                """,
                (clone_from_id, project_id),
            ).fetchone()
            if not clone:
                handler.send_json(HTTPStatus.CONFLICT, {"error": "clone_source_baseline_not_final"})
                return
            if source_document_id is None:
                source_document_id = clone["source_document_id"]
        version_no = int(con.execute(
            "SELECT COALESCE(MAX(version_no), 0) + 1 FROM project_financial_baselines WHERE project_id = ?",
            (project_id,),
        ).fetchone()[0])
        timestamp = now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_financial_baselines (
                project_id, version_no, status, currency_code, source_snapshot_hash,
                source_document_id, effective_from, reason, created_by,
                created_at, updated_at
            ) VALUES (?, ?, 'draft', 'RUB', 'sha256:draft', ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id, version_no, source_document_id, effective_from, reason,
                user["id"], timestamp, timestamp,
            ),
        )
        baseline_id = int(cursor.lastrowid)
        if clone is not None:
            con.execute(
                """
                INSERT INTO project_revenue_lines (
                    baseline_id, position, estimate_item_id, title, section_title,
                    unit, quantity, unit_price_net_kopecks, net_amount_kopecks,
                    vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                    source_vat_mode, source_type, source_document_id,
                    source_reference, created_by, created_at
                )
                SELECT ?, position, estimate_item_id, title, section_title, unit,
                       quantity, unit_price_net_kopecks, net_amount_kopecks,
                       vat_rate_basis_points, vat_amount_kopecks, gross_amount_kopecks,
                       source_vat_mode, source_type, source_document_id,
                       source_reference, ?, ?
                FROM project_revenue_lines WHERE baseline_id = ?
                """,
                (baseline_id, user["id"], timestamp, clone_from_id),
            )
            con.execute(
                """
                INSERT INTO project_budget_lines (
                    baseline_id, position, line_type, cost_code, estimate_item_id,
                    title, section_title, unit, quantity, unit_cost_net_kopecks,
                    net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                    gross_amount_kopecks, source_vat_mode, source_type,
                    source_document_id, source_reference, created_by, created_at
                )
                SELECT ?, position, line_type, cost_code, estimate_item_id, title,
                       section_title, unit, quantity, unit_cost_net_kopecks,
                       net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                       gross_amount_kopecks, source_vat_mode, source_type,
                       source_document_id, source_reference, ?, ?
                FROM project_budget_lines WHERE baseline_id = ?
                """,
                (baseline_id, user["id"], timestamp, clone_from_id),
            )
            if str(clone["status"]) == "approved":
                con.execute(
                    """
                    INSERT INTO project_revenue_line_successors (
                        project_id, from_baseline_id, to_baseline_id,
                        source_revenue_line_id, target_revenue_line_id,
                        mapping_kind, reason, created_by, created_at
                    )
                    SELECT ?, ?, ?, source.id, target.id, 'carry_forward',
                           'Cloned from approved baseline', ?, ?
                    FROM project_revenue_lines source
                    JOIN project_revenue_lines target
                      ON target.baseline_id = ? AND target.position = source.position
                    WHERE source.baseline_id = ?
                    """,
                    (
                        project_id, clone_from_id, baseline_id, user["id"], timestamp,
                        baseline_id, clone_from_id,
                    ),
                )
                con.execute(
                    """
                    INSERT INTO project_budget_line_successors (
                        project_id, from_baseline_id, to_baseline_id,
                        source_budget_line_id, target_budget_line_id,
                        mapping_kind, quantity_factor, reason, created_by, created_at
                    )
                    SELECT ?, ?, ?, source.id, target.id, 'carry_forward', 1,
                           'Cloned from approved baseline', ?, ?
                    FROM project_budget_lines source
                    JOIN project_budget_lines target
                      ON target.baseline_id = ? AND target.position = source.position
                    WHERE source.baseline_id = ? AND source.line_type = 'direct_cost'
                      AND target.line_type = 'direct_cost'
                    """,
                    (
                        project_id, clone_from_id, baseline_id, user["id"], timestamp,
                        baseline_id, clone_from_id,
                    ),
                )
        snapshot_hash = refresh_baseline_snapshot_hash(con, baseline_id)
        create_audit(
            con,
            int(user["id"]),
            "create_financial_baseline",
            baseline_id,
            {
                "project_id": project_id,
                "version_no": version_no,
                "clone_from_baseline_id": clone_from_id,
                "source_snapshot_hash": snapshot_hash,
            },
            entity="project_financial_baseline",
        )
        con.commit()
        baseline, revenue, budget, events = load_baseline_details(con, baseline_id)
        mappings = load_baseline_successor_mappings(con, baseline_id)
    handler.send_json(
        HTTPStatus.CREATED,
        {"baseline": serialize_financial_baseline(baseline, revenue, budget, events, mappings)},
    )


def load_baseline_for_action(
    handler, path: str
) -> tuple[sqlite3.Connection, sqlite3.Row, dict] | None:
    baseline_id = parse_path_int(path, 2)
    if not baseline_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_financial_baseline_id"})
        return None
    con = db()
    baseline = con.execute(
        "SELECT * FROM project_financial_baselines WHERE id = ?", (baseline_id,)
    ).fetchone()
    if not baseline:
        con.close()
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "financial_baseline_not_found"})
        return None
    user = require_economics_access(handler, int(baseline["project_id"]), manage=True)
    if not user:
        con.close()
        return None
    return con, baseline, user


def api_update_financial_baseline(handler, path: str) -> None:
    loaded = load_baseline_for_action(handler, path)
    if not loaded:
        return
    con, baseline, user = loaded
    try:
        payload = handler.read_json()
        con.execute("BEGIN IMMEDIATE")
        baseline = con.execute(
            "SELECT * FROM project_financial_baselines WHERE id = ?",
            (baseline["id"],),
        ).fetchone()
        if not baseline or baseline["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "financial_baseline_not_draft"})
            return
        reason = str(payload.get("reason", baseline["reason"])).strip()
        if not reason:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
            return
        try:
            source_document_id = optional_positive_int(
                payload_value(
                    payload, "sourceDocumentId", "source_document_id", baseline["source_document_id"]
                )
            )
            effective_from = baseline_effective_date(
                payload_value(
                    payload, "effectiveFrom", "effective_from", baseline["effective_from"]
                )
            )
            revenue_payload = payload_value(payload, "revenueLines", "revenue_lines")
            budget_payload = payload_value(payload, "budgetLines", "budget_lines")
            if revenue_payload is not None and not isinstance(revenue_payload, list):
                raise ValueError("bad_revenue_lines")
            if budget_payload is not None and not isinstance(budget_payload, list):
                raise ValueError("bad_budget_lines")
            revenue_lines = (
                [normalize_baseline_line(item, line_kind="revenue") for item in revenue_payload]
                if revenue_payload is not None
                else None
            )
            budget_lines = (
                [normalize_baseline_line(item, line_kind="budget") for item in budget_payload]
                if budget_payload is not None
                else None
            )
        except (TypeError, ValueError) as exc:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        issue = validate_baseline_relation_ids(
            con,
            int(baseline["project_id"]),
            source_document_id=source_document_id,
        )
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_financial_baselines
            SET source_document_id = ?, effective_from = ?, reason = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (source_document_id, effective_from, reason, timestamp, baseline["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "financial_baseline_not_draft"})
            return
        current = con.execute(
            "SELECT * FROM project_financial_baselines WHERE id = ?", (baseline["id"],)
        ).fetchone()
        issue = insert_normalized_baseline_lines(
            con,
            current,
            revenue_lines=revenue_lines,
            budget_lines=budget_lines,
            user_id=int(user["id"]),
        )
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        snapshot_hash = refresh_baseline_snapshot_hash(con, int(baseline["id"]))
        create_audit(
            con,
            int(user["id"]),
            "update_financial_baseline",
            int(baseline["id"]),
            {
                "project_id": baseline["project_id"],
                "version_no": baseline["version_no"],
                "revenue_lines_replaced": revenue_lines is not None,
                "budget_lines_replaced": budget_lines is not None,
                "source_snapshot_hash": snapshot_hash,
            },
            entity="project_financial_baseline",
        )
        con.commit()
        current, revenue, budget, events = load_baseline_details(con, int(baseline["id"]))
        mappings = load_baseline_successor_mappings(con, int(baseline["id"]))
    except sqlite3.IntegrityError as exc:
        con.rollback()
        handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        return
    finally:
        con.close()
    handler.send_json(
        HTTPStatus.OK,
        {"baseline": serialize_financial_baseline(current, revenue, budget, events, mappings)},
    )


def normalize_successor_mapping(item: object, *, line_kind: str) -> dict:
    if not isinstance(item, dict):
        raise ValueError(f"bad_{line_kind}_successor_mapping")
    try:
        if line_kind == "budget":
            source_line_id = optional_positive_int(
                payload_value(item, "sourceBudgetLineId", "source_budget_line_id")
            )
            target_line_id = optional_positive_int(
                payload_value(item, "targetBudgetLineId", "target_budget_line_id")
            )
        else:
            source_line_id = optional_positive_int(
                payload_value(item, "sourceRevenueLineId", "source_revenue_line_id")
            )
            target_line_id = optional_positive_int(
                payload_value(item, "targetRevenueLineId", "target_revenue_line_id")
            )
    except (TypeError, ValueError) as exc:
        raise ValueError(f"bad_{line_kind}_successor_mapping") from exc
    if source_line_id is None or target_line_id is None:
        raise ValueError(f"bad_{line_kind}_successor_mapping")
    mapping_kind = str(
        payload_value(item, "mappingKind", "mapping_kind", "carry_forward")
    ).strip()
    if mapping_kind not in BASELINE_SUCCESSOR_MAPPING_KINDS:
        raise ValueError("bad_successor_mapping_kind")
    reason = str(item.get("reason", "")).strip()
    if not reason:
        raise ValueError("successor_mapping_reason_required")
    result = {
        "source_line_id": source_line_id,
        "target_line_id": target_line_id,
        "mapping_kind": mapping_kind,
        "reason": reason,
    }
    if line_kind == "budget":
        try:
            quantity_factor = decimal_value(
                payload_value(item, "quantityFactor", "quantity_factor", 1)
            )
        except ValueError as exc:
            raise ValueError("bad_successor_quantity_factor") from exc
        if quantity_factor <= 0:
            raise ValueError("bad_successor_quantity_factor")
        result["quantity_factor"] = float(quantity_factor)
        result["quantity_factor_explicit"] = (
            "quantityFactor" in item or "quantity_factor" in item
        )
    return result


def validate_successor_line_relations(
    con: sqlite3.Connection,
    *,
    project_id: int,
    source_baseline_id: int,
    target_baseline_id: int,
    budget_mappings: list[dict],
    revenue_mappings: list[dict],
) -> str | None:
    source_budget_ids: set[int] = set()
    for mapping in budget_mappings:
        source_id = int(mapping["source_line_id"])
        if source_id in source_budget_ids:
            return "duplicate_source_budget_successor"
        source_budget_ids.add(source_id)
        rows = con.execute(
            """
            SELECT source.unit AS source_unit, target.unit AS target_unit,
                   source.line_type AS source_type, target.line_type AS target_type
            FROM project_budget_lines source
            JOIN project_budget_lines target ON target.id = ?
            WHERE source.id = ? AND source.baseline_id = ?
              AND target.baseline_id = ?
            """,
            (
                mapping["target_line_id"], mapping["source_line_id"],
                source_baseline_id, target_baseline_id,
            ),
        ).fetchone()
        if not rows or rows["source_type"] != "direct_cost" or rows["target_type"] != "direct_cost":
            return "invalid_budget_successor_lines"
        source_unit = str(rows["source_unit"] or "").strip().casefold()
        target_unit = str(rows["target_unit"] or "").strip().casefold()
        if source_unit != target_unit and not mapping["quantity_factor_explicit"]:
            return "successor_quantity_factor_required_for_unit_change"

    source_revenue_ids: set[int] = set()
    for mapping in revenue_mappings:
        source_id = int(mapping["source_line_id"])
        if source_id in source_revenue_ids:
            return "duplicate_source_revenue_successor"
        source_revenue_ids.add(source_id)
        exists = con.execute(
            """
            SELECT 1
            FROM project_revenue_lines source
            JOIN project_revenue_lines target ON target.id = ?
            WHERE source.id = ? AND source.baseline_id = ?
              AND target.baseline_id = ?
            """,
            (
                mapping["target_line_id"], mapping["source_line_id"],
                source_baseline_id, target_baseline_id,
            ),
        ).fetchone()
        if not exists:
            return "invalid_revenue_successor_lines"
    return None


def api_update_financial_baseline_successors(handler, path: str) -> None:
    loaded = load_baseline_for_action(handler, path)
    if not loaded:
        return
    con, baseline, user = loaded
    try:
        payload = handler.read_json()
        budget_payload = payload_value(payload, "budgetMappings", "budget_mappings", [])
        revenue_payload = payload_value(payload, "revenueMappings", "revenue_mappings", [])
        if not isinstance(budget_payload, list) or not isinstance(revenue_payload, list):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_successor_mappings"})
            return
        try:
            budget_mappings = [
                normalize_successor_mapping(item, line_kind="budget")
                for item in budget_payload
            ]
            revenue_mappings = [
                normalize_successor_mapping(item, line_kind="revenue")
                for item in revenue_payload
            ]
        except (TypeError, ValueError) as exc:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        con.execute("BEGIN IMMEDIATE")
        baseline = con.execute(
            "SELECT * FROM project_financial_baselines WHERE id = ?",
            (baseline["id"],),
        ).fetchone()
        if not baseline or baseline["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "financial_baseline_not_draft"})
            return

        source = con.execute(
            """
            SELECT * FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (baseline["project_id"],),
        ).fetchone()
        if not source:
            if budget_mappings or revenue_mappings:
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {"error": "approved_source_baseline_required"},
                )
                return
            source_baseline_id = None
        else:
            source_baseline_id = int(source["id"])
            if int(source["version_no"]) >= int(baseline["version_no"]):
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT, {"error": "newer_approved_baseline_exists"}
                )
                return
            issue = validate_successor_line_relations(
                con,
                project_id=int(baseline["project_id"]),
                source_baseline_id=source_baseline_id,
                target_baseline_id=int(baseline["id"]),
                budget_mappings=budget_mappings,
                revenue_mappings=revenue_mappings,
            )
            if issue:
                con.rollback()
                handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
                return

        timestamp = now_ts()
        con.execute(
            "DELETE FROM project_budget_line_successors WHERE to_baseline_id = ?",
            (baseline["id"],),
        )
        con.execute(
            "DELETE FROM project_revenue_line_successors WHERE to_baseline_id = ?",
            (baseline["id"],),
        )
        if source_baseline_id is not None:
            for mapping in budget_mappings:
                con.execute(
                    """
                    INSERT INTO project_budget_line_successors (
                        project_id, from_baseline_id, to_baseline_id,
                        source_budget_line_id, target_budget_line_id,
                        mapping_kind, quantity_factor, reason, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        baseline["project_id"], source_baseline_id, baseline["id"],
                        mapping["source_line_id"], mapping["target_line_id"],
                        mapping["mapping_kind"], mapping["quantity_factor"],
                        mapping["reason"], user["id"], timestamp,
                    ),
                )
            for mapping in revenue_mappings:
                con.execute(
                    """
                    INSERT INTO project_revenue_line_successors (
                        project_id, from_baseline_id, to_baseline_id,
                        source_revenue_line_id, target_revenue_line_id,
                        mapping_kind, reason, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        baseline["project_id"], source_baseline_id, baseline["id"],
                        mapping["source_line_id"], mapping["target_line_id"],
                        mapping["mapping_kind"], mapping["reason"],
                        user["id"], timestamp,
                    ),
                )
        snapshot_hash = refresh_baseline_snapshot_hash(con, int(baseline["id"]))
        create_audit(
            con,
            int(user["id"]),
            "update_financial_baseline_successors",
            int(baseline["id"]),
            {
                "project_id": int(baseline["project_id"]),
                "from_baseline_id": source_baseline_id,
                "budget_mapping_count": len(budget_mappings),
                "revenue_mapping_count": len(revenue_mappings),
                "source_snapshot_hash": snapshot_hash,
            },
            entity="project_financial_baseline",
        )
        con.commit()
        mappings = load_baseline_successor_mappings(con, int(baseline["id"]))
    except sqlite3.IntegrityError as exc:
        con.rollback()
        handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        return
    finally:
        con.close()
    handler.send_json(
        HTTPStatus.OK,
        {"successorMappings": mappings, "sourceSnapshotHash": snapshot_hash},
    )


def api_submit_financial_baseline(handler, path: str) -> None:
    loaded = load_baseline_for_action(handler, path)
    if not loaded:
        return
    con, baseline, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        baseline = con.execute(
            "SELECT * FROM project_financial_baselines WHERE id = ?",
            (baseline["id"],),
        ).fetchone()
        if not baseline or baseline["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "financial_baseline_not_draft"})
            return
        issue = baseline_submission_issue(con, int(baseline["id"]))
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        snapshot_hash = refresh_baseline_snapshot_hash(con, int(baseline["id"]))
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_financial_baselines
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (user["id"], timestamp, timestamp, baseline["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(
                HTTPStatus.CONFLICT, {"error": "financial_baseline_not_draft"}
            )
            return
        create_audit(
            con, int(user["id"]), "submit_financial_baseline", int(baseline["id"]),
            {"project_id": baseline["project_id"], "version_no": baseline["version_no"],
             "source_snapshot_hash": snapshot_hash},
            entity="project_financial_baseline",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(
        HTTPStatus.OK, {"id": int(baseline["id"]), "status": "pending_approval"}
    )


def api_return_financial_baseline(handler, path: str) -> None:
    loaded = load_baseline_for_action(handler, path)
    if not loaded:
        return
    con, baseline, user = loaded
    try:
        payload = handler.read_json()
        reason = str(payload.get("reason", "")).strip()
        if not reason:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "return_reason_required"})
            return
        con.execute("BEGIN IMMEDIATE")
        baseline = con.execute(
            "SELECT * FROM project_financial_baselines WHERE id = ?",
            (baseline["id"],),
        ).fetchone()
        if not baseline or baseline["status"] != "pending_approval":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "financial_baseline_not_pending"})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_financial_baselines
            SET status = 'draft', submitted_by = NULL, submitted_at = NULL, updated_at = ?
            WHERE id = ? AND status = 'pending_approval'
            """,
            (timestamp, baseline["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(
                HTTPStatus.CONFLICT, {"error": "financial_baseline_not_pending"}
            )
            return
        create_audit(
            con, int(user["id"]), "return_financial_baseline", int(baseline["id"]),
            {"project_id": baseline["project_id"], "version_no": baseline["version_no"],
             "reason": reason},
            entity="project_financial_baseline",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(baseline["id"]), "status": "draft"})


def api_approve_financial_baseline(handler, path: str) -> None:
    loaded = load_baseline_for_action(handler, path)
    if not loaded:
        return
    con, baseline, user = loaded
    try:
        if baseline["status"] != "pending_approval":
            handler.send_json(HTTPStatus.CONFLICT, {"error": "financial_baseline_not_pending"})
            return
        con.execute("BEGIN IMMEDIATE")
        baseline = con.execute(
            "SELECT * FROM project_financial_baselines WHERE id = ?",
            (baseline["id"],),
        ).fetchone()
        if not baseline or baseline["status"] != "pending_approval":
            handler.send_json(HTTPStatus.CONFLICT, {"error": "financial_baseline_not_pending"})
            return
        issue = baseline_submission_issue(con, int(baseline["id"]))
        if issue:
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        current_snapshot_hash = baseline_snapshot_hash(con, int(baseline["id"]))
        if current_snapshot_hash != str(baseline["source_snapshot_hash"]):
            handler.send_json(
                HTTPStatus.CONFLICT,
                {"error": "baseline_sources_changed_return_to_draft"},
            )
            return
        approved = con.execute(
            """
            SELECT * FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (baseline["project_id"],),
        ).fetchone()
        if approved and int(approved["version_no"]) >= int(baseline["version_no"]):
            handler.send_json(HTTPStatus.CONFLICT, {"error": "newer_approved_baseline_exists"})
            return
        operational_before = project_operational_identity_snapshot(
            con, int(baseline["project_id"])
        )
        if approved:
            replacement_issue = baseline_replacement_issue(
                con, int(approved["id"]), int(baseline["id"])
            )
            if replacement_issue:
                handler.send_json(HTTPStatus.CONFLICT, replacement_issue)
                return
        timestamp = now_ts()
        if approved:
            con.execute(
                """
                UPDATE project_financial_baselines
                SET status = 'superseded', superseded_by_baseline_id = ?,
                    superseded_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (baseline["id"], timestamp, timestamp, approved["id"]),
            )
            create_audit(
                con, int(user["id"]), "supersede_financial_baseline", int(approved["id"]),
                {"project_id": baseline["project_id"],
                 "superseded_by_baseline_id": baseline["id"]},
                entity="project_financial_baseline",
            )
        con.execute(
            """
            UPDATE project_financial_baselines
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (user["id"], timestamp, timestamp, baseline["id"]),
        )
        mapping_counts = {
            "budget": int(con.execute(
                "SELECT COUNT(*) FROM project_budget_line_successors WHERE to_baseline_id = ?",
                (baseline["id"],),
            ).fetchone()[0]),
            "revenue": int(con.execute(
                "SELECT COUNT(*) FROM project_revenue_line_successors WHERE to_baseline_id = ?",
                (baseline["id"],),
            ).fetchone()[0]),
        }
        create_audit(
            con, int(user["id"]), "approve_financial_baseline", int(baseline["id"]),
            {"project_id": baseline["project_id"], "version_no": baseline["version_no"],
             "replaces_baseline_id": int(approved["id"]) if approved else None,
             "successor_mapping_counts": mapping_counts,
             "source_snapshot_hash": current_snapshot_hash},
            entity="project_financial_baseline",
        )
        operational_after = project_operational_identity_snapshot(
            con, int(baseline["project_id"])
        )
        if operational_after != operational_before:
            raise sqlite3.IntegrityError("baseline_replacement_changed_operational_history")
        con.commit()
        current, revenue, budget, events = load_baseline_details(con, int(baseline["id"]))
        mappings = load_baseline_successor_mappings(con, int(baseline["id"]))
    except sqlite3.IntegrityError as exc:
        con.rollback()
        handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        return
    finally:
        con.close()
    handler.send_json(
        HTTPStatus.OK,
        {"baseline": serialize_financial_baseline(current, revenue, budget, events, mappings)},
    )


def commitment_approval_issue(
    con: sqlite3.Connection,
    commitment: sqlite3.Row,
) -> str | None:
    if not str(commitment["commitment_no"] or "").strip():
        return "commitment_number_required"
    baseline_id = commitment["baseline_id"]
    if baseline_id is None:
        return "approved_financial_baseline_required"
    baseline = con.execute(
        """
        SELECT id FROM project_financial_baselines
        WHERE id = ? AND project_id = ? AND status = 'approved'
        """,
        (baseline_id, commitment["project_id"]),
    ).fetchone()
    if not baseline:
        return "approved_financial_baseline_required"
    lines = con.execute(
        """
        SELECT line.id, line.budget_line_id, line.unit AS line_unit,
               budget_line.baseline_id AS budget_baseline_id,
               budget_line.line_type AS budget_line_type,
               budget_line.unit AS budget_unit,
               budget_line.quantity AS budget_quantity
        FROM project_commitment_lines line
        LEFT JOIN project_budget_lines budget_line ON budget_line.id = line.budget_line_id
        WHERE line.commitment_id = ?
        """,
        (commitment["id"],),
    ).fetchall()
    if not lines:
        return "commitment_lines_required"
    if any(
        line["budget_line_id"] is None
        or int(line["budget_baseline_id"] or 0) != int(baseline_id)
        or line["budget_line_type"] != "direct_cost"
        for line in lines
    ):
        return "commitment_budget_mapping_required"
    if any(
        line["budget_quantity"] is not None
        and decimal_value(line["budget_quantity"]) > 0
        and normalized_operational_unit(line["line_unit"])
        != normalized_operational_unit(line["budget_unit"])
        for line in lines
    ):
        return "operational_unit_mismatch"
    return None


def serialize_commitment(
    row: sqlite3.Row,
    lines: list[sqlite3.Row],
    events: list[sqlite3.Row],
    recognized_by_line: dict[int, dict[str, int]] | None = None,
    settled_by_commitment: dict[int, dict[str, int]] | None = None,
) -> dict:
    recognized_by_line = recognized_by_line or {}
    settled_by_commitment = settled_by_commitment or {}
    line_payload = []
    for line in lines:
        recognized = recognized_by_line.get(
            int(line["id"]),
            {"net": 0, "vat": 0, "gross": 0},
        )
        net_amount = int(line["net_amount_kopecks"])
        recognized_net = int(recognized["net"])
        line_payload.append({
            "id": int(line["id"]),
            "position": int(line["position"]),
            "budgetLineId": line["budget_line_id"],
            "estimateItemId": line["estimate_item_id"],
            "supplierOfferId": line["supplier_offer_id"],
            "title": str(line["title"]),
            "unit": line["unit"],
            "quantity": float(line["quantity"]),
            "sourceUnitPriceKopecks": int(line["source_unit_price_kopecks"]),
            "unitCostNetKopecks": int(line["unit_cost_net_kopecks"]),
            "netAmountKopecks": net_amount,
            "vatRateBasisPoints": int(line["vat_rate_basis_points"]),
            "vatAmountKopecks": int(line["vat_amount_kopecks"]),
            "grossAmountKopecks": int(line["gross_amount_kopecks"]),
            "sourceVatMode": str(line["source_vat_mode"]),
            "sourceReference": str(line["source_reference"]),
            "recognizedNetKopecks": recognized_net,
            "recognizedVatKopecks": int(recognized["vat"]),
            "recognizedGrossKopecks": int(recognized["gross"]),
            "remainingNetKopecks": max(net_amount - recognized_net, 0),
            "overrunNetKopecks": max(recognized_net - net_amount, 0),
        })
    event_payload = []
    for event in events:
        try:
            details = json.loads(event["details"] or "{}")
        except (TypeError, ValueError):
            details = {}
        event_payload.append(
            {
                "id": int(event["id"]),
                "action": str(event["action"]),
                "actorId": int(event["actor_id"]),
                "actorName": str(event["actor_name"] or ""),
                "details": details,
                "createdAt": int(event["created_at"]),
            }
        )
    settled = settled_by_commitment.get(
        int(row["id"]),
        {"net": 0, "vat": 0, "gross": 0},
    )
    net_total = sum(item["netAmountKopecks"] for item in line_payload)
    vat_total = sum(item["vatAmountKopecks"] for item in line_payload)
    gross_total = sum(item["grossAmountKopecks"] for item in line_payload)
    return {
        "id": int(row["id"]),
        "projectId": int(row["project_id"]),
        "baselineId": row["baseline_id"],
        "sourceSupplierOfferId": row["source_supplier_offer_id"],
        "commitmentType": str(row["commitment_type"]),
        "commitmentNo": str(row["commitment_no"] or ""),
        "status": str(row["status"]),
        "currencyCode": str(row["currency_code"]),
        "companyId": row["company_id"],
        "companyName": str(row["company_name"] or ""),
        "counterpartyName": str(row["counterparty_name"]),
        "documentId": row["document_id"],
        "expectedDate": row["expected_date"],
        "reason": str(row["reason"]),
        "createdBy": int(row["created_by"]),
        "createdByName": str(row["created_by_name"] or ""),
        "submittedBy": row["submitted_by"],
        "submittedAt": row["submitted_at"],
        "approvedBy": row["approved_by"],
        "approvedAt": row["approved_at"],
        "cancelledBy": row["cancelled_by"],
        "cancelledAt": row["cancelled_at"],
        "cancellationReason": row["cancellation_reason"],
        "createdAt": int(row["created_at"]),
        "updatedAt": int(row["updated_at"]),
        "netAmountKopecks": net_total,
        "vatAmountKopecks": vat_total,
        "grossAmountKopecks": gross_total,
        "allocatedPaymentNetKopecks": int(settled["net"]),
        "allocatedPaymentVatKopecks": int(settled["vat"]),
        "allocatedPaymentGrossKopecks": int(settled["gross"]),
        "unpaidGrossKopecks": max(gross_total - int(settled["gross"]), 0),
        "overpaidGrossKopecks": max(int(settled["gross"]) - gross_total, 0),
        "lines": line_payload,
        "events": event_payload,
    }


def api_project_commitments(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=False)
    if not user:
        return
    with db() as con:
        rows = con.execute(
            """
            SELECT commitment.*, company.name AS company_name, creator.name AS created_by_name
            FROM project_commitments commitment
            LEFT JOIN companies company ON company.id = commitment.company_id
            LEFT JOIN users creator ON creator.id = commitment.created_by
            WHERE commitment.project_id = ?
            ORDER BY commitment.created_at DESC, commitment.id DESC
            """,
            (project_id,),
        ).fetchall()
        line_rows = con.execute(
            """
            SELECT line.*
            FROM project_commitment_lines line
            JOIN project_commitments commitment ON commitment.id = line.commitment_id
            WHERE commitment.project_id = ?
            ORDER BY line.commitment_id, line.position, line.id
            """,
            (project_id,),
        ).fetchall()
        event_rows = con.execute(
            """
            SELECT event.*, actor.name AS actor_name
            FROM project_commitment_events event
            LEFT JOIN users actor ON actor.id = event.actor_id
            WHERE event.project_id = ?
            ORDER BY event.created_at, event.id
            """,
            (project_id,),
        ).fetchall()
        recognized_rows = con.execute(
            """
            SELECT entry.commitment_line_id,
                   COALESCE(SUM(CASE WHEN entry.entry_kind = 'cost'
                                     THEN entry.net_amount_kopecks
                                     ELSE -entry.net_amount_kopecks END), 0) AS net_amount,
                   COALESCE(SUM(CASE WHEN entry.entry_kind = 'cost'
                                     THEN entry.vat_amount_kopecks
                                     ELSE -entry.vat_amount_kopecks END), 0) AS vat_amount,
                   COALESCE(SUM(CASE WHEN entry.entry_kind = 'cost'
                                     THEN entry.gross_amount_kopecks
                                     ELSE -entry.gross_amount_kopecks END), 0) AS gross_amount
            FROM project_actual_cost_entries entry
            WHERE entry.project_id = ? AND entry.status = 'approved'
              AND entry.commitment_line_id IS NOT NULL
            GROUP BY entry.commitment_line_id
            """,
            (project_id,),
        ).fetchall()
        settlement_rows = con.execute(
            """
            SELECT COALESCE(allocation.target_commitment_id, actual.commitment_id) AS commitment_id,
                   COALESCE(SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                     THEN allocation.net_amount_kopecks
                                     ELSE -allocation.net_amount_kopecks END), 0) AS net_amount,
                   COALESCE(SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                     THEN allocation.vat_amount_kopecks
                                     ELSE -allocation.vat_amount_kopecks END), 0) AS vat_amount,
                   COALESCE(SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                     THEN allocation.gross_amount_kopecks
                                     ELSE -allocation.gross_amount_kopecks END), 0) AS gross_amount
            FROM project_payment_allocations allocation
            LEFT JOIN project_actual_cost_entries actual
              ON actual.id = allocation.target_actual_cost_entry_id
            WHERE allocation.project_id = ? AND allocation.status = 'approved'
              AND allocation.allocation_purpose = 'supplier_payment'
              AND COALESCE(allocation.target_commitment_id, actual.commitment_id) IS NOT NULL
            GROUP BY COALESCE(allocation.target_commitment_id, actual.commitment_id)
            """,
            (project_id,),
        ).fetchall()

    lines_by_commitment: dict[int, list[sqlite3.Row]] = {}
    for line in line_rows:
        lines_by_commitment.setdefault(int(line["commitment_id"]), []).append(line)
    events_by_commitment: dict[int, list[sqlite3.Row]] = {}
    for event in event_rows:
        events_by_commitment.setdefault(int(event["commitment_id"]), []).append(event)
    recognized_by_line = {
        int(row["commitment_line_id"]): {
            "net": int(row["net_amount"]),
            "vat": int(row["vat_amount"]),
            "gross": int(row["gross_amount"]),
        }
        for row in recognized_rows
    }
    settled_by_commitment = {
        int(row["commitment_id"]): {
            "net": int(row["net_amount"]),
            "vat": int(row["vat_amount"]),
            "gross": int(row["gross_amount"]),
        }
        for row in settlement_rows
    }
    items = [
        serialize_commitment(
            row,
            lines_by_commitment.get(int(row["id"]), []),
            events_by_commitment.get(int(row["id"]), []),
            recognized_by_line,
            settled_by_commitment,
        )
        for row in rows
    ]
    approved = [item for item in items if item["status"] == "approved"]
    approved_lines = [line for item in approved for line in item["lines"]]
    handler.send_json(
        HTTPStatus.OK,
        {
            "items": items,
            "summary": {
                "approvedCount": len(approved),
                "approvedNetKopecks": sum(item["netAmountKopecks"] for item in approved),
                "approvedVatKopecks": sum(item["vatAmountKopecks"] for item in approved),
                "approvedGrossKopecks": sum(item["grossAmountKopecks"] for item in approved),
                "recognizedNetKopecks": sum(line["recognizedNetKopecks"] for line in approved_lines),
                "remainingNetKopecks": sum(line["remainingNetKopecks"] for line in approved_lines),
                "overrunNetKopecks": sum(line["overrunNetKopecks"] for line in approved_lines),
                "allocatedPaymentGrossKopecks": sum(
                    item["allocatedPaymentGrossKopecks"] for item in approved
                ),
                "unpaidGrossKopecks": sum(item["unpaidGrossKopecks"] for item in approved),
                "overpaidGrossKopecks": sum(item["overpaidGrossKopecks"] for item in approved),
            },
        },
    )


def resolve_approved_baseline_and_budget_line(
    con: sqlite3.Connection,
    project_id: int,
    estimate_item_id: int,
    requested_baseline_id: object,
    requested_budget_line_id: object,
) -> tuple[int, int] | tuple[None, str]:
    try:
        baseline_id = int(requested_baseline_id) if requested_baseline_id not in (None, "") else None
        budget_line_id = int(requested_budget_line_id) if requested_budget_line_id not in (None, "") else None
    except (TypeError, ValueError):
        return None, "bad_financial_relation_id"
    if baseline_id is None:
        baseline = con.execute(
            """
            SELECT id FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (project_id,),
        ).fetchone()
    else:
        baseline = con.execute(
            """
            SELECT id FROM project_financial_baselines
            WHERE id = ? AND project_id = ? AND status = 'approved'
            """,
            (baseline_id, project_id),
        ).fetchone()
    if not baseline:
        return None, "approved_financial_baseline_required"
    baseline_id = int(baseline["id"])

    if budget_line_id is not None:
        budget_line = con.execute(
            """
            SELECT id FROM project_budget_lines
            WHERE id = ? AND baseline_id = ?
              AND line_type = 'direct_cost'
              AND (estimate_item_id = ? OR estimate_item_id IS NULL)
            """,
            (budget_line_id, baseline_id, estimate_item_id),
        ).fetchone()
        if not budget_line:
            return None, "commitment_budget_mapping_required"
        return baseline_id, int(budget_line["id"])

    budget_lines = con.execute(
        """
        SELECT id FROM project_budget_lines
        WHERE baseline_id = ? AND estimate_item_id = ?
          AND line_type = 'direct_cost'
        ORDER BY position, id
        """,
        (baseline_id, estimate_item_id),
    ).fetchall()
    if len(budget_lines) != 1:
        return None, "commitment_budget_mapping_required"
    return baseline_id, int(budget_lines[0]["id"])


def normalized_operational_unit(value: object) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def operational_unit_issue(
    con: sqlite3.Connection,
    budget_line_id: int,
    operational_unit: object,
) -> str | None:
    """Protect quantity math from mixing unrelated units without a factor."""
    budget = con.execute(
        "SELECT unit, quantity FROM project_budget_lines WHERE id = ?",
        (budget_line_id,),
    ).fetchone()
    if not budget:
        return "commitment_budget_mapping_required"
    target_quantity = (
        decimal_value(budget["quantity"]) if budget["quantity"] is not None else None
    )
    if target_quantity is not None and target_quantity > 0:
        if normalized_operational_unit(budget["unit"]) != normalized_operational_unit(
            operational_unit
        ):
            return "operational_unit_mismatch"
    return None


def api_create_commitment(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    commitment_type = str(
        payload_value(payload, "commitmentType", "commitment_type", "other")
    ).strip()
    counterparty_name = str(
        payload_value(payload, "counterpartyName", "counterparty_name", "")
    ).strip()
    reason = str(payload.get("reason", "")).strip()
    commitment_no = str(
        payload_value(payload, "commitmentNo", "commitment_no", "")
    ).strip() or None
    if commitment_type not in {"purchase_order", "subcontract", "other"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_commitment_type"})
        return
    if not counterparty_name or not reason:
        handler.send_json(
            HTTPStatus.BAD_REQUEST,
            {"error": "counterparty_and_reason_required"},
        )
        return
    try:
        company_id = optional_positive_int(
            payload_value(payload, "companyId", "company_id")
        )
        document_id = optional_positive_int(
            payload_value(payload, "documentId", "document_id")
        )
        baseline_id = optional_positive_int(
            payload_value(payload, "baselineId", "baseline_id")
        )
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_commitment_relation_id"})
        return
    lines_payload = payload.get("lines")
    if not isinstance(lines_payload, list) or not lines_payload:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "commitment_lines_required"})
        return
    normalized_lines = []
    try:
        for item in lines_payload:
            if not isinstance(item, dict):
                raise ValueError("bad_commitment_line")
            title = str(item.get("title", "")).strip()
            source_reference = str(
                payload_value(item, "sourceReference", "source_reference", "")
            ).strip()
            if not title or not source_reference:
                raise ValueError("commitment_line_title_and_source_required")
            budget_line_id = optional_positive_int(
                payload_value(item, "budgetLineId", "budget_line_id")
            )
            estimate_item_id = optional_positive_int(
                payload_value(item, "estimateItemId", "estimate_item_id")
            )
            if budget_line_id is None:
                raise ValueError("commitment_budget_mapping_required")
            vat_mode = str(payload_value(item, "vatMode", "vat_mode", "")).strip()
            vat_rate = int(
                payload_value(item, "vatRateBasisPoints", "vat_rate_basis_points", 0)
                or 0
            )
            amounts = normalize_offer_amounts(
                payload_value(item, "unitPrice", "unit_price"),
                item.get("quantity"),
                vat_mode,
                vat_rate,
            )
            normalized_lines.append({
                "budget_line_id": budget_line_id,
                "estimate_item_id": estimate_item_id,
                "title": title,
                "unit": str(item.get("unit", "")).strip() or None,
                "vat_mode": vat_mode,
                "vat_rate": vat_rate,
                "source_reference": source_reference,
                "amounts": amounts,
            })
    except (TypeError, ValueError) as exc:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        return

    with db() as con:
        if baseline_id is None:
            baseline = con.execute(
                """
                SELECT id FROM project_financial_baselines
                WHERE project_id = ? AND status = 'approved'
                """,
                (project_id,),
            ).fetchone()
            baseline_id = int(baseline["id"]) if baseline else None
        else:
            baseline = con.execute(
                """
                SELECT id FROM project_financial_baselines
                WHERE id = ? AND project_id = ? AND status = 'approved'
                """,
                (baseline_id, project_id),
            ).fetchone()
        if baseline_id is None or not baseline:
            handler.send_json(
                HTTPStatus.CONFLICT,
                {"error": "approved_financial_baseline_required"},
            )
            return
        if company_id is not None and not con.execute(
            "SELECT 1 FROM companies WHERE id = ?", (company_id,)
        ).fetchone():
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "company_not_found"})
            return
        if document_id is not None and not con.execute(
            "SELECT 1 FROM documents WHERE id = ? AND project_id = ?",
            (document_id, project_id),
        ).fetchone():
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "document_not_found"})
            return
        for line in normalized_lines:
            budget_line = con.execute(
                """
                SELECT estimate_item_id, unit, quantity FROM project_budget_lines
                WHERE id = ? AND baseline_id = ? AND line_type = 'direct_cost'
                """,
                (line["budget_line_id"], baseline_id),
            ).fetchone()
            if not budget_line:
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {"error": "commitment_budget_mapping_required"},
                )
                return
            mapped_estimate_id = budget_line["estimate_item_id"]
            if (
                line["estimate_item_id"] is not None
                and mapped_estimate_id is not None
                and int(mapped_estimate_id) != int(line["estimate_item_id"])
            ):
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {"error": "commitment_budget_mapping_required"},
                )
                return
            if line["estimate_item_id"] is None and mapped_estimate_id is not None:
                line["estimate_item_id"] = int(mapped_estimate_id)
            unit_issue = operational_unit_issue(
                con, int(line["budget_line_id"]), line["unit"]
            )
            if unit_issue:
                handler.send_json(HTTPStatus.CONFLICT, {"error": unit_issue})
                return
        timestamp = now_ts()
        try:
            cursor = con.execute(
                """
                INSERT INTO project_commitments (
                    project_id, baseline_id, commitment_type, commitment_no, status,
                    currency_code, company_id, counterparty_name, document_id,
                    expected_date, reason, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'draft', 'RUB', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id, baseline_id, commitment_type, commitment_no, company_id,
                    counterparty_name, document_id,
                    str(payload_value(payload, "expectedDate", "expected_date", "")).strip() or None,
                    reason, user["id"], timestamp, timestamp,
                ),
            )
            commitment_id = int(cursor.lastrowid)
            for position, line in enumerate(normalized_lines, start=1):
                amounts = line["amounts"]
                con.execute(
                    """
                    INSERT INTO project_commitment_lines (
                        commitment_id, position, budget_line_id, estimate_item_id,
                        title, unit, quantity, source_unit_price_kopecks,
                        unit_cost_net_kopecks, net_amount_kopecks,
                        vat_rate_basis_points, vat_amount_kopecks,
                        gross_amount_kopecks, source_vat_mode, source_reference,
                        created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        commitment_id, position, line["budget_line_id"],
                        line["estimate_item_id"], line["title"], line["unit"],
                        amounts["quantity"], amounts["source_unit_price_kopecks"],
                        amounts["unit_cost_net_kopecks"], amounts["net_amount_kopecks"],
                        line["vat_rate"], amounts["vat_amount_kopecks"],
                        amounts["gross_amount_kopecks"], line["vat_mode"],
                        line["source_reference"], user["id"], timestamp,
                    ),
                )
        except sqlite3.IntegrityError as exc:
            con.rollback()
            if "UNIQUE constraint failed" in str(exc) and commitment_no:
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {"error": "commitment_number_already_exists"},
                )
                return
            raise
        create_commitment_event(
            con,
            commitment_id,
            project_id,
            "created",
            int(user["id"]),
            {"baselineId": baseline_id, "lineCount": len(normalized_lines)},
        )
        create_audit(
            con,
            int(user["id"]),
            "create_project_commitment_draft",
            commitment_id,
            {"project_id": project_id, "source": "manual"},
        )
        con.commit()
    handler.send_json(
        HTTPStatus.CREATED,
        {"id": commitment_id, "status": "draft", "baselineId": baseline_id},
    )


def api_create_commitment_from_offer(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    try:
        supplier_offer_id = int(payload.get("supplierOfferId", payload.get("supplier_offer_id")))
        vat_rate_basis_points = int(payload.get("vatRateBasisPoints", payload.get("vat_rate_basis_points", 0)) or 0)
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_offer_or_vat"})
        return
    vat_mode = str(payload.get("vatMode", payload.get("vat_mode", ""))).strip()
    reason = str(payload.get("reason", "")).strip()
    if vat_mode not in {"net", "gross", "no_vat"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "vat_mode_required"})
        return
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
        return
    commitment_type = str(payload.get("commitmentType", payload.get("commitment_type", ""))).strip()

    with db() as con:
        # Serialize the offer check and draft creation.  Without the write lock,
        # two requests could both observe no commitment and create duplicates.
        con.execute("BEGIN IMMEDIATE")
        offer = con.execute(
            """
            SELECT offer.*, item.title AS item_title, item.planned_qty, item.unit AS item_unit,
                   company.name AS company_name
            FROM supplier_offers offer
            LEFT JOIN estimate_items item ON item.id = offer.estimate_item_id
            LEFT JOIN companies company ON company.id = offer.company_id
            WHERE offer.id = ? AND offer.project_id = ? AND offer.status = 'selected'
            """,
            (supplier_offer_id, project_id),
        ).fetchone()
        if not offer or offer["estimate_item_id"] is None:
            handler.send_json(HTTPStatus.CONFLICT, {"error": "selected_project_offer_required"})
            return
        existing = con.execute(
            """
            SELECT id FROM project_commitments
            WHERE source_supplier_offer_id = ? AND status <> 'cancelled'
            """,
            (supplier_offer_id,),
        ).fetchone()
        if existing:
            handler.send_json(
                HTTPStatus.CONFLICT,
                {"error": "offer_commitment_exists", "commitmentId": int(existing["id"])},
            )
            return

        relation = resolve_approved_baseline_and_budget_line(
            con,
            project_id,
            int(offer["estimate_item_id"]),
            payload.get("baselineId", payload.get("baseline_id")),
            payload.get("budgetLineId", payload.get("budget_line_id")),
        )
        if relation[0] is None:
            handler.send_json(HTTPStatus.CONFLICT, {"error": relation[1]})
            return
        baseline_id, budget_line_id = relation

        if not commitment_type:
            commitment_type = "subcontract" if offer["candidate_type"] == "contractor" else "purchase_order"
        if commitment_type not in {"purchase_order", "subcontract", "other"}:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_commitment_type"})
            return
        quantity = float(offer["qty"] or offer["planned_qty"] or 0)
        try:
            amounts = normalize_offer_amounts(
                offer["price"],
                quantity,
                vat_mode,
                vat_rate_basis_points,
            )
        except ValueError as exc:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        offer_unit = str(offer["unit"] or offer["item_unit"] or "").strip() or None
        unit_issue = operational_unit_issue(con, int(budget_line_id), offer_unit)
        if unit_issue:
            handler.send_json(HTTPStatus.CONFLICT, {"error": unit_issue})
            return

        timestamp = now_ts()
        counterparty_name = str(offer["company_name"] or offer["candidate_name"] or "").strip()
        commitment_no = str(payload.get("commitmentNo", payload.get("commitment_no", ""))).strip() or None
        cursor = con.execute(
            """
            INSERT INTO project_commitments (
                project_id, baseline_id, source_supplier_offer_id, commitment_type,
                commitment_no, status, currency_code, company_id, counterparty_name,
                expected_date, reason, created_by, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'draft', 'RUB', ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                baseline_id,
                supplier_offer_id,
                commitment_type,
                commitment_no,
                offer["company_id"],
                counterparty_name,
                str(payload.get("expectedDate", payload.get("expected_date", ""))).strip() or None,
                reason,
                user["id"],
                timestamp,
                timestamp,
            ),
        )
        commitment_id = int(cursor.lastrowid)
        con.execute(
            """
            INSERT INTO project_commitment_lines (
                commitment_id, position, budget_line_id, estimate_item_id, supplier_offer_id,
                title, unit, quantity, source_unit_price_kopecks, unit_cost_net_kopecks,
                net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                gross_amount_kopecks, source_vat_mode, source_reference, created_by, created_at
            )
            VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                commitment_id,
                budget_line_id,
                offer["estimate_item_id"],
                supplier_offer_id,
                str(offer["item_title"] or offer["candidate_name"]),
                offer_unit,
                amounts["quantity"],
                amounts["source_unit_price_kopecks"],
                amounts["unit_cost_net_kopecks"],
                amounts["net_amount_kopecks"],
                vat_rate_basis_points,
                amounts["vat_amount_kopecks"],
                amounts["gross_amount_kopecks"],
                vat_mode,
                f"supplier_offer:{supplier_offer_id}:activated_at:{offer['activated_at'] or ''}",
                user["id"],
                timestamp,
            ),
        )
        create_commitment_event(
            con,
            commitment_id,
            project_id,
            "created",
            int(user["id"]),
            {
                "supplierOfferId": supplier_offer_id,
                "baselineId": baseline_id,
                "budgetLineId": budget_line_id,
            },
        )
        create_audit(
            con,
            int(user["id"]),
            "create_project_commitment_draft",
            commitment_id,
            {"project_id": project_id, "supplier_offer_id": supplier_offer_id},
        )
        con.commit()
    handler.send_json(
        HTTPStatus.CREATED,
        {
            "id": commitment_id,
            "status": "draft",
            "baselineId": baseline_id,
            "budgetLineId": budget_line_id,
            "netAmountKopecks": amounts["net_amount_kopecks"],
            "vatAmountKopecks": amounts["vat_amount_kopecks"],
            "grossAmountKopecks": amounts["gross_amount_kopecks"],
        },
    )


def load_commitment_for_action(
    handler,
    path: str,
) -> tuple[sqlite3.Connection, sqlite3.Row, dict] | None:
    commitment_id = parse_path_int(path, 2)
    if not commitment_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_commitment_id"})
        return None
    con = db()
    commitment = con.execute(
        "SELECT * FROM project_commitments WHERE id = ?",
        (commitment_id,),
    ).fetchone()
    if not commitment:
        con.close()
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "commitment_not_found"})
        return None
    user = require_economics_access(handler, int(commitment["project_id"]), manage=True)
    if not user:
        con.close()
        return None
    return con, commitment, user


def api_update_commitment(handler, path: str) -> None:
    loaded = load_commitment_for_action(handler, path)
    if not loaded:
        return
    con, commitment, user = loaded
    try:
        payload = handler.read_json()
        con.execute("BEGIN IMMEDIATE")
        commitment = con.execute(
            "SELECT * FROM project_commitments WHERE id = ?",
            (commitment["id"],),
        ).fetchone()
        if not commitment or commitment["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_editable"})
            return
        line = con.execute(
            "SELECT * FROM project_commitment_lines WHERE commitment_id = ? ORDER BY position, id LIMIT 1",
            (commitment["id"],),
        ).fetchone()
        if not line:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_lines_required"})
            return
        relation = resolve_approved_baseline_and_budget_line(
            con,
            int(commitment["project_id"]),
            int(line["estimate_item_id"] or 0),
            payload.get("baselineId", payload.get("baseline_id", commitment["baseline_id"])),
            payload.get("budgetLineId", payload.get("budget_line_id", line["budget_line_id"])),
        )
        if relation[0] is None:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": relation[1]})
            return
        baseline_id, budget_line_id = relation
        unit_issue = operational_unit_issue(con, int(budget_line_id), line["unit"])
        if unit_issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": unit_issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_commitments
            SET baseline_id = ?, commitment_no = ?, expected_date = ?, reason = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (
                baseline_id,
                str(payload.get("commitmentNo", payload.get("commitment_no", commitment["commitment_no"] or ""))).strip() or None,
                str(payload.get("expectedDate", payload.get("expected_date", commitment["expected_date"] or ""))).strip() or None,
                str(payload.get("reason", commitment["reason"])).strip() or commitment["reason"],
                timestamp,
                commitment["id"],
            ),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_editable"})
            return
        con.execute(
            "UPDATE project_commitment_lines SET budget_line_id = ? WHERE id = ?",
            (budget_line_id, line["id"]),
        )
        create_commitment_event(
            con,
            int(commitment["id"]),
            int(commitment["project_id"]),
            "updated",
            int(user["id"]),
            {"baselineId": baseline_id, "budgetLineId": budget_line_id},
        )
        create_audit(
            con,
            int(user["id"]),
            "update_project_commitment_draft",
            int(commitment["id"]),
            {"project_id": commitment["project_id"]},
        )
        con.commit()
    except sqlite3.IntegrityError as exc:
        con.rollback()
        handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        return
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(commitment["id"]), "status": "draft"})


def api_submit_commitment(handler, path: str) -> None:
    loaded = load_commitment_for_action(handler, path)
    if not loaded:
        return
    con, commitment, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        commitment = con.execute(
            "SELECT * FROM project_commitments WHERE id = ?",
            (commitment["id"],),
        ).fetchone()
        if not commitment or commitment["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_draft"})
            return
        issue = commitment_approval_issue(con, commitment)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_commitments
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (user["id"], timestamp, timestamp, commitment["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_draft"})
            return
        create_commitment_event(
            con,
            int(commitment["id"]),
            int(commitment["project_id"]),
            "submitted",
            int(user["id"]),
        )
        create_audit(
            con,
            int(user["id"]),
            "submit_project_commitment",
            int(commitment["id"]),
            {"project_id": commitment["project_id"]},
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(commitment["id"]), "status": "pending_approval"})


def api_approve_commitment(handler, path: str) -> None:
    loaded = load_commitment_for_action(handler, path)
    if not loaded:
        return
    con, commitment, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        commitment = con.execute(
            "SELECT * FROM project_commitments WHERE id = ?",
            (commitment["id"],),
        ).fetchone()
        if not commitment or commitment["status"] != "pending_approval":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_pending"})
            return
        issue = commitment_approval_issue(con, commitment)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_commitments
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ? AND status = 'pending_approval'
            """,
            (user["id"], timestamp, timestamp, commitment["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_pending"})
            return
        create_commitment_event(
            con,
            int(commitment["id"]),
            int(commitment["project_id"]),
            "approved",
            int(user["id"]),
        )
        create_audit(
            con,
            int(user["id"]),
            "approve_project_commitment",
            int(commitment["id"]),
            {"project_id": commitment["project_id"]},
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(commitment["id"]), "status": "approved"})


def api_cancel_commitment(handler, path: str) -> None:
    loaded = load_commitment_for_action(handler, path)
    if not loaded:
        return
    con, commitment, user = loaded
    try:
        payload = handler.read_json()
        cancellation_reason = str(
            payload.get("cancellationReason", payload.get("cancellation_reason", ""))
        ).strip()
        if not cancellation_reason:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "cancellation_reason_required"})
            return
        con.execute("BEGIN IMMEDIATE")
        commitment = con.execute(
            "SELECT * FROM project_commitments WHERE id = ?",
            (commitment["id"],),
        ).fetchone()
        if not commitment or commitment["status"] != "approved":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_approved"})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_commitments
            SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?,
                cancellation_reason = ?, updated_at = ?
            WHERE id = ? AND status = 'approved'
            """,
            (user["id"], timestamp, cancellation_reason, timestamp, commitment["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "commitment_not_approved"})
            return
        create_commitment_event(
            con,
            int(commitment["id"]),
            int(commitment["project_id"]),
            "cancelled",
            int(user["id"]),
            {"reason": cancellation_reason},
        )
        create_audit(
            con,
            int(user["id"]),
            "cancel_project_commitment",
            int(commitment["id"]),
            {"project_id": commitment["project_id"], "reason": cancellation_reason},
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(commitment["id"]), "status": "cancelled"})


ACTUAL_COST_CATEGORIES = {
    "material",
    "subcontract",
    "labor",
    "equipment",
    "service",
    "logistics",
    "overhead",
    "other",
}
GENERIC_ACTUAL_COST_SOURCES = {
    "subcontract_act",
    "service_act",
    "labor_timesheet",
    "equipment_log",
    "manual_expense",
}
DOCUMENT_ACTUAL_COST_SOURCES = {"subcontract_act", "service_act", "manual_expense"}
SOURCE_DEFAULT_CATEGORY = {
    "material_receipt": "material",
    "warehouse_issue": "material",
    "subcontract_act": "subcontract",
    "service_act": "service",
    "labor_timesheet": "labor",
    "equipment_log": "equipment",
    "manual_expense": "other",
}


def create_actual_cost_event(
    con: sqlite3.Connection,
    entry_id: int,
    project_id: int,
    action: str,
    actor_id: int,
    details: dict | None = None,
) -> None:
    con.execute(
        """
        INSERT INTO project_actual_cost_events (
            actual_cost_entry_id, project_id, action, actor_id, details, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id,
            project_id,
            action,
            actor_id,
            json.dumps(details or {}, ensure_ascii=False),
            now_ts(),
        ),
    )


def payload_value(payload: dict, camel: str, snake: str, default: object = None) -> object:
    if camel in payload:
        return payload.get(camel)
    if snake in payload:
        return payload.get(snake)
    return default


def optional_positive_int(value: object) -> int | None:
    if value in (None, ""):
        return None
    result = int(value)
    if result <= 0:
        raise ValueError("bad_relation_id")
    return result


def normalized_recognition_date(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("bad_recognition_date") from exc
    return text


def resolve_actual_cost_mapping(
    con: sqlite3.Connection,
    project_id: int,
    payload: dict,
    *,
    default_estimate_item_id: int | None = None,
) -> tuple[dict, None] | tuple[None, str]:
    try:
        baseline_id = optional_positive_int(payload_value(payload, "baselineId", "baseline_id"))
        budget_line_id = optional_positive_int(payload_value(payload, "budgetLineId", "budget_line_id"))
        estimate_item_id = optional_positive_int(
            payload_value(payload, "estimateItemId", "estimate_item_id", default_estimate_item_id)
        )
        commitment_line_id = optional_positive_int(
            payload_value(payload, "commitmentLineId", "commitment_line_id")
        )
    except (TypeError, ValueError):
        return None, "bad_financial_relation_id"

    commitment_id = None
    if commitment_line_id is not None:
        commitment_line = con.execute(
            """
            SELECT line.id, line.commitment_id, line.budget_line_id, line.estimate_item_id,
                   commitment.baseline_id
            FROM project_commitment_lines line
            JOIN project_commitments commitment ON commitment.id = line.commitment_id
            WHERE line.id = ? AND commitment.project_id = ? AND commitment.status = 'approved'
            """,
            (commitment_line_id, project_id),
        ).fetchone()
        if not commitment_line:
            return None, "approved_project_commitment_required"
        commitment_id = int(commitment_line["commitment_id"])
        inferred_baseline = int(commitment_line["baseline_id"])
        inferred_budget = int(commitment_line["budget_line_id"])
        inferred_estimate = commitment_line["estimate_item_id"]
        if baseline_id is not None and baseline_id != inferred_baseline:
            return None, "actual_cost_commitment_mapping_mismatch"
        if budget_line_id is not None and budget_line_id != inferred_budget:
            return None, "actual_cost_commitment_mapping_mismatch"
        if estimate_item_id is not None and inferred_estimate is not None and estimate_item_id != int(inferred_estimate):
            return None, "actual_cost_commitment_mapping_mismatch"
        baseline_id = inferred_baseline
        budget_line_id = inferred_budget
        estimate_item_id = estimate_item_id or (int(inferred_estimate) if inferred_estimate else None)

    if baseline_id is None:
        baseline = con.execute(
            """
            SELECT id FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (project_id,),
        ).fetchone()
    elif commitment_line_id is not None:
        baseline = con.execute(
            """
            SELECT id, status FROM project_financial_baselines
            WHERE id = ? AND project_id = ? AND status IN ('approved','superseded')
            """,
            (baseline_id, project_id),
        ).fetchone()
        if baseline and baseline["status"] == "superseded":
            current = con.execute(
                """
                SELECT id FROM project_financial_baselines
                WHERE project_id = ? AND status = 'approved'
                """,
                (project_id,),
            ).fetchone()
            resolution = (
                resolved_budget_line_map(con, project_id, int(current["id"]))
                if current else {}
            )
            if budget_line_id not in resolution:
                baseline = None
    else:
        baseline = con.execute(
            """
            SELECT id FROM project_financial_baselines
            WHERE id = ? AND project_id = ? AND status = 'approved'
            """,
            (baseline_id, project_id),
        ).fetchone()
    if not baseline:
        return None, "approved_financial_baseline_required"
    baseline_id = int(baseline["id"])

    if budget_line_id is None and estimate_item_id is not None:
        candidates = con.execute(
            """
            SELECT id FROM project_budget_lines
            WHERE baseline_id = ? AND estimate_item_id = ?
              AND line_type = 'direct_cost'
            ORDER BY position, id
            """,
            (baseline_id, estimate_item_id),
        ).fetchall()
        if len(candidates) == 1:
            budget_line_id = int(candidates[0]["id"])
    if budget_line_id is None:
        return None, "actual_cost_budget_mapping_required"

    budget_line = con.execute(
        """
        SELECT id, estimate_item_id FROM project_budget_lines
        WHERE id = ? AND baseline_id = ? AND line_type = 'direct_cost'
        """,
        (budget_line_id, baseline_id),
    ).fetchone()
    if not budget_line:
        return None, "actual_cost_budget_mapping_required"
    budget_estimate_id = budget_line["estimate_item_id"]
    if estimate_item_id is None and budget_estimate_id is not None:
        estimate_item_id = int(budget_estimate_id)
    if estimate_item_id is not None:
        item = con.execute(
            "SELECT id FROM estimate_items WHERE id = ? AND project_id = ?",
            (estimate_item_id, project_id),
        ).fetchone()
        if not item:
            return None, "actual_cost_estimate_item_project_mismatch"
        if budget_estimate_id is not None and int(budget_estimate_id) != estimate_item_id:
            return None, "actual_cost_budget_mapping_required"

    return {
        "baseline_id": baseline_id,
        "budget_line_id": budget_line_id,
        "commitment_id": commitment_id,
        "commitment_line_id": commitment_line_id,
        "estimate_item_id": estimate_item_id,
    }, None


def amounts_from_actual_cost_payload(
    payload: dict,
    *,
    default_price: object | None = None,
    default_quantity: object | None = None,
) -> tuple[dict, None] | tuple[None, str]:
    price = payload_value(payload, "unitPrice", "unit_price", default_price)
    quantity = payload.get("quantity", default_quantity)
    vat_mode = str(payload_value(payload, "vatMode", "vat_mode", "")).strip()
    try:
        vat_rate = int(payload_value(payload, "vatRateBasisPoints", "vat_rate_basis_points", 0) or 0)
        amounts = normalize_offer_amounts(price, quantity, vat_mode, vat_rate)
    except (TypeError, ValueError) as exc:
        return None, str(exc)
    return amounts, None


def insert_actual_cost_draft(
    con: sqlite3.Connection,
    *,
    project_id: int,
    mapping: dict,
    source: dict,
    amounts: dict,
    payload: dict,
    user_id: int,
) -> int:
    source = dict(source)
    if source.get("entry_kind", "cost") == "cost":
        if not normalized_operational_unit(source.get("unit")):
            budget_unit = con.execute(
                "SELECT unit FROM project_budget_lines WHERE id = ?",
                (int(mapping["budget_line_id"]),),
            ).fetchone()
            if budget_unit:
                source["unit"] = str(budget_unit["unit"] or "").strip() or None
        unit_issue = operational_unit_issue(
            con, int(mapping["budget_line_id"]), source.get("unit")
        )
        if unit_issue:
            raise ValueError(unit_issue)
    timestamp = now_ts()
    cursor = con.execute(
        """
        INSERT INTO project_actual_cost_entries (
            project_id, baseline_id, budget_line_id, commitment_id, commitment_line_id,
            estimate_item_id, cost_category, entry_kind, source_type, source_event_key,
            stock_move_id, warehouse_transfer_id, document_id, reverses_entry_id,
            title, recognition_date, unit, quantity, source_unit_price_kopecks,
            unit_cost_net_kopecks, net_amount_kopecks, vat_rate_basis_points,
            vat_amount_kopecks, gross_amount_kopecks, source_vat_mode,
            valuation_method, source_reference, reason, status, created_by,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                'draft', ?, ?, ?)
        """,
        (
            project_id,
            mapping["baseline_id"],
            mapping["budget_line_id"],
            mapping.get("commitment_id"),
            mapping.get("commitment_line_id"),
            mapping.get("estimate_item_id"),
            source["cost_category"],
            source.get("entry_kind", "cost"),
            source["source_type"],
            source["source_event_key"],
            source.get("stock_move_id"),
            source.get("warehouse_transfer_id"),
            source.get("document_id"),
            source.get("reverses_entry_id"),
            source["title"],
            normalized_recognition_date(payload_value(payload, "recognitionDate", "recognition_date")),
            source.get("unit"),
            amounts["quantity"],
            amounts["source_unit_price_kopecks"],
            amounts["unit_cost_net_kopecks"],
            amounts["net_amount_kopecks"],
            int(payload_value(payload, "vatRateBasisPoints", "vat_rate_basis_points", 0) or 0),
            amounts["vat_amount_kopecks"],
            amounts["gross_amount_kopecks"],
            str(payload_value(payload, "vatMode", "vat_mode", "")),
            source["valuation_method"],
            source["source_reference"],
            source["reason"],
            user_id,
            timestamp,
            timestamp,
        ),
    )
    entry_id = int(cursor.lastrowid)
    create_actual_cost_event(
        con,
        entry_id,
        project_id,
        "created",
        user_id,
        {
            "sourceType": source["source_type"],
            "sourceEventKey": source["source_event_key"],
            "baselineId": mapping["baseline_id"],
            "budgetLineId": mapping["budget_line_id"],
            "commitmentLineId": mapping.get("commitment_line_id"),
        },
    )
    create_audit(
        con,
        user_id,
        "create_project_actual_cost_draft",
        entry_id,
        {"project_id": project_id, "source_type": source["source_type"]},
        entity="project_actual_cost",
    )
    return entry_id


def duplicate_source_response(
    handler,
    con: sqlite3.Connection,
    project_id: int,
    source_type: str,
    source_event_key: str,
) -> None:
    existing = con.execute(
        """
        SELECT id FROM project_actual_cost_entries
        WHERE project_id = ? AND source_type = ? AND source_event_key = ?
        """,
        (project_id, source_type, source_event_key),
    ).fetchone()
    payload = {"error": "actual_cost_source_already_registered"}
    if existing:
        payload["actualCostEntryId"] = int(existing["id"])
    handler.send_json(HTTPStatus.CONFLICT, payload)


def api_create_actual_cost_from_stock_move(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    try:
        stock_move_id = int(payload_value(payload, "stockMoveId", "stock_move_id"))
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stock_move_id"})
        return
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
        return
    with db() as con:
        move = con.execute(
            """
            SELECT move.*, item.title AS item_title, item.unit AS item_unit
            FROM stock_moves move
            LEFT JOIN estimate_items item ON item.id = move.estimate_item_id
            WHERE move.id = ? AND move.project_id = ?
            """,
            (stock_move_id, project_id),
        ).fetchone()
        if not move:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "stock_move_not_found"})
            return
        if move["move_type"] not in {"purchase", "receipt"} or float(move["price"] or 0) <= 0:
            handler.send_json(HTTPStatus.CONFLICT, {"error": "priced_material_receipt_required"})
            return
        mapping, issue = resolve_actual_cost_mapping(
            con,
            project_id,
            payload,
            default_estimate_item_id=move["estimate_item_id"],
        )
        if issue:
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        amounts, issue = amounts_from_actual_cost_payload(
            payload,
            default_price=move["price"],
            default_quantity=move["qty"],
        )
        if issue:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": issue})
            return
        source_event_key = f"stock_move:{stock_move_id}"
        source = {
            "cost_category": "material",
            "source_type": "material_receipt",
            "source_event_key": source_event_key,
            "stock_move_id": stock_move_id,
            "title": str(payload.get("title") or move["item_title"] or f"Material receipt {stock_move_id}"),
            "unit": str(move["item_unit"] or "").strip() or None,
            "valuation_method": "source_document",
            "source_reference": f"stock_move:{stock_move_id}",
            "reason": reason,
        }
        try:
            entry_id = insert_actual_cost_draft(
                con,
                project_id=project_id,
                mapping=mapping,
                source=source,
                amounts=amounts,
                payload=payload,
                user_id=int(user["id"]),
            )
            con.commit()
        except ValueError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
        except sqlite3.IntegrityError as exc:
            if "UNIQUE constraint failed" in str(exc):
                duplicate_source_response(handler, con, project_id, "material_receipt", source_event_key)
                return
            raise
    handler.send_json(HTTPStatus.CREATED, {"id": entry_id, "status": "draft"})


def api_create_actual_cost_from_warehouse_transfer(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    try:
        transfer_id = int(payload_value(payload, "warehouseTransferId", "warehouse_transfer_id"))
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_warehouse_transfer_id"})
        return
    valuation_method = str(payload_value(payload, "valuationMethod", "valuation_method", "")).strip()
    if valuation_method not in {"lot", "moving_weighted_average"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "warehouse_valuation_method_required"})
        return
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
        return
    with db() as con:
        transfer = con.execute(
            """
            SELECT transfer.*, item.name AS item_name
            FROM warehouse_transfers transfer
            JOIN warehouse_items item ON item.id = transfer.warehouse_item_id
            WHERE transfer.id = ? AND transfer.project_id = ?
            """,
            (transfer_id, project_id),
        ).fetchone()
        if not transfer:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "warehouse_transfer_not_found"})
            return
        mapping, issue = resolve_actual_cost_mapping(
            con,
            project_id,
            payload,
            default_estimate_item_id=transfer["estimate_item_id"],
        )
        if issue:
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        amounts, issue = amounts_from_actual_cost_payload(
            payload,
            default_quantity=transfer["qty"],
        )
        if issue:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": issue})
            return
        source_event_key = f"warehouse_transfer:{transfer_id}"
        source = {
            "cost_category": "material",
            "source_type": "warehouse_issue",
            "source_event_key": source_event_key,
            "warehouse_transfer_id": transfer_id,
            "title": str(payload.get("title") or transfer["item_name"]),
            "unit": str(transfer["unit"] or "").strip() or None,
            "valuation_method": valuation_method,
            "source_reference": f"warehouse_transfer:{transfer_id}",
            "reason": reason,
        }
        try:
            entry_id = insert_actual_cost_draft(
                con,
                project_id=project_id,
                mapping=mapping,
                source=source,
                amounts=amounts,
                payload=payload,
                user_id=int(user["id"]),
            )
            con.commit()
        except ValueError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
        except sqlite3.IntegrityError as exc:
            if "UNIQUE constraint failed" in str(exc):
                duplicate_source_response(handler, con, project_id, "warehouse_issue", source_event_key)
                return
            raise
    handler.send_json(HTTPStatus.CREATED, {"id": entry_id, "status": "draft"})


def api_create_actual_cost(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    source_type = str(payload_value(payload, "sourceType", "source_type", "")).strip()
    if source_type not in GENERIC_ACTUAL_COST_SOURCES:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_actual_cost_source_type"})
        return
    reason = str(payload.get("reason", "")).strip()
    title = str(payload.get("title", "")).strip()
    source_line_key = str(payload_value(payload, "sourceEventKey", "source_event_key", "")).strip()
    if not reason or not title or not source_line_key:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_reason_and_source_event_key_required"})
        return
    cost_category = str(
        payload_value(payload, "costCategory", "cost_category", SOURCE_DEFAULT_CATEGORY[source_type])
    ).strip()
    if cost_category not in ACTUAL_COST_CATEGORIES:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_cost_category"})
        return
    try:
        document_id = optional_positive_int(payload_value(payload, "documentId", "document_id"))
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_document_id"})
        return
    if source_type in DOCUMENT_ACTUAL_COST_SOURCES and document_id is None:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "source_document_required"})
        return
    valuation_method = "approved_rate" if source_type in {"labor_timesheet", "equipment_log"} else "source_document"
    with db() as con:
        if document_id is not None:
            document = con.execute(
                "SELECT id, doc_type FROM documents WHERE id = ? AND project_id = ?",
                (document_id, project_id),
            ).fetchone()
            if not document:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "document_not_found"})
                return
            if str(document["doc_type"] or "").strip().lower() == "invoice":
                handler.send_json(HTTPStatus.CONFLICT, {"error": "invoice_is_not_actual_cost_evidence"})
                return
        mapping, issue = resolve_actual_cost_mapping(con, project_id, payload)
        if issue:
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        amounts, issue = amounts_from_actual_cost_payload(payload)
        if issue:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": issue})
            return
        source_event_key = (
            f"document:{document_id}:{source_line_key}"
            if document_id is not None
            else f"{source_type}:{source_line_key}"
        )
        source = {
            "cost_category": cost_category,
            "source_type": source_type,
            "source_event_key": source_event_key,
            "document_id": document_id,
            "title": title,
            "unit": str(payload.get("unit", "")).strip() or None,
            "valuation_method": valuation_method,
            "source_reference": str(
                payload_value(payload, "sourceReference", "source_reference", source_event_key)
            ).strip() or source_event_key,
            "reason": reason,
        }
        try:
            entry_id = insert_actual_cost_draft(
                con,
                project_id=project_id,
                mapping=mapping,
                source=source,
                amounts=amounts,
                payload=payload,
                user_id=int(user["id"]),
            )
            con.commit()
        except ValueError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
        except sqlite3.IntegrityError as exc:
            if "UNIQUE constraint failed" in str(exc):
                duplicate_source_response(handler, con, project_id, source_type, source_event_key)
                return
            raise
    handler.send_json(HTTPStatus.CREATED, {"id": entry_id, "status": "draft"})


def actual_cost_approval_issue(con: sqlite3.Connection, entry: sqlite3.Row) -> str | None:
    if not str(entry["recognition_date"] or "").strip():
        return "actual_cost_recognition_date_required"
    baseline = con.execute(
        """
        SELECT id, status FROM project_financial_baselines
        WHERE id = ? AND project_id = ? AND status IN ('approved','superseded')
        """,
        (entry["baseline_id"], entry["project_id"]),
    ).fetchone()
    superseded_allowed = (
        baseline
        and baseline["status"] == "superseded"
        and (
            entry["commitment_line_id"] is not None
            or entry["entry_kind"] in {"return", "reversal"}
        )
    )
    if not baseline or (baseline["status"] != "approved" and not superseded_allowed):
        return "approved_financial_baseline_required"
    if superseded_allowed:
        current = con.execute(
            """
            SELECT id FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (entry["project_id"],),
        ).fetchone()
        if not current or int(entry["budget_line_id"]) not in resolved_budget_line_map(
            con, int(entry["project_id"]), int(current["id"])
        ):
            return "actual_cost_budget_successor_mapping_required"
    budget = con.execute(
        """
        SELECT id FROM project_budget_lines
        WHERE id = ? AND baseline_id = ? AND line_type = 'direct_cost'
        """,
        (entry["budget_line_id"], entry["baseline_id"]),
    ).fetchone()
    if not budget:
        return "actual_cost_budget_mapping_required"
    if entry["entry_kind"] == "cost":
        unit_issue = operational_unit_issue(
            con, int(entry["budget_line_id"]), entry["unit"]
        )
        if unit_issue:
            return unit_issue
    if entry["commitment_line_id"] is not None:
        commitment = con.execute(
            """
            SELECT commitment.id, commitment.status
            FROM project_commitment_lines line
            JOIN project_commitments commitment ON commitment.id = line.commitment_id
            WHERE line.id = ? AND commitment.id = ? AND commitment.project_id = ?
              AND line.budget_line_id = ?
            """,
            (
                entry["commitment_line_id"],
                entry["commitment_id"],
                entry["project_id"],
                entry["budget_line_id"],
            ),
        ).fetchone()
        allowed_commitment_status = bool(
            commitment
            and (
                commitment["status"] == "approved"
                or (
                    entry["entry_kind"] in {"return", "reversal"}
                    and commitment["status"] == "cancelled"
                )
            )
        )
        if not allowed_commitment_status:
            return "approved_project_commitment_required"
    source_type = str(entry["source_type"])
    if source_type == "material_receipt":
        move = con.execute(
            """
            SELECT id FROM stock_moves
            WHERE id = ? AND project_id = ? AND move_type IN ('purchase','receipt') AND price > 0
            """,
            (entry["stock_move_id"], entry["project_id"]),
        ).fetchone()
        if not move:
            return "accepted_priced_material_receipt_required"
    elif source_type == "warehouse_issue":
        if entry["warehouse_transfer_id"] is None or entry["valuation_method"] not in {
            "lot",
            "moving_weighted_average",
        }:
            return "valued_warehouse_issue_required"
    elif source_type in DOCUMENT_ACTUAL_COST_SOURCES:
        document = con.execute(
            """
            SELECT id FROM documents
            WHERE id = ? AND project_id = ? AND lower(doc_type) <> 'invoice'
              AND lower(status) IN ('reviewed','approved','signed','ready','accepted')
            """,
            (entry["document_id"], entry["project_id"]),
        ).fetchone()
        if not document:
            return "accepted_non_invoice_document_required"
    elif source_type in {"labor_timesheet", "equipment_log"}:
        if entry["valuation_method"] != "approved_rate":
            return "approved_resource_rate_required"
    elif source_type in {"return", "reversal"}:
        original = con.execute(
            """
            SELECT original.net_amount_kopecks,
                   COALESCE(SUM(CASE WHEN correction.status = 'approved'
                                     THEN correction.net_amount_kopecks ELSE 0 END), 0) AS corrected
            FROM project_actual_cost_entries original
            LEFT JOIN project_actual_cost_entries correction
              ON correction.reverses_entry_id = original.id AND correction.id <> ?
            WHERE original.id = ? AND original.project_id = ?
              AND original.status = 'approved' AND original.entry_kind = 'cost'
            GROUP BY original.net_amount_kopecks
            """,
            (entry["id"], entry["reverses_entry_id"], entry["project_id"]),
        ).fetchone()
        if not original:
            return "actual_cost_reversal_target_invalid"
        if int(entry["net_amount_kopecks"]) > int(original["net_amount_kopecks"]) - int(original["corrected"]):
            return "actual_cost_reversal_exceeds_original"
    return None


def serialize_actual_cost_entry(
    row: sqlite3.Row,
    events: list[sqlite3.Row],
    settled_by_actual: dict[int, dict[str, int]] | None = None,
) -> dict:
    sign = 1 if row["entry_kind"] == "cost" else -1
    settled_by_actual = settled_by_actual or {}
    settled = settled_by_actual.get(
        int(row["id"]),
        {"net": 0, "vat": 0, "gross": 0},
    )
    event_payload = []
    for event in events:
        try:
            details = json.loads(event["details"] or "{}")
        except (TypeError, ValueError):
            details = {}
        event_payload.append(
            {
                "id": int(event["id"]),
                "action": str(event["action"]),
                "actorId": int(event["actor_id"]),
                "actorName": str(event["actor_name"] or ""),
                "details": details,
                "createdAt": int(event["created_at"]),
            }
        )
    return {
        "id": int(row["id"]),
        "projectId": int(row["project_id"]),
        "baselineId": int(row["baseline_id"]),
        "budgetLineId": int(row["budget_line_id"]),
        "commitmentId": row["commitment_id"],
        "commitmentLineId": row["commitment_line_id"],
        "estimateItemId": row["estimate_item_id"],
        "costCategory": str(row["cost_category"]),
        "entryKind": str(row["entry_kind"]),
        "sourceType": str(row["source_type"]),
        "sourceEventKey": str(row["source_event_key"]),
        "stockMoveId": row["stock_move_id"],
        "warehouseTransferId": row["warehouse_transfer_id"],
        "documentId": row["document_id"],
        "reversesEntryId": row["reverses_entry_id"],
        "title": str(row["title"]),
        "recognitionDate": row["recognition_date"],
        "unit": row["unit"],
        "quantity": float(row["quantity"]),
        "sourceUnitPriceKopecks": int(row["source_unit_price_kopecks"]),
        "unitCostNetKopecks": int(row["unit_cost_net_kopecks"]),
        "netAmountKopecks": int(row["net_amount_kopecks"]),
        "vatRateBasisPoints": int(row["vat_rate_basis_points"]),
        "vatAmountKopecks": int(row["vat_amount_kopecks"]),
        "grossAmountKopecks": int(row["gross_amount_kopecks"]),
        "signedNetAmountKopecks": sign * int(row["net_amount_kopecks"]),
        "signedVatAmountKopecks": sign * int(row["vat_amount_kopecks"]),
        "signedGrossAmountKopecks": sign * int(row["gross_amount_kopecks"]),
        "allocatedPaymentNetKopecks": int(settled["net"]),
        "allocatedPaymentVatKopecks": int(settled["vat"]),
        "allocatedPaymentGrossKopecks": int(settled["gross"]),
        "unpaidGrossKopecks": max(int(row["gross_amount_kopecks"]) - int(settled["gross"]), 0)
        if row["entry_kind"] == "cost" else 0,
        "sourceVatMode": str(row["source_vat_mode"]),
        "valuationMethod": str(row["valuation_method"]),
        "sourceReference": str(row["source_reference"]),
        "reason": str(row["reason"]),
        "status": str(row["status"]),
        "createdBy": int(row["created_by"]),
        "createdByName": str(row["created_by_name"] or ""),
        "submittedBy": row["submitted_by"],
        "submittedAt": row["submitted_at"],
        "approvedBy": row["approved_by"],
        "approvedAt": row["approved_at"],
        "createdAt": int(row["created_at"]),
        "updatedAt": int(row["updated_at"]),
        "events": event_payload,
    }


def api_project_actual_costs(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=False)
    if not user:
        return
    with db() as con:
        rows = con.execute(
            """
            SELECT entry.*, creator.name AS created_by_name
            FROM project_actual_cost_entries entry
            LEFT JOIN users creator ON creator.id = entry.created_by
            WHERE entry.project_id = ?
            ORDER BY COALESCE(entry.recognition_date, '9999-12-31') DESC, entry.id DESC
            """,
            (project_id,),
        ).fetchall()
        event_rows = con.execute(
            """
            SELECT event.*, actor.name AS actor_name
            FROM project_actual_cost_events event
            LEFT JOIN users actor ON actor.id = event.actor_id
            WHERE event.project_id = ?
            ORDER BY event.created_at, event.id
            """,
            (project_id,),
        ).fetchall()
        settlement_rows = con.execute(
            """
            SELECT allocation.target_actual_cost_entry_id AS actual_cost_entry_id,
                   COALESCE(SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                     THEN allocation.net_amount_kopecks
                                     ELSE -allocation.net_amount_kopecks END), 0) AS net_amount,
                   COALESCE(SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                     THEN allocation.vat_amount_kopecks
                                     ELSE -allocation.vat_amount_kopecks END), 0) AS vat_amount,
                   COALESCE(SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                     THEN allocation.gross_amount_kopecks
                                     ELSE -allocation.gross_amount_kopecks END), 0) AS gross_amount
            FROM project_payment_allocations allocation
            WHERE allocation.project_id = ? AND allocation.status = 'approved'
              AND allocation.allocation_purpose = 'supplier_payment'
              AND allocation.target_actual_cost_entry_id IS NOT NULL
            GROUP BY allocation.target_actual_cost_entry_id
            """,
            (project_id,),
        ).fetchall()
    events_by_entry: dict[int, list[sqlite3.Row]] = {}
    for event in event_rows:
        events_by_entry.setdefault(int(event["actual_cost_entry_id"]), []).append(event)
    settled_by_actual = {
        int(row["actual_cost_entry_id"]): {
            "net": int(row["net_amount"]),
            "vat": int(row["vat_amount"]),
            "gross": int(row["gross_amount"]),
        }
        for row in settlement_rows
    }
    items = [
        serialize_actual_cost_entry(
            row,
            events_by_entry.get(int(row["id"]), []),
            settled_by_actual,
        )
        for row in rows
    ]
    approved = [item for item in items if item["status"] == "approved"]
    by_category: dict[str, int] = {}
    for item in approved:
        category = item["costCategory"]
        by_category[category] = by_category.get(category, 0) + item["signedNetAmountKopecks"]
    handler.send_json(
        HTTPStatus.OK,
        {
            "items": items,
            "summary": {
                "approvedCount": len(approved),
                "approvedNetKopecks": sum(item["signedNetAmountKopecks"] for item in approved),
                "approvedVatKopecks": sum(item["signedVatAmountKopecks"] for item in approved),
                "approvedGrossKopecks": sum(item["signedGrossAmountKopecks"] for item in approved),
                "allocatedPaymentGrossKopecks": sum(
                    item["allocatedPaymentGrossKopecks"] for item in approved
                    if item["entryKind"] == "cost"
                ),
                "approvedNetByCategoryKopecks": by_category,
            },
        },
    )


def load_actual_cost_for_action(
    handler,
    path: str,
) -> tuple[sqlite3.Connection, sqlite3.Row, dict] | None:
    entry_id = parse_path_int(path, 2)
    if not entry_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_actual_cost_id"})
        return None
    con = db()
    entry = con.execute(
        "SELECT * FROM project_actual_cost_entries WHERE id = ?",
        (entry_id,),
    ).fetchone()
    if not entry:
        con.close()
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "actual_cost_not_found"})
        return None
    user = require_economics_access(handler, int(entry["project_id"]), manage=True)
    if not user:
        con.close()
        return None
    return con, entry, user


def api_update_actual_cost(handler, path: str) -> None:
    loaded = load_actual_cost_for_action(handler, path)
    if not loaded:
        return
    con, entry, user = loaded
    try:
        payload = handler.read_json()
        con.execute("BEGIN IMMEDIATE")
        entry = con.execute(
            "SELECT * FROM project_actual_cost_entries WHERE id = ?",
            (entry["id"],),
        ).fetchone()
        if not entry or entry["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "actual_cost_not_editable"})
            return
        mapping_payload = dict(payload)
        mapping_payload.setdefault("baselineId", entry["baseline_id"])
        mapping_payload.setdefault("budgetLineId", entry["budget_line_id"])
        mapping_payload.setdefault("estimateItemId", entry["estimate_item_id"])
        mapping_payload.setdefault("commitmentLineId", entry["commitment_line_id"])
        mapping, issue = resolve_actual_cost_mapping(
            con,
            int(entry["project_id"]),
            mapping_payload,
            default_estimate_item_id=entry["estimate_item_id"],
        )
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        amount_payload = dict(payload)
        amount_payload.setdefault("unitPrice", Decimal(int(entry["source_unit_price_kopecks"])) / 100)
        amount_payload.setdefault("quantity", entry["quantity"])
        amount_payload.setdefault("vatMode", entry["source_vat_mode"])
        amount_payload.setdefault("vatRateBasisPoints", entry["vat_rate_basis_points"])
        amounts, issue = amounts_from_actual_cost_payload(amount_payload)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": issue})
            return
        recognition_date = normalized_recognition_date(
            payload_value(payload, "recognitionDate", "recognition_date", entry["recognition_date"])
        )
        title = str(payload.get("title", entry["title"])).strip()
        reason = str(payload.get("reason", entry["reason"])).strip()
        cost_category = str(
            payload_value(payload, "costCategory", "cost_category", entry["cost_category"])
        ).strip()
        if not title or not reason or cost_category not in ACTUAL_COST_CATEGORIES:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_actual_cost_fields"})
            return
        unit = str(payload.get("unit", entry["unit"] or "")).strip() or None
        if entry["entry_kind"] == "cost":
            if not normalized_operational_unit(unit):
                budget_unit = con.execute(
                    "SELECT unit FROM project_budget_lines WHERE id = ?",
                    (int(mapping["budget_line_id"]),),
                ).fetchone()
                if budget_unit:
                    unit = str(budget_unit["unit"] or "").strip() or None
            unit_issue = operational_unit_issue(
                con, int(mapping["budget_line_id"]), unit
            )
            if unit_issue:
                con.rollback()
                handler.send_json(HTTPStatus.CONFLICT, {"error": unit_issue})
                return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_actual_cost_entries
            SET baseline_id = ?, budget_line_id = ?, commitment_id = ?, commitment_line_id = ?,
                estimate_item_id = ?, cost_category = ?, title = ?, recognition_date = ?,
                unit = ?, quantity = ?, source_unit_price_kopecks = ?, unit_cost_net_kopecks = ?,
                net_amount_kopecks = ?, vat_rate_basis_points = ?, vat_amount_kopecks = ?,
                gross_amount_kopecks = ?, source_vat_mode = ?, reason = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (
                mapping["baseline_id"], mapping["budget_line_id"], mapping["commitment_id"],
                mapping["commitment_line_id"], mapping["estimate_item_id"], cost_category,
                title, recognition_date, unit,
                amounts["quantity"], amounts["source_unit_price_kopecks"],
                amounts["unit_cost_net_kopecks"], amounts["net_amount_kopecks"],
                int(payload_value(amount_payload, "vatRateBasisPoints", "vat_rate_basis_points", 0) or 0),
                amounts["vat_amount_kopecks"], amounts["gross_amount_kopecks"],
                str(payload_value(amount_payload, "vatMode", "vat_mode", "")), reason,
                timestamp, entry["id"],
            ),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "actual_cost_not_editable"})
            return
        create_actual_cost_event(
            con, int(entry["id"]), int(entry["project_id"]), "updated", int(user["id"])
        )
        create_audit(
            con, int(user["id"]), "update_project_actual_cost_draft", int(entry["id"]),
            {"project_id": entry["project_id"]}, entity="project_actual_cost",
        )
        con.commit()
    except ValueError as exc:
        con.rollback()
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        return
    except sqlite3.IntegrityError as exc:
        con.rollback()
        handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        return
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(entry["id"]), "status": "draft"})


def api_submit_actual_cost(handler, path: str) -> None:
    loaded = load_actual_cost_for_action(handler, path)
    if not loaded:
        return
    con, entry, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        entry = con.execute(
            "SELECT * FROM project_actual_cost_entries WHERE id = ?",
            (entry["id"],),
        ).fetchone()
        if not entry or entry["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "actual_cost_not_draft"})
            return
        issue = actual_cost_approval_issue(con, entry)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_actual_cost_entries
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (user["id"], timestamp, timestamp, entry["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "actual_cost_not_draft"})
            return
        create_actual_cost_event(
            con, int(entry["id"]), int(entry["project_id"]), "submitted", int(user["id"])
        )
        create_audit(
            con, int(user["id"]), "submit_project_actual_cost", int(entry["id"]),
            {"project_id": entry["project_id"]}, entity="project_actual_cost",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(entry["id"]), "status": "pending_approval"})


def api_approve_actual_cost(handler, path: str) -> None:
    loaded = load_actual_cost_for_action(handler, path)
    if not loaded:
        return
    con, entry, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        entry = con.execute(
            "SELECT * FROM project_actual_cost_entries WHERE id = ?",
            (entry["id"],),
        ).fetchone()
        if not entry or entry["status"] != "pending_approval":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "actual_cost_not_pending"})
            return
        issue = actual_cost_approval_issue(con, entry)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_actual_cost_entries
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ? AND status = 'pending_approval'
            """,
            (user["id"], timestamp, timestamp, entry["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "actual_cost_not_pending"})
            return
        create_actual_cost_event(
            con, int(entry["id"]), int(entry["project_id"]), "approved", int(user["id"])
        )
        create_audit(
            con, int(user["id"]), "approve_project_actual_cost", int(entry["id"]),
            {"project_id": entry["project_id"]}, entity="project_actual_cost",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(entry["id"]), "status": "approved"})


def api_reverse_actual_cost(handler, path: str) -> None:
    loaded = load_actual_cost_for_action(handler, path)
    if not loaded:
        return
    con, original, user = loaded
    try:
        if original["status"] != "approved" or original["entry_kind"] != "cost":
            handler.send_json(HTTPStatus.CONFLICT, {"error": "approved_actual_cost_required"})
            return
        payload = handler.read_json()
        reason = str(payload.get("reason", "")).strip()
        try:
            recognition_date = normalized_recognition_date(
                payload_value(payload, "recognitionDate", "recognition_date")
            )
        except ValueError as exc:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        if not reason or not recognition_date:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_and_recognition_date_required"})
            return
        prior = con.execute(
            """
            SELECT COALESCE(SUM(net_amount_kopecks), 0) AS net,
                   COALESCE(SUM(vat_amount_kopecks), 0) AS vat,
                   COALESCE(SUM(gross_amount_kopecks), 0) AS gross
            FROM project_actual_cost_entries
            WHERE reverses_entry_id = ? AND status = 'approved'
            """,
            (original["id"],),
        ).fetchone()
        remaining_net = int(original["net_amount_kopecks"]) - int(prior["net"])
        remaining_vat = int(original["vat_amount_kopecks"]) - int(prior["vat"])
        remaining_gross = int(original["gross_amount_kopecks"]) - int(prior["gross"])
        if remaining_net <= 0 or remaining_gross <= 0:
            handler.send_json(HTTPStatus.CONFLICT, {"error": "actual_cost_already_reversed"})
            return
        mapping = {
            "baseline_id": int(original["baseline_id"]),
            "budget_line_id": int(original["budget_line_id"]),
            "commitment_id": original["commitment_id"],
            "commitment_line_id": original["commitment_line_id"],
            "estimate_item_id": original["estimate_item_id"],
        }
        reversal_payload = {
            "recognitionDate": recognition_date,
            "vatMode": original["source_vat_mode"],
            "vatRateBasisPoints": original["vat_rate_basis_points"],
        }
        original_net = Decimal(int(original["net_amount_kopecks"]))
        remaining_quantity = (
            decimal_value(original["quantity"]) * Decimal(remaining_net) / original_net
        )
        amounts = {
            "quantity": float(remaining_quantity),
            "source_unit_price_kopecks": int(original["source_unit_price_kopecks"]),
            "unit_cost_net_kopecks": int(original["unit_cost_net_kopecks"]),
            "net_amount_kopecks": remaining_net,
            "vat_amount_kopecks": remaining_vat,
            "gross_amount_kopecks": remaining_gross,
        }
        source_event_key = f"reversal:{int(original['id'])}"
        source = {
            "cost_category": str(original["cost_category"]),
            "entry_kind": "reversal",
            "source_type": "reversal",
            "source_event_key": source_event_key,
            "reverses_entry_id": int(original["id"]),
            "title": f"Reversal: {original['title']}",
            "unit": str(original["unit"]),
            "valuation_method": "original_snapshot",
            "source_reference": f"project_actual_cost:{int(original['id'])}",
            "reason": reason,
        }
        try:
            entry_id = insert_actual_cost_draft(
                con,
                project_id=int(original["project_id"]),
                mapping=mapping,
                source=source,
                amounts=amounts,
                payload=reversal_payload,
                user_id=int(user["id"]),
            )
        except ValueError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
        except sqlite3.IntegrityError as exc:
            if "UNIQUE constraint failed" in str(exc):
                duplicate_source_response(
                    handler, con, int(original["project_id"]), "reversal", source_event_key
                )
                return
            raise
        create_actual_cost_event(
            con,
            int(original["id"]),
            int(original["project_id"]),
            "reversal_created",
            int(user["id"]),
            {"reversalEntryId": entry_id, "reason": reason},
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.CREATED, {"id": entry_id, "status": "draft"})


PAYMENT_ALLOCATION_TARGETS = {"revenue_line", "commitment", "actual_cost"}


def finance_entry_amounts(payment: sqlite3.Row) -> dict[str, int | float | str]:
    gross_value = decimal_value(payment["amount"])
    if gross_value <= 0:
        raise ValueError("finance_payment_amount_must_be_positive")
    payment_kind = str(payment["payment_kind"] or "cash")
    vat_percent = decimal_value(payment["vat_percent"] or 0)
    if vat_percent < 0 or vat_percent > 100:
        raise ValueError("bad_finance_payment_vat")
    vat_rate_basis_points = int(
        (vat_percent * Decimal(100)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )
    vat_mode = "gross" if payment_kind == "bank_vat" and vat_rate_basis_points > 0 else "no_vat"
    if vat_mode == "no_vat":
        vat_rate_basis_points = 0
    amounts = normalize_offer_amounts(
        gross_value,
        1,
        vat_mode,
        vat_rate_basis_points,
    )
    amounts["vat_rate_basis_points"] = vat_rate_basis_points
    amounts["source_vat_mode"] = vat_mode
    return amounts


def finance_entry_is_paid_and_dated(payment: sqlite3.Row) -> bool:
    if payment["status"] != "paid":
        return False
    paid_date = str(payment["paid_date"] or "").strip()
    if not paid_date:
        return False
    try:
        date.fromisoformat(paid_date)
    except ValueError:
        return False
    return True


def create_payment_allocation_event(
    con: sqlite3.Connection,
    allocation_id: int,
    project_id: int,
    action: str,
    actor_id: int,
    details: dict | None = None,
) -> None:
    con.execute(
        """
        INSERT INTO project_payment_allocation_events (
            payment_allocation_id, project_id, action, actor_id, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            allocation_id,
            project_id,
            action,
            actor_id,
            json.dumps(details or {}, ensure_ascii=False),
            now_ts(),
        ),
    )


def resolve_payment_allocation_target(
    con: sqlite3.Connection,
    project_id: int,
    direction: str,
    target_type: str,
    target_id: int,
) -> tuple[dict, None] | tuple[None, str]:
    if target_type not in PAYMENT_ALLOCATION_TARGETS:
        return None, "bad_payment_allocation_target_type"
    if direction == "income" and target_type != "revenue_line":
        return None, "income_payment_requires_revenue_line"
    if direction == "expense" and target_type not in {"commitment", "actual_cost"}:
        return None, "expense_payment_requires_cost_target"

    if target_type == "revenue_line":
        row = con.execute(
            """
            SELECT line.id, line.title, line.gross_amount_kopecks
            FROM project_revenue_lines line
            JOIN project_financial_baselines baseline ON baseline.id = line.baseline_id
            WHERE line.id = ? AND baseline.project_id = ? AND baseline.status = 'approved'
            """,
            (target_id, project_id),
        ).fetchone()
        id_fields = {
            "target_revenue_line_id": target_id,
            "target_commitment_id": None,
            "target_actual_cost_entry_id": None,
        }
        purpose = "customer_receipt"
    elif target_type == "commitment":
        row = con.execute(
            """
            SELECT commitment.id,
                   COALESCE(NULLIF(commitment.commitment_no, ''), commitment.counterparty_name) AS title,
                   COALESCE(SUM(line.gross_amount_kopecks), 0) AS gross_amount_kopecks
            FROM project_commitments commitment
            JOIN project_commitment_lines line ON line.commitment_id = commitment.id
            WHERE commitment.id = ? AND commitment.project_id = ?
              AND commitment.status = 'approved'
            GROUP BY commitment.id
            """,
            (target_id, project_id),
        ).fetchone()
        id_fields = {
            "target_revenue_line_id": None,
            "target_commitment_id": target_id,
            "target_actual_cost_entry_id": None,
        }
        purpose = "supplier_payment"
    else:
        row = con.execute(
            """
            SELECT actual.id, actual.title, actual.gross_amount_kopecks
            FROM project_actual_cost_entries actual
            WHERE actual.id = ? AND actual.project_id = ?
              AND actual.status = 'approved' AND actual.entry_kind = 'cost'
            """,
            (target_id, project_id),
        ).fetchone()
        id_fields = {
            "target_revenue_line_id": None,
            "target_commitment_id": None,
            "target_actual_cost_entry_id": target_id,
        }
        purpose = "supplier_payment"
    if not row:
        return None, f"approved_project_{target_type}_required"
    return {
        "target_type": target_type,
        "target_id": target_id,
        "target_title": str(row["title"] or ""),
        "target_gross_kopecks": int(row["gross_amount_kopecks"]),
        "allocation_purpose": purpose,
        **id_fields,
    }, None


def approved_allocated_gross_for_payment(con: sqlite3.Connection, finance_entry_id: int) -> int:
    row = con.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN entry_kind = 'allocation'
                                 THEN gross_amount_kopecks ELSE -gross_amount_kopecks END), 0)
        FROM project_payment_allocations
        WHERE finance_entry_id = ? AND status = 'approved'
        """,
        (finance_entry_id,),
    ).fetchone()
    return int(row[0] or 0)


def approved_allocated_gross_for_target(
    con: sqlite3.Connection,
    target_type: str,
    target_id: int,
) -> int:
    target_ids = [target_id]
    if target_type == "revenue_line":
        target = con.execute(
            """
            SELECT baseline.project_id, baseline.id AS baseline_id
            FROM project_revenue_lines line
            JOIN project_financial_baselines baseline ON baseline.id = line.baseline_id
            WHERE line.id = ?
            """,
            (target_id,),
        ).fetchone()
        if target:
            resolution = resolved_revenue_line_map(
                con, int(target["project_id"]), int(target["baseline_id"])
            )
            target_ids = sorted(
                source_id
                for source_id, resolved_id in resolution.items()
                if resolved_id == target_id
            ) or [target_id]
    column = {
        "revenue_line": "target_revenue_line_id",
        "commitment": "target_commitment_id",
        "actual_cost": "target_actual_cost_entry_id",
    }[target_type]
    placeholders = ",".join("?" for _ in target_ids)
    row = con.execute(
        f"""
        SELECT COALESCE(SUM(CASE WHEN entry_kind = 'allocation'
                                 THEN gross_amount_kopecks ELSE -gross_amount_kopecks END), 0)
        FROM project_payment_allocations
        WHERE {column} IN ({placeholders}) AND status = 'approved'
        """,
        target_ids,
    ).fetchone()
    return int(row[0] or 0)


def insert_payment_allocation_draft(
    con: sqlite3.Connection,
    *,
    project_id: int,
    payment: sqlite3.Row,
    payment_amounts: dict,
    target: dict,
    allocation_amounts: dict,
    allocation_key: str,
    reason: str,
    user_id: int,
    entry_kind: str = "allocation",
    reverses_allocation_id: int | None = None,
) -> int:
    timestamp = now_ts()
    cursor = con.execute(
        """
        INSERT INTO project_payment_allocations (
            project_id, finance_entry_id, allocation_key, direction, allocation_purpose,
            target_type, target_revenue_line_id, target_commitment_id,
            target_actual_cost_entry_id, entry_kind, reverses_allocation_id,
            source_payment_gross_kopecks, net_amount_kopecks, vat_rate_basis_points,
            vat_amount_kopecks, gross_amount_kopecks, source_vat_mode, reason,
            status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  'draft', ?, ?, ?)
        """,
        (
            project_id,
            payment["id"],
            allocation_key,
            payment["direction"],
            target["allocation_purpose"],
            target["target_type"],
            target["target_revenue_line_id"],
            target["target_commitment_id"],
            target["target_actual_cost_entry_id"],
            entry_kind,
            reverses_allocation_id,
            payment_amounts["gross_amount_kopecks"],
            allocation_amounts["net_amount_kopecks"],
            payment_amounts["vat_rate_basis_points"],
            allocation_amounts["vat_amount_kopecks"],
            allocation_amounts["gross_amount_kopecks"],
            payment_amounts["source_vat_mode"],
            reason,
            user_id,
            timestamp,
            timestamp,
        ),
    )
    allocation_id = int(cursor.lastrowid)
    create_payment_allocation_event(
        con,
        allocation_id,
        project_id,
        "created",
        user_id,
        {
            "financeEntryId": int(payment["id"]),
            "targetType": target["target_type"],
            "targetId": target["target_id"],
            "entryKind": entry_kind,
        },
    )
    create_audit(
        con,
        user_id,
        "create_project_payment_allocation_draft",
        allocation_id,
        {"project_id": project_id, "finance_entry_id": int(payment["id"])},
        entity="project_payment_allocation",
    )
    return allocation_id


def allocation_amounts_from_gross(payment_amounts: dict, gross_value: object) -> dict:
    return normalize_offer_amounts(
        gross_value,
        1,
        str(payment_amounts["source_vat_mode"]),
        int(payment_amounts["vat_rate_basis_points"]),
    )


def api_create_payment_allocation(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    try:
        finance_entry_id = int(payload_value(payload, "financeEntryId", "finance_entry_id"))
        target_id = int(payload_value(payload, "targetId", "target_id"))
        if finance_entry_id <= 0 or target_id <= 0:
            raise ValueError
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_payment_or_target_id"})
        return
    target_type = str(payload_value(payload, "targetType", "target_type", "")).strip()
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
        return

    with db() as con:
        payment = con.execute(
            "SELECT * FROM finance_entries WHERE id = ? AND project_id = ?",
            (finance_entry_id, project_id),
        ).fetchone()
        if not payment:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "finance_entry_not_found"})
            return
        if not finance_entry_is_paid_and_dated(payment):
            handler.send_json(HTTPStatus.CONFLICT, {"error": "paid_dated_finance_entry_required"})
            return
        try:
            payment_amounts = finance_entry_amounts(payment)
        except ValueError as exc:
            handler.send_json(HTTPStatus.CONFLICT, {"error": str(exc)})
            return
        allocation_key = str(
            payload_value(payload, "allocationKey", "allocation_key", f"{target_type}:{target_id}")
        ).strip()
        if not allocation_key:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "allocation_key_required"})
            return
        existing = con.execute(
            """
            SELECT id FROM project_payment_allocations
            WHERE finance_entry_id = ? AND allocation_key = ?
            """,
            (finance_entry_id, allocation_key),
        ).fetchone()
        if existing:
            handler.send_json(
                HTTPStatus.CONFLICT,
                {
                    "error": "payment_allocation_already_exists",
                    "paymentAllocationId": int(existing["id"]),
                },
            )
            return
        target, issue = resolve_payment_allocation_target(
            con,
            project_id,
            str(payment["direction"]),
            target_type,
            target_id,
        )
        if issue:
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        allocated_gross = approved_allocated_gross_for_payment(con, finance_entry_id)
        remaining_gross = int(payment_amounts["gross_amount_kopecks"]) - allocated_gross
        requested_amount = payload.get("amount")
        if requested_amount in (None, ""):
            requested_amount = Decimal(remaining_gross) / Decimal(100)
        try:
            allocation_amounts = allocation_amounts_from_gross(payment_amounts, requested_amount)
        except ValueError as exc:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        if int(allocation_amounts["gross_amount_kopecks"]) > remaining_gross:
            handler.send_json(
                HTTPStatus.CONFLICT,
                {"error": "payment_allocation_exceeds_payment", "remainingGrossKopecks": remaining_gross},
            )
            return
        target_remaining = int(target["target_gross_kopecks"]) - approved_allocated_gross_for_target(
            con, target_type, target_id
        )
        if int(allocation_amounts["gross_amount_kopecks"]) > target_remaining:
            handler.send_json(
                HTTPStatus.CONFLICT,
                {"error": f"payment_allocation_exceeds_{target_type}", "remainingGrossKopecks": target_remaining},
            )
            return
        try:
            allocation_id = insert_payment_allocation_draft(
                con,
                project_id=project_id,
                payment=payment,
                payment_amounts=payment_amounts,
                target=target,
                allocation_amounts=allocation_amounts,
                allocation_key=allocation_key,
                reason=reason,
                user_id=int(user["id"]),
            )
            con.commit()
        except sqlite3.IntegrityError as exc:
            if "UNIQUE constraint failed" in str(exc):
                existing = con.execute(
                    """
                    SELECT id FROM project_payment_allocations
                    WHERE finance_entry_id = ? AND allocation_key = ?
                    """,
                    (finance_entry_id, allocation_key),
                ).fetchone()
                response = {"error": "payment_allocation_already_exists"}
                if existing:
                    response["paymentAllocationId"] = int(existing["id"])
                handler.send_json(HTTPStatus.CONFLICT, response)
                return
            raise
    handler.send_json(HTTPStatus.CREATED, {"id": allocation_id, "status": "draft"})


def payment_allocation_approval_issue(
    con: sqlite3.Connection,
    allocation: sqlite3.Row,
) -> str | None:
    payment = con.execute(
        "SELECT * FROM finance_entries WHERE id = ? AND project_id = ?",
        (allocation["finance_entry_id"], allocation["project_id"]),
    ).fetchone()
    if not payment or not finance_entry_is_paid_and_dated(payment):
        return "paid_dated_unchanged_finance_entry_required"
    try:
        payment_amounts = finance_entry_amounts(payment)
    except ValueError as exc:
        return str(exc)
    if int(payment_amounts["gross_amount_kopecks"]) != int(allocation["source_payment_gross_kopecks"]):
        return "paid_dated_unchanged_finance_entry_required"
    target_id = {
        "revenue_line": allocation["target_revenue_line_id"],
        "commitment": allocation["target_commitment_id"],
        "actual_cost": allocation["target_actual_cost_entry_id"],
    }[str(allocation["target_type"])]
    target = None
    if allocation["entry_kind"] == "allocation":
        target, issue = resolve_payment_allocation_target(
            con,
            int(allocation["project_id"]),
            str(allocation["direction"]),
            str(allocation["target_type"]),
            int(target_id),
        )
        if issue:
            return issue
    current_payment_total = approved_allocated_gross_for_payment(
        con, int(allocation["finance_entry_id"])
    )
    signed_amount = int(allocation["gross_amount_kopecks"])
    if allocation["entry_kind"] == "reversal":
        signed_amount = -signed_amount
        original = con.execute(
            """
            SELECT * FROM project_payment_allocations
            WHERE id = ? AND status = 'approved' AND entry_kind = 'allocation'
            """,
            (allocation["reverses_allocation_id"],),
        ).fetchone()
        if not original:
            return "payment_allocation_reversal_target_invalid"
        if any(
            int(original[column]) != int(allocation[column])
            for column in ("net_amount_kopecks", "vat_amount_kopecks", "gross_amount_kopecks")
        ):
            return "payment_allocation_reversal_must_match_original"
    new_payment_total = current_payment_total + signed_amount
    if new_payment_total < 0 or new_payment_total > int(payment_amounts["gross_amount_kopecks"]):
        return "payment_allocation_exceeds_payment"
    if allocation["entry_kind"] == "allocation":
        target_total = approved_allocated_gross_for_target(
            con, str(allocation["target_type"]), int(target_id)
        )
        if target_total + int(allocation["gross_amount_kopecks"]) > int(target["target_gross_kopecks"]):
            return f"payment_allocation_exceeds_{allocation['target_type']}"
    return None


def serialize_payment_allocation(row: sqlite3.Row, events: list[sqlite3.Row]) -> dict:
    sign = 1 if row["entry_kind"] == "allocation" else -1
    event_payload = []
    for event in events:
        try:
            details = json.loads(event["details"] or "{}")
        except (TypeError, ValueError):
            details = {}
        event_payload.append(
            {
                "id": int(event["id"]),
                "action": str(event["action"]),
                "actorId": int(event["actor_id"]),
                "actorName": str(event["actor_name"] or ""),
                "details": details,
                "createdAt": int(event["created_at"]),
            }
        )
    target_id = {
        "revenue_line": row["target_revenue_line_id"],
        "commitment": row["target_commitment_id"],
        "actual_cost": row["target_actual_cost_entry_id"],
    }[str(row["target_type"])]
    target_title = {
        "revenue_line": row["revenue_title"],
        "commitment": row["commitment_title"],
        "actual_cost": row["actual_cost_title"],
    }[str(row["target_type"])]
    return {
        "id": int(row["id"]),
        "projectId": int(row["project_id"]),
        "financeEntryId": int(row["finance_entry_id"]),
        "allocationKey": str(row["allocation_key"]),
        "direction": str(row["direction"]),
        "allocationPurpose": str(row["allocation_purpose"]),
        "targetType": str(row["target_type"]),
        "targetId": int(target_id),
        "targetTitle": str(target_title or ""),
        "actualCostCommitmentId": row["actual_cost_commitment_id"],
        "entryKind": str(row["entry_kind"]),
        "reversesAllocationId": row["reverses_allocation_id"],
        "sourcePaymentGrossKopecks": int(row["source_payment_gross_kopecks"]),
        "netAmountKopecks": int(row["net_amount_kopecks"]),
        "vatRateBasisPoints": int(row["vat_rate_basis_points"]),
        "vatAmountKopecks": int(row["vat_amount_kopecks"]),
        "grossAmountKopecks": int(row["gross_amount_kopecks"]),
        "signedNetAmountKopecks": sign * int(row["net_amount_kopecks"]),
        "signedVatAmountKopecks": sign * int(row["vat_amount_kopecks"]),
        "signedGrossAmountKopecks": sign * int(row["gross_amount_kopecks"]),
        "sourceVatMode": str(row["source_vat_mode"]),
        "reason": str(row["reason"]),
        "status": str(row["status"]),
        "createdBy": int(row["created_by"]),
        "createdByName": str(row["created_by_name"] or ""),
        "submittedBy": row["submitted_by"],
        "submittedAt": row["submitted_at"],
        "approvedBy": row["approved_by"],
        "approvedAt": row["approved_at"],
        "createdAt": int(row["created_at"]),
        "updatedAt": int(row["updated_at"]),
        "events": event_payload,
    }


def api_project_cash_flow(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=False)
    if not user:
        return
    with db() as con:
        payments = con.execute(
            """
            SELECT * FROM finance_entries
            WHERE project_id = ? ORDER BY COALESCE(paid_date, planned_date, '9999-12-31') DESC, id DESC
            """,
            (project_id,),
        ).fetchall()
        allocation_rows = con.execute(
            """
            SELECT allocation.*, creator.name AS created_by_name,
                   revenue.title AS revenue_title,
                   COALESCE(NULLIF(commitment.commitment_no, ''), commitment.counterparty_name) AS commitment_title,
                   actual.title AS actual_cost_title,
                   actual.commitment_id AS actual_cost_commitment_id
            FROM project_payment_allocations allocation
            LEFT JOIN users creator ON creator.id = allocation.created_by
            LEFT JOIN project_revenue_lines revenue ON revenue.id = allocation.target_revenue_line_id
            LEFT JOIN project_commitments commitment ON commitment.id = allocation.target_commitment_id
            LEFT JOIN project_actual_cost_entries actual ON actual.id = allocation.target_actual_cost_entry_id
            WHERE allocation.project_id = ?
            ORDER BY allocation.created_at DESC, allocation.id DESC
            """,
            (project_id,),
        ).fetchall()
        event_rows = con.execute(
            """
            SELECT event.*, actor.name AS actor_name
            FROM project_payment_allocation_events event
            LEFT JOIN users actor ON actor.id = event.actor_id
            WHERE event.project_id = ? ORDER BY event.created_at, event.id
            """,
            (project_id,),
        ).fetchall()
    events_by_allocation: dict[int, list[sqlite3.Row]] = {}
    for event in event_rows:
        events_by_allocation.setdefault(int(event["payment_allocation_id"]), []).append(event)
    allocations = [
        serialize_payment_allocation(
            row,
            events_by_allocation.get(int(row["id"]), []),
        )
        for row in allocation_rows
    ]
    approved_allocations = [item for item in allocations if item["status"] == "approved"]
    allocated_by_payment: dict[int, int] = {}
    for item in approved_allocations:
        payment_id = int(item["financeEntryId"])
        allocated_by_payment[payment_id] = (
            allocated_by_payment.get(payment_id, 0) + int(item["signedGrossAmountKopecks"])
        )

    payment_items = []
    received = {"net": 0, "vat": 0, "gross": 0}
    paid = {"net": 0, "vat": 0, "gross": 0}
    for payment in payments:
        is_cash = finance_entry_is_paid_and_dated(payment)
        try:
            amounts = finance_entry_amounts(payment)
            normalization_error = None
        except ValueError as exc:
            amounts = {
                "net_amount_kopecks": 0,
                "vat_amount_kopecks": 0,
                "gross_amount_kopecks": 0,
                "vat_rate_basis_points": 0,
                "source_vat_mode": "no_vat",
            }
            normalization_error = str(exc)
            is_cash = False
        if is_cash:
            accumulator = received if payment["direction"] == "income" else paid
            accumulator["net"] += int(amounts["net_amount_kopecks"])
            accumulator["vat"] += int(amounts["vat_amount_kopecks"])
            accumulator["gross"] += int(amounts["gross_amount_kopecks"])
        allocated_gross = allocated_by_payment.get(int(payment["id"]), 0)
        payment_items.append(
            {
                "id": int(payment["id"]),
                "direction": str(payment["direction"]),
                "category": payment["category"],
                "paymentKind": str(payment["payment_kind"]),
                "status": str(payment["status"]),
                "plannedDate": payment["planned_date"],
                "paidDate": payment["paid_date"],
                "counterpartyName": str(payment["counterparty_name"] or ""),
                "recognizedInCashFlow": is_cash,
                "netAmountKopecks": int(amounts["net_amount_kopecks"]),
                "vatRateBasisPoints": int(amounts["vat_rate_basis_points"]),
                "vatAmountKopecks": int(amounts["vat_amount_kopecks"]),
                "grossAmountKopecks": int(amounts["gross_amount_kopecks"]),
                "allocatedGrossKopecks": allocated_gross,
                "unallocatedGrossKopecks": max(
                    int(amounts["gross_amount_kopecks"]) - allocated_gross, 0
                ) if is_cash else 0,
                "normalizationError": normalization_error,
            }
        )

    received_allocated = sum(
        item["signedGrossAmountKopecks"]
        for item in approved_allocations if item["direction"] == "income"
    )
    paid_allocated = sum(
        item["signedGrossAmountKopecks"]
        for item in approved_allocations if item["direction"] == "expense"
    )
    handler.send_json(
        HTTPStatus.OK,
        {
            "payments": payment_items,
            "allocations": allocations,
            "summary": {
                "cashReceivedNetKopecks": received["net"],
                "cashReceivedVatKopecks": received["vat"],
                "cashReceivedGrossKopecks": received["gross"],
                "cashPaidNetKopecks": paid["net"],
                "cashPaidVatKopecks": paid["vat"],
                "cashPaidGrossKopecks": paid["gross"],
                "cashBalanceGrossKopecks": received["gross"] - paid["gross"],
                "allocatedReceivedGrossKopecks": received_allocated,
                "allocatedPaidGrossKopecks": paid_allocated,
                "unallocatedReceivedGrossKopecks": max(received["gross"] - received_allocated, 0),
                "unallocatedPaidGrossKopecks": max(paid["gross"] - paid_allocated, 0),
            },
        },
    )


def load_payment_allocation_for_action(
    handler,
    path: str,
) -> tuple[sqlite3.Connection, sqlite3.Row, dict] | None:
    allocation_id = parse_path_int(path, 2)
    if not allocation_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_payment_allocation_id"})
        return None
    con = db()
    allocation = con.execute(
        "SELECT * FROM project_payment_allocations WHERE id = ?",
        (allocation_id,),
    ).fetchone()
    if not allocation:
        con.close()
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "payment_allocation_not_found"})
        return None
    user = require_economics_access(handler, int(allocation["project_id"]), manage=True)
    if not user:
        con.close()
        return None
    return con, allocation, user


def api_update_payment_allocation(handler, path: str) -> None:
    loaded = load_payment_allocation_for_action(handler, path)
    if not loaded:
        return
    con, allocation, user = loaded
    try:
        payload = handler.read_json()
        con.execute("BEGIN IMMEDIATE")
        allocation = con.execute(
            "SELECT * FROM project_payment_allocations WHERE id = ?",
            (allocation["id"],),
        ).fetchone()
        if (
            not allocation
            or allocation["status"] != "draft"
            or allocation["entry_kind"] != "allocation"
        ):
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "payment_allocation_not_editable"})
            return
        payment = con.execute(
            "SELECT * FROM finance_entries WHERE id = ?",
            (allocation["finance_entry_id"],),
        ).fetchone()
        payment_amounts = finance_entry_amounts(payment)
        amount = payload.get(
            "amount",
            Decimal(int(allocation["gross_amount_kopecks"])) / Decimal(100),
        )
        try:
            amounts = allocation_amounts_from_gross(payment_amounts, amount)
        except ValueError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        reason = str(payload.get("reason", allocation["reason"])).strip()
        if not reason:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_payment_allocations
            SET net_amount_kopecks = ?, vat_amount_kopecks = ?, gross_amount_kopecks = ?,
                reason = ?, updated_at = ? WHERE id = ? AND status = 'draft'
            """,
            (
                amounts["net_amount_kopecks"],
                amounts["vat_amount_kopecks"],
                amounts["gross_amount_kopecks"],
                reason,
                timestamp,
                allocation["id"],
            ),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "payment_allocation_not_editable"})
            return
        create_payment_allocation_event(
            con, int(allocation["id"]), int(allocation["project_id"]),
            "updated", int(user["id"]),
        )
        create_audit(
            con, int(user["id"]), "update_project_payment_allocation_draft",
            int(allocation["id"]), {"project_id": allocation["project_id"]},
            entity="project_payment_allocation",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(allocation["id"]), "status": "draft"})


def api_submit_payment_allocation(handler, path: str) -> None:
    loaded = load_payment_allocation_for_action(handler, path)
    if not loaded:
        return
    con, allocation, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        allocation = con.execute(
            "SELECT * FROM project_payment_allocations WHERE id = ?",
            (allocation["id"],),
        ).fetchone()
        if not allocation or allocation["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "payment_allocation_not_draft"})
            return
        issue = payment_allocation_approval_issue(con, allocation)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_payment_allocations
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (user["id"], timestamp, timestamp, allocation["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(
                HTTPStatus.CONFLICT, {"error": "payment_allocation_not_draft"}
            )
            return
        create_payment_allocation_event(
            con, int(allocation["id"]), int(allocation["project_id"]),
            "submitted", int(user["id"]),
        )
        create_audit(
            con, int(user["id"]), "submit_project_payment_allocation",
            int(allocation["id"]), {"project_id": allocation["project_id"]},
            entity="project_payment_allocation",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(
        HTTPStatus.OK,
        {"id": int(allocation["id"]), "status": "pending_approval"},
    )


def api_approve_payment_allocation(handler, path: str) -> None:
    loaded = load_payment_allocation_for_action(handler, path)
    if not loaded:
        return
    con, allocation, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        allocation = con.execute(
            "SELECT * FROM project_payment_allocations WHERE id = ?",
            (allocation["id"],),
        ).fetchone()
        if allocation["status"] != "pending_approval":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "payment_allocation_not_pending"})
            return
        issue = payment_allocation_approval_issue(con, allocation)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_payment_allocations
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ? AND status = 'pending_approval'
            """,
            (user["id"], timestamp, timestamp, allocation["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(
                HTTPStatus.CONFLICT, {"error": "payment_allocation_not_pending"}
            )
            return
        create_payment_allocation_event(
            con, int(allocation["id"]), int(allocation["project_id"]),
            "approved", int(user["id"]),
        )
        create_audit(
            con, int(user["id"]), "approve_project_payment_allocation",
            int(allocation["id"]), {"project_id": allocation["project_id"]},
            entity="project_payment_allocation",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(allocation["id"]), "status": "approved"})


def api_reverse_payment_allocation(handler, path: str) -> None:
    loaded = load_payment_allocation_for_action(handler, path)
    if not loaded:
        return
    con, original, user = loaded
    try:
        if original["status"] != "approved" or original["entry_kind"] != "allocation":
            handler.send_json(HTTPStatus.CONFLICT, {"error": "approved_payment_allocation_required"})
            return
        payload = handler.read_json()
        reason = str(payload.get("reason", "")).strip()
        if not reason:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
            return
        payment = con.execute(
            "SELECT * FROM finance_entries WHERE id = ?",
            (original["finance_entry_id"],),
        ).fetchone()
        payment_amounts = finance_entry_amounts(payment)
        target_id = {
            "revenue_line": original["target_revenue_line_id"],
            "commitment": original["target_commitment_id"],
            "actual_cost": original["target_actual_cost_entry_id"],
        }[str(original["target_type"])]
        target = {
            "target_type": str(original["target_type"]),
            "target_id": int(target_id),
            "allocation_purpose": str(original["allocation_purpose"]),
            "target_revenue_line_id": original["target_revenue_line_id"],
            "target_commitment_id": original["target_commitment_id"],
            "target_actual_cost_entry_id": original["target_actual_cost_entry_id"],
        }
        amounts = {
            "net_amount_kopecks": int(original["net_amount_kopecks"]),
            "vat_amount_kopecks": int(original["vat_amount_kopecks"]),
            "gross_amount_kopecks": int(original["gross_amount_kopecks"]),
        }
        try:
            reversal_id = insert_payment_allocation_draft(
                con,
                project_id=int(original["project_id"]),
                payment=payment,
                payment_amounts=payment_amounts,
                target=target,
                allocation_amounts=amounts,
                allocation_key=f"reversal:{int(original['id'])}",
                reason=reason,
                user_id=int(user["id"]),
                entry_kind="reversal",
                reverses_allocation_id=int(original["id"]),
            )
        except sqlite3.IntegrityError as exc:
            if "UNIQUE constraint failed" in str(exc):
                handler.send_json(HTTPStatus.CONFLICT, {"error": "payment_allocation_reversal_exists"})
                return
            raise
        create_payment_allocation_event(
            con, int(original["id"]), int(original["project_id"]),
            "reversal_created", int(user["id"]), {"reversalAllocationId": reversal_id},
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.CREATED, {"id": reversal_id, "status": "draft"})


class ForecastCalculationError(ValueError):
    def __init__(self, code: str, details: dict | None = None):
        super().__init__(code)
        self.code = code
        self.details = details or {}


def forecast_source_state_payload(
    con: sqlite3.Connection,
    project_id: int,
    baseline_id: int,
) -> dict:
    def tuples(query: str, args: tuple = ()) -> list[tuple]:
        return [tuple(row) for row in con.execute(query, args).fetchall()]

    return {
        "baseline": tuples(
            """
            SELECT id, project_id, version_no, status, source_snapshot_hash, approved_at
            FROM project_financial_baselines WHERE id = ? AND project_id = ?
            """,
            (baseline_id, project_id),
        ),
        "revenue": tuples(
            """
            SELECT id, position, estimate_item_id, quantity, unit_price_net_kopecks,
                   net_amount_kopecks, vat_rate_basis_points, vat_amount_kopecks,
                   gross_amount_kopecks, source_reference
            FROM project_revenue_lines WHERE baseline_id = ? ORDER BY position, id
            """,
            (baseline_id,),
        ),
        "budget": tuples(
            """
            SELECT id, position, line_type, estimate_item_id, quantity,
                   unit_cost_net_kopecks, net_amount_kopecks, source_reference
            FROM project_budget_lines WHERE baseline_id = ? ORDER BY position, id
            """,
            (baseline_id,),
        ),
        "budgetSuccessors": tuples(
            """
            SELECT mapping.from_baseline_id, mapping.to_baseline_id,
                   mapping.source_budget_line_id, mapping.target_budget_line_id,
                   mapping.quantity_factor
            FROM project_budget_line_successors mapping
            JOIN project_financial_baselines target
              ON target.id = mapping.to_baseline_id
            WHERE mapping.project_id = ?
              AND target.status IN ('approved','superseded')
            ORDER BY mapping.from_baseline_id, mapping.source_budget_line_id, mapping.id
            """,
            (project_id,),
        ),
        "commitments": tuples(
            """
            SELECT commitment.id, commitment.baseline_id, commitment.status,
                   commitment.approved_at,
                   line.id, line.budget_line_id, line.estimate_item_id,
                   line.supplier_offer_id, line.quantity, line.unit_cost_net_kopecks,
                   line.net_amount_kopecks
            FROM project_commitments commitment
            JOIN project_commitment_lines line ON line.commitment_id = commitment.id
            WHERE commitment.project_id = ? AND commitment.status = 'approved'
            ORDER BY commitment.id, line.position, line.id
            """,
            (project_id,),
        ),
        "actual": tuples(
            """
            SELECT id, baseline_id, budget_line_id, commitment_line_id, entry_kind,
                   quantity, net_amount_kopecks, approved_at, source_type,
                   source_event_key
            FROM project_actual_cost_entries
            WHERE project_id = ? AND status = 'approved'
            ORDER BY id
            """,
            (project_id,),
        ),
        "offers": tuples(
            """
            SELECT offer.id, offer.estimate_item_id, offer.price, offer.qty,
                   offer.status, offer.activated_at, offer.updated_at
            FROM supplier_offers offer
            WHERE offer.project_id = ? AND offer.status = 'selected'
              AND offer.estimate_item_id IN (
                  SELECT estimate_item_id FROM project_budget_lines
                  WHERE baseline_id = ? AND estimate_item_id IS NOT NULL
              )
            ORDER BY offer.estimate_item_id, offer.id
            """,
            (project_id, baseline_id),
        ),
        "market": tuples(
            """
            SELECT snapshot.id, snapshot.estimate_item_id, snapshot.price,
                   snapshot.estimate_version, snapshot.analyzed_at
            FROM market_price_snapshots snapshot
            WHERE snapshot.project_id = ? AND snapshot.estimate_item_id IN (
                SELECT estimate_item_id FROM project_budget_lines
                WHERE baseline_id = ? AND estimate_item_id IS NOT NULL
            ) AND NOT EXISTS (
                SELECT 1 FROM market_price_snapshots newer
                WHERE newer.project_id = snapshot.project_id
                  AND newer.estimate_item_id = snapshot.estimate_item_id
                  AND (newer.analyzed_at > snapshot.analyzed_at
                       OR (newer.analyzed_at = snapshot.analyzed_at AND newer.id > snapshot.id))
            )
            ORDER BY snapshot.estimate_item_id, snapshot.id
            """,
            (project_id, baseline_id),
        ),
    }


def forecast_source_state_hash(
    con: sqlite3.Connection,
    project_id: int,
    baseline_id: int,
) -> str:
    payload = forecast_source_state_payload(con, project_id, baseline_id)
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def signed_actual_amount(row: sqlite3.Row, field: str) -> Decimal:
    value = decimal_value(row[field] or 0)
    return value if row["entry_kind"] == "cost" else -value


def parse_forecast_price_inputs(payload: dict) -> tuple[dict[tuple[str, int], dict], dict[int, dict]]:
    normalizations: dict[tuple[str, int], dict] = {}
    normalization_items = payload_value(
        payload, "priceNormalizations", "price_normalizations", []
    ) or []
    if not isinstance(normalization_items, list):
        raise ForecastCalculationError("bad_forecast_price_normalization")
    for item in normalization_items:
        if not isinstance(item, dict):
            raise ForecastCalculationError("bad_forecast_price_normalization")
        source_type = str(payload_value(item, "sourceType", "source_type", "")).strip()
        try:
            source_id = int(payload_value(item, "sourceId", "source_id"))
            vat_rate = int(payload_value(item, "vatRateBasisPoints", "vat_rate_basis_points", 0) or 0)
        except (TypeError, ValueError) as exc:
            raise ForecastCalculationError("bad_forecast_price_normalization") from exc
        vat_mode = str(payload_value(item, "vatMode", "vat_mode", "")).strip()
        if source_type not in {"supplier_offer", "market_snapshot"}:
            raise ForecastCalculationError("bad_forecast_price_source")
        if vat_mode not in {"net", "gross", "no_vat"}:
            raise ForecastCalculationError("forecast_price_vat_mode_required")
        if vat_rate < 0 or vat_rate > 10000 or (vat_mode == "no_vat" and vat_rate != 0):
            raise ForecastCalculationError("bad_forecast_price_vat")
        normalizations[(source_type, source_id)] = {
            "vat_mode": vat_mode,
            "vat_rate_basis_points": vat_rate,
        }

    manual_prices: dict[int, dict] = {}
    manual_items = payload_value(payload, "manualPrices", "manual_prices", []) or []
    if not isinstance(manual_items, list):
        raise ForecastCalculationError("bad_manual_forecast_price")
    for item in manual_items:
        if not isinstance(item, dict):
            raise ForecastCalculationError("bad_manual_forecast_price")
        try:
            budget_line_id = int(payload_value(item, "budgetLineId", "budget_line_id"))
            unit_price = decimal_value(payload_value(item, "unitPriceNet", "unit_price_net"))
        except (TypeError, ValueError) as exc:
            raise ForecastCalculationError("bad_manual_forecast_price") from exc
        reason = str(item.get("reason", "")).strip()
        unit_price_kopecks = decimal_to_kopecks(unit_price)
        if budget_line_id <= 0 or unit_price_kopecks <= 0 or not reason:
            raise ForecastCalculationError("bad_manual_forecast_price")
        manual_prices[budget_line_id] = {
            "unit_price_net_kopecks": unit_price_kopecks,
            "reason": reason,
        }
    return normalizations, manual_prices


def forecast_component(
    *,
    budget_line_id: int | None,
    commitment_line_id: int | None,
    estimate_item_id: int | None,
    component_type: str,
    source_type: str,
    title: str,
    unit: str | None,
    quantity: Decimal | None,
    raw_unit_price_kopecks: int | None,
    unit_cost_net_kopecks: int | None,
    net_amount_kopecks: int,
    source_snapshot_at: int,
    source_version: str,
    source_reference: str,
    reason: str,
    supplier_offer_id: int | None = None,
    market_snapshot_id: int | None = None,
    source_vat_mode: str | None = None,
    vat_rate_basis_points: int | None = None,
    amount_sign: int = 1,
) -> dict:
    if net_amount_kopecks <= 0:
        raise ForecastCalculationError("forecast_component_amount_must_be_positive")
    return {
        "budget_line_id": budget_line_id,
        "commitment_line_id": commitment_line_id,
        "estimate_item_id": estimate_item_id,
        "component_type": component_type,
        "source_type": source_type,
        "supplier_offer_id": supplier_offer_id,
        "market_snapshot_id": market_snapshot_id,
        "title": title,
        "unit": unit,
        "quantity": float(quantity) if quantity is not None else None,
        "raw_unit_price_kopecks": raw_unit_price_kopecks,
        "unit_cost_net_kopecks": unit_cost_net_kopecks,
        "amount_sign": amount_sign,
        "net_amount_kopecks": net_amount_kopecks,
        "source_vat_mode": source_vat_mode,
        "vat_rate_basis_points": vat_rate_basis_points,
        "source_snapshot_at": source_snapshot_at,
        "source_version": source_version,
        "source_reference": source_reference,
        "reason": reason,
    }


def calculate_forecast_snapshot(
    con: sqlite3.Connection,
    project_id: int,
    baseline: sqlite3.Row,
    payload: dict,
) -> dict:
    baseline_id = int(baseline["id"])
    timestamp = now_ts()
    normalizations, manual_prices = parse_forecast_price_inputs(payload)
    budget_lines = con.execute(
        """
        SELECT * FROM project_budget_lines
        WHERE baseline_id = ? ORDER BY position, id
        """,
        (baseline_id,),
    ).fetchall()
    commitment_source_rows = con.execute(
        """
        SELECT line.*, commitment.id AS parent_commitment_id,
               commitment.approved_at AS commitment_approved_at,
               commitment.commitment_no
        FROM project_commitment_lines line
        JOIN project_commitments commitment ON commitment.id = line.commitment_id
        WHERE commitment.project_id = ? AND commitment.status = 'approved'
        ORDER BY line.budget_line_id, commitment.id, line.position, line.id
        """,
        (project_id,),
    ).fetchall()
    actual_source_rows = con.execute(
        """
        SELECT * FROM project_actual_cost_entries
        WHERE project_id = ? AND status = 'approved'
        ORDER BY id
        """,
        (project_id,),
    ).fetchall()
    budget_resolution = resolved_budget_line_map(con, project_id, baseline_id)
    unresolved_budget_ids = sorted({
        int(row["budget_line_id"])
        for row in list(commitment_source_rows) + list(actual_source_rows)
        if int(row["budget_line_id"]) not in budget_resolution
    })
    if unresolved_budget_ids:
        raise ForecastCalculationError(
            "baseline_successor_mapping_incomplete",
            {"budgetLineIds": unresolved_budget_ids},
        )
    commitment_lines: list[dict] = []
    for row in commitment_source_rows:
        item = dict(row)
        resolved_line_id, quantity_factor = budget_resolution[int(row["budget_line_id"])]
        item["resolved_budget_line_id"] = resolved_line_id
        item["quantity_factor"] = quantity_factor
        commitment_lines.append(item)
    actual_rows: list[dict] = []
    for row in actual_source_rows:
        item = dict(row)
        resolved_line_id, quantity_factor = budget_resolution[int(row["budget_line_id"])]
        item["resolved_budget_line_id"] = resolved_line_id
        item["quantity_factor"] = quantity_factor
        actual_rows.append(item)
    selected_offers = con.execute(
        """
        SELECT * FROM supplier_offers
        WHERE project_id = ? AND status = 'selected' AND estimate_item_id IS NOT NULL
        ORDER BY estimate_item_id, id
        """,
        (project_id,),
    ).fetchall()
    market_rows = con.execute(
        """
        SELECT snapshot.*
        FROM market_price_snapshots snapshot
        WHERE snapshot.project_id = ? AND snapshot.estimate_item_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM market_price_snapshots newer
              WHERE newer.project_id = snapshot.project_id
                AND newer.estimate_item_id = snapshot.estimate_item_id
                AND (newer.analyzed_at > snapshot.analyzed_at
                     OR (newer.analyzed_at = snapshot.analyzed_at AND newer.id > snapshot.id))
          )
        """,
        (project_id,),
    ).fetchall()

    contract_revenue = int(
        con.execute(
            "SELECT COALESCE(SUM(net_amount_kopecks), 0) FROM project_revenue_lines WHERE baseline_id = ?",
            (baseline_id,),
        ).fetchone()[0]
    )
    target_cost = sum(int(row["net_amount_kopecks"]) for row in budget_lines)
    committed_total = sum(int(row["net_amount_kopecks"]) for row in commitment_lines)
    actual_cost = sum(
        int(row["net_amount_kopecks"]) if row["entry_kind"] == "cost"
        else -int(row["net_amount_kopecks"])
        for row in actual_rows
    )
    if actual_cost < 0:
        raise ForecastCalculationError("actual_cost_cannot_be_negative")

    active_commitment_line_ids = {int(row["id"]) for row in commitment_lines}
    actual_by_commitment_line: dict[int, dict[str, Decimal]] = {}
    direct_actual_by_budget: dict[int, dict[str, Decimal]] = {}
    for row in actual_rows:
        signed_net = signed_actual_amount(row, "net_amount_kopecks")
        signed_qty = signed_actual_amount(row, "quantity")
        commitment_line_id = row["commitment_line_id"]
        if commitment_line_id is not None and int(commitment_line_id) in active_commitment_line_ids:
            bucket = actual_by_commitment_line.setdefault(
                int(commitment_line_id), {"net": Decimal(0), "qty": Decimal(0)}
            )
        else:
            bucket = direct_actual_by_budget.setdefault(
                int(row["resolved_budget_line_id"]),
                {"net": Decimal(0), "qty": Decimal(0)},
            )
        bucket["net"] += signed_net
        bucket["qty"] += signed_qty * decimal_value(row["quantity_factor"])

    commitments_by_budget: dict[int, list[dict]] = {}
    committed_offer_qty: dict[int, Decimal] = {}
    for line in commitment_lines:
        commitments_by_budget.setdefault(
            int(line["resolved_budget_line_id"]), []
        ).append(line)
        if line["supplier_offer_id"] is not None:
            offer_id = int(line["supplier_offer_id"])
            committed_offer_qty[offer_id] = (
                committed_offer_qty.get(offer_id, Decimal(0))
                + decimal_value(line["quantity"])
                * decimal_value(line["quantity_factor"])
            )
    offer_by_item = {int(row["estimate_item_id"]): row for row in selected_offers}
    market_by_item = {int(row["estimate_item_id"]): row for row in market_rows}
    offer_capacity_used: dict[int, Decimal] = {}
    components: list[dict] = []

    for budget in budget_lines:
        budget_id = int(budget["id"])
        estimate_item_id = int(budget["estimate_item_id"]) if budget["estimate_item_id"] is not None else None
        target_qty = decimal_value(budget["quantity"]) if budget["quantity"] is not None else None
        target_unit_net = int(budget["unit_cost_net_kopecks"] or 0)
        consumed_qty = Decimal(0)
        consumed_scope_net = Decimal(0)
        for line in commitments_by_budget.get(budget_id, []):
            recognized = actual_by_commitment_line.get(
                int(line["id"]), {"net": Decimal(0), "qty": Decimal(0)}
            )
            line_net = Decimal(int(line["net_amount_kopecks"]))
            quantity_factor = decimal_value(line["quantity_factor"])
            line_qty = decimal_value(line["quantity"]) * quantity_factor
            recognized_net = max(recognized["net"], Decimal(0))
            # actual_by_commitment_line already stores quantity in the current
            # baseline unit through quantity_factor; applying it again would
            # understate the remaining quantity after a unit conversion.
            recognized_qty = max(recognized["qty"], Decimal(0))
            remaining_net = max(line_net - recognized_net, Decimal(0))
            if remaining_net > 0:
                remaining_qty = max(line_qty - recognized_qty, Decimal(0))
                normalized_unit_cost = int(
                    (
                        Decimal(int(line["unit_cost_net_kopecks"]))
                        / quantity_factor
                    ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                )
                components.append(
                    forecast_component(
                        budget_line_id=budget_id,
                        commitment_line_id=int(line["id"]),
                        estimate_item_id=estimate_item_id,
                        component_type="remaining_commitment",
                        source_type="approved_commitment",
                        title=str(line["title"]),
                        unit=budget["unit"],
                        quantity=remaining_qty if remaining_qty > 0 else None,
                        raw_unit_price_kopecks=int(line["source_unit_price_kopecks"]),
                        unit_cost_net_kopecks=normalized_unit_cost,
                        net_amount_kopecks=int(remaining_net),
                        source_snapshot_at=int(line["commitment_approved_at"] or timestamp),
                        source_version=f"commitment:{int(line['parent_commitment_id'])}:approved:{int(line['commitment_approved_at'] or 0)}",
                        source_reference=str(line["source_reference"]),
                        reason="Unaccepted remainder of approved commitment",
                        source_vat_mode=str(line["source_vat_mode"]),
                        vat_rate_basis_points=int(line["vat_rate_basis_points"]),
                    )
                )
            consumed_qty += max(line_qty, recognized_qty)
            consumed_scope_net += max(line_net, recognized_net)

        direct_actual = direct_actual_by_budget.get(
            budget_id, {"net": Decimal(0), "qty": Decimal(0)}
        )
        consumed_qty += max(direct_actual["qty"], Decimal(0))
        consumed_scope_net += max(direct_actual["net"], Decimal(0))

        if target_qty is None or target_qty <= 0:
            residual = max(Decimal(int(budget["net_amount_kopecks"])) - consumed_scope_net, Decimal(0))
            if residual > 0:
                components.append(
                    forecast_component(
                        budget_line_id=budget_id,
                        commitment_line_id=None,
                        estimate_item_id=estimate_item_id,
                        component_type="uncontracted",
                        source_type="target_budget",
                        title=str(budget["title"]),
                        unit=budget["unit"],
                        quantity=None,
                        raw_unit_price_kopecks=None,
                        unit_cost_net_kopecks=target_unit_net or None,
                        net_amount_kopecks=int(residual),
                        source_snapshot_at=int(baseline["approved_at"] or timestamp),
                        source_version=f"baseline:{baseline_id}:version:{int(baseline['version_no'])}",
                        source_reference=str(budget["source_reference"]),
                        reason="Quantity is unavailable; residual uses the approved target amount",
                    )
                )
            continue

        remaining_qty = max(target_qty - consumed_qty, Decimal(0))
        if remaining_qty <= 0:
            continue
        uncovered_qty = remaining_qty
        offer = offer_by_item.get(estimate_item_id) if estimate_item_id is not None else None
        if offer is not None and decimal_value(offer["price"] or 0) > 0:
            offer_id = int(offer["id"])
            quoted_qty = decimal_value(offer["qty"] or 0)
            if quoted_qty > 0:
                total_capacity = max(quoted_qty - committed_offer_qty.get(offer_id, Decimal(0)), Decimal(0))
                available_capacity = max(total_capacity - offer_capacity_used.get(offer_id, Decimal(0)), Decimal(0))
                covered_qty = min(uncovered_qty, available_capacity)
            else:
                covered_qty = uncovered_qty
            if covered_qty > 0:
                normalization = normalizations.get(("supplier_offer", offer_id))
                if not normalization:
                    raise ForecastCalculationError(
                        "forecast_price_normalization_required",
                        {"sourceType": "supplier_offer", "sourceId": offer_id},
                    )
                amounts = normalize_offer_amounts(
                    offer["price"], covered_qty,
                    normalization["vat_mode"], normalization["vat_rate_basis_points"],
                )
                components.append(
                    forecast_component(
                        budget_line_id=budget_id,
                        commitment_line_id=None,
                        estimate_item_id=estimate_item_id,
                        component_type="uncontracted",
                        source_type="active_supplier_offer",
                        supplier_offer_id=offer_id,
                        title=str(budget["title"]),
                        unit=budget["unit"],
                        quantity=covered_qty,
                        raw_unit_price_kopecks=int(amounts["source_unit_price_kopecks"]),
                        unit_cost_net_kopecks=int(amounts["unit_cost_net_kopecks"]),
                        net_amount_kopecks=int(amounts["net_amount_kopecks"]),
                        source_snapshot_at=int(offer["updated_at"] or offer["activated_at"] or offer["created_at"]),
                        source_version=f"supplier_offer:{offer_id}:updated:{int(offer['updated_at'] or 0)}",
                        source_reference=f"supplier_offer:{offer_id}",
                        reason="Highest-priority active offer for uncontracted quantity",
                        source_vat_mode=normalization["vat_mode"],
                        vat_rate_basis_points=normalization["vat_rate_basis_points"],
                    )
                )
                uncovered_qty -= covered_qty
                offer_capacity_used[offer_id] = offer_capacity_used.get(offer_id, Decimal(0)) + covered_qty

        if uncovered_qty > 0:
            market = market_by_item.get(estimate_item_id) if estimate_item_id is not None else None
            if market is not None and decimal_value(market["price"] or 0) > 0:
                snapshot_id = int(market["id"])
                normalization = normalizations.get(("market_snapshot", snapshot_id))
                if not normalization:
                    raise ForecastCalculationError(
                        "forecast_price_normalization_required",
                        {"sourceType": "market_snapshot", "sourceId": snapshot_id},
                    )
                amounts = normalize_offer_amounts(
                    market["price"], uncovered_qty,
                    normalization["vat_mode"], normalization["vat_rate_basis_points"],
                )
                components.append(
                    forecast_component(
                        budget_line_id=budget_id,
                        commitment_line_id=None,
                        estimate_item_id=estimate_item_id,
                        component_type="uncontracted",
                        source_type="autobot_snapshot",
                        market_snapshot_id=snapshot_id,
                        title=str(budget["title"]),
                        unit=budget["unit"],
                        quantity=uncovered_qty,
                        raw_unit_price_kopecks=int(amounts["source_unit_price_kopecks"]),
                        unit_cost_net_kopecks=int(amounts["unit_cost_net_kopecks"]),
                        net_amount_kopecks=int(amounts["net_amount_kopecks"]),
                        source_snapshot_at=int(market["analyzed_at"]),
                        source_version=f"market_snapshot:{snapshot_id}:estimate:{market['estimate_version']}",
                        source_reference=f"market_snapshot:{snapshot_id}",
                        reason="Latest saved AutoBot price for quantity not covered by an active offer",
                        source_vat_mode=normalization["vat_mode"],
                        vat_rate_basis_points=normalization["vat_rate_basis_points"],
                    )
                )
                uncovered_qty = Decimal(0)

        if uncovered_qty > 0 and target_unit_net > 0:
            amount = decimal_to_kopecks(
                (Decimal(target_unit_net) / Decimal(100)) * uncovered_qty
            )
            components.append(
                forecast_component(
                    budget_line_id=budget_id,
                    commitment_line_id=None,
                    estimate_item_id=estimate_item_id,
                    component_type="uncontracted",
                    source_type="target_budget",
                    title=str(budget["title"]),
                    unit=budget["unit"],
                    quantity=uncovered_qty,
                    raw_unit_price_kopecks=target_unit_net,
                    unit_cost_net_kopecks=target_unit_net,
                    net_amount_kopecks=amount,
                    source_snapshot_at=int(baseline["approved_at"] or timestamp),
                    source_version=f"baseline:{baseline_id}:version:{int(baseline['version_no'])}",
                    source_reference=str(budget["source_reference"]),
                    reason="Approved target unit cost used after higher-priority sources",
                    source_vat_mode="net",
                    vat_rate_basis_points=0,
                )
            )
            uncovered_qty = Decimal(0)

        if uncovered_qty > 0:
            manual = manual_prices.get(budget_id)
            if not manual:
                raise ForecastCalculationError(
                    "forecast_price_source_required",
                    {"budgetLineId": budget_id, "remainingQuantity": float(uncovered_qty)},
                )
            unit_net = int(manual["unit_price_net_kopecks"])
            amount = decimal_to_kopecks((Decimal(unit_net) / Decimal(100)) * uncovered_qty)
            components.append(
                forecast_component(
                    budget_line_id=budget_id,
                    commitment_line_id=None,
                    estimate_item_id=estimate_item_id,
                    component_type="uncontracted",
                    source_type="manual_unit_price",
                    title=str(budget["title"]),
                    unit=budget["unit"],
                    quantity=uncovered_qty,
                    raw_unit_price_kopecks=unit_net,
                    unit_cost_net_kopecks=unit_net,
                    net_amount_kopecks=amount,
                    source_snapshot_at=timestamp,
                    source_version=f"manual:forecast-request:{timestamp}",
                    source_reference=f"manual_price:budget_line:{budget_id}",
                    reason=str(manual["reason"]),
                    source_vat_mode="net",
                    vat_rate_basis_points=0,
                )
            )

    adjustment_items = payload.get("adjustments", []) or []
    if not isinstance(adjustment_items, list):
        raise ForecastCalculationError("bad_forecast_adjustment")
    for item in adjustment_items:
        if not isinstance(item, dict):
            raise ForecastCalculationError("bad_forecast_adjustment")
        adjustment_type = str(item.get("type", "adjustment")).strip()
        if adjustment_type not in {"adjustment", "risk"}:
            raise ForecastCalculationError("bad_forecast_adjustment_type")
        try:
            amount = decimal_value(payload_value(item, "amountNet", "amount_net"))
            budget_line_id = optional_positive_int(payload_value(item, "budgetLineId", "budget_line_id"))
        except (TypeError, ValueError) as exc:
            raise ForecastCalculationError("bad_forecast_adjustment") from exc
        reason = str(item.get("reason", "")).strip()
        amount_kopecks = decimal_to_kopecks(abs(amount))
        if amount_kopecks <= 0 or not reason or (adjustment_type == "risk" and amount < 0):
            raise ForecastCalculationError("bad_forecast_adjustment")
        if budget_line_id is not None and not any(int(row["id"]) == budget_line_id for row in budget_lines):
            raise ForecastCalculationError("forecast_adjustment_budget_line_mismatch")
        amount_sign = 1 if amount > 0 else -1
        components.append(
            forecast_component(
                budget_line_id=budget_line_id,
                commitment_line_id=None,
                estimate_item_id=None,
                component_type=adjustment_type,
                source_type="manual_risk" if adjustment_type == "risk" else "manual_adjustment",
                title=str(item.get("title") or ("Forecast risk" if adjustment_type == "risk" else "Forecast adjustment")),
                unit=None,
                quantity=None,
                raw_unit_price_kopecks=None,
                unit_cost_net_kopecks=None,
                net_amount_kopecks=amount_kopecks,
                amount_sign=amount_sign,
                source_snapshot_at=timestamp,
                source_version=f"manual:forecast-request:{timestamp}",
                source_reference=str(payload_value(item, "sourceReference", "source_reference", "manual")).strip() or "manual",
                reason=reason,
            )
        )

    etc = sum(component["amount_sign"] * component["net_amount_kopecks"] for component in components)
    if etc < 0:
        raise ForecastCalculationError("forecast_etc_cannot_be_negative")
    eac = actual_cost + etc
    return {
        "source_state_hash": forecast_source_state_hash(con, project_id, baseline_id),
        "contract_revenue_net_kopecks": contract_revenue,
        "target_cost_net_kopecks": target_cost,
        "committed_total_net_kopecks": committed_total,
        "actual_cost_net_kopecks": actual_cost,
        "etc_net_kopecks": etc,
        "eac_net_kopecks": eac,
        "forecast_margin_net_kopecks": contract_revenue - eac,
        "budget_variance_net_kopecks": target_cost - eac,
        "components": components,
    }


def create_forecast_event(
    con: sqlite3.Connection,
    forecast_id: int,
    project_id: int,
    action: str,
    actor_id: int,
    details: dict | None = None,
) -> None:
    con.execute(
        """
        INSERT INTO project_forecast_events (
            forecast_id, project_id, action, actor_id, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (forecast_id, project_id, action, actor_id,
         json.dumps(details or {}, ensure_ascii=False), now_ts()),
    )


def insert_forecast_component(
    con: sqlite3.Connection,
    forecast_id: int,
    position: int,
    component: dict,
    user_id: int,
) -> None:
    con.execute(
        """
        INSERT INTO project_forecast_components (
            forecast_id, position, budget_line_id, commitment_line_id, estimate_item_id,
            component_type, source_type, supplier_offer_id, market_snapshot_id,
            title, unit, quantity, raw_unit_price_kopecks, unit_cost_net_kopecks,
            amount_sign, net_amount_kopecks, source_vat_mode, vat_rate_basis_points,
            source_snapshot_at, source_version, source_reference, reason, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            forecast_id, position, component["budget_line_id"], component["commitment_line_id"],
            component["estimate_item_id"], component["component_type"], component["source_type"],
            component["supplier_offer_id"], component["market_snapshot_id"], component["title"],
            component["unit"], component["quantity"], component["raw_unit_price_kopecks"],
            component["unit_cost_net_kopecks"], component["amount_sign"],
            component["net_amount_kopecks"], component["source_vat_mode"],
            component["vat_rate_basis_points"], component["source_snapshot_at"],
            component["source_version"], component["source_reference"], component["reason"],
            user_id, now_ts(),
        ),
    )


def margin_percent_value(revenue_kopecks: int, margin_kopecks: int) -> float | None:
    if revenue_kopecks <= 0:
        return None
    value = (
        Decimal(margin_kopecks) / Decimal(revenue_kopecks) * Decimal(100)
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(value)


def serialize_forecast(
    row: sqlite3.Row,
    components: list[sqlite3.Row],
    events: list[sqlite3.Row],
    *,
    is_stale: bool | None = None,
) -> dict:
    component_payload = [
        {
            "id": int(component["id"]),
            "position": int(component["position"]),
            "budgetLineId": component["budget_line_id"],
            "commitmentLineId": component["commitment_line_id"],
            "estimateItemId": component["estimate_item_id"],
            "componentType": str(component["component_type"]),
            "sourceType": str(component["source_type"]),
            "supplierOfferId": component["supplier_offer_id"],
            "marketSnapshotId": component["market_snapshot_id"],
            "title": str(component["title"]),
            "unit": component["unit"],
            "quantity": float(component["quantity"]) if component["quantity"] is not None else None,
            "rawUnitPriceKopecks": component["raw_unit_price_kopecks"],
            "unitCostNetKopecks": component["unit_cost_net_kopecks"],
            "amountSign": int(component["amount_sign"]),
            "netAmountKopecks": int(component["net_amount_kopecks"]),
            "signedNetAmountKopecks": int(component["amount_sign"]) * int(component["net_amount_kopecks"]),
            "sourceVatMode": component["source_vat_mode"],
            "vatRateBasisPoints": component["vat_rate_basis_points"],
            "sourceSnapshotAt": int(component["source_snapshot_at"]),
            "sourceVersion": str(component["source_version"]),
            "sourceReference": str(component["source_reference"]),
            "reason": str(component["reason"]),
        }
        for component in components
    ]
    event_payload = []
    for event in events:
        try:
            details = json.loads(event["details"] or "{}")
        except (TypeError, ValueError):
            details = {}
        event_payload.append({
            "id": int(event["id"]), "action": str(event["action"]),
            "actorId": int(event["actor_id"]), "actorName": str(event["actor_name"] or ""),
            "details": details, "createdAt": int(event["created_at"]),
        })
    margin = int(row["forecast_margin_net_kopecks"])
    margin_color = "positive" if margin > 0 else "negative" if margin < 0 else "neutral"
    return {
        "id": int(row["id"]),
        "projectId": int(row["project_id"]),
        "baselineId": int(row["baseline_id"]),
        "versionNo": int(row["version_no"]),
        "status": str(row["status"]),
        "calculationDate": str(row["calculation_date"]),
        "sourceStateHash": str(row["source_state_hash"]),
        "isStale": is_stale,
        "contractRevenueNetKopecks": int(row["contract_revenue_net_kopecks"]),
        "targetCostNetKopecks": int(row["target_cost_net_kopecks"]),
        "committedTotalNetKopecks": int(row["committed_total_net_kopecks"]),
        "actualCostNetKopecks": int(row["actual_cost_net_kopecks"]),
        "etcNetKopecks": int(row["etc_net_kopecks"]),
        "eacNetKopecks": int(row["eac_net_kopecks"]),
        "forecastMarginNetKopecks": margin,
        "forecastMarginPercent": margin_percent_value(
            int(row["contract_revenue_net_kopecks"]), margin
        ),
        "forecastMarginColor": margin_color,
        "budgetVarianceNetKopecks": int(row["budget_variance_net_kopecks"]),
        "reason": str(row["reason"]),
        "createdBy": int(row["created_by"]),
        "submittedBy": row["submitted_by"],
        "submittedAt": row["submitted_at"],
        "approvedBy": row["approved_by"],
        "approvedAt": row["approved_at"],
        "createdAt": int(row["created_at"]),
        "updatedAt": int(row["updated_at"]),
        "components": component_payload,
        "events": event_payload,
    }


def load_forecast_details(
    con: sqlite3.Connection,
    forecast_id: int,
) -> tuple[sqlite3.Row | None, list[sqlite3.Row], list[sqlite3.Row]]:
    row = con.execute("SELECT * FROM project_forecasts WHERE id = ?", (forecast_id,)).fetchone()
    if not row:
        return None, [], []
    components = con.execute(
        "SELECT * FROM project_forecast_components WHERE forecast_id = ? ORDER BY position, id",
        (forecast_id,),
    ).fetchall()
    events = con.execute(
        """
        SELECT event.*, actor.name AS actor_name
        FROM project_forecast_events event
        LEFT JOIN users actor ON actor.id = event.actor_id
        WHERE event.forecast_id = ? ORDER BY event.created_at, event.id
        """,
        (forecast_id,),
    ).fetchall()
    return row, components, events


def api_calculate_project_forecast(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=True)
    if not user:
        return
    payload = handler.read_json()
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
        return
    try:
        calculation_date = normalized_recognition_date(
            payload_value(payload, "calculationDate", "calculation_date", date.today().isoformat())
        )
    except ValueError as exc:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        return
    with db() as con:
        # Version allocation and the source snapshot must describe one serialized
        # database state.  Without a write reservation two concurrent requests can
        # both choose the same MAX(version_no) + 1 (or calculate from sources that
        # change before their INSERT).
        con.execute("BEGIN IMMEDIATE")
        baseline = con.execute(
            """
            SELECT * FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (project_id,),
        ).fetchone()
        if not baseline:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "approved_financial_baseline_required"})
            return
        try:
            snapshot = calculate_forecast_snapshot(con, project_id, baseline, payload)
        except ForecastCalculationError as exc:
            con.rollback()
            response = {"error": exc.code}
            response.update(exc.details)
            handler.send_json(HTTPStatus.CONFLICT, response)
            return
        version_no = int(
            con.execute(
                "SELECT COALESCE(MAX(version_no), 0) + 1 FROM project_forecasts WHERE project_id = ?",
                (project_id,),
            ).fetchone()[0]
        )
        timestamp = now_ts()
        cursor = con.execute(
            """
            INSERT INTO project_forecasts (
                project_id, baseline_id, version_no, status, currency_code,
                calculation_date, source_state_hash, contract_revenue_net_kopecks,
                target_cost_net_kopecks, committed_total_net_kopecks,
                actual_cost_net_kopecks, etc_net_kopecks, eac_net_kopecks,
                forecast_margin_net_kopecks, budget_variance_net_kopecks,
                reason, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, 'draft', 'RUB', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id, baseline["id"], version_no, calculation_date,
                snapshot["source_state_hash"], snapshot["contract_revenue_net_kopecks"],
                snapshot["target_cost_net_kopecks"], snapshot["committed_total_net_kopecks"],
                snapshot["actual_cost_net_kopecks"], snapshot["etc_net_kopecks"],
                snapshot["eac_net_kopecks"], snapshot["forecast_margin_net_kopecks"],
                snapshot["budget_variance_net_kopecks"], reason, user["id"], timestamp, timestamp,
            ),
        )
        forecast_id = int(cursor.lastrowid)
        for position, component in enumerate(snapshot["components"], start=1):
            insert_forecast_component(con, forecast_id, position, component, int(user["id"]))
        create_forecast_event(
            con, forecast_id, project_id, "calculated", int(user["id"]),
            {"versionNo": version_no, "sourceStateHash": snapshot["source_state_hash"]},
        )
        create_audit(
            con, int(user["id"]), "calculate_project_forecast", forecast_id,
            {"project_id": project_id, "version_no": version_no}, entity="project_forecast",
        )
        con.commit()
        row, components, events = load_forecast_details(con, forecast_id)
    handler.send_json(
        HTTPStatus.CREATED,
        {"forecast": serialize_forecast(row, components, events, is_stale=False)},
    )


def load_forecast_for_action(
    handler,
    path: str,
) -> tuple[sqlite3.Connection, sqlite3.Row, dict] | None:
    forecast_id = parse_path_int(path, 2)
    if not forecast_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_forecast_id"})
        return None
    con = db()
    forecast = con.execute("SELECT * FROM project_forecasts WHERE id = ?", (forecast_id,)).fetchone()
    if not forecast:
        con.close()
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "forecast_not_found"})
        return None
    user = require_economics_access(handler, int(forecast["project_id"]), manage=True)
    if not user:
        con.close()
        return None
    return con, forecast, user


def forecast_approval_issue(con: sqlite3.Connection, forecast: sqlite3.Row) -> str | None:
    baseline = con.execute(
        """
        SELECT id FROM project_financial_baselines
        WHERE id = ? AND project_id = ? AND status = 'approved'
        """,
        (forecast["baseline_id"], forecast["project_id"]),
    ).fetchone()
    if not baseline:
        return "approved_financial_baseline_required"
    current_hash = forecast_source_state_hash(
        con, int(forecast["project_id"]), int(forecast["baseline_id"])
    )
    if current_hash != str(forecast["source_state_hash"]):
        return "forecast_sources_changed_recalculate"
    newer = con.execute(
        """
        SELECT 1 FROM project_forecasts
        WHERE project_id = ? AND status = 'approved' AND version_no > ? LIMIT 1
        """,
        (forecast["project_id"], forecast["version_no"]),
    ).fetchone()
    if newer:
        return "newer_approved_forecast_exists"
    return None


def api_submit_project_forecast(handler, path: str) -> None:
    loaded = load_forecast_for_action(handler, path)
    if not loaded:
        return
    con, forecast, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        forecast = con.execute(
            "SELECT * FROM project_forecasts WHERE id = ?",
            (forecast["id"],),
        ).fetchone()
        if not forecast or forecast["status"] != "draft":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "forecast_not_draft"})
            return
        issue = forecast_approval_issue(con, forecast)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_forecasts
            SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ?
            WHERE id = ? AND status = 'draft'
            """,
            (user["id"], timestamp, timestamp, forecast["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "forecast_not_draft"})
            return
        create_forecast_event(
            con, int(forecast["id"]), int(forecast["project_id"]),
            "submitted", int(user["id"]),
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(forecast["id"]), "status": "pending_approval"})


def api_approve_project_forecast(handler, path: str) -> None:
    loaded = load_forecast_for_action(handler, path)
    if not loaded:
        return
    con, forecast, user = loaded
    try:
        con.execute("BEGIN IMMEDIATE")
        forecast = con.execute(
            "SELECT * FROM project_forecasts WHERE id = ?",
            (forecast["id"],),
        ).fetchone()
        if not forecast or forecast["status"] != "pending_approval":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "forecast_not_pending"})
            return
        issue = forecast_approval_issue(con, forecast)
        if issue:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": issue})
            return
        timestamp = now_ts()
        updated = con.execute(
            """
            UPDATE project_forecasts
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ? AND status = 'pending_approval'
            """,
            (user["id"], timestamp, timestamp, forecast["id"]),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": "forecast_not_pending"})
            return
        create_forecast_event(
            con, int(forecast["id"]), int(forecast["project_id"]),
            "approved", int(user["id"]),
        )
        create_audit(
            con, int(user["id"]), "approve_project_forecast", int(forecast["id"]),
            {"project_id": forecast["project_id"], "version_no": forecast["version_no"]},
            entity="project_forecast",
        )
        con.commit()
    finally:
        con.close()
    handler.send_json(HTTPStatus.OK, {"id": int(forecast["id"]), "status": "approved"})


def current_economic_totals(
    con: sqlite3.Connection,
    project_id: int,
    baseline_id: int,
) -> dict[str, int]:
    contract_revenue = int(con.execute(
        "SELECT COALESCE(SUM(net_amount_kopecks), 0) FROM project_revenue_lines WHERE baseline_id = ?",
        (baseline_id,),
    ).fetchone()[0])
    target_cost = int(con.execute(
        "SELECT COALESCE(SUM(net_amount_kopecks), 0) FROM project_budget_lines WHERE baseline_id = ?",
        (baseline_id,),
    ).fetchone()[0])
    committed_total = int(con.execute(
        """
        SELECT COALESCE(SUM(line.net_amount_kopecks), 0)
        FROM project_commitment_lines line
        JOIN project_commitments commitment ON commitment.id = line.commitment_id
        WHERE commitment.project_id = ? AND commitment.status = 'approved'
        """,
        (project_id,),
    ).fetchone()[0])
    actual_cost = int(con.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN entry_kind = 'cost'
                                 THEN net_amount_kopecks ELSE -net_amount_kopecks END), 0)
        FROM project_actual_cost_entries
        WHERE project_id = ? AND status = 'approved'
        """,
        (project_id,),
    ).fetchone()[0])
    remaining_commitment = int(con.execute(
        """
        SELECT COALESCE(SUM(MAX(line.net_amount_kopecks - COALESCE(actual.recognized_net, 0), 0)), 0)
        FROM project_commitment_lines line
        JOIN project_commitments commitment ON commitment.id = line.commitment_id
        LEFT JOIN (
            SELECT commitment_line_id,
                   SUM(CASE WHEN entry_kind = 'cost'
                            THEN net_amount_kopecks ELSE -net_amount_kopecks END) AS recognized_net
            FROM project_actual_cost_entries
            WHERE project_id = ? AND status = 'approved'
              AND commitment_line_id IS NOT NULL
            GROUP BY commitment_line_id
        ) actual ON actual.commitment_line_id = line.id
        WHERE commitment.project_id = ? AND commitment.status = 'approved'
        """,
        (project_id, project_id),
    ).fetchone()[0])
    return {
        "contract_revenue": contract_revenue,
        "target_cost": target_cost,
        "committed_total": committed_total,
        "actual_cost": actual_cost,
        "remaining_commitment": remaining_commitment,
    }


def current_cash_totals(con: sqlite3.Connection, project_id: int) -> dict[str, int]:
    received = {"net": 0, "vat": 0, "gross": 0}
    paid = {"net": 0, "vat": 0, "gross": 0}
    for payment in con.execute(
        "SELECT * FROM finance_entries WHERE project_id = ?", (project_id,)
    ).fetchall():
        if not finance_entry_is_paid_and_dated(payment):
            continue
        try:
            amounts = finance_entry_amounts(payment)
        except ValueError:
            continue
        bucket = received if payment["direction"] == "income" else paid
        bucket["net"] += int(amounts["net_amount_kopecks"])
        bucket["vat"] += int(amounts["vat_amount_kopecks"])
        bucket["gross"] += int(amounts["gross_amount_kopecks"])
    return {
        "cash_received_net": received["net"],
        "cash_received_vat": received["vat"],
        "cash_received_gross": received["gross"],
        "cash_paid_net": paid["net"],
        "cash_paid_vat": paid["vat"],
        "cash_paid_gross": paid["gross"],
        "cash_balance_gross": received["gross"] - paid["gross"],
    }


def api_project_economics(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = require_economics_access(handler, project_id, manage=False)
    if not user:
        return
    with db() as con:
        baseline = con.execute(
            """
            SELECT * FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (project_id,),
        ).fetchone()
        cash = current_cash_totals(con, project_id)
        if not baseline:
            handler.send_json(
                HTTPStatus.OK,
                {"status": "not_configured", "forecast": None, "cashFlow": {
                    "cashReceivedNetKopecks": cash["cash_received_net"],
                    "cashReceivedVatKopecks": cash["cash_received_vat"],
                    "cashReceivedGrossKopecks": cash["cash_received_gross"],
                    "cashPaidNetKopecks": cash["cash_paid_net"],
                    "cashPaidVatKopecks": cash["cash_paid_vat"],
                    "cashPaidGrossKopecks": cash["cash_paid_gross"],
                    "cashBalanceGrossKopecks": cash["cash_balance_gross"],
                }},
            )
            return
        totals = current_economic_totals(con, project_id, int(baseline["id"]))
        forecast_row = con.execute(
            """
            SELECT * FROM project_forecasts
            WHERE project_id = ? AND baseline_id = ? AND status = 'approved'
            ORDER BY version_no DESC, id DESC LIMIT 1
            """,
            (project_id, baseline["id"]),
        ).fetchone()
        forecast_payload = None
        forecast_status = "not_calculated"
        if forecast_row:
            row, components, events = load_forecast_details(con, int(forecast_row["id"]))
            current_hash = forecast_source_state_hash(con, project_id, int(baseline["id"]))
            stale = current_hash != str(forecast_row["source_state_hash"])
            forecast_payload = serialize_forecast(row, components, events, is_stale=stale)
            forecast_status = "stale" if stale else "approved"
    handler.send_json(
        HTTPStatus.OK,
        {
            "status": "ready",
            "baseline": {"id": int(baseline["id"]), "versionNo": int(baseline["version_no"])},
            "current": {
                "contractRevenueNetKopecks": totals["contract_revenue"],
                "targetCostNetKopecks": totals["target_cost"],
                "committedTotalNetKopecks": totals["committed_total"],
                "remainingCommitmentNetKopecks": totals["remaining_commitment"],
                "actualCostNetKopecks": totals["actual_cost"],
            },
            "forecastStatus": forecast_status,
            "forecast": forecast_payload,
            "cashFlow": {
                "cashReceivedNetKopecks": cash["cash_received_net"],
                "cashReceivedVatKopecks": cash["cash_received_vat"],
                "cashReceivedGrossKopecks": cash["cash_received_gross"],
                "cashPaidNetKopecks": cash["cash_paid_net"],
                "cashPaidVatKopecks": cash["cash_paid_vat"],
                "cashPaidGrossKopecks": cash["cash_paid_gross"],
                "cashBalanceGrossKopecks": cash["cash_balance_gross"],
            },
        },
    )
