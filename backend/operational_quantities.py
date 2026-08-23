from __future__ import annotations

import re


def _quantity_float(value: object) -> float:
    try:
        return float(str(value if value is not None else "0").replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def operational_quantity_plan(quantity: object, unit: object) -> dict:
    """Return a physical quantity in its base unit without changing price semantics.

    Estimate units such as ``100 м`` store a coefficient and must be displayed and
    compared as metres. Some legacy imports already contain the multiplied value;
    the same guard used by the frontend prevents multiplying those rows twice.
    """

    raw_quantity = max(0.0, _quantity_float(quantity))
    raw_unit = " ".join(str(unit or "").strip().split())
    numeric_only = re.fullmatch(r"(\d+(?:[\.,]\d+)?)", raw_unit)
    scaled = re.fullmatch(r"(\d+(?:[\.,]\d+)?)\s*(.+)", raw_unit)

    multiplier = 1.0
    base_unit = raw_unit or "шт"
    has_multiplier = False
    if numeric_only:
        multiplier = max(_quantity_float(numeric_only.group(1)), 1.0)
        base_unit = "шт"
        has_multiplier = multiplier != 1
    elif scaled:
        multiplier = max(_quantity_float(scaled.group(1)), 1.0)
        base_unit = scaled.group(2).strip() or "шт"
        has_multiplier = multiplier != 1

    coefficient = raw_quantity
    legacy_already_multiplied = bool(
        has_multiplier and multiplier >= 100 and raw_quantity >= multiplier
    )
    if legacy_already_multiplied:
        coefficient = raw_quantity / multiplier

    total = coefficient * multiplier
    return {
        "source_qty": raw_quantity,
        "coefficient_qty": coefficient,
        "total_qty": round(max(0.0, total), 9),
        "unit": base_unit,
        "source_unit": raw_unit,
        "multiplier": multiplier,
        "has_multiplier": has_multiplier,
        "legacy_already_multiplied": legacy_already_multiplied,
    }
