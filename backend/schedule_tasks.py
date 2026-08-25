from __future__ import annotations

import json
import math
import sqlite3
import time
import urllib.parse
from datetime import date, datetime, timedelta
from http import HTTPStatus
from pathlib import Path

from auth import display_user_name, user_can_manage_documents, user_can_manage_schedule, user_has_any_role
from operational_quantities import operational_quantity_plan
from projects import serialize_project
from sqlite_config import configure_connection
from warehouse import (
    canonical_estimate_section_title,
    normalize_estimate_item_kind,
    resolved_estimate_item_kind,
    resolved_estimate_section_title,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
TODAY_ISO = date.today().isoformat()
SCHEDULE_SHIFT_HOURS = 9


def now_ts() -> int:
    return int(time.time())


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    return configure_connection(connection)


def parse_path_int(path: str, index: int) -> int | None:
    parts = path.strip("/").split("/")
    try:
        return int(parts[index])
    except (IndexError, TypeError, ValueError):
        return None


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


def normalize_progress_section_id(value: object) -> str:
    text = canonical_estimate_section_title(value).strip().lower()
    return " ".join(text.split()) or "без раздела"


def estimate_row_section_title(con: sqlite3.Connection, row: sqlite3.Row | dict) -> str:
    stage_id = int(row["stage_id"] or 0) if row["stage_id"] else None
    if stage_id:
        stages = con.execute(
            "SELECT id, title, parent_id FROM work_stages WHERE project_id = ?",
            (row["project_id"],),
        ).fetchall()
        stage_map = {int(stage["id"]): stage for stage in stages}
        current = stage_map.get(stage_id)
        root = current
        guard = 0
        while current and current["parent_id"] and guard < 20:
            parent = stage_map.get(int(current["parent_id"]))
            if not parent:
                break
            root = parent
            current = parent
            guard += 1
        if root and root["title"]:
            return canonical_estimate_section_title(root["title"])
    return canonical_estimate_section_title(resolved_estimate_section_title(row) or row["section_title"] or "") or "Без раздела"


def live_estimate_items_where(con: sqlite3.Connection, alias: str = "e") -> str:
    prefix = f"{alias}." if alias else ""
    clauses = [
        f"{prefix}title IS NOT NULL",
        f"trim({prefix}title) != ''",
    ]
    if "is_deleted" in table_columns(con, "estimate_items"):
        clauses.append(f"COALESCE({prefix}is_deleted, 0) = 0")
    return " AND ".join(clauses)


def recalc_project_progress(con: sqlite3.Connection, project_id: int, section_id: str | None = None) -> dict:
    live_where = live_estimate_items_where(con, "e")
    rows = con.execute(
        f"""
        SELECT
            e.id, e.project_id, e.title, e.section_title, e.stage_id, e.item_kind,
            e.planned_qty, e.is_completed,
            COALESCE(SUM(CASE WHEN s.move_type = 'purchase' THEN s.qty ELSE 0 END), 0) AS purchased_qty,
            COALESCE(SUM(CASE WHEN s.move_type = 'receipt' THEN s.qty ELSE 0 END), 0) AS received_qty
        FROM estimate_items e
        LEFT JOIN stock_moves s ON s.estimate_item_id = e.id
        WHERE e.project_id = ? AND {live_where}
        GROUP BY e.id
        """,
        (project_id,),
    ).fetchall()
    section_totals: dict[str, dict] = {}
    for row in rows:
        title = estimate_row_section_title(con, row)
        sid = normalize_progress_section_id(title)
        bucket = section_totals.setdefault(sid, {"sectionId": sid, "sectionTitle": title, "total": 0, "done": 0, "percent": 0})
        bucket["total"] += 1
        planned = float(row["planned_qty"] or 0)
        covered = max(float(row["purchased_qty"] or 0), float(row["received_qty"] or 0))
        is_material = normalize_estimate_item_kind(resolved_estimate_item_kind(row)) != "work"
        purchased_done = is_material and planned > 0 and covered >= planned
        if int(row["is_completed"] or 0) == 1 or purchased_done:
            bucket["done"] += 1

    for bucket in section_totals.values():
        bucket["percent"] = int(round((bucket["done"] / bucket["total"]) * 100)) if bucket["total"] else 0

    target_section = section_totals.get(normalize_progress_section_id(section_id)) if section_id else None
    if not target_section and section_id:
        target_section = {"sectionId": normalize_progress_section_id(section_id), "sectionTitle": section_id, "total": 0, "done": 0, "percent": 0}

    total_positions = sum(item["total"] for item in section_totals.values())
    total_done = sum(item["done"] for item in section_totals.values())
    total_percent = int(round((total_done / total_positions) * 100)) if total_positions else 0
    status = "completed" if total_percent >= 100 and total_positions else ("active" if total_percent > 0 else None)
    if status:
        con.execute("UPDATE projects SET progress = ?, status = ?, updated_at = ? WHERE id = ?", (total_percent, status, now_ts(), project_id))
    else:
        con.execute("UPDATE projects SET progress = ?, updated_at = ? WHERE id = ?", (total_percent, now_ts(), project_id))

    stage_rows = con.execute(
        "SELECT id, title FROM work_stages WHERE project_id = ? AND stage_kind = 'section'",
        (project_id,),
    ).fetchall()
    for stage in stage_rows:
        bucket = section_totals.get(normalize_progress_section_id(stage["title"]))
        if not bucket:
            continue
        status_code = "completed" if bucket["percent"] >= 100 and bucket["total"] else ("in_progress" if bucket["percent"] > 0 else "not_started")
        con.execute(
            "UPDATE work_stages SET progress = ?, status_code = ?, updated_at = ? WHERE id = ?",
            (bucket["percent"], status_code, now_ts(), stage["id"]),
        )

    return {
        "section": target_section,
        "sections": list(section_totals.values()),
        "projectProgress": total_percent,
        "totalProjectPercent": total_percent,
    }


STAGE_CATEGORY_KEYWORDS = {
    "prep": ["подготов", "демонтаж", "временн", "мобилиз", "размет", "геодез"],
    "concrete": ["котлован", "землян", "фундамент", "бетон", "монолит", "арматур", "стяжк"],
    "masonry": ["кладк", "кирпич", "блок", "перегород", "каркас", "сварк", "металлоконструк"],
    "roof": ["кровл", "крыша", "гидроизоляц", "утеплен"],
    "facade": ["фасад", "витраж", "остеклен", "окн", "двер"],
    "electrical": ["электр", "кабель", "щит", "слаботоч", "освещен"],
    "plumbing": ["сантех", "водоснаб", "канализ", "отоплен", "труб", "радиатор"],
    "ventilation": ["вентиляц", "дымоудал", "кондицион", "чиллер"],
    "finishing": ["отдел", "штукатур", "шпаклев", "плитк", "окраск", "ламинат", "потол", "дверн"],
    "landscape": ["благоустрой", "асфальт", "бордюр", "озеленен", "наруж"],
    "handover": ["пуск", "исполн", "сдач", "акт", "комис", "документ"],
}


SECTION_SCHEDULE_RULES = [
    {
        "keywords": ("демонтаж оконных коробок", "каменных стенах"),
        "hours_per_qty": 128.73,
        "crew_size": 4,
        "source_label": "ФЕРр 56-9-1: демонтаж оконных коробок в каменных стенах",
        "source_url": "https://www.defsmeta.com/rfer/rfer56/rfer-56-09-001-01.php",
        "assumption": False,
    },
    {
        "keywords": ("установка в жилых и общественных зданиях оконных блоков из пвх профилей", "трехстворчатых"),
        "hours_per_qty": 149.16,
        "crew_size": 4,
        "source_label": "ФЕР 10-01-034-08: установка трехстворчатых ПВХ-окон",
        "source_url": "https://www.defsmeta.com/rfer/rfer10/rfer-10-01-034-08.php",
        "assumption": False,
    },
    {
        "keywords": ("установка подоконных досок из пвх",),
        "hours_per_qty": 21.19,
        "crew_size": 3,
        "source_label": "ФЕР 10-01-035-01: установка подоконных досок из ПВХ",
        "source_url": "https://files.stroyinf.ru/Data2/1/4293814/4293814969.htm",
        "assumption": False,
    },
    {
        "keywords": ("установка уголков пвх на клее",),
        "hours_per_qty": 6.7,
        "crew_size": 2,
        "source_label": "ФЕР 15-01-070-01: установка уголков ПВХ на клее",
        "source_url": "https://www.defsmeta.com/rfer15_2/rfer-15-01-070-01.php",
        "assumption": False,
    },
    {
        "keywords": ("устройство вентилируемых фасадов", "без теплоизоляционного слоя"),
        "hours_per_qty": 207.98,
        "crew_size": 4,
        "source_label": "ФЕР 15-01-090-01: вентфасад без теплоизоляции",
        "source_url": "https://www.defsmeta.com/rfer15_2/rfer-15-01-090-01.php",
        "assumption": False,
    },
    {
        "keywords": ("устройство вентилируемых фасадов", "с устройством теплоизоляционного слоя"),
        "hours_per_qty": 334.66,
        "crew_size": 4,
        "source_label": "ФЕР 15-01-090-02: вентфасад с теплоизоляцией",
        "source_url": "https://www.defsmeta.com/rfer15_2/rfer-15-01-090-02.php",
        "assumption": False,
    },
    {
        "keywords": ("устройство стяжек: цементных толщиной 20 мм",),
        "hours_per_qty": 39.51,
        "crew_size": 4,
        "source_label": "ГЭСН 11-01-011-01: цементная стяжка 20 мм",
        "source_url": "https://cs.smetnoedelo.ru/gesn2/gesn11-01-011-01.html",
        "assumption": False,
    },
    {
        "keywords": ("на каждые 5 мм изменения толщины стяжки",),
        "hours_per_qty": 0.5,
        "crew_size": 4,
        "source_label": "ГЭСН 11-01-011-09: добавка на каждые 5 мм стяжки",
        "source_url": "https://fgisrf.ru/frsn/fer/element/4f0007cc-f11b-4d16-98ed-cdf8494fd866",
        "assumption": False,
    },
    {
        "keywords": ("самовыравнивающейся смеси", "толщиной 3 мм"),
        "hours_per_qty": 26.14,
        "crew_size": 3,
        "source_label": "ГЭСН 11-01-011-10: самовыравнивающаяся смесь 3 мм",
        "source_url": "https://cs.smetnoedelo.ru/gesn2/gesn11-01-011-10.html",
        "assumption": False,
    },
    {
        "keywords": ("на каждый последующий слой толщиной 1 мм",),
        "hours_per_qty": 2.33,
        "crew_size": 3,
        "source_label": "ГЭСН 11-01-011-11: добавка на каждый 1 мм слоя",
        "source_url": "https://www.defsmeta.com/rgsn13/gsn_11/giesn-11-01-011-11.php",
        "assumption": False,
    },
    {
        "keywords": ("устройство покрытий: из линолеума", "свариванием полотнищ"),
        "hours_per_qty": 51.82,
        "crew_size": 3,
        "source_label": "ГЭСН 11-01-036-01: укладка линолеума на клее",
        "source_url": "https://www.defsmeta.com/rgsn14/gsn_11/giesn-11-01-036-01.php",
        "assumption": False,
    },
    {
        "keywords": ("разборка элементов облицовки потолков", "плит растровых"),
        "hours_per_qty": 34.51,
        "crew_size": 3,
        "source_label": "ГЭСНр 63-7-2: разборка растрового потолка",
        "source_url": "https://www.defsmeta.com/rgsnr3/gsnr_63/giesnr-63-07-002.php",
        "assumption": False,
    },
    {
        "keywords": ("устройство потолков: плитно-ячеистых", "оцинкованного профиля"),
        "hours_per_qty": 102.46,
        "crew_size": 3,
        "source_label": "ГЭСН 15-01-047-15: потолок Армстронг по каркасу",
        "source_url": "https://www.defsmeta.com/rgsn14/gsn_15/giesn-15-01-047-15.php",
        "assumption": False,
    },
    {
        "keywords": ("облицовка стен по одинарному металлическому каркасу", "гипсоволокнистыми листами", "одним слоем"),
        "hours_per_qty": 84.0,
        "crew_size": 3,
        "source_label": "ФЕР 10-06-037-03: облицовка стен ГВЛ по каркасу",
        "source_url": "https://www.defsmeta.com/rfer10/rfer-10-06-037-03.php",
        "assumption": False,
    },
    {
        "keywords": ("окраска водно-дисперсионными акриловыми составами улучшенная", "по сборным конструкциям стен"),
        "hours_per_qty": 32.73,
        "crew_size": 2,
        "source_label": "ФЕР 15-04-005-03: улучшенная окраска стен водно-дисперсионными составами",
        "source_url": "https://www.defsmeta.com/rfer15_2/rfer-15-04-005-03.php",
        "assumption": False,
    },
    {
        "keywords": ("розетка скрытого монтажа",),
        "hours_per_qty": 0.3048,
        "crew_size": 2,
        "source_label": "ГЭСНм 08-03-591-09: розетка скрытой проводки",
        "source_url": "https://cs.smetnoedelo.ru/gesnm2/gesnm08-03-591-09.html",
        "assumption": False,
    },
    {
        "keywords": ("разработка грунта вручную в траншеях",),
        "hours_per_qty": 123.6,
        "crew_size": 3,
        "source_label": "ГЭСН 01-02-060-06: ручная разработка траншей, группа 2",
        "source_url": "https://base.garant.ru/57505366/53925f69af584b25346d0c0b3ee74ea1/",
        "assumption": False,
    },
    {
        "keywords": ("прокладка трубопроводов канализации", "диаметром: 110 мм"),
        "hours_per_qty": 56.0,
        "crew_size": 3,
        "source_label": "ФЕР 16-04-001-01: прокладка канализации ПЭ 110 мм",
        "source_url": "https://cs.smetnoedelo.ru/fer/fer16-04-001-01.html",
        "assumption": False,
    },
    {
        "keywords": ("засыпка вручную траншей",),
        "hours_per_qty": 88.5,
        "crew_size": 3,
        "source_label": "ГЭСН 01-02-061-01: ручная засыпка траншей",
        "source_url": "https://cs.smetnoedelo.ru/fer/fer01-02-061-02.html",
        "assumption": False,
    },
    {
        "keywords": ("погрузка в автотранспортное средство", "мусор"),
        "hours_per_qty": 0.35,
        "crew_size": 2,
        "source_label": "Укрупнённое допущение по ручной погрузке строительного мусора",
        "source_url": "https://rags.ru/stroyka/text/50012/",
        "assumption": True,
    },
    {
        "keywords": ("перевозка грузов i класса автомобилями-самосвалами",),
        "hours_per_qty": 0.18,
        "crew_size": 1,
        "source_label": "Укрупнённое допущение по рейсу самосвала на 25 км",
        "source_url": "https://fgisrf.ru/frsn/fsscpg",
        "assumption": True,
    },
]


SECTION_SCHEDULE_FALLBACKS = {
    "facade": {"crew_size": 4, "area100": 88.0, "len100": 18.0, "pcs100": 52.0, "area1": 1.0, "len1": 0.18, "ton": 24.0, "generic": 8.0},
    "concrete": {"crew_size": 4, "area100": 46.0, "len100": 16.0, "vol100": 120.0, "area1": 0.46, "len1": 0.16, "generic": 7.0},
    "finishing": {"crew_size": 3, "area100": 62.0, "len100": 14.0, "pcs100": 28.0, "area1": 0.62, "len1": 0.14, "generic": 6.0},
    "electrical": {"crew_size": 2, "pcs1": 0.35, "pcs100": 35.0, "len100": 22.0, "len1": 0.22, "ton": 42.0, "generic": 4.0},
    "plumbing": {"crew_size": 3, "len100": 56.0, "len1": 0.56, "vol100": 104.0, "area100": 72.0, "generic": 6.0},
    "prep": {"crew_size": 3, "area100": 34.0, "len100": 10.0, "pcs100": 44.0, "ton": 8.0, "generic": 5.0},
    "general": {"crew_size": 3, "area100": 60.0, "len100": 16.0, "pcs100": 36.0, "area1": 0.6, "len1": 0.16, "generic": 6.0},
}


SCHEDULE_SCOPE_KEYWORDS = {
    "facade": ("окн", "фасад", "откос", "подокон", "жалюз", "витраж", "водоотлив", "уголок пвх"),
    "concrete": ("стяжк", "бетон", "гидроизоляц", "пол", "наливн"),
    "finishing": ("стен", "потол", "окраск", "облицовк", "линолеум", "плинтус", "гипс"),
    "electrical": ("электр", "розет", "светиль", "кабел", "экран", "щит"),
    "plumbing": ("канализац", "труб", "транше", "грунт", "радиатор"),
    "prep": ("демонтаж", "разборка", "снятие", "вывоз мусора", "погрузка", "перевозка"),
}


def mark_project_schedule_draft(
    con: sqlite3.Connection,
    project_id: int,
    *,
    touch_internal: bool = True,
    touch_customer: bool = True,
    generated_at: str | None = None,
) -> None:
    project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        return

    updates: list[str] = []
    params: list[object] = []

    if touch_internal:
        internal_status = str(project["internal_schedule_status"] or "draft")
        internal_version = int(project["internal_schedule_version"] or 1)
        if internal_status == "approved":
            internal_version += 1
        updates.extend(
            [
                "internal_schedule_status = ?",
                "internal_schedule_version = ?",
                "internal_schedule_approved_at = NULL",
            ]
        )
        params.extend(["draft", internal_version])

    if touch_customer:
        customer_status = str(project["customer_schedule_status"] or "draft")
        customer_version = int(project["customer_schedule_version"] or 1)
        if customer_status == "approved":
            customer_version += 1
        updates.extend(
            [
                "customer_schedule_status = ?",
                "customer_schedule_version = ?",
                "customer_schedule_approved_at = NULL",
            ]
        )
        params.extend(["draft", customer_version])

    if generated_at is not None:
        updates.append("schedule_generated_at = ?")
        params.append(generated_at)

    if not updates:
        return

    updates.append("updated_at = ?")
    params.extend([now_ts(), project_id])
    con.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", params)


def update_project_schedule_status(
    con: sqlite3.Connection,
    project_id: int,
    schedule_type: str,
    action: str,
) -> sqlite3.Row | None:
    project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        return None

    if action == "reset_to_draft":
        mark_project_schedule_draft(
            con,
            project_id,
            touch_internal=schedule_type in {"internal", "both"},
            touch_customer=schedule_type in {"customer", "both"},
        )
        return con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

    updates: list[str] = []
    params: list[object] = []
    approved_at = TODAY_ISO
    if schedule_type in {"internal", "both"}:
        updates.extend(["internal_schedule_status = ?", "internal_schedule_approved_at = ?"])
        params.extend(["approved", approved_at])
    if schedule_type in {"customer", "both"}:
        updates.extend(["customer_schedule_status = ?", "customer_schedule_approved_at = ?"])
        params.extend(["approved", approved_at])
    updates.append("updated_at = ?")
    params.extend([now_ts(), project_id])
    con.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", params)
    return con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()


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

    live_where = live_estimate_items_where(con, "e")
    estimate_columns = table_columns(con, "estimate_items")
    table_names = {
        str(item["name"])
        for item in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    }
    has_estimate_sources = "estimate_source_id" in estimate_columns and "project_estimates" in table_names
    estimate_source_select = """
            , e.estimate_source_id,
            source.source_type AS estimate_source_type,
            source.source_key AS estimate_source_key,
            source.external_id AS estimate_source_external_id,
            source.tender_id AS estimate_tender_id,
            source.title AS estimate_title,
            source.file_name AS estimate_file_name,
            source.source_reference AS estimate_source_reference
    """ if has_estimate_sources else ""
    estimate_source_join = (
        "LEFT JOIN project_estimates source ON source.id = e.estimate_source_id AND source.project_id = e.project_id"
        if has_estimate_sources else ""
    )
    rows = con.execute(
        f"""
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
            COALESCE(SUM(CASE WHEN s.move_type = 'use' THEN s.qty ELSE 0 END), 0) AS used_qty,
            COALESCE(SUM(CASE WHEN s.move_type = 'writeoff' THEN s.qty ELSE 0 END), 0) AS writeoff_qty
            {estimate_source_select}
        FROM estimate_items e
        LEFT JOIN work_stages ws ON ws.id = e.stage_id
        LEFT JOIN stock_moves s ON s.estimate_item_id = e.id
        {estimate_source_join}
        WHERE e.project_id = ? AND {live_where}
        GROUP BY e.id
        ORDER BY e.id
        """,
        (project_id,),
    ).fetchall()
    items = []

    def safe_float(value: object, default: float = 0.0) -> float:
        try:
            return float(value if value not in (None, "") else default)
        except (TypeError, ValueError):
            return default

    for row in rows:
        quantity_plan = operational_quantity_plan(row["planned_qty"], row["unit"])
        planned = float(quantity_plan["total_qty"])
        display_unit = str(quantity_plan["unit"])
        purchased = safe_float(row["purchased_qty"])
        received = safe_float(row["received_qty"])
        used = safe_float(row["used_qty"])
        writeoff = safe_float(row["writeoff_qty"])
        covered = max(purchased, received)
        stock_base = received
        stock_balance = stock_base - used - writeoff
        stock = max(stock_balance, 0)
        missing = max(planned - covered, 0)
        usage_progress = round(min(100, used / planned * 100), 1) if planned else 0
        purchase_progress = round(min(100, covered / planned * 100), 1) if planned else 0
        estimated_delivery_days = estimate_material_lead_days(
            {
                "title": row["title"],
                "notes": row["notes"],
                "unit": row["unit"],
                "planned_qty": planned,
                "planned_price": safe_float(row["planned_price"]),
            }
        )
        delivery_days = int(row["delivery_days"]) if row["delivery_days"] is not None else int(estimated_delivery_days)
        need_by_date = str(row["need_by_date"] or row["stage_planned_start"] or row["stage_planned_end"] or "")
        soon_threshold = (parse_iso_date(TODAY_ISO) + timedelta(days=13)).isoformat()
        if missing <= 0:
            if received >= planned:
                supply_status = "in_stock"
                supply_label = "На объекте"
            else:
                supply_status = "ordered"
                supply_label = "Заказано, ждём поставку"
        elif need_by_date and need_by_date < TODAY_ISO:
            supply_status = "required"
            supply_label = "Требуется"
        elif need_by_date and need_by_date <= soon_threshold:
            supply_status = "soon"
            supply_label = "Скоро потребуется"
        else:
            supply_status = "planned"
            supply_label = "Нужно запланировать"
        items.append(
            {
                "id": row["id"],
                "title": row["title"],
                "itemKind": resolved_estimate_item_kind(row),
                "unit": display_unit,
                "sourceUnit": row["unit"],
                "sourcePlannedQty": safe_float(row["planned_qty"]),
                "unitMultiplier": float(quantity_plan["multiplier"]),
                "article": row["article"] or "",
                "plannedQty": planned,
                "plannedPrice": safe_float(row["planned_price"]),
                "purchasedQty": purchased,
                "receivedQty": received,
                "usedQty": used,
                "writeoffQty": writeoff,
                "actualQty": safe_float(row["actual_qty"]),
                "isCompleted": bool(row["is_completed"]),
                "stockQty": stock,
                "stockBalanceQty": stock_balance,
                "unaccountedQty": max(-stock_balance, 0),
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
                "estimateSourceId": row["estimate_source_id"] if has_estimate_sources else None,
                "estimateSourceType": (row["estimate_source_type"] or "estimate") if has_estimate_sources else "legacy",
                "estimateSourceKey": (row["estimate_source_key"] or "") if has_estimate_sources else "",
                "estimateSourceExternalId": (row["estimate_source_external_id"] or "") if has_estimate_sources else "",
                "estimateTenderId": (row["estimate_tender_id"] or "") if has_estimate_sources else "",
                "estimateTitle": (row["estimate_title"] or "Ранее загруженная смета") if has_estimate_sources else "Ранее загруженная смета",
                "estimateFileName": (row["estimate_file_name"] or "Смета объекта") if has_estimate_sources else "Смета объекта",
                "estimateSourceReference": (row["estimate_source_reference"] or "") if has_estimate_sources else "",
                "sectionTitle": canonical_estimate_section_title(
                    resolved_estimate_section_title(row) or resolve_stage_root_title(row["stage_id"]) or ""
                ),
                "sectionId": normalize_progress_section_id(
                    resolved_estimate_section_title(row) or resolve_stage_root_title(row["stage_id"]) or ""
                ),
                "supplyStatus": supply_status,
                "supplyLabel": (row["procurement_status"] or supply_label) if row["warehouse_source"] else supply_label,
            }
        )
    return items


def build_material_schedule_payload(
    con: sqlite3.Connection,
    project_id: int,
    *,
    warning_days: int = 5,
    neutral_days: int = 7,
) -> dict:
    project = con.execute(
        "SELECT id, title, started_at, deadline_at FROM projects WHERE id = ?",
        (project_id,),
    ).fetchone()
    materials = [
        item
        for item in material_summary_rows(con, project_id)
        if normalize_estimate_item_kind(item.get("itemKind")) != "work"
    ]
    selected_offers = con.execute(
        """
        SELECT estimate_item_id, candidate_name, company_id, source_url
        FROM supplier_offers
        WHERE project_id = ? AND candidate_type = 'supplier' AND status = 'selected'
        ORDER BY updated_at DESC, created_at DESC, id DESC
        """,
        (project_id,),
    ).fetchall()
    supplier_by_item: dict[int, dict] = {}
    for row in selected_offers:
        item_id = row["estimate_item_id"]
        if item_id is None or int(item_id) in supplier_by_item:
            continue
        supplier_by_item[int(item_id)] = {
            "name": row["candidate_name"] or "",
            "companyId": row["company_id"],
            "sourceUrl": row["source_url"] or "",
        }

    today = date.today()
    items: list[dict] = []
    range_dates: list[date] = [today]
    summary = {
        "total": 0,
        "purchased": 0,
        "overdue": 0,
        "warning": 0,
        "neutral": 0,
        "unscheduled": 0,
    }

    for material in materials:
        material_id = int(material.get("id") or 0)
        planned_qty = float(material.get("plannedQty") or 0)
        planned_price = float(material.get("plannedPrice") or 0)
        missing_qty = float(material.get("missingQty") or 0)
        estimated_lead_days = estimate_material_lead_days(
            {
                "title": material.get("title"),
                "notes": material.get("notes"),
                "unit": material.get("unit"),
                "planned_qty": planned_qty,
                "planned_price": planned_price,
            }
        )
        try:
            lead_days = int(material.get("deliveryDays") if material.get("deliveryDays") is not None else estimated_lead_days)
        except (TypeError, ValueError):
            lead_days = int(estimated_lead_days)
        lead_days = max(0, min(lead_days, 90))

        deadline_date = parse_iso_date(str(material.get("needByDate") or material.get("stageStartDate") or material.get("stageEndDate") or ""))
        purchase_start = deadline_date - timedelta(days=lead_days) if deadline_date else None
        alert_start = purchase_start - timedelta(days=warning_days) if purchase_start else None

        days_until_purchase = (purchase_start - today).days if purchase_start else None
        days_until_deadline = (deadline_date - today).days if deadline_date else None
        if missing_qty <= 0:
            if float(material.get("receivedQty") or 0) >= planned_qty:
                status = "purchased"
                status_label = "Закуплено"
            else:
                status = "in_transit"
                status_label = "В пути"
            color = "done"
            summary["purchased"] += 1
        elif not deadline_date:
            status = "unscheduled"
            status_label = "Нет дедлайна"
            color = "muted"
            summary["unscheduled"] += 1
        elif days_until_purchase is not None and days_until_purchase < 0:
            status = "overdue"
            status_label = "Просрочено"
            color = "red"
            summary["overdue"] += 1
        elif days_until_purchase is not None and days_until_purchase <= warning_days:
            status = "warning"
            status_label = "Пора платить"
            color = "yellow"
            summary["warning"] += 1
        else:
            status = "neutral"
            status_label = "В плане"
            color = "green"
            summary["neutral"] += 1

        for value in (purchase_start, deadline_date, alert_start):
            if value:
                range_dates.append(value)

        summary["total"] += 1
        items.append(
            {
                "id": material_id,
                "projectId": project_id,
                "title": material.get("title") or "",
                "unit": material.get("unit") or "",
                "plannedQty": planned_qty,
                "purchasedQty": float(material.get("purchasedQty") or 0),
                "receivedQty": float(material.get("receivedQty") or 0),
                "missingQty": missing_qty,
                "purchaseProgress": float(material.get("purchaseProgress") or 0),
                "status": status,
                "statusLabel": status_label,
                "color": color,
                "purchaseStartDate": purchase_start.isoformat() if purchase_start else None,
                "purchaseByDate": purchase_start.isoformat() if purchase_start else None,
                "alertStartDate": alert_start.isoformat() if alert_start else None,
                "deadlineDate": deadline_date.isoformat() if deadline_date else None,
                "deliveryTargetDate": deadline_date.isoformat() if deadline_date else None,
                "deliveryLeadDays": int(lead_days),
                "estimatedDeliveryDays": int(estimated_lead_days),
                "warningDays": int(warning_days),
                "daysUntilPurchase": int(days_until_purchase) if days_until_purchase is not None else None,
                "daysUntilDeadline": int(days_until_deadline) if days_until_deadline is not None else None,
                "sectionTitle": material.get("sectionTitle") or "",
                "relatedWork": {
                    "stageId": material.get("stageId"),
                    "title": material.get("stageTitle") or material.get("sectionTitle") or "",
                    "startDate": material.get("stageStartDate"),
                    "endDate": material.get("stageEndDate"),
                },
                "supplier": supplier_by_item.get(material_id),
                "materialUrl": f"/app/projects?openProject={project_id}&tab=warehouse-control&materialId={material_id}",
            }
        )

    items.sort(key=lambda item: (item["deadlineDate"] or "9999-12-31", item["purchaseStartDate"] or "9999-12-31", item["title"]))
    start_date = min(range_dates)
    end_date = max(range_dates)
    if start_date == end_date:
        end_date = start_date + timedelta(days=max(neutral_days, warning_days, 1))
    return {
        "projectId": project_id,
        "projectTitle": project["title"] if project else "",
        "today": today.isoformat(),
        "settings": {
            "warningDays": int(warning_days),
            "neutralDays": int(neutral_days),
        },
        "range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "summary": summary,
        "items": items,
    }


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


def classify_scope(text: str | None) -> str:
    haystack = str(text or "").strip().lower()
    for category, keywords in STAGE_CATEGORY_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return category
    return "general"


def estimate_stage_duration(stage: sqlite3.Row | dict, materials: list[dict]) -> int:
    title = str(stage["title"] if isinstance(stage, sqlite3.Row) else stage.get("title", "")).strip().lower()
    stage_kind = str(stage["stage_kind"] if isinstance(stage, sqlite3.Row) else stage.get("stage_kind", "work")).strip() or "work"
    category = classify_scope(title)
    base_map = {
        "prep": 3,
        "concrete": 8,
        "masonry": 7,
        "roof": 6,
        "facade": 7,
        "electrical": 8,
        "plumbing": 8,
        "ventilation": 9,
        "finishing": 10,
        "landscape": 5,
        "handover": 3,
        "general": 5,
    }
    base = base_map.get(category, 5)
    if stage_kind == "section":
        base = max(2, base - 2)
    elif stage_kind == "subsection":
        base = max(3, base - 1)
    total_cost = sum(float(item.get("planned_qty", 0) or 0) * float(item.get("planned_price", 0) or 0) for item in materials)
    total_qty = sum(float(item.get("planned_qty", 0) or 0) for item in materials)
    material_count = len(materials)
    duration = (
        base
        + count_threshold_hits(total_cost, [150_000, 400_000, 900_000, 1_800_000, 3_500_000])
        + count_threshold_hits(total_qty, [20, 60, 140, 260, 500])
        + count_threshold_hits(material_count, [2, 5, 9, 15])
    )
    if category == "handover":
        duration = max(2, duration - 1)
    return max(2 if stage_kind != "work" else 3, min(duration, 32 if stage_kind == "work" else 40))


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


def build_procurement_alerts(
    materials: list[dict],
    stages: list[sqlite3.Row],
    today_date: date,
    section_start_dates: dict[str, str] | None = None,
) -> dict:
    stage_map = {int(row["id"]): dict(row) for row in stages}
    section_start_dates = section_start_dates or {}
    alerts: list[dict] = []
    summary = {"critical": 0, "soon": 0, "watch": 0}
    for material in materials:
        if normalize_estimate_item_kind(material.get("itemKind", material.get("item_kind"))) == "work":
            continue
        missing_qty = float(material.get("missingQty", material.get("missing_qty", 0)) or 0)
        purchased_qty = float(material.get("purchasedQty", material.get("purchased_qty", 0)) or 0)
        received_qty = float(material.get("receivedQty", material.get("received_qty", 0)) or 0)
        # A purchase records an order, while a receipt confirms that the material
        # is physically on site.  Unordered demand must not be shown as in transit.
        to_receive_qty = max(purchased_qty - received_qty, 0)
        phase = "order" if missing_qty > 0 else ("delivery" if to_receive_qty > 0 else "done")
        if phase == "done":
            continue
        raw_stage_id = material.get("stageId", material.get("stage_id"))
        try:
            stage_id = int(raw_stage_id) if raw_stage_id not in (None, "", 0, "0") else 0
        except (TypeError, ValueError):
            stage_id = 0
        stage = stage_map.get(stage_id)
        section_title = str(material.get("sectionTitle") or "").strip()
        stage_start = parse_iso_date(str((stage or {}).get("planned_start") or material.get("stageStartDate") or ""))
        if not stage_start and section_title:
            stage_start = parse_iso_date(section_start_dates.get(section_title))

        explicit_need_on_site = parse_iso_date(
            str(material.get("needByDate") or material.get("need_by_date") or "")
        )
        need_on_site = explicit_need_on_site or stage_start
        if not need_on_site:
            continue

        estimated_lead_days = estimate_material_lead_days(material)
        raw_lead_days = material.get("deliveryDays")
        if raw_lead_days in (None, ""):
            raw_lead_days = material.get("delivery_days")
        try:
            lead_days = int(raw_lead_days) if raw_lead_days not in (None, "") else int(estimated_lead_days)
        except (TypeError, ValueError):
            lead_days = int(estimated_lead_days)
        lead_days = max(0, min(lead_days, 90))

        order_by = need_on_site - timedelta(days=lead_days)
        compatibility_start = stage_start or need_on_site
        days_until_start = (compatibility_start - today_date).days
        days_until_need = (need_on_site - today_date).days
        days_until_order = (order_by - today_date).days
        if phase == "order" and days_until_need > 30 and days_until_order > 14:
            continue
        if phase == "delivery" and days_until_need > 14:
            continue
        urgency_days = days_until_order if phase == "order" else days_until_need
        if urgency_days < 0:
            status = "critical"
            summary["critical"] += 1
        elif urgency_days <= 3:
            status = "soon"
            summary["soon"] += 1
        else:
            status = "watch"
            summary["watch"] += 1
        action_window_days = max(0, urgency_days)
        alerts.append(
            {
                "materialId": int(material.get("id") or 0),
                "title": str(material.get("title") or ""),
                "unit": str(material.get("unit") or ""),
                "missingQty": missing_qty,
                "toOrderQty": missing_qty,
                "toReceiveQty": to_receive_qty,
                "purchasedQty": purchased_qty,
                "receivedQty": received_qty,
                "phase": phase,
                "sectionTitle": section_title or str((stage or {}).get("title") or "").strip(),
                "stageTitle": str(material.get("stageTitle") or (stage or {}).get("title") or section_title or "").strip(),
                "startDate": compatibility_start.isoformat(),
                "needOnSiteDate": need_on_site.isoformat(),
                "orderByDate": order_by.isoformat(),
                "leadDays": int(lead_days),
                "daysUntilStart": int(days_until_start),
                "daysUntilNeed": int(days_until_need),
                "daysUntilOrder": int(days_until_order),
                "urgencyDays": int(urgency_days),
                "actionWindowDays": int(action_window_days),
                "status": status,
            }
        )
    status_priority = {"critical": 0, "soon": 1, "watch": 2}
    phase_priority = {"delivery": 0, "order": 1}
    alerts.sort(
        key=lambda item: (
            status_priority.get(item["status"], 3),
            item["urgencyDays"],
            item["daysUntilNeed"],
            phase_priority.get(item["phase"], 2),
            item["title"],
        )
    )
    return {"items": alerts[:10], "summary": summary}


def normalize_schedule_text(value: object) -> str:
    return str(value or "").strip().lower()


def classify_schedule_scope(text: str | None) -> str:
    normalized = normalize_schedule_text(text)
    for scope, keywords in SCHEDULE_SCOPE_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return scope
    return "general"


def infer_schedule_section_title(raw_section: str | None, title: str) -> str:
    section = canonical_estimate_section_title(raw_section)
    if section:
        return section
    normalized_title = normalize_schedule_text(title)
    if any(marker in normalized_title for marker in ("окн", "подокон", "жалюз", "откос", "фасад", "водоотлив", "отлив", "желоб", "уголк", "пвх")):
        return "Раздел 1. Окна и фасад"
    scope = classify_schedule_scope(title)
    mapping = {
        "facade": "Раздел 1. Окна и фасад",
        "concrete": "Раздел 1. Общестроительные работы",
        "electrical": "Раздел 1. Электромонтаж",
        "plumbing": "Раздел 1. Инженерные сети",
        "finishing": "Раздел 1. Отделка",
        "prep": "Раздел 1. Окна и фасад",
        "general": "Раздел 1. Прочие работы",
    }
    return mapping.get(scope, "Раздел 1. Прочие работы")


def schedule_unit_family(unit: str) -> str:
    text = normalize_schedule_text(unit)
    if "100 м3" in text:
        return "vol100"
    if text == "м3":
        return "vol1"
    if "100 м2" in text:
        return "area100"
    if text == "м2":
        return "area1"
    if "100 м" in text:
        return "len100"
    if text == "м":
        return "len1"
    if "100 шт" in text:
        return "pcs100"
    if text.endswith("шт") or text == "шт":
        return "pcs1"
    if "1т" in text or text == "т":
        return "ton"
    return "generic"


def normalized_schedule_qty(qty: float, unit_family: str) -> float:
    if unit_family == "pcs100" and qty >= 20:
        return qty / 100.0
    return qty


def schedule_item_value(item: sqlite3.Row | dict, *keys: str, default: object = None) -> object:
    available = set(item.keys()) if isinstance(item, sqlite3.Row) else set(item.keys())
    for key in keys:
        if key in available:
            value = item[key] if isinstance(item, sqlite3.Row) else item.get(key)
            if value not in (None, ""):
                return value
    return default


def positive_schedule_float(value: object) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def positive_schedule_int(value: object) -> int | None:
    number = positive_schedule_float(value)
    return max(1, int(round(number))) if number is not None else None


def positive_schedule_half_days(value: object) -> float | None:
    number = positive_schedule_float(value)
    if number is None:
        return None
    half_days = round(number * 2) / 2
    if abs(number - half_days) > 1e-9:
        return None
    return max(0.5, half_days)


def estimate_schedule_work_item(item: sqlite3.Row | dict) -> dict:
    title = str(schedule_item_value(item, "title", default="") or "").strip()
    unit = str(schedule_item_value(item, "unit", default="") or "").strip()
    qty = float(schedule_item_value(item, "planned_qty", "plannedQty", default=0) or 0)
    family = schedule_unit_family(unit)
    qty = normalized_schedule_qty(qty, family)
    text = normalize_schedule_text(title)
    explicit_hours = positive_schedule_float(schedule_item_value(item, "labor_hours_total", "laborHoursTotal"))
    explicit_crew = positive_schedule_int(schedule_item_value(item, "default_crew_size", "defaultCrewSize", "crew_size", "crewSize"))
    matched_rule = None
    for rule in SECTION_SCHEDULE_RULES:
        if all(keyword in text for keyword in rule["keywords"]):
            matched_rule = rule
            break
    if explicit_hours is not None:
        scope = classify_schedule_scope(" ".join([title, unit]))
        fallback = SECTION_SCHEDULE_FALLBACKS.get(scope, SECTION_SCHEDULE_FALLBACKS["general"])
        crew_size = explicit_crew or (int(matched_rule["crew_size"]) if matched_rule else int(fallback.get("crew_size", 3)))
        return {
            "hours": explicit_hours,
            "crew_size": crew_size,
            "source_label": "Всего чел/час из сметы",
            "source_url": "",
            "assumption": False,
            "confidence": "source",
            "method": "estimate_labor_hours",
        }
    if matched_rule:
        rule = matched_rule
        return {
            "hours": max(0.0, qty * float(rule["hours_per_qty"])),
            "crew_size": explicit_crew or int(rule["crew_size"]),
            "source_label": rule["source_label"],
            "source_url": rule["source_url"],
            "assumption": bool(rule["assumption"]),
            "confidence": "assumption" if rule["assumption"] else "norm",
            "method": "exact_norm",
        }
    scope = classify_schedule_scope(" ".join([title, unit]))
    fallback = SECTION_SCHEDULE_FALLBACKS.get(scope, SECTION_SCHEDULE_FALLBACKS["general"])
    rate = float(fallback.get(family, fallback.get("generic", 6.0)))
    return {
        "hours": max(0.0, qty * rate),
        "crew_size": explicit_crew or int(fallback.get("crew_size", 3)),
        "source_label": "Укрупнённая оценка по типу работ и единице измерения",
        "source_url": "",
        "assumption": True,
        "confidence": "assumption",
        "method": "heuristic",
    }


def calculate_schedule_work_duration(
    item: sqlite3.Row | dict,
    *,
    duration_override: object = None,
    crew_override: object = None,
) -> dict:
    estimate = estimate_schedule_work_item(item)
    crew_size = positive_schedule_int(crew_override) or max(1, int(estimate["crew_size"] or 1))
    labor_hours = max(0.0, float(estimate["hours"] or 0))
    auto_days = max(1, int(math.ceil(labor_hours / max(1, crew_size * SCHEDULE_SHIFT_HOURS))))
    manual_days = positive_schedule_half_days(duration_override)
    return {
        **estimate,
        "hours": round(labor_hours, 2),
        "crew_size": crew_size,
        "shift_hours": SCHEDULE_SHIFT_HOURS,
        "auto_days": auto_days,
        "duration_days": manual_days if manual_days is not None else auto_days,
        "is_duration_overridden": manual_days is not None,
        "is_crew_overridden": positive_schedule_int(crew_override) is not None,
    }


def build_section_schedule_forecast(
    project: sqlite3.Row,
    work_items: list[sqlite3.Row],
    start_at: date,
    overrides: dict[int, dict] | None = None,
) -> dict:
    overrides = overrides or {}
    sections: list[dict] = []
    by_title: dict[str, dict] = {}
    for row in work_items:
        row_keys = set(row.keys()) if isinstance(row, sqlite3.Row) else set(row)

        def row_value(key: str, default: object = None) -> object:
            return row[key] if key in row_keys else default

        section_title = infer_schedule_section_title(row["section_title"], str(row["title"] or ""))
        estimate_source_id = int(row_value("estimate_source_id") or 0)
        estimate_source_key = str(row_value("estimate_source_key") or "")
        bucket_key = f"{estimate_source_id}:{estimate_source_key}:{section_title.casefold()}"
        bucket = by_title.get(bucket_key)
        if not bucket:
            bucket = {
                "title": section_title,
                "estimate_source_id": estimate_source_id or None,
                "estimate_source_type": str(row_value("estimate_source_type") or "legacy"),
                "estimate_source_key": estimate_source_key,
                "estimate_source_external_id": str(row_value("estimate_source_external_id") or ""),
                "estimate_tender_id": str(row_value("estimate_tender_id") or ""),
                "estimate_title": str(row_value("estimate_title") or "Ранее загруженная смета"),
                "estimate_file_name": str(row_value("estimate_file_name") or "Смета объекта"),
                "estimate_source_reference": str(row_value("estimate_source_reference") or ""),
                "scope": classify_schedule_scope(section_title + " " + str(row["title"] or "")),
                "items": [],
                "estimated_hours": 0.0,
                "crew_size": 0,
                "source_map": {},
                "assumptions": False,
                "first_item_id": int(row["id"]),
            }
            by_title[bucket_key] = bucket
            sections.append(bucket)
        item_override = overrides.get(int(row["id"]), {})
        estimate = calculate_schedule_work_duration(
            row,
            duration_override=item_override.get("duration_days"),
            crew_override=item_override.get("crew_size"),
        )
        bucket["items"].append({
            "id": int(row["id"]),
            "title": str(row["title"] or ""),
            "unit": str(row["unit"] or ""),
            "planned_qty": float(row["planned_qty"] or 0),
            "actualQty": float(row["actual_qty"] or 0) if "actual_qty" in row.keys() else 0,
            "isCompleted": bool(row["is_completed"]) if "is_completed" in row.keys() else False,
            "estimated_hours": round(float(estimate["hours"]), 2),
            "laborHours": round(float(estimate["hours"]), 2),
            "crewSize": int(estimate["crew_size"]),
            "shiftHours": int(estimate["shift_hours"]),
            "autoDays": float(estimate["auto_days"]),
            "durationDays": float(estimate["duration_days"]),
            "isDurationOverridden": bool(estimate["is_duration_overridden"]),
            "isCrewOverridden": bool(estimate["is_crew_overridden"]),
            "confidence": estimate["confidence"],
            "method": estimate["method"],
            "assumption": bool(estimate["assumption"]),
            "source_label": estimate["source_label"],
            "source_url": estimate["source_url"],
        })
        bucket["estimated_hours"] += float(estimate["hours"])
        bucket["crew_size"] = max(int(bucket["crew_size"] or 0), int(estimate["crew_size"]))
        bucket["assumptions"] = bucket["assumptions"] or bool(estimate["assumption"])
        if estimate["source_label"] not in bucket["source_map"]:
            bucket["source_map"][estimate["source_label"]] = {
                "label": estimate["source_label"],
                "url": estimate["source_url"],
            }
    sections.sort(key=lambda item: (item["first_item_id"], item["title"]))

    cursor_half_days = 0
    total_hours = 0.0
    for section in sections:
        work_count = len(section["items"])
        buffered_hours = section["estimated_hours"]
        crew_size = max(1, int(section["crew_size"] or SECTION_SCHEDULE_FALLBACKS["general"]["crew_size"]))
        duration_half_days = max(1, sum(max(1, int(round(float(item["durationDays"]) * 2))) for item in section["items"]))
        duration_days = duration_half_days / 2
        section_start_offset = cursor_half_days // 2
        section_end_offset = (cursor_half_days + duration_half_days - 1) // 2
        section["estimated_hours"] = round(section["estimated_hours"], 1)
        section["buffered_hours"] = round(buffered_hours, 1)
        section["estimated_days"] = duration_days
        section["crew_size"] = crew_size
        section["start_date"] = (start_at + timedelta(days=section_start_offset)).isoformat()
        section["end_date"] = (start_at + timedelta(days=section_end_offset)).isoformat()
        section["sources"] = list(section["source_map"].values())
        section["work_items"] = work_count
        section.pop("source_map", None)
        section.pop("first_item_id", None)
        total_hours += buffered_hours
        cursor_half_days += duration_half_days

    total_days = math.ceil(cursor_half_days / 2) if sections else 0
    finish_at = start_at + timedelta(days=max(0, total_days - 1))
    return {
        "projectId": int(project["id"]),
        "startDate": start_at.isoformat(),
        "finishDate": finish_at.isoformat() if sections else start_at.isoformat(),
        "totalDays": total_days,
        "totalHours": round(total_hours, 1),
        "sections": [
            {
                "title": section["title"],
                "sectionId": (
                    f"estimate-{section['estimate_source_id']}:"
                    if section.get("estimate_source_id") else "legacy:"
                ) + normalize_progress_section_id(section["title"]),
                "estimateSourceId": section.get("estimate_source_id"),
                "estimateSourceType": section.get("estimate_source_type") or "legacy",
                "estimateSourceKey": section.get("estimate_source_key") or "",
                "estimateSourceExternalId": section.get("estimate_source_external_id") or "",
                "estimateTenderId": section.get("estimate_tender_id") or "",
                "estimateTitle": section.get("estimate_title") or "Ранее загруженная смета",
                "estimateFileName": section.get("estimate_file_name") or "Смета объекта",
                "estimateSourceReference": section.get("estimate_source_reference") or "",
                "scope": section["scope"],
                "crewSize": section["crew_size"],
                "estimatedHours": section["estimated_hours"],
                "bufferedHours": section["buffered_hours"],
                "estimatedDays": section["estimated_days"],
                "startDate": section["start_date"],
                "endDate": section["end_date"],
                "workItems": section["work_items"],
                "hasAssumptions": section["assumptions"],
                "sources": section["sources"],
                "items": section["items"],
            }
            for section in sections
        ],
    }


def load_work_schedule_overrides(
    con: sqlite3.Connection,
    project_id: int,
    schedule_context: str,
) -> dict[int, dict]:
    if "work_schedule_overrides" not in {
        str(row["name"]) for row in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    }:
        return {}
    rows = con.execute(
        """
        SELECT estimate_item_id, duration_days, crew_size
        FROM work_schedule_overrides
        WHERE project_id = ? AND schedule_context = ?
        """,
        (project_id, schedule_context),
    ).fetchall()
    return {
        int(row["estimate_item_id"]): {
            "duration_days": row["duration_days"],
            "crew_size": row["crew_size"],
        }
        for row in rows
    }


def build_production_schedule_payload(con: sqlite3.Connection, project_id: int) -> dict:
    project = con.execute("SELECT id, title FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        raise LookupError("project_not_found")
    live_where = live_estimate_items_where(con, "")
    columns = table_columns(con, "estimate_items")
    optional_columns = []
    if "labor_hours_total" in columns:
        optional_columns.append("labor_hours_total")
    if "default_crew_size" in columns:
        optional_columns.append("default_crew_size")
    optional_sql = (", " + ", ".join(optional_columns)) if optional_columns else ""
    raw_rows = con.execute(
        f"""
        SELECT id, title, unit, planned_qty, item_kind, section_title, article, notes{optional_sql}
        FROM estimate_items
        WHERE project_id = ? AND {live_where}
        ORDER BY id
        """,
        (project_id,),
    ).fetchall()
    work_rows = [row for row in raw_rows if normalize_estimate_item_kind(row["item_kind"]) == "work"]
    overrides = load_work_schedule_overrides(con, project_id, "production")
    table_names = {
        str(row["name"]) for row in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    }
    slots_by_item: dict[int, dict[int, bool]] = {}
    if "production_schedule_slot_overrides" in table_names:
        slot_rows = con.execute(
            """
            SELECT estimate_item_id, slot_number, is_filled
            FROM production_schedule_slot_overrides
            WHERE project_id = ?
            ORDER BY estimate_item_id, slot_number
            """,
            (project_id,),
        ).fetchall()
        for row in slot_rows:
            slots_by_item.setdefault(int(row["estimate_item_id"]), {})[int(row["slot_number"])] = bool(row["is_filled"])
    elif "production_schedule_cell_overrides" in table_names:
        legacy_rows = con.execute(
            """
            SELECT estimate_item_id, day_number, is_filled
            FROM production_schedule_cell_overrides
            WHERE project_id = ?
            ORDER BY estimate_item_id, day_number
            """,
            (project_id,),
        ).fetchall()
        for row in legacy_rows:
            item_slots = slots_by_item.setdefault(int(row["estimate_item_id"]), {})
            first_slot = int(row["day_number"]) * 2 - 1
            item_slots[first_slot] = bool(row["is_filled"])
            item_slots[first_slot + 1] = bool(row["is_filled"])

    cursor_slot = 1
    day_count = 0
    items: list[dict] = []
    for row in work_rows:
        item_id = int(row["id"])
        item_override = overrides.get(item_id, {})
        duration = calculate_schedule_work_duration(
            row,
            duration_override=item_override.get("duration_days"),
            crew_override=item_override.get("crew_size"),
        )
        duration_slots = max(1, int(round(float(duration["duration_days"]) * 2)))
        base_slots = set(range(cursor_slot, cursor_slot + duration_slots))
        effective_slots = set(base_slots)
        slot_overrides = slots_by_item.get(item_id, {})
        for slot_number, is_filled in slot_overrides.items():
            if is_filled:
                effective_slots.add(slot_number)
            else:
                effective_slots.discard(slot_number)
        auto_start_slot = cursor_slot
        auto_end_slot = cursor_slot + duration_slots - 1
        cursor_slot = auto_end_slot + 1
        if effective_slots:
            day_count = max(day_count, math.ceil(max(effective_slots) / 2))
        day_count = max(day_count, math.ceil(auto_end_slot / 2))
        items.append(
            {
                "id": item_id,
                "title": str(row["title"] or ""),
                "unit": str(row["unit"] or ""),
                "plannedQty": float(row["planned_qty"] or 0),
                "sectionTitle": canonical_estimate_section_title(row["section_title"] or ""),
                "crewSize": int(duration["crew_size"]),
                "peopleCount": int(duration["crew_size"]),
                "shiftCount": 1,
                "brigadeCount": 1,
                "shiftHours": int(duration["shift_hours"]),
                "autoDays": float(duration["auto_days"]),
                "durationDays": duration_slots / 2,
                "effectiveDays": len(effective_slots) / 2,
                "autoStartDay": math.ceil(auto_start_slot / 2),
                "autoEndDay": math.ceil(auto_end_slot / 2),
                "autoStartSlot": auto_start_slot,
                "autoEndSlot": auto_end_slot,
                "autoFilledSlots": sorted(base_slots),
                "filledSlots": sorted(effective_slots),
                "overriddenSlots": sorted(slot_overrides),
                "isDurationOverridden": bool(duration["is_duration_overridden"]),
                "isCrewOverridden": bool(duration["is_crew_overridden"]),
                "confidence": duration["confidence"],
                "method": duration["method"],
                "sourceLabel": duration["source_label"],
            }
        )
    return {
        "projectId": int(project["id"]),
        "projectTitle": str(project["title"] or ""),
        "shiftHours": SCHEDULE_SHIFT_HOURS,
        "dayCount": day_count,
        "autoDayCount": math.ceil(max(0, cursor_slot - 1) / 2),
        "autoSlotCount": max(0, cursor_slot - 1),
        "items": items,
    }


def stage_sort_key(stage: sqlite3.Row | dict) -> tuple[int, int]:
    if isinstance(stage, sqlite3.Row):
        return (int(stage["position"] or 0), int(stage["id"] or 0))
    return (int(stage.get("position", 0) or 0), int(stage.get("id", 0) or 0))


def build_auto_schedule_plan(project: sqlite3.Row, stages: list[sqlite3.Row], materials: list[sqlite3.Row], start_at: date) -> dict:
    stage_by_id = {int(stage["id"]): stage for stage in stages}
    children_map: dict[int | None, list[sqlite3.Row]] = {}
    for stage in stages:
        parent_id = int(stage["parent_id"]) if stage["parent_id"] and int(stage["parent_id"]) in stage_by_id else None
        children_map.setdefault(parent_id, []).append(stage)
    for children in children_map.values():
        children.sort(key=stage_sort_key)

    root_stage_by_id: dict[int, int] = {}

    def resolve_root_stage_id(stage_id: int | None) -> int | None:
        if not stage_id or stage_id not in stage_by_id:
            return None
        cached = root_stage_by_id.get(stage_id)
        if cached:
            return cached
        current = stage_by_id[stage_id]
        root_id = stage_id
        guard = 0
        while current and current["parent_id"] and guard < 50:
            parent_id = int(current["parent_id"])
            if parent_id not in stage_by_id:
                break
            root_id = parent_id
            current = stage_by_id[parent_id]
            guard += 1
        root_stage_by_id[stage_id] = root_id
        return root_id

    leaf_ids = {stage_id for stage_id in stage_by_id if stage_id not in children_map}
    candidate_stage_ids = [stage_id for stage_id in sorted(leaf_ids, key=lambda item: stage_sort_key(stage_by_id[item]))]
    work_items_by_stage: dict[int, list[dict]] = {}
    materials_by_stage: dict[int, list[dict]] = {}
    work_items_by_section: dict[str, list[dict]] = {}
    materials_by_section: dict[str, list[dict]] = {}
    auto_linked_materials: list[dict] = []

    section_stage_ids = [
        int(stage["id"])
        for stage in sorted(stages, key=stage_sort_key)
        if str(stage["stage_kind"] or "section").strip() == "section"
    ]

    def stage_scope(stage_id: int | None) -> str:
        if not stage_id or stage_id not in stage_by_id:
            return "general"
        stage = stage_by_id[stage_id]
        notes = str(stage["notes"] or "") if "notes" in stage.keys() else ""
        return classify_scope(" ".join([str(stage["title"] or ""), notes]))

    def choose_stage_for_item(item: dict) -> int | None:
        section_title = str(item.get("section_title") or item.get("sectionTitle") or "").strip()
        normalized_section = normalize_progress_section_id(section_title) if section_title else ""
        item_scope = classify_scope(" ".join([str(item.get("title", "")), str(item.get("notes", ""))]))
        scoped_candidates = candidate_stage_ids
        if normalized_section:
            section_candidates = [
                candidate_id
                for candidate_id in candidate_stage_ids
                if normalize_progress_section_id(str(stage_by_id[resolve_root_stage_id(candidate_id)]["title"])) == normalized_section
            ]
            if section_candidates:
                scoped_candidates = section_candidates
        if item_scope != "general":
            for candidate_id in scoped_candidates:
                if stage_scope(candidate_id) == item_scope:
                    return candidate_id
        if scoped_candidates:
            return scoped_candidates[0]
        if section_stage_ids and normalized_section:
            for section_id in section_stage_ids:
                if normalize_progress_section_id(str(stage_by_id[section_id]["title"])) == normalized_section:
                    return section_id
        if section_stage_ids:
            return section_stage_ids[0]
        return candidate_stage_ids[0] if candidate_stage_ids else None

    for raw in materials:
        item = dict(raw)
        item_kind = normalize_estimate_item_kind(item.get("item_kind", item.get("itemKind", "material")))
        stage_id = int(item["stage_id"]) if item.get("stage_id") and int(item["stage_id"]) in stage_by_id else None
        if not stage_id:
            stage_id = choose_stage_for_item(item)
            if stage_id and item_kind != "work":
                auto_linked_materials.append({"id": int(item["id"]), "stage_id": stage_id})
        if not stage_id:
            continue
        item["stage_id"] = stage_id
        root_stage_id = resolve_root_stage_id(stage_id)
        if item_kind == "work":
            work_items_by_stage.setdefault(stage_id, []).append(item)
            if root_stage_id:
                work_items_by_section.setdefault(normalize_progress_section_id(stage_by_id[root_stage_id]["title"]), []).append(item)
        else:
            materials_by_stage.setdefault(stage_id, []).append(item)
            if root_stage_id:
                materials_by_section.setdefault(normalize_progress_section_id(stage_by_id[root_stage_id]["title"]), []).append(item)

    descendant_stage_ids_cache: dict[int, list[int]] = {}

    def descendant_stage_ids(stage_id: int) -> list[int]:
        cached = descendant_stage_ids_cache.get(stage_id)
        if cached is not None:
            return cached
        result = [stage_id]
        for child in children_map.get(stage_id, []):
            result.extend(descendant_stage_ids(int(child["id"])))
        descendant_stage_ids_cache[stage_id] = result
        return result

    def collect_stage_work_items(stage_id: int) -> list[dict]:
        items: list[dict] = []
        seen_ids: set[int] = set()
        for candidate_id in descendant_stage_ids(stage_id):
            for item in work_items_by_stage.get(candidate_id, []):
                item_id = int(item["id"])
                if item_id in seen_ids:
                    continue
                seen_ids.add(item_id)
                items.append(item)
        if items:
            return items
        stage = stage_by_id[stage_id]
        if str(stage["stage_kind"] or "section").strip() != "section":
            return []
        root_stage_id = resolve_root_stage_id(stage_id)
        if root_stage_id:
            return list(work_items_by_section.get(normalize_progress_section_id(stage_by_id[root_stage_id]["title"]), []))
        return []

    def collect_stage_materials(stage_id: int) -> list[dict]:
        items: list[dict] = []
        seen_ids: set[int] = set()
        for candidate_id in descendant_stage_ids(stage_id):
            for item in materials_by_stage.get(candidate_id, []):
                item_id = int(item["id"])
                if item_id in seen_ids:
                    continue
                seen_ids.add(item_id)
                items.append(item)
        if items:
            return items
        stage = stage_by_id[stage_id]
        if str(stage["stage_kind"] or "section").strip() != "section":
            return []
        root_stage_id = resolve_root_stage_id(stage_id)
        if root_stage_id:
            return list(materials_by_section.get(normalize_progress_section_id(stage_by_id[root_stage_id]["title"]), []))
        return []

    def estimate_stage_duration_from_work(stage: sqlite3.Row, work_items: list[dict], linked_materials: list[dict]) -> int:
        if work_items:
            return max(1, sum(calculate_schedule_work_duration(work_item)["duration_days"] for work_item in work_items))
        return estimate_stage_duration(stage, linked_materials)

    stage_updates: list[dict] = []
    material_updates: list[dict] = []
    material_update_by_id: dict[int, dict] = {}

    def material_schedule_weight(material: dict) -> float:
        try:
            qty = float(material.get("planned_qty", material.get("plannedQty", 0)) or 0)
        except (TypeError, ValueError):
            qty = 0.0
        if qty > 0:
            return qty
        try:
            price = float(material.get("planned_price", material.get("plannedPrice", 0)) or 0)
        except (TypeError, ValueError):
            price = 0.0
        return max(price / 10000.0, 1.0)

    def material_stage_sort_key(material: dict) -> tuple[str, int]:
        title = str(material.get("title") or "").strip().lower()
        try:
            item_id = int(material.get("id") or 0)
        except (TypeError, ValueError):
            item_id = 0
        return (title, item_id)

    def material_need_date_for_stage(stage_start: date, stage_end: date, offset_days: int) -> date:
        duration_days = max((stage_end - stage_start).days + 1, 1)
        return stage_start + timedelta(days=max(0, min(offset_days, duration_days - 1)))

    def register_material_update(material: dict, stage_id: int, need_by_date: date) -> None:
        lead_days_raw = material.get("delivery_days", material.get("deliveryDays"))
        try:
            lead_days = int(lead_days_raw) if lead_days_raw not in (None, "") else int(estimate_material_lead_days(material))
        except (TypeError, ValueError):
            lead_days = int(estimate_material_lead_days(material))
        lead_days = max(0, min(lead_days, 90))
        purchase_start = need_by_date - timedelta(days=lead_days)
        update = {
            "id": int(material["id"]),
            "stage_id": stage_id,
            "need_by_date": need_by_date.isoformat(),
            "purchase_by_date": purchase_start.isoformat(),
            "lead_days": lead_days,
            "title": material["title"],
        }
        material_update_by_id[int(material["id"])] = update

    def register_stage_material_updates(stage_id: int, stage_start: date, stage_end: date) -> None:
        stage_materials = sorted(materials_by_stage.get(stage_id, []), key=material_stage_sort_key)
        if not stage_materials:
            return
        duration_days = max((stage_end - stage_start).days + 1, 1)
        total_weight = sum(material_schedule_weight(material) for material in stage_materials)
        if total_weight <= 0:
            total_weight = float(len(stage_materials))
        cursor_weight = 0.0
        for material in stage_materials:
            weight = material_schedule_weight(material)
            midpoint = cursor_weight + weight / 2.0
            offset = int((midpoint / total_weight) * duration_days)
            need_by_date = material_need_date_for_stage(stage_start, stage_end, offset)
            register_material_update(material, stage_id, need_by_date)
            cursor_weight += weight

    def walk(stage_id: int, cursor: date) -> tuple[date, date, date]:
        stage = stage_by_id[stage_id]
        child_nodes = children_map.get(stage_id, [])
        linked_work_items = collect_stage_work_items(stage_id)
        linked_materials = collect_stage_materials(stage_id)
        if child_nodes:
            stage_start = cursor
            first_start = None
            last_end = None
            child_cursor = cursor
            for child in child_nodes:
                child_start, child_end, child_cursor = walk(int(child["id"]), child_cursor)
                if first_start is None or child_start < first_start:
                    first_start = child_start
                if last_end is None or child_end > last_end:
                    last_end = child_end
            if first_start is None or last_end is None:
                duration = estimate_stage_duration_from_work(stage, linked_work_items, linked_materials)
                first_start = stage_start
                last_end = stage_start + timedelta(days=duration - 1)
                child_cursor = last_end + timedelta(days=1)
            start = first_start
            end = last_end
            next_cursor = child_cursor
        else:
            duration = estimate_stage_duration_from_work(stage, linked_work_items, linked_materials)
            start = cursor
            end = start + timedelta(days=duration - 1)
            next_cursor = end + timedelta(days=1)

        register_stage_material_updates(stage_id, start, end)

        duration_days = max((end - start).days + 1, 1)
        customer_shift = 0 if stage["stage_kind"] != "work" else min(2, max(0, duration_days // 10))
        customer_tail = min(2, max(0, duration_days // 12))
        depends_on_materials = bool(stage["depends_on_materials"]) or bool(linked_materials)
        stage_updates.append(
            {
                "id": stage_id,
                "planned_start": start.isoformat(),
                "planned_end": end.isoformat(),
                "customer_start": (start + timedelta(days=customer_shift)).isoformat(),
                "customer_end": (end + timedelta(days=customer_tail)).isoformat(),
                "depends_on_materials": 1 if depends_on_materials else 0,
                "duration_days": duration_days,
                "title": stage["title"],
            }
        )
        return start, end, next_cursor

    plan_start = None
    plan_end = None
    cursor = start_at
    root_stages = children_map.get(None, [])
    for root_stage in root_stages:
        section_start, section_end, cursor = walk(int(root_stage["id"]), cursor)
        if plan_start is None or section_start < plan_start:
            plan_start = section_start
        if plan_end is None or section_end > plan_end:
            plan_end = section_end

    sorted_material_updates = sorted(material_update_by_id.values(), key=lambda item: (item["need_by_date"], item["title"]))
    sorted_stage_updates = sorted(stage_updates, key=lambda item: (item["planned_start"], item["id"]))
    deadline_at = parse_iso_date(project["deadline_at"])
    deadline_overrun_days = 0
    if deadline_at and plan_end and plan_end > deadline_at:
        deadline_overrun_days = (plan_end - deadline_at).days
    return {
        "project_start": (plan_start or start_at).isoformat(),
        "project_end": (plan_end or start_at).isoformat(),
        "stage_updates": sorted_stage_updates,
        "material_updates": sorted_material_updates,
        "auto_linked_materials": auto_linked_materials,
        "deadline_overrun_days": deadline_overrun_days,
        "longest_stages": sorted(sorted_stage_updates, key=lambda item: item["duration_days"], reverse=True)[:5],
    }


def api_material_schedule(handler, path: str) -> None:
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
    query = urllib.parse.parse_qs(urllib.parse.urlparse(handler.path).query)
    try:
        warning_days = int(query.get("warningDays", query.get("warning_days", ["5"]))[0])
    except (TypeError, ValueError):
        warning_days = 5
    try:
        neutral_days = int(query.get("neutralDays", query.get("neutral_days", ["7"]))[0])
    except (TypeError, ValueError):
        neutral_days = 7
    warning_days = max(1, min(warning_days, 30))
    neutral_days = max(warning_days, min(max(neutral_days, 1), 60))
    fresh = str(query.get("fresh", [""])[0]).lower() in {"1", "true", "yes"}
    with db() as con:
        payload = None
        if not fresh:
            saved = con.execute(
                "SELECT payload, updated_at FROM material_schedule_snapshots WHERE project_id = ?",
                (project_id,),
            ).fetchone()
            if saved:
                try:
                    payload = json.loads(saved["payload"])
                    if isinstance(payload, dict):
                        payload["saved"] = True
                        payload["savedAt"] = saved["updated_at"]
                except (TypeError, ValueError, json.JSONDecodeError):
                    payload = None
        if payload is None:
            payload = build_material_schedule_payload(
                con,
                project_id,
                warning_days=warning_days,
                neutral_days=neutral_days,
            )
    handler.send_json(HTTPStatus.OK, payload)


def api_save_material_schedule(handler, path: str) -> None:
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
    payload = handler.read_json()
    warning_days = 5
    neutral_days = 7
    try:
        warning_days = int(payload.get("warningDays", payload.get("warning_days", warning_days)))
    except (TypeError, ValueError):
        warning_days = 5
    try:
        neutral_days = int(payload.get("neutralDays", payload.get("neutral_days", neutral_days)))
    except (TypeError, ValueError):
        neutral_days = 7
    warning_days = max(1, min(warning_days, 30))
    neutral_days = max(warning_days, min(max(neutral_days, 1), 60))
    schedule = payload.get("schedule")
    with db() as con:
        if not isinstance(schedule, dict) or not isinstance(schedule.get("items"), list):
            schedule = build_material_schedule_payload(
                con,
                project_id,
                warning_days=warning_days,
                neutral_days=neutral_days,
            )
        schedule["projectId"] = project_id
        schedule["saved"] = True
        schedule["savedAt"] = now_ts()
        now = now_ts()
        con.execute(
            """
            INSERT INTO material_schedule_snapshots (project_id, payload, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                payload = excluded.payload,
                created_by = excluded.created_by,
                updated_at = excluded.updated_at
            """,
            (project_id, json.dumps(schedule, ensure_ascii=False), user["id"], now, now),
        )
        create_audit(
            con,
            user["id"],
            "save_material_schedule",
            "project",
            project_id,
            {"items": len(schedule.get("items") or [])},
        )
        con.commit()
    handler.send_json(HTTPStatus.OK, schedule)


def api_project_auto_schedule(handler, path: str) -> None:
    try:
        return _api_project_auto_schedule(handler, path)
    except Exception as error:
        try:
            handler.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "auto_schedule_failed", "message": f"{error.__class__.__name__}: {error}"},
            )
        except Exception:
            raise


def _api_project_auto_schedule(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_schedule(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    with db() as con:
        project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        stages = con.execute(
            "SELECT * FROM work_stages WHERE project_id = ? ORDER BY position, id",
            (project_id,),
        ).fetchall()
        live_where = live_estimate_items_where(con, "")
        materials = con.execute(
            f"""
            SELECT id, title, unit, planned_qty, planned_price, stage_id, item_kind, section_title,
                   delivery_days, need_by_date, notes, labor_hours_total, default_crew_size
            FROM estimate_items
            WHERE project_id = ? AND {live_where}
            ORDER BY id
            """,
            (project_id,),
        ).fetchall()
        if not stages:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "stages_required"})
            return
        if not materials:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "materials_required"})
            return
        requested_start_raw = str(payload.get("start_date", payload.get("startDate", "")) or "").strip()
        requested_start = None
        if requested_start_raw:
            try:
                requested_start = datetime.strptime(requested_start_raw[:10], "%Y-%m-%d").date()
            except (TypeError, ValueError):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_start_date", "message": "start_date must be YYYY-MM-DD"})
                return
        project_start = parse_iso_date(project["started_at"])
        start_at = requested_start or project_start or date(2026, 7, 25)
        plan = build_auto_schedule_plan(project, stages, materials, start_at)
        con.execute(
            f"""
            UPDATE estimate_items
            SET need_by_date = NULL, updated_at = ?
            WHERE project_id = ?
              AND {live_where}
              AND lower(COALESCE(item_kind, 'material')) != 'work'
            """,
            (now_ts(), project_id),
        )
        con.execute("DELETE FROM material_schedule_snapshots WHERE project_id = ?", (project_id,))
        for item in plan["stage_updates"]:
            con.execute(
                """
                UPDATE work_stages
                SET planned_start = ?, planned_end = ?, customer_start = ?, customer_end = ?,
                    depends_on_materials = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    item["planned_start"],
                    item["planned_end"],
                    item["customer_start"],
                    item["customer_end"],
                    item["depends_on_materials"],
                    now_ts(),
                    item["id"],
                ),
            )
        auto_stage_map = {item["id"]: item["stage_id"] for item in plan["auto_linked_materials"]}
        for item in plan["material_updates"]:
            target_stage_id = auto_stage_map.get(item["id"])
            if target_stage_id:
                con.execute(
                    """
                    UPDATE estimate_items
                    SET stage_id = ?, need_by_date = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (target_stage_id, item["need_by_date"], now_ts(), item["id"]),
                )
            else:
                con.execute(
                    "UPDATE estimate_items SET need_by_date = ?, updated_at = ? WHERE id = ?",
                    (item["need_by_date"], now_ts(), item["id"]),
                )
        if project["started_at"] != plan["project_start"] or project["deadline_at"] != plan["project_end"]:
            con.execute(
                "UPDATE projects SET started_at = ?, deadline_at = ?, updated_at = ? WHERE id = ?",
                (plan["project_start"], plan["project_end"], now_ts(), project_id),
            )
        mark_project_schedule_draft(con, project_id, generated_at=TODAY_ISO)
        material_schedule = build_material_schedule_payload(con, project_id)
        material_schedule["saved"] = True
        material_schedule["savedAt"] = now_ts()
        con.execute(
            """
            INSERT INTO material_schedule_snapshots (project_id, payload, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                payload = excluded.payload,
                created_by = excluded.created_by,
                updated_at = excluded.updated_at
            """,
            (project_id, json.dumps(material_schedule, ensure_ascii=False), user["id"], now_ts(), now_ts()),
        )
        create_audit(
            con,
            user["id"],
            "auto_schedule_project",
            "project",
            project_id,
            {
                "start_date": plan["project_start"],
                "finish_date": plan["project_end"],
                "auto_linked_materials": len(plan["auto_linked_materials"]),
                "deadline_overrun_days": plan["deadline_overrun_days"],
            },
        )
        con.commit()
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    handler.send_json(
        HTTPStatus.OK,
        {
            "ok": True,
            "projectId": project_id,
            "project": serialize_project(project_row, user),
            "summary": {
                "projectStart": plan["project_start"],
                "projectEnd": plan["project_end"],
                "stagesPlanned": len(plan["stage_updates"]),
                "materialsPlanned": len(plan["material_updates"]),
                "materialsAutoLinked": len(plan["auto_linked_materials"]),
                "deadlineOverrunDays": plan["deadline_overrun_days"],
            },
        },
    )


def api_project_section_schedule_forecast(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    payload = handler.read_json()
    requested_start = parse_iso_date(payload.get("start_date", payload.get("startDate")))
    with db() as con:
        project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        live_where = live_estimate_items_where(con, "e")
        columns = table_columns(con, "estimate_items")
        optional_columns = []
        if "labor_hours_total" in columns:
            optional_columns.append("e.labor_hours_total")
        if "default_crew_size" in columns:
            optional_columns.append("e.default_crew_size")
        table_names = {
            str(item["name"])
            for item in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
        }
        has_estimate_sources = "estimate_source_id" in columns and "project_estimates" in table_names
        if has_estimate_sources:
            optional_columns.extend(
                [
                    "e.estimate_source_id",
                    "source.source_type AS estimate_source_type",
                    "source.source_key AS estimate_source_key",
                    "source.external_id AS estimate_source_external_id",
                    "source.tender_id AS estimate_tender_id",
                    "source.title AS estimate_title",
                    "source.file_name AS estimate_file_name",
                    "source.source_reference AS estimate_source_reference",
                ]
            )
        optional_sql = (", " + ", ".join(optional_columns)) if optional_columns else ""
        estimate_source_join = (
            "LEFT JOIN project_estimates source ON source.id = e.estimate_source_id AND source.project_id = e.project_id"
            if has_estimate_sources else ""
        )
        rows = con.execute(
            f"""
            SELECT e.id, e.title, e.unit, e.planned_qty, e.item_kind, e.section_title, e.is_completed, e.actual_qty{optional_sql}
            FROM estimate_items e
            {estimate_source_join}
            WHERE e.project_id = ? AND {live_where}
            ORDER BY e.id
            """,
            (project_id,),
        ).fetchall()
        overrides = load_work_schedule_overrides(con, project_id, "graph")
    work_items = [
        row
        for row in rows
        if normalize_estimate_item_kind(row["item_kind"]) == "work"
    ]
    if not work_items:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "works_required"})
        return
    project_start = parse_iso_date(project["started_at"])
    start_at = requested_start or project_start or date(2026, 7, 27)
    forecast = build_section_schedule_forecast(project, work_items, start_at, overrides)
    handler.send_json(HTTPStatus.OK, forecast)


def api_update_section_schedule_override(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_schedule(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    try:
        item_id = int(payload.get("item_id", payload.get("itemId")))
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_item_id"})
        return
    raw_duration_days = payload.get("duration_days", payload.get("durationDays"))
    duration_days = positive_schedule_half_days(raw_duration_days)
    crew_size = positive_schedule_int(payload.get("crew_size", payload.get("crewSize")))
    reset = bool(payload.get("reset"))
    if raw_duration_days not in (None, "") and duration_days is None:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_duration_days"})
        return
    if duration_days is not None and duration_days > 3650:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_duration_days"})
        return
    if crew_size is not None and crew_size > 100:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_crew_size"})
        return
    with db() as con:
        item = con.execute(
            "SELECT id, item_kind FROM estimate_items WHERE id = ? AND project_id = ?",
            (item_id, project_id),
        ).fetchone()
        if not item or normalize_estimate_item_kind(item["item_kind"]) != "work":
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "work_not_found"})
            return
        if reset or (duration_days is None and crew_size is None):
            con.execute(
                "DELETE FROM work_schedule_overrides WHERE project_id = ? AND estimate_item_id = ? AND schedule_context = 'graph'",
                (project_id, item_id),
            )
        else:
            con.execute(
                """
                INSERT INTO work_schedule_overrides (
                    project_id, estimate_item_id, schedule_context, duration_days, crew_size,
                    updated_by, created_at, updated_at
                )
                VALUES (?, ?, 'graph', ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, estimate_item_id, schedule_context) DO UPDATE SET
                    duration_days = excluded.duration_days,
                    crew_size = excluded.crew_size,
                    updated_by = excluded.updated_by,
                    updated_at = excluded.updated_at
                """,
                (project_id, item_id, duration_days, crew_size, user["id"], now_ts(), now_ts()),
            )
        mark_project_schedule_draft(con, project_id)
        create_audit(
            con,
            user["id"],
            "update_graph_schedule_duration",
            "estimate_item",
            item_id,
            {"project_id": project_id, "duration_days": duration_days, "crew_size": crew_size, "reset": reset},
        )
        con.commit()
    handler.send_json(HTTPStatus.OK, {"ok": True, "projectId": project_id, "itemId": item_id})


def api_production_schedule(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        try:
            schedule = build_production_schedule_payload(con, project_id)
        except LookupError:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
    handler.send_json(HTTPStatus.OK, schedule)


def api_update_production_schedule(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_schedule(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    action = str(payload.get("action") or "set_cell").strip().lower()
    with db() as con:
        if not con.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone():
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        audit_payload: dict = {"project_id": project_id, "action": action}
        if action == "set_cell":
            try:
                item_id = int(payload.get("item_id", payload.get("itemId")))
                slot_number = int(payload.get("slot_number", payload.get("slotNumber")))
            except (TypeError, ValueError):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_cell"})
                return
            if slot_number < 1 or slot_number > 7300:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_slot_number"})
                return
            item = con.execute(
                "SELECT id, item_kind FROM estimate_items WHERE id = ? AND project_id = ?",
                (item_id, project_id),
            ).fetchone()
            if not item or normalize_estimate_item_kind(item["item_kind"]) != "work":
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "work_not_found"})
                return
            is_filled = 1 if payload.get("is_filled", payload.get("isFilled", False)) else 0
            con.execute(
                """
                INSERT INTO production_schedule_slot_overrides (
                    project_id, estimate_item_id, slot_number, is_filled, updated_by, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, estimate_item_id, slot_number) DO UPDATE SET
                    is_filled = excluded.is_filled,
                    updated_by = excluded.updated_by,
                    updated_at = excluded.updated_at
                """,
                (project_id, item_id, slot_number, is_filled, user["id"], now_ts(), now_ts()),
            )
            audit_payload.update({"item_id": item_id, "slot_number": slot_number, "is_filled": bool(is_filled)})
        elif action == "set_duration":
            try:
                item_id = int(payload.get("item_id", payload.get("itemId")))
            except (TypeError, ValueError):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_item_id"})
                return
            duration_days = positive_schedule_half_days(payload.get("duration_days", payload.get("durationDays")))
            if duration_days is None or duration_days > 3650:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_duration_days"})
                return
            item = con.execute(
                "SELECT id, item_kind FROM estimate_items WHERE id = ? AND project_id = ?",
                (item_id, project_id),
            ).fetchone()
            if not item or normalize_estimate_item_kind(item["item_kind"]) != "work":
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "work_not_found"})
                return
            con.execute(
                """
                INSERT INTO work_schedule_overrides (
                    project_id, estimate_item_id, schedule_context, duration_days, updated_by, created_at, updated_at
                )
                VALUES (?, ?, 'production', ?, ?, ?, ?)
                ON CONFLICT(project_id, estimate_item_id, schedule_context) DO UPDATE SET
                    duration_days = excluded.duration_days,
                    updated_by = excluded.updated_by,
                    updated_at = excluded.updated_at
                """,
                (project_id, item_id, duration_days, user["id"], now_ts(), now_ts()),
            )
            audit_payload.update({"item_id": item_id, "duration_days": duration_days})
        elif action in {"reset_cells", "reset_all", "recalculate"}:
            con.execute("DELETE FROM production_schedule_cell_overrides WHERE project_id = ?", (project_id,))
            con.execute("DELETE FROM production_schedule_slot_overrides WHERE project_id = ?", (project_id,))
            if action in {"reset_all", "recalculate"}:
                con.execute(
                    "DELETE FROM work_schedule_overrides WHERE project_id = ? AND schedule_context = 'production'",
                    (project_id,),
                )
        else:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_action"})
            return
        mark_project_schedule_draft(con, project_id)
        create_audit(con, user["id"], "update_production_schedule", "project", project_id, audit_payload)
        con.commit()
        schedule = build_production_schedule_payload(con, project_id)
    handler.send_json(HTTPStatus.OK, schedule)


def api_project_schedule_status(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
        return
    handler.send_json(HTTPStatus.OK, {"scheduleControl": project_schedule_payload(project)})


def api_update_project_schedule_status(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_schedule(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    schedule_type = str(payload.get("schedule_type", payload.get("scheduleType", "internal"))).strip() or "internal"
    action = str(payload.get("action", "approve")).strip() or "approve"
    if schedule_type not in {"internal", "customer", "both"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_schedule_type"})
        return
    if action not in {"approve", "reset_to_draft"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_action"})
        return
    with db() as con:
        project = update_project_schedule_status(con, project_id, schedule_type, action)
        if not project:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        create_audit(
            con,
            user["id"],
            "update_project_schedule_status",
            "project",
            project_id,
            {"schedule_type": schedule_type, "action": action},
        )
        con.commit()
    handler.send_json(HTTPStatus.OK, {"project": serialize_project(project, user)})


def api_project_stages(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    with db() as con:
        if user["role"] == "customer":
            rows = con.execute(
                """
                SELECT *
                FROM work_stages
                WHERE project_id = ? AND is_client_visible = 1
                ORDER BY position, id
                """,
                (project_id,),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM work_stages WHERE project_id = ? ORDER BY position, id",
                (project_id,),
            ).fetchall()
    handler.send_json(HTTPStatus.OK, {"stages": [dict(row) for row in rows]})


def api_create_project_stage(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_can_manage_documents(user):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    title = str(payload.get("title", "")).strip()
    stage_kind = str(payload.get("stage_kind", payload.get("stageKind", "section"))).strip() or "section"
    if not title or stage_kind not in {"section", "subsection", "work"}:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_stage_data"})
        return
    parent_id = payload.get("parent_id", payload.get("parentId"))
    try:
        parent_id = int(parent_id) if parent_id not in (None, "", 0, "0") else None
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_parent_id"})
        return
    with db() as con:
        project = con.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        if parent_id:
            parent = con.execute(
                "SELECT id FROM work_stages WHERE id = ? AND project_id = ?",
                (parent_id, project_id),
            ).fetchone()
            if not parent:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "parent_not_found"})
                return
        next_position = con.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM work_stages WHERE project_id = ?",
            (project_id,),
        ).fetchone()[0]
        cur = con.execute(
            """
            INSERT INTO work_stages (
                project_id, title, position, parent_id, stage_kind, status_code,
                planned_start, planned_end, customer_start, customer_end, progress,
                responsible, notes, is_client_visible, depends_on_materials, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                title,
                int(payload.get("position", next_position) or next_position),
                parent_id,
                stage_kind,
                str(payload.get("status_code", payload.get("statusCode", "not_started"))).strip() or "not_started",
                str(payload.get("planned_start", payload.get("plannedStart", ""))).strip() or None,
                str(payload.get("planned_end", payload.get("plannedEnd", ""))).strip() or None,
                str(payload.get("customer_start", payload.get("customerStart", ""))).strip() or None,
                str(payload.get("customer_end", payload.get("customerEnd", ""))).strip() or None,
                max(0, min(100, int(payload.get("progress", 0) or 0))),
                str(payload.get("responsible", "")).strip() or None,
                str(payload.get("notes", "")).strip() or None,
                1 if payload.get("is_client_visible", payload.get("isClientVisible", True)) else 0,
                1 if payload.get("depends_on_materials", payload.get("dependsOnMaterials", False)) else 0,
                now_ts(),
                now_ts(),
            ),
        )
        mark_project_schedule_draft(con, project_id)
        create_audit(con, user["id"], "create_stage", "work_stage", cur.lastrowid, {"project_id": project_id, "title": title, "stage_kind": stage_kind})
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        row = con.execute("SELECT * FROM work_stages WHERE id = ?", (cur.lastrowid,)).fetchone()
        con.commit()
    handler.send_json(HTTPStatus.CREATED, {"stage": dict(row), "project": serialize_project(project_row, user)})


def api_update_stage(handler, path: str) -> None:
    stage_id = parse_path_int(path, 2)
    if not stage_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
        return
    payload = handler.read_json()
    with db() as con:
        stage = con.execute("SELECT * FROM work_stages WHERE id = ?", (stage_id,)).fetchone()
        if not stage:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "stage_not_found"})
            return
        user = handler.require_project_access(int(stage["project_id"]))
        if not user:
            return
        if not user_can_manage_documents(user):
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        status_code = str(payload.get("status_code", payload.get("statusCode", stage["status_code"]))).strip() or "not_started"
        if status_code not in {"not_started", "started", "in_progress", "completed", "approved", "blocked", "overdue"}:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_status"})
            return
        progress = max(0, min(100, int(payload.get("progress", stage["progress"]) or 0)))
        con.execute(
            """
            UPDATE work_stages
            SET title = ?, stage_kind = ?, status_code = ?, planned_start = ?, planned_end = ?,
                customer_start = ?, customer_end = ?, fact_start = ?, fact_end = ?, progress = ?,
                responsible = ?, notes = ?, is_client_visible = ?, depends_on_materials = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                str(payload.get("title", stage["title"])).strip() or stage["title"],
                str(payload.get("stage_kind", payload.get("stageKind", stage["stage_kind"]))).strip() or stage["stage_kind"],
                status_code,
                str(payload.get("planned_start", payload.get("plannedStart", stage["planned_start"] or ""))).strip() or None,
                str(payload.get("planned_end", payload.get("plannedEnd", stage["planned_end"] or ""))).strip() or None,
                str(payload.get("customer_start", payload.get("customerStart", stage["customer_start"] or ""))).strip() or None,
                str(payload.get("customer_end", payload.get("customerEnd", stage["customer_end"] or ""))).strip() or None,
                str(payload.get("fact_start", payload.get("factStart", stage["fact_start"] or ""))).strip() or None,
                str(payload.get("fact_end", payload.get("factEnd", stage["fact_end"] or ""))).strip() or None,
                progress,
                str(payload.get("responsible", stage["responsible"] or "")).strip() or None,
                str(payload.get("notes", stage["notes"] or "")).strip() or None,
                1 if payload.get("is_client_visible", payload.get("isClientVisible", bool(stage["is_client_visible"]))) else 0,
                1 if payload.get("depends_on_materials", payload.get("dependsOnMaterials", bool(stage["depends_on_materials"]))) else 0,
                now_ts(),
                stage_id,
            ),
        )
        mark_project_schedule_draft(con, int(stage["project_id"]))
        create_audit(con, user["id"], "update_stage", "work_stage", stage_id, {"project_id": stage["project_id"], "status_code": status_code, "progress": progress})
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (stage["project_id"],)).fetchone()
        row = con.execute("SELECT * FROM work_stages WHERE id = ?", (stage_id,)).fetchone()
        con.commit()
    handler.send_json(HTTPStatus.OK, {"stage": dict(row), "project": serialize_project(project_row, user)})


def api_update_estimate_item_completion(handler, path: str) -> None:
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
    payload = handler.read_json()
    item_id = payload.get("item_id", payload.get("itemId"))
    section_title = str(payload.get("section_title", payload.get("sectionTitle", "")) or "").strip()
    is_completed = 1 if payload.get("completed", payload.get("isCompleted", False)) else 0
    actual_qty = payload.get("actual_qty", payload.get("actualQty"))
    try:
        item_id = int(item_id) if item_id not in (None, "", 0, "0") else None
    except (TypeError, ValueError):
        item_id = None
    with db() as con:
        row = None
        if item_id:
            row = con.execute("SELECT * FROM estimate_items WHERE id = ? AND project_id = ?", (item_id, project_id)).fetchone()
        if not row:
            title = str(payload.get("title", "") or "").strip()
            unit = str(payload.get("unit", "") or "").strip()
            item_kind = normalize_estimate_item_kind(payload.get("kind", payload.get("itemKind", "")))
            candidates = con.execute(
                """
                SELECT *
                FROM estimate_items
                WHERE project_id = ? AND lower(title) = lower(?) AND (? = '' OR unit = ?)
                ORDER BY CASE WHEN lower(COALESCE(section_title, '')) = lower(?) THEN 0 ELSE 1 END, id
                LIMIT 1
                """,
                (project_id, title, unit, unit, section_title),
            ).fetchall() if title else []
            row = next((item for item in candidates if not item_kind or normalize_estimate_item_kind(resolved_estimate_item_kind(item)) == item_kind), None)
        if not row:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "estimate_item_not_found"})
            return
        planned_qty = float(row["planned_qty"] or 0)
        try:
            actual_value = float(actual_qty) if actual_qty not in (None, "") else (planned_qty if is_completed else 0.0)
        except (TypeError, ValueError):
            actual_value = planned_qty if is_completed else 0.0
        actual_value = max(0.0, min(actual_value, planned_qty if planned_qty > 0 else actual_value))
        if planned_qty > 0 and actual_value >= planned_qty:
            is_completed = 1
        con.execute(
            "UPDATE estimate_items SET is_completed = ?, actual_qty = ?, updated_at = ? WHERE id = ?",
            (is_completed, actual_value, now_ts(), row["id"]),
        )
        section_name = section_title or estimate_row_section_title(con, row)
        progress = recalc_project_progress(con, project_id, section_name)
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        items = material_summary_rows(con, project_id)
        create_audit(con, user["id"], "update_progress_item", "estimate_item", int(row["id"]), {"project_id": project_id, "completed": bool(is_completed), "section_id": progress["section"]["sectionId"] if progress["section"] else None})
        con.commit()
    handler.send_json(HTTPStatus.OK, {"id": int(row["id"]), "items": items, "progress": progress, "project": serialize_project(project_row, user)})


def table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    return {str(row["name"]) for row in con.execute(f"PRAGMA table_info({table})").fetchall()}


def api_project_section_bulk_complete(handler, path: str) -> None:
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
    payload = handler.read_json()
    path_parts = path.strip("/").split("/")
    path_section_raw = ""
    if len(path_parts) >= 6 and path_parts[3] == "sections":
        path_section_raw = urllib.parse.unquote(path_parts[4])
    path_section_int = parse_path_int(path, 4)
    section_raw = path_section_raw or str(payload.get("section_id", payload.get("sectionId", "")) or "")
    section_title_raw = str(payload.get("section_title", payload.get("sectionTitle", "")) or "")
    section_id = normalize_progress_section_id(section_raw or section_title_raw)
    completed = 1 if payload.get("completed", True) else 0
    raw_item_ids = payload.get("item_ids", payload.get("itemIds", []))
    item_ids: list[int] = []
    if isinstance(raw_item_ids, list):
        for raw_id in raw_item_ids:
            try:
                item_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            if item_id > 0 and item_id not in item_ids:
                item_ids.append(item_id)
    if not section_raw and not section_title_raw and not item_ids:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "section_required"})
        return
    with db() as con:
        rows = con.execute(f"SELECT * FROM estimate_items WHERE project_id = ? AND {live_estimate_items_where(con, '')}", (project_id,)).fetchall()
        stages = con.execute("SELECT id, title, parent_id FROM work_stages WHERE project_id = ?", (project_id,)).fetchall()
        stage_by_id = {int(stage["id"]): stage for stage in stages}
        matched_stage_ids: set[int] = set()
        if path_section_int and path_section_int in stage_by_id:
            matched_stage_ids.add(path_section_int)
            stage_title = str(stage_by_id[path_section_int]["title"] or "").strip()
            if stage_title:
                section_id = normalize_progress_section_id(stage_title)
                section_title_raw = section_title_raw or stage_title
        for stage in stages:
            title = str(stage["title"] or "").strip()
            if section_id and normalize_progress_section_id(title) == section_id:
                matched_stage_ids.add(int(stage["id"]))

        def root_stage_id(stage_id: int | None) -> int | None:
            current = stage_by_id.get(int(stage_id or 0))
            root = current
            guard = 0
            while current and current["parent_id"] and guard < 20:
                parent = stage_by_id.get(int(current["parent_id"]))
                if not parent:
                    break
                root = parent
                current = parent
                guard += 1
            return int(root["id"]) if root else None

        project_item_ids = {int(row["id"]) for row in rows}
        target_ids = [item_id for item_id in item_ids if item_id in project_item_ids]
        if not target_ids:
            for row in rows:
                row_stage_id = int(row["stage_id"] or 0) if row["stage_id"] else None
                row_section_id = normalize_progress_section_id(estimate_row_section_title(con, row))
                direct_section_id = normalize_progress_section_id(row["section_title"] or "")
                row_root_stage_id = root_stage_id(row_stage_id)
                if (
                    (section_id and (row_section_id == section_id or direct_section_id == section_id))
                    or (path_section_int and row_stage_id == path_section_int)
                    or (row_root_stage_id and row_root_stage_id in matched_stage_ids)
                ):
                    target_ids.append(int(row["id"]))
        for item_id in sorted(set(target_ids)):
            con.execute(
                """
                UPDATE estimate_items
                SET is_completed = ?,
                    actual_qty = CASE WHEN ? = 1 THEN planned_qty ELSE 0 END,
                    procurement_status = CASE WHEN ? = 1 THEN ? ELSE procurement_status END,
                    updated_at = ?
                WHERE id = ? AND project_id = ?
                """,
                (completed, completed, completed, "Закуплено", now_ts(), item_id, project_id),
            )
        for stage_id in matched_stage_ids:
            con.execute(
                "UPDATE work_stages SET progress = ?, status_code = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                (100 if completed else 0, "completed" if completed else "not_started", now_ts(), stage_id, project_id),
            )

        task_cols = table_columns(con, "tasks")
        task_completed_sql = ", completed_at = ?" if "completed_at" in task_cols else ""
        task_completed_args = ((now_iso() if completed else None),) if "completed_at" in task_cols else ()
        if "section_id" in task_cols and path_section_int:
            con.execute(
                "UPDATE tasks SET status = ?, updated_at = ?" + task_completed_sql + " WHERE project_id = ? AND section_id = ?",
                ("done" if completed else "open", now_ts(), *task_completed_args, project_id, path_section_int),
            )
        elif "section_title" in task_cols and (section_title_raw or section_id):
            con.execute(
                "UPDATE tasks SET status = ?, updated_at = ?" + task_completed_sql + " WHERE project_id = ? AND lower(trim(section_title)) = lower(trim(?))",
                ("done" if completed else "open", now_ts(), *task_completed_args, project_id, section_title_raw or section_raw),
            )
        elif "stage_id" in task_cols and matched_stage_ids:
            placeholders = ",".join("?" for _ in matched_stage_ids)
            con.execute(
                f"UPDATE tasks SET status = ?, updated_at = ?{task_completed_sql} WHERE project_id = ? AND stage_id IN ({placeholders})",
                ("done" if completed else "open", now_ts(), *task_completed_args, project_id, *sorted(matched_stage_ids)),
            )

        section_title = section_title_raw or section_raw
        if target_ids:
            section_title = estimate_row_section_title(con, next(row for row in rows if int(row["id"]) in target_ids))
        elif matched_stage_ids:
            section_title = str(stage_by_id[sorted(matched_stage_ids)[0]]["title"] or section_title).strip()
        progress = recalc_project_progress(con, project_id, section_title)
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        items = material_summary_rows(con, project_id)
        create_audit(con, user["id"], "bulk_complete_section", "project", project_id, {"section_id": section_id, "path_section_id": path_section_int, "completed": bool(completed), "items": len(target_ids)})
        con.execute(
            """
            INSERT INTO daily_logs (
                project_id, report_date, title, work_done, workers_count, equipment, blockers, next_steps,
                progress_percent, raw_input, is_client_visible, created_by, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                TODAY_ISO,
                "Групповое закрытие раздела" if completed else "Раздел снят с выполнения",
                f"Раздел «{section_title}»: {'выполнены/закуплены' if completed else 'сняты с выполнения'} все позиции ({len(target_ids)} шт.).",
                0,
                "",
                "",
                "",
                progress.get("totalProjectPercent"),
                json.dumps({"section_id": section_id, "path_section_id": path_section_int, "completed": bool(completed), "items": len(target_ids)}, ensure_ascii=False),
                1,
                user["id"],
                now_ts(),
                now_ts(),
            ),
        )
        con.commit()
    handler.send_json(
        HTTPStatus.OK,
        {
            "success": True,
            "section_id": section_id,
            "project_progress": progress.get("totalProjectPercent", progress.get("projectProgress", 0)),
            "items": items,
            "progress": progress,
            "project": serialize_project(project_row, user),
        },
    )


def api_bulk_complete_section(handler, path: str) -> None:
    return api_project_section_bulk_complete(handler, path)


def api_project_tasks(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if user["role"] == "customer":
        handler.send_json(HTTPStatus.OK, {"tasks": []})
        return
    with db() as con:
        rows = con.execute(
            """
            SELECT t.*, u.name AS assignee_name, u.first_name AS assignee_first_name, u.last_name AS assignee_last_name, u.login AS assignee_login
            FROM tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.project_id = ?
            ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, t.id DESC
            """,
            (project_id,),
        ).fetchall()
    handler.send_json(HTTPStatus.OK, {"tasks": [
        {
            **dict(row),
            "assignee_name": display_user_name(row["assignee_name"], row["assignee_first_name"], row["assignee_last_name"], row["assignee_login"]),
        }
        for row in rows
    ]})


def api_create_task(handler, path: str) -> None:
    project_id = parse_path_int(path, 2)
    if not project_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
        return
    user = handler.require_project_access(project_id)
    if not user:
        return
    if not user_has_any_role(user, {"admin", "director"}):
        handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
        return
    payload = handler.read_json()
    title = str(payload.get("title", "")).strip()
    if not title:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_required"})
        return
    assignee_id = payload.get("assignee_id", payload.get("assigneeId"))
    try:
        assignee_id = int(assignee_id) if assignee_id not in (None, "", 0, "0") else None
    except (TypeError, ValueError):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_assignee_id"})
        return
    with db() as con:
        if assignee_id:
            assignee = con.execute("SELECT id FROM users WHERE id = ?", (assignee_id,)).fetchone()
            if not assignee:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "assignee_not_found"})
                return
        status = str(payload.get("status", "open")).strip() or "open"
        completed_at = now_iso() if status == "done" else None
        cur = con.execute(
            """
            INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_at, created_by, created_at, updated_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                title,
                str(payload.get("description", "")).strip(),
                status,
                str(payload.get("priority", "normal")).strip() or "normal",
                assignee_id,
                str(payload.get("due_at", "")).strip() or None,
                user["id"],
                now_ts(),
                now_ts(),
                completed_at,
            ),
        )
        con.commit()
    handler.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})


def api_update_task(handler, path: str) -> None:
    task_id = parse_path_int(path, 2)
    if not task_id:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_task_id"})
        return
    payload = handler.read_json()
    with db() as con:
        task = con.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not task:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "task_not_found"})
            return
        user = handler.require_project_access(int(task["project_id"]))
        if not user:
            return
        if user["role"] == "customer":
            handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        status = str(payload.get("status", task["status"])).strip() or "open"
        if status not in {"open", "in_progress", "review", "done"}:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_status"})
            return
        priority = str(payload.get("priority", task["priority"])).strip() or "normal"
        if priority not in {"low", "normal", "high"}:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_priority"})
            return
        assignee_id = payload.get("assignee_id", payload.get("assigneeId", task["assignee_id"]))
        try:
            assignee_id = int(assignee_id) if assignee_id not in (None, "", 0, "0") else None
        except (TypeError, ValueError):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_assignee_id"})
            return
        if assignee_id:
            assignee = con.execute("SELECT id FROM users WHERE id = ?", (assignee_id,)).fetchone()
            if not assignee:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "assignee_not_found"})
                return
        completed_at = task["completed_at"] if "completed_at" in task.keys() else None
        if status == "done" and task["status"] != "done":
            completed_at = now_iso()
        elif status != "done":
            completed_at = None
        con.execute(
            """
            UPDATE tasks
            SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, due_at = ?, updated_at = ?, completed_at = ?
            WHERE id = ?
            """,
            (
                str(payload.get("title", task["title"])).strip() or task["title"],
                str(payload.get("description", task["description"] or "")).strip(),
                status,
                priority,
                assignee_id,
                str(payload.get("due_at", payload.get("dueAt", task["due_at"] or ""))).strip() or None,
                now_ts(),
                completed_at,
                task_id,
            ),
        )
        create_audit(
            con,
            user["id"],
            "update_task",
            "task",
            task_id,
            {"project_id": task["project_id"], "status": status, "priority": priority},
        )
        row = con.execute(
            """
            SELECT t.*, u.name AS assignee_name, u.first_name AS assignee_first_name, u.last_name AS assignee_last_name, u.login AS assignee_login
            FROM tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.id = ?
            """,
            (task_id,),
        ).fetchone()
        con.commit()
    payload = dict(row)
    payload["assignee_name"] = display_user_name(row["assignee_name"], row["assignee_first_name"], row["assignee_last_name"], row["assignee_login"])
    handler.send_json(HTTPStatus.OK, {"task": payload})
