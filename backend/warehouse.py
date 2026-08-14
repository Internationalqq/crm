from __future__ import annotations

import json
import re
import sqlite3
import time
import unicodedata
from datetime import date, timedelta
from http import HTTPStatus
from pathlib import Path

from auth import ROLE_LABELS, normalize_role, user_can_manage_suppliers


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
TODAY_ISO = date.today().isoformat()
FUZZY_MATCH_THRESHOLD = 0.70


def now_ts() -> int:
    return int(time.time())


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


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


def parse_path_int(path: str, index: int) -> int | None:
    parts = path.strip("/").split("/")
    try:
        return int(parts[index])
    except (IndexError, TypeError, ValueError):
        return None


def normalize_estimate_item_kind(value: object) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return "material"
    work_markers = ("work", "works", "service", "services", "labor", "labour", "job", "работ", "услуг", "труд")
    material_markers = ("material", "materials", "supply", "goods", "equipment", "матер", "товар", "оборуд")
    work_markers = work_markers + (
        "\u0440\u0430\u0431\u043e\u0442",
        "\u0443\u0441\u043b\u0443\u0433",
        "\u0442\u0440\u0443\u0434",
    )
    material_markers = material_markers + (
        "\u043c\u0430\u0442\u0435\u0440",
        "\u0442\u043e\u0432\u0430\u0440",
        "\u043e\u0431\u043e\u0440\u0443\u0434",
    )
    if any(marker in text for marker in work_markers):
        return "work"
    if any(marker in text for marker in material_markers):
        return "material"
    return "material"


def canonical_estimate_section_title(value: object) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text:
        return ""
    normalized = text.lower().replace("ё", "е")
    if normalized == "подготовка" or re.fullmatch(r"раздел\s*0?1\.?\s*подготовка", normalized):
        return "Раздел 1. Окна и фасад"
    return text


def normalize_fuzzy_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower().replace("ё", "е")
    text = re.sub(r"\bпровод\b", "кабель", text)
    text = re.sub(r"\bпровода\b", "кабель", text)
    text = re.sub(r"(?<=\d)[xх×](?=\d)", "x", text)
    text = re.sub(r"(?<=\d)[,.](?=\d)", ".", text)
    text = re.sub(r"[^0-9a-zа-я.]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def levenshtein_distance(left: str, right: str) -> int:
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for i, left_char in enumerate(left, 1):
        current = [i]
        for j, right_char in enumerate(right, 1):
            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + (0 if left_char == right_char else 1),
                )
            )
        previous = current
    return previous[-1]


def dice_coefficient(left: str, right: str) -> float:
    def bigrams(text: str) -> list[str]:
        compact = re.sub(r"\s+", "", text)
        if len(compact) < 2:
            return [compact] if compact else []
        return [compact[index : index + 2] for index in range(len(compact) - 1)]

    left_bigrams = bigrams(left)
    right_bigrams = bigrams(right)
    if not left_bigrams or not right_bigrams:
        return 0.0
    right_counts: dict[str, int] = {}
    for gram in right_bigrams:
        right_counts[gram] = right_counts.get(gram, 0) + 1
    overlap = 0
    for gram in left_bigrams:
        count = right_counts.get(gram, 0)
        if count:
            overlap += 1
            right_counts[gram] = count - 1
    return (2.0 * overlap) / (len(left_bigrams) + len(right_bigrams))


def fuzzy_similarity(left_value: object, right_value: object) -> float:
    left = normalize_fuzzy_text(left_value)
    right = normalize_fuzzy_text(right_value)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    if left in right or right in left:
        short = min(len(left), len(right))
        long = max(len(left), len(right))
        return max(0.82, short / long)
    lev = 1.0 - (levenshtein_distance(left, right) / max(len(left), len(right), 1))
    dice = dice_coefficient(left, right)
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    token_score = len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)
    return max(lev, dice, token_score)


def extract_labeled_note_value(notes: object, labels: tuple[str, ...]) -> str | None:
    text = str(notes or "").strip()
    if not text:
        return None
    normalized_labels = tuple(str(label).strip().lower() for label in labels if str(label).strip())
    for chunk in re.split(r"[;\n]+", text):
        part = chunk.strip()
        if not part:
            continue
        lowered = part.lower()
        for label in normalized_labels:
            colon_prefix = f"{label}:"
            if lowered.startswith(colon_prefix):
                value = part[len(colon_prefix):].strip()
                return value or None
            dash_prefix = f"{label} -"
            if lowered.startswith(dash_prefix):
                value = part[len(dash_prefix):].strip()
                return value or None
    return None


def payload_get(source: dict | sqlite3.Row | None, *keys: str) -> object:
    if not source:
        return None
    if isinstance(source, sqlite3.Row):
        row_keys = source.keys()
        for key in keys:
            if key in row_keys:
                return source[key]
        return None
    for key in keys:
        if key in source:
            return source.get(key)
    return None


def material_summary_rows(con: sqlite3.Connection, project_id: int) -> list[dict]:
    stage_rows = con.execute(
        """
        SELECT id, title, parent_id, stage_kind, position
        FROM work_stages
        WHERE project_id = ?
        ORDER BY position, id
        """,
        (project_id,),
    ).fetchall()
    stage_map = {int(row["id"]): row for row in stage_rows}

    def resolve_stage_root_title(stage_id: int | None) -> str | None:
        if not stage_id:
            return None
        current = stage_map.get(int(stage_id))
        root = None
        guard = 0
        while current and guard < 32:
            root = current
            parent_id = current["parent_id"]
            if not parent_id:
                break
            current = stage_map.get(int(parent_id))
            guard += 1
        return str(root["title"]).strip() if root and root["title"] else None

    rows = con.execute(
        """
        SELECT
            e.id,
            e.title,
            e.unit,
            e.planned_qty,
            e.planned_price,
            e.item_kind,
            e.section_title,
            e.article,
            e.procurement_status,
            e.warehouse_source,
            e.warehouse_item_id,
            e.delivery_days,
            e.need_by_date,
            e.notes,
            e.is_completed,
            e.actual_qty,
            e.stage_id,
            ws.title AS stage_title,
            ws.planned_start AS stage_planned_start,
            ws.planned_end AS stage_planned_end,
            COALESCE(SUM(CASE WHEN s.move_type = 'purchase' THEN s.qty ELSE 0 END), 0) AS purchased_qty,
            COALESCE(SUM(CASE WHEN s.move_type = 'receipt' THEN s.qty ELSE 0 END), 0) AS received_qty,
            COALESCE(SUM(CASE WHEN s.move_type = 'use' THEN s.qty ELSE 0 END), 0) AS used_qty
        FROM estimate_items e
        LEFT JOIN work_stages ws ON ws.id = e.stage_id
        LEFT JOIN stock_moves s ON s.estimate_item_id = e.id
        WHERE e.project_id = ?
        GROUP BY e.id
        ORDER BY e.id
        """,
        (project_id,),
    ).fetchall()
    items = []
    for row in rows:
        planned = float(row["planned_qty"])
        purchased = float(row["purchased_qty"])
        received = float(row["received_qty"])
        used = float(row["used_qty"])
        covered = max(purchased, received)
        stock_base = received if received else purchased
        stock = max(stock_base - used, 0)
        missing = max(planned - covered, 0)
        usage_progress = round(min(100, used / planned * 100), 1) if planned else 0
        purchase_progress = round(min(100, covered / planned * 100), 1) if planned else 0
        estimated_delivery_days = estimate_material_lead_days(
            {
                "title": row["title"],
                "notes": row["notes"],
                "unit": row["unit"],
                "planned_qty": planned,
                "planned_price": float(row["planned_price"] or 0),
            }
        )
        delivery_days = int(row["delivery_days"]) if row["delivery_days"] is not None else int(estimated_delivery_days)
        need_by_date = str(row["need_by_date"] or row["stage_planned_start"] or row["stage_planned_end"] or "")
        soon_threshold = (parse_iso_date(TODAY_ISO) + timedelta(days=13)).isoformat()
        if missing <= 0:
            supply_status = "in_stock"
            supply_label = "Есть в наличии"
        elif need_by_date and need_by_date < TODAY_ISO:
            supply_status = "required"
            supply_label = "Требуется"
        elif need_by_date and need_by_date <= soon_threshold:
            supply_status = "soon"
            supply_label = "Скоро потребуется"
        else:
            supply_status = "planned"
            supply_label = "Нужно запланировать"
        section_title = canonical_estimate_section_title(
            resolved_estimate_section_title(row) or resolve_stage_root_title(row["stage_id"]) or ""
        )
        items.append(
            {
                "id": row["id"],
                "title": row["title"],
                "itemKind": resolved_estimate_item_kind(row),
                "unit": row["unit"],
                "article": row["article"] or "",
                "plannedQty": planned,
                "plannedPrice": float(row["planned_price"] or 0),
                "purchasedQty": purchased,
                "receivedQty": received,
                "usedQty": used,
                "actualQty": float(row["actual_qty"] or 0),
                "isCompleted": bool(row["is_completed"]),
                "stockQty": stock,
                "missingQty": missing,
                "usageProgress": usage_progress,
                "purchaseProgress": purchase_progress,
                "needByDate": row["need_by_date"] or row["stage_planned_start"] or row["stage_planned_end"],
                "stageStartDate": row["stage_planned_start"],
                "stageEndDate": row["stage_planned_end"],
                "notes": row["notes"] or "",
                "procurementStatus": row["procurement_status"] or "",
                "warehouseSource": row["warehouse_source"] or "",
                "warehouseItemId": row["warehouse_item_id"],
                "deliveryDays": delivery_days,
                "estimatedDeliveryDays": int(estimated_delivery_days),
                "stageId": row["stage_id"],
                "stageTitle": row["stage_title"],
                "sectionTitle": section_title,
                "supplyStatus": supply_status,
                "supplyLabel": (row["procurement_status"] or supply_label) if row["warehouse_source"] else supply_label,
            }
        )
    return items


def serialize_warehouse_item(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "type": row["item_type"],
        "itemType": row["item_type"],
        "category": row["category"] or "",
        "name": row["name"],
        "sku": row["sku"] or "",
        "unit": row["unit"],
        "qty": float(row["qty"] or 0),
        "condition": row["condition_status"] or "",
        "conditionStatus": row["condition_status"] or "",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def warehouse_item_rows(con: sqlite3.Connection, *, only_available: bool = False) -> list[sqlite3.Row]:
    where = "WHERE qty > 0" if only_available else ""
    return con.execute(
        f"""
        SELECT id, item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at
        FROM warehouse_items
        {where}
        ORDER BY item_type, category, name, id
        """
    ).fetchall()


def warehouse_search_score(material: dict | sqlite3.Row, item: sqlite3.Row) -> float:
    material_article = str(payload_get(material, "article", "sku") or "").strip()
    item_sku = str(item["sku"] or "").strip()
    if material_article and item_sku and normalize_fuzzy_text(material_article) == normalize_fuzzy_text(item_sku):
        return 1.0
    title = payload_get(material, "title", "name") or ""
    return max(
        fuzzy_similarity(title, item["name"]),
        fuzzy_similarity(material_article, item_sku) if material_article and item_sku else 0.0,
    )


def best_warehouse_match(
    material: dict | sqlite3.Row,
    warehouse_items: list[sqlite3.Row],
    *,
    threshold: float = FUZZY_MATCH_THRESHOLD,
) -> dict | None:
    best_row = None
    best_score = 0.0
    for item in warehouse_items:
        if item["item_type"] != "material" or float(item["qty"] or 0) <= 0:
            continue
        score = warehouse_search_score(material, item)
        if score > best_score:
            best_score = score
            best_row = item
    if not best_row or best_score < threshold:
        return None
    payload = serialize_warehouse_item(best_row)
    payload["score"] = round(best_score, 3)
    return payload


def warehouse_matches_for_project(con: sqlite3.Connection, project_id: int) -> dict[int, dict]:
    warehouse_items = warehouse_item_rows(con, only_available=True)
    matches: dict[int, dict] = {}
    for material in material_summary_rows(con, project_id):
        if normalize_estimate_item_kind(material.get("itemKind")) == "work":
            continue
        if float(material.get("missingQty") or 0) <= 0 and not str(material.get("procurementStatus") or "").lower().startswith("куп"):
            continue
        match = best_warehouse_match(material, warehouse_items)
        if match:
            matches[int(material["id"])] = match
    return matches


def find_warehouse_receipt_target(
    con: sqlite3.Connection,
    *,
    item_type: str,
    name: str,
    unit: str,
    sku: str | None = None,
    warehouse_item_id: int | None = None,
) -> sqlite3.Row | None:
    if warehouse_item_id:
        row = con.execute(
            """
            SELECT id, item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at
            FROM warehouse_items
            WHERE id = ?
            """,
            (warehouse_item_id,),
        ).fetchone()
        if row:
            return row

    normalized_sku = normalize_fuzzy_text(sku or "")
    normalized_name = normalize_fuzzy_text(name)
    rows = warehouse_item_rows(con)
    if normalized_sku:
        for row in rows:
            if normalize_fuzzy_text(row["sku"] or "") == normalized_sku:
                return row
    for row in rows:
        if row["item_type"] == item_type and normalize_fuzzy_text(row["name"]) == normalized_name and str(row["unit"] or "") == unit:
            return row

    best_row = None
    best_score = 0.0
    for row in rows:
        if row["item_type"] != item_type:
            continue
        score = fuzzy_similarity(name, row["name"])
        if score > best_score:
            best_score = score
            best_row = row
    return best_row if best_row and best_score >= FUZZY_MATCH_THRESHOLD else None


def add_qty_to_warehouse(
    con: sqlite3.Connection,
    *,
    item_type: str,
    name: str,
    qty: float,
    unit: str,
    sku: str | None = None,
    condition_status: str | None = None,
    category: str | None = None,
    warehouse_item_id: int | None = None,
) -> sqlite3.Row:
    target = find_warehouse_receipt_target(
        con,
        item_type=item_type,
        name=name,
        unit=unit,
        sku=sku,
        warehouse_item_id=warehouse_item_id,
    )
    if target:
        con.execute(
            """
            UPDATE warehouse_items
            SET qty = qty + ?,
                unit = COALESCE(NULLIF(?, ''), unit),
                condition_status = CASE WHEN ? != '' THEN ? ELSE condition_status END,
                updated_at = ?
            WHERE id = ?
            """,
            (qty, unit, condition_status or "", condition_status or "", now_ts(), target["id"]),
        )
        return con.execute(
            """
            SELECT id, item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at
            FROM warehouse_items
            WHERE id = ?
            """,
            (target["id"],),
        ).fetchone()

    cur = con.execute(
        """
        INSERT INTO warehouse_items (item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            item_type,
            category,
            name,
            sku or None,
            unit,
            qty,
            condition_status or ("" if item_type == "material" else "Б/У"),
            now_ts(),
            now_ts(),
        ),
    )
    return con.execute(
        """
        SELECT id, item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at
        FROM warehouse_items
        WHERE id = ?
        """,
        (cur.lastrowid,),
    ).fetchone()


def seed_warehouse_items(con: sqlite3.Connection) -> None:
    if con.execute("SELECT COUNT(*) FROM warehouse_items").fetchone()[0] > 0:
        return
    rows = [
        ("material", "Кабель и электрика", "Кабель ВВГнг 3х2.5", "EL-VVGNG-3X2.5", "м", 240.0, ""),
        ("material", "Металлопрокат", "Швеллер 10П", "MET-SHV-10P", "м", 36.0, ""),
        ("material", "Изоляция", "Лента ФУМ", "SAN-FUM-12", "рулон", 18.0, ""),
        ("material", "Крепеж", "Саморез по металлу 4.2х19", "KRP-4219", "шт", 1200.0, ""),
        ("tool", "Инструмент", "Перфоратор Bosch GBH 2-26", "TOOL-GBH-226", "шт", 3.0, "Б/У"),
        ("tool", "Инструмент", "Лазерный уровень DeWalt", "TOOL-DW-LASER", "шт", 1.0, "Новый"),
        ("tool", "Инструмент", "Шуруповерт Makita DDF", "TOOL-MAK-DDF", "шт", 2.0, "Требует ремонта"),
    ]
    con.executemany(
        """
        INSERT INTO warehouse_items (item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [(item_type, category, name, sku, unit, qty, condition, now_ts(), now_ts()) for item_type, category, name, sku, unit, qty, condition in rows],
    )


def parse_iso_date(value: str | None) -> date | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def count_threshold_hits(value: float, thresholds: list[float]) -> int:
    return sum(1 for threshold in thresholds if value >= threshold)


def estimate_material_lead_days(material: dict) -> int:
    category = classify_scope(" ".join([
        str(material.get("title", "")),
        str(material.get("notes", "")),
        str(material.get("unit", "")),
    ]))
    base_map = {
        "facade": 16,
        "electrical": 12,
        "plumbing": 12,
        "ventilation": 16,
        "finishing": 8,
        "roof": 10,
        "concrete": 6,
        "masonry": 7,
        "prep": 4,
        "landscape": 5,
        "handover": 3,
        "general": 7,
    }
    planned_qty = float(material.get("planned_qty", material.get("plannedQty", 0)) or 0)
    planned_price = float(material.get("planned_price", material.get("plannedPrice", 0)) or 0)
    amount = planned_qty * planned_price
    extra = count_threshold_hits(amount, [250_000, 700_000, 1_500_000])
    return min(24, base_map.get(category, 7) + extra)


def api_companies(handler) -> None:
    try:
        user = handler.require_role({"admin", "director", "purchaser", "foreman"})
        if not user:
            return
        parsed = urllib.parse.urlsplit(handler.path)
        query = urllib.parse.parse_qs(parsed.query)
        company_type = str(query.get("type", [""])[0]).strip()
        params: list = []
        where = ""
        if company_type:
            where = "WHERE type = ?"
            params.append(company_type)
        with db() as con:
            company_columns = {row["name"] for row in con.execute("PRAGMA table_info(companies)").fetchall()}
            if "created_by" in company_columns:
                join_where = "WHERE c.type = ?" if company_type else ""
                rows = con.execute(
                    f"""
                    SELECT c.id, c.type, c.name, c.inn, c.kpp, c.ogrn, c.phone, c.email, c.address, c.notes, c.created_at,
                           c.created_by,
                           COALESCE(NULLIF(TRIM(COALESCE(u.last_name, '') || ' ' || COALESCE(u.first_name, '')), ''), u.login, 'Система') AS creator_name
                    FROM companies c
                    LEFT JOIN users u ON u.id = c.created_by
                    {join_where}
                    ORDER BY c.type, c.name
                    """,
                    params,
                ).fetchall()
            else:
                rows = con.execute(
                    f"""
                    SELECT id, type, name, inn, kpp, ogrn, phone, email, address, notes, created_at
                    FROM companies
                    {where}
                    ORDER BY type, name
                    """,
                    params,
                ).fetchall()
        handler.send_json(HTTPStatus.OK, {"companies": [dict(row) for row in rows]})
    except Exception as e:
        print("Глобальный сбой в api_companies, отдаю пустой массив:", e)
        handler.send_json(HTTPStatus.OK, {"companies": []})


def api_create_company(handler) -> None:
    user = handler.require_role({"admin", "director"})
    if not user:
        return
    payload = handler.read_json()
    company_type = str(payload.get("type", "")).strip()
    name = str(payload.get("name", "")).strip()
    if company_type not in {"own_legal_entity", "client", "supplier", "contractor", "other"} or not name:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_company_data"})
        return
    values = {
        "inn": str(payload.get("inn", "")).strip() or None,
        "kpp": str(payload.get("kpp", "")).strip() or None,
        "ogrn": str(payload.get("ogrn", "")).strip() or None,
        "phone": str(payload.get("phone", "")).strip() or None,
        "email": str(payload.get("email", "")).strip() or None,
        "address": str(payload.get("address", "")).strip() or None,
        "notes": str(payload.get("notes", "")).strip() or None,
    }
    with db() as con:
        cur = con.execute(
            """
            INSERT INTO companies (type, name, inn, kpp, ogrn, phone, email, address, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                company_type,
                name,
                values["inn"],
                values["kpp"],
                values["ogrn"],
                values["phone"],
                values["email"],
                values["address"],
                values["notes"],
                now_ts(),
            ),
        )
        if company_type == "client":
            con.execute(
                """
                INSERT INTO clients (company_id, name, contact_person, phone, email, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (cur.lastrowid, name, None, values["phone"], values["email"], values["notes"]),
            )
        create_audit(con, user["id"], "create_company", "company", cur.lastrowid, {"name": name, "type": company_type})
        con.commit()
    handler.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid, "type": company_type, "name": name})


def api_project_warehouse_matches(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if user["role"] == "customer":
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    with db() as con:
        matches = warehouse_matches_for_project(con, project_id)
    handler.send_json(
        HTTPStatus.OK,
        {
            "threshold": FUZZY_MATCH_THRESHOLD,
            "matches": {str(material_id): match for material_id, match in matches.items()},
        },
    )


def api_warehouse_items(handler) -> None:
    user = handler.require_role({"admin", "director", "foreman", "purchaser"})
    if not user:
        return
    with db() as con:
        rows = warehouse_item_rows(con)
    handler.send_json(HTTPStatus.OK, {"items": [serialize_warehouse_item(row) for row in rows]})


def api_warehouse_receipt(handler) -> None:
    user = handler.require_role({"admin", "director", "foreman", "purchaser"})
    if not user:
        return
    payload = handler.read_json()
    mode = str(payload.get("mode", "manual")).strip()
    if mode not in {"manual", "return"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_receipt_mode"})
        return
    try:
        qty = float(payload.get("qty", 0) or 0)
    except (TypeError, ValueError):
        qty = 0.0
    if qty <= 0:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_qty"})
        return

    con = db()
    try:
        con.execute("BEGIN IMMEDIATE")
        if mode == "manual":
            item_type = str(payload.get("item_type", payload.get("itemType", "material"))).strip()
            if item_type not in {"material", "tool"}:
                con.rollback()
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_item_type"})
                return
            name = str(payload.get("name", "")).strip()
            unit = str(payload.get("unit", "шт")).strip() or "шт"
            if not name:
                con.rollback()
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "name_required"})
                return
            warehouse_item_id = payload.get("warehouse_item_id", payload.get("warehouseItemId"))
            try:
                warehouse_item_id = int(warehouse_item_id) if warehouse_item_id not in (None, "", 0, "0") else None
            except (TypeError, ValueError):
                con.rollback()
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_warehouse_item_id"})
                return
            condition_status = str(payload.get("condition_status", payload.get("conditionStatus", ""))).strip()
            if item_type == "tool" and condition_status not in {"Новый", "Б/У", "Требует ремонта"}:
                condition_status = "Б/У"
            item_row = add_qty_to_warehouse(
                con,
                item_type=item_type,
                name=name,
                qty=qty,
                unit=unit,
                sku=str(payload.get("sku", "")).strip() or None,
                condition_status=condition_status,
                category=str(payload.get("category", "")).strip() or ("Инструмент" if item_type == "tool" else None),
                warehouse_item_id=warehouse_item_id,
            )
            create_audit(
                con,
                user["id"],
                "warehouse_manual_receipt",
                "warehouse_item",
                item_row["id"],
                {"name": item_row["name"], "qty": qty, "unit": item_row["unit"]},
            )
            con.commit()
            handler.send_json(HTTPStatus.CREATED, {"ok": True, "mode": mode, "warehouseItem": serialize_warehouse_item(item_row)})
            return

        try:
            project_id = int(payload.get("project_id", payload.get("projectId", 0)) or 0)
            estimate_item_id = int(payload.get("estimate_item_id", payload.get("estimateItemId", 0)) or 0)
        except (TypeError, ValueError):
            project_id = 0
            estimate_item_id = 0
        if not project_id or not estimate_item_id:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_or_material_id"})
            return
        if not handler.can_access_project(user, project_id):
            con.rollback()
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "project_forbidden"})
            return
        material = con.execute(
            """
            SELECT id, project_id, title, unit, planned_qty, planned_price, item_kind, article,
                   procurement_status, warehouse_source, warehouse_item_id, notes
            FROM estimate_items
            WHERE id = ? AND project_id = ?
            """,
            (estimate_item_id, project_id),
        ).fetchone()
        if not material:
            con.rollback()
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "material_not_found"})
            return
        summary = {int(item["id"]): item for item in material_summary_rows(con, project_id)}.get(estimate_item_id)
        available = float(summary.get("stockQty") or 0) if summary else 0.0
        if qty > available:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "qty_exceeds_object_stock", "available": available})
            return

        raw_kind = str(material["item_kind"] or "").strip().lower()
        notes = str(material["notes"] or "").lower()
        item_type = "tool" if raw_kind == "tool" or "инструмент" in notes or "tool" in notes else "material"
        item_row = add_qty_to_warehouse(
            con,
            item_type=item_type,
            name=str(material["title"] or "").strip(),
            qty=qty,
            unit=str(material["unit"] or "шт").strip() or "шт",
            sku=str(material["article"] or "").strip() or None,
            warehouse_item_id=material["warehouse_item_id"],
            category="Инструмент" if item_type == "tool" else None,
        )
        message = f"Произведен возврат на склад: {material['title']} — {qty:g} {material['unit']}"
        con.execute(
            """
            INSERT INTO stock_moves (project_id, estimate_item_id, move_type, qty, price, comment, created_by, created_at)
            VALUES (?, ?, 'use', ?, 0, ?, ?, ?)
            """,
            (project_id, estimate_item_id, qty, message, user["id"], now_ts()),
        )
        remaining = max(available - qty, 0)
        con.execute(
            """
            UPDATE estimate_items
            SET procurement_status = ?, warehouse_source = 'warehouse', warehouse_item_id = ?, updated_at = ?
            WHERE id = ?
            """,
            ("Возвращено на склад" if remaining <= 0 else "Частично возвращено на склад", item_row["id"], now_ts(), estimate_item_id),
        )
        create_audit(
            con,
            user["id"],
            "warehouse_return_from_project",
            "estimate_item",
            estimate_item_id,
            {
                "project_id": project_id,
                "warehouse_item_id": item_row["id"],
                "qty": qty,
                "unit": material["unit"],
                "message": message,
            },
        )
        con.commit()
        items = material_summary_rows(con, project_id)
        handler.send_json(
            HTTPStatus.CREATED,
            {
                "ok": True,
                "mode": mode,
                "message": message,
                "warehouseItem": serialize_warehouse_item(item_row),
                "items": items,
            },
        )
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def api_warehouse_transfer(handler, path: str) -> None:
    warehouse_item_id = parse_path_int(path, 2)
    if not warehouse_item_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_warehouse_item_id"})
        return
    user = handler.require_role({"admin", "director", "foreman", "purchaser"})
    if not user:
        return
    payload = handler.read_json()
    try:
        project_id = int(payload.get("project_id", payload.get("projectId", 0)) or 0)
    except (TypeError, ValueError):
        project_id = 0
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    if not handler.can_access_project(user, project_id):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "project_forbidden"})
        return
    try:
        qty = float(payload.get("qty", 0) or 0)
    except (TypeError, ValueError):
        qty = 0.0
    if qty <= 0:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_qty"})
        return

    con = db()
    try:
        con.execute("BEGIN IMMEDIATE")
        warehouse_item = con.execute(
            """
            SELECT id, item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at
            FROM warehouse_items
            WHERE id = ?
            """,
            (warehouse_item_id,),
        ).fetchone()
        if not warehouse_item:
            con.rollback()
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "warehouse_item_not_found"})
            return
        available = float(warehouse_item["qty"] or 0)
        if qty > available:
            con.rollback()
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "qty_exceeds_stock", "available": available})
            return
        project = con.execute("SELECT id, title FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            con.rollback()
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return

        material_rows = con.execute(
            """
            SELECT id, project_id, title, unit, planned_qty, planned_price, item_kind, section_title,
                   article, procurement_status, warehouse_source, warehouse_item_id, need_by_date, notes, stage_id
            FROM estimate_items
            WHERE project_id = ?
            """,
            (project_id,),
        ).fetchall()
        best_material = None
        best_score = 0.0
        for material in material_rows:
            if normalize_estimate_item_kind(resolved_estimate_item_kind(material)) == "work":
                continue
            score = warehouse_search_score(material, warehouse_item)
            if score > best_score:
                best_score = score
                best_material = material

        summary_by_id = {int(item["id"]): item for item in material_summary_rows(con, project_id)}
        estimate_item_id = None
        transfer_status = "Со склада"
        matched_existing = bool(best_material and best_score >= FUZZY_MATCH_THRESHOLD)
        if matched_existing:
            estimate_item_id = int(best_material["id"])
            summary = summary_by_id.get(estimate_item_id, {})
            old_missing = float(summary.get("missingQty") or 0)
            new_missing = max(old_missing - qty, 0)
            transfer_status = "Передано со склада" if new_missing <= 0 else "Частично передано со склада"
            con.execute(
                """
                UPDATE estimate_items
                SET procurement_status = ?, warehouse_source = 'warehouse', warehouse_item_id = ?, updated_at = ?
                WHERE id = ?
                """,
                (transfer_status, warehouse_item_id, now_ts(), estimate_item_id),
            )
        else:
            item_kind = "tool" if warehouse_item["item_type"] == "tool" else "material"
            notes = "Со склада"
            if warehouse_item["item_type"] == "tool":
                notes = "Со склада; Тип: Инструмент"
            cur = con.execute(
                """
                INSERT INTO estimate_items (
                    project_id, title, unit, planned_qty, planned_price, item_kind, article,
                    procurement_status, warehouse_source, warehouse_item_id, notes, updated_at
                )
                VALUES (?, ?, ?, ?, 0, ?, ?, 'Со склада', 'warehouse', ?, ?, ?)
                """,
                (
                    project_id,
                    warehouse_item["name"],
                    warehouse_item["unit"],
                    qty,
                    item_kind,
                    warehouse_item["sku"] or None,
                    warehouse_item_id,
                    notes,
                    now_ts(),
                ),
            )
            estimate_item_id = cur.lastrowid

        comment = str(payload.get("comment", "")).strip()
        move_comment = comment or f"Выдано со склада: {warehouse_item['name']}"
        con.execute(
            """
            INSERT INTO stock_moves (project_id, estimate_item_id, move_type, qty, price, comment, created_by, created_at)
            VALUES (?, ?, 'receipt', ?, 0, ?, ?, ?)
            """,
            (project_id, estimate_item_id, qty, move_comment, user["id"], now_ts()),
        )
        transfer_cur = con.execute(
            """
            INSERT INTO warehouse_transfers (warehouse_item_id, project_id, estimate_item_id, qty, unit, comment, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (warehouse_item_id, project_id, estimate_item_id, qty, warehouse_item["unit"], comment, user["id"], now_ts()),
        )
        con.execute(
            "UPDATE warehouse_items SET qty = qty - ?, updated_at = ? WHERE id = ?",
            (qty, now_ts(), warehouse_item_id),
        )
        create_audit(
            con,
            user["id"],
            "warehouse_transfer",
            "warehouse_transfer",
            transfer_cur.lastrowid,
            {
                "warehouse_item_id": warehouse_item_id,
                "project_id": project_id,
                "estimate_item_id": estimate_item_id,
                "qty": qty,
                "matched_existing": matched_existing,
                "score": round(best_score, 3),
            },
        )
        con.commit()
        item_row = con.execute(
            """
            SELECT id, item_type, category, name, sku, unit, qty, condition_status, created_at, updated_at
            FROM warehouse_items
            WHERE id = ?
            """,
            (warehouse_item_id,),
        ).fetchone()
        items = material_summary_rows(con, project_id)
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()

    handler.send_json(
        HTTPStatus.CREATED,
        {
            "ok": True,
            "transferId": transfer_cur.lastrowid,
            "estimateItemId": estimate_item_id,
            "matchedExisting": matched_existing,
            "matchScore": round(best_score, 3),
            "status": transfer_status,
            "warehouseItem": serialize_warehouse_item(item_row),
            "items": items,
        },
    )


def api_project_supplier_offers(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if user["role"] == "customer":
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    with db() as con:
        rows = con.execute(
            """
            SELECT so.*, e.title AS material_title, e.planned_price, e.planned_qty, e.unit AS material_unit,
                   c.name AS company_name, u.name AS author_name
            FROM supplier_offers so
            LEFT JOIN estimate_items e ON e.id = so.estimate_item_id
            LEFT JOIN companies c ON c.id = so.company_id
            LEFT JOIN users u ON u.id = so.created_by
            WHERE so.project_id = ?
            ORDER BY CASE so.status
                WHEN 'selected' THEN 0
                WHEN 'quoted' THEN 1
                WHEN 'called' THEN 2
                WHEN 'new' THEN 3
                ELSE 4 END,
                so.id DESC
            """,
            (project_id,),
        ).fetchall()
    offers = []
    for row in rows:
        item = dict(row)
        planned_price = float(row["planned_price"] or 0)
        price = float(row["price"] or 0)
        qty = float(row["qty"] or row["planned_qty"] or 0)
        delta_per_unit = round(price - planned_price, 2) if planned_price else None
        delta_total = round((price - planned_price) * qty, 2) if planned_price and qty else None
        item["compareToEstimate"] = {
            "plannedPrice": planned_price or None,
            "deltaPerUnit": delta_per_unit,
            "deltaTotal": delta_total,
            "effectLabel": "Экономия" if delta_total is not None and delta_total < 0 else ("Переплата" if delta_total is not None and delta_total > 0 else "Без сравнения"),
        }
        offers.append(item)
    handler.send_json(HTTPStatus.OK, {"offers": offers})


def api_create_market_counterparty(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_suppliers(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    candidate_type = str(payload.get("candidate_type", payload.get("candidateType", "supplier"))).strip() or "supplier"
    if candidate_type not in {"supplier", "contractor"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_candidate_type"})
        return
    name = str(payload.get("name", payload.get("candidate_name", payload.get("candidateName", "")))).strip()
    if not name:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "name_required"})
        return
    source_type = str(payload.get("source_type", payload.get("sourceType", "manual"))).strip() or "manual"
    if source_type not in {"manual", "avito", "other"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_source_type"})
        return
    try:
        estimate_item_id = int(payload.get("estimate_item_id", payload.get("estimateItemId", 0)) or 0)
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_estimate_item_id"})
        return
    if not estimate_item_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "estimate_item_required"})
        return

    def payload_float(key: str) -> float:
        try:
            return float(payload.get(key, 0) or 0)
        except (TypeError, ValueError):
            return 0.0

    phone = str(payload.get("phone", "")).strip() or None
    source_url = str(payload.get("source_url", payload.get("sourceUrl", ""))).strip() or None
    notes = str(payload.get("notes", "")).strip()
    company_notes = "\n".join(part for part in [notes, f"Источник: {source_url}" if source_url else ""] if part) or None
    price = max(0.0, payload_float("price"))
    qty = max(0.0, payload_float("qty"))
    unit = str(payload.get("unit", "")).strip() or None
    timestamp = now_ts()
    with db() as con:
        material = con.execute(
            "SELECT id, title, unit, planned_qty FROM estimate_items WHERE id = ? AND project_id = ?",
            (estimate_item_id, project_id),
        ).fetchone()
        if not material:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "material_not_found"})
            return
        if not unit:
            unit = str(material["unit"] or "") or None
        if qty <= 0:
            qty = float(material["planned_qty"] or 0)
        company_cur = con.execute(
            """
            INSERT INTO companies (type, name, inn, kpp, ogrn, phone, email, address, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (candidate_type, name, None, None, None, phone, None, None, company_notes, timestamp),
        )
        company_id = int(company_cur.lastrowid)
        offer_cur = con.execute(
            """
            INSERT INTO supplier_offers (
                project_id, estimate_item_id, company_id, candidate_type, candidate_name, source_type, source_url,
                contact_name, phone, price, qty, unit, status, notes, created_by, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'selected', ?, ?, ?, ?)
            """,
            (
                project_id,
                estimate_item_id,
                company_id,
                candidate_type,
                name,
                source_type,
                source_url,
                None,
                phone,
                price,
                qty,
                unit,
                notes or None,
                user["id"],
                timestamp,
                timestamp,
            ),
        )
        con.execute(
            """
            UPDATE supplier_offers
            SET status = 'quoted', updated_at = ?
            WHERE project_id = ? AND estimate_item_id = ? AND candidate_type = ? AND id <> ? AND status = 'selected'
            """,
            (timestamp, project_id, estimate_item_id, candidate_type, offer_cur.lastrowid),
        )
        create_audit(con, user["id"], "create_market_counterparty", "company", company_id, {"project_id": project_id, "estimate_item_id": estimate_item_id, "type": candidate_type})
        create_audit(con, user["id"], "select_market_counterparty", "supplier_offer", offer_cur.lastrowid, {"project_id": project_id, "company_id": company_id})
        con.commit()
    handler.send_json(
        HTTPStatus.CREATED,
        {
            "company": {
                "id": company_id,
                "type": candidate_type,
                "name": name,
                "inn": None,
                "kpp": None,
                "ogrn": None,
                "phone": phone,
                "email": None,
                "address": None,
                "notes": company_notes,
                "created_at": timestamp,
            },
            "offer": {
                "id": int(offer_cur.lastrowid),
                "project_id": project_id,
                "estimate_item_id": estimate_item_id,
                "company_id": company_id,
                "candidate_type": candidate_type,
                "candidate_name": name,
                "status": "selected",
                "source_url": source_url,
                "phone": phone,
            },
        },
    )


def api_create_supplier_offer(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_suppliers(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    candidate_type = str(payload.get("candidate_type", payload.get("candidateType", "supplier"))).strip() or "supplier"
    if candidate_type not in {"supplier", "contractor"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_candidate_type"})
        return
    status = str(payload.get("status", "new")).strip() or "new"
    if status not in {"new", "called", "quoted", "rejected", "selected"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_status"})
        return
    source_type = str(payload.get("source_type", payload.get("sourceType", "manual"))).strip() or "manual"
    if source_type not in {"manual", "avito", "other"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_source_type"})
        return
    company_id = payload.get("company_id", payload.get("companyId"))
    estimate_item_id = payload.get("estimate_item_id", payload.get("estimateItemId"))
    try:
        company_id = int(company_id) if company_id not in (None, "", 0, "0") else None
        estimate_item_id = int(estimate_item_id) if estimate_item_id not in (None, "", 0, "0") else None
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_relation_id"})
        return
    candidate_name = str(payload.get("candidate_name", payload.get("candidateName", ""))).strip()
    price = float(payload.get("price", 0) or 0)
    qty = float(payload.get("qty", 0) or 0)
    unit = str(payload.get("unit", "")).strip() or None
    if not candidate_name:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "candidate_name_required"})
        return
    with db() as con:
        if estimate_item_id:
            material = con.execute(
                "SELECT id, unit, planned_qty FROM estimate_items WHERE id = ? AND project_id = ?",
                (estimate_item_id, project_id),
            ).fetchone()
            if not material:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "material_not_found"})
                return
            if not unit:
                unit = str(material["unit"] or "") or None
            if qty <= 0:
                qty = float(material["planned_qty"] or 0)
        if company_id:
            company = con.execute("SELECT id FROM companies WHERE id = ?", (company_id,)).fetchone()
            if not company:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "company_not_found"})
                return
        timestamp = now_ts()
        cur = con.execute(
            """
            INSERT INTO supplier_offers (
                project_id, estimate_item_id, company_id, candidate_type, candidate_name, source_type, source_url,
                contact_name, phone, price, qty, unit, status, notes, created_by, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                estimate_item_id,
                company_id,
                candidate_type,
                candidate_name,
                source_type,
                str(payload.get("source_url", payload.get("sourceUrl", ""))).strip() or None,
                str(payload.get("contact_name", payload.get("contactName", ""))).strip() or None,
                str(payload.get("phone", "")).strip() or None,
                max(0.0, price),
                max(0.0, qty),
                unit,
                status,
                str(payload.get("notes", "")).strip() or None,
                user["id"],
                timestamp,
                timestamp,
            ),
        )
        if status == "selected" and estimate_item_id:
            con.execute(
                """
                UPDATE supplier_offers
                SET status = 'quoted', updated_at = ?
                WHERE project_id = ? AND estimate_item_id = ? AND candidate_type = ? AND id <> ? AND status = 'selected'
                """,
                (timestamp, project_id, estimate_item_id, candidate_type, cur.lastrowid),
            )
        create_audit(con, user["id"], "create_supplier_offer", "supplier_offer", cur.lastrowid, {"project_id": project_id, "candidate_name": candidate_name, "status": status})
        con.commit()
    handler.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})


def api_clear_supplier_selection(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_suppliers(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    candidate_type = str(payload.get("candidate_type", payload.get("candidateType", "supplier"))).strip() or "supplier"
    if candidate_type not in {"supplier", "contractor"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_candidate_type"})
        return
    try:
        estimate_item_id = int(payload.get("estimate_item_id", payload.get("estimateItemId", 0)) or 0)
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_estimate_item_id"})
        return
    if not estimate_item_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "estimate_item_required"})
        return
    timestamp = now_ts()
    with db() as con:
        con.execute(
            """
            UPDATE supplier_offers
            SET status = 'quoted', updated_at = ?
            WHERE project_id = ? AND estimate_item_id = ? AND candidate_type = ? AND status = 'selected'
            """,
            (timestamp, project_id, estimate_item_id, candidate_type),
        )
        create_audit(con, user["id"], "clear_supplier_selection", "estimate_item", estimate_item_id, {"project_id": project_id, "candidate_type": candidate_type})
        con.commit()
    handler.send_json(HTTPStatus.OK, {"project_id": project_id, "estimate_item_id": estimate_item_id, "candidate_type": candidate_type})


def api_update_supplier_offer(handler, path: str) -> None:
    offer_id = parse_path_int(path, 2)
    if not offer_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_offer_id"})
        return
    payload = handler.read_json()
    with db() as con:
        offer = con.execute("SELECT * FROM supplier_offers WHERE id = ?", (offer_id,)).fetchone()
        if not offer:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "offer_not_found"})
            return
        user = handler.require_project_access(int(offer["project_id"]))
        if not user:
            return
        if not user_can_manage_suppliers(user):
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        status = str(payload.get("status", offer["status"])).strip() or "new"
        if status not in {"new", "called", "quoted", "rejected", "selected"}:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_status"})
            return
        source_type = str(payload.get("source_type", payload.get("sourceType", offer["source_type"]))).strip() or "manual"
        if source_type not in {"manual", "avito", "other"}:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_source_type"})
            return
        company_id = payload.get("company_id", payload.get("companyId", offer["company_id"]))
        try:
            company_id = int(company_id) if company_id not in (None, "", 0, "0") else None
        except (TypeError, ValueError):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_company_id"})
            return
        if company_id:
            company = con.execute("SELECT id FROM companies WHERE id = ?", (company_id,)).fetchone()
            if not company:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "company_not_found"})
                return
        timestamp = now_ts()
        if status == "selected" and offer["estimate_item_id"]:
            con.execute(
                """
                UPDATE supplier_offers
                SET status = 'quoted', updated_at = ?
                WHERE project_id = ? AND estimate_item_id = ? AND candidate_type = ? AND id <> ? AND status = 'selected'
                """,
                (timestamp, offer["project_id"], offer["estimate_item_id"], offer["candidate_type"], offer_id),
            )
        con.execute(
            """
            UPDATE supplier_offers
            SET candidate_name = ?, company_id = ?, source_type = ?, source_url = ?, contact_name = ?, phone = ?,
                price = ?, qty = ?, unit = ?, status = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                str(payload.get("candidate_name", payload.get("candidateName", offer["candidate_name"]))).strip() or offer["candidate_name"],
                company_id,
                source_type,
                str(payload.get("source_url", payload.get("sourceUrl", offer["source_url"] or ""))).strip() or None,
                str(payload.get("contact_name", payload.get("contactName", offer["contact_name"] or ""))).strip() or None,
                str(payload.get("phone", offer["phone"] or "")).strip() or None,
                max(0.0, float(payload.get("price", offer["price"]) or 0)),
                max(0.0, float(payload.get("qty", offer["qty"]) or 0)),
                str(payload.get("unit", offer["unit"] or "")).strip() or None,
                status,
                str(payload.get("notes", offer["notes"] or "")).strip() or None,
                timestamp,
                offer_id,
            ),
        )
        create_audit(con, user["id"], "update_supplier_offer", "supplier_offer", offer_id, {"project_id": offer["project_id"], "status": status})
        con.commit()
    handler.send_json(HTTPStatus.OK, {"id": offer_id})


def resolved_estimate_item_kind(item: dict | sqlite3.Row) -> str:
    note_value = (
        extract_labeled_note_value(payload_get(item, "notes"), ("\u0422\u0438\u043f", "Type"))
        or extract_labeled_note_value(payload_get(item, "notes"), ("Type",))
    )
    if note_value:
        return normalize_estimate_item_kind(note_value)
    raw_value = (
        payload_get(item, "item_kind")
        or payload_get(item, "itemKind")
        or payload_get(item, "type")
        or payload_get(item, "type_label")
        or payload_get(item, "typeLabel")
        or payload_get(item, "position_type")
        or payload_get(item, "positionType")
        or ""
    )
    raw_text = str(raw_value or "").strip()
    if raw_text:
        return normalize_estimate_item_kind(raw_text)
    return normalize_estimate_item_kind(note_value)


def resolved_estimate_section_title(item: dict | sqlite3.Row) -> str | None:
    def normalize_section_title_text(value: object) -> str | None:
        text = re.sub(r"\s+", " ", str(value or "").strip())
        if not text:
            return None
        duplicate_match = re.fullmatch(r"(.+?)\s+\1", text)
        if duplicate_match:
            text = duplicate_match.group(1).strip()
        return text or None

    direct_value = (
        payload_get(item, "section_title")
        or payload_get(item, "sectionTitle")
        or payload_get(item, "section_name")
        or payload_get(item, "sectionName")
        or payload_get(item, "section")
        or payload_get(item, "chapter")
        or ""
    )
    direct_text = normalize_section_title_text(direct_value)
    if direct_text:
        return direct_text
    note_text = (
        extract_labeled_note_value(payload_get(item, "notes"), ("\u0420\u0430\u0437\u0434\u0435\u043b", "Section", "Chapter"))
        or extract_labeled_note_value(payload_get(item, "notes"), ("Section", "Chapter"))
    )
    return normalize_section_title_text(note_text)


def api_warehouse_list(handler) -> None:
    api_warehouse_items(handler)


def api_warehouse_issue(handler, path: str) -> None:
    api_warehouse_transfer(handler, path)
