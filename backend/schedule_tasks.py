from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
import time
import urllib.parse
from datetime import date, datetime, timedelta
from http import HTTPStatus
from pathlib import Path

from auth import (
    display_user_name,
    user_can_manage_documents,
    user_can_manage_schedule,
    user_has_any_role,
    user_is_guest,
    user_is_main_admin,
)
from operational_quantities import operational_quantity_plan
from projects import serialize_project
from sqlite_config import connect_database
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
    return connect_database(DB_PATH)


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
    kind_override_select = ", e.item_kind_override" if "item_kind_override" in table_columns(con, "estimate_items") else ", NULL AS item_kind_override"
    rows = con.execute(
        f"""
        SELECT
            e.id, e.project_id, e.title, e.section_title, e.stage_id, e.item_kind{kind_override_select},
            e.unit, e.planned_qty, e.actual_qty, e.is_completed,
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
        bucket = section_totals.setdefault(
            sid,
            {
                "sectionId": sid,
                "sectionTitle": title,
                "total": 0,
                "done": 0,
                "percent": 0,
                "_progress_units": 0.0,
            },
        )
        bucket["total"] += 1
        quantity_plan = operational_quantity_plan(row["planned_qty"], row["unit"])
        planned = float(quantity_plan["total_qty"] or 0)
        covered = max(float(row["purchased_qty"] or 0), float(row["received_qty"] or 0))
        is_material = normalize_estimate_item_kind(resolved_estimate_item_kind(row)) != "work"
        purchased_done = is_material and planned > 0 and covered >= planned
        completed = int(row["is_completed"] or 0) == 1 or purchased_done
        if completed:
            bucket["done"] += 1
            bucket["_progress_units"] += 1
        elif not is_material and planned > 0:
            actual = max(float(row["actual_qty"] or 0), 0)
            bucket["_progress_units"] += min(actual / planned, 1)

    for bucket in section_totals.values():
        bucket["percent"] = int(round((bucket["_progress_units"] / bucket["total"]) * 100)) if bucket["total"] else 0

    target_section = section_totals.get(normalize_progress_section_id(section_id)) if section_id else None
    if not target_section and section_id:
        target_section = {"sectionId": normalize_progress_section_id(section_id), "sectionTitle": section_id, "total": 0, "done": 0, "percent": 0}

    total_positions = sum(item["total"] for item in section_totals.values())
    total_progress_units = sum(float(item["_progress_units"]) for item in section_totals.values())
    total_percent = int(round((total_progress_units / total_positions) * 100)) if total_positions else 0
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

    for bucket in section_totals.values():
        bucket.pop("_progress_units", None)

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


def production_material_need_dates(
    con: sqlite3.Connection,
    project_id: int,
    project_start: date | None,
) -> dict[int, str]:
    """Resolve material need dates from the persisted production grid, read-only.

    Production schedule reads normally synchronize generated operations.  The
    notification path must not mutate the schedule, so this helper only uses
    rows that already exist and applies their persisted slot overrides.
    """

    if project_start is None:
        return {}
    required_tables = {
        "estimate_items",
        "production_schedule_operations",
        "production_schedule_operation_estimate_links",
    }
    existing_tables = {
        str(row["name"])
        for row in con.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }
    if not required_tables.issubset(existing_tables):
        return {}

    operation_columns = table_columns(con, "production_schedule_operations")
    link_columns = table_columns(
        con, "production_schedule_operation_estimate_links"
    )
    required_columns = {
        "id", "project_id", "auto_duration_days", "manual_duration_days",
        "position", "status",
    }
    required_link_columns = {
        "operation_id", "estimate_item_id", "link_role",
    }
    if (
        not required_columns.issubset(operation_columns)
        or not required_link_columns.issubset(link_columns)
    ):
        return {}

    placement_select = (
        "placement_mode" if "placement_mode" in operation_columns
        else "'auto' AS placement_mode"
    )
    operations = con.execute(
        f"""
        SELECT id, auto_duration_days, manual_duration_days, position, status,
               {placement_select}
        FROM production_schedule_operations
        WHERE project_id = ?
        ORDER BY position, id
        """,
        (project_id,),
    ).fetchall()
    if not operations:
        return {}

    links_by_operation: dict[int, list[int]] = {}
    link_rows = con.execute(
        """
        SELECT link.operation_id, link.estimate_item_id
        FROM production_schedule_operation_estimate_links link
        JOIN production_schedule_operations operation ON operation.id = link.operation_id
        JOIN estimate_items estimate
          ON estimate.id = link.estimate_item_id
         AND estimate.project_id = operation.project_id
        WHERE operation.project_id = ? AND link.link_role = 'material_signal'
        ORDER BY link.operation_id, link.estimate_item_id
        """,
        (project_id,),
    ).fetchall()
    for link in link_rows:
        links_by_operation.setdefault(int(link["operation_id"]), []).append(
            int(link["estimate_item_id"])
        )

    slot_overrides: dict[int, dict[int, bool]] = {}
    slot_override_columns = (
        table_columns(con, "production_schedule_operation_slot_overrides")
        if "production_schedule_operation_slot_overrides" in existing_tables
        else set()
    )
    if {
        "operation_id", "slot_number", "is_filled",
    }.issubset(slot_override_columns):
        for row in con.execute(
            """
            SELECT slot.operation_id, slot.slot_number, slot.is_filled
            FROM production_schedule_operation_slot_overrides slot
            JOIN production_schedule_operations operation ON operation.id = slot.operation_id
            WHERE operation.project_id = ?
            ORDER BY slot.operation_id, slot.slot_number
            """,
            (project_id,),
        ).fetchall():
            slot_overrides.setdefault(int(row["operation_id"]), {})[
                int(row["slot_number"])
            ] = bool(row["is_filled"])

    cursor_slot = 1
    result: dict[int, str] = {}
    for operation in operations:
        operation_id = int(operation["id"])
        manual_duration = positive_schedule_half_days(operation["manual_duration_days"])
        auto_duration = positive_schedule_half_days(operation["auto_duration_days"]) or 1.0
        duration_days = manual_duration if manual_duration is not None else auto_duration
        duration_slots = max(1, int(round(duration_days * 2)))
        base_slots = set(range(cursor_slot, cursor_slot + duration_slots))
        cursor_slot += duration_slots

        stored_slots = slot_overrides.get(operation_id, {})
        if str(operation["placement_mode"] or "auto") == "manual":
            effective_slots = {
                slot_number
                for slot_number, is_filled in stored_slots.items()
                if is_filled
            }
        else:
            effective_slots = set(base_slots)
            for slot_number, is_filled in stored_slots.items():
                if is_filled:
                    effective_slots.add(slot_number)
                else:
                    effective_slots.discard(slot_number)

        if not effective_slots or str(operation["status"] or "") == "completed":
            continue
        need_date = project_start + timedelta(days=(min(effective_slots) - 1) // 2)
        for estimate_item_id in links_by_operation.get(operation_id, []):
            current = parse_iso_date(result.get(estimate_item_id))
            if current is None or need_date < current:
                result[estimate_item_id] = need_date.isoformat()
    return result


def material_summary_rows(
    con: sqlite3.Connection,
    project_id: int,
    *,
    include_procurement_evidence: bool = False,
    include_supplier_selection: bool = False,
    include_procurement_details: bool = False,
) -> list[dict]:
    include_procurement_evidence = bool(
        include_procurement_evidence or include_procurement_details
    )
    include_supplier_selection = bool(
        include_supplier_selection or include_procurement_details
    )

    def safe_float(value: object, default: float = 0.0) -> float:
        try:
            return float(value if value not in (None, "") else default)
        except (TypeError, ValueError):
            return default

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
    kind_override_select = "e.item_kind_override" if "item_kind_override" in estimate_columns else "NULL AS item_kind_override"
    table_names = {
        str(item["name"])
        for item in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    }
    invoice_documents_by_item: dict[int, list[dict]] = {}
    procurement_actors_by_item: dict[int, list[dict]] = {}
    document_columns = table_columns(con, "documents") if "documents" in table_names else set()
    if include_procurement_evidence and {
        "id", "project_id", "estimate_item_id", "doc_type", "storage_path",
    }.issubset(document_columns):
        optional_document_columns = {
            "title", "status", "original_name", "counterparty_name",
            "document_number", "document_date", "amount", "uploaded_by",
            "created_at",
        }

        def document_column(column: str) -> str:
            return column if column in document_columns else f"NULL AS {column}"

        invoice_rows = con.execute(
            f"""
            SELECT id, estimate_item_id, storage_path,
                   {', '.join(document_column(column) for column in sorted(optional_document_columns))}
            FROM documents
            WHERE project_id = ?
              AND estimate_item_id IS NOT NULL
              AND LOWER(TRIM(COALESCE(doc_type, ''))) IN ('invoice', 'upd', 'cash_receipt')
              AND TRIM(COALESCE(storage_path, '')) != ''
            ORDER BY estimate_item_id,
                     COALESCE({document_column('created_at').split(' AS ')[0]}, 0) DESC,
                     id DESC
            """,
            (project_id,),
        ).fetchall()
        for document in invoice_rows:
            estimate_item_id = int(document["estimate_item_id"])
            invoice_documents_by_item.setdefault(estimate_item_id, []).append(
                {
                    "id": int(document["id"]),
                    "title": document["title"] or "",
                    "status": document["status"] or "",
                    "originalName": document["original_name"] or "",
                    "counterpartyName": document["counterparty_name"] or "",
                    "documentNumber": document["document_number"] or "",
                    "documentDate": document["document_date"],
                    "amount": (
                        float(document["amount"])
                        if document["amount"] is not None
                        else None
                    ),
                    "uploadedBy": document["uploaded_by"],
                    "createdAt": document["created_at"],
                    "downloadUrl": f"/api/documents/{int(document['id'])}/download",
                    "viewUrl": f"/api/documents/{int(document['id'])}/view",
                }
            )

    stock_move_columns = table_columns(con, "stock_moves") if "stock_moves" in table_names else set()
    user_columns = table_columns(con, "users") if "users" in table_names else set()
    if include_procurement_evidence and {
        "id", "project_id", "estimate_item_id", "move_type", "qty", "created_by",
    }.issubset(stock_move_columns):
        actor_name_select = (
            "COALESCE(NULLIF(TRIM(u.name), ''), NULLIF(TRIM(u.login), ''), '')"
            if {"id", "name", "login"}.issubset(user_columns)
            else "''"
        )
        actor_join = "LEFT JOIN users u ON u.id = s.created_by" if "id" in user_columns else ""
        actor_filters = []
        if "source_type" in stock_move_columns:
            actor_filters.append(
                "AND COALESCE(s.source_type, '') != 'legacy_purchase_receipt_backfill'"
            )
        if {"source_type", "source_id"}.issubset(stock_move_columns):
            actor_filters.append("""
              AND NOT EXISTS (
                  SELECT 1
                  FROM stock_moves reversal
                  WHERE reversal.source_type = 'stock_move_reversal'
                    AND reversal.source_id = s.id
              )
            """)
        actor_filter_sql = "\n".join(actor_filters)
        actor_order = (
            "COALESCE(s.created_at, 0) DESC, s.id DESC"
            if "created_at" in stock_move_columns
            else "s.id DESC"
        )
        actor_rows = con.execute(
            f"""
            SELECT s.estimate_item_id, s.created_by, s.move_type,
                   {actor_name_select} AS actor_name
            FROM stock_moves s
            {actor_join}
            WHERE s.project_id = ?
              AND s.estimate_item_id IS NOT NULL
              AND s.move_type IN ('purchase', 'receipt')
              AND s.qty > 0
              {actor_filter_sql}
            ORDER BY s.estimate_item_id, {actor_order}
            """,
            (project_id,),
        ).fetchall()
        for actor_row in actor_rows:
            actor_id = actor_row["created_by"]
            if actor_id is None:
                continue
            material_id = int(actor_row["estimate_item_id"])
            known_actors = procurement_actors_by_item.setdefault(material_id, [])
            numeric_actor_id = int(actor_id)
            actor_action = str(actor_row["move_type"] or "purchase")
            if any(
                item["id"] == numeric_actor_id
                and item["action"] == actor_action
                for item in known_actors
            ):
                continue
            known_actors.append(
                {
                    "id": numeric_actor_id,
                    "name": str(actor_row["actor_name"] or "").strip(),
                    "action": actor_action,
                }
            )

    selected_supplier_by_item: dict[int, dict] = {}
    supplier_columns = table_columns(con, "supplier_offers") if "supplier_offers" in table_names else set()
    if include_supplier_selection and {
        "id", "project_id", "estimate_item_id", "candidate_name", "price", "status",
    }.issubset(supplier_columns):
        supplier_order_columns = [
            column
            for column in ("activated_at", "updated_at", "created_at")
            if column in supplier_columns
        ]
        supplier_order = ", ".join(
            [*(f"{column} DESC" for column in supplier_order_columns), "id DESC"]
        )
        selected_offer_rows = con.execute(
            f"""
            SELECT estimate_item_id, candidate_name, price
            FROM supplier_offers
            WHERE project_id = ?
              AND estimate_item_id IS NOT NULL
              AND status = 'selected'
            ORDER BY {supplier_order}
            """,
            (project_id,),
        ).fetchall()
        for offer in selected_offer_rows:
            estimate_item_id = int(offer["estimate_item_id"])
            if estimate_item_id in selected_supplier_by_item:
                continue
            price = safe_float(offer["price"])
            selected_supplier_by_item[estimate_item_id] = {
                "name": str(offer["candidate_name"] or "").strip(),
                "hasPrice": price > 0,
            }

    project_start = None
    if "projects" in table_names and "started_at" in table_columns(con, "projects"):
        project_row = con.execute(
            "SELECT started_at FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
        project_start = parse_iso_date(project_row["started_at"] if project_row else None)
    production_need_dates = production_material_need_dates(
        con,
        project_id,
        project_start,
    )
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
            {kind_override_select},
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

    for row in rows:
        material_id = int(row["id"])
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
        explicit_need_by_date = str(row["need_by_date"] or "").strip() or None
        production_need_by_date = production_need_dates.get(material_id)
        stage_need_by_date = str(row["stage_planned_start"] or row["stage_planned_end"] or "").strip() or None
        need_by_date = explicit_need_by_date or production_need_by_date or stage_need_by_date
        if explicit_need_by_date:
            need_date_source = "explicit"
        elif production_need_by_date:
            need_date_source = "production"
        elif stage_need_by_date:
            need_date_source = "stage"
        else:
            need_date_source = None
        invoice_documents = invoice_documents_by_item.get(material_id, [])
        procurement_actors = procurement_actors_by_item.get(material_id, [])
        if purchased > 0:
            responsible_procurement_actors = [
                actor for actor in procurement_actors if actor["action"] == "purchase"
            ]
        else:
            responsible_procurement_actors = [
                actor for actor in procurement_actors if actor["action"] == "receipt"
            ]
        latest_procurement_actor = (
            responsible_procurement_actors[0]
            if responsible_procurement_actors
            else None
        )
        selected_supplier = selected_supplier_by_item.get(material_id)
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
        item_payload = {
                "id": material_id,
                "title": row["title"],
                "itemKind": resolved_estimate_item_kind(row),
                "itemKindSource": "manual" if str(row["item_kind_override"] or "") in {"material", "work"} else "auto",
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
                "needByDate": need_by_date,
                "needDateSource": need_date_source,
                "productionNeedByDate": production_need_by_date,
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
        if include_procurement_evidence:
            item_payload.update(
                {
                    "invoiceAttached": bool(invoice_documents),
                    "invoiceCount": len(invoice_documents),
                    "procurementActorId": (
                        latest_procurement_actor["id"]
                        if latest_procurement_actor
                        else None
                    ),
                    "procurementActorName": (
                        latest_procurement_actor["name"]
                        if latest_procurement_actor
                        else ""
                    ),
                    "procurementActorAction": (
                        latest_procurement_actor["action"]
                        if latest_procurement_actor
                        else ""
                    ),
                    "procurementActorIds": [
                        actor["id"] for actor in responsible_procurement_actors
                    ],
                }
            )
        if include_supplier_selection:
            item_payload.update(
                {
                    "selectedSupplierOffer": selected_supplier is not None,
                    "selectedSupplierOfferHasPrice": bool(
                        selected_supplier and selected_supplier["hasPrice"]
                    ),
                }
            )
        if include_procurement_details:
            item_payload.update(
                {
                    "latestInvoice": (
                        invoice_documents[0] if invoice_documents else None
                    ),
                    "selectedSupplierOfferName": (
                        selected_supplier["name"] if selected_supplier else ""
                    ),
                }
            )
        items.append(item_payload)
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
    return {"items": alerts, "summary": summary}


def build_procurement_evidence_alerts(
    materials: list[dict],
    stages: list[sqlite3.Row | dict],
    today_date: date,
    section_start_dates: dict[str, str] | None = None,
    costing_buffer_days: int = 5,
    schedule_attention_enabled: bool = True,
) -> dict:
    """Build red flags for missing procurement proof without touching storage."""

    def number(value: object, default: float = 0.0) -> float:
        try:
            return float(value if value not in (None, "") else default)
        except (TypeError, ValueError):
            return default

    def stage_identifier(value: object) -> int:
        try:
            return int(value) if value not in (None, "", 0, "0") else 0
        except (TypeError, ValueError):
            return 0

    stage_map = {
        int(dict(row)["id"]): dict(row)
        for row in stages
        if dict(row).get("id") is not None
    }
    section_start_dates = section_start_dates or {}
    costing_buffer_days = max(0, min(int(costing_buffer_days or 0), 90))
    schedule_attention_enabled = bool(schedule_attention_enabled)
    alerts: list[dict] = []

    def append_alert(material: dict, evidence_kind: str, status: str, **extra: object) -> None:
        planned_qty = number(material.get("plannedQty", material.get("planned_qty")))
        purchased_qty = number(material.get("purchasedQty", material.get("purchased_qty")))
        received_qty = number(material.get("receivedQty", material.get("received_qty")))
        raw_missing_qty = material.get("missingQty", material.get("missing_qty"))
        missing_qty = (
            number(raw_missing_qty)
            if raw_missing_qty not in (None, "")
            else max(planned_qty - max(purchased_qty, received_qty), 0)
        )
        alert = {
            "evidenceKind": evidence_kind,
            "alertType": evidence_kind,
            "status": status,
            "materialId": int(material.get("id") or 0),
            "title": str(material.get("title") or ""),
            "unit": str(material.get("unit") or ""),
            "plannedQty": planned_qty,
            "missingQty": missing_qty,
            "purchasedQty": purchased_qty,
            "receivedQty": received_qty,
            "sectionTitle": str(material.get("sectionTitle") or "").strip(),
            "stageTitle": str(material.get("stageTitle") or "").strip(),
            "invoiceAttached": bool(
                material.get("invoiceAttached")
                or number(material.get("invoiceCount")) > 0
            ),
            "invoiceCount": int(number(material.get("invoiceCount"))),
            "responsibleUserId": material.get("procurementActorId"),
            "responsibleUserName": str(
                material.get("procurementActorName") or ""
            ).strip(),
            "responsibleUserIds": [
                int(user_id)
                for user_id in (material.get("procurementActorIds") or [])
                if str(user_id).strip().isdigit() and int(user_id) > 0
            ],
            "procurementAction": str(
                material.get("procurementActorAction") or ""
            ).strip(),
            "materialUrl": (
                f"/app/projects?tab=documents&procurementItemId="
                f"{int(material.get('id') or 0)}&documentType=invoice"
            ),
        }
        alert.update(extra)
        alerts.append(alert)

    for material in materials:
        if normalize_estimate_item_kind(
            material.get("itemKind", material.get("item_kind"))
        ) == "work":
            continue

        planned_qty = number(material.get("plannedQty", material.get("planned_qty")))
        purchased_qty = number(material.get("purchasedQty", material.get("purchased_qty")))
        received_qty = number(material.get("receivedQty", material.get("received_qty")))
        raw_missing_qty = material.get("missingQty", material.get("missing_qty"))
        missing_qty = (
            number(raw_missing_qty)
            if raw_missing_qty not in (None, "")
            else max(planned_qty - max(purchased_qty, received_qty), 0)
        )
        if max(planned_qty, purchased_qty, received_qty, missing_qty) <= 0:
            continue

        stage = stage_map.get(
            stage_identifier(material.get("stageId", material.get("stage_id")))
        )
        section_title = str(material.get("sectionTitle") or "").strip()
        stage_start = parse_iso_date(
            str(
                material.get("stageStartDate")
                or (stage or {}).get("planned_start")
                or ""
            )
        )
        if stage_start is None and section_title:
            stage_start = parse_iso_date(section_start_dates.get(section_title))
        need_on_site = parse_iso_date(
            str(material.get("needByDate") or material.get("need_by_date") or "")
        ) or stage_start

        estimated_lead_days = estimate_material_lead_days(material)
        raw_lead_days = material.get("deliveryDays", material.get("delivery_days"))
        try:
            lead_days = (
                int(raw_lead_days)
                if raw_lead_days not in (None, "")
                else int(estimated_lead_days)
            )
        except (TypeError, ValueError):
            lead_days = int(estimated_lead_days)
        lead_days = max(0, min(lead_days, 90))
        order_by = need_on_site - timedelta(days=lead_days) if need_on_site else None
        quote_by = (
            order_by - timedelta(days=costing_buffer_days)
            if order_by
            else None
        )
        date_fields = {
            "needOnSiteDate": need_on_site.isoformat() if need_on_site else None,
            "orderByDate": order_by.isoformat() if order_by else None,
            "quoteByDate": quote_by.isoformat() if quote_by else None,
            "leadDays": int(lead_days),
            "costingBufferDays": int(costing_buffer_days),
            "daysUntilNeed": (
                int((need_on_site - today_date).days) if need_on_site else None
            ),
            "daysUntilOrder": (
                int((order_by - today_date).days) if order_by else None
            ),
            "daysUntilQuote": (
                int((quote_by - today_date).days) if quote_by else None
            ),
        }

        warehouse_source = str(
            material.get("warehouseSource", material.get("warehouse_source", ""))
            or ""
        ).strip()
        if warehouse_source:
            continue

        invoice_attached = bool(
            material.get("invoiceAttached")
            or number(material.get("invoiceCount")) > 0
        )
        if invoice_attached:
            continue

        if purchased_qty > 0 or received_qty > 0:
            append_alert(
                material,
                "missing_invoice",
                "critical",
                requiredQty=max(purchased_qty, received_qty),
                **date_fields,
            )
            continue

        if (
            not schedule_attention_enabled
            or bool(material.get("isCompleted", material.get("is_completed", False)))
            or missing_qty <= 0
        ):
            continue

        if need_on_site is None:
            append_alert(
                material,
                "missing_schedule",
                "watch",
                **date_fields,
            )
            continue

        if quote_by is None or today_date < quote_by:
            continue

        selected_offer = material.get("selectedSupplierOffer")
        selected_offer_price = material.get("selectedSupplierOfferPrice")
        if isinstance(selected_offer, dict):
            selected_offer_price = selected_offer.get("price", selected_offer_price)
            selected_offer = True
        selected_offer_has_price = bool(
            material.get("selectedSupplierOfferHasPrice")
            or (selected_offer and number(selected_offer_price) > 0)
        )
        if selected_offer_has_price:
            continue
        append_alert(
            material,
            "missing_costing",
            "critical" if today_date > quote_by else "soon",
            requiredQty=missing_qty,
            **date_fields,
        )

    status_priority = {"critical": 0, "soon": 1, "watch": 2}
    evidence_priority = {
        "missing_invoice": 0,
        "missing_costing": 1,
        "missing_schedule": 2,
    }
    alerts.sort(
        key=lambda item: (
            status_priority.get(str(item.get("status")), 3),
            str(
                item.get("quoteByDate")
                or item.get("orderByDate")
                or item.get("needOnSiteDate")
                or "9999-12-31"
            ),
            evidence_priority.get(str(item.get("evidenceKind")), 3),
            str(item.get("title") or ""),
        )
    )
    summary = {
        "total": len(alerts),
        "critical": sum(item["status"] == "critical" for item in alerts),
        "soon": sum(item["status"] == "soon" for item in alerts),
        "watch": sum(item["status"] == "watch" for item in alerts),
        "missingCosting": sum(
            item["evidenceKind"] == "missing_costing" for item in alerts
        ),
        "missingInvoice": sum(
            item["evidenceKind"] == "missing_invoice" for item in alerts
        ),
        "missingSchedule": sum(
            item["evidenceKind"] == "missing_schedule" for item in alerts
        ),
    }
    return {"items": alerts, "summary": summary}


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


PRODUCTION_OTMOSTKA_TEMPLATE_KEY = "otmostka-chebarkul-v1"
PRODUCTION_DEFAULT_COLOR = "slate"
PRODUCTION_COLOR_TOKENS = {"slate", "blue", "teal", "green", "violet", "rose"}
PRODUCTION_ALLOWED_LINK_ROLES = {"work_basis", "material_signal", "manual_reference"}


def production_table_exists(con: sqlite3.Connection, table: str) -> bool:
    return bool(
        con.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
    )


def production_manual_fields(value: object) -> set[str]:
    try:
        parsed = json.loads(str(value or "[]"))
    except (TypeError, ValueError, json.JSONDecodeError):
        return set()
    return {str(item) for item in parsed if isinstance(item, str)} if isinstance(parsed, list) else set()


def production_encode_manual_fields(fields: set[str]) -> str:
    return json.dumps(sorted(fields), ensure_ascii=False)


def production_json_array(value: object) -> list:
    try:
        parsed = json.loads(str(value or "[]"))
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def production_article_digits(value: object) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def production_estimate_signature(rows: list[sqlite3.Row | dict]) -> str:
    signature_rows = []
    for row in rows:
        kind = normalize_estimate_item_kind(resolved_estimate_item_kind(row))
        article = str(schedule_item_value(row, "article", default="") or "").strip().casefold()
        title = " ".join(normalize_schedule_text(schedule_item_value(row, "title", default="")).split())
        signature_rows.append((kind, article or title))
    encoded = json.dumps(sorted(signature_rows), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def production_estimate_rows(con: sqlite3.Connection, project_id: int) -> list[sqlite3.Row]:
    estimate_columns = table_columns(con, "estimate_items")
    has_sources = "estimate_source_id" in estimate_columns and production_table_exists(con, "project_estimates")
    live_where = live_estimate_items_where(con, "e")
    source_columns = (
        ", source.source_type AS estimate_source_type, source.source_key AS estimate_source_key"
        if has_sources else ""
    )
    source_join = (
        "LEFT JOIN project_estimates source ON source.id = e.estimate_source_id AND source.project_id = e.project_id"
        if has_sources else ""
    )
    return con.execute(
        f"SELECT e.*{source_columns} FROM estimate_items e {source_join} WHERE e.project_id = ? AND {live_where} ORDER BY e.id",
        (project_id,),
    ).fetchall()


def production_project_calendar_row(con: sqlite3.Connection, project_id: int) -> sqlite3.Row | None:
    """Load the project fields needed to anchor Day 1 without assuming a schema version."""

    project_columns = table_columns(con, "projects")
    started_at_select = "started_at" if "started_at" in project_columns else "NULL AS started_at"
    deadline_at_select = "deadline_at" if "deadline_at" in project_columns else "NULL AS deadline_at"
    return con.execute(
        f"SELECT id, title, {started_at_select}, {deadline_at_select} FROM projects WHERE id = ?",
        (project_id,),
    ).fetchone()


def production_operation_actual_summaries(
    con: sqlite3.Connection,
    project_id: int,
) -> dict[int, dict]:
    """Aggregate real estimate execution for each operation's work-basis links."""

    required_tables = {
        "estimate_items",
        "production_schedule_operations",
        "production_schedule_operation_estimate_links",
    }
    if not all(production_table_exists(con, table) for table in required_tables):
        return {}
    estimate_columns = table_columns(con, "estimate_items")
    if not {"id", "project_id", "planned_qty", "unit"}.issubset(estimate_columns):
        return {}
    actual_select = "estimate.actual_qty" if "actual_qty" in estimate_columns else "NULL"
    completed_select = "estimate.is_completed" if "is_completed" in estimate_columns else "NULL"
    rows = con.execute(
        f"""
        SELECT link.operation_id,
               estimate.planned_qty,
               estimate.unit,
               {actual_select} AS actual_qty,
               {completed_select} AS is_completed
        FROM production_schedule_operation_estimate_links link
        JOIN production_schedule_operations operation ON operation.id = link.operation_id
        JOIN estimate_items estimate
          ON estimate.id = link.estimate_item_id
         AND estimate.project_id = operation.project_id
        WHERE operation.project_id = ? AND link.link_role = 'work_basis'
        ORDER BY link.operation_id, estimate.id
        """,
        (project_id,),
    ).fetchall()
    grouped: dict[int, list[sqlite3.Row]] = {}
    for row in rows:
        grouped.setdefault(int(row["operation_id"]), []).append(row)

    summaries: dict[int, dict] = {}
    for operation_id, operation_rows in grouped.items():
        ratios: list[float] = []
        units: set[str] = set()
        actual_total = 0.0
        planned_total = 0.0
        actual_known = True
        all_completed = True
        for row in operation_rows:
            planned_qty = max(0.0, float(row["planned_qty"] or 0))
            actual_raw = row["actual_qty"]
            completed_raw = row["is_completed"]
            actual_known = actual_known and (actual_raw is not None or completed_raw is not None)
            completed = bool(completed_raw) if completed_raw is not None else False
            all_completed = all_completed and completed
            actual_qty = max(0.0, float(actual_raw or 0))
            units.add(str(row["unit"] or "").strip().casefold())
            planned_total += planned_qty
            actual_total += max(actual_qty, planned_qty if completed else 0.0)
            if completed:
                ratios.append(1.0)
            elif planned_qty > 0:
                ratios.append(max(0.0, min(1.0, actual_qty / planned_qty)))
        progress = None
        if actual_known and ratios:
            progress = round(sum(ratios) / len(ratios) * 100, 1)
        comparable_quantities = len(units) <= 1
        summaries[operation_id] = {
            "actualQty": round(actual_total, 4) if actual_known and comparable_quantities else None,
            "actualPlannedQty": round(planned_total, 4) if comparable_quantities else None,
            "actualProgress": progress,
            "isCompleted": bool(operation_rows) and all_completed,
            "hasActualData": actual_known,
        }
    return summaries


def production_schedule_execution_health(
    *,
    operation_status: str,
    actual_summary: dict | None,
    effective_slots: set[int],
    fallback_slots: set[int],
    project_start: date,
    today_date: date,
) -> dict:
    """Classify execution independently from estimate-link/review status."""

    scheduled_slots = effective_slots or fallback_slots
    if not scheduled_slots:
        return {
            "healthStatus": "yellow",
            "executionHealth": "yellow",
            "healthLabel": "Нужно указать даты",
            "plannedStartDate": None,
            "plannedEndDate": None,
            "expectedProgress": None,
        }
    first_day_offset = (min(scheduled_slots) - 1) // 2
    last_day_offset = (max(scheduled_slots) - 1) // 2
    planned_start = project_start + timedelta(days=first_day_offset)
    planned_end = project_start + timedelta(days=last_day_offset)
    summary = actual_summary or {}
    actual_progress = summary.get("actualProgress")
    completed = bool(summary.get("isCompleted")) or str(operation_status or "").strip().lower() == "completed"
    review_statuses = {
        "review", "needs_review", "requires_review", "unverified", "stale",
        "ambiguous", "orphaned", "outside", "outside_estimate", "unlinked",
    }

    result = {
        "plannedStartDate": planned_start.isoformat(),
        "plannedEndDate": planned_end.isoformat(),
        "expectedProgress": 0.0,
    }
    if completed or (actual_progress is not None and float(actual_progress) >= 100):
        result.update(healthStatus="green", executionHealth="green", healthLabel="Выполнено", expectedProgress=100.0)
        return result
    if today_date < planned_start:
        result.update(healthStatus="neutral", executionHealth="neutral", healthLabel="По плану позже")
        return result
    if (
        today_date > planned_end
        and summary.get("hasActualData")
        and actual_progress is not None
    ):
        result.update(healthStatus="red", executionHealth="red", healthLabel="Срок прошёл", expectedProgress=100.0)
        return result
    if str(operation_status or "").strip().lower() in review_statuses:
        result.update(healthStatus="yellow", executionHealth="yellow", healthLabel="Нужна проверка")
        return result
    if not summary.get("hasActualData") or actual_progress is None:
        result.update(healthStatus="yellow", executionHealth="yellow", healthLabel="Нет факта выполнения")
        return result
    total_days = max(1, (planned_end - planned_start).days + 1)
    completed_calendar_days = max(0, (today_date - planned_start).days)
    expected_progress = round(min(100.0, completed_calendar_days / total_days * 100), 1)
    result["expectedProgress"] = expected_progress
    if expected_progress - float(actual_progress) >= 15:
        result.update(healthStatus="red", executionHealth="red", healthLabel="Есть отставание")
    else:
        result.update(healthStatus="green", executionHealth="green", healthLabel="Идёт по графику")
    return result


def production_find_estimate(
    rows: list[sqlite3.Row | dict],
    *,
    kind: str | None = None,
    article_suffix: str = "",
    all_keywords: tuple[str, ...] = (),
    any_keywords: tuple[str, ...] = (),
) -> sqlite3.Row | dict | None:
    suffix_digits = production_article_digits(article_suffix)
    for row in rows:
        row_kind = normalize_estimate_item_kind(resolved_estimate_item_kind(row))
        if kind and row_kind != kind:
            continue
        title = normalize_schedule_text(schedule_item_value(row, "title", default=""))
        article_digits = production_article_digits(schedule_item_value(row, "article", default=""))
        article_matches = bool(suffix_digits and article_digits.endswith(suffix_digits))
        keyword_matches = bool(all_keywords) and all(keyword in title for keyword in all_keywords)
        any_matches = bool(any_keywords) and any(keyword in title for keyword in any_keywords)
        if article_matches or keyword_matches or any_matches:
            return row
    return None


def production_row_qty(row: sqlite3.Row | dict | None, fallback: float = 0.0) -> float:
    if not row:
        return float(fallback)
    try:
        return float(schedule_item_value(row, "planned_qty", "plannedQty", default=fallback) or fallback)
    except (TypeError, ValueError):
        return float(fallback)


def production_link(row: sqlite3.Row | dict | None, role: str) -> tuple[int, str] | None:
    if not row:
        return None
    return (int(schedule_item_value(row, "id", default=0) or 0), role)


def production_operation_seed(
    generation_key: str,
    title: str,
    qty: float | None,
    unit: str,
    duration_days: float,
    links: list[tuple[int, str] | None],
    *,
    color: str,
    origin: str = "template",
    template_key: str | None = PRODUCTION_OTMOSTKA_TEMPLATE_KEY,
    status: str | None = None,
) -> dict:
    clean_links: list[tuple[int, str]] = []
    seen: set[tuple[int, str]] = set()
    for link in links:
        if not link or not link[0] or link[1] not in PRODUCTION_ALLOWED_LINK_ROLES or link in seen:
            continue
        seen.add(link)
        clean_links.append(link)
    duration = positive_schedule_half_days(duration_days) or 1.0
    return {
        "generation_key": generation_key,
        "title": title,
        "planned_qty": None if qty is None else max(0.0, float(qty)),
        "unit": unit,
        "people_count": 1,
        "shift_count": 1,
        "brigade_count": 1,
        "labor_hours_total": duration * SCHEDULE_SHIFT_HOURS,
        "auto_duration_days": duration,
        "origin": origin,
        "status": status or ("linked" if clean_links else "outside_estimate"),
        "color": color,
        "template_key": template_key,
        "links": clean_links,
    }


def production_scaled_days(current_qty: float, reference_qty: float, reference_days: float) -> float:
    if current_qty <= 0 or reference_qty <= 0:
        return positive_schedule_half_days(reference_days) or 1.0
    return max(0.5, math.ceil((reference_days * current_qty / reference_qty) * 2 - 1e-9) / 2)


def build_otmostka_template_seeds(
    project: sqlite3.Row | dict,
    rows: list[sqlite3.Row | dict],
) -> list[dict] | None:
    concrete = production_find_estimate(
        rows,
        kind="work",
        article_suffix="69-01-016-02",
        all_keywords=("отмост", "бетон"),
    )
    if not concrete:
        return None
    concrete_source_id = schedule_item_value(concrete, "estimate_source_id", "estimateSourceId")
    concrete_section = normalize_progress_section_id(schedule_item_value(concrete, "section_title", "sectionTitle", default=""))
    if concrete_source_id not in (None, "", 0, "0"):
        scoped_rows = [
            row for row in rows
            if str(schedule_item_value(row, "estimate_source_id", "estimateSourceId", default="")) == str(concrete_source_id)
        ]
    elif concrete_section and concrete_section != "без раздела":
        scoped_rows = [
            row for row in rows
            if normalize_progress_section_id(schedule_item_value(row, "section_title", "sectionTitle", default="")) == concrete_section
        ]
    else:
        scoped_rows = rows
    reinforcement = production_find_estimate(
        scoped_rows,
        kind="work",
        article_suffix="06-03-004-14",
        any_keywords=("армирован",),
    )
    foundation_waterproofing = production_find_estimate(
        scoped_rows,
        kind="work",
        article_suffix="08-01-003-10",
        all_keywords=("гидроизоляц", "обмазоч"),
    )
    joint_cutting = production_find_estimate(
        scoped_rows,
        kind="work",
        article_suffix="27-06-007-02",
        all_keywords=("шв", "бетон"),
    )
    joint_sealing = production_find_estimate(
        scoped_rows,
        kind="work",
        article_suffix="46-08-022-01",
        all_keywords=("гидроизоляц", "шв"),
    )
    canopy = production_find_estimate(
        scoped_rows,
        kind="work",
        article_suffix="12-01-045-01",
        any_keywords=("козыр",),
    )
    plaster = production_find_estimate(
        scoped_rows,
        kind="work",
        article_suffix="61-02-001-01",
        any_keywords=("штукатур",),
    )
    paint = production_find_estimate(
        scoped_rows,
        kind="work",
        article_suffix="15-04-019-05",
        any_keywords=("окраск",),
    )
    supporting = [reinforcement, foundation_waterproofing, joint_cutting, joint_sealing, canopy, plaster, paint]
    project_title = normalize_schedule_text(schedule_item_value(project, "title", default=""))
    known_chebarkul = project_title == "чб" or "чебарк" in project_title
    if sum(item is not None for item in supporting) < 5 and not known_chebarkul:
        return None

    crushed_stone = production_find_estimate(scoped_rows, kind="material", any_keywords=("щебен", "щебн"))
    mesh = production_find_estimate(scoped_rows, kind="material", any_keywords=("сетк",))
    concrete_mix = production_find_estimate(scoped_rows, kind="material", all_keywords=("смес", "бетон"))
    joint_material = production_find_estimate(scoped_rows, kind="material", article_suffix="14-5-04-01-0011")
    if not joint_material:
        joint_material = production_find_estimate(scoped_rows, kind="material", any_keywords=("гермет",))
    metal = production_find_estimate(scoped_rows, kind="material", any_keywords=("металлоконструк",))
    canopy_cover = production_find_estimate(scoped_rows, kind="material", any_keywords=("поликарбон", "профлист", "проф.лист"))
    paint_material = production_find_estimate(scoped_rows, kind="material", any_keywords=("краск",))

    concrete_qty = production_row_qty(concrete, 256)
    crushed_qty = production_row_qty(crushed_stone, round(concrete_qty * 0.1, 3))
    foundation_qty = production_row_qty(foundation_waterproofing, round(concrete_qty * 0.3, 3))
    mesh_qty = production_row_qty(mesh, round(concrete_qty * 1.09375, 3))
    formwork_qty = round(concrete_qty * (100 / 256), 3)
    joint_qty = production_row_qty(joint_cutting or joint_sealing, round(concrete_qty / 3, 3))
    canopy_qty = production_row_qty(canopy, 0)
    plaster_qty = production_row_qty(plaster, 0)
    paint_qty = production_row_qty(paint, plaster_qty)

    key = PRODUCTION_OTMOSTKA_TEMPLATE_KEY
    return [
        production_operation_seed(f"template:{key}:01-demolition", "Демонтаж деревьев и кустарников", None, "шт", 2, [], color="slate"),
        production_operation_seed(f"template:{key}:02-earthworks", "Разработка грунта для устройства щебня", crushed_qty, "м3", production_scaled_days(crushed_qty, 25.6, 2), [production_link(concrete, "manual_reference"), production_link(crushed_stone, "material_signal")], color="slate"),
        production_operation_seed(f"template:{key}:03-crushed-base", "Устройство подстилающего выравнивающего слоя из щебня", crushed_qty, "м3", production_scaled_days(crushed_qty, 25.6, 3), [production_link(concrete, "manual_reference"), production_link(crushed_stone, "material_signal")], color="blue"),
        production_operation_seed(f"template:{key}:04-foundation-waterproofing", "Устройство гидроизоляции фундамента в 1 слой мастикой h=1 м", foundation_qty, "м2", production_scaled_days(foundation_qty, 76.8, 2), [production_link(foundation_waterproofing, "work_basis")], color="blue"),
        production_operation_seed(f"template:{key}:05-reinforcement", "Устройство армирующей сетки под отмостку", mesh_qty, "м2", production_scaled_days(mesh_qty, 280, 3), [production_link(reinforcement, "work_basis"), production_link(mesh, "material_signal")], color="violet"),
        production_operation_seed(f"template:{key}:06-formwork", "Монтаж опалубки для бетонирования отмостки", formwork_qty, "шт", production_scaled_days(formwork_qty, 100, 3), [production_link(concrete, "manual_reference")], color="violet"),
        production_operation_seed(f"template:{key}:07-concreting", "Бетонирование отмостки смесью маркой B15 t=15 см", concrete_qty, "м2", production_scaled_days(concrete_qty, 256, 7), [production_link(concrete, "work_basis"), production_link(concrete_mix, "material_signal")], color="green"),
        production_operation_seed(f"template:{key}:08-expansion-joints", "Устройство деформационных швов отмостки", joint_qty, "кг", production_scaled_days(joint_qty, 85, 2), [production_link(joint_cutting, "work_basis")], color="teal"),
        production_operation_seed(f"template:{key}:09-joint-waterproofing", "Гидроизоляция деф. швов полиуретановым герметиком", joint_qty, "кг", production_scaled_days(joint_qty, 85, 2), [production_link(joint_sealing, "work_basis"), production_link(joint_material, "material_signal")], color="teal"),
        production_operation_seed(f"template:{key}:10-canopy-metal", "Монтаж металлических конструкций для козырьков приямков", canopy_qty, "м2", production_scaled_days(canopy_qty, 23.4, 2), [production_link(canopy, "work_basis"), production_link(metal, "material_signal")], color="violet"),
        production_operation_seed(f"template:{key}:11-canopy-cover", "Монтаж козырьков из профлиста", canopy_qty, "м2", production_scaled_days(canopy_qty, 23.4, 2), [production_link(canopy, "manual_reference"), production_link(canopy_cover, "material_signal")], color="violet", status="needs_review"),
        production_operation_seed(f"template:{key}:12-plaster", "Штукатурка стен приямков", plaster_qty, "м2", production_scaled_days(plaster_qty, 24.7, 2), [production_link(plaster, "work_basis")], color="rose"),
        production_operation_seed(f"template:{key}:13-paint", "Окраска стен приямка в 2 слоя", paint_qty, "м2", production_scaled_days(paint_qty, 24.7, 2), [production_link(paint, "work_basis"), production_link(paint_material, "material_signal")], color="rose"),
        production_operation_seed(f"template:{key}:14-removal", "Вывоз мусора, грунта, деревьев и кустарников", None, "м3", 2, [], color="slate"),
        production_operation_seed(f"template:{key}:15-cleanup", "Уборка территории", None, "м3", 2, [], color="slate"),
    ]


def build_fallback_operation_seed(row: sqlite3.Row | dict) -> dict:
    estimate = calculate_schedule_work_duration(row)
    item_id = int(schedule_item_value(row, "id", default=0) or 0)
    scope = classify_schedule_scope(str(schedule_item_value(row, "title", default="")))
    colors = {
        "prep": "slate",
        "concrete": "green",
        "roof": "violet",
        "finishing": "rose",
        "electrical": "blue",
        "plumbing": "teal",
    }
    return {
        "generation_key": f"estimate:{item_id}",
        "title": str(schedule_item_value(row, "title", default="") or ""),
        "planned_qty": production_row_qty(row),
        "unit": str(schedule_item_value(row, "unit", default="") or ""),
        "people_count": int(estimate["crew_size"]),
        "shift_count": 1,
        "brigade_count": 1,
        "labor_hours_total": float(estimate["hours"]),
        "auto_duration_days": float(estimate["auto_days"]),
        "origin": "auto",
        "status": "needs_review",
        "color": colors.get(scope, PRODUCTION_DEFAULT_COLOR),
        "template_key": None,
        "links": [(item_id, "work_basis")],
    }


def production_recalculated_days(labor_hours: object, people: object, shifts: object, brigades: object, fallback: object) -> float:
    labor = positive_schedule_float(labor_hours)
    if labor is None:
        return positive_schedule_half_days(fallback) or 1.0
    capacity = max(1, (positive_schedule_int(people) or 1) * (positive_schedule_int(shifts) or 1) * (positive_schedule_int(brigades) or 1) * SCHEDULE_SHIFT_HOURS)
    return max(0.5, math.ceil((labor / capacity) * 2 - 1e-9) / 2)


def production_identity_text(value: object) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def production_saved_link_match(
    raw_link: dict,
    rows: list[sqlite3.Row | dict],
) -> sqlite3.Row | dict | None:
    """Match a learned link without guessing between duplicate estimate rows.

    A source item key is the strongest portable hint, followed by article and
    title. Section/source metadata only narrows a candidate set when that
    metadata also exists in the new estimate. Returning ``None`` for a tie is
    intentional: the generated operation is then marked ``needs_review`` and
    no unrelated estimate row is linked silently.
    """
    source_item_key = production_identity_text(
        schedule_item_value(raw_link, "sourceItemKey", "source_item_key", default="")
    )
    article = production_identity_text(schedule_item_value(raw_link, "article", default=""))
    title = " ".join(
        normalize_schedule_text(schedule_item_value(raw_link, "title", default="")).split()
    )

    def matching(key: str) -> list[sqlite3.Row | dict]:
        if key == "source_item_key":
            return [
                row for row in rows
                if production_identity_text(
                    schedule_item_value(row, "source_item_key", "sourceItemKey", default="")
                ) == source_item_key
            ]
        if key == "article":
            return [
                row for row in rows
                if production_identity_text(schedule_item_value(row, "article", default="")) == article
            ]
        return [
            row for row in rows
            if " ".join(normalize_schedule_text(schedule_item_value(row, "title", default="")).split()) == title
        ]

    source_candidates = matching("source_item_key") if source_item_key else []
    article_candidates = matching("article") if article else []
    title_candidates = matching("title") if title else []

    # A recycled row key must still agree with at least one available textual
    # identity. If it does not, fall back to article/title matching.
    candidates = source_candidates
    textual_candidates = article_candidates or title_candidates
    if candidates and textual_candidates:
        textual_ids = {int(schedule_item_value(row, "id", default=0) or 0) for row in textual_candidates}
        agreeing = [
            row for row in candidates
            if int(schedule_item_value(row, "id", default=0) or 0) in textual_ids
        ]
        candidates = agreeing or textual_candidates
    elif not candidates:
        candidates = article_candidates or title_candidates
    if not candidates:
        return None

    def narrow(target: str, getter) -> None:
        nonlocal candidates
        if not target or len(candidates) <= 1:
            return
        narrowed = [row for row in candidates if getter(row) == target]
        if narrowed:
            candidates = narrowed

    # Article and title together are safer than either one alone.
    narrow(
        article,
        lambda row: production_identity_text(schedule_item_value(row, "article", default="")),
    )
    narrow(
        title,
        lambda row: " ".join(
            normalize_schedule_text(schedule_item_value(row, "title", default="")).split()
        ),
    )
    narrow(
        source_item_key,
        lambda row: production_identity_text(
            schedule_item_value(row, "source_item_key", "sourceItemKey", default="")
        ),
    )

    source_key = production_identity_text(
        schedule_item_value(raw_link, "estimateSourceKey", "estimate_source_key", default="")
    )
    source_type = production_identity_text(
        schedule_item_value(raw_link, "estimateSourceType", "estimate_source_type", default="")
    )
    section = production_identity_text(
        canonical_estimate_section_title(
            schedule_item_value(raw_link, "sectionTitle", "section_title", default="")
        )
    )
    unit = production_identity_text(schedule_item_value(raw_link, "unit", default=""))
    raw_item_kind = schedule_item_value(raw_link, "itemKind", "item_kind", default="")
    item_kind = (
        normalize_estimate_item_kind(raw_item_kind)
        if production_identity_text(raw_item_kind)
        else ""
    )
    narrow(
        source_key,
        lambda row: production_identity_text(
            schedule_item_value(row, "estimate_source_key", "estimateSourceKey", default="")
        ),
    )
    narrow(
        source_type,
        lambda row: production_identity_text(
            schedule_item_value(row, "estimate_source_type", "estimateSourceType", default="")
        ),
    )
    narrow(
        section,
        lambda row: production_identity_text(
            canonical_estimate_section_title(
                schedule_item_value(row, "section_title", "sectionTitle", default="")
            )
        ),
    )
    narrow(unit, lambda row: production_identity_text(schedule_item_value(row, "unit", default="")))
    narrow(
        item_kind,
        lambda row: normalize_estimate_item_kind(resolved_estimate_item_kind(row)),
    )
    return candidates[0] if len(candidates) == 1 else None


def build_saved_template_seeds(
    con: sqlite3.Connection,
    signature: str,
    rows: list[sqlite3.Row | dict],
    project_id: int,
) -> tuple[list[dict], str] | None:
    if not production_table_exists(con, "production_schedule_templates"):
        return None
    template_rows = con.execute(
        """
        SELECT id, payload
        FROM production_schedule_templates
        WHERE signature = ? AND (source_project_id IS NULL OR source_project_id != ?)
        ORDER BY updated_at DESC, id DESC
        """,
        (signature, project_id),
    ).fetchall()
    parsed_templates: list[tuple[int, dict]] = []
    for template in template_rows:
        try:
            parsed = json.loads(str(template["payload"] or "{}"))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if isinstance(parsed, dict) and isinstance(parsed.get("operations"), list):
            parsed_templates.append((int(template["id"]), parsed))
    if not parsed_templates:
        return None
    schedule_template = next((item for item in parsed_templates if item[1].get("scope", "schedule") == "schedule"), None)
    selected = [schedule_template] if schedule_template else [
        item for item in parsed_templates if item[1].get("scope") == "operation"
    ]
    if not selected:
        return None

    seeds: list[dict] = []
    for template_id, template_payload in selected:
        for index, raw_operation in enumerate(template_payload["operations"]):
            if not isinstance(raw_operation, dict):
                continue
            mapped_links: list[tuple[int, str] | None] = []
            ratio = 1.0
            missing_link = False
            for raw_link in raw_operation.get("links") or []:
                if not isinstance(raw_link, dict):
                    continue
                current = production_saved_link_match(raw_link, rows)
                if not current:
                    missing_link = True
                    continue
                role = str(raw_link.get("role") or "manual_reference")
                if role not in PRODUCTION_ALLOWED_LINK_ROLES:
                    role = "manual_reference"
                mapped_links.append(production_link(current, role))
                old_qty = positive_schedule_float(raw_link.get("plannedQty"))
                current_qty = production_row_qty(current)
                if role == "work_basis" and old_qty and current_qty > 0:
                    ratio = current_qty / old_qty
            old_qty_value = raw_operation.get("plannedQty")
            try:
                planned_qty = None if old_qty_value is None else max(0.0, float(old_qty_value) * ratio)
            except (TypeError, ValueError):
                planned_qty = 0.0
            old_days = positive_schedule_half_days(raw_operation.get("durationDays")) or positive_schedule_half_days(raw_operation.get("autoDays")) or 1.0
            duration_days = max(0.5, math.ceil((old_days * ratio) * 2 - 1e-9) / 2)
            links = [link for link in mapped_links if link]
            status = "needs_review" if missing_link else ("linked" if links else "outside_estimate")
            seed = production_operation_seed(
                f"saved:{template_id}:{index:03d}",
                str(raw_operation.get("title") or "Операция"),
                planned_qty,
                str(raw_operation.get("unit") or ""),
                duration_days,
                links,
                color=production_valid_color(raw_operation.get("color")) or PRODUCTION_DEFAULT_COLOR,
                origin="template",
                template_key=f"saved:{template_id}",
                status=status,
            )
            seed["people_count"] = positive_schedule_int(raw_operation.get("peopleCount")) or 1
            seed["shift_count"] = positive_schedule_int(raw_operation.get("shiftCount")) or 1
            seed["brigade_count"] = positive_schedule_int(raw_operation.get("brigadeCount")) or 1
            seed["labor_hours_total"] = duration_days * seed["people_count"] * seed["shift_count"] * seed["brigade_count"] * SCHEDULE_SHIFT_HOURS
            seeds.append(seed)
    if not seeds:
        return None
    template_key = "+".join(f"saved:{template_id}" for template_id, _ in selected)
    return seeds, template_key


def production_source_links_snapshot(seed: dict, rows: list[sqlite3.Row | dict]) -> str:
    by_id = {int(schedule_item_value(row, "id", default=0) or 0): row for row in rows}
    snapshot = []
    for estimate_item_id, role in seed.get("links") or []:
        row = by_id.get(int(estimate_item_id))
        snapshot.append(
            {
                "estimateItemId": int(estimate_item_id),
                "role": role,
                "title": str(schedule_item_value(row, "title", default="") or ""),
                "article": str(schedule_item_value(row, "article", default="") or ""),
                "plannedQty": production_row_qty(row),
                "unit": str(schedule_item_value(row, "unit", default="") or ""),
                "itemKind": normalize_estimate_item_kind(resolved_estimate_item_kind(row)) if row else "",
                "sectionTitle": str(
                    schedule_item_value(row, "section_title", "sectionTitle", default="") or ""
                ),
                "estimateSourceId": schedule_item_value(
                    row, "estimate_source_id", "estimateSourceId", default=None
                ),
                "estimateSourceKey": str(
                    schedule_item_value(row, "estimate_source_key", "estimateSourceKey", default="") or ""
                ),
                "estimateSourceType": str(
                    schedule_item_value(row, "estimate_source_type", "estimateSourceType", default="") or ""
                ),
                "sourceItemKey": str(
                    schedule_item_value(row, "source_item_key", "sourceItemKey", default="") or ""
                ),
            }
        )
    return json.dumps(snapshot, ensure_ascii=False)


def sync_production_schedule_operations(
    con: sqlite3.Connection,
    project: sqlite3.Row | dict,
    rows: list[sqlite3.Row | dict],
) -> dict:
    project_id = int(schedule_item_value(project, "id", default=0) or 0)
    signature = production_estimate_signature(rows)
    saved = build_saved_template_seeds(con, signature, rows, project_id)
    seeds = saved[0] if saved else build_otmostka_template_seeds(project, rows)
    mode = "saved_template" if saved else ("template" if seeds else "automatic")
    template_key = saved[1] if saved else (PRODUCTION_OTMOSTKA_TEMPLATE_KEY if seeds else None)
    work_rows = [row for row in rows if normalize_estimate_item_kind(resolved_estimate_item_kind(row)) == "work"]
    if seeds is None:
        seeds = [build_fallback_operation_seed(row) for row in work_rows]

    suppressed = {
        str(row["generation_key"])
        for row in con.execute(
            "SELECT generation_key FROM production_schedule_suppressed_keys WHERE project_id = ?",
            (project_id,),
        ).fetchall()
    }
    seeds = [seed for seed in seeds if seed["generation_key"] not in suppressed]
    target_keys = {str(seed["generation_key"]) for seed in seeds}

    existing_rows = con.execute(
        "SELECT * FROM production_schedule_operations WHERE project_id = ? ORDER BY position, id",
        (project_id,),
    ).fetchall()
    for existing in existing_rows:
        generation_key = str(existing["generation_key"])
        if existing["origin"] not in {"auto", "template"} or generation_key in target_keys:
            continue
        live_ids = {int(schedule_item_value(row, "id", default=0) or 0) for row in rows}
        linked_ids = {
            int(row["estimate_item_id"])
            for row in con.execute(
                "SELECT estimate_item_id FROM production_schedule_operation_estimate_links WHERE operation_id = ?",
                (int(existing["id"]),),
            ).fetchall()
        }
        has_missing_source = int(existing["source_link_count"] or 0) > len(linked_ids & live_ids)
        has_slots = bool(
            con.execute(
                "SELECT 1 FROM production_schedule_operation_slot_overrides WHERE operation_id = ? LIMIT 1",
                (int(existing["id"]),),
            ).fetchone()
        )
        is_edited = bool(production_manual_fields(existing["manual_fields"]) or existing["manual_duration_days"] is not None or has_slots)
        if has_missing_source:
            con.execute(
                "UPDATE production_schedule_operations SET status = 'stale', updated_at = ? WHERE id = ? AND project_id = ?",
                (now_ts(), int(existing["id"]), project_id),
            )
        elif not is_edited:
            con.execute(
                "DELETE FROM production_schedule_operations WHERE id = ? AND project_id = ?",
                (int(existing["id"]), project_id),
            )
    existing_rows = con.execute(
        "SELECT * FROM production_schedule_operations WHERE project_id = ? ORDER BY position, id",
        (project_id,),
    ).fetchall()
    existing_by_key = {str(row["generation_key"]): row for row in existing_rows}
    next_position = max([int(row["position"] or 0) for row in existing_rows] or [-1]) + 1
    timestamp = now_ts()
    for seed_index, seed in enumerate(seeds):
        current = existing_by_key.get(seed["generation_key"])
        snapshot = production_source_links_snapshot(seed, rows)
        if not current:
            position = seed_index if not existing_rows else next_position
            next_position += 1
            cursor = con.execute(
                """
                INSERT INTO production_schedule_operations (
                    project_id, generation_key, title, planned_qty, unit,
                    people_count, shift_count, brigade_count, labor_hours_total,
                    auto_duration_days, position, origin, status, color,
                    template_key, source_signature, source_link_count, source_links_snapshot, manual_fields,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
                """,
                (
                    project_id, seed["generation_key"], seed["title"], seed["planned_qty"], seed["unit"],
                    seed["people_count"], seed["shift_count"], seed["brigade_count"], seed["labor_hours_total"],
                    seed["auto_duration_days"], position, seed["origin"], seed["status"], seed["color"],
                    seed["template_key"], signature, len({item_id for item_id, _ in seed["links"]}), snapshot, timestamp, timestamp,
                ),
            )
            operation_id = int(cursor.lastrowid)
        else:
            operation_id = int(current["id"])
            manual_fields = production_manual_fields(current["manual_fields"])
            new_source_link_count = len({item_id for item_id, _ in seed["links"]})
            lost_source_link = (
                str(current["source_signature"] or "") != signature
                and int(current["source_link_count"] or 0) > new_source_link_count
            )
            people = int(current["people_count"] or 1) if "people_count" in manual_fields else int(seed["people_count"])
            shifts = int(current["shift_count"] or 1) if "shift_count" in manual_fields else int(seed["shift_count"])
            brigades = int(current["brigade_count"] or 1) if "brigade_count" in manual_fields else int(seed["brigade_count"])
            updates = {
                "title": current["title"] if "title" in manual_fields else seed["title"],
                "planned_qty": current["planned_qty"] if "planned_qty" in manual_fields else seed["planned_qty"],
                "unit": current["unit"] if "unit" in manual_fields else seed["unit"],
                "people_count": people,
                "shift_count": shifts,
                "brigade_count": brigades,
                "color": current["color"] if "color" in manual_fields else seed["color"],
                "labor_hours_total": seed["labor_hours_total"],
                "auto_duration_days": production_recalculated_days(seed["labor_hours_total"], people, shifts, brigades, seed["auto_duration_days"]),
                "source_signature": signature,
                "source_link_count": int(current["source_link_count"] or 0) if "links" in manual_fields or lost_source_link else new_source_link_count,
                "source_links_snapshot": current["source_links_snapshot"] if "links" in manual_fields or lost_source_link else snapshot,
                "status": (
                    current["status"] if "status" in manual_fields or current["status"] == "confirmed"
                    else ("stale" if lost_source_link else seed["status"])
                ),
            }
            con.execute(
                """
                UPDATE production_schedule_operations
                SET title = ?, planned_qty = ?, unit = ?, people_count = ?, shift_count = ?,
                    brigade_count = ?, color = ?, labor_hours_total = ?, auto_duration_days = ?,
                    source_signature = ?, source_link_count = ?, source_links_snapshot = ?, status = ?,
                    template_key = ?, updated_at = ?
                WHERE id = ? AND project_id = ?
                """,
                (
                    updates["title"], updates["planned_qty"], updates["unit"], updates["people_count"],
                    updates["shift_count"], updates["brigade_count"], updates["color"], updates["labor_hours_total"],
                    updates["auto_duration_days"], updates["source_signature"], updates["source_link_count"],
                    updates["source_links_snapshot"], updates["status"], seed["template_key"], timestamp,
                    operation_id, project_id,
                ),
            )
        current_after = production_operation_row(con, project_id, operation_id)
        if "links" not in production_manual_fields(current_after["manual_fields"]):
            con.execute("DELETE FROM production_schedule_operation_estimate_links WHERE operation_id = ?", (operation_id,))
            for estimate_item_id, role in seed["links"]:
                con.execute(
                    """
                    INSERT INTO production_schedule_operation_estimate_links (
                        operation_id, estimate_item_id, link_role, created_at
                    ) VALUES (?, ?, ?, ?)
                    """,
                    (operation_id, estimate_item_id, role, timestamp),
                )

    linked_ids = {
        int(row["estimate_item_id"])
        for row in con.execute(
            """
            SELECT DISTINCT link.estimate_item_id
            FROM production_schedule_operation_estimate_links link
            JOIN production_schedule_operations operation ON operation.id = link.operation_id
            WHERE operation.project_id = ?
            """,
            (project_id,),
        ).fetchall()
    }
    seeded_link_ids = {
        int(estimate_item_id)
        for seed in seeds
        for estimate_item_id, _ in seed.get("links", [])
    }
    for row in work_rows:
        item_id = int(schedule_item_value(row, "id", default=0) or 0)
        if item_id in linked_ids or item_id in seeded_link_ids:
            continue
        seed = build_fallback_operation_seed(row)
        if seed["generation_key"] in suppressed:
            continue
        snapshot = production_source_links_snapshot(seed, rows)
        cursor = con.execute(
            """
            INSERT OR IGNORE INTO production_schedule_operations (
                project_id, generation_key, title, planned_qty, unit, people_count,
                shift_count, brigade_count, labor_hours_total, auto_duration_days,
                position, origin, status, color, source_signature, source_link_count, source_links_snapshot,
                manual_fields, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, '[]', ?, ?)
            """,
            (
                project_id, seed["generation_key"], seed["title"], seed["planned_qty"], seed["unit"],
                seed["people_count"], 1, 1, seed["labor_hours_total"], seed["auto_duration_days"],
                next_position, "auto", "needs_review", seed["color"], signature, snapshot, timestamp, timestamp,
            ),
        )
        operation_id = int(cursor.lastrowid or 0) if cursor.rowcount else 0
        if operation_id:
            con.execute(
                "INSERT INTO production_schedule_operation_estimate_links (operation_id, estimate_item_id, link_role, created_at) VALUES (?, ?, 'work_basis', ?)",
                (operation_id, item_id, timestamp),
            )
            next_position += 1
    return {"mode": mode, "templateKey": template_key, "sourceSignature": signature}


def production_operation_base_slots(con: sqlite3.Connection, project_id: int) -> dict[int, set[int]]:
    cursor_slot = 1
    result: dict[int, set[int]] = {}
    for operation in con.execute(
        "SELECT id, auto_duration_days, manual_duration_days FROM production_schedule_operations WHERE project_id = ? ORDER BY position, id",
        (project_id,),
    ).fetchall():
        duration = positive_schedule_half_days(operation["manual_duration_days"]) or positive_schedule_half_days(operation["auto_duration_days"]) or 1.0
        duration_slots = max(1, int(round(duration * 2)))
        result[int(operation["id"])] = set(range(cursor_slot, cursor_slot + duration_slots))
        cursor_slot += duration_slots
    return result


def production_resize_manual_slot_snapshot(
    con: sqlite3.Connection,
    project_id: int,
    operation_id: int,
    duration_days: float,
    updated_by: int | None,
    timestamp: int,
) -> None:
    """Keep an explicitly placed row's painted span in sync with its duration.

    Cell clicks deliberately may make ``effectiveDays`` differ from the nominal
    duration.  Once the user changes that duration, however, the duration
    control is expected to resize the painted span as well.  Preserve the
    manual anchor/order: trim from the right, or extend after the last painted
    half-day.  An empty manual row restarts at its current sequential baseline.
    """
    operation = production_operation_row(con, project_id, operation_id)
    if not operation or str(operation["placement_mode"] or "auto") != "manual":
        return

    desired_count = max(1, int(round(float(duration_days) * 2)))
    current_slots = [
        int(row["slot_number"])
        for row in con.execute(
            """
            SELECT slot_number
            FROM production_schedule_operation_slot_overrides
            WHERE operation_id = ? AND is_filled = 1
            ORDER BY slot_number
            """,
            (operation_id,),
        ).fetchall()
    ]
    if len(current_slots) == desired_count:
        return

    if current_slots:
        resized_slots = current_slots[:desired_count]
        next_slot = current_slots[-1] + 1
        occupied = set(resized_slots)
        while len(resized_slots) < desired_count:
            if next_slot not in occupied:
                resized_slots.append(next_slot)
                occupied.add(next_slot)
            next_slot += 1
    else:
        base_slots = production_operation_base_slots(con, project_id).get(operation_id, set())
        resized_slots = sorted(base_slots)[:desired_count]

    con.execute(
        "DELETE FROM production_schedule_operation_slot_overrides WHERE operation_id = ?",
        (operation_id,),
    )
    con.executemany(
        """
        INSERT INTO production_schedule_operation_slot_overrides (
            operation_id, slot_number, is_filled, updated_by, created_at, updated_at
        ) VALUES (?, ?, 1, ?, ?, ?)
        """,
        [
            (operation_id, slot_number, updated_by, timestamp, timestamp)
            for slot_number in resized_slots
        ],
    )


def migrate_legacy_production_schedule(con: sqlite3.Connection, project_id: int) -> None:
    if con.execute("SELECT 1 FROM production_schedule_migration_state WHERE project_id = ?", (project_id,)).fetchone():
        return
    timestamp = now_ts()
    primary_by_estimate: dict[int, int] = {}
    rows = con.execute(
        """
        SELECT link.estimate_item_id, operation.id AS operation_id
        FROM production_schedule_operation_estimate_links link
        JOIN production_schedule_operations operation ON operation.id = link.operation_id
        WHERE operation.project_id = ? AND link.link_role = 'work_basis'
        ORDER BY operation.position, operation.id
        """,
        (project_id,),
    ).fetchall()
    for row in rows:
        primary_by_estimate.setdefault(int(row["estimate_item_id"]), int(row["operation_id"]))

    if production_table_exists(con, "work_schedule_overrides"):
        overrides = con.execute(
            """
            SELECT estimate_item_id, duration_days, crew_size
            FROM work_schedule_overrides
            WHERE project_id = ? AND schedule_context = 'production'
            """,
            (project_id,),
        ).fetchall()
        for override in overrides:
            operation_id = primary_by_estimate.get(int(override["estimate_item_id"]))
            if not operation_id:
                continue
            operation = con.execute("SELECT manual_fields, manual_duration_days FROM production_schedule_operations WHERE id = ?", (operation_id,)).fetchone()
            fields = production_manual_fields(operation["manual_fields"])
            duration = positive_schedule_half_days(override["duration_days"])
            crew = positive_schedule_int(override["crew_size"])
            if duration is not None and operation["manual_duration_days"] is None:
                fields.add("duration_days")
                con.execute("UPDATE production_schedule_operations SET manual_duration_days = ? WHERE id = ?", (duration, operation_id))
            if crew is not None:
                fields.add("people_count")
                con.execute("UPDATE production_schedule_operations SET people_count = ? WHERE id = ?", (crew, operation_id))
            con.execute(
                "UPDATE production_schedule_operations SET manual_fields = ?, updated_at = ? WHERE id = ?",
                (production_encode_manual_fields(fields), timestamp, operation_id),
            )

    slot_rows: list[tuple[int, int, int]] = []
    if production_table_exists(con, "production_schedule_slot_overrides"):
        slot_rows = [
            (int(row["estimate_item_id"]), int(row["slot_number"]), int(row["is_filled"]))
            for row in con.execute(
                "SELECT estimate_item_id, slot_number, is_filled FROM production_schedule_slot_overrides WHERE project_id = ?",
                (project_id,),
            ).fetchall()
        ]
    elif production_table_exists(con, "production_schedule_cell_overrides"):
        for row in con.execute(
            "SELECT estimate_item_id, day_number, is_filled FROM production_schedule_cell_overrides WHERE project_id = ?",
            (project_id,),
        ).fetchall():
            slot_rows.extend(
                [
                    (int(row["estimate_item_id"]), int(row["day_number"]) * 2 - 1, int(row["is_filled"])),
                    (int(row["estimate_item_id"]), int(row["day_number"]) * 2, int(row["is_filled"])),
                ]
            )
    base_slots = production_operation_base_slots(con, project_id)
    legacy_by_operation: dict[int, dict[int, bool]] = {}
    for estimate_item_id, slot_number, is_filled in slot_rows:
        operation_id = primary_by_estimate.get(estimate_item_id)
        if not operation_id:
            continue
        legacy_by_operation.setdefault(operation_id, {})[slot_number] = bool(is_filled)
    for operation_id, overrides in legacy_by_operation.items():
        effective_slots = set(base_slots.get(operation_id, set()))
        for slot_number, is_filled in overrides.items():
            if is_filled:
                effective_slots.add(slot_number)
            else:
                effective_slots.discard(slot_number)
        con.execute("DELETE FROM production_schedule_operation_slot_overrides WHERE operation_id = ?", (operation_id,))
        for slot_number in sorted(effective_slots):
            con.execute(
                """
                INSERT INTO production_schedule_operation_slot_overrides (
                    operation_id, slot_number, is_filled, created_at, updated_at
                ) VALUES (?, ?, 1, ?, ?)
                """,
                (operation_id, slot_number, timestamp, timestamp),
            )
        con.execute(
            "UPDATE production_schedule_operations SET placement_mode = 'manual', updated_at = ? WHERE id = ? AND project_id = ?",
            (timestamp, operation_id, project_id),
        )
    con.execute(
        "INSERT INTO production_schedule_migration_state (project_id, legacy_migrated_at) VALUES (?, ?)",
        (project_id, timestamp),
    )


def build_production_schedule_payload(con: sqlite3.Connection, project_id: int) -> dict:
    project = production_project_calendar_row(con, project_id)
    if not project:
        raise LookupError("project_not_found")
    if not production_table_exists(con, "production_schedule_operations"):
        raise RuntimeError("production_schedule_schema_missing")
    raw_rows = production_estimate_rows(con, project_id)
    generation = sync_production_schedule_operations(con, project, raw_rows)
    migrate_legacy_production_schedule(con, project_id)
    explicit_project_start = parse_iso_date(project["started_at"])
    project_start = explicit_project_start or date.today()
    today_date = date.today()
    actual_summaries = production_operation_actual_summaries(con, project_id)

    live_by_id = {int(row["id"]): row for row in raw_rows}
    links_by_operation: dict[int, list[dict]] = {}
    link_rows = con.execute(
        """
        SELECT link.operation_id, link.estimate_item_id, link.link_role
        FROM production_schedule_operation_estimate_links link
        JOIN production_schedule_operations operation ON operation.id = link.operation_id
        WHERE operation.project_id = ?
        ORDER BY link.operation_id, link.estimate_item_id, link.link_role
        """,
        (project_id,),
    ).fetchall()
    for link in link_rows:
        estimate_id = int(link["estimate_item_id"])
        estimate = live_by_id.get(estimate_id)
        links_by_operation.setdefault(int(link["operation_id"]), []).append(
            {
                "estimateItemId": estimate_id,
                "role": str(link["link_role"]),
                "title": str(estimate["title"] or "") if estimate else "",
                "unit": str(estimate["unit"] or "") if estimate else "",
                "plannedQty": production_row_qty(estimate),
                "itemKind": normalize_estimate_item_kind(resolved_estimate_item_kind(estimate)) if estimate else "",
                "article": str(estimate["article"] or "") if estimate else "",
                "sectionTitle": str(
                    schedule_item_value(estimate, "section_title", "sectionTitle", default="") or ""
                ) if estimate else "",
                "estimateSourceId": schedule_item_value(
                    estimate, "estimate_source_id", "estimateSourceId", default=None
                ) if estimate else None,
                "estimateSourceKey": str(
                    schedule_item_value(estimate, "estimate_source_key", "estimateSourceKey", default="") or ""
                ) if estimate else "",
                "estimateSourceType": str(
                    schedule_item_value(estimate, "estimate_source_type", "estimateSourceType", default="") or ""
                ) if estimate else "",
                "sourceItemKey": str(
                    schedule_item_value(estimate, "source_item_key", "sourceItemKey", default="") or ""
                ) if estimate else "",
                "isStale": estimate is None,
            }
        )

    slot_overrides: dict[int, dict[int, bool]] = {}
    for row in con.execute(
        """
        SELECT slot.operation_id, slot.slot_number, slot.is_filled
        FROM production_schedule_operation_slot_overrides slot
        JOIN production_schedule_operations operation ON operation.id = slot.operation_id
        WHERE operation.project_id = ?
        ORDER BY slot.operation_id, slot.slot_number
        """,
        (project_id,),
    ).fetchall():
        slot_overrides.setdefault(int(row["operation_id"]), {})[int(row["slot_number"])] = bool(row["is_filled"])

    cursor_slot = 1
    day_count = 0
    items: list[dict] = []
    operation_rows = con.execute(
        "SELECT * FROM production_schedule_operations WHERE project_id = ? ORDER BY position, id",
        (project_id,),
    ).fetchall()
    for operation in operation_rows:
        operation_id = int(operation["id"])
        manual_duration = positive_schedule_half_days(operation["manual_duration_days"])
        auto_duration = positive_schedule_half_days(operation["auto_duration_days"]) or 1.0
        duration_days = manual_duration if manual_duration is not None else auto_duration
        duration_slots = max(1, int(round(duration_days * 2)))
        base_slots = set(range(cursor_slot, cursor_slot + duration_slots))
        stored_slots = slot_overrides.get(operation_id, {})
        placement_mode = str(operation["placement_mode"] or "auto")
        if placement_mode == "manual":
            effective_slots = {slot_number for slot_number, is_filled in stored_slots.items() if is_filled}
            overridden_slots = base_slots.symmetric_difference(effective_slots)
        else:
            effective_slots = set(base_slots)
            for slot_number, is_filled in stored_slots.items():
                if is_filled:
                    effective_slots.add(slot_number)
                else:
                    effective_slots.discard(slot_number)
            overridden_slots = set(stored_slots)
        auto_start_slot = cursor_slot
        auto_end_slot = cursor_slot + duration_slots - 1
        cursor_slot = auto_end_slot + 1
        if effective_slots:
            day_count = max(day_count, math.ceil(max(effective_slots) / 2))
        day_count = max(day_count, math.ceil(auto_end_slot / 2))
        links = links_by_operation.get(operation_id, [])
        linked_ids = sorted({int(link["estimateItemId"]) for link in links})
        work_basis = next((link for link in links if link["role"] == "work_basis"), None)
        status = str(operation["status"] or "needs_review")
        live_link_ids = {int(link["estimateItemId"]) for link in links if not link["isStale"]}
        if int(operation["source_link_count"] or 0) > len(live_link_ids) or any(link["isStale"] for link in links):
            status = "stale"
        manual_fields = production_manual_fields(operation["manual_fields"])
        actual_summary = actual_summaries.get(
            operation_id,
            {
                "actualQty": None,
                "actualPlannedQty": None,
                "actualProgress": None,
                "isCompleted": False,
                "hasActualData": False,
            },
        )
        execution_health = production_schedule_execution_health(
            operation_status=status,
            actual_summary=actual_summary,
            effective_slots=effective_slots,
            fallback_slots=base_slots if placement_mode != "manual" else set(),
            project_start=project_start,
            today_date=today_date,
        )
        items.append(
            {
                "id": operation_id,
                "operationId": operation_id,
                "estimateItemId": int(work_basis["estimateItemId"]) if work_basis else None,
                "generationKey": str(operation["generation_key"]),
                "title": str(operation["title"] or ""),
                "unit": str(operation["unit"] or ""),
                "plannedQty": None if operation["planned_qty"] is None else float(operation["planned_qty"]),
                "sectionTitle": "",
                "crewSize": int(operation["people_count"] or 1),
                "peopleCount": int(operation["people_count"] or 1),
                "shiftCount": int(operation["shift_count"] or 1),
                "brigadeCount": int(operation["brigade_count"] or 1),
                "shiftHours": SCHEDULE_SHIFT_HOURS,
                "autoDays": auto_duration,
                "durationDays": duration_slots / 2,
                "effectiveDays": len(effective_slots) / 2,
                "autoStartDay": math.ceil(auto_start_slot / 2),
                "autoEndDay": math.ceil(auto_end_slot / 2),
                "autoStartSlot": auto_start_slot,
                "autoEndSlot": auto_end_slot,
                "autoFilledSlots": sorted(base_slots),
                "filledSlots": sorted(effective_slots),
                "overriddenSlots": sorted(overridden_slots),
                "isDurationOverridden": manual_duration is not None,
                "isCrewOverridden": "people_count" in manual_fields,
                "origin": str(operation["origin"] or "auto"),
                "status": status,
                "color": str(operation["color"] or PRODUCTION_DEFAULT_COLOR),
                "position": int(operation["position"] or 0),
                "templateKey": str(operation["template_key"] or ""),
                "sourceSignature": str(operation["source_signature"] or ""),
                "sourceLinkSnapshots": production_json_array(operation["source_links_snapshot"]),
                "linkedEstimateItemIds": linked_ids,
                "links": links,
                "manualFields": sorted(manual_fields),
                "placementMode": placement_mode,
                "isEdited": bool(manual_fields or manual_duration is not None or overridden_slots),
                "confidence": "template" if operation["origin"] == "template" else ("manual" if operation["origin"] == "manual" else "assumption"),
                "method": f"production_{operation['origin']}",
                "sourceLabel": "Шаблон графика производства" if operation["origin"] == "template" else "Операция графика производства",
                **actual_summary,
                **execution_health,
            }
        )

    estimate_options = [
        {
            "id": int(row["id"]),
            "title": str(row["title"] or ""),
            "unit": str(row["unit"] or ""),
            "plannedQty": production_row_qty(row),
            "itemKind": normalize_estimate_item_kind(resolved_estimate_item_kind(row)),
            "sectionTitle": canonical_estimate_section_title(row["section_title"] or ""),
            "article": str(row["article"] or ""),
        }
        for row in raw_rows
    ]
    generation.update(
        {
            "operationCount": len(items),
            "needsReviewCount": sum(item["status"] in {"needs_review", "stale"} for item in items),
            "hasManualOperations": any(item["origin"] == "manual" for item in items),
        }
    )
    return {
        "projectId": int(project["id"]),
        "projectTitle": str(project["title"] or ""),
        "startDate": project_start.isoformat(),
        "startDateSource": "project" if explicit_project_start else "today",
        "deadlineDate": parse_iso_date(project["deadline_at"]).isoformat() if parse_iso_date(project["deadline_at"]) else None,
        "today": today_date.isoformat(),
        "shiftHours": SCHEDULE_SHIFT_HOURS,
        "dayCount": day_count,
        "autoDayCount": math.ceil(max(0, cursor_slot - 1) / 2),
        "autoSlotCount": max(0, cursor_slot - 1),
        "items": items,
        "operations": items,
        "estimateOptions": estimate_options,
        "generation": generation,
        "template": {"key": generation.get("templateKey"), "matched": generation.get("mode") == "template"},
    }


def build_guest_production_schedule_payload(con: sqlite3.Connection, project_id: int) -> dict:
    """Build the read-only public chart without syncing estimates or exposing editor metadata."""

    project = production_project_calendar_row(con, project_id)
    if not project:
        raise LookupError("project_not_found")
    explicit_project_start = parse_iso_date(project["started_at"])
    project_start = explicit_project_start or date.today()
    today_date = date.today()
    actual_summaries = production_operation_actual_summaries(con, project_id)
    if not production_table_exists(con, "production_schedule_operations"):
        return {
            "projectId": int(project["id"]),
            "projectTitle": str(project["title"] or ""),
            "startDate": project_start.isoformat(),
            "startDateSource": "project" if explicit_project_start else "today",
            "deadlineDate": parse_iso_date(project["deadline_at"]).isoformat() if parse_iso_date(project["deadline_at"]) else None,
            "today": today_date.isoformat(),
            "shiftHours": SCHEDULE_SHIFT_HOURS,
            "dayCount": 0,
            "autoDayCount": 0,
            "items": [],
        }

    slot_overrides: dict[int, dict[int, bool]] = {}
    if production_table_exists(con, "production_schedule_operation_slot_overrides"):
        for row in con.execute(
            """
            SELECT slot.operation_id, slot.slot_number, slot.is_filled
            FROM production_schedule_operation_slot_overrides slot
            JOIN production_schedule_operations operation ON operation.id = slot.operation_id
            WHERE operation.project_id = ?
            ORDER BY slot.operation_id, slot.slot_number
            """,
            (project_id,),
        ).fetchall():
            slot_overrides.setdefault(int(row["operation_id"]), {})[int(row["slot_number"])] = bool(row["is_filled"])

    cursor_slot = 1
    day_count = 0
    items: list[dict] = []
    operation_rows = con.execute(
        "SELECT * FROM production_schedule_operations WHERE project_id = ? ORDER BY position, id",
        (project_id,),
    ).fetchall()
    for operation in operation_rows:
        operation_id = int(operation["id"])
        manual_duration = positive_schedule_half_days(operation["manual_duration_days"])
        auto_duration = positive_schedule_half_days(operation["auto_duration_days"]) or 1.0
        duration_days = manual_duration if manual_duration is not None else auto_duration
        duration_slots = max(1, int(round(duration_days * 2)))
        base_slots = set(range(cursor_slot, cursor_slot + duration_slots))
        stored_slots = slot_overrides.get(operation_id, {})
        placement_mode = str(operation["placement_mode"] or "auto")
        if placement_mode == "manual":
            effective_slots = {slot_number for slot_number, is_filled in stored_slots.items() if is_filled}
            overridden_slots = base_slots.symmetric_difference(effective_slots)
        else:
            effective_slots = set(base_slots)
            for slot_number, is_filled in stored_slots.items():
                if is_filled:
                    effective_slots.add(slot_number)
                else:
                    effective_slots.discard(slot_number)
            overridden_slots = set(stored_slots)
        auto_start_slot = cursor_slot
        auto_end_slot = cursor_slot + duration_slots - 1
        cursor_slot = auto_end_slot + 1
        if effective_slots:
            day_count = max(day_count, math.ceil(max(effective_slots) / 2))
        day_count = max(day_count, math.ceil(auto_end_slot / 2))
        status = str(operation["status"] or "needs_review")
        actual_summary = actual_summaries.get(
            operation_id,
            {
                "actualQty": None,
                "actualPlannedQty": None,
                "actualProgress": None,
                "isCompleted": False,
                "hasActualData": False,
            },
        )
        execution_health = production_schedule_execution_health(
            operation_status=status,
            actual_summary=actual_summary,
            effective_slots=effective_slots,
            fallback_slots=base_slots if placement_mode != "manual" else set(),
            project_start=project_start,
            today_date=today_date,
        )
        items.append(
            {
                "id": operation_id,
                "operationId": operation_id,
                "title": str(operation["title"] or ""),
                "unit": str(operation["unit"] or ""),
                "plannedQty": None if operation["planned_qty"] is None else float(operation["planned_qty"]),
                "sectionTitle": "",
                "crewSize": int(operation["people_count"] or 1),
                "peopleCount": int(operation["people_count"] or 1),
                "shiftCount": int(operation["shift_count"] or 1),
                "brigadeCount": int(operation["brigade_count"] or 1),
                "shiftHours": SCHEDULE_SHIFT_HOURS,
                "durationDays": duration_slots / 2,
                "effectiveDays": len(effective_slots) / 2,
                "autoFilledSlots": sorted(base_slots),
                "filledSlots": sorted(effective_slots),
                "overriddenSlots": sorted(overridden_slots),
                "color": str(operation["color"] or PRODUCTION_DEFAULT_COLOR),
                **actual_summary,
                **execution_health,
            }
        )

    return {
        "projectId": int(project["id"]),
        "projectTitle": str(project["title"] or ""),
        "startDate": project_start.isoformat(),
        "startDateSource": "project" if explicit_project_start else "today",
        "deadlineDate": parse_iso_date(project["deadline_at"]).isoformat() if parse_iso_date(project["deadline_at"]) else None,
        "today": today_date.isoformat(),
        "shiftHours": SCHEDULE_SHIFT_HOURS,
        "dayCount": day_count,
        "autoDayCount": math.ceil(max(0, cursor_slot - 1) / 2),
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
        start_at = requested_start or project_start or date.today()
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
        if "item_kind_override" in columns:
            optional_columns.append("e.item_kind_override")
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
        if normalize_estimate_item_kind(resolved_estimate_item_kind(row)) == "work"
    ]
    if not work_items:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "works_required"})
        return
    project_start = parse_iso_date(project["started_at"])
    start_at = requested_start or project_start or date.today()
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
        kind_override_select = ", item_kind_override" if "item_kind_override" in table_columns(con, "estimate_items") else ""
        item = con.execute(
            f"SELECT id, item_kind{kind_override_select} FROM estimate_items WHERE id = ? AND project_id = ?",
            (item_id, project_id),
        ).fetchone()
        if not item or normalize_estimate_item_kind(resolved_estimate_item_kind(item)) != "work":
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
            schedule = (
                build_guest_production_schedule_payload(con, project_id)
                if user_is_guest(user)
                else build_production_schedule_payload(con, project_id)
            )
        except LookupError:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
    handler.send_json(HTTPStatus.OK, schedule)


def production_payload_value(payload: dict, *keys: str, default: object = None) -> object:
    for key in keys:
        if key in payload:
            return payload.get(key)
    return default


def production_operation_row(con: sqlite3.Connection, project_id: int, operation_id: int) -> sqlite3.Row | None:
    return con.execute(
        "SELECT * FROM production_schedule_operations WHERE id = ? AND project_id = ?",
        (operation_id, project_id),
    ).fetchone()


def resolve_production_operation_id(con: sqlite3.Connection, project_id: int, payload: dict) -> int | None:
    explicit = production_payload_value(payload, "operation_id", "operationId")
    legacy = production_payload_value(payload, "item_id", "itemId")
    raw_id = explicit if explicit not in (None, "") else legacy
    try:
        candidate = int(raw_id)
    except (TypeError, ValueError):
        return None
    if production_operation_row(con, project_id, candidate):
        return candidate
    if explicit not in (None, ""):
        return None
    linked = con.execute(
        """
        SELECT operation.id
        FROM production_schedule_operations operation
        JOIN production_schedule_operation_estimate_links link ON link.operation_id = operation.id
        WHERE operation.project_id = ? AND link.estimate_item_id = ?
        ORDER BY CASE link.link_role WHEN 'work_basis' THEN 0 ELSE 1 END, operation.position, operation.id
        LIMIT 1
        """,
        (project_id, candidate),
    ).fetchone()
    return int(linked["id"]) if linked else None


def production_valid_color(value: object) -> str | None:
    color = str(value or "").strip()
    return color.lower() if color.lower() in PRODUCTION_COLOR_TOKENS else None


def production_valid_status(value: object) -> str | None:
    status = str(value or "").strip().lower()
    allowed = {
        "draft", "linked", "outside_estimate", "needs_review", "confirmed",
        "in_progress", "completed", "on_hold", "stale",
    }
    return status if status in allowed else None


def production_parse_links(con: sqlite3.Connection, project_id: int, payload: dict) -> list[tuple[int, str]] | None:
    has_links = any(key in payload for key in ("links", "linked_estimate_item_ids", "linkedEstimateItemIds"))
    if not has_links:
        return None
    parsed: list[tuple[int, str | None]] = []
    raw_links = payload.get("links")
    if isinstance(raw_links, list):
        for raw_link in raw_links:
            if not isinstance(raw_link, dict):
                raise ValueError("bad_links")
            raw_id = production_payload_value(raw_link, "estimate_item_id", "estimateItemId", "id")
            try:
                item_id = int(raw_id)
            except (TypeError, ValueError):
                raise ValueError("bad_links") from None
            role = str(production_payload_value(raw_link, "role", "link_role", "linkRole", default="") or "").strip().lower() or None
            if role is not None and role not in PRODUCTION_ALLOWED_LINK_ROLES:
                raise ValueError("bad_link_role")
            parsed.append((item_id, role))
    else:
        raw_ids = production_payload_value(payload, "linked_estimate_item_ids", "linkedEstimateItemIds", default=[])
        if not isinstance(raw_ids, list):
            raise ValueError("bad_links")
        for raw_id in raw_ids:
            try:
                parsed.append((int(raw_id), None))
            except (TypeError, ValueError):
                raise ValueError("bad_links") from None
    unique_ids = sorted({item_id for item_id, _ in parsed if item_id > 0})
    if len(unique_ids) != len({item_id for item_id, _ in parsed}) or any(item_id <= 0 for item_id, _ in parsed):
        raise ValueError("bad_links")
    found: dict[int, str] = {}
    if unique_ids:
        placeholders = ",".join("?" for _ in unique_ids)
        live_where = live_estimate_items_where(con, "")
        rows = con.execute(
            f"SELECT * FROM estimate_items WHERE project_id = ? AND id IN ({placeholders}) AND {live_where}",
            (project_id, *unique_ids),
        ).fetchall()
        found = {int(row["id"]): normalize_estimate_item_kind(resolved_estimate_item_kind(row)) for row in rows}
    if set(unique_ids) != set(found):
        raise ValueError("estimate_item_not_found")
    result: list[tuple[int, str]] = []
    seen: set[tuple[int, str]] = set()
    for item_id, explicit_role in parsed:
        role = explicit_role or ("work_basis" if found[item_id] == "work" else "material_signal")
        link = (item_id, role)
        if link not in seen:
            seen.add(link)
            result.append(link)
    return result


def production_replace_links(
    con: sqlite3.Connection,
    project_id: int,
    operation_id: int,
    links: list[tuple[int, str]],
) -> None:
    if not production_operation_row(con, project_id, operation_id):
        raise LookupError("operation_not_found")
    if links:
        item_ids = sorted({item_id for item_id, _ in links})
        placeholders = ",".join("?" for _ in item_ids)
        rows = con.execute(
            f"SELECT id FROM estimate_items WHERE project_id = ? AND id IN ({placeholders})",
            (project_id, *item_ids),
        ).fetchall()
        if {int(row["id"]) for row in rows} != set(item_ids):
            raise ValueError("estimate_item_not_found")
    con.execute("DELETE FROM production_schedule_operation_estimate_links WHERE operation_id = ?", (operation_id,))
    timestamp = now_ts()
    for estimate_item_id, role in links:
        con.execute(
            "INSERT INTO production_schedule_operation_estimate_links (operation_id, estimate_item_id, link_role, created_at) VALUES (?, ?, ?, ?)",
            (operation_id, estimate_item_id, role, timestamp),
        )
    linked_rows: list[sqlite3.Row] = []
    if links:
        item_ids = sorted({item_id for item_id, _ in links})
        placeholders = ",".join("?" for _ in item_ids)
        linked_rows = con.execute(
            f"SELECT * FROM estimate_items WHERE project_id = ? AND id IN ({placeholders})",
            (project_id, *item_ids),
        ).fetchall()
    snapshot = production_source_links_snapshot({"links": links}, linked_rows)
    con.execute(
        "UPDATE production_schedule_operations SET source_link_count = ?, source_links_snapshot = ?, updated_at = ? WHERE id = ? AND project_id = ?",
        (len({item_id for item_id, _ in links}), snapshot, timestamp, operation_id, project_id),
    )


def production_normalize_positions(con: sqlite3.Connection, project_id: int) -> None:
    rows = con.execute(
        "SELECT id FROM production_schedule_operations WHERE project_id = ? ORDER BY position, id",
        (project_id,),
    ).fetchall()
    for position, row in enumerate(rows):
        con.execute(
            "UPDATE production_schedule_operations SET position = ? WHERE id = ? AND project_id = ?",
            (position, int(row["id"]), project_id),
        )


def production_set_manual_fields(
    con: sqlite3.Connection,
    project_id: int,
    operation_id: int,
    added_fields: set[str],
    removed_fields: set[str] | None = None,
) -> None:
    operation = production_operation_row(con, project_id, operation_id)
    if not operation:
        raise LookupError("operation_not_found")
    fields = production_manual_fields(operation["manual_fields"])
    fields.update(added_fields)
    fields.difference_update(removed_fields or set())
    con.execute(
        "UPDATE production_schedule_operations SET manual_fields = ?, updated_at = ? WHERE id = ? AND project_id = ?",
        (production_encode_manual_fields(fields), now_ts(), operation_id, project_id),
    )


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
        project = con.execute("SELECT id, title FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            handler.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return
        raw_rows = production_estimate_rows(con, project_id)
        sync_production_schedule_operations(con, project, raw_rows)
        migrate_legacy_production_schedule(con, project_id)
        audit_payload: dict = {"project_id": project_id, "action": action}
        timestamp = now_ts()

        if action == "set_cell":
            operation_id = resolve_production_operation_id(con, project_id, payload)
            try:
                slot_number = int(production_payload_value(payload, "slot_number", "slotNumber"))
            except (TypeError, ValueError):
                slot_number = 0
            if not operation_id:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "operation_not_found"})
                return
            if slot_number < 1 or slot_number > 7300:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_slot_number"})
                return
            is_filled = 1 if production_payload_value(payload, "is_filled", "isFilled", default=False) else 0
            operation = production_operation_row(con, project_id, operation_id)
            if str(operation["placement_mode"] or "auto") != "manual":
                current_schedule = build_production_schedule_payload(con, project_id)
                current_item = next(item for item in current_schedule["items"] if int(item["id"]) == operation_id)
                con.execute("DELETE FROM production_schedule_operation_slot_overrides WHERE operation_id = ?", (operation_id,))
                for current_slot in current_item["filledSlots"]:
                    con.execute(
                        """
                        INSERT INTO production_schedule_operation_slot_overrides (
                            operation_id, slot_number, is_filled, updated_by, created_at, updated_at
                        ) VALUES (?, ?, 1, ?, ?, ?)
                        """,
                        (operation_id, int(current_slot), user["id"], timestamp, timestamp),
                    )
                con.execute(
                    "UPDATE production_schedule_operations SET placement_mode = 'manual', updated_by = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                    (user["id"], timestamp, operation_id, project_id),
                )
            if is_filled:
                con.execute(
                    """
                    INSERT INTO production_schedule_operation_slot_overrides (
                        operation_id, slot_number, is_filled, updated_by, created_at, updated_at
                    ) VALUES (?, ?, 1, ?, ?, ?)
                    ON CONFLICT(operation_id, slot_number) DO UPDATE SET
                        is_filled = 1,
                        updated_by = excluded.updated_by,
                        updated_at = excluded.updated_at
                    """,
                    (operation_id, slot_number, user["id"], timestamp, timestamp),
                )
            else:
                con.execute(
                    "DELETE FROM production_schedule_operation_slot_overrides WHERE operation_id = ? AND slot_number = ?",
                    (operation_id, slot_number),
                )
            audit_payload.update({"operation_id": operation_id, "slot_number": slot_number, "is_filled": bool(is_filled)})

        elif action == "set_duration":
            operation_id = resolve_production_operation_id(con, project_id, payload)
            if not operation_id:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "operation_not_found"})
                return
            reset = bool(payload.get("reset"))
            duration_days = positive_schedule_half_days(production_payload_value(payload, "duration_days", "durationDays"))
            if not reset and (duration_days is None or duration_days > 3650):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_duration_days"})
                return
            con.execute(
                "UPDATE production_schedule_operations SET manual_duration_days = ?, updated_by = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                (None if reset else duration_days, user["id"], timestamp, operation_id, project_id),
            )
            production_set_manual_fields(
                con,
                project_id,
                operation_id,
                set() if reset else {"duration_days"},
                {"duration_days"} if reset else set(),
            )
            resized_operation = production_operation_row(con, project_id, operation_id)
            resized_duration = (
                positive_schedule_half_days(resized_operation["manual_duration_days"])
                or positive_schedule_half_days(resized_operation["auto_duration_days"])
                or 1.0
            )
            production_resize_manual_slot_snapshot(
                con,
                project_id,
                operation_id,
                resized_duration,
                user["id"],
                timestamp,
            )
            audit_payload.update({"operation_id": operation_id, "duration_days": None if reset else duration_days, "reset": reset})

        elif action == "add_operation":
            title = str(payload.get("title") or "").strip()
            if not title or len(title) > 500:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_title"})
                return
            raw_planned_qty = production_payload_value(payload, "planned_qty", "plannedQty")
            if raw_planned_qty in (None, ""):
                planned_qty = None
            else:
                try:
                    planned_qty = float(raw_planned_qty)
                except (TypeError, ValueError):
                    planned_qty = -1
            duration_days = positive_schedule_half_days(production_payload_value(payload, "duration_days", "durationDays", default=1))
            people = positive_schedule_int(production_payload_value(payload, "people_count", "peopleCount", default=1))
            shifts = positive_schedule_int(production_payload_value(payload, "shift_count", "shiftCount", default=1))
            brigades = positive_schedule_int(production_payload_value(payload, "brigade_count", "brigadeCount", default=1))
            color_raw = production_payload_value(payload, "color", default=PRODUCTION_DEFAULT_COLOR)
            color = production_valid_color(color_raw)
            status = production_valid_status(production_payload_value(payload, "status", default="needs_review"))
            if planned_qty is not None and (not math.isfinite(planned_qty) or planned_qty < 0):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_planned_qty"})
                return
            if duration_days is None or duration_days > 3650:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_duration_days"})
                return
            if not people or people > 999 or not shifts or shifts > 99 or not brigades or brigades > 999:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_capacity"})
                return
            if not color:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_color"})
                return
            if not status:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_status"})
                return
            try:
                links = production_parse_links(con, project_id, payload) or []
            except ValueError as exc:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            max_position = con.execute(
                "SELECT COALESCE(MAX(position), -1) AS value FROM production_schedule_operations WHERE project_id = ?",
                (project_id,),
            ).fetchone()["value"]
            position = int(max_position) + 1 if max_position is not None else 0
            generation_key = f"manual:{project_id}:{time.time_ns()}"
            manual_fields = {"title", "planned_qty", "unit", "people_count", "shift_count", "brigade_count", "duration_days", "color", "status"}
            cursor = con.execute(
                """
                INSERT INTO production_schedule_operations (
                    project_id, generation_key, title, planned_qty, unit, people_count,
                    shift_count, brigade_count, labor_hours_total, auto_duration_days,
                    manual_duration_days, position, origin, status, color, source_link_count,
                    manual_fields, created_by, updated_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id, generation_key, title, planned_qty,
                    str(payload.get("unit") or "").strip()[:40], people, shifts, brigades,
                    duration_days * people * shifts * brigades * SCHEDULE_SHIFT_HOURS,
                    duration_days, duration_days, position, status, color, len({item_id for item_id, _ in links}),
                    production_encode_manual_fields(manual_fields), user["id"], user["id"], timestamp, timestamp,
                ),
            )
            operation_id = int(cursor.lastrowid)
            production_replace_links(con, project_id, operation_id, links)
            audit_payload.update({"operation_id": operation_id, "title": title})

        elif action == "update_operation":
            operation_id = resolve_production_operation_id(con, project_id, payload)
            operation = production_operation_row(con, project_id, operation_id or 0)
            if not operation:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "operation_not_found"})
                return
            updates: dict[str, object] = {}
            manual_fields: set[str] = set()
            if "title" in payload:
                title = str(payload.get("title") or "").strip()
                if not title or len(title) > 500:
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_title"})
                    return
                updates["title"] = title
                manual_fields.add("title")
            if "planned_qty" in payload or "plannedQty" in payload:
                raw_planned_qty = production_payload_value(payload, "planned_qty", "plannedQty")
                if raw_planned_qty in (None, ""):
                    planned_qty = None
                else:
                    try:
                        planned_qty = float(raw_planned_qty)
                    except (TypeError, ValueError):
                        planned_qty = -1
                if planned_qty is not None and (not math.isfinite(planned_qty) or planned_qty < 0):
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_planned_qty"})
                    return
                updates["planned_qty"] = planned_qty
                manual_fields.add("planned_qty")
            if "unit" in payload:
                updates["unit"] = str(payload.get("unit") or "").strip()[:40]
                manual_fields.add("unit")
            capacity_fields = (
                ("people_count", "peopleCount", "people_count", 999),
                ("shift_count", "shiftCount", "shift_count", 99),
                ("brigade_count", "brigadeCount", "brigade_count", 999),
            )
            for snake, camel, column, maximum in capacity_fields:
                if snake not in payload and camel not in payload:
                    continue
                value = positive_schedule_int(production_payload_value(payload, snake, camel))
                if value is None or value > maximum:
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_capacity"})
                    return
                updates[column] = value
                manual_fields.add(column)
            if "duration_days" in payload or "durationDays" in payload:
                duration = positive_schedule_half_days(production_payload_value(payload, "duration_days", "durationDays"))
                if duration is None or duration > 3650:
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_duration_days"})
                    return
                updates["manual_duration_days"] = duration
                manual_fields.add("duration_days")
            if "color" in payload:
                color = production_valid_color(payload.get("color"))
                if not color:
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_color"})
                    return
                updates["color"] = color
                manual_fields.add("color")
            if "status" in payload:
                status = production_valid_status(payload.get("status"))
                if not status:
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_status"})
                    return
                updates["status"] = status
                manual_fields.add("status")
            try:
                links = production_parse_links(con, project_id, payload)
            except ValueError as exc:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            if links is not None:
                if "links" not in payload:
                    prior_roles = {
                        int(row["estimate_item_id"]): str(row["link_role"])
                        for row in con.execute(
                            "SELECT estimate_item_id, link_role FROM production_schedule_operation_estimate_links WHERE operation_id = ? ORDER BY link_role",
                            (operation_id,),
                        ).fetchall()
                    }
                    links = [(estimate_item_id, prior_roles.get(estimate_item_id, role)) for estimate_item_id, role in links]
                production_replace_links(con, project_id, operation_id, links)
                manual_fields.add("links")
                if str(operation["status"] or "") == "stale" and "status" not in payload:
                    updates["status"] = "needs_review"
                    manual_fields.add("status")
            if updates:
                assignments = ", ".join(f"{column} = ?" for column in updates)
                con.execute(
                    f"UPDATE production_schedule_operations SET {assignments}, updated_by = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                    (*updates.values(), user["id"], timestamp, operation_id, project_id),
                )
            if any(field in manual_fields for field in {"people_count", "shift_count", "brigade_count"}):
                refreshed = production_operation_row(con, project_id, operation_id)
                auto_duration = production_recalculated_days(
                    refreshed["labor_hours_total"], refreshed["people_count"], refreshed["shift_count"], refreshed["brigade_count"], refreshed["auto_duration_days"]
                )
                con.execute(
                    "UPDATE production_schedule_operations SET auto_duration_days = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                    (auto_duration, timestamp, operation_id, project_id),
                )
            resized_operation = production_operation_row(con, project_id, operation_id)
            capacity_changes_duration = (
                any(field in manual_fields for field in {"people_count", "shift_count", "brigade_count"})
                and resized_operation["manual_duration_days"] is None
            )
            if "duration_days" in manual_fields or capacity_changes_duration:
                resized_duration = (
                    positive_schedule_half_days(resized_operation["manual_duration_days"])
                    or positive_schedule_half_days(resized_operation["auto_duration_days"])
                    or 1.0
                )
                production_resize_manual_slot_snapshot(
                    con,
                    project_id,
                    operation_id,
                    resized_duration,
                    user["id"],
                    timestamp,
                )
            production_set_manual_fields(con, project_id, operation_id, manual_fields)
            audit_payload.update({"operation_id": operation_id, "fields": sorted(manual_fields)})

        elif action == "delete_operation":
            operation_id = resolve_production_operation_id(con, project_id, payload)
            operation = production_operation_row(con, project_id, operation_id or 0)
            if not operation:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "operation_not_found"})
                return
            if operation["origin"] in {"auto", "template"}:
                con.execute(
                    """
                    INSERT OR IGNORE INTO production_schedule_suppressed_keys (
                        project_id, generation_key, created_by, created_at
                    ) VALUES (?, ?, ?, ?)
                    """,
                    (project_id, str(operation["generation_key"]), user["id"], timestamp),
                )
            con.execute("DELETE FROM production_schedule_operations WHERE id = ? AND project_id = ?", (operation_id, project_id))
            production_normalize_positions(con, project_id)
            audit_payload.update({"operation_id": operation_id})

        elif action == "split_operation":
            operation_id = resolve_production_operation_id(con, project_id, payload)
            operation = production_operation_row(con, project_id, operation_id or 0)
            if not operation:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "operation_not_found"})
                return
            duration = positive_schedule_half_days(operation["manual_duration_days"]) or positive_schedule_half_days(operation["auto_duration_days"]) or 1.0
            if str(operation["placement_mode"] or "auto") == "manual":
                handler.send_json(HTTPStatus.CONFLICT, {"error": "manual_placement_cannot_split"})
                return
            if duration < 1:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "duration_too_short_to_split"})
                return
            raw_parts = payload.get("parts")
            if not isinstance(raw_parts, list) or len(raw_parts) < 2:
                slots = max(2, int(round(duration * 2)))
                first_slots = max(1, slots // 2)
                raw_parts = [
                    {"title": f"{operation['title']} — этап 1", "duration_days": first_slots / 2},
                    {"title": f"{operation['title']} — этап 2", "duration_days": (slots - first_slots) / 2},
                ]
            if len(raw_parts) > 20 or any(not isinstance(part, dict) for part in raw_parts):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_parts"})
                return
            parsed_parts: list[dict] = []
            for index, part in enumerate(raw_parts):
                part_title = str(part.get("title") or f"{operation['title']} — этап {index + 1}").strip()
                part_duration = positive_schedule_half_days(production_payload_value(part, "duration_days", "durationDays", default=duration / len(raw_parts)))
                default_part_qty = None if operation["planned_qty"] is None else float(operation["planned_qty"]) / len(raw_parts)
                raw_part_qty = production_payload_value(part, "planned_qty", "plannedQty", default=default_part_qty)
                if raw_part_qty in (None, ""):
                    part_qty = None
                else:
                    try:
                        part_qty = float(raw_part_qty)
                    except (TypeError, ValueError):
                        part_qty = -1
                if not part_title or len(part_title) > 500 or part_duration is None or part_duration > 3650 or (part_qty is not None and (not math.isfinite(part_qty) or part_qty < 0)):
                    handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_parts"})
                    return
                parsed_parts.append({"title": part_title, "duration": part_duration, "qty": part_qty, "unit": str(part.get("unit", operation["unit"]) or "")[:40]})
            original_links = [
                (int(row["estimate_item_id"]), str(row["link_role"]))
                for row in con.execute(
                    "SELECT estimate_item_id, link_role FROM production_schedule_operation_estimate_links WHERE operation_id = ?",
                    (operation_id,),
                ).fetchall()
            ]
            replacement_generation_key = str(operation["generation_key"])
            replacement_origin = str(operation["origin"])
            if operation["origin"] in {"auto", "template"}:
                con.execute(
                    """
                    INSERT OR IGNORE INTO production_schedule_suppressed_keys (
                        project_id, generation_key, created_by, created_at
                    ) VALUES (?, ?, ?, ?)
                    """,
                    (project_id, str(operation["generation_key"]), user["id"], timestamp),
                )
                replacement_generation_key = f"manual:{project_id}:{time.time_ns()}:split-root"
                replacement_origin = "manual"
            con.execute(
                """
                UPDATE production_schedule_operations
                SET title = ?, planned_qty = ?, unit = ?, labor_hours_total = ?,
                    auto_duration_days = ?, manual_duration_days = ?, status = 'needs_review',
                    generation_key = ?, origin = ?, template_key = NULL,
                    updated_by = ?, updated_at = ?
                WHERE id = ? AND project_id = ?
                """,
                (
                    parsed_parts[0]["title"], parsed_parts[0]["qty"], parsed_parts[0]["unit"],
                    parsed_parts[0]["duration"] * int(operation["people_count"] or 1) * int(operation["shift_count"] or 1) * int(operation["brigade_count"] or 1) * SCHEDULE_SHIFT_HOURS,
                    parsed_parts[0]["duration"], parsed_parts[0]["duration"], replacement_generation_key, replacement_origin,
                    user["id"], timestamp,
                    operation_id, project_id,
                ),
            )
            production_set_manual_fields(con, project_id, operation_id, {"title", "planned_qty", "unit", "duration_days", "status"})
            con.execute(
                "UPDATE production_schedule_operations SET position = position + ? WHERE project_id = ? AND position > ?",
                (len(parsed_parts) - 1, project_id, int(operation["position"])),
            )
            created_ids = [operation_id]
            for offset, part in enumerate(parsed_parts[1:], start=1):
                cursor = con.execute(
                    """
                    INSERT INTO production_schedule_operations (
                        project_id, generation_key, title, planned_qty, unit, people_count,
                        shift_count, brigade_count, labor_hours_total, auto_duration_days,
                        manual_duration_days, position, origin, status, color, source_signature,
                        source_link_count, manual_fields, created_by, updated_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'needs_review', ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id, f"manual:{project_id}:{time.time_ns()}:{offset}", part["title"], part["qty"], part["unit"],
                        operation["people_count"], operation["shift_count"], operation["brigade_count"],
                        part["duration"] * int(operation["people_count"] or 1) * int(operation["shift_count"] or 1) * int(operation["brigade_count"] or 1) * SCHEDULE_SHIFT_HOURS,
                        part["duration"], part["duration"], int(operation["position"]) + offset, operation["color"], operation["source_signature"],
                        len({item_id for item_id, _ in original_links}),
                        production_encode_manual_fields({"title", "planned_qty", "unit", "duration_days", "status"}),
                        user["id"], user["id"], timestamp, timestamp,
                    ),
                )
                new_id = int(cursor.lastrowid)
                production_replace_links(con, project_id, new_id, original_links)
                created_ids.append(new_id)
            production_normalize_positions(con, project_id)
            audit_payload.update({"operation_id": operation_id, "created_operation_ids": created_ids})

        elif action == "reorder_operations":
            raw_ids = production_payload_value(payload, "operation_ids", "operationIds")
            if not isinstance(raw_ids, list):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_operation_ids"})
                return
            try:
                operation_ids = [int(value) for value in raw_ids]
            except (TypeError, ValueError):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_operation_ids"})
                return
            if len(operation_ids) != len(set(operation_ids)):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_operation_ids"})
                return
            owned = {
                int(row["id"])
                for row in con.execute("SELECT id FROM production_schedule_operations WHERE project_id = ?", (project_id,)).fetchall()
            }
            if not set(operation_ids).issubset(owned):
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "operation_not_found"})
                return
            remaining = [
                int(row["id"])
                for row in con.execute(
                    "SELECT id FROM production_schedule_operations WHERE project_id = ? ORDER BY position, id",
                    (project_id,),
                ).fetchall()
                if int(row["id"]) not in set(operation_ids)
            ]
            for position, operation_id in enumerate(operation_ids + remaining):
                con.execute(
                    "UPDATE production_schedule_operations SET position = ?, updated_by = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                    (position, user["id"], timestamp, operation_id, project_id),
                )
            audit_payload.update({"operation_ids": operation_ids})

        elif action == "recalculate":
            # Synchronisation is intentionally non-destructive: manual operations,
            # edited fields, manual duration and half-day cells remain intact.
            if bool(production_payload_value(payload, "restore_deleted", "restoreDeleted", default=False)):
                con.execute("DELETE FROM production_schedule_suppressed_keys WHERE project_id = ?", (project_id,))
            generation = sync_production_schedule_operations(con, project, raw_rows)
            audit_payload.update({"preserve_manual": True, "generation": generation, "restore_deleted": bool(production_payload_value(payload, "restore_deleted", "restoreDeleted", default=False))})

        elif action == "save_template":
            if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"})):
                handler.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
                return
            name = str(payload.get("name") or f"Шаблон: {project['title']}").strip()
            if not name or len(name) > 120:
                handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_template_name"})
                return
            snapshot = build_production_schedule_payload(con, project_id)
            signature = str(snapshot["generation"].get("sourceSignature") or "")
            requested_operation_id = resolve_production_operation_id(con, project_id, payload)
            if any(key in payload for key in ("operation_id", "operationId", "item_id", "itemId")) and not requested_operation_id:
                handler.send_json(HTTPStatus.NOT_FOUND, {"error": "operation_not_found"})
                return
            snapshot_items = [
                item for item in snapshot["items"]
                if requested_operation_id is None or int(item["id"]) == requested_operation_id
            ]
            template_payload = {
                "version": 1,
                "scope": "operation" if requested_operation_id is not None else "schedule",
                "shiftHours": SCHEDULE_SHIFT_HOURS,
                "operations": [
                    {
                        key: item.get(key)
                        for key in (
                            "title", "unit", "plannedQty", "peopleCount", "shiftCount", "brigadeCount",
                            "autoDays", "durationDays", "origin", "status", "color", "links",
                        )
                    }
                    for item in snapshot_items
                ],
            }
            con.execute(
                """
                INSERT INTO production_schedule_templates (
                    name, signature, payload, source_project_id, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(signature, name) DO UPDATE SET
                    payload = excluded.payload,
                    source_project_id = excluded.source_project_id,
                    created_by = excluded.created_by,
                    updated_at = excluded.updated_at
                """,
                (name, signature, json.dumps(template_payload, ensure_ascii=False), project_id, user["id"], timestamp, timestamp),
            )
            audit_payload.update({"name": name, "signature": signature, "operation_id": requested_operation_id})

        elif action in {"reset_cells", "reset_all"}:
            con.execute(
                "DELETE FROM production_schedule_operation_slot_overrides WHERE operation_id IN (SELECT id FROM production_schedule_operations WHERE project_id = ?)",
                (project_id,),
            )
            con.execute(
                "UPDATE production_schedule_operations SET placement_mode = 'auto', updated_at = ? WHERE project_id = ?",
                (timestamp, project_id),
            )
            if action == "reset_all":
                con.execute(
                    "UPDATE production_schedule_operations SET manual_duration_days = NULL, updated_at = ? WHERE project_id = ? AND origin != 'manual'",
                    (timestamp, project_id),
                )
                for operation in con.execute(
                    "SELECT id, manual_fields FROM production_schedule_operations WHERE project_id = ? AND origin != 'manual'",
                    (project_id,),
                ).fetchall():
                    fields = production_manual_fields(operation["manual_fields"])
                    fields.discard("duration_days")
                    con.execute(
                        "UPDATE production_schedule_operations SET manual_fields = ? WHERE id = ? AND project_id = ?",
                        (production_encode_manual_fields(fields), int(operation["id"]), project_id),
                    )
            audit_payload.update({"reset": action})

        else:
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_action"})
            return

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
    raw_item_kind = payload.get("item_kind", payload.get("itemKind"))
    item_kind = {
        "work": "work",
        "works": "work",
        "material": "material",
        "materials": "material",
    }.get(str(raw_item_kind or "").strip().lower())
    if not item_kind:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_bulk_item_kind"})
        return
    path_parts = path.strip("/").split("/")
    path_section_raw = ""
    if len(path_parts) >= 6 and path_parts[3] == "sections":
        path_section_raw = urllib.parse.unquote(path_parts[4])
    path_section_int = parse_path_int(path, 4)
    section_raw = path_section_raw or str(payload.get("section_id", payload.get("sectionId", "")) or "")
    section_title_raw = str(payload.get("section_title", payload.get("sectionTitle", "")) or "")
    section_id = normalize_progress_section_id(section_raw or section_title_raw)
    completed = 1 if payload.get("completed", True) else 0
    item_ids_explicit = "item_ids" in payload or "itemIds" in payload
    raw_item_ids = payload.get("item_ids", payload.get("itemIds", []))
    item_ids: list[int] = []
    if item_ids_explicit and not isinstance(raw_item_ids, list):
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_bulk_item_ids"})
        return
    if isinstance(raw_item_ids, list):
        try:
            parsed_item_ids = [int(raw_id) for raw_id in raw_item_ids]
        except (TypeError, ValueError):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_bulk_item_ids"})
            return
        if any(item_id <= 0 for item_id in parsed_item_ids):
            handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_bulk_item_ids"})
            return
        for item_id in parsed_item_ids:
            if item_id > 0 and item_id not in item_ids:
                item_ids.append(item_id)
    if item_ids_explicit and not item_ids:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "section_items_required"})
        return
    if not section_raw and not section_title_raw:
        handler.send_json(HTTPStatus.BAD_REQUEST, {"error": "section_required"})
        return
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
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
        preserved_stage_state = {}
        if item_kind == "work" and item_ids_explicit:
            preserved_stage_state = {
                int(stage["id"]): (int(stage["progress"] or 0), str(stage["status_code"] or ""), stage["updated_at"])
                for stage in con.execute(
                    "SELECT id, progress, status_code, updated_at FROM work_stages WHERE project_id = ?",
                    (project_id,),
                ).fetchall()
            }

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

        def row_matches_section(row: sqlite3.Row) -> bool:
            row_stage_id = int(row["stage_id"] or 0) if row["stage_id"] else None
            row_section_id = normalize_progress_section_id(estimate_row_section_title(con, row))
            direct_section_id = normalize_progress_section_id(row["section_title"] or "")
            row_root_stage_id = root_stage_id(row_stage_id)
            return bool(
                (section_id and (row_section_id == section_id or direct_section_id == section_id))
                or (path_section_int and row_stage_id == path_section_int)
                or (row_root_stage_id and row_root_stage_id in matched_stage_ids)
            )

        def row_matches_kind(row: sqlite3.Row) -> bool:
            return normalize_estimate_item_kind(resolved_estimate_item_kind(row)) == item_kind

        row_by_id = {int(row["id"]): row for row in rows}
        if item_ids_explicit:
            invalid_item_ids = [
                item_id
                for item_id in item_ids
                if item_id not in row_by_id
                or not row_matches_kind(row_by_id[item_id])
                or not row_matches_section(row_by_id[item_id])
            ]
            if invalid_item_ids:
                con.rollback()
                handler.send_json(
                    HTTPStatus.CONFLICT,
                    {
                        "error": "bulk_section_items_mismatch",
                        "itemKind": item_kind,
                        "invalidItemIds": invalid_item_ids,
                    },
                )
                return
            target_rows = [row_by_id[item_id] for item_id in item_ids]
        else:
            target_rows = [row for row in rows if row_matches_kind(row) and row_matches_section(row)]

        selected_target_ids = [int(row["id"]) for row in target_rows]
        purchased_status = "\u0417\u0430\u043a\u0443\u043f\u043b\u0435\u043d\u043e"

        def row_needs_update(row: sqlite3.Row) -> bool:
            expected_actual = float(row["planned_qty"] or 0) if completed else 0.0
            if int(row["is_completed"] or 0) != completed:
                return True
            if abs(float(row["actual_qty"] or 0) - expected_actual) > 0.000001:
                return True
            return bool(
                item_kind == "material"
                and completed
                and str(row["procurement_status"] or "") != purchased_status
            )

        target_ids = [int(row["id"]) for row in target_rows if row_needs_update(row)]
        timestamp = now_ts()
        if item_kind == "work":
            for item_id in target_ids:
                con.execute(
                    """
                    UPDATE estimate_items
                    SET is_completed = ?,
                        actual_qty = CASE WHEN ? = 1 THEN planned_qty ELSE 0 END,
                        updated_at = ?
                    WHERE id = ? AND project_id = ?
                    """,
                    (completed, completed, timestamp, item_id, project_id),
                )
        material_update_ids = target_ids if item_kind == "material" else []
        for item_id in sorted(set(material_update_ids)):
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
        update_hidden_section_state = not (item_kind == "work" and item_ids_explicit)
        stage_update_ids = matched_stage_ids if update_hidden_section_state else set()
        for stage_id in stage_update_ids:
            con.execute(
                "UPDATE work_stages SET progress = ?, status_code = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                (100 if completed else 0, "completed" if completed else "not_started", now_ts(), stage_id, project_id),
            )

        task_cols = table_columns(con, "tasks") if update_hidden_section_state else set()
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
        if item_kind == "work" and item_ids_explicit:
            for stage_id, (stage_progress, stage_status, stage_updated_at) in preserved_stage_state.items():
                con.execute(
                    """
                    UPDATE work_stages
                    SET progress = ?, status_code = ?, updated_at = ?
                    WHERE id = ? AND project_id = ?
                    """,
                    (stage_progress, stage_status, stage_updated_at, stage_id, project_id),
                )
        project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        items = material_summary_rows(con, project_id)
        record_payload = {
            "entry_kind": "section_progress",
            "section_id": section_id,
            "path_section_id": path_section_int,
            "item_kind": item_kind,
            "completed": bool(completed),
            "items": len(target_ids),
            "target_item_ids": selected_target_ids,
            "changed_item_ids": target_ids,
        }
        if item_kind == "work" and item_ids_explicit and not target_ids:
            con.commit()
            handler.send_json(
                HTTPStatus.OK,
                {
                    "success": True,
                    "section_id": section_id,
                    "itemKind": item_kind,
                    "targetItemIds": selected_target_ids,
                    "changedItemIds": [],
                    "changedCount": 0,
                    "project_progress": progress.get("totalProjectPercent", progress.get("projectProgress", 0)),
                    "items": items,
                    "progress": progress,
                    "project": serialize_project(project_row, user),
                },
            )
            return
        create_audit(con, user["id"], "bulk_complete_section", "project", project_id, record_payload)
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
        if item_kind == "work":
            log_title = "Групповое завершение работ" if completed else "Работы раздела возвращены в работу"
            log_action = "выполнены все работы" if completed else "возвращены в работу"
        else:
            log_title = "Групповое закрытие раздела" if completed else "Раздел снят с выполнения"
            log_action = "закуплены все материалы" if completed else "сняты с выполнения все материалы"
        con.execute(
            """
            UPDATE daily_logs
            SET title = ?, work_done = ?, raw_input = ?
            WHERE id = last_insert_rowid()
            """,
            (
                log_title,
                f"Раздел «{section_title}»: {log_action} ({len(target_ids)} поз.).",
                json.dumps(record_payload, ensure_ascii=False),
            ),
        )
        con.commit()
    handler.send_json(
        HTTPStatus.OK,
        {
            "success": True,
            "section_id": section_id,
            "itemKind": item_kind,
            "targetItemIds": selected_target_ids,
            "changedItemIds": target_ids,
            "changedCount": len(target_ids),
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
