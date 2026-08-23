from __future__ import annotations

import json
import sqlite3
from http import HTTPStatus

import economics


def _return_reason(handler) -> str | None:
    payload = handler.read_json()
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "reason_required"})
        return None
    return reason


def _return_pending(
    handler,
    path: str,
    *,
    table: str,
    id_column: str,
    not_found_error: str,
    not_pending_error: str,
    entity: str,
    audit_action: str,
    event_table: str | None,
    event_fk: str | None,
) -> None:
    entity_id = economics.parse_path_int(path, 2)
    if not entity_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": f"bad_{entity}_id"})
        return
    with economics.db() as con:
        row = con.execute(
            f"SELECT * FROM {table} WHERE {id_column} = ?", (entity_id,)
        ).fetchone()
        if not row:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": not_found_error})
            return
        user = economics.require_economics_access(
            handler, int(row["project_id"]), manage=True
        )
        if not user:
            return
        reason = _return_reason(handler)
        if reason is None:
            return
        timestamp = economics.now_ts()
        con.execute("BEGIN IMMEDIATE")
        row = con.execute(
            f"SELECT * FROM {table} WHERE {id_column} = ?", (entity_id,)
        ).fetchone()
        if not row or row["status"] != "pending_approval":
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": not_pending_error})
            return
        updated = con.execute(
            f"""
            UPDATE {table}
            SET status = 'draft', submitted_by = NULL, submitted_at = NULL,
                updated_at = ?
            WHERE {id_column} = ? AND status = 'pending_approval'
            """,
            (timestamp, entity_id),
        )
        if updated.rowcount != 1:
            con.rollback()
            handler.send_json(HTTPStatus.CONFLICT, {"error": not_pending_error})
            return
        if event_table and event_fk:
            con.execute(
                f"""
                INSERT INTO {event_table} (
                    {event_fk}, project_id, action, actor_id, details, created_at
                ) VALUES (?, ?, 'updated', ?, ?, ?)
                """,
                (
                    entity_id,
                    int(row["project_id"]),
                    int(user["id"]),
                    json.dumps(
                        {"workflowAction": "returned", "reason": reason},
                        ensure_ascii=False,
                    ),
                    timestamp,
                ),
            )
        economics.create_audit(
            con,
            int(user["id"]),
            audit_action,
            entity_id,
            {"project_id": int(row["project_id"]), "reason": reason},
            entity=entity,
        )
        con.commit()
    handler.send_json(
        HTTPStatus.OK,
        {"id": entity_id, "status": "draft", "returnReason": reason},
    )


def api_return_commitment(handler, path: str) -> None:
    _return_pending(
        handler,
        path,
        table="project_commitments",
        id_column="id",
        not_found_error="commitment_not_found",
        not_pending_error="commitment_not_pending",
        entity="project_commitment",
        audit_action="return_project_commitment",
        event_table="project_commitment_events",
        event_fk="commitment_id",
    )


def api_return_actual_cost(handler, path: str) -> None:
    _return_pending(
        handler,
        path,
        table="project_actual_cost_entries",
        id_column="id",
        not_found_error="actual_cost_not_found",
        not_pending_error="actual_cost_not_pending",
        entity="project_actual_cost",
        audit_action="return_project_actual_cost",
        event_table="project_actual_cost_events",
        event_fk="actual_cost_entry_id",
    )


def api_return_payment_allocation(handler, path: str) -> None:
    _return_pending(
        handler,
        path,
        table="project_payment_allocations",
        id_column="id",
        not_found_error="payment_allocation_not_found",
        not_pending_error="payment_allocation_not_pending",
        entity="project_payment_allocation",
        audit_action="return_project_payment_allocation",
        event_table="project_payment_allocation_events",
        event_fk="payment_allocation_id",
    )


def api_return_project_forecast(handler, path: str) -> None:
    # Forecast events intentionally remain a record of calculations/submissions/
    # approvals. A return is a review decision and is captured in audit_log.
    _return_pending(
        handler,
        path,
        table="project_forecasts",
        id_column="id",
        not_found_error="forecast_not_found",
        not_pending_error="forecast_not_pending",
        entity="project_forecast",
        audit_action="return_project_forecast",
        event_table=None,
        event_fk=None,
    )


def api_project_forecasts(handler, path: str) -> None:
    project_id = economics.parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = economics.require_economics_access(handler, project_id, manage=False)
    if not user:
        return
    with economics.db() as con:
        rows = con.execute(
            """
            SELECT id FROM project_forecasts
            WHERE project_id = ? ORDER BY version_no DESC, id DESC
            """,
            (project_id,),
        ).fetchall()
        current_baseline = con.execute(
            """
            SELECT id FROM project_financial_baselines
            WHERE project_id = ? AND status = 'approved'
            """,
            (project_id,),
        ).fetchone()
        returned_events: dict[int, list[dict]] = {}
        for event in con.execute(
            """
            SELECT log.id, log.entity_id AS forecast_id, log.user_id AS actor_id,
                   actor.name AS actor_name, log.payload AS details,
                   log.created_at
            FROM audit_log log
            JOIN project_forecasts forecast ON forecast.id = log.entity_id
            LEFT JOIN users actor ON actor.id = log.user_id
            WHERE log.entity = 'project_forecast'
              AND log.action = 'return_project_forecast'
              AND forecast.project_id = ?
            ORDER BY log.created_at, log.id
            """,
            (project_id,),
        ).fetchall():
            returned_events.setdefault(int(event["forecast_id"]), []).append(
                {
                    # Negative IDs keep this audit-backed event distinct from
                    # immutable project_forecast_events without changing that
                    # table's historical CHECK constraint.
                    "id": -int(event["id"]),
                    "action": "returned",
                    "actor_id": int(event["actor_id"]),
                    "actor_name": str(event["actor_name"] or ""),
                    "details": event["details"] or "{}",
                    "created_at": int(event["created_at"]),
                }
            )
        forecasts = []
        for id_row in rows:
            row, components, events = economics.load_forecast_details(
                con, int(id_row["id"])
            )
            events = list(events) + returned_events.get(int(id_row["id"]), [])
            events.sort(key=lambda event: (int(event["created_at"]), int(event["id"])))
            is_stale = True
            if current_baseline and int(row["baseline_id"]) == int(current_baseline["id"]):
                try:
                    is_stale = (
                        economics.forecast_source_state_hash(
                            con, project_id, int(row["baseline_id"])
                        )
                        != str(row["source_state_hash"])
                    )
                except economics.ForecastCalculationError:
                    is_stale = True
            forecasts.append(
                economics.serialize_forecast(
                    row, components, events, is_stale=is_stale
                )
            )
    handler.send_json(
        HTTPStatus.OK,
        {
            "forecasts": forecasts,
            "summary": {
                "count": len(forecasts),
                "approvedCount": sum(
                    item["status"] == "approved" for item in forecasts
                ),
                "pendingCount": sum(
                    item["status"] == "pending_approval" for item in forecasts
                ),
                "staleCount": sum(bool(item["isStale"]) for item in forecasts),
            },
        },
    )


def api_project_forecast_price_sources(handler, path: str) -> None:
    """List persisted AutoBot snapshots usable by forecast normalization.

    This endpoint never starts a new market analysis. It exposes only already
    persisted evidence so the forecast form can submit stable source IDs.
    """
    project_id = economics.parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = economics.require_economics_access(handler, project_id, manage=False)
    if not user:
        return
    with economics.db() as con:
        rows = con.execute(
            """
            SELECT snapshot.*
            FROM market_price_snapshots snapshot
            WHERE snapshot.project_id = ? AND snapshot.estimate_item_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM market_price_snapshots newer
                  WHERE newer.project_id = snapshot.project_id
                    AND newer.estimate_item_id = snapshot.estimate_item_id
                    AND (
                        newer.analyzed_at > snapshot.analyzed_at
                        OR (
                            newer.analyzed_at = snapshot.analyzed_at
                            AND newer.id > snapshot.id
                        )
                    )
              )
            ORDER BY snapshot.estimate_item_title, snapshot.id
            """,
            (project_id,),
        ).fetchall()
    handler.send_json(
        HTTPStatus.OK,
        {
            "marketSnapshots": [
                {
                    "id": int(row["id"]),
                    "estimateItemId": int(row["estimate_item_id"]),
                    "title": str(row["estimate_item_title"]),
                    "itemKind": str(row["item_kind"]),
                    "price": float(row["price"]),
                    "sourceName": str(row["source_name"]),
                    "sourceUrl": str(row["source_url"] or ""),
                    "estimateVersion": str(row["estimate_version"] or ""),
                    "analyzedAt": int(row["analyzed_at"]),
                }
                for row in rows
            ]
        },
    )


def _normalized_commitment_lines(
    con: sqlite3.Connection,
    commitment: sqlite3.Row,
    lines_payload: object,
) -> list[dict]:
    if not isinstance(lines_payload, list) or not lines_payload:
        raise ValueError("commitment_lines_required")
    result = []
    for item in lines_payload:
        if not isinstance(item, dict):
            raise ValueError("bad_commitment_line")
        try:
            budget_line_id = economics.optional_positive_int(
                economics.payload_value(item, "budgetLineId", "budget_line_id")
            )
            estimate_item_id = economics.optional_positive_int(
                economics.payload_value(item, "estimateItemId", "estimate_item_id")
            )
            vat_rate = int(
                economics.payload_value(
                    item, "vatRateBasisPoints", "vat_rate_basis_points", 0
                )
                or 0
            )
        except (TypeError, ValueError) as exc:
            raise ValueError("bad_commitment_line") from exc
        if budget_line_id is None:
            raise ValueError("commitment_budget_mapping_required")
        budget_line = con.execute(
            """
            SELECT estimate_item_id FROM project_budget_lines
            WHERE id = ? AND baseline_id = ? AND line_type = 'direct_cost'
            """,
            (budget_line_id, commitment["baseline_id"]),
        ).fetchone()
        if not budget_line:
            raise ValueError("commitment_budget_mapping_required")
        mapped_estimate_id = budget_line["estimate_item_id"]
        if estimate_item_id is not None and mapped_estimate_id is not None:
            if int(estimate_item_id) != int(mapped_estimate_id):
                raise ValueError("commitment_budget_mapping_required")
        if estimate_item_id is None and mapped_estimate_id is not None:
            estimate_item_id = int(mapped_estimate_id)
        title = str(item.get("title", "")).strip()
        source_reference = str(
            economics.payload_value(item, "sourceReference", "source_reference", "")
        ).strip()
        if not title or not source_reference:
            raise ValueError("commitment_line_title_and_source_required")
        vat_mode = str(
            economics.payload_value(item, "vatMode", "vat_mode", "")
        ).strip()
        amounts = economics.normalize_offer_amounts(
            economics.payload_value(item, "unitPrice", "unit_price"),
            item.get("quantity"),
            vat_mode,
            vat_rate,
        )
        unit = str(item.get("unit", "")).strip() or None
        unit_issue = economics.operational_unit_issue(
            con, int(budget_line_id), unit
        )
        if unit_issue:
            raise ValueError(unit_issue)
        result.append(
            {
                "budget_line_id": budget_line_id,
                "estimate_item_id": estimate_item_id,
                "title": title,
                "unit": unit,
                "source_reference": source_reference,
                "vat_mode": vat_mode,
                "vat_rate": vat_rate,
                "amounts": amounts,
            }
        )
    return result


def api_replace_commitment_lines(handler, path: str) -> None:
    commitment_id = economics.parse_path_int(path, 2)
    if not commitment_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_commitment_id"})
        return
    payload = handler.read_json()
    with economics.db() as con:
        commitment = con.execute(
            "SELECT * FROM project_commitments WHERE id = ?", (commitment_id,)
        ).fetchone()
        if not commitment:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "commitment_not_found"})
            return
        user = economics.require_economics_access(
            handler, int(commitment["project_id"]), manage=True
        )
        if not user:
            return
        try:
            con.execute("BEGIN IMMEDIATE")
            commitment = con.execute(
                "SELECT * FROM project_commitments WHERE id = ?", (commitment_id,)
            ).fetchone()
            if not commitment or commitment["status"] != "draft":
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT, {"error": "commitment_not_editable"}
                )
                return
            lines = _normalized_commitment_lines(con, commitment, payload.get("lines"))
            commitment_no = str(
                payload.get(
                    "commitmentNo",
                    payload.get("commitment_no", commitment["commitment_no"] or ""),
                )
            ).strip() or None
            expected_date = str(
                payload.get(
                    "expectedDate",
                    payload.get("expected_date", commitment["expected_date"] or ""),
                )
            ).strip() or None
            reason = str(payload.get("reason", commitment["reason"])).strip()
            if not reason:
                raise ValueError("commitment_reason_required")
            timestamp = economics.now_ts()
            con.execute(
                "DELETE FROM project_commitment_lines WHERE commitment_id = ?",
                (commitment_id,),
            )
            for position, line in enumerate(lines, start=1):
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
                        commitment_id,
                        position,
                        line["budget_line_id"],
                        line["estimate_item_id"],
                        line["title"],
                        line["unit"],
                        amounts["quantity"],
                        amounts["source_unit_price_kopecks"],
                        amounts["unit_cost_net_kopecks"],
                        amounts["net_amount_kopecks"],
                        line["vat_rate"],
                        amounts["vat_amount_kopecks"],
                        amounts["gross_amount_kopecks"],
                        line["vat_mode"],
                        line["source_reference"],
                        int(user["id"]),
                        timestamp,
                    ),
                )
            con.execute(
                """
                UPDATE project_commitments
                SET commitment_no = ?, expected_date = ?, reason = ?, updated_at = ?
                WHERE id = ? AND status = 'draft'
                """,
                (commitment_no, expected_date, reason, timestamp, commitment_id),
            )
            economics.create_commitment_event(
                con,
                commitment_id,
                int(commitment["project_id"]),
                "updated",
                int(user["id"]),
                {
                    "workflowAction": "replace_lines_and_header",
                    "lineCount": len(lines),
                },
            )
            economics.create_audit(
                con,
                int(user["id"]),
                "replace_project_commitment_lines_and_header",
                commitment_id,
                {
                    "project_id": int(commitment["project_id"]),
                    "line_count": len(lines),
                },
                entity="project_commitment",
            )
            con.commit()
        except ValueError as exc:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
    handler.send_json(
        HTTPStatus.OK,
        {"id": commitment_id, "status": "draft", "lineCount": len(lines)},
    )
