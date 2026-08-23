from __future__ import annotations

import sqlite3
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def _kopecks(value: object) -> int:
    try:
        amount = Decimal(str(value or 0)) * Decimal("100")
    except (InvalidOperation, TypeError, ValueError):
        return 0
    return int(amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def approved_procurement_limit_map(
    con: sqlite3.Connection,
    project_id: int,
) -> dict[int, dict]:
    """Return approved direct-cost ceilings grouped by estimate position."""
    rows = con.execute(
        """
        SELECT baseline.id AS baseline_id, baseline.version_no,
               line.id AS budget_line_id, line.estimate_item_id,
               line.net_amount_kopecks, line.quantity, line.unit
        FROM project_financial_baselines baseline
        JOIN project_budget_lines line ON line.baseline_id = baseline.id
        WHERE baseline.project_id = ?
          AND baseline.status = 'approved'
          AND line.line_type = 'direct_cost'
          AND line.estimate_item_id IS NOT NULL
        ORDER BY line.position, line.id
        """,
        (project_id,),
    ).fetchall()
    result: dict[int, dict] = {}
    for row in rows:
        item_id = int(row["estimate_item_id"])
        item = result.setdefault(
            item_id,
            {
                "baseline_id": int(row["baseline_id"]),
                "baseline_version": int(row["version_no"]),
                "budget_line_ids": [],
                "limit_net_kopecks": 0,
                "quantity": 0.0,
                "units": set(),
            },
        )
        item["budget_line_ids"].append(int(row["budget_line_id"]))
        item["limit_net_kopecks"] += int(row["net_amount_kopecks"])
        if row["quantity"] is not None:
            item["quantity"] += float(row["quantity"])
        unit = str(row["unit"] or "").strip()
        if unit:
            item["units"].add(unit)

    for item in result.values():
        quantity = float(item["quantity"] or 0)
        item["unit"] = next(iter(item["units"])) if len(item["units"]) == 1 else None
        item["unit_limit_net_kopecks"] = (
            int(
                (Decimal(item["limit_net_kopecks"]) / Decimal(str(quantity))).quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            )
            if quantity > 0
            else None
        )
        item.pop("units", None)
    return result


def evaluate_procurement_limit(
    limit: dict | None,
    unit_price: object | None,
    quantity: object | None,
) -> dict:
    if not limit:
        return {"configured": False, "status": "not_configured"}

    payload = {
        "configured": True,
        "status": "awaiting_offer",
        "baselineId": int(limit["baseline_id"]),
        "baselineVersion": int(limit["baseline_version"]),
        "budgetLineIds": list(limit["budget_line_ids"]),
        "limitNetKopecks": int(limit["limit_net_kopecks"]),
        "limitQuantity": float(limit["quantity"] or 0),
        "unit": limit.get("unit"),
        "unitLimitNetKopecks": limit.get("unit_limit_net_kopecks"),
        "offerAmountKopecks": None,
        "varianceKopecks": None,
        "overrunKopecks": 0,
        "reasonHint": None,
    }
    if unit_price is None:
        return payload
    try:
        quantity_value = float(quantity or 0)
        price_value = Decimal(str(unit_price))
    except (InvalidOperation, TypeError, ValueError):
        return payload
    if quantity_value <= 0 or price_value < 0:
        return payload

    offer_amount = _kopecks(price_value * Decimal(str(quantity_value)))
    variance = int(limit["limit_net_kopecks"]) - offer_amount
    payload.update(
        {
            "status": "exceeded" if variance < 0 else "within_limit",
            "offerAmountKopecks": offer_amount,
            "varianceKopecks": variance,
            "overrunKopecks": max(0, -variance),
            "offerQuantity": quantity_value,
        }
    )
    limit_quantity = float(limit["quantity"] or 0)
    if variance < 0:
        payload["reasonHint"] = (
            "additional_volume"
            if limit_quantity > 0 and quantity_value > limit_quantity
            else "price_over_limit"
        )
    return payload


def procurement_limit_check(
    con: sqlite3.Connection,
    project_id: int,
    estimate_item_id: int | None,
    unit_price: object | None,
    quantity: object | None,
) -> dict:
    if not estimate_item_id:
        return {"configured": False, "status": "not_configured"}
    limit = approved_procurement_limit_map(con, project_id).get(int(estimate_item_id))
    return evaluate_procurement_limit(limit, unit_price, quantity)

