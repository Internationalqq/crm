"""Safely repair imported CRM estimate prices from an AutoBot ``rows.json``.

The command is a dry-run unless ``--apply`` is passed.  It never changes the
source JSON.  Matching is intentionally conservative: the active CRM rows and
the source rows must have the same count and the same article/basis code in the
same order.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sqlite3
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Sequence


AUDIT_ACTION = "repair_estimate_price_from_autobot_rows"
MONEY_TOLERANCE = Decimal("0.005")
REQUIRED_AUDIT_COLUMNS = {
    "user_id",
    "action",
    "entity",
    "entity_id",
    "payload",
    "created_at",
}
REQUIRED_ESTIMATE_COLUMNS = {
    "id",
    "project_id",
    "planned_qty",
    "planned_price",
    "article",
}


class RepairError(ValueError):
    """A validation error that makes the repair unsafe to run."""


def _normalized_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def _normalized_code(value: object) -> str:
    return _normalized_text(value).casefold()


def _decimal(value: object, *, label: str, allow_zero: bool = True) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise RepairError(f"{label} must be a finite number")
    if isinstance(value, str):
        raw = value.replace("\xa0", " ").replace(" ", "").strip()
        if "," in raw and "." not in raw:
            raw = raw.replace(",", ".")
    else:
        raw = str(value)
    try:
        number = Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise RepairError(f"{label} must be a finite number") from exc
    if not number.is_finite() or number < 0 or (not allow_zero and number == 0):
        condition = "a positive finite number" if not allow_zero else "a non-negative finite number"
        raise RepairError(f"{label} must be {condition}")
    return number


def _json_number(value: Decimal) -> int | float:
    if value == value.to_integral_value():
        return int(value)
    number = float(value)
    if not math.isfinite(number):
        raise RepairError("A calculated value cannot be represented in SQLite REAL")
    return number


def _json_scalar(value: object) -> object:
    """Keep source labels intact while making numeric JSON tokens serializable."""
    return _json_number(value) if isinstance(value, Decimal) else value


def _parse_json_bytes(raw: bytes, path: Path) -> Any:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise RepairError(f"{path} is not UTF-8 JSON") from exc

    def reject_constant(value: str) -> None:
        raise RepairError(f"{path} contains non-finite JSON number {value}")

    try:
        return json.loads(
            text,
            parse_float=Decimal,
            parse_int=Decimal,
            parse_constant=reject_constant,
        )
    except json.JSONDecodeError as exc:
        raise RepairError(f"Cannot parse {path}: {exc}") from exc


def _row_code(row: dict, position: int) -> str:
    for key in ("basis_code", "code", "article"):
        if key in row and _normalized_text(row.get(key)):
            return _normalized_text(row.get(key))
    raise RepairError(f"rows.json row {position} has no basis_code/code/article")


def _load_source_rows(path: Path) -> tuple[list[dict], bytes, str]:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise RepairError(f"Cannot read rows.json at {path}: {exc}") from exc
    data = _parse_json_bytes(raw, path)
    if not isinstance(data, list):
        raise RepairError("rows.json root must be an array")
    if not data:
        raise RepairError("rows.json contains no estimate rows")

    rows: list[dict] = []
    for index, source in enumerate(data, start=1):
        if not isinstance(source, dict):
            raise RepairError(f"rows.json row {index} must be an object")
        if "total" not in source:
            raise RepairError(f"rows.json row {index} has no total")
        raw_total = source.get("total")
        total_missing = raw_total in (None, "")
        if total_missing and source.get("unit_price") not in (None, ""):
            raise RepairError(
                f"rows.json row {index} has a unit_price but no total"
            )
        rows.append(
            {
                "raw": source,
                "position": index,
                "basis_code": _row_code(source, index),
                "total": None if total_missing else _decimal(raw_total, label=f"rows.json row {index} total"),
                "item_no": _json_scalar(source.get("item_no")),
            }
        )
    return rows, raw, hashlib.sha256(raw).hexdigest()


def _identifier(value: object) -> str | None:
    text = _normalized_text(value)
    if not text:
        return None
    if not re.fullmatch(r"[A-Za-z0-9-]{1,80}", text):
        raise RepairError(f"Unsafe estimate id value: {text!r}")
    return text


def _source_estimate_identity(rows_path: Path, rows: list[dict]) -> tuple[str | None, list[str]]:
    candidates: list[tuple[str, str]] = []
    meta_path = rows_path.with_name("meta.json")
    if meta_path.is_file():
        meta_raw = meta_path.read_bytes()
        meta = _parse_json_bytes(meta_raw, meta_path)
        if not isinstance(meta, dict):
            raise RepairError(f"{meta_path} root must be an object")
        for key in ("estimate_id", "estimateId", "id"):
            if key in meta and meta.get(key) not in (None, ""):
                candidates.append((f"meta.json:{key}", _identifier(meta.get(key)) or ""))
                break

    row_ids = {
        candidate
        for row in rows
        for key in ("estimate_id", "estimateId")
        if (candidate := _identifier(row["raw"].get(key))) is not None
    }
    if len(row_ids) > 1:
        raise RepairError("rows.json contains more than one estimate id")
    if row_ids:
        candidates.append(("rows.json", next(iter(row_ids))))

    # AutoBot currently creates 16-character hexadecimal estimate directories.
    # Restrict this fallback to that exact format so an arbitrary temp folder is
    # not mistaken for a source identity.
    if rows_path.name.casefold() == "rows.json" and re.fullmatch(r"[0-9a-fA-F]{16}", rows_path.parent.name):
        candidates.append(("rows.json parent", rows_path.parent.name))

    distinct = {value.casefold() for _, value in candidates if value}
    if len(distinct) > 1:
        evidence = ", ".join(f"{source}={value}" for source, value in candidates)
        raise RepairError(f"Conflicting AutoBot estimate ids: {evidence}")
    return (candidates[0][1] if candidates else None), [source for source, _ in candidates]


def _table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone() is not None


def _table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    return {str(row["name"]) for row in connection.execute(f"PRAGMA table_info({table})")}


def _require_schema(connection: sqlite3.Connection) -> tuple[set[str], set[str]]:
    for table in ("projects", "estimate_items", "audit_log"):
        if not _table_exists(connection, table):
            raise RepairError(f"Database has no required table {table}")
    project_columns = _table_columns(connection, "projects")
    if "id" not in project_columns:
        raise RepairError("projects table has no id column")
    estimate_columns = _table_columns(connection, "estimate_items")
    missing_estimate = REQUIRED_ESTIMATE_COLUMNS - estimate_columns
    if missing_estimate:
        raise RepairError(
            "estimate_items is missing required columns: " + ", ".join(sorted(missing_estimate))
        )
    audit_columns = _table_columns(connection, "audit_log")
    missing_audit = REQUIRED_AUDIT_COLUMNS - audit_columns
    if missing_audit:
        raise RepairError("audit_log is missing required columns: " + ", ".join(sorted(missing_audit)))
    return project_columns, estimate_columns


def _project_identity(project: dict) -> tuple[str | None, list[str]]:
    candidates: list[tuple[str, str]] = []
    contract_no = _normalized_text(project.get("contract_no"))
    contract_match = re.search(r"(?:^|\b)ESTIMATE-([A-Za-z0-9-]+)", contract_no, re.IGNORECASE)
    if contract_match:
        candidates.append(("projects.contract_no", contract_match.group(1)))
    description = _normalized_text(project.get("description"))
    description_match = re.search(r"/estimates/([A-Za-z0-9-]+)", description, re.IGNORECASE)
    if description_match:
        candidates.append(("projects.description", description_match.group(1)))
    distinct = {value.casefold() for _, value in candidates}
    if len(distinct) > 1:
        evidence = ", ".join(f"{source}={value}" for source, value in candidates)
        raise RepairError(f"Project contains conflicting estimate ids: {evidence}")
    return (candidates[0][1] if candidates else None), [source for source, _ in candidates]


def _estimate_scope(
    connection: sqlite3.Connection,
    project_id: int,
    estimate_columns: set[str],
    expected_estimate_id: str | None,
) -> dict | None:
    if "estimate_source_id" not in estimate_columns or not _table_exists(connection, "project_estimates"):
        return None
    source_columns = _table_columns(connection, "project_estimates")
    required = {"id", "project_id"}
    if not required.issubset(source_columns):
        raise RepairError("project_estimates table is missing id/project_id")
    estimates = [
        dict(row)
        for row in connection.execute(
            "SELECT * FROM project_estimates WHERE project_id = ? ORDER BY id",
            (project_id,),
        )
    ]
    if not estimates:
        return None

    if expected_estimate_id:
        expected = expected_estimate_id.casefold()
        matches = [
            row
            for row in estimates
            if any(
                _normalized_text(row.get(key)).casefold() == expected
                for key in ("external_id", "source_key")
                if key in source_columns
            )
        ]
        if len(matches) > 1:
            raise RepairError(f"More than one project estimate matches id {expected_estimate_id}")
        if matches:
            return matches[0]

    if len(estimates) != 1:
        raise RepairError(
            f"Project {project_id} has {len(estimates)} estimates and rows.json cannot be scoped safely"
        )
    only = estimates[0]
    external_id = _normalized_text(only.get("external_id")) if "external_id" in source_columns else ""
    if expected_estimate_id and external_id and external_id.casefold() != expected_estimate_id.casefold():
        raise RepairError(
            f"Project estimate id mismatch: CRM={external_id}, rows.json={expected_estimate_id}"
        )
    return only


def _find_project(connection: sqlite3.Connection, project_id: int) -> dict:
    row = connection.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if row is None:
        raise RepairError(f"Project {project_id} was not found")
    return dict(row)


def _active_estimate_rows(
    connection: sqlite3.Connection,
    project_id: int,
    estimate_columns: set[str],
    scope: dict | None,
) -> list[dict]:
    conditions = ["project_id = ?"]
    params: list[object] = [project_id]
    if "is_deleted" in estimate_columns:
        conditions.append("COALESCE(is_deleted, 0) = 0")
    if scope is not None:
        conditions.append("estimate_source_id = ?")
        params.append(int(scope["id"]))
    sql = "SELECT * FROM estimate_items WHERE " + " AND ".join(conditions) + " ORDER BY id"
    return [dict(row) for row in connection.execute(sql, params)]


def _public_change(change: dict) -> dict:
    return {key: value for key, value in change.items() if not key.startswith("_")}


def _build_plan(crm_rows: list[dict], source_rows: list[dict]) -> tuple[list[dict], dict]:
    if len(crm_rows) != len(source_rows):
        raise RepairError(
            f"Estimate row count mismatch: CRM={len(crm_rows)}, rows.json={len(source_rows)}"
        )

    changes: list[dict] = []
    crm_before = Decimal(0)
    crm_after = Decimal(0)
    source_total = Decimal(0)
    for crm, source in zip(crm_rows, source_rows):
        position = int(source["position"])
        crm_code = _normalized_text(crm.get("article"))
        source_code = str(source["basis_code"])
        if not crm_code:
            raise RepairError(f"CRM estimate item {crm['id']} at position {position} has no article")
        if _normalized_code(crm_code) != _normalized_code(source_code):
            raise RepairError(
                f"Estimate order/article mismatch at position {position}: "
                f"CRM id {crm['id']} article={crm_code!r}, rows.json basis_code={source_code!r}"
            )

        qty = _decimal(crm.get("planned_qty"), label=f"CRM item {crm['id']} planned_qty", allow_zero=False)
        old_price = _decimal(crm.get("planned_price"), label=f"CRM item {crm['id']} planned_price")
        total = source["total"]
        current_line_total = qty * old_price
        if total is None:
            if abs(current_line_total) > MONEY_TOLERANCE:
                raise RepairError(
                    f"rows.json row {position} has no total, but CRM item {crm['id']} totals "
                    f"{current_line_total}"
                )
            total = Decimal(0)
        corrected_decimal = total / qty
        corrected_price = float(corrected_decimal)
        if not math.isfinite(corrected_price) or corrected_price < 0:
            raise RepairError(f"Corrected price for CRM item {crm['id']} is outside SQLite REAL range")
        stored_corrected = Decimal(str(corrected_price))
        projected_line_total = qty * stored_corrected

        crm_before += current_line_total
        source_total += total
        if abs(current_line_total - total) > MONEY_TOLERANCE:
            change = {
                "position": position,
                "estimate_item_id": int(crm["id"]),
                "article": crm_code,
                "basis_code": source_code,
                "item_no": source.get("item_no"),
                "before": {
                    "planned_qty": _json_number(qty),
                    "planned_price": _json_number(old_price),
                    "line_total": _json_number(current_line_total),
                },
                "after": {
                    "planned_qty": _json_number(qty),
                    "planned_price": corrected_price,
                    "line_total": _json_number(projected_line_total),
                },
                "source_total": _json_number(total),
                "difference_before": _json_number(current_line_total - total),
                "_new_price": corrected_price,
            }
            changes.append(change)
            crm_after += projected_line_total
        else:
            crm_after += current_line_total

    totals = {
        "rows": len(crm_rows),
        "changed_rows": len(changes),
        "crm_before": _json_number(crm_before),
        "source": _json_number(source_total),
        "crm_after": _json_number(crm_after),
        "difference_before": _json_number(crm_before - source_total),
        "difference_after": _json_number(crm_after - source_total),
    }
    return changes, totals


def _connect(database: Path, *, readonly: bool) -> sqlite3.Connection:
    if readonly:
        connection = sqlite3.connect(
            database.as_uri() + "?mode=ro",
            uri=True,
            timeout=30,
            isolation_level=None,
        )
        connection.execute("PRAGMA query_only = ON")
    else:
        connection = sqlite3.connect(database, timeout=30, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 30000")
    return connection


def _next_backup_path(database: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    base = database.with_name(f"{database.name}.before-autobot-rows-price-repair-{stamp}.bak")
    candidate = base
    counter = 1
    while candidate.exists():
        candidate = base.with_name(f"{base.name}.{counter}")
        counter += 1
    return candidate


def _backup_database(database: Path) -> Path:
    backup = _next_backup_path(database)
    source = _connect(database, readonly=True)
    target = sqlite3.connect(backup)
    try:
        source.backup(target)
    except Exception:
        target.close()
        source.close()
        if backup.exists():
            backup.unlink()
        raise
    else:
        target.close()
        source.close()
    check = sqlite3.connect(backup)
    try:
        result = check.execute("PRAGMA quick_check").fetchone()
        if result is None or str(result[0]).casefold() != "ok":
            raise RepairError(f"SQLite backup validation failed for {backup}")
    finally:
        check.close()
    return backup


def _inspect(
    connection: sqlite3.Connection,
    project_id: int,
    source_rows: list[dict],
    source_estimate_id: str | None,
) -> tuple[dict, dict | None, list[dict], dict, str | None, list[str]]:
    _, estimate_columns = _require_schema(connection)
    project = _find_project(connection, project_id)
    project_estimate_id, project_evidence = _project_identity(project)
    if (
        source_estimate_id
        and project_estimate_id
        and source_estimate_id.casefold() != project_estimate_id.casefold()
    ):
        raise RepairError(
            f"Estimate id mismatch: project={project_estimate_id}, rows.json={source_estimate_id}"
        )
    expected_estimate_id = source_estimate_id or project_estimate_id
    scope = _estimate_scope(connection, project_id, estimate_columns, expected_estimate_id)
    crm_rows = _active_estimate_rows(connection, project_id, estimate_columns, scope)
    changes, totals = _build_plan(crm_rows, source_rows)
    return project, scope, changes, totals, project_estimate_id, project_evidence


def _insert_audit(
    connection: sqlite3.Connection,
    project_id: int,
    change: dict,
    source: dict,
    created_at: int,
) -> None:
    payload = {
        "project_id": project_id,
        "before": change["before"],
        "after": change["after"],
        "source": {
            **source,
            "position": change["position"],
            "item_no": change.get("item_no"),
            "basis_code": change["basis_code"],
            "total": change["source_total"],
        },
    }
    connection.execute(
        """
        INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
        VALUES (NULL, ?, 'estimate_item', ?, ?, ?)
        """,
        (
            AUDIT_ACTION,
            int(change["estimate_item_id"]),
            json.dumps(payload, ensure_ascii=False, sort_keys=True),
            created_at,
        ),
    )


def repair_estimate_prices(
    database: Path | str,
    project_id: int,
    rows_json: Path | str,
    *,
    apply: bool = False,
) -> dict:
    """Inspect or apply a price-only repair and return its JSON-ready report."""

    if isinstance(project_id, bool) or int(project_id) <= 0:
        raise RepairError("project-id must be a positive integer")
    project_id = int(project_id)
    database_path = Path(database).expanduser().resolve()
    rows_path = Path(rows_json).expanduser().resolve()
    if not database_path.is_file():
        raise RepairError(f"SQLite database was not found: {database_path}")
    if not rows_path.is_file():
        raise RepairError(f"rows.json was not found: {rows_path}")

    source_rows, source_bytes, source_sha256 = _load_source_rows(rows_path)
    source_estimate_id, source_identity_evidence = _source_estimate_identity(rows_path, source_rows)
    connection = _connect(database_path, readonly=not apply)
    backup: Path | None = None
    try:
        if apply:
            connection.execute("BEGIN IMMEDIATE")
            if hashlib.sha256(rows_path.read_bytes()).hexdigest() != source_sha256:
                raise RepairError("rows.json changed while the repair was starting")
        project, scope, changes, totals, project_estimate_id, project_identity_evidence = _inspect(
            connection,
            project_id,
            source_rows,
            source_estimate_id,
        )

        source_audit = {
            "kind": "autobot_rows_json",
            "path": str(rows_path),
            "sha256": source_sha256,
            "estimate_id": source_estimate_id or project_estimate_id,
        }
        if apply:
            backup = _backup_database(database_path)
            created_at = int(datetime.now(timezone.utc).timestamp())
            for change in changes:
                cursor = connection.execute(
                    "UPDATE estimate_items SET planned_price = ? WHERE id = ? AND project_id = ?",
                    (change["_new_price"], change["estimate_item_id"], project_id),
                )
                if cursor.rowcount != 1:
                    raise RepairError(
                        f"Concurrent change detected for estimate item {change['estimate_item_id']}"
                    )
                _insert_audit(connection, project_id, change, source_audit, created_at)
            if rows_path.read_bytes() != source_bytes:
                raise RepairError("rows.json changed during the repair; database changes were rolled back")
            connection.commit()

        scope_result = None
        if scope is not None:
            scope_result = {
                "id": int(scope["id"]),
                "external_id": scope.get("external_id"),
                "source_key": scope.get("source_key"),
                "title": scope.get("title"),
            }
        return {
            "ok": True,
            "mode": "apply" if apply else "dry-run",
            "project": {
                "id": project_id,
                "title": project.get("title"),
                "contract_no": project.get("contract_no"),
                "budget": project.get("budget"),
                "estimate_id": project_estimate_id,
            },
            "estimate": scope_result,
            "source": {
                "path": str(rows_path),
                "sha256": source_sha256,
                "estimate_id": source_estimate_id,
                "identity_evidence": source_identity_evidence,
                "project_identity_evidence": project_identity_evidence,
            },
            "totals": totals,
            "changes": [_public_change(change) for change in changes],
            "backup": str(backup) if backup is not None else None,
        }
    except Exception:
        if apply and connection.in_transaction:
            connection.rollback()
        raise
    finally:
        connection.close()


def _positive_project_id(value: str) -> int:
    try:
        project_id = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if project_id <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return project_id


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Repair CRM planned_price values from AutoBot rows.json totals (dry-run by default)."
    )
    parser.add_argument("--database", required=True, type=Path, help="Path to the CRM SQLite database")
    parser.add_argument("--project-id", required=True, type=_positive_project_id, help="CRM project id")
    parser.add_argument("--rows-json", required=True, type=Path, help="Path to AutoBot rows.json")
    parser.add_argument("--apply", action="store_true", help="Create a backup and apply the repair")
    args = parser.parse_args(argv)
    try:
        result = repair_estimate_prices(
            args.database,
            args.project_id,
            args.rows_json,
            apply=args.apply,
        )
    except (RepairError, OSError, sqlite3.Error) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
