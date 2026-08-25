from __future__ import annotations

import cgi
import hashlib
import html
import json
import math
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
import traceback
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from auth import (
    DEFAULT_AUTH_PATH,
    LOGIN_PATH,
    PUBLIC_STATIC_PATHS,
    ROLE_CODES,
    ROLE_DESCRIPTIONS,
    ROLE_LABELS,
    default_permissions_for_role,
    display_user_name,
    api_avatar_file as auth_api_avatar_file,
    auth_config as auth_core_config,
    api_change_password as auth_api_change_password,
    api_login as auth_api_login,
    api_logout as auth_api_logout,
    api_me as auth_api_me,
    api_request_password_reset as auth_api_request_password_reset,
    api_update_profile as auth_api_update_profile,
    clerk_api_request,
    clerk_enabled,
    clerk_sign_in_script as auth_clerk_sign_in_script,
    current_user as auth_current_user,
    current_user_from_clerk as auth_current_user_from_clerk,
    hash_password,
    normalize_role,
    normalize_permissions,
    payload_has_procurement_prices,
    redact_procurement_prices,
    require_role as auth_require_role,
    require_user as auth_require_user,
    split_person_name,
    split_user_name,
    user_can_open,
    user_can_manage_roles,
    user_can_manage_schedule,
    user_can_manage_users,
    user_can_submit_procurement_price,
    user_can_view_project_economics,
    user_can_view_procurement_prices,
    user_has_any_role,
    user_is_hidden_admin,
    user_is_main_admin,
    user_is_main_admin_account,
    user_permissions,
    user_payload,
)
from projects import (
    api_claim_project_foreman as projects_api_claim_project_foreman,
    api_create_project as projects_api_create_project,
    api_create_project_assignment as projects_api_create_project_assignment,
    api_delete_project as projects_api_delete_project,
    api_project_assignments as projects_api_project_assignments,
    api_project_detail as projects_api_project_detail,
    api_projects as projects_api_projects,
    api_update_project as projects_api_update_project,
    can_access_project as projects_can_access_project,
    normalize_project_description,
    project_has_immutable_financial_history,
    project_has_protected_operational_history,
    project_schedule_payload,
    require_project_access as projects_require_project_access,
    serialize_project,
    set_project_foremen as projects_set_project_foremen,
)
from project_estimates import (
    ensure_project_estimates_schema,
    estimate_source_descriptor,
    list_project_estimates,
    serialize_project_estimate,
    source_item_key,
    upsert_project_estimate,
)
from estimate_reconciliation import (
    build_reconciliation,
    capture_live_snapshot,
    capture_snapshot,
    ensure_estimate_reconciliation_schema,
    save_review as save_estimate_reconciliation_review,
)
from procurement_limits import approved_procurement_limit_map, evaluate_procurement_limit
from warehouse import (
    api_clear_supplier_selection as warehouse_api_clear_supplier_selection,
    api_companies as warehouse_api_companies,
    api_create_company as warehouse_api_create_company,
    api_create_market_counterparty as warehouse_api_create_market_counterparty,
    api_create_supplier_offer as warehouse_api_create_supplier_offer,
    api_project_supplier_offers as warehouse_api_project_supplier_offers,
    api_project_warehouse_matches as warehouse_api_project_warehouse_matches,
    api_update_supplier_offer as warehouse_api_update_supplier_offer,
    api_warehouse_issue as warehouse_api_warehouse_issue,
    api_warehouse_items as warehouse_api_warehouse_items,
    api_warehouse_list as warehouse_api_warehouse_list,
    api_warehouse_receipt as warehouse_api_warehouse_receipt,
    api_warehouse_transfer as warehouse_api_warehouse_transfer,
)
from warehouse_control import (
    build_warehouse_control,
    create_work_fact,
    ensure_warehouse_control_schema,
    reverse_work_fact,
    upsert_work_material_norm,
)

from finance import (
    api_create_finance_entry as finance_api_create_finance_entry,
    api_delete_finance_entry as finance_api_delete_finance_entry,
    api_pay_invoice as finance_api_pay_invoice,
    api_project_finances as finance_api_project_finances,
    api_update_finance_entry as finance_api_update_finance_entry,
    api_upload_finance_invoice as finance_api_upload_finance_invoice,
    recalc_project_finance_totals as finance_recalc_project_finance_totals,
)

from economics import (
    api_approve_financial_baseline as economics_api_approve_financial_baseline,
    api_approve_actual_cost as economics_api_approve_actual_cost,
    api_approve_commitment as economics_api_approve_commitment,
    api_approve_payment_allocation as economics_api_approve_payment_allocation,
    api_approve_project_forecast as economics_api_approve_project_forecast,
    api_calculate_project_forecast as economics_api_calculate_project_forecast,
    api_cancel_commitment as economics_api_cancel_commitment,
    api_create_actual_cost as economics_api_create_actual_cost,
    api_create_actual_cost_from_stock_move as economics_api_create_actual_cost_from_stock_move,
    api_create_actual_cost_from_warehouse_transfer as economics_api_create_actual_cost_from_warehouse_transfer,
    api_create_commitment as economics_api_create_commitment,
    api_create_commitment_from_offer as economics_api_create_commitment_from_offer,
    api_create_financial_baseline as economics_api_create_financial_baseline,
    api_create_payment_allocation as economics_api_create_payment_allocation,
    api_project_cash_flow as economics_api_project_cash_flow,
    api_project_economics as economics_api_project_economics,
    api_project_actual_costs as economics_api_project_actual_costs,
    api_project_commitments as economics_api_project_commitments,
    api_project_financial_baselines as economics_api_project_financial_baselines,
    api_reverse_actual_cost as economics_api_reverse_actual_cost,
    api_reverse_payment_allocation as economics_api_reverse_payment_allocation,
    api_return_financial_baseline as economics_api_return_financial_baseline,
    api_submit_actual_cost as economics_api_submit_actual_cost,
    api_submit_commitment as economics_api_submit_commitment,
    api_submit_financial_baseline as economics_api_submit_financial_baseline,
    api_submit_payment_allocation as economics_api_submit_payment_allocation,
    api_submit_project_forecast as economics_api_submit_project_forecast,
    api_update_actual_cost as economics_api_update_actual_cost,
    api_update_commitment as economics_api_update_commitment,
    api_update_financial_baseline as economics_api_update_financial_baseline,
    api_update_financial_baseline_successors as economics_api_update_financial_baseline_successors,
    api_update_payment_allocation as economics_api_update_payment_allocation,
    forecast_source_state_hash as economics_forecast_source_state_hash,
)

from economics_workflow import (
    api_project_forecast_price_sources as economics_workflow_api_project_forecast_price_sources,
    api_project_forecasts as economics_workflow_api_project_forecasts,
    api_replace_commitment_lines as economics_workflow_api_replace_commitment_lines,
    api_return_actual_cost as economics_workflow_api_return_actual_cost,
    api_return_commitment as economics_workflow_api_return_commitment,
    api_return_payment_allocation as economics_workflow_api_return_payment_allocation,
    api_return_project_forecast as economics_workflow_api_return_project_forecast,
)

from legacy_economics import (
    api_confirm_project_legacy_economics_review as legacy_api_confirm_project_legacy_economics_review,
    api_ignore_project_legacy_economics_review as legacy_api_ignore_project_legacy_economics_review,
    api_project_legacy_economics_migration as legacy_api_project_legacy_economics_migration,
    api_scan_project_legacy_economics as legacy_api_scan_project_legacy_economics,
    api_update_project_legacy_economics_review as legacy_api_update_project_legacy_economics_review,
    ensure_legacy_economics_schema,
)

from schedule_tasks import (
    api_create_project_stage as schedule_api_create_project_stage,
    api_create_task as schedule_api_create_task,
    api_material_schedule as schedule_api_material_schedule,
    api_project_section_bulk_complete as schedule_api_project_section_bulk_complete,
    api_update_estimate_item_completion as schedule_api_update_estimate_item_completion,
    api_project_auto_schedule as schedule_api_project_auto_schedule,
    api_production_schedule as schedule_api_production_schedule,
    api_project_schedule_status as schedule_api_project_schedule_status,
    api_project_section_schedule_forecast as schedule_api_project_section_schedule_forecast,
    api_project_stages as schedule_api_project_stages,
    api_project_tasks as schedule_api_project_tasks,
    api_save_material_schedule as schedule_api_save_material_schedule,
    api_update_production_schedule as schedule_api_update_production_schedule,
    api_update_project_schedule_status as schedule_api_update_project_schedule_status,
    api_update_section_schedule_override as schedule_api_update_section_schedule_override,
    api_update_stage as schedule_api_update_stage,
    api_update_task as schedule_api_update_task,
    build_material_schedule_payload,
    build_procurement_alerts,
    build_section_schedule_forecast,
    material_summary_rows,
    mark_project_schedule_draft,
    parse_iso_date,
    recalc_project_progress,
)

from communications_docs import (
    api_chat_messages as comm_api_chat_messages,
    api_create_chat_message as comm_api_create_chat_message,
    api_create_daily_log as comm_api_create_daily_log,
    api_create_project_executive_doc as comm_api_create_project_executive_doc,
    api_delete_daily_log as comm_api_delete_daily_log,
    api_document_file as comm_api_document_file,
    api_project_chats as comm_api_project_chats,
    api_project_daily_logs as comm_api_project_daily_logs,
    api_project_documents as comm_api_project_documents,
    api_project_executive_docs as comm_api_project_executive_docs,
    api_project_notifications as comm_api_project_notifications,
    api_upload_project_document as comm_api_upload_project_document,
    can_access_chat as comm_can_access_chat,
    ensure_daily_log_actions_schema,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEPLOY_ROOT = PROJECT_ROOT / "deploy"
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
FRONTEND_TEMPLATES = FRONTEND_ROOT / "templates"
FRONTEND_PAGES = FRONTEND_ROOT / "pages"
FRONTEND_ASSETS = FRONTEND_ROOT / "assets"
DATA_DIR = PROJECT_ROOT / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
DB_PATH = DATA_DIR / "pmbi.sqlite3"
BOOTSTRAP_PATH = DATA_DIR / "INITIAL_ADMIN.txt"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

HOST = os.environ.get("PMBI_HOST", "127.0.0.1")
PORT = int(os.environ.get("PMBI_PORT", os.environ.get("PORT", "8080")))
PMBI_PUBLIC_BASE_URL = (os.environ.get("PMBI_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
PMBI_AUTOBOT_BASE_URL = (os.environ.get("PMBI_AUTOBOT_BASE_URL", "http://127.0.0.1:8765") or "").strip().rstrip("/")
PMBI_AUTOBOT_INTERNAL_URL = (
    os.environ.get("PMBI_AUTOBOT_INTERNAL_URL", "http://autobot:8765") or ""
).strip().rstrip("/")
AGENT_MARKET_STATUS_PATH = "/api/agent-market/v1/status"
AGENT_MARKET_CLAIM_PATH = "/api/agent-market/v1/claim"
AGENT_MARKET_JOB_PATH_RE = re.compile(
    r"/api/agent-market/v1/jobs/[0-9a-f]{32}/(?:heartbeat|complete|fail)"
)
MARKET_ANALYSIS_CACHE_TTL = max(30, int(os.environ.get("PMBI_MARKET_ANALYSIS_TTL", "900")))
MARKET_ANALYSIS_ERROR_TTL = max(10, int(os.environ.get("PMBI_MARKET_ANALYSIS_ERROR_TTL", "60")))
MARKET_ANALYSIS_EXECUTOR = ThreadPoolExecutor(
    max_workers=max(1, int(os.environ.get("PMBI_MARKET_ANALYSIS_WORKERS", "2"))),
    thread_name_prefix="market-analysis",
)
from sqlite_config import connect_database
MARKET_ANALYSIS_JOBS: set[tuple[int, str]] = set()
MARKET_ANALYSIS_JOBS_LOCK = threading.Lock()


class AutoBotUnavailableError(RuntimeError):
    """AutoBot could not be reached while building market analysis."""


def is_agent_market_proxy_route(method: str, path: str) -> bool:
    if method == "GET":
        return path == AGENT_MARKET_STATUS_PATH
    if method != "POST":
        return False
    return path == AGENT_MARKET_CLAIM_PATH or bool(AGENT_MARKET_JOB_PATH_RE.fullmatch(path))


APP_PAGES = {
    "/app": ("dashboard", "Панель"),
    "/app/dashboard": ("dashboard", "Панель"),
    "/app/daily-tasks": ("daily_tasks", "Задачи сотрудников"),
    "/app/projects": ("projects", "Объекты"),
    "/app/companies": ("companies", "Компании"),
    "/app/warehouse": ("warehouse", "Склад"),
    "/app/schedule": ("schedule", "График работ"),
    "/app/logs": ("logs", "Журнал работ"),
    "/app/users": ("users", "Наша Команда"),
}

APP_PAGES["/app/suppliers"] = ("suppliers", "Контрагенты")

APP_PAGES["/app/autobot"] = ("autobot", "AutoBot")

DIRECTOR_ACTION_BLOCK_RE = re.compile(
    r"<(?P<tag>section|button)\b(?=[^>]*\sdata-director-action\b)[\s\S]*?</(?P=tag)>",
    re.IGNORECASE,
)

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




def now_ts() -> int:
    return int(time.time())


APP_TIMEZONE = timezone(timedelta(hours=int(os.environ.get("PMBI_TZ_OFFSET_HOURS", "5"))))
TODAY_ISO = datetime.now(APP_TIMEZONE).date().isoformat()


def estimate_code_text_kind(value: object) -> str | None:
    text = str(value or "")
    if not text:
        return None
    if re.search(r"(?<![\w\u0400-\u04ff])(?:\u0424\u0421\u0411\u0426|FSBC)\s*[-\d]", text, flags=re.I):
        return "material"
    if re.search(r"(?<![\w\u0400-\u04ff])(?:\u0413\u042D\u0421\u041D|GESN)\s*[A-Z\u0410-\u042F]?\s*\d", text, flags=re.I):
        return "work"
    return None


def normalize_estimate_item_kind(value: object) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return "material"
    code_kind = estimate_code_text_kind(text)
    if code_kind:
        return code_kind
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


def estimate_unit_multiplier(unit: object) -> float:
    match = re.match(r"^\s*(\d+(?:[\.,]\d+)?)\s+\S+", str(unit or "").strip())
    if not match:
        return 1.0
    try:
        multiplier = float(match.group(1).replace(",", "."))
    except ValueError:
        return 1.0
    return multiplier if multiplier > 1 else 1.0


def parse_estimate_number(value: object) -> float:
    """Parse estimate numbers without silently losing Russian-formatted values."""
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        return number if math.isfinite(number) else 0.0

    text = str(value).strip().replace("\xa0", "").replace("\u202f", "").replace(" ", "")
    text = re.sub(r"[^0-9,.+\-]", "", text)
    text = text.rstrip(".,")
    if not text or text in {"+", "-", ".", ","}:
        return 0.0
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    if text.count(".") > 1:
        parts = text.split(".")
        text = "".join(parts[:-1]) + "." + parts[-1]
    try:
        number = float(text)
    except ValueError:
        return 0.0
    return number if math.isfinite(number) else 0.0


def normalize_estimate_planned_qty(unit: object, qty: object) -> float:
    value = parse_estimate_number(qty)
    multiplier = estimate_unit_multiplier(unit)
    if multiplier >= 100 and value >= multiplier:
        return value / multiplier
    return value


def normalize_estimate_planned_values(unit: object, qty: object, price: object) -> tuple[float, float]:
    raw_qty = parse_estimate_number(qty)
    raw_price = parse_estimate_number(price)
    planned_qty = normalize_estimate_planned_qty(unit, raw_qty)
    if raw_qty > 0 and planned_qty > 0 and planned_qty != raw_qty:
        raw_price *= raw_qty / planned_qty
    return planned_qty, raw_price


def first_positive_estimate_item_number(item: dict, *keys: str) -> float:
    fallback = 0.0
    for key in keys:
        if key in item and item.get(key) not in (None, ""):
            number = parse_estimate_number(item.get(key))
            if number > 0:
                return number
            fallback = number
    return fallback


def estimate_item_value_issue(item: dict, position: int | None = None) -> dict | None:
    """Return an order-of-magnitude parser mismatch that needs human review."""

    raw_qty = first_positive_estimate_item_number(
        item, "planned_qty", "plannedQty", "qty", "quantity", "volume"
    )
    raw_price = first_positive_estimate_item_number(
        item,
        "planned_price",
        "plannedPrice",
        "unit_price",
        "unitPrice",
        "unit_price_rub",
        "price_per_unit",
        "pricePerUnit",
        "current_unit_price",
        "currentUnitPrice",
        "price",
    )
    raw_total = first_positive_estimate_item_number(
        item,
        "planned_total",
        "plannedTotal",
        "total",
        "total_price",
        "totalPrice",
        "estimate_total",
        "estimateTotal",
        "price_from_estimate_rub",
        "amount",
    )
    if raw_qty <= 0 or raw_price <= 0 or raw_total <= 0:
        return None
    calculated_total = raw_qty * raw_price
    factor = calculated_total / raw_total
    if 0.1 < factor < 10:
        return None
    return {
        "position": position,
        "title": str(item.get("title", "")).strip(),
        "quantity": raw_qty,
        "unitPrice": raw_price,
        "positionTotal": raw_total,
        "calculatedTotal": calculated_total,
        "factor": factor,
    }


def estimate_import_value_issues(items: list) -> list[dict]:
    issues = []
    for position, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            continue
        issue = estimate_item_value_issue(item, position)
        if issue:
            issues.append(issue)
        if len(issues) >= 20:
            break
    return issues


def normalize_estimate_item_values(item: dict, unit: object) -> tuple[float, float]:
    """Resolve common parser aliases and recover a missing unit price from total."""
    raw_qty = first_positive_estimate_item_number(
        item, "planned_qty", "plannedQty", "qty", "quantity", "volume"
    )
    raw_price = first_positive_estimate_item_number(
        item,
        "planned_price",
        "plannedPrice",
        "unit_price",
        "unitPrice",
        "unit_price_rub",
        "price_per_unit",
        "pricePerUnit",
        "current_unit_price",
        "currentUnitPrice",
        "price",
    )
    raw_total = first_positive_estimate_item_number(
        item,
        "planned_total",
        "plannedTotal",
        "total",
        "total_price",
        "totalPrice",
        "estimate_total",
        "estimateTotal",
        "price_from_estimate_rub",
        "amount",
    )
    if raw_price <= 0 and raw_total > 0 and raw_qty > 0:
        raw_price = raw_total / raw_qty
    return normalize_estimate_planned_values(unit, raw_qty, raw_price)


FUZZY_MATCH_THRESHOLD = 0.70


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


def parse_path_int(path: str, index: int) -> int | None:
    parts = path.strip("/").split("/")
    try:
        return int(parts[index])
    except (IndexError, TypeError, ValueError):
        return None


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return connect_database(DB_PATH)


def ensure_columns(con: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    existing = {row["name"] for row in con.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, definition in columns.items():
        if name not in existing:
            con.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


def migrate_supplier_offer_tracking(con: sqlite3.Connection) -> None:
    """Bring legacy supplier offers into the single-active audited workflow."""
    ensure_columns(
        con,
        "supplier_offers",
        {
            "activated_by": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
            "activated_at": "INTEGER",
        },
    )

    # Older data could contain a selected supplier and a selected contractor for
    # the same estimate item. Preserve the newest choice before the unique index
    # is created.
    con.execute(
        """
        UPDATE supplier_offers
        SET status = 'quoted'
        WHERE status = 'selected'
          AND estimate_item_id IS NOT NULL
          AND id NOT IN (
              SELECT MAX(id)
              FROM supplier_offers
              WHERE status = 'selected' AND estimate_item_id IS NOT NULL
              GROUP BY estimate_item_id
          )
        """
    )
    con.execute(
        """
        UPDATE supplier_offers
        SET activated_by = COALESCE(activated_by, created_by),
            activated_at = COALESCE(activated_at, updated_at, created_at)
        WHERE status = 'selected'
        """
    )
    con.execute(
        """
        INSERT INTO supplier_offer_events (
            supplier_offer_id, project_id, estimate_item_id, action, actor_id, details, created_at
        )
        SELECT so.id, so.project_id, so.estimate_item_id, 'created', so.created_by, '{}', so.created_at
        FROM supplier_offers so
        WHERE NOT EXISTS (
            SELECT 1 FROM supplier_offer_events event
            WHERE event.supplier_offer_id = so.id AND event.action = 'created'
        )
        """
    )
    con.execute(
        """
        INSERT INTO supplier_offer_events (
            supplier_offer_id, project_id, estimate_item_id, action, actor_id, details, created_at
        )
        SELECT so.id, so.project_id, so.estimate_item_id, 'activated', so.activated_by, '{}', so.activated_at
        FROM supplier_offers so
        WHERE so.status = 'selected'
          AND so.activated_at IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM supplier_offer_events event
              WHERE event.supplier_offer_id = so.id AND event.action = 'activated'
          )
        """
    )


def ensure_sqlite_indexes(con: sqlite3.Connection) -> None:
    """Create indexes used by the frequent project-scoped API queries."""
    con.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_user_project_access_project_user
            ON user_project_access(project_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_object_assignments_user_role
            ON object_assignments(user_id, role_code, object_id);
        CREATE INDEX IF NOT EXISTS idx_estimate_items_project_stage
            ON estimate_items(project_id, stage_id, id);
        CREATE INDEX IF NOT EXISTS idx_stock_moves_project_item
            ON stock_moves(project_id, estimate_item_id, id);
        CREATE INDEX IF NOT EXISTS idx_work_stages_project_position
            ON work_stages(project_id, position, id);
        CREATE INDEX IF NOT EXISTS idx_tasks_project_status_due
            ON tasks(project_id, status, due_at, id);
        CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_status_date
            ON daily_tasks(user_id, status, task_date, id);
        CREATE INDEX IF NOT EXISTS idx_daily_tasks_status_updated
            ON daily_tasks(status, updated_at, id);
        CREATE INDEX IF NOT EXISTS idx_daily_logs_project_date
            ON daily_logs(project_id, report_date, id);
        CREATE INDEX IF NOT EXISTS idx_documents_project_id
            ON documents(project_id, id);
        CREATE INDEX IF NOT EXISTS idx_finance_entries_project_status_date
            ON finance_entries(project_id, status, paid_date, planned_date, id);
        CREATE INDEX IF NOT EXISTS idx_project_financial_baselines_project_status_version
            ON project_financial_baselines(project_id, status, version_no);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_financial_baselines_one_approved
            ON project_financial_baselines(project_id)
            WHERE status = 'approved';
        CREATE INDEX IF NOT EXISTS idx_project_revenue_lines_baseline_position
            ON project_revenue_lines(baseline_id, position, id);
        CREATE INDEX IF NOT EXISTS idx_project_revenue_lines_estimate_item
            ON project_revenue_lines(estimate_item_id, baseline_id);
        CREATE INDEX IF NOT EXISTS idx_project_budget_lines_baseline_position
            ON project_budget_lines(baseline_id, position, id);
        CREATE INDEX IF NOT EXISTS idx_project_budget_lines_estimate_item
            ON project_budget_lines(estimate_item_id, baseline_id);
        CREATE INDEX IF NOT EXISTS idx_project_budget_line_successors_target
            ON project_budget_line_successors(to_baseline_id, target_budget_line_id);
        CREATE INDEX IF NOT EXISTS idx_project_revenue_line_successors_target
            ON project_revenue_line_successors(to_baseline_id, target_revenue_line_id);
        CREATE INDEX IF NOT EXISTS idx_project_commitments_project_status
            ON project_commitments(project_id, status, id);
        CREATE INDEX IF NOT EXISTS idx_project_commitments_baseline_status
            ON project_commitments(baseline_id, status, id);
        DROP INDEX IF EXISTS idx_project_commitments_one_open_per_offer;
        CREATE INDEX idx_project_commitments_one_open_per_offer
            ON project_commitments(source_supplier_offer_id)
            WHERE source_supplier_offer_id IS NOT NULL AND status <> 'cancelled';
        CREATE INDEX IF NOT EXISTS idx_project_commitment_lines_commitment_position
            ON project_commitment_lines(commitment_id, position, id);
        CREATE INDEX IF NOT EXISTS idx_project_commitment_lines_budget
            ON project_commitment_lines(budget_line_id, commitment_id);
        CREATE INDEX IF NOT EXISTS idx_project_commitment_lines_estimate_item
            ON project_commitment_lines(estimate_item_id, commitment_id);
        CREATE INDEX IF NOT EXISTS idx_project_commitment_events_commitment_time
            ON project_commitment_events(commitment_id, created_at, id);
        CREATE INDEX IF NOT EXISTS idx_project_actual_cost_entries_project_status_date
            ON project_actual_cost_entries(project_id, status, recognition_date, id);
        CREATE INDEX IF NOT EXISTS idx_project_actual_cost_entries_budget
            ON project_actual_cost_entries(budget_line_id, status, id);
        CREATE INDEX IF NOT EXISTS idx_project_actual_cost_entries_commitment_line
            ON project_actual_cost_entries(commitment_line_id, status, id);
        CREATE INDEX IF NOT EXISTS idx_project_actual_cost_events_entry_time
            ON project_actual_cost_events(actual_cost_entry_id, created_at, id);
        CREATE INDEX IF NOT EXISTS idx_project_payment_allocations_project_status
            ON project_payment_allocations(project_id, status, id);
        CREATE INDEX IF NOT EXISTS idx_project_payment_allocations_finance_status
            ON project_payment_allocations(finance_entry_id, status, id);
        CREATE INDEX IF NOT EXISTS idx_project_payment_allocations_commitment
            ON project_payment_allocations(target_commitment_id, status, id);
        CREATE INDEX IF NOT EXISTS idx_project_payment_allocations_actual_cost
            ON project_payment_allocations(target_actual_cost_entry_id, status, id);
        CREATE INDEX IF NOT EXISTS idx_project_payment_allocation_events_time
            ON project_payment_allocation_events(payment_allocation_id, created_at, id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_payment_allocations_one_reversal
            ON project_payment_allocations(reverses_allocation_id)
            WHERE reverses_allocation_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_project_forecasts_project_status_version
            ON project_forecasts(project_id, status, version_no);
        CREATE INDEX IF NOT EXISTS idx_project_forecasts_baseline_status
            ON project_forecasts(baseline_id, status, version_no);
        CREATE INDEX IF NOT EXISTS idx_project_forecast_components_forecast_position
            ON project_forecast_components(forecast_id, position, id);
        CREATE INDEX IF NOT EXISTS idx_project_forecast_components_budget
            ON project_forecast_components(budget_line_id, forecast_id);
        CREATE INDEX IF NOT EXISTS idx_project_forecast_events_time
            ON project_forecast_events(forecast_id, created_at, id);
        CREATE INDEX IF NOT EXISTS idx_supplier_offers_project_status
            ON supplier_offers(project_id, status, updated_at, id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_offers_one_active_per_item
            ON supplier_offers(estimate_item_id)
            WHERE status = 'selected' AND estimate_item_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_supplier_offer_events_offer_time
            ON supplier_offer_events(supplier_offer_id, created_at, id);
        CREATE INDEX IF NOT EXISTS idx_market_price_snapshots_project_item_time
            ON market_price_snapshots(project_id, estimate_item_id, analyzed_at, id);
        CREATE INDEX IF NOT EXISTS idx_chats_project_type
            ON chats(project_id, chat_type, id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id
            ON chat_messages(chat_id, id);
        CREATE INDEX IF NOT EXISTS idx_projects_status_id
            ON projects(status, id);
        """
    )


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


def user_unique_conflict(con: sqlite3.Connection, email: str | None, phone: str | None, exclude_user_id: int | None = None) -> dict | None:
    exclude_sql = " AND id <> ?" if exclude_user_id else ""
    exclude_args = (exclude_user_id,) if exclude_user_id else ()
    active_sql = " AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_active, 1) = 1"
    if email:
        row = con.execute(
            "SELECT id FROM users WHERE lower(email) = ?" + active_sql + exclude_sql,
            (email.lower(),) + exclude_args,
        ).fetchone()
        if row:
            return {"error": "email_already_used", "message": "Этот Email уже зарегистрирован в системе"}
    if phone:
        row = con.execute(
            "SELECT id FROM users WHERE phone = ?" + active_sql + exclude_sql,
            (phone,) + exclude_args,
        ).fetchone()
        if row:
            return {"error": "phone_already_used", "message": "Этот номер телефона уже используется"}
    return None


def user_login_conflict(con: sqlite3.Connection, login: str, exclude_user_id: int | None = None) -> bool:
    if not login:
        return False
    exclude_sql = " AND id <> ?" if exclude_user_id else ""
    exclude_args = (exclude_user_id,) if exclude_user_id else ()
    row = con.execute(
        "SELECT id FROM users WHERE lower(login) = ? AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_active, 1) = 1" + exclude_sql,
        (login.lower(),) + exclude_args,
    ).fetchone()
    return bool(row)


def release_deleted_user_identity(con: sqlite3.Connection, login: str | None, email: str | None, phone: str | None) -> None:
    clauses = []
    args: list[str] = []
    if login:
        clauses.append("lower(login) = ?")
        args.append(login.lower())
    if email:
        clauses.append("lower(email) = ?")
        args.append(email.lower())
    if phone:
        clauses.append("phone = ?")
        args.append(phone)
    if not clauses:
        return
    rows = con.execute(
        "SELECT id FROM users WHERE (COALESCE(is_deleted, 0) = 1 OR COALESCE(is_active, 1) = 0 OR status = 'deleted') AND (" + " OR ".join(clauses) + ")",
        args,
    ).fetchall()
    for row in rows:
        deleted_login = f"deleted_user_{row['id']}_{now_ts()}"
        con.execute(
            "UPDATE users SET login = ?, email = NULL, phone = NULL, is_deleted = 1, is_active = 0, status = 'deleted', updated_at = ? WHERE id = ?",
            (deleted_login, now_ts(), row["id"]),
        )


def valid_user_email(email: str | None) -> bool:
    return bool(email and re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def valid_user_phone(phone: str | None) -> bool:
    return bool(phone and re.match(r"^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$", phone))


def migrate_users_table(con: sqlite3.Connection) -> None:
    create_sql_row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    ).fetchone()
    create_sql = create_sql_row["sql"] if create_sql_row else ""
    if "CHECK(role IN ('director','foreman','buyer','client'))" not in create_sql:
        return

    con.execute("ALTER TABLE users RENAME TO users_legacy")
    con.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT NOT NULL UNIQUE,
            email TEXT,
            phone TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER
        )
        """
    )
    con.execute(
        """
        INSERT INTO users (id, login, password_hash, role, name, status, is_active, created_at, updated_at)
        SELECT id, login, password_hash, role, name,
               CASE WHEN is_active = 1 THEN 'active' ELSE 'blocked' END,
               is_active, created_at, created_at
        FROM users_legacy
        """
    )
    # Keep the legacy table until foreign keys in already-created tables are
    # rebuilt to point back to users. SQLite rewrites FK targets on rename.


def table_exists(con: sqlite3.Connection, table: str) -> bool:
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone() is not None


def table_sql(con: sqlite3.Connection, table: str) -> str:
    row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row["sql"] if row and row["sql"] else ""


def rebuild_table(con: sqlite3.Connection, table: str, create_sql: str) -> None:
    old_table = f"{table}__old"
    con.execute(f"DROP TABLE IF EXISTS {old_table}")
    con.execute("PRAGMA legacy_alter_table = ON")
    con.execute(f"ALTER TABLE {table} RENAME TO {old_table}")
    con.execute(create_sql)
    old_columns = [row["name"] for row in con.execute(f"PRAGMA table_info({old_table})").fetchall()]
    new_columns = [row["name"] for row in con.execute(f"PRAGMA table_info({table})").fetchall()]
    common_columns = [column for column in new_columns if column in old_columns]
    if common_columns:
        column_sql = ", ".join(common_columns)
        con.execute(f"INSERT INTO {table} ({column_sql}) SELECT {column_sql} FROM {old_table}")
    con.execute(f"DROP TABLE {old_table}")
    con.execute("PRAGMA legacy_alter_table = OFF")


def repair_legacy_user_references(con: sqlite3.Connection) -> None:
    affected = [
        table
        for table in [
            "sessions",
            "projects",
            "user_project_access",
            "stock_moves",
            "tasks",
            "chat_messages",
            "daily_logs",
            "daily_log_actions",
            "audit_log",
            "object_assignments",
            "user_roles",
        ]
        if table_exists(con, table) and "users_legacy" in table_sql(con, table)
    ]
    if not affected:
        return

    con.execute("PRAGMA foreign_keys = OFF")
    con.execute("PRAGMA legacy_alter_table = ON")
    schemas = {
        "sessions": """
            CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                user_agent TEXT,
                ip TEXT
            )
        """,
        "projects": """
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
                customer_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                own_legal_entity_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                address TEXT NOT NULL,
                city TEXT,
                region TEXT,
                client_name TEXT NOT NULL,
                contract_no TEXT,
                contract_date TEXT,
                director_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                foreman_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                budget REAL NOT NULL DEFAULT 0,
                paid REAL NOT NULL DEFAULT 0,
                spent REAL NOT NULL DEFAULT 0,
                started_at TEXT,
                deadline_at TEXT,
                internal_schedule_status TEXT NOT NULL DEFAULT 'draft',
                internal_schedule_version INTEGER NOT NULL DEFAULT 1,
                internal_schedule_approved_at TEXT,
                customer_schedule_status TEXT NOT NULL DEFAULT 'draft',
                customer_schedule_version INTEGER NOT NULL DEFAULT 1,
                customer_schedule_approved_at TEXT,
                schedule_generated_at TEXT,
                description TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            )
        """,
        "user_project_access": """
            CREATE TABLE user_project_access (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, project_id)
            )
        """,
        "stock_moves": """
            CREATE TABLE stock_moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                move_type TEXT NOT NULL CHECK(move_type IN ('purchase','receipt','use','writeoff')),
                qty REAL NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                comment TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            )
        """,
        "tasks": """
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                priority TEXT NOT NULL DEFAULT 'normal',
                assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                due_at TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            )
        """,
        "chat_messages": """
            CREATE TABLE chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """,
        "daily_logs": """
            CREATE TABLE daily_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                report_date TEXT NOT NULL,
                title TEXT NOT NULL,
                work_done TEXT NOT NULL DEFAULT '',
                workers_count INTEGER NOT NULL DEFAULT 0,
                equipment TEXT NOT NULL DEFAULT '',
                blockers TEXT NOT NULL DEFAULT '',
                next_steps TEXT NOT NULL DEFAULT '',
                progress_percent REAL,
                raw_input TEXT,
                is_client_visible INTEGER NOT NULL DEFAULT 1,
                client_request_id TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            )
        """,
        "daily_log_actions": """
            CREATE TABLE daily_log_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE RESTRICT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL CHECK(action_type IN (
                    'material_purchase', 'material_receipt', 'material_use'
                )),
                estimate_item_id INTEGER NOT NULL REFERENCES estimate_items(id) ON DELETE RESTRICT,
                material_title_snapshot TEXT NOT NULL,
                material_unit_snapshot TEXT NOT NULL,
                qty REAL NOT NULL CHECK(qty > 0),
                client_action_id TEXT NOT NULL,
                stock_move_id INTEGER NOT NULL UNIQUE REFERENCES stock_moves(id) ON DELETE RESTRICT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(project_id, client_action_id)
            )
        """,
        "audit_log": """
            CREATE TABLE audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                entity TEXT,
                entity_id INTEGER,
                payload TEXT,
                created_at INTEGER NOT NULL
            )
        """,
        "object_assignments": """
            CREATE TABLE object_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_code TEXT NOT NULL,
                responsibility TEXT,
                is_primary INTEGER NOT NULL DEFAULT 0,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_at INTEGER NOT NULL,
                UNIQUE(object_id, user_id, role_code)
            )
        """,
        "user_roles": """
            CREATE TABLE user_roles (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, role_id)
            )
        """,
    }
    for table in affected:
        rebuild_table(con, table, schemas[table])
    if table_exists(con, "users_legacy"):
        con.execute("DROP TABLE users_legacy")
    con.execute("PRAGMA legacy_alter_table = OFF")
    con.execute("PRAGMA foreign_keys = ON")


def init_db() -> None:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT NOT NULL UNIQUE,
                email TEXT,
                phone TEXT,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT,
                permissions TEXT
            );

            CREATE TABLE IF NOT EXISTS user_roles (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, role_id)
            );

            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('own_legal_entity','client','supplier','contractor','other')),
                name TEXT NOT NULL,
                inn TEXT,
                kpp TEXT,
                ogrn TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                notes TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                user_agent TEXT,
                ip TEXT
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
                customer_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                own_legal_entity_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                address TEXT NOT NULL,
                city TEXT,
                region TEXT,
                client_name TEXT NOT NULL,
                contract_no TEXT,
                contract_date TEXT,
                director_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                foreman_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                budget REAL NOT NULL DEFAULT 0,
                paid REAL NOT NULL DEFAULT 0,
                spent REAL NOT NULL DEFAULT 0,
                started_at TEXT,
                deadline_at TEXT,
                internal_schedule_status TEXT NOT NULL DEFAULT 'draft',
                internal_schedule_version INTEGER NOT NULL DEFAULT 1,
                internal_schedule_approved_at TEXT,
                customer_schedule_status TEXT NOT NULL DEFAULT 'draft',
                customer_schedule_version INTEGER NOT NULL DEFAULT 1,
                customer_schedule_approved_at TEXT,
                schedule_generated_at TEXT,
                description TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS object_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_code TEXT NOT NULL,
                responsibility TEXT,
                is_primary INTEGER NOT NULL DEFAULT 0,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_at INTEGER NOT NULL,
                UNIQUE(object_id, user_id, role_code)
            );

            CREATE TABLE IF NOT EXISTS user_project_access (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, project_id)
            );

            CREATE TABLE IF NOT EXISTS estimate_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                unit TEXT NOT NULL,
                planned_qty REAL NOT NULL,
                planned_price REAL NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS stock_moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                move_type TEXT NOT NULL CHECK(move_type IN ('purchase','receipt','use','writeoff')),
                qty REAL NOT NULL,
                price REAL NOT NULL DEFAULT 0,
                comment TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS warehouse_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL DEFAULT 'material' CHECK(item_type IN ('material','tool')),
                category TEXT,
                name TEXT NOT NULL,
                sku TEXT,
                unit TEXT NOT NULL DEFAULT 'шт',
                qty REAL NOT NULL DEFAULT 0,
                condition_status TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS warehouse_transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                warehouse_item_id INTEGER NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                qty REAL NOT NULL,
                unit TEXT NOT NULL,
                comment TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS supplier_offers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                candidate_type TEXT NOT NULL DEFAULT 'supplier',
                candidate_name TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'manual',
                source_url TEXT,
                contact_name TEXT,
                phone TEXT,
                price REAL NOT NULL DEFAULT 0,
                qty REAL NOT NULL DEFAULT 0,
                unit TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                activated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                activated_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS supplier_offer_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_offer_id INTEGER REFERENCES supplier_offers(id) ON DELETE SET NULL,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                details TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS material_schedule_snapshots (
                project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
                payload TEXT NOT NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS work_schedule_overrides (
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER NOT NULL REFERENCES estimate_items(id) ON DELETE CASCADE,
                schedule_context TEXT NOT NULL CHECK(schedule_context IN ('graph', 'production')),
                duration_days REAL,
                crew_size INTEGER,
                updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (project_id, estimate_item_id, schedule_context)
            );

            CREATE TABLE IF NOT EXISTS production_schedule_cell_overrides (
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER NOT NULL REFERENCES estimate_items(id) ON DELETE CASCADE,
                day_number INTEGER NOT NULL CHECK(day_number > 0),
                is_filled INTEGER NOT NULL DEFAULT 0 CHECK(is_filled IN (0, 1)),
                updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (project_id, estimate_item_id, day_number)
            );

            CREATE TABLE IF NOT EXISTS production_schedule_slot_overrides (
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER NOT NULL REFERENCES estimate_items(id) ON DELETE CASCADE,
                slot_number INTEGER NOT NULL CHECK(slot_number > 0),
                is_filled INTEGER NOT NULL DEFAULT 0 CHECK(is_filled IN (0, 1)),
                updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (project_id, estimate_item_id, slot_number)
            );

            CREATE TABLE IF NOT EXISTS work_stages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                parent_id INTEGER,
                stage_kind TEXT NOT NULL DEFAULT 'section',
                status_code TEXT NOT NULL DEFAULT 'not_started',
                planned_start TEXT,
                planned_end TEXT,
                customer_start TEXT,
                customer_end TEXT,
                fact_start TEXT,
                fact_end TEXT,
                progress INTEGER NOT NULL DEFAULT 0,
                responsible TEXT,
                notes TEXT,
                is_client_visible INTEGER NOT NULL DEFAULT 1,
                depends_on_materials INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                priority TEXT NOT NULL DEFAULT 'normal',
                assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                due_at TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS daily_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','done','archived')),
                task_date TEXT NOT NULL,
                completed_at TEXT,
                archived_at TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS daily_standups (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                report_date TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, report_date)
            );

            CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                chat_type TEXT NOT NULL CHECK(chat_type IN ('team','client')),
                title TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                doc_type TEXT NOT NULL DEFAULT 'file',
                status TEXT NOT NULL DEFAULT 'draft',
                original_name TEXT,
                storage_name TEXT,
                storage_path TEXT,
                mime_type TEXT,
                file_ext TEXT,
                size_bytes INTEGER,
                notes TEXT,
                uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                is_client_visible INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS finance_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                direction TEXT NOT NULL CHECK(direction IN ('income','expense')),
                category TEXT,
                payment_kind TEXT NOT NULL DEFAULT 'cash' CHECK(payment_kind IN ('cash','bank_no_vat','bank_vat')),
                vat_percent REAL NOT NULL DEFAULT 0,
                amount REAL NOT NULL DEFAULT 0,
                planned_date TEXT,
                paid_date TEXT,
                counterparty_name TEXT,
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','approved','paid','cancelled')),
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS project_financial_baselines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                version_no INTEGER NOT NULL CHECK(version_no > 0),
                status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','approved','superseded')),
                currency_code TEXT NOT NULL DEFAULT 'RUB' CHECK(currency_code = 'RUB'),
                source_snapshot_hash TEXT NOT NULL CHECK(length(trim(source_snapshot_hash)) > 0),
                source_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                effective_from TEXT,
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                submitted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                submitted_at INTEGER,
                approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                approved_at INTEGER,
                superseded_by_baseline_id INTEGER REFERENCES project_financial_baselines(id) ON DELETE RESTRICT,
                superseded_at INTEGER,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
                UNIQUE(project_id, version_no),
                CHECK(superseded_by_baseline_id IS NULL OR superseded_by_baseline_id <> id),
                CHECK(submitted_at IS NULL OR submitted_at >= created_at),
                CHECK(approved_at IS NULL OR (submitted_at IS NOT NULL AND approved_at >= submitted_at)),
                CHECK(superseded_at IS NULL OR (approved_at IS NOT NULL AND superseded_at >= approved_at)),
                CHECK(
                    (status = 'draft'
                        AND submitted_by IS NULL AND submitted_at IS NULL
                        AND approved_by IS NULL AND approved_at IS NULL
                        AND superseded_by_baseline_id IS NULL AND superseded_at IS NULL)
                    OR
                    (status = 'pending_approval'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NULL AND approved_at IS NULL
                        AND superseded_by_baseline_id IS NULL AND superseded_at IS NULL)
                    OR
                    (status = 'approved'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NOT NULL AND approved_at IS NOT NULL
                        AND effective_from IS NOT NULL AND length(trim(effective_from)) > 0
                        AND superseded_by_baseline_id IS NULL AND superseded_at IS NULL)
                    OR
                    (status = 'superseded'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NOT NULL AND approved_at IS NOT NULL
                        AND effective_from IS NOT NULL AND length(trim(effective_from)) > 0
                        AND superseded_by_baseline_id IS NOT NULL AND superseded_at IS NOT NULL)
                )
            );

            CREATE TABLE IF NOT EXISTS project_revenue_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                baseline_id INTEGER NOT NULL REFERENCES project_financial_baselines(id) ON DELETE CASCADE,
                position INTEGER NOT NULL CHECK(position > 0),
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                title TEXT NOT NULL CHECK(length(trim(title)) > 0),
                section_title TEXT,
                unit TEXT,
                quantity REAL CHECK(quantity IS NULL OR quantity >= 0),
                unit_price_net_kopecks INTEGER CHECK(unit_price_net_kopecks IS NULL OR unit_price_net_kopecks >= 0),
                net_amount_kopecks INTEGER NOT NULL CHECK(net_amount_kopecks >= 0),
                vat_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(vat_rate_basis_points BETWEEN 0 AND 10000),
                vat_amount_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(vat_amount_kopecks >= 0),
                gross_amount_kopecks INTEGER NOT NULL CHECK(gross_amount_kopecks = net_amount_kopecks + vat_amount_kopecks),
                source_vat_mode TEXT NOT NULL CHECK(source_vat_mode IN ('net','gross','no_vat')),
                source_type TEXT NOT NULL CHECK(source_type IN ('estimate','contract','manual')),
                source_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                source_reference TEXT NOT NULL CHECK(length(trim(source_reference)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                UNIQUE(baseline_id, position),
                CHECK(source_vat_mode <> 'no_vat' OR (vat_rate_basis_points = 0 AND vat_amount_kopecks = 0)),
                CHECK(vat_rate_basis_points <> 0 OR vat_amount_kopecks = 0)
            );

            CREATE TABLE IF NOT EXISTS project_budget_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                baseline_id INTEGER NOT NULL REFERENCES project_financial_baselines(id) ON DELETE CASCADE,
                position INTEGER NOT NULL CHECK(position > 0),
                line_type TEXT NOT NULL CHECK(line_type IN ('direct_cost','management_reserve')),
                cost_code TEXT,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                title TEXT NOT NULL CHECK(length(trim(title)) > 0),
                section_title TEXT,
                unit TEXT,
                quantity REAL CHECK(quantity IS NULL OR quantity >= 0),
                unit_cost_net_kopecks INTEGER CHECK(unit_cost_net_kopecks IS NULL OR unit_cost_net_kopecks >= 0),
                net_amount_kopecks INTEGER NOT NULL CHECK(net_amount_kopecks >= 0),
                vat_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(vat_rate_basis_points BETWEEN 0 AND 10000),
                vat_amount_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(vat_amount_kopecks >= 0),
                gross_amount_kopecks INTEGER NOT NULL CHECK(gross_amount_kopecks = net_amount_kopecks + vat_amount_kopecks),
                source_vat_mode TEXT NOT NULL CHECK(source_vat_mode IN ('net','gross','no_vat')),
                source_type TEXT NOT NULL CHECK(source_type IN ('estimate','policy','manual')),
                source_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                source_reference TEXT NOT NULL CHECK(length(trim(source_reference)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                UNIQUE(baseline_id, position),
                CHECK(source_vat_mode <> 'no_vat' OR (vat_rate_basis_points = 0 AND vat_amount_kopecks = 0)),
                CHECK(vat_rate_basis_points <> 0 OR vat_amount_kopecks = 0),
                CHECK(line_type <> 'management_reserve' OR estimate_item_id IS NULL)
            );

            CREATE TABLE IF NOT EXISTS project_budget_line_successors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                from_baseline_id INTEGER NOT NULL,
                to_baseline_id INTEGER NOT NULL,
                source_budget_line_id INTEGER NOT NULL,
                target_budget_line_id INTEGER NOT NULL,
                mapping_kind TEXT NOT NULL
                    CHECK(mapping_kind IN ('carry_forward','merge','reclassified')),
                quantity_factor REAL NOT NULL DEFAULT 1
                    CHECK(quantity_factor > 0),
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                UNIQUE(to_baseline_id, source_budget_line_id),
                CHECK(from_baseline_id <> to_baseline_id),
                CHECK(source_budget_line_id <> target_budget_line_id)
            );

            CREATE TABLE IF NOT EXISTS project_revenue_line_successors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                from_baseline_id INTEGER NOT NULL,
                to_baseline_id INTEGER NOT NULL,
                source_revenue_line_id INTEGER NOT NULL,
                target_revenue_line_id INTEGER NOT NULL,
                mapping_kind TEXT NOT NULL
                    CHECK(mapping_kind IN ('carry_forward','merge','reclassified')),
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                UNIQUE(to_baseline_id, source_revenue_line_id),
                CHECK(from_baseline_id <> to_baseline_id),
                CHECK(source_revenue_line_id <> target_revenue_line_id)
            );

            CREATE TABLE IF NOT EXISTS project_commitments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                baseline_id INTEGER REFERENCES project_financial_baselines(id) ON DELETE RESTRICT,
                source_supplier_offer_id INTEGER REFERENCES supplier_offers(id) ON DELETE RESTRICT,
                commitment_type TEXT NOT NULL CHECK(commitment_type IN ('purchase_order','subcontract','other')),
                commitment_no TEXT,
                status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','approved','cancelled')),
                currency_code TEXT NOT NULL DEFAULT 'RUB' CHECK(currency_code = 'RUB'),
                company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                counterparty_name TEXT NOT NULL CHECK(length(trim(counterparty_name)) > 0),
                document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                expected_date TEXT,
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                submitted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                submitted_at INTEGER,
                approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                approved_at INTEGER,
                cancelled_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                cancelled_at INTEGER,
                cancellation_reason TEXT,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
                UNIQUE(project_id, commitment_no),
                CHECK(submitted_at IS NULL OR submitted_at >= created_at),
                CHECK(approved_at IS NULL OR (submitted_at IS NOT NULL AND approved_at >= submitted_at)),
                CHECK(cancelled_at IS NULL OR (approved_at IS NOT NULL AND cancelled_at >= approved_at)),
                CHECK(
                    (status = 'draft'
                        AND submitted_by IS NULL AND submitted_at IS NULL
                        AND approved_by IS NULL AND approved_at IS NULL
                        AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
                    OR
                    (status = 'pending_approval'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NULL AND approved_at IS NULL
                        AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
                    OR
                    (status = 'approved'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NOT NULL AND approved_at IS NOT NULL
                        AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
                    OR
                    (status = 'cancelled'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NOT NULL AND approved_at IS NOT NULL
                        AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL
                        AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) > 0)
                )
            );

            CREATE TABLE IF NOT EXISTS project_commitment_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                commitment_id INTEGER NOT NULL REFERENCES project_commitments(id) ON DELETE CASCADE,
                position INTEGER NOT NULL CHECK(position > 0),
                budget_line_id INTEGER REFERENCES project_budget_lines(id) ON DELETE RESTRICT,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                supplier_offer_id INTEGER REFERENCES supplier_offers(id) ON DELETE RESTRICT,
                title TEXT NOT NULL CHECK(length(trim(title)) > 0),
                unit TEXT,
                quantity REAL NOT NULL CHECK(quantity > 0),
                source_unit_price_kopecks INTEGER NOT NULL CHECK(source_unit_price_kopecks > 0),
                unit_cost_net_kopecks INTEGER NOT NULL CHECK(unit_cost_net_kopecks > 0),
                net_amount_kopecks INTEGER NOT NULL CHECK(net_amount_kopecks > 0),
                vat_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(vat_rate_basis_points BETWEEN 0 AND 10000),
                vat_amount_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(vat_amount_kopecks >= 0),
                gross_amount_kopecks INTEGER NOT NULL CHECK(gross_amount_kopecks = net_amount_kopecks + vat_amount_kopecks),
                source_vat_mode TEXT NOT NULL CHECK(source_vat_mode IN ('net','gross','no_vat')),
                source_reference TEXT NOT NULL CHECK(length(trim(source_reference)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                UNIQUE(commitment_id, position),
                CHECK(source_vat_mode <> 'no_vat' OR (vat_rate_basis_points = 0 AND vat_amount_kopecks = 0)),
                CHECK(vat_rate_basis_points <> 0 OR vat_amount_kopecks = 0)
            );

            CREATE TABLE IF NOT EXISTS project_commitment_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                commitment_id INTEGER NOT NULL REFERENCES project_commitments(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                action TEXT NOT NULL CHECK(action IN ('created','updated','submitted','approved','cancelled')),
                actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                details TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL CHECK(created_at > 0)
            );

            CREATE TABLE IF NOT EXISTS project_actual_cost_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                baseline_id INTEGER NOT NULL REFERENCES project_financial_baselines(id) ON DELETE RESTRICT,
                budget_line_id INTEGER NOT NULL REFERENCES project_budget_lines(id) ON DELETE RESTRICT,
                commitment_id INTEGER REFERENCES project_commitments(id) ON DELETE RESTRICT,
                commitment_line_id INTEGER REFERENCES project_commitment_lines(id) ON DELETE RESTRICT,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                cost_category TEXT NOT NULL CHECK(cost_category IN (
                    'material','subcontract','labor','equipment','service','logistics','overhead','other'
                )),
                entry_kind TEXT NOT NULL DEFAULT 'cost' CHECK(entry_kind IN ('cost','return','reversal')),
                source_type TEXT NOT NULL CHECK(source_type IN (
                    'material_receipt','warehouse_issue','subcontract_act','service_act',
                    'labor_timesheet','equipment_log','manual_expense','return','reversal'
                )),
                source_event_key TEXT NOT NULL CHECK(length(trim(source_event_key)) > 0),
                stock_move_id INTEGER REFERENCES stock_moves(id) ON DELETE RESTRICT,
                warehouse_transfer_id INTEGER REFERENCES warehouse_transfers(id) ON DELETE RESTRICT,
                document_id INTEGER REFERENCES documents(id) ON DELETE RESTRICT,
                reverses_entry_id INTEGER REFERENCES project_actual_cost_entries(id) ON DELETE RESTRICT,
                title TEXT NOT NULL CHECK(length(trim(title)) > 0),
                recognition_date TEXT,
                unit TEXT,
                quantity REAL NOT NULL CHECK(quantity > 0),
                source_unit_price_kopecks INTEGER NOT NULL CHECK(source_unit_price_kopecks > 0),
                unit_cost_net_kopecks INTEGER NOT NULL CHECK(unit_cost_net_kopecks > 0),
                net_amount_kopecks INTEGER NOT NULL CHECK(net_amount_kopecks > 0),
                vat_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(vat_rate_basis_points BETWEEN 0 AND 10000),
                vat_amount_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(vat_amount_kopecks >= 0),
                gross_amount_kopecks INTEGER NOT NULL CHECK(gross_amount_kopecks = net_amount_kopecks + vat_amount_kopecks),
                source_vat_mode TEXT NOT NULL CHECK(source_vat_mode IN ('net','gross','no_vat')),
                valuation_method TEXT NOT NULL CHECK(valuation_method IN (
                    'source_document','lot','moving_weighted_average','approved_rate','original_snapshot'
                )),
                source_reference TEXT NOT NULL CHECK(length(trim(source_reference)) > 0),
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','approved')),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                submitted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                submitted_at INTEGER,
                approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                approved_at INTEGER,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
                UNIQUE(project_id, source_type, source_event_key),
                CHECK(source_vat_mode <> 'no_vat' OR (vat_rate_basis_points = 0 AND vat_amount_kopecks = 0)),
                CHECK(vat_rate_basis_points <> 0 OR vat_amount_kopecks = 0),
                CHECK((commitment_id IS NULL AND commitment_line_id IS NULL)
                   OR (commitment_id IS NOT NULL AND commitment_line_id IS NOT NULL)),
                CHECK(
                    (entry_kind = 'cost' AND source_type NOT IN ('return','reversal') AND reverses_entry_id IS NULL)
                    OR (entry_kind = 'return' AND source_type = 'return' AND reverses_entry_id IS NOT NULL)
                    OR (entry_kind = 'reversal' AND source_type = 'reversal' AND reverses_entry_id IS NOT NULL)
                ),
                CHECK(
                    (status = 'draft'
                        AND submitted_by IS NULL AND submitted_at IS NULL
                        AND approved_by IS NULL AND approved_at IS NULL)
                    OR
                    (status = 'pending_approval'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NULL AND approved_at IS NULL)
                    OR
                    (status = 'approved'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
                ),
                CHECK(submitted_at IS NULL OR submitted_at >= created_at),
                CHECK(approved_at IS NULL OR (submitted_at IS NOT NULL AND approved_at >= submitted_at))
            );

            CREATE TABLE IF NOT EXISTS project_actual_cost_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actual_cost_entry_id INTEGER NOT NULL REFERENCES project_actual_cost_entries(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                action TEXT NOT NULL CHECK(action IN (
                    'created','updated','submitted','approved','reversal_created'
                )),
                actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                details TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL CHECK(created_at > 0)
            );

            CREATE TABLE IF NOT EXISTS project_payment_allocations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                finance_entry_id INTEGER NOT NULL REFERENCES finance_entries(id) ON DELETE RESTRICT,
                allocation_key TEXT NOT NULL CHECK(length(trim(allocation_key)) > 0),
                direction TEXT NOT NULL CHECK(direction IN ('income','expense')),
                allocation_purpose TEXT NOT NULL CHECK(allocation_purpose IN ('customer_receipt','supplier_payment')),
                target_type TEXT NOT NULL CHECK(target_type IN ('revenue_line','commitment','actual_cost')),
                target_revenue_line_id INTEGER REFERENCES project_revenue_lines(id) ON DELETE RESTRICT,
                target_commitment_id INTEGER REFERENCES project_commitments(id) ON DELETE RESTRICT,
                target_actual_cost_entry_id INTEGER REFERENCES project_actual_cost_entries(id) ON DELETE RESTRICT,
                entry_kind TEXT NOT NULL DEFAULT 'allocation' CHECK(entry_kind IN ('allocation','reversal')),
                reverses_allocation_id INTEGER REFERENCES project_payment_allocations(id) ON DELETE RESTRICT,
                source_payment_gross_kopecks INTEGER NOT NULL CHECK(source_payment_gross_kopecks > 0),
                net_amount_kopecks INTEGER NOT NULL CHECK(net_amount_kopecks > 0),
                vat_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(vat_rate_basis_points BETWEEN 0 AND 10000),
                vat_amount_kopecks INTEGER NOT NULL DEFAULT 0 CHECK(vat_amount_kopecks >= 0),
                gross_amount_kopecks INTEGER NOT NULL CHECK(gross_amount_kopecks = net_amount_kopecks + vat_amount_kopecks),
                source_vat_mode TEXT NOT NULL CHECK(source_vat_mode IN ('gross','no_vat')),
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','approved')),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                submitted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                submitted_at INTEGER,
                approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                approved_at INTEGER,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
                UNIQUE(finance_entry_id, allocation_key),
                CHECK(source_vat_mode <> 'no_vat' OR (vat_rate_basis_points = 0 AND vat_amount_kopecks = 0)),
                CHECK(vat_rate_basis_points <> 0 OR vat_amount_kopecks = 0),
                CHECK(
                    (target_type = 'revenue_line' AND target_revenue_line_id IS NOT NULL
                        AND target_commitment_id IS NULL AND target_actual_cost_entry_id IS NULL)
                    OR
                    (target_type = 'commitment' AND target_revenue_line_id IS NULL
                        AND target_commitment_id IS NOT NULL AND target_actual_cost_entry_id IS NULL)
                    OR
                    (target_type = 'actual_cost' AND target_revenue_line_id IS NULL
                        AND target_commitment_id IS NULL AND target_actual_cost_entry_id IS NOT NULL)
                ),
                CHECK(
                    (direction = 'income' AND allocation_purpose = 'customer_receipt' AND target_type = 'revenue_line')
                    OR
                    (direction = 'expense' AND allocation_purpose = 'supplier_payment'
                        AND target_type IN ('commitment','actual_cost'))
                ),
                CHECK(
                    (entry_kind = 'allocation' AND reverses_allocation_id IS NULL)
                    OR (entry_kind = 'reversal' AND reverses_allocation_id IS NOT NULL)
                ),
                CHECK(
                    (status = 'draft'
                        AND submitted_by IS NULL AND submitted_at IS NULL
                        AND approved_by IS NULL AND approved_at IS NULL)
                    OR
                    (status = 'pending_approval'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NULL AND approved_at IS NULL)
                    OR
                    (status = 'approved'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
                ),
                CHECK(submitted_at IS NULL OR submitted_at >= created_at),
                CHECK(approved_at IS NULL OR (submitted_at IS NOT NULL AND approved_at >= submitted_at))
            );

            CREATE TABLE IF NOT EXISTS project_payment_allocation_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_allocation_id INTEGER NOT NULL REFERENCES project_payment_allocations(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                action TEXT NOT NULL CHECK(action IN ('created','updated','submitted','approved','reversal_created')),
                actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                details TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL CHECK(created_at > 0)
            );

            CREATE TABLE IF NOT EXISTS project_forecasts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                baseline_id INTEGER NOT NULL REFERENCES project_financial_baselines(id) ON DELETE RESTRICT,
                version_no INTEGER NOT NULL CHECK(version_no > 0),
                status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','approved')),
                currency_code TEXT NOT NULL DEFAULT 'RUB' CHECK(currency_code = 'RUB'),
                calculation_date TEXT NOT NULL CHECK(length(trim(calculation_date)) > 0),
                source_state_hash TEXT NOT NULL CHECK(length(trim(source_state_hash)) > 0),
                contract_revenue_net_kopecks INTEGER NOT NULL CHECK(contract_revenue_net_kopecks >= 0),
                target_cost_net_kopecks INTEGER NOT NULL CHECK(target_cost_net_kopecks >= 0),
                committed_total_net_kopecks INTEGER NOT NULL CHECK(committed_total_net_kopecks >= 0),
                actual_cost_net_kopecks INTEGER NOT NULL CHECK(actual_cost_net_kopecks >= 0),
                etc_net_kopecks INTEGER NOT NULL CHECK(etc_net_kopecks >= 0),
                eac_net_kopecks INTEGER NOT NULL,
                forecast_margin_net_kopecks INTEGER NOT NULL,
                budget_variance_net_kopecks INTEGER NOT NULL,
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                submitted_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                submitted_at INTEGER,
                approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
                approved_at INTEGER,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
                UNIQUE(project_id, version_no),
                CHECK(eac_net_kopecks = actual_cost_net_kopecks + etc_net_kopecks),
                CHECK(forecast_margin_net_kopecks = contract_revenue_net_kopecks - eac_net_kopecks),
                CHECK(budget_variance_net_kopecks = target_cost_net_kopecks - eac_net_kopecks),
                CHECK(
                    (status = 'draft'
                        AND submitted_by IS NULL AND submitted_at IS NULL
                        AND approved_by IS NULL AND approved_at IS NULL)
                    OR
                    (status = 'pending_approval'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NULL AND approved_at IS NULL)
                    OR
                    (status = 'approved'
                        AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL
                        AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
                ),
                CHECK(submitted_at IS NULL OR submitted_at >= created_at),
                CHECK(approved_at IS NULL OR (submitted_at IS NOT NULL AND approved_at >= submitted_at))
            );

            CREATE TABLE IF NOT EXISTS project_forecast_components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                forecast_id INTEGER NOT NULL REFERENCES project_forecasts(id) ON DELETE CASCADE,
                position INTEGER NOT NULL CHECK(position > 0),
                budget_line_id INTEGER REFERENCES project_budget_lines(id) ON DELETE RESTRICT,
                commitment_line_id INTEGER REFERENCES project_commitment_lines(id) ON DELETE RESTRICT,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                component_type TEXT NOT NULL CHECK(component_type IN (
                    'remaining_commitment','uncontracted','adjustment','risk'
                )),
                source_type TEXT NOT NULL CHECK(source_type IN (
                    'approved_commitment','active_supplier_offer','autobot_snapshot',
                    'target_budget','manual_unit_price','manual_adjustment','manual_risk'
                )),
                supplier_offer_id INTEGER REFERENCES supplier_offers(id) ON DELETE RESTRICT,
                market_snapshot_id INTEGER REFERENCES market_price_snapshots(id) ON DELETE RESTRICT,
                title TEXT NOT NULL CHECK(length(trim(title)) > 0),
                unit TEXT,
                quantity REAL CHECK(quantity IS NULL OR quantity > 0),
                raw_unit_price_kopecks INTEGER CHECK(raw_unit_price_kopecks IS NULL OR raw_unit_price_kopecks > 0),
                unit_cost_net_kopecks INTEGER CHECK(unit_cost_net_kopecks IS NULL OR unit_cost_net_kopecks > 0),
                amount_sign INTEGER NOT NULL DEFAULT 1 CHECK(amount_sign IN (-1,1)),
                net_amount_kopecks INTEGER NOT NULL CHECK(net_amount_kopecks > 0),
                source_vat_mode TEXT CHECK(source_vat_mode IS NULL OR source_vat_mode IN ('net','gross','no_vat')),
                vat_rate_basis_points INTEGER CHECK(vat_rate_basis_points IS NULL OR vat_rate_basis_points BETWEEN 0 AND 10000),
                source_snapshot_at INTEGER NOT NULL CHECK(source_snapshot_at > 0),
                source_version TEXT NOT NULL CHECK(length(trim(source_version)) > 0),
                source_reference TEXT NOT NULL CHECK(length(trim(source_reference)) > 0),
                reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                UNIQUE(forecast_id, position),
                CHECK(component_type <> 'remaining_commitment' OR (
                    source_type = 'approved_commitment' AND commitment_line_id IS NOT NULL
                )),
                CHECK(component_type <> 'risk' OR (source_type = 'manual_risk' AND amount_sign = 1)),
                CHECK(component_type <> 'adjustment' OR source_type = 'manual_adjustment'),
                CHECK(source_type <> 'active_supplier_offer' OR supplier_offer_id IS NOT NULL),
                CHECK(source_type <> 'autobot_snapshot' OR market_snapshot_id IS NOT NULL)
            );

            CREATE TABLE IF NOT EXISTS project_forecast_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                forecast_id INTEGER NOT NULL REFERENCES project_forecasts(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                action TEXT NOT NULL CHECK(action IN ('calculated','submitted','approved')),
                actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                details TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL CHECK(created_at > 0)
            );

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_insert_draft_only
            BEFORE INSERT ON project_forecasts
            WHEN NEW.status <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_must_start_as_draft');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_relation_insert_guard
            BEFORE INSERT ON project_forecasts
            WHEN NOT EXISTS (
                SELECT 1 FROM project_financial_baselines baseline
                WHERE baseline.id = NEW.baseline_id
                  AND baseline.project_id = NEW.project_id
                  AND baseline.status = 'approved'
            )
            BEGIN
                SELECT RAISE(ABORT, 'approved_financial_baseline_required');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_identity_immutable
            BEFORE UPDATE OF project_id, baseline_id, version_no, source_state_hash
            ON project_forecasts
            WHEN NEW.project_id <> OLD.project_id
              OR NEW.baseline_id <> OLD.baseline_id
              OR NEW.version_no <> OLD.version_no
              OR NEW.source_state_hash <> OLD.source_state_hash
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_identity_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_status_transition
            BEFORE UPDATE OF status ON project_forecasts
            WHEN OLD.status <> NEW.status AND NOT (
                (OLD.status = 'draft' AND NEW.status = 'pending_approval')
                OR (OLD.status = 'pending_approval' AND NEW.status IN ('draft','approved'))
            )
            BEGIN
                SELECT RAISE(ABORT, 'invalid_project_forecast_status_transition');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_approval_requirements
            BEFORE UPDATE OF status ON project_forecasts
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines baseline
                    WHERE baseline.id = NEW.baseline_id
                      AND baseline.project_id = NEW.project_id
                      AND baseline.status = 'approved'
                ) THEN RAISE(ABORT, 'approved_financial_baseline_required') END;
                SELECT CASE WHEN NEW.etc_net_kopecks <> COALESCE((
                    SELECT SUM(component.amount_sign * component.net_amount_kopecks)
                    FROM project_forecast_components component
                    WHERE component.forecast_id = NEW.id
                ), 0) THEN RAISE(ABORT, 'project_forecast_component_total_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_snapshot_immutable
            BEFORE UPDATE OF currency_code, calculation_date,
                contract_revenue_net_kopecks, target_cost_net_kopecks,
                committed_total_net_kopecks, actual_cost_net_kopecks,
                etc_net_kopecks, eac_net_kopecks, forecast_margin_net_kopecks,
                budget_variance_net_kopecks, reason, created_by, created_at
            ON project_forecasts
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_snapshot_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_approved_immutable
            BEFORE UPDATE ON project_forecasts
            WHEN OLD.status = 'approved'
            BEGIN
                SELECT RAISE(ABORT, 'approved_project_forecast_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_delete_guard
            BEFORE DELETE ON project_forecasts
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_cannot_be_deleted');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_component_insert_guard
            BEFORE INSERT ON project_forecast_components
            BEGIN
                SELECT CASE WHEN COALESCE((
                    SELECT status FROM project_forecasts WHERE id = NEW.forecast_id
                ), '') <> 'draft' THEN RAISE(ABORT, 'project_forecast_components_are_not_editable') END;
                SELECT CASE WHEN NEW.budget_line_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM project_budget_lines line
                    JOIN project_forecasts forecast ON forecast.id = NEW.forecast_id
                    WHERE line.id = NEW.budget_line_id AND line.baseline_id = forecast.baseline_id
                ) THEN RAISE(ABORT, 'project_forecast_budget_line_mismatch') END;
                SELECT CASE WHEN NEW.commitment_line_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM project_commitment_lines line
                    JOIN project_commitments commitment ON commitment.id = line.commitment_id
                    JOIN project_forecasts forecast ON forecast.id = NEW.forecast_id
                    WHERE line.id = NEW.commitment_line_id
                      AND commitment.project_id = forecast.project_id
                ) THEN RAISE(ABORT, 'project_forecast_commitment_line_mismatch') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM estimate_items item
                    JOIN project_forecasts forecast ON forecast.id = NEW.forecast_id
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = forecast.project_id
                ) THEN RAISE(ABORT, 'project_forecast_estimate_item_mismatch') END;
                SELECT CASE WHEN NEW.supplier_offer_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM supplier_offers offer
                    JOIN project_forecasts forecast ON forecast.id = NEW.forecast_id
                    WHERE offer.id = NEW.supplier_offer_id AND offer.project_id = forecast.project_id
                ) THEN RAISE(ABORT, 'project_forecast_supplier_offer_mismatch') END;
                SELECT CASE WHEN NEW.market_snapshot_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM market_price_snapshots snapshot
                    JOIN project_forecasts forecast ON forecast.id = NEW.forecast_id
                    WHERE snapshot.id = NEW.market_snapshot_id AND snapshot.project_id = forecast.project_id
                ) THEN RAISE(ABORT, 'project_forecast_market_snapshot_mismatch') END;
                SELECT CASE WHEN NOT (
                    (NEW.component_type = 'remaining_commitment'
                        AND NEW.source_type = 'approved_commitment')
                    OR (NEW.component_type = 'uncontracted' AND NEW.source_type IN (
                        'active_supplier_offer','autobot_snapshot',
                        'target_budget','manual_unit_price'
                    ))
                    OR (NEW.component_type = 'adjustment'
                        AND NEW.source_type = 'manual_adjustment')
                    OR (NEW.component_type = 'risk'
                        AND NEW.source_type = 'manual_risk')
                ) THEN RAISE(ABORT, 'project_forecast_component_source_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_component_update_immutable
            BEFORE UPDATE ON project_forecast_components
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_component_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_component_delete_immutable
            BEFORE DELETE ON project_forecast_components
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_component_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_component_update_guard
            BEFORE UPDATE ON project_forecast_components
            WHEN COALESCE((SELECT status FROM project_forecasts WHERE id = OLD.forecast_id), '') <> 'draft'
              OR COALESCE((SELECT status FROM project_forecasts WHERE id = NEW.forecast_id), '') <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_components_are_not_editable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_component_delete_guard
            BEFORE DELETE ON project_forecast_components
            WHEN COALESCE((SELECT status FROM project_forecasts WHERE id = OLD.forecast_id), '') <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_components_are_not_editable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_event_insert_guard
            BEFORE INSERT ON project_forecast_events
            WHEN NOT EXISTS (
                SELECT 1 FROM project_forecasts forecast
                WHERE forecast.id = NEW.forecast_id AND forecast.project_id = NEW.project_id
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_event_project_mismatch');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_event_update_guard
            BEFORE UPDATE ON project_forecast_events
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_forecast_event_delete_guard
            BEFORE DELETE ON project_forecast_events
            BEGIN
                SELECT RAISE(ABORT, 'project_forecast_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_insert_draft_only
            BEFORE INSERT ON project_payment_allocations
            WHEN NEW.status <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'project_payment_allocation_must_start_as_draft');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_relation_insert_guard
            BEFORE INSERT ON project_payment_allocations
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM finance_entries payment
                    WHERE payment.id = NEW.finance_entry_id
                      AND payment.project_id = NEW.project_id
                      AND payment.direction = NEW.direction
                ) THEN RAISE(ABORT, 'project_payment_allocation_payment_mismatch') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'revenue_line' AND NOT EXISTS (
                    SELECT 1
                    FROM project_revenue_lines line
                    JOIN project_financial_baselines baseline ON baseline.id = line.baseline_id
                    WHERE line.id = NEW.target_revenue_line_id
                      AND baseline.project_id = NEW.project_id
                      AND baseline.status = 'approved'
                ) THEN RAISE(ABORT, 'approved_project_revenue_line_required') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'commitment' AND NOT EXISTS (
                    SELECT 1 FROM project_commitments commitment
                    WHERE commitment.id = NEW.target_commitment_id
                      AND commitment.project_id = NEW.project_id
                      AND commitment.status = 'approved'
                ) THEN RAISE(ABORT, 'approved_project_commitment_required') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'actual_cost' AND NOT EXISTS (
                    SELECT 1 FROM project_actual_cost_entries actual
                    WHERE actual.id = NEW.target_actual_cost_entry_id
                      AND actual.project_id = NEW.project_id
                      AND actual.status = 'approved'
                      AND actual.entry_kind = 'cost'
                ) THEN RAISE(ABORT, 'approved_project_actual_cost_required') END;
                SELECT CASE WHEN NEW.reverses_allocation_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM project_payment_allocations original
                    WHERE original.id = NEW.reverses_allocation_id
                      AND original.project_id = NEW.project_id
                      AND original.finance_entry_id = NEW.finance_entry_id
                      AND original.status = 'approved'
                      AND original.entry_kind = 'allocation'
                      AND original.direction = NEW.direction
                      AND original.allocation_purpose = NEW.allocation_purpose
                      AND original.target_type = NEW.target_type
                      AND original.target_revenue_line_id IS NEW.target_revenue_line_id
                      AND original.target_commitment_id IS NEW.target_commitment_id
                      AND original.target_actual_cost_entry_id IS NEW.target_actual_cost_entry_id
                ) THEN RAISE(ABORT, 'project_payment_allocation_reversal_target_invalid') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_relation_update_guard
            BEFORE UPDATE ON project_payment_allocations
            WHEN OLD.status <> 'approved'
            BEGIN
                SELECT CASE WHEN NEW.project_id <> OLD.project_id
                    OR NEW.finance_entry_id <> OLD.finance_entry_id
                    OR NEW.allocation_key <> OLD.allocation_key
                    OR NEW.direction <> OLD.direction
                    OR NEW.allocation_purpose <> OLD.allocation_purpose
                    OR NEW.entry_kind <> OLD.entry_kind
                    OR NEW.reverses_allocation_id IS NOT OLD.reverses_allocation_id
                    THEN RAISE(ABORT, 'project_payment_allocation_source_is_immutable') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'revenue_line' AND NOT EXISTS (
                    SELECT 1
                    FROM project_revenue_lines line
                    JOIN project_financial_baselines baseline ON baseline.id = line.baseline_id
                    WHERE line.id = NEW.target_revenue_line_id
                      AND baseline.project_id = NEW.project_id AND baseline.status = 'approved'
                ) THEN RAISE(ABORT, 'approved_project_revenue_line_required') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'commitment' AND NOT EXISTS (
                    SELECT 1 FROM project_commitments commitment
                    WHERE commitment.id = NEW.target_commitment_id
                      AND commitment.project_id = NEW.project_id AND commitment.status = 'approved'
                ) THEN RAISE(ABORT, 'approved_project_commitment_required') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'actual_cost' AND NOT EXISTS (
                    SELECT 1 FROM project_actual_cost_entries actual
                    WHERE actual.id = NEW.target_actual_cost_entry_id
                      AND actual.project_id = NEW.project_id
                      AND actual.status = 'approved' AND actual.entry_kind = 'cost'
                ) THEN RAISE(ABORT, 'approved_project_actual_cost_required') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_status_transition
            BEFORE UPDATE OF status ON project_payment_allocations
            WHEN OLD.status <> NEW.status AND NOT (
                (OLD.status = 'draft' AND NEW.status = 'pending_approval')
                OR (OLD.status = 'pending_approval' AND NEW.status IN ('draft','approved'))
            )
            BEGIN
                SELECT RAISE(ABORT, 'invalid_project_payment_allocation_status_transition');
            END;

            -- A submitted allocation is a review snapshot.  Approval/return may
            -- only alter lifecycle metadata, never the payment, target or money.
            DROP TRIGGER IF EXISTS trg_project_payment_allocation_pending_snapshot_guard_v1;
            CREATE TRIGGER trg_project_payment_allocation_pending_snapshot_guard_v1
            BEFORE UPDATE ON project_payment_allocations
            WHEN OLD.status = 'pending_approval' AND (
                NEW.id IS NOT OLD.id
                OR NEW.project_id IS NOT OLD.project_id
                OR NEW.finance_entry_id IS NOT OLD.finance_entry_id
                OR NEW.allocation_key IS NOT OLD.allocation_key
                OR NEW.direction IS NOT OLD.direction
                OR NEW.allocation_purpose IS NOT OLD.allocation_purpose
                OR NEW.target_type IS NOT OLD.target_type
                OR NEW.target_revenue_line_id IS NOT OLD.target_revenue_line_id
                OR NEW.target_commitment_id IS NOT OLD.target_commitment_id
                OR NEW.target_actual_cost_entry_id IS NOT OLD.target_actual_cost_entry_id
                OR NEW.entry_kind IS NOT OLD.entry_kind
                OR NEW.reverses_allocation_id IS NOT OLD.reverses_allocation_id
                OR NEW.source_payment_gross_kopecks IS NOT OLD.source_payment_gross_kopecks
                OR NEW.net_amount_kopecks IS NOT OLD.net_amount_kopecks
                OR NEW.vat_rate_basis_points IS NOT OLD.vat_rate_basis_points
                OR NEW.vat_amount_kopecks IS NOT OLD.vat_amount_kopecks
                OR NEW.gross_amount_kopecks IS NOT OLD.gross_amount_kopecks
                OR NEW.source_vat_mode IS NOT OLD.source_vat_mode
                OR NEW.reason IS NOT OLD.reason
                OR NEW.created_by IS NOT OLD.created_by
                OR NEW.created_at IS NOT OLD.created_at
                OR NOT (
                    (
                        NEW.status = 'draft'
                        AND NEW.submitted_by IS NULL
                        AND NEW.submitted_at IS NULL
                        AND NEW.approved_by IS NULL
                        AND NEW.approved_at IS NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                    OR (
                        NEW.status = 'approved'
                        AND NEW.submitted_by IS OLD.submitted_by
                        AND NEW.submitted_at IS OLD.submitted_at
                        AND NEW.approved_by IS NOT NULL
                        AND NEW.approved_at IS NOT NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                )
            )
            BEGIN
                SELECT RAISE(ABORT, 'pending_project_payment_allocation_snapshot_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_approval_requirements
            BEFORE UPDATE OF status ON project_payment_allocations
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM finance_entries payment
                    WHERE payment.id = NEW.finance_entry_id
                      AND payment.project_id = NEW.project_id
                      AND payment.direction = NEW.direction
                      AND payment.status = 'paid'
                      AND payment.paid_date IS NOT NULL
                      AND length(trim(payment.paid_date)) > 0
                      AND date(payment.paid_date) IS NOT NULL
                      AND CAST(ROUND(ROUND(payment.amount, 2) * 100) AS INTEGER) = NEW.source_payment_gross_kopecks
                      AND NEW.vat_rate_basis_points = CASE
                          WHEN payment.payment_kind = 'bank_vat' AND payment.vat_percent > 0
                          THEN CAST(ROUND(payment.vat_percent * 100) AS INTEGER)
                          ELSE 0 END
                      AND NEW.source_vat_mode = CASE
                          WHEN payment.payment_kind = 'bank_vat' AND payment.vat_percent > 0
                          THEN 'gross' ELSE 'no_vat' END
                ) THEN RAISE(ABORT, 'paid_dated_unchanged_finance_entry_required') END;
                SELECT CASE WHEN NEW.entry_kind = 'reversal' AND NOT EXISTS (
                    SELECT 1 FROM project_payment_allocations original
                    WHERE original.id = NEW.reverses_allocation_id
                      AND original.status = 'approved'
                      AND original.entry_kind = 'allocation'
                      AND original.net_amount_kopecks = NEW.net_amount_kopecks
                      AND original.vat_amount_kopecks = NEW.vat_amount_kopecks
                      AND original.gross_amount_kopecks = NEW.gross_amount_kopecks
                ) THEN RAISE(ABORT, 'project_payment_allocation_reversal_must_match_original') END;
                SELECT CASE WHEN (
                    COALESCE((
                        SELECT SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                        THEN allocation.gross_amount_kopecks
                                        ELSE -allocation.gross_amount_kopecks END)
                        FROM project_payment_allocations allocation
                        WHERE allocation.finance_entry_id = NEW.finance_entry_id
                          AND allocation.status = 'approved'
                    ), 0)
                    + CASE WHEN NEW.entry_kind = 'allocation'
                           THEN NEW.gross_amount_kopecks ELSE -NEW.gross_amount_kopecks END
                ) NOT BETWEEN 0 AND NEW.source_payment_gross_kopecks
                THEN RAISE(ABORT, 'project_payment_allocation_exceeds_payment') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'revenue_line' AND (
                    COALESCE((
                        SELECT SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                        THEN allocation.gross_amount_kopecks
                                        ELSE -allocation.gross_amount_kopecks END)
                        FROM project_payment_allocations allocation
                        WHERE allocation.target_revenue_line_id = NEW.target_revenue_line_id
                          AND allocation.status = 'approved'
                    ), 0) + NEW.gross_amount_kopecks
                ) > (SELECT gross_amount_kopecks FROM project_revenue_lines WHERE id = NEW.target_revenue_line_id)
                THEN RAISE(ABORT, 'project_payment_allocation_exceeds_revenue_line') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'commitment' AND (
                    COALESCE((
                        SELECT SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                        THEN allocation.gross_amount_kopecks
                                        ELSE -allocation.gross_amount_kopecks END)
                        FROM project_payment_allocations allocation
                        WHERE allocation.target_commitment_id = NEW.target_commitment_id
                          AND allocation.status = 'approved'
                    ), 0) + NEW.gross_amount_kopecks
                ) > (
                    SELECT COALESCE(SUM(line.gross_amount_kopecks), 0)
                    FROM project_commitment_lines line WHERE line.commitment_id = NEW.target_commitment_id
                ) THEN RAISE(ABORT, 'project_payment_allocation_exceeds_commitment') END;
                SELECT CASE WHEN NEW.entry_kind = 'allocation' AND NEW.target_type = 'actual_cost' AND (
                    COALESCE((
                        SELECT SUM(CASE WHEN allocation.entry_kind = 'allocation'
                                        THEN allocation.gross_amount_kopecks
                                        ELSE -allocation.gross_amount_kopecks END)
                        FROM project_payment_allocations allocation
                        WHERE allocation.target_actual_cost_entry_id = NEW.target_actual_cost_entry_id
                          AND allocation.status = 'approved'
                    ), 0) + NEW.gross_amount_kopecks
                ) > (
                    SELECT gross_amount_kopecks FROM project_actual_cost_entries
                    WHERE id = NEW.target_actual_cost_entry_id
                ) THEN RAISE(ABORT, 'project_payment_allocation_exceeds_actual_cost') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_approved_immutable
            BEFORE UPDATE ON project_payment_allocations
            WHEN OLD.status = 'approved'
            BEGIN
                SELECT RAISE(ABORT, 'approved_project_payment_allocation_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_delete_guard
            BEFORE DELETE ON project_payment_allocations
            BEGIN
                SELECT RAISE(ABORT, 'project_payment_allocation_cannot_be_deleted');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_event_insert_guard
            BEFORE INSERT ON project_payment_allocation_events
            WHEN NOT EXISTS (
                SELECT 1 FROM project_payment_allocations allocation
                WHERE allocation.id = NEW.payment_allocation_id
                  AND allocation.project_id = NEW.project_id
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_payment_allocation_event_project_mismatch');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_event_update_guard
            BEFORE UPDATE ON project_payment_allocation_events
            BEGIN
                SELECT RAISE(ABORT, 'project_payment_allocation_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_payment_allocation_event_delete_guard
            BEFORE DELETE ON project_payment_allocation_events
            BEGIN
                SELECT RAISE(ABORT, 'project_payment_allocation_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_allocated_finance_entry_identity_immutable
            BEFORE UPDATE OF project_id, direction, payment_kind, vat_percent, amount, paid_date, status
            ON finance_entries
            WHEN EXISTS (
                SELECT 1 FROM project_payment_allocations allocation
                WHERE allocation.finance_entry_id = OLD.id
            ) AND (
                NEW.project_id <> OLD.project_id
                OR NEW.direction <> OLD.direction
                OR NEW.payment_kind <> OLD.payment_kind
                OR NEW.vat_percent <> OLD.vat_percent
                OR NEW.amount <> OLD.amount
                OR NEW.paid_date IS NOT OLD.paid_date
                OR NEW.status <> OLD.status
            )
            BEGIN
                SELECT RAISE(ABORT, 'allocated_finance_entry_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_allocated_finance_entry_delete_guard
            BEFORE DELETE ON finance_entries
            WHEN EXISTS (
                SELECT 1 FROM project_payment_allocations allocation
                WHERE allocation.finance_entry_id = OLD.id
            )
            BEGIN
                SELECT RAISE(ABORT, 'allocated_finance_entry_cannot_be_deleted');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_insert_draft_only
            BEFORE INSERT ON project_actual_cost_entries
            WHEN NEW.status <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_must_start_as_draft');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_relation_insert_guard
            BEFORE INSERT ON project_actual_cost_entries
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines baseline
                    WHERE baseline.id = NEW.baseline_id AND baseline.project_id = NEW.project_id
                ) THEN RAISE(ABORT, 'project_actual_cost_baseline_project_mismatch') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_budget_lines budget_line
                    WHERE budget_line.id = NEW.budget_line_id AND budget_line.baseline_id = NEW.baseline_id
                ) THEN RAISE(ABORT, 'project_actual_cost_budget_line_mismatch') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM estimate_items item
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = NEW.project_id
                ) THEN RAISE(ABORT, 'project_actual_cost_estimate_item_project_mismatch') END;
                SELECT CASE WHEN NEW.commitment_line_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM project_commitment_lines line
                    JOIN project_commitments commitment ON commitment.id = line.commitment_id
                    WHERE line.id = NEW.commitment_line_id
                      AND commitment.id = NEW.commitment_id
                      AND commitment.project_id = NEW.project_id
                      AND line.budget_line_id = NEW.budget_line_id
                ) THEN RAISE(ABORT, 'project_actual_cost_commitment_line_mismatch') END;
                SELECT CASE WHEN NEW.stock_move_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM stock_moves move
                    WHERE move.id = NEW.stock_move_id AND move.project_id = NEW.project_id
                      AND (NEW.estimate_item_id IS NULL OR move.estimate_item_id = NEW.estimate_item_id)
                ) THEN RAISE(ABORT, 'project_actual_cost_stock_move_mismatch') END;
                SELECT CASE WHEN NEW.warehouse_transfer_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM warehouse_transfers transfer
                    WHERE transfer.id = NEW.warehouse_transfer_id AND transfer.project_id = NEW.project_id
                      AND (NEW.estimate_item_id IS NULL OR transfer.estimate_item_id = NEW.estimate_item_id)
                ) THEN RAISE(ABORT, 'project_actual_cost_warehouse_transfer_mismatch') END;
                SELECT CASE WHEN NEW.document_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM documents document
                    WHERE document.id = NEW.document_id AND document.project_id = NEW.project_id
                ) THEN RAISE(ABORT, 'project_actual_cost_document_project_mismatch') END;
                SELECT CASE WHEN NEW.reverses_entry_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM project_actual_cost_entries original
                    WHERE original.id = NEW.reverses_entry_id
                      AND original.project_id = NEW.project_id
                      AND original.status = 'approved'
                      AND original.entry_kind = 'cost'
                ) THEN RAISE(ABORT, 'project_actual_cost_reversal_target_invalid') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_relation_update_guard
            BEFORE UPDATE ON project_actual_cost_entries
            WHEN OLD.status <> 'approved'
            BEGIN
                SELECT CASE WHEN NEW.project_id <> OLD.project_id
                    OR NEW.source_type <> OLD.source_type
                    OR NEW.source_event_key <> OLD.source_event_key
                    OR NEW.stock_move_id IS NOT OLD.stock_move_id
                    OR NEW.warehouse_transfer_id IS NOT OLD.warehouse_transfer_id
                    OR NEW.document_id IS NOT OLD.document_id
                    OR NEW.reverses_entry_id IS NOT OLD.reverses_entry_id
                    THEN RAISE(ABORT, 'project_actual_cost_source_is_immutable') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines baseline
                    WHERE baseline.id = NEW.baseline_id AND baseline.project_id = NEW.project_id
                ) THEN RAISE(ABORT, 'project_actual_cost_baseline_project_mismatch') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_budget_lines budget_line
                    WHERE budget_line.id = NEW.budget_line_id AND budget_line.baseline_id = NEW.baseline_id
                ) THEN RAISE(ABORT, 'project_actual_cost_budget_line_mismatch') END;
                SELECT CASE WHEN NEW.commitment_line_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM project_commitment_lines line
                    JOIN project_commitments commitment ON commitment.id = line.commitment_id
                    WHERE line.id = NEW.commitment_line_id
                      AND commitment.id = NEW.commitment_id
                      AND commitment.project_id = NEW.project_id
                      AND line.budget_line_id = NEW.budget_line_id
                ) THEN RAISE(ABORT, 'project_actual_cost_commitment_line_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_direct_budget_insert_guard
            BEFORE INSERT ON project_actual_cost_entries
            WHEN NOT EXISTS (
                SELECT 1 FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.baseline_id = NEW.baseline_id
                  AND budget_line.line_type = 'direct_cost'
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_direct_budget_required');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_direct_budget_update_guard
            BEFORE UPDATE OF baseline_id, budget_line_id ON project_actual_cost_entries
            WHEN NOT EXISTS (
                SELECT 1 FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.baseline_id = NEW.baseline_id
                  AND budget_line.line_type = 'direct_cost'
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_direct_budget_required');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_direct_budget_approval_guard
            BEFORE UPDATE OF status ON project_actual_cost_entries
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved' AND NOT EXISTS (
                SELECT 1 FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.baseline_id = NEW.baseline_id
                  AND budget_line.line_type = 'direct_cost'
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_direct_budget_required');
            END;

            -- Quantity comparisons are only meaningful when both sides use the
            -- operational unit fixed by the approved budget line.  Keep these
            -- guards at the database boundary as well as in the API.
            DROP TRIGGER IF EXISTS trg_project_actual_cost_unit_insert_guard_v1;
            CREATE TRIGGER trg_project_actual_cost_unit_insert_guard_v1
            BEFORE INSERT ON project_actual_cost_entries
            WHEN NEW.status = 'draft' AND NEW.entry_kind = 'cost' AND EXISTS (
                SELECT 1
                FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.quantity IS NOT NULL
                  AND budget_line.quantity > 0
                  AND lower(trim(COALESCE(NEW.unit, '')))
                      <> lower(trim(COALESCE(budget_line.unit, '')))
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_operational_unit_mismatch');
            END;

            DROP TRIGGER IF EXISTS trg_project_actual_cost_unit_update_guard_v1;
            CREATE TRIGGER trg_project_actual_cost_unit_update_guard_v1
            BEFORE UPDATE OF entry_kind, budget_line_id, unit ON project_actual_cost_entries
            WHEN NEW.entry_kind = 'cost' AND EXISTS (
                SELECT 1
                FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.quantity IS NOT NULL
                  AND budget_line.quantity > 0
                  AND lower(trim(COALESCE(NEW.unit, '')))
                      <> lower(trim(COALESCE(budget_line.unit, '')))
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_operational_unit_mismatch');
            END;

            DROP TRIGGER IF EXISTS trg_project_actual_cost_unit_approval_guard_v1;
            CREATE TRIGGER trg_project_actual_cost_unit_approval_guard_v1
            BEFORE UPDATE OF status ON project_actual_cost_entries
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
              AND NEW.entry_kind = 'cost' AND EXISTS (
                SELECT 1
                FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.quantity IS NOT NULL
                  AND budget_line.quantity > 0
                  AND lower(trim(COALESCE(NEW.unit, '')))
                      <> lower(trim(COALESCE(budget_line.unit, '')))
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_operational_unit_mismatch');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_status_transition
            BEFORE UPDATE OF status ON project_actual_cost_entries
            WHEN OLD.status <> NEW.status AND NOT (
                (OLD.status = 'draft' AND NEW.status = 'pending_approval')
                OR (OLD.status = 'pending_approval' AND NEW.status IN ('draft','approved'))
            )
            BEGIN
                SELECT RAISE(ABORT, 'invalid_project_actual_cost_status_transition');
            END;

            -- Submission freezes every recognition/source/value field.  A
            -- reviewer can only approve or return the exact submitted snapshot.
            DROP TRIGGER IF EXISTS trg_project_actual_cost_pending_snapshot_guard_v1;
            CREATE TRIGGER trg_project_actual_cost_pending_snapshot_guard_v1
            BEFORE UPDATE ON project_actual_cost_entries
            WHEN OLD.status = 'pending_approval' AND (
                NEW.id IS NOT OLD.id
                OR NEW.project_id IS NOT OLD.project_id
                OR NEW.baseline_id IS NOT OLD.baseline_id
                OR NEW.budget_line_id IS NOT OLD.budget_line_id
                OR NEW.commitment_id IS NOT OLD.commitment_id
                OR NEW.commitment_line_id IS NOT OLD.commitment_line_id
                OR NEW.estimate_item_id IS NOT OLD.estimate_item_id
                OR NEW.cost_category IS NOT OLD.cost_category
                OR NEW.entry_kind IS NOT OLD.entry_kind
                OR NEW.source_type IS NOT OLD.source_type
                OR NEW.source_event_key IS NOT OLD.source_event_key
                OR NEW.stock_move_id IS NOT OLD.stock_move_id
                OR NEW.warehouse_transfer_id IS NOT OLD.warehouse_transfer_id
                OR NEW.document_id IS NOT OLD.document_id
                OR NEW.reverses_entry_id IS NOT OLD.reverses_entry_id
                OR NEW.title IS NOT OLD.title
                OR NEW.recognition_date IS NOT OLD.recognition_date
                OR NEW.unit IS NOT OLD.unit
                OR NEW.quantity IS NOT OLD.quantity
                OR NEW.source_unit_price_kopecks IS NOT OLD.source_unit_price_kopecks
                OR NEW.unit_cost_net_kopecks IS NOT OLD.unit_cost_net_kopecks
                OR NEW.net_amount_kopecks IS NOT OLD.net_amount_kopecks
                OR NEW.vat_rate_basis_points IS NOT OLD.vat_rate_basis_points
                OR NEW.vat_amount_kopecks IS NOT OLD.vat_amount_kopecks
                OR NEW.gross_amount_kopecks IS NOT OLD.gross_amount_kopecks
                OR NEW.source_vat_mode IS NOT OLD.source_vat_mode
                OR NEW.valuation_method IS NOT OLD.valuation_method
                OR NEW.source_reference IS NOT OLD.source_reference
                OR NEW.reason IS NOT OLD.reason
                OR NEW.created_by IS NOT OLD.created_by
                OR NEW.created_at IS NOT OLD.created_at
                OR NOT (
                    (
                        NEW.status = 'draft'
                        AND NEW.submitted_by IS NULL
                        AND NEW.submitted_at IS NULL
                        AND NEW.approved_by IS NULL
                        AND NEW.approved_at IS NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                    OR (
                        NEW.status = 'approved'
                        AND NEW.submitted_by IS OLD.submitted_by
                        AND NEW.submitted_at IS OLD.submitted_at
                        AND NEW.approved_by IS NOT NULL
                        AND NEW.approved_at IS NOT NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                )
            )
            BEGIN
                SELECT RAISE(ABORT, 'pending_project_actual_cost_snapshot_is_immutable');
            END;

            -- Recreate this guard because successor mapping permits narrowly scoped
            -- recognition against an immutable, superseded commitment baseline.
            DROP TRIGGER IF EXISTS trg_project_actual_cost_approval_requirements;
            CREATE TRIGGER trg_project_actual_cost_approval_requirements
            BEFORE UPDATE OF status ON project_actual_cost_entries
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
            BEGIN
                SELECT CASE WHEN NEW.recognition_date IS NULL OR length(trim(NEW.recognition_date)) = 0
                    THEN RAISE(ABORT, 'project_actual_cost_recognition_date_required') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines baseline
                    WHERE baseline.id = NEW.baseline_id
                      AND baseline.project_id = NEW.project_id
                      AND (
                          baseline.status = 'approved'
                          OR (
                              baseline.status = 'superseded'
                              AND (
                                  NEW.commitment_line_id IS NOT NULL
                                  OR NEW.entry_kind IN ('return','reversal')
                              )
                          )
                      )
                ) THEN RAISE(ABORT, 'approved_financial_baseline_required') END;
                SELECT CASE WHEN NEW.commitment_line_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM project_commitment_lines line
                    JOIN project_commitments commitment ON commitment.id = line.commitment_id
                    WHERE line.id = NEW.commitment_line_id
                      AND commitment.id = NEW.commitment_id
                      AND (
                          (NEW.entry_kind = 'cost' AND commitment.status = 'approved')
                          OR (
                              NEW.entry_kind IN ('return','reversal')
                              AND commitment.status IN ('approved','cancelled')
                          )
                      )
                      AND commitment.project_id = NEW.project_id
                      AND line.budget_line_id = NEW.budget_line_id
                ) THEN RAISE(ABORT, 'approved_project_commitment_required') END;
                SELECT CASE WHEN NEW.source_type = 'material_receipt' AND (
                    NEW.stock_move_id IS NULL OR NOT EXISTS (
                        SELECT 1 FROM stock_moves move
                        WHERE move.id = NEW.stock_move_id AND move.project_id = NEW.project_id
                          AND move.move_type IN ('purchase','receipt') AND move.price > 0
                    )
                ) THEN RAISE(ABORT, 'accepted_priced_material_receipt_required') END;
                SELECT CASE WHEN NEW.source_type = 'warehouse_issue' AND (
                    NEW.warehouse_transfer_id IS NULL
                    OR NEW.valuation_method NOT IN ('lot','moving_weighted_average')
                ) THEN RAISE(ABORT, 'valued_warehouse_issue_required') END;
                SELECT CASE WHEN NEW.source_type IN ('subcontract_act','service_act','manual_expense') AND (
                    NEW.document_id IS NULL OR NOT EXISTS (
                        SELECT 1 FROM documents document
                        WHERE document.id = NEW.document_id AND document.project_id = NEW.project_id
                          AND lower(document.doc_type) <> 'invoice'
                          AND lower(document.status) IN ('reviewed','approved','signed','ready','accepted')
                    )
                ) THEN RAISE(ABORT, 'accepted_non_invoice_document_required') END;
                SELECT CASE WHEN NEW.source_type = 'labor_timesheet'
                    AND NEW.valuation_method <> 'approved_rate'
                    THEN RAISE(ABORT, 'approved_labor_rate_required') END;
                SELECT CASE WHEN NEW.source_type = 'equipment_log'
                    AND NEW.valuation_method <> 'approved_rate'
                    THEN RAISE(ABORT, 'approved_equipment_rate_required') END;
                SELECT CASE WHEN NEW.entry_kind IN ('return','reversal') AND (
                    NEW.valuation_method <> 'original_snapshot'
                    OR NOT EXISTS (
                        SELECT 1 FROM project_actual_cost_entries original
                        WHERE original.id = NEW.reverses_entry_id
                          AND original.project_id = NEW.project_id
                          AND original.status = 'approved'
                          AND original.entry_kind = 'cost'
                    )
                ) THEN RAISE(ABORT, 'project_actual_cost_reversal_target_invalid') END;
                SELECT CASE WHEN NEW.entry_kind IN ('return','reversal') AND NEW.net_amount_kopecks > (
                    SELECT original.net_amount_kopecks - COALESCE(SUM(
                        CASE WHEN correction.status = 'approved' THEN correction.net_amount_kopecks ELSE 0 END
                    ), 0)
                    FROM project_actual_cost_entries original
                    LEFT JOIN project_actual_cost_entries correction
                      ON correction.reverses_entry_id = original.id
                     AND correction.id <> NEW.id
                    WHERE original.id = NEW.reverses_entry_id
                    GROUP BY original.net_amount_kopecks
                ) THEN RAISE(ABORT, 'project_actual_cost_reversal_exceeds_original') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_approved_immutable
            BEFORE UPDATE ON project_actual_cost_entries
            WHEN OLD.status = 'approved'
            BEGIN
                SELECT RAISE(ABORT, 'approved_project_actual_cost_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_delete_guard
            BEFORE DELETE ON project_actual_cost_entries
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_cannot_be_deleted');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_event_insert_guard
            BEFORE INSERT ON project_actual_cost_events
            WHEN NOT EXISTS (
                SELECT 1 FROM project_actual_cost_entries entry
                WHERE entry.id = NEW.actual_cost_entry_id AND entry.project_id = NEW.project_id
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_event_project_mismatch');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_event_update_guard
            BEFORE UPDATE ON project_actual_cost_events
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_actual_cost_event_delete_guard
            BEFORE DELETE ON project_actual_cost_events
            BEGIN
                SELECT RAISE(ABORT, 'project_actual_cost_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_insert_draft_only
            BEFORE INSERT ON project_commitments
            WHEN NEW.status <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_must_start_as_draft');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_relation_guard
            BEFORE INSERT ON project_commitments
            BEGIN
                SELECT CASE WHEN NEW.baseline_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines baseline
                    WHERE baseline.id = NEW.baseline_id AND baseline.project_id = NEW.project_id
                ) THEN RAISE(ABORT, 'project_commitment_baseline_project_mismatch') END;
                SELECT CASE WHEN NEW.source_supplier_offer_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM supplier_offers offer
                    WHERE offer.id = NEW.source_supplier_offer_id
                      AND offer.project_id = NEW.project_id
                      AND offer.status = 'selected'
                ) THEN RAISE(ABORT, 'project_commitment_requires_selected_project_offer') END;
            END;

            -- Keep legacy duplicate rows readable, but reject every new open
            -- duplicate at write time.  Unlike a UNIQUE-index migration this is
            -- safe to install on databases that already contain duplicates.
            DROP TRIGGER IF EXISTS trg_project_commitment_open_offer_insert_guard_v1;
            CREATE TRIGGER trg_project_commitment_open_offer_insert_guard_v1
            BEFORE INSERT ON project_commitments
            WHEN NEW.source_supplier_offer_id IS NOT NULL
              AND NEW.status <> 'cancelled'
              AND EXISTS (
                  SELECT 1
                  FROM project_commitments existing
                  WHERE existing.source_supplier_offer_id = NEW.source_supplier_offer_id
                    AND existing.status <> 'cancelled'
              )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_offer_already_linked');
            END;

            DROP TRIGGER IF EXISTS trg_project_commitment_open_offer_update_guard_v1;
            CREATE TRIGGER trg_project_commitment_open_offer_update_guard_v1
            BEFORE UPDATE OF source_supplier_offer_id, status ON project_commitments
            WHEN NEW.source_supplier_offer_id IS NOT NULL
              AND NEW.status <> 'cancelled'
              AND EXISTS (
                  SELECT 1
                  FROM project_commitments existing
                  WHERE existing.source_supplier_offer_id = NEW.source_supplier_offer_id
                    AND existing.status <> 'cancelled'
                    AND existing.id <> NEW.id
              )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_offer_already_linked');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_identity_immutable
            BEFORE UPDATE OF project_id, source_supplier_offer_id ON project_commitments
            WHEN NEW.project_id IS NOT OLD.project_id
              OR NEW.source_supplier_offer_id IS NOT OLD.source_supplier_offer_id
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_identity_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_baseline_guard
            BEFORE UPDATE OF baseline_id ON project_commitments
            WHEN NEW.baseline_id IS NOT OLD.baseline_id AND NEW.baseline_id IS NOT NULL
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines baseline
                    WHERE baseline.id = NEW.baseline_id AND baseline.project_id = OLD.project_id
                ) THEN RAISE(ABORT, 'project_commitment_baseline_project_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_status_transition
            BEFORE UPDATE OF status ON project_commitments
            WHEN OLD.status <> NEW.status AND NOT (
                (OLD.status = 'draft' AND NEW.status = 'pending_approval')
                OR (OLD.status = 'pending_approval' AND NEW.status IN ('draft','approved'))
                OR (OLD.status = 'approved' AND NEW.status = 'cancelled')
            )
            BEGIN
                SELECT RAISE(ABORT, 'invalid_project_commitment_status_transition');
            END;

            -- Submission freezes the commercial snapshot.  Approval/return is
            -- allowed to change lifecycle metadata only.
            DROP TRIGGER IF EXISTS trg_project_commitment_pending_snapshot_guard_v1;
            CREATE TRIGGER trg_project_commitment_pending_snapshot_guard_v1
            BEFORE UPDATE ON project_commitments
            WHEN OLD.status = 'pending_approval' AND (
                NEW.id IS NOT OLD.id
                OR NEW.project_id IS NOT OLD.project_id
                OR NEW.baseline_id IS NOT OLD.baseline_id
                OR NEW.source_supplier_offer_id IS NOT OLD.source_supplier_offer_id
                OR NEW.commitment_type IS NOT OLD.commitment_type
                OR NEW.commitment_no IS NOT OLD.commitment_no
                OR NEW.currency_code IS NOT OLD.currency_code
                OR NEW.company_id IS NOT OLD.company_id
                OR NEW.counterparty_name IS NOT OLD.counterparty_name
                OR NEW.document_id IS NOT OLD.document_id
                OR NEW.expected_date IS NOT OLD.expected_date
                OR NEW.reason IS NOT OLD.reason
                OR NEW.created_by IS NOT OLD.created_by
                OR NEW.created_at IS NOT OLD.created_at
                OR NOT (
                    (
                        NEW.status = 'draft'
                        AND NEW.submitted_by IS NULL
                        AND NEW.submitted_at IS NULL
                        AND NEW.approved_by IS NULL
                        AND NEW.approved_at IS NULL
                        AND NEW.cancelled_by IS NULL
                        AND NEW.cancelled_at IS NULL
                        AND NEW.cancellation_reason IS NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                    OR (
                        NEW.status = 'approved'
                        AND NEW.submitted_by IS OLD.submitted_by
                        AND NEW.submitted_at IS OLD.submitted_at
                        AND NEW.approved_by IS NOT NULL
                        AND NEW.approved_at IS NOT NULL
                        AND NEW.cancelled_by IS NULL
                        AND NEW.cancelled_at IS NULL
                        AND NEW.cancellation_reason IS NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                )
            )
            BEGIN
                SELECT RAISE(ABORT, 'pending_project_commitment_snapshot_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_approval_requirements
            BEFORE UPDATE OF status ON project_commitments
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
            BEGIN
                SELECT CASE WHEN NEW.commitment_no IS NULL OR length(trim(NEW.commitment_no)) = 0
                    THEN RAISE(ABORT, 'project_commitment_number_required') END;
                SELECT CASE WHEN NEW.baseline_id IS NULL OR NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines baseline
                    WHERE baseline.id = NEW.baseline_id
                      AND baseline.project_id = NEW.project_id
                      AND baseline.status = 'approved'
                ) THEN RAISE(ABORT, 'approved_financial_baseline_required') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_commitment_lines line WHERE line.commitment_id = NEW.id
                ) THEN RAISE(ABORT, 'project_commitment_lines_required') END;
                SELECT CASE WHEN EXISTS (
                    SELECT 1
                    FROM project_commitment_lines line
                    LEFT JOIN project_budget_lines budget_line ON budget_line.id = line.budget_line_id
                    WHERE line.commitment_id = NEW.id
                      AND (line.budget_line_id IS NULL OR budget_line.baseline_id <> NEW.baseline_id)
                ) THEN RAISE(ABORT, 'project_commitment_budget_mapping_required') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_approved_immutable
            BEFORE UPDATE ON project_commitments
            WHEN OLD.status IN ('approved','cancelled') AND NOT (
                OLD.status = 'approved' AND NEW.status = 'cancelled'
                AND NEW.id IS OLD.id
                AND NEW.project_id IS OLD.project_id
                AND NEW.baseline_id IS OLD.baseline_id
                AND NEW.source_supplier_offer_id IS OLD.source_supplier_offer_id
                AND NEW.commitment_type IS OLD.commitment_type
                AND NEW.commitment_no IS OLD.commitment_no
                AND NEW.currency_code IS OLD.currency_code
                AND NEW.company_id IS OLD.company_id
                AND NEW.counterparty_name IS OLD.counterparty_name
                AND NEW.document_id IS OLD.document_id
                AND NEW.expected_date IS OLD.expected_date
                AND NEW.reason IS OLD.reason
                AND NEW.created_by IS OLD.created_by
                AND NEW.submitted_by IS OLD.submitted_by
                AND NEW.submitted_at IS OLD.submitted_at
                AND NEW.approved_by IS OLD.approved_by
                AND NEW.approved_at IS OLD.approved_at
                AND NEW.created_at IS OLD.created_at
                AND NEW.updated_at >= OLD.updated_at
            )
            BEGIN
                SELECT RAISE(ABORT, 'approved_project_commitment_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_delete_guard
            BEFORE DELETE ON project_commitments
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_cannot_be_deleted');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_line_insert_guard
            BEFORE INSERT ON project_commitment_lines
            BEGIN
                SELECT CASE WHEN COALESCE((
                    SELECT status FROM project_commitments WHERE id = NEW.commitment_id
                ), '') <> 'draft' THEN RAISE(ABORT, 'project_commitment_lines_are_not_editable') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM estimate_items item
                    JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = commitment.project_id
                ) THEN RAISE(ABORT, 'project_commitment_estimate_item_project_mismatch') END;
                SELECT CASE WHEN NEW.supplier_offer_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM supplier_offers offer
                    JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                    WHERE offer.id = NEW.supplier_offer_id AND offer.project_id = commitment.project_id
                      AND (NEW.estimate_item_id IS NULL OR offer.estimate_item_id = NEW.estimate_item_id)
                ) THEN RAISE(ABORT, 'project_commitment_supplier_offer_mismatch') END;
                SELECT CASE WHEN NEW.budget_line_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM project_budget_lines budget_line
                    JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                    WHERE budget_line.id = NEW.budget_line_id
                      AND budget_line.baseline_id = commitment.baseline_id
                ) THEN RAISE(ABORT, 'project_commitment_budget_line_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_line_update_guard
            BEFORE UPDATE ON project_commitment_lines
            BEGIN
                SELECT CASE WHEN COALESCE((
                    SELECT status FROM project_commitments WHERE id = OLD.commitment_id
                ), '') <> 'draft' OR COALESCE((
                    SELECT status FROM project_commitments WHERE id = NEW.commitment_id
                ), '') <> 'draft' THEN RAISE(ABORT, 'project_commitment_lines_are_not_editable') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM estimate_items item
                    JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = commitment.project_id
                ) THEN RAISE(ABORT, 'project_commitment_estimate_item_project_mismatch') END;
                SELECT CASE WHEN NEW.supplier_offer_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM supplier_offers offer
                    JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                    WHERE offer.id = NEW.supplier_offer_id AND offer.project_id = commitment.project_id
                      AND (NEW.estimate_item_id IS NULL OR offer.estimate_item_id = NEW.estimate_item_id)
                ) THEN RAISE(ABORT, 'project_commitment_supplier_offer_mismatch') END;
                SELECT CASE WHEN NEW.budget_line_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM project_budget_lines budget_line
                    JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                    WHERE budget_line.id = NEW.budget_line_id
                      AND budget_line.baseline_id = commitment.baseline_id
                ) THEN RAISE(ABORT, 'project_commitment_budget_line_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_line_delete_guard
            BEFORE DELETE ON project_commitment_lines
            WHEN COALESCE((SELECT status FROM project_commitments WHERE id = OLD.commitment_id), '') <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_lines_are_not_editable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_line_direct_budget_insert_guard
            BEFORE INSERT ON project_commitment_lines
            WHEN NEW.budget_line_id IS NOT NULL AND NOT EXISTS (
                SELECT 1
                FROM project_budget_lines budget_line
                JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.baseline_id = commitment.baseline_id
                  AND budget_line.line_type = 'direct_cost'
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_direct_budget_required');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_line_direct_budget_update_guard
            BEFORE UPDATE OF commitment_id, budget_line_id ON project_commitment_lines
            WHEN NEW.budget_line_id IS NOT NULL AND NOT EXISTS (
                SELECT 1
                FROM project_budget_lines budget_line
                JOIN project_commitments commitment ON commitment.id = NEW.commitment_id
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.baseline_id = commitment.baseline_id
                  AND budget_line.line_type = 'direct_cost'
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_direct_budget_required');
            END;

            DROP TRIGGER IF EXISTS trg_project_commitment_line_unit_insert_guard_v1;
            CREATE TRIGGER trg_project_commitment_line_unit_insert_guard_v1
            BEFORE INSERT ON project_commitment_lines
            WHEN NEW.budget_line_id IS NOT NULL AND EXISTS (
                SELECT 1
                FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.quantity IS NOT NULL
                  AND budget_line.quantity > 0
                  AND lower(trim(COALESCE(NEW.unit, '')))
                      <> lower(trim(COALESCE(budget_line.unit, '')))
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_operational_unit_mismatch');
            END;

            DROP TRIGGER IF EXISTS trg_project_commitment_line_unit_update_guard_v1;
            CREATE TRIGGER trg_project_commitment_line_unit_update_guard_v1
            BEFORE UPDATE OF commitment_id, budget_line_id, unit ON project_commitment_lines
            WHEN NEW.budget_line_id IS NOT NULL AND EXISTS (
                SELECT 1
                FROM project_budget_lines budget_line
                WHERE budget_line.id = NEW.budget_line_id
                  AND budget_line.quantity IS NOT NULL
                  AND budget_line.quantity > 0
                  AND lower(trim(COALESCE(NEW.unit, '')))
                      <> lower(trim(COALESCE(budget_line.unit, '')))
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_operational_unit_mismatch');
            END;

            DROP TRIGGER IF EXISTS trg_project_commitment_unit_approval_guard_v1;
            CREATE TRIGGER trg_project_commitment_unit_approval_guard_v1
            BEFORE UPDATE OF status ON project_commitments
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved' AND EXISTS (
                SELECT 1
                FROM project_commitment_lines line
                JOIN project_budget_lines budget_line ON budget_line.id = line.budget_line_id
                WHERE line.commitment_id = NEW.id
                  AND budget_line.quantity IS NOT NULL
                  AND budget_line.quantity > 0
                  AND lower(trim(COALESCE(line.unit, '')))
                      <> lower(trim(COALESCE(budget_line.unit, '')))
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_operational_unit_mismatch');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_direct_budget_approval_guard
            BEFORE UPDATE OF status ON project_commitments
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved' AND EXISTS (
                SELECT 1
                FROM project_commitment_lines line
                LEFT JOIN project_budget_lines budget_line ON budget_line.id = line.budget_line_id
                WHERE line.commitment_id = NEW.id
                  AND (budget_line.id IS NULL OR budget_line.line_type <> 'direct_cost')
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_direct_budget_required');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_event_insert_guard
            BEFORE INSERT ON project_commitment_events
            WHEN NOT EXISTS (
                SELECT 1 FROM project_commitments commitment
                WHERE commitment.id = NEW.commitment_id AND commitment.project_id = NEW.project_id
            )
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_event_project_mismatch');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_event_update_guard
            BEFORE UPDATE ON project_commitment_events
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_project_commitment_event_delete_guard
            BEFORE DELETE ON project_commitment_events
            BEGIN
                SELECT RAISE(ABORT, 'project_commitment_event_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_insert_draft_only
            BEFORE INSERT ON project_financial_baselines
            WHEN NEW.status <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'financial_baseline_must_start_as_draft');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_identity_immutable
            BEFORE UPDATE OF project_id, version_no ON project_financial_baselines
            WHEN NEW.project_id IS NOT OLD.project_id OR NEW.version_no IS NOT OLD.version_no
            BEGIN
                SELECT RAISE(ABORT, 'financial_baseline_identity_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_status_transition
            BEFORE UPDATE OF status ON project_financial_baselines
            WHEN OLD.status <> NEW.status AND NOT (
                (OLD.status = 'draft' AND NEW.status = 'pending_approval')
                OR (OLD.status = 'pending_approval' AND NEW.status IN ('draft','approved'))
                OR (OLD.status = 'approved' AND NEW.status = 'superseded')
            )
            BEGIN
                SELECT RAISE(ABORT, 'invalid_financial_baseline_status_transition');
            END;

            -- Freeze the submitted baseline header along with its already
            -- protected lines.  effective_from may only be filled (not changed)
            -- by the approval transition for compatibility with legacy drafts.
            DROP TRIGGER IF EXISTS trg_financial_baseline_pending_snapshot_guard_v1;
            CREATE TRIGGER trg_financial_baseline_pending_snapshot_guard_v1
            BEFORE UPDATE ON project_financial_baselines
            WHEN OLD.status = 'pending_approval' AND (
                NEW.id IS NOT OLD.id
                OR NEW.project_id IS NOT OLD.project_id
                OR NEW.version_no IS NOT OLD.version_no
                OR NEW.currency_code IS NOT OLD.currency_code
                OR NEW.source_snapshot_hash IS NOT OLD.source_snapshot_hash
                OR NEW.source_document_id IS NOT OLD.source_document_id
                OR (
                    NEW.effective_from IS NOT OLD.effective_from
                    AND NOT (
                        NEW.status = 'approved'
                        AND OLD.effective_from IS NULL
                        AND NEW.effective_from IS NOT NULL
                        AND length(trim(NEW.effective_from)) > 0
                    )
                )
                OR NEW.reason IS NOT OLD.reason
                OR NEW.created_by IS NOT OLD.created_by
                OR NEW.created_at IS NOT OLD.created_at
                OR NOT (
                    (
                        NEW.status = 'draft'
                        AND NEW.submitted_by IS NULL
                        AND NEW.submitted_at IS NULL
                        AND NEW.approved_by IS NULL
                        AND NEW.approved_at IS NULL
                        AND NEW.superseded_by_baseline_id IS NULL
                        AND NEW.superseded_at IS NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                    OR (
                        NEW.status = 'approved'
                        AND NEW.submitted_by IS OLD.submitted_by
                        AND NEW.submitted_at IS OLD.submitted_at
                        AND NEW.approved_by IS NOT NULL
                        AND NEW.approved_at IS NOT NULL
                        AND NEW.superseded_by_baseline_id IS NULL
                        AND NEW.superseded_at IS NULL
                        AND NEW.updated_at >= OLD.updated_at
                    )
                )
            )
            BEGIN
                SELECT RAISE(ABORT, 'pending_financial_baseline_snapshot_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_approval_requires_lines
            BEFORE UPDATE OF status ON project_financial_baselines
            WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_revenue_lines WHERE baseline_id = NEW.id
                ) THEN RAISE(ABORT, 'financial_baseline_revenue_lines_required') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_budget_lines WHERE baseline_id = NEW.id
                ) THEN RAISE(ABORT, 'financial_baseline_budget_lines_required') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_supersession_target
            BEFORE UPDATE OF status ON project_financial_baselines
            WHEN NEW.status = 'superseded' AND OLD.status <> 'superseded'
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1
                    FROM project_financial_baselines replacement
                    WHERE replacement.id = NEW.superseded_by_baseline_id
                      AND replacement.project_id = OLD.project_id
                      AND replacement.version_no > OLD.version_no
                ) THEN RAISE(ABORT, 'invalid_financial_baseline_supersession_target') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_approved_immutable
            BEFORE UPDATE ON project_financial_baselines
            WHEN OLD.status IN ('approved','superseded') AND NOT (
                OLD.status = 'approved' AND NEW.status = 'superseded'
                AND NEW.id IS OLD.id
                AND NEW.project_id IS OLD.project_id
                AND NEW.version_no IS OLD.version_no
                AND NEW.currency_code IS OLD.currency_code
                AND NEW.source_snapshot_hash IS OLD.source_snapshot_hash
                AND NEW.source_document_id IS OLD.source_document_id
                AND NEW.effective_from IS OLD.effective_from
                AND NEW.reason IS OLD.reason
                AND NEW.created_by IS OLD.created_by
                AND NEW.submitted_by IS OLD.submitted_by
                AND NEW.submitted_at IS OLD.submitted_at
                AND NEW.approved_by IS OLD.approved_by
                AND NEW.approved_at IS OLD.approved_at
                AND NEW.created_at IS OLD.created_at
                AND NEW.updated_at >= OLD.updated_at
            )
            BEGIN
                SELECT RAISE(ABORT, 'approved_financial_baseline_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_delete_guard
            BEFORE DELETE ON project_financial_baselines
            WHEN OLD.status <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'non_draft_financial_baseline_cannot_be_deleted');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_financial_baseline_delete_successor_cleanup
            BEFORE DELETE ON project_financial_baselines
            WHEN OLD.status = 'draft'
            BEGIN
                DELETE FROM project_budget_line_successors WHERE to_baseline_id = OLD.id;
                DELETE FROM project_revenue_line_successors WHERE to_baseline_id = OLD.id;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_revenue_line_insert_guard
            BEFORE INSERT ON project_revenue_lines
            BEGIN
                SELECT CASE WHEN COALESCE((
                    SELECT status FROM project_financial_baselines WHERE id = NEW.baseline_id
                ), '') <> 'draft' THEN RAISE(ABORT, 'financial_baseline_lines_are_not_editable') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM estimate_items item
                    JOIN project_financial_baselines baseline ON baseline.id = NEW.baseline_id
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = baseline.project_id
                ) THEN RAISE(ABORT, 'financial_baseline_estimate_item_project_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_revenue_line_update_guard
            BEFORE UPDATE ON project_revenue_lines
            BEGIN
                SELECT CASE WHEN COALESCE((
                    SELECT status FROM project_financial_baselines WHERE id = OLD.baseline_id
                ), '') <> 'draft' OR COALESCE((
                    SELECT status FROM project_financial_baselines WHERE id = NEW.baseline_id
                ), '') <> 'draft' THEN RAISE(ABORT, 'financial_baseline_lines_are_not_editable') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM estimate_items item
                    JOIN project_financial_baselines baseline ON baseline.id = NEW.baseline_id
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = baseline.project_id
                ) THEN RAISE(ABORT, 'financial_baseline_estimate_item_project_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_revenue_line_delete_guard
            BEFORE DELETE ON project_revenue_lines
            WHEN COALESCE((SELECT status FROM project_financial_baselines WHERE id = OLD.baseline_id), '') <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'financial_baseline_lines_are_not_editable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_revenue_line_delete_successor_cleanup
            AFTER DELETE ON project_revenue_lines
            BEGIN
                DELETE FROM project_revenue_line_successors
                WHERE source_revenue_line_id = OLD.id OR target_revenue_line_id = OLD.id;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_budget_line_insert_guard
            BEFORE INSERT ON project_budget_lines
            BEGIN
                SELECT CASE WHEN COALESCE((
                    SELECT status FROM project_financial_baselines WHERE id = NEW.baseline_id
                ), '') <> 'draft' THEN RAISE(ABORT, 'financial_baseline_lines_are_not_editable') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM estimate_items item
                    JOIN project_financial_baselines baseline ON baseline.id = NEW.baseline_id
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = baseline.project_id
                ) THEN RAISE(ABORT, 'financial_baseline_estimate_item_project_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_budget_line_update_guard
            BEFORE UPDATE ON project_budget_lines
            BEGIN
                SELECT CASE WHEN COALESCE((
                    SELECT status FROM project_financial_baselines WHERE id = OLD.baseline_id
                ), '') <> 'draft' OR COALESCE((
                    SELECT status FROM project_financial_baselines WHERE id = NEW.baseline_id
                ), '') <> 'draft' THEN RAISE(ABORT, 'financial_baseline_lines_are_not_editable') END;
                SELECT CASE WHEN NEW.estimate_item_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1
                    FROM estimate_items item
                    JOIN project_financial_baselines baseline ON baseline.id = NEW.baseline_id
                    WHERE item.id = NEW.estimate_item_id AND item.project_id = baseline.project_id
                ) THEN RAISE(ABORT, 'financial_baseline_estimate_item_project_mismatch') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_budget_line_delete_guard
            BEFORE DELETE ON project_budget_lines
            WHEN COALESCE((SELECT status FROM project_financial_baselines WHERE id = OLD.baseline_id), '') <> 'draft'
            BEGIN
                SELECT RAISE(ABORT, 'financial_baseline_lines_are_not_editable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_budget_line_delete_successor_cleanup
            AFTER DELETE ON project_budget_lines
            BEGIN
                DELETE FROM project_budget_line_successors
                WHERE source_budget_line_id = OLD.id OR target_budget_line_id = OLD.id;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_budget_line_successor_insert_guard
            BEFORE INSERT ON project_budget_line_successors
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1
                    FROM project_financial_baselines source
                    JOIN project_financial_baselines target
                      ON target.id = NEW.to_baseline_id
                    WHERE source.id = NEW.from_baseline_id
                      AND source.project_id = NEW.project_id
                      AND target.project_id = NEW.project_id
                      AND source.status = 'approved'
                      AND target.status = 'draft'
                      AND target.version_no > source.version_no
                ) THEN RAISE(ABORT, 'invalid_budget_successor_baselines') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_budget_lines source
                    WHERE source.id = NEW.source_budget_line_id
                      AND source.baseline_id = NEW.from_baseline_id
                      AND source.line_type = 'direct_cost'
                ) THEN RAISE(ABORT, 'invalid_source_budget_line') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_budget_lines target
                    WHERE target.id = NEW.target_budget_line_id
                      AND target.baseline_id = NEW.to_baseline_id
                      AND target.line_type = 'direct_cost'
                ) THEN RAISE(ABORT, 'invalid_target_budget_line') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_budget_line_successor_update_guard
            BEFORE UPDATE ON project_budget_line_successors
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines
                    WHERE id = OLD.to_baseline_id AND status = 'draft'
                ) THEN RAISE(ABORT, 'baseline_successor_mapping_is_immutable') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1
                    FROM project_financial_baselines source
                    JOIN project_financial_baselines target
                      ON target.id = NEW.to_baseline_id
                    WHERE source.id = NEW.from_baseline_id
                      AND source.project_id = NEW.project_id
                      AND target.project_id = NEW.project_id
                      AND source.status = 'approved'
                      AND target.status = 'draft'
                      AND target.version_no > source.version_no
                ) THEN RAISE(ABORT, 'invalid_budget_successor_baselines') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_budget_lines source
                    WHERE source.id = NEW.source_budget_line_id
                      AND source.baseline_id = NEW.from_baseline_id
                      AND source.line_type = 'direct_cost'
                ) THEN RAISE(ABORT, 'invalid_source_budget_line') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_budget_lines target
                    WHERE target.id = NEW.target_budget_line_id
                      AND target.baseline_id = NEW.to_baseline_id
                      AND target.line_type = 'direct_cost'
                ) THEN RAISE(ABORT, 'invalid_target_budget_line') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_budget_line_successor_delete_guard
            BEFORE DELETE ON project_budget_line_successors
            WHEN EXISTS (
                SELECT 1 FROM project_financial_baselines
                WHERE id = OLD.to_baseline_id AND status <> 'draft'
            )
            BEGIN
                SELECT RAISE(ABORT, 'baseline_successor_mapping_is_immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS trg_revenue_line_successor_insert_guard
            BEFORE INSERT ON project_revenue_line_successors
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1
                    FROM project_financial_baselines source
                    JOIN project_financial_baselines target
                      ON target.id = NEW.to_baseline_id
                    WHERE source.id = NEW.from_baseline_id
                      AND source.project_id = NEW.project_id
                      AND target.project_id = NEW.project_id
                      AND source.status = 'approved'
                      AND target.status = 'draft'
                      AND target.version_no > source.version_no
                ) THEN RAISE(ABORT, 'invalid_revenue_successor_baselines') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_revenue_lines source
                    WHERE source.id = NEW.source_revenue_line_id
                      AND source.baseline_id = NEW.from_baseline_id
                ) THEN RAISE(ABORT, 'invalid_source_revenue_line') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_revenue_lines target
                    WHERE target.id = NEW.target_revenue_line_id
                      AND target.baseline_id = NEW.to_baseline_id
                ) THEN RAISE(ABORT, 'invalid_target_revenue_line') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_revenue_line_successor_update_guard
            BEFORE UPDATE ON project_revenue_line_successors
            BEGIN
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_financial_baselines
                    WHERE id = OLD.to_baseline_id AND status = 'draft'
                ) THEN RAISE(ABORT, 'baseline_successor_mapping_is_immutable') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1
                    FROM project_financial_baselines source
                    JOIN project_financial_baselines target
                      ON target.id = NEW.to_baseline_id
                    WHERE source.id = NEW.from_baseline_id
                      AND source.project_id = NEW.project_id
                      AND target.project_id = NEW.project_id
                      AND source.status = 'approved'
                      AND target.status = 'draft'
                      AND target.version_no > source.version_no
                ) THEN RAISE(ABORT, 'invalid_revenue_successor_baselines') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_revenue_lines source
                    WHERE source.id = NEW.source_revenue_line_id
                      AND source.baseline_id = NEW.from_baseline_id
                ) THEN RAISE(ABORT, 'invalid_source_revenue_line') END;
                SELECT CASE WHEN NOT EXISTS (
                    SELECT 1 FROM project_revenue_lines target
                    WHERE target.id = NEW.target_revenue_line_id
                      AND target.baseline_id = NEW.to_baseline_id
                ) THEN RAISE(ABORT, 'invalid_target_revenue_line') END;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_revenue_line_successor_delete_guard
            BEFORE DELETE ON project_revenue_line_successors
            WHEN EXISTS (
                SELECT 1 FROM project_financial_baselines
                WHERE id = OLD.to_baseline_id AND status <> 'draft'
            )
            BEGIN
                SELECT RAISE(ABORT, 'baseline_successor_mapping_is_immutable');
            END;

            CREATE TABLE IF NOT EXISTS daily_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                report_date TEXT NOT NULL,
                title TEXT NOT NULL,
                work_done TEXT NOT NULL DEFAULT '',
                workers_count INTEGER NOT NULL DEFAULT 0,
                equipment TEXT NOT NULL DEFAULT '',
                blockers TEXT NOT NULL DEFAULT '',
                next_steps TEXT NOT NULL DEFAULT '',
                progress_percent REAL,
                raw_input TEXT,
                is_client_visible INTEGER NOT NULL DEFAULT 1,
                client_request_id TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS daily_log_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE RESTRICT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL CHECK(action_type IN (
                    'material_purchase', 'material_receipt', 'material_use'
                )),
                estimate_item_id INTEGER NOT NULL REFERENCES estimate_items(id) ON DELETE RESTRICT,
                material_title_snapshot TEXT NOT NULL,
                material_unit_snapshot TEXT NOT NULL,
                qty REAL NOT NULL CHECK(qty > 0),
                client_action_id TEXT NOT NULL,
                stock_move_id INTEGER NOT NULL UNIQUE REFERENCES stock_moves(id) ON DELETE RESTRICT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(project_id, client_action_id)
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                entity TEXT,
                entity_id INTEGER,
                payload TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS market_analysis_cache (
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK(kind IN ('material', 'work')),
                status TEXT NOT NULL CHECK(status IN ('pending', 'ready', 'error')),
                payload TEXT NOT NULL DEFAULT '{}',
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (project_id, kind)
            );

            CREATE TABLE IF NOT EXISTS market_price_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                estimate_item_id INTEGER REFERENCES estimate_items(id) ON DELETE SET NULL,
                estimate_item_title TEXT NOT NULL,
                item_kind TEXT NOT NULL CHECK(item_kind IN ('material', 'work')),
                estimate_version TEXT NOT NULL,
                source_estimate_id TEXT NOT NULL,
                price REAL NOT NULL,
                source_name TEXT,
                source_url TEXT,
                source_payload TEXT NOT NULL DEFAULT '[]',
                analyzed_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
            """
        )

        migrate_users_table(con)
        repair_legacy_user_references(con)

        ensure_columns(
            con,
            "users",
            {
                "email": "TEXT",
                "phone": "TEXT",
                "first_name": "TEXT",
                "last_name": "TEXT",
                "clerk_user_id": "TEXT",
                "avatar_url": "TEXT",
                "status": "TEXT NOT NULL DEFAULT 'active'",
                "is_deleted": "INTEGER NOT NULL DEFAULT 0",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "roles",
            {
                "permissions": "TEXT",
            },
        )

        for row in con.execute("SELECT id, name, first_name, last_name FROM users").fetchall():
            first_name, last_name = split_user_name(row["name"], row["first_name"], row["last_name"])
            if first_name != (row["first_name"] or "") or last_name != (row["last_name"] or ""):
                con.execute(
                    "UPDATE users SET first_name = ?, last_name = ?, updated_at = COALESCE(updated_at, ?) WHERE id = ?",
                    (first_name, last_name, now_ts(), row["id"]),
                )

        ensure_columns(
            con,
            "projects",
            {
                "client_id": "INTEGER REFERENCES clients(id) ON DELETE SET NULL",
                "customer_company_id": "INTEGER REFERENCES companies(id) ON DELETE SET NULL",
                "own_legal_entity_id": "INTEGER REFERENCES companies(id) ON DELETE SET NULL",
                "city": "TEXT",
                "region": "TEXT",
                "contract_no": "TEXT",
                "contract_date": "TEXT",
                "director_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "foreman_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "buyer_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "client_user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "budget": "REAL NOT NULL DEFAULT 0",
                "paid": "REAL NOT NULL DEFAULT 0",
                "spent": "REAL NOT NULL DEFAULT 0",
                "internal_schedule_status": "TEXT NOT NULL DEFAULT 'draft'",
                "internal_schedule_version": "INTEGER NOT NULL DEFAULT 1",
                "internal_schedule_approved_at": "TEXT",
                "customer_schedule_status": "TEXT NOT NULL DEFAULT 'draft'",
                "customer_schedule_version": "INTEGER NOT NULL DEFAULT 1",
                "customer_schedule_approved_at": "TEXT",
                "schedule_generated_at": "TEXT",
                "description": "TEXT",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "finance_entries",
            {
                "category": "TEXT",
                "payment_kind": "TEXT NOT NULL DEFAULT 'cash'",
                "vat_percent": "REAL NOT NULL DEFAULT 0",
                "planned_date": "TEXT",
                "paid_date": "TEXT",
                "counterparty_name": "TEXT",
                "company_id": "INTEGER REFERENCES companies(id) ON DELETE SET NULL",
                "document_id": "INTEGER REFERENCES documents(id) ON DELETE SET NULL",
                "status": "TEXT NOT NULL DEFAULT 'planned'",
                "notes": "TEXT",
                "created_by": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "documents",
            {
                "original_name": "TEXT",
                "storage_name": "TEXT",
                "storage_path": "TEXT",
                "mime_type": "TEXT",
                "file_ext": "TEXT",
                "size_bytes": "INTEGER",
                "notes": "TEXT",
                "uploaded_by": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "stage_id": "INTEGER REFERENCES work_stages(id) ON DELETE SET NULL",
                "template_code": "TEXT",
                "generated_by_system": "INTEGER NOT NULL DEFAULT 0",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "estimate_items",
            {
                "stage_id": "INTEGER REFERENCES work_stages(id) ON DELETE SET NULL",
                "item_kind": "TEXT NOT NULL DEFAULT 'material'",
                "section_title": "TEXT",
                "article": "TEXT",
                "procurement_status": "TEXT NOT NULL DEFAULT 'Купить'",
                "warehouse_source": "TEXT",
                "warehouse_item_id": "INTEGER REFERENCES warehouse_items(id) ON DELETE SET NULL",
                "delivery_days": "INTEGER",
                "need_by_date": "TEXT",
                "notes": "TEXT",
                "is_completed": "INTEGER NOT NULL DEFAULT 0",
                "actual_qty": "REAL NOT NULL DEFAULT 0",
                "labor_hours_total": "REAL",
                "default_crew_size": "INTEGER",
                "updated_at": "INTEGER",
            },
        )
        ensure_project_estimates_schema(con)

        con.execute(
            """
            INSERT OR IGNORE INTO production_schedule_slot_overrides (
                project_id, estimate_item_id, slot_number, is_filled, updated_by, created_at, updated_at
            )
            SELECT project_id, estimate_item_id, day_number * 2 - 1, is_filled, updated_by, created_at, updated_at
            FROM production_schedule_cell_overrides
            """
        )
        con.execute(
            """
            INSERT OR IGNORE INTO production_schedule_slot_overrides (
                project_id, estimate_item_id, slot_number, is_filled, updated_by, created_at, updated_at
            )
            SELECT project_id, estimate_item_id, day_number * 2, is_filled, updated_by, created_at, updated_at
            FROM production_schedule_cell_overrides
            """
        )

        ensure_columns(
            con,
            "warehouse_items",
            {
                "item_type": "TEXT NOT NULL DEFAULT 'material'",
                "category": "TEXT",
                "name": "TEXT NOT NULL DEFAULT ''",
                "sku": "TEXT",
                "unit": "TEXT NOT NULL DEFAULT 'шт'",
                "qty": "REAL NOT NULL DEFAULT 0",
                "condition_status": "TEXT",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "work_stages",
            {
                "parent_id": "INTEGER",
                "stage_kind": "TEXT NOT NULL DEFAULT 'section'",
                "status_code": "TEXT NOT NULL DEFAULT 'not_started'",
                "customer_start": "TEXT",
                "customer_end": "TEXT",
                "notes": "TEXT",
                "is_client_visible": "INTEGER NOT NULL DEFAULT 1",
                "updated_at": "INTEGER",
            },
        )

        ensure_columns(
            con,
            "tasks",
            {
                "updated_at": "INTEGER",
                "completed_at": "TEXT",
            },
        )

        ensure_columns(
            con,
            "daily_logs",
            {
                "progress_percent": "REAL",
                "raw_input": "TEXT",
                "updated_at": "INTEGER",
            },
        )

        for code in ROLE_CODES:
            permissions = json.dumps(default_permissions_for_role(code), ensure_ascii=False)
            con.execute(
                """
                INSERT INTO roles (code, name, description, permissions)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    permissions = COALESCE(roles.permissions, excluded.permissions)
                """,
                (code, ROLE_LABELS[code], ROLE_DESCRIPTIONS.get(code, ""), permissions),
            )

        for row in con.execute("SELECT id, permissions FROM roles").fetchall():
            permissions = normalize_permissions(row["permissions"], "")
            modules = list(permissions.get("modules") or [])
            if "users" not in modules:
                modules.append("users")
                permissions["modules"] = modules
                con.execute(
                    "UPDATE roles SET permissions = ? WHERE id = ?",
                    (json.dumps(permissions, ensure_ascii=False), row["id"]),
                )

        user_rows = con.execute("SELECT id, role FROM users").fetchall()
        for row in user_rows:
            role_code = row["role"]
            role = con.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
            if role:
                con.execute(
                    """
                    INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (row["id"], role["id"], now_ts()),
                )

        bootstrap_admin = con.execute("SELECT id FROM users WHERE lower(login) = 'admin'").fetchone()
        if bootstrap_admin:
            admin_role = con.execute("SELECT id FROM roles WHERE code = 'admin'").fetchone()
            con.execute(
                "UPDATE users SET role = 'admin', updated_at = ? WHERE id = ? AND role <> 'admin'",
                (now_ts(), bootstrap_admin["id"]),
            )
            con.execute(
                """
                DELETE FROM user_roles
                WHERE user_id = ?
                  AND role_id NOT IN (SELECT id FROM roles WHERE code = 'admin')
                """,
                (bootstrap_admin["id"],),
            )
            if admin_role:
                con.execute(
                    """
                    INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (bootstrap_admin["id"], admin_role["id"], now_ts()),
                )

        if table_exists(con, "projects") and table_exists(con, "object_assignments"):
            con.execute(
                """
                INSERT OR IGNORE INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
                SELECT id, foreman_id, 'foreman', 'РџСЂРѕСЂР°Р± РѕР±СЉРµРєС‚Р°', 1, director_id, COALESCE(created_at, ?)
                FROM projects
                WHERE foreman_id IS NOT NULL
                """,
                (now_ts(),),
            )
            con.execute(
                """
                INSERT OR IGNORE INTO user_project_access (user_id, project_id)
                SELECT foreman_id, id
                FROM projects
                WHERE foreman_id IS NOT NULL
                """
            )

        user_count = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if user_count == 0:
            bootstrap_password = os.environ.get("PMBI_ADMIN_PASSWORD") or secrets.token_urlsafe(18)
            admin_cur = con.execute(
                """
                INSERT INTO users (login, password_hash, role, first_name, last_name, name, status, created_at, updated_at)
                VALUES (?, ?, 'admin', 'Главный', 'Администратор', 'Главный администратор', 'active', ?, ?)
                """,
                ("admin", hash_password(bootstrap_password), now_ts(), now_ts()),
            )
            admin_role = con.execute("SELECT id FROM roles WHERE code = 'admin'").fetchone()
            if admin_role:
                con.execute(
                    """
                    INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (admin_cur.lastrowid, admin_role["id"], now_ts()),
                )
            con.commit()
            BOOTSTRAP_PATH.write_text(
                "PM.bi initial admin\n"
                "login: admin\n"
                f"password: {bootstrap_password}\n\n"
                "Delete this file after creating your real users.\n",
                encoding="utf-8",
            )

        migrate_supplier_offer_tracking(con)
        ensure_legacy_economics_schema(con)
        ensure_estimate_reconciliation_schema(con)
        ensure_warehouse_control_schema(con)
        ensure_daily_log_actions_schema(con)
        ensure_sqlite_indexes(con)
        con.commit()



















































def normalize_market_title_key(value: str | None) -> str:
    text = str(value or "").strip().lower().replace("ё", "е")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[^0-9a-zа-я]+", " ", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def calculate_margin_percent(estimate_price: object, entered_price: object | None) -> float | None:
    """Return the unit-price margin percentage used by the price table."""
    if entered_price is None:
        return None
    try:
        estimate_value = float(estimate_price or 0)
        entered_value = float(entered_price)
    except (TypeError, ValueError):
        return None
    if estimate_value == 0:
        return None
    return round(((estimate_value - entered_value) / estimate_value) * 100, 2)


def estimate_source_version(con: sqlite3.Connection, project_id: int) -> str:
    """Content fingerprint of the estimate revision used for market analysis."""
    rows = con.execute(
        """
        SELECT title, unit, planned_qty, planned_price, item_kind, section_title, article
        FROM estimate_items
        WHERE project_id = ?
        ORDER BY id
        """,
        (project_id,),
    ).fetchall()
    normalized = [
        [
            str(row["title"] or ""),
            str(row["unit"] or ""),
            float(row["planned_qty"] or 0),
            float(row["planned_price"] or 0),
            normalize_estimate_item_kind(row["item_kind"]),
            str(row["section_title"] or ""),
            str(row["article"] or ""),
        ]
        for row in rows
    ]
    source = json.dumps(normalized, ensure_ascii=False, separators=(",", ":"))
    return f"sha256:{hashlib.sha256(source.encode('utf-8')).hexdigest()[:16]}"


def market_source_from_offers(offers: list[dict], market_price: object) -> dict:
    if not offers:
        return {}
    chosen = None
    try:
        price_value = float(market_price)
    except (TypeError, ValueError):
        price_value = None
    if price_value is not None:
        for offer in offers:
            try:
                if offer.get("price") is not None and float(offer["price"]) == price_value:
                    chosen = offer
                    break
            except (TypeError, ValueError):
                continue
    chosen = chosen or offers[0]
    return {
        "name": str(chosen.get("domain") or chosen.get("title") or "AutoBot").strip() or "AutoBot",
        "url": str(chosen.get("url") or "").strip(),
    }


def latest_market_price_snapshots(
    con: sqlite3.Connection,
    project_id: int,
    kind: str,
) -> dict[int, dict]:
    rows = con.execute(
        """
        SELECT snapshot.*
        FROM market_price_snapshots snapshot
        JOIN (
            SELECT estimate_item_id, MAX(id) AS latest_id
            FROM market_price_snapshots
            WHERE project_id = ? AND item_kind = ? AND estimate_item_id IS NOT NULL
            GROUP BY estimate_item_id
        ) latest ON latest.latest_id = snapshot.id
        """,
        (project_id, kind),
    ).fetchall()
    return {int(row["estimate_item_id"]): dict(row) for row in rows}


def active_supplier_offer_map(con: sqlite3.Connection, project_id: int) -> dict[int, dict]:
    rows = con.execute(
        """
        SELECT so.*, creator.name AS entered_by_name, activator.name AS activated_by_name
        FROM supplier_offers so
        LEFT JOIN users creator ON creator.id = so.created_by
        LEFT JOIN users activator ON activator.id = so.activated_by
        WHERE so.project_id = ?
          AND so.estimate_item_id IS NOT NULL
          AND so.status = 'selected'
        ORDER BY COALESCE(so.activated_at, so.updated_at, so.created_at) DESC, so.id DESC
        """,
        (project_id,),
    ).fetchall()
    result: dict[int, dict] = {}
    for row in rows:
        item_id = int(row["estimate_item_id"])
        if item_id not in result:
            result[item_id] = dict(row)
    return result


def enrich_market_rows_with_active_offers(
    con: sqlite3.Connection,
    project_id: int,
    rows: list[dict],
) -> list[dict]:
    active_offers = active_supplier_offer_map(con, project_id)
    procurement_limits = approved_procurement_limit_map(con, project_id)
    for row in rows:
        item_id = int(row.get("estimateItemId") or 0)
        offer = active_offers.get(item_id)
        entered_price = float(offer["price"] or 0) if offer else None
        offer_quantity = (
            float(offer["qty"] or row.get("plannedQty") or 0)
            if offer
            else None
        )
        row["enteredPrice"] = entered_price
        row["marginPercent"] = calculate_margin_percent(row.get("estimateUnitPrice"), entered_price)
        row["procurementLimit"] = evaluate_procurement_limit(
            procurement_limits.get(item_id),
            entered_price,
            offer_quantity,
        )
        row["activeOffer"] = (
            {
                "id": int(offer["id"]),
                "candidateName": str(offer.get("candidate_name") or ""),
                "sourceType": str(offer.get("source_type") or ""),
                "sourceUrl": str(offer.get("source_url") or ""),
                "enteredBy": str(offer.get("entered_by_name") or ""),
                "enteredAt": offer.get("created_at"),
                "activatedBy": str(offer.get("activated_by_name") or ""),
                "activatedAt": offer.get("activated_at"),
                "quantity": offer_quantity,
            }
            if offer
            else None
        )
    return rows


def save_market_price_snapshots(con: sqlite3.Connection, payload: dict) -> int:
    saved = 0
    for row in payload.get("rows") or []:
        if not row.get("marketPriceIsFresh") or row.get("marketPrice") is None:
            continue
        source = row.get("marketSource") or {}
        con.execute(
            """
            INSERT INTO market_price_snapshots (
                project_id, estimate_item_id, estimate_item_title, item_kind,
                estimate_version, source_estimate_id, price, source_name, source_url,
                source_payload, analyzed_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(payload["projectId"]),
                int(row["estimateItemId"]),
                str(row.get("title") or ""),
                str(payload.get("kind") or "material"),
                str(row.get("marketEstimateVersion") or payload.get("estimateVersion") or ""),
                str(payload.get("estimateId") or ""),
                float(row["marketPrice"]),
                str(source.get("name") or "AutoBot"),
                str(source.get("url") or "") or None,
                json.dumps(row.get("sources") or [], ensure_ascii=False),
                int(row.get("marketAnalyzedAt") or payload.get("analyzedAt") or now_ts()),
                now_ts(),
            ),
        )
        saved += 1
    return saved


def extract_estimate_id_from_project(project: sqlite3.Row | dict) -> str | None:
    contract_no = str(payload_get(project, "contract_no") or "")
    match = re.search(r"ESTIMATE-([A-Za-z0-9]+)", contract_no)
    if match:
        return match.group(1)
    description = str(payload_get(project, "description") or "")
    match = re.search(r"/estimates/([A-Za-z0-9]+)", description)
    if match:
        return match.group(1)
    return None


def estimate_position_from_notes(notes: str | None, estimate_id: str | None = None) -> int | None:
    raw = str(notes or "")
    if not raw:
        return None
    patterns = []
    if estimate_id:
        patterns.append(re.escape(estimate_id) + r";\s*[^;]*:\s*(\d+)")
    patterns.append(r";\s*[^;]*:\s*(\d+);\s*[^;]*Excel")
    for pattern in patterns:
        match = re.search(pattern, raw, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except (TypeError, ValueError):
                pass
    return None


def strip_html_fragment(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_money_value(value: str | None) -> float | None:
    raw = str(value or "").strip().lower()
    if not raw or raw in {"—", "-", "nan", "none"}:
        return None
    raw = raw.replace("\xa0", " ").replace("₽", "").replace("руб.", "").replace("руб", "")
    raw = re.sub(r"[^0-9,.; -]", "", raw)
    numbers = []
    for chunk in re.split(r"[;|/]", raw):
        cleaned = chunk.replace(" ", "").replace(",", ".")
        if not cleaned:
            continue
        try:
            numbers.append(float(cleaned))
        except ValueError:
            continue
    if not numbers:
        return None
    return min(numbers)


def offer_domain_label(url: str | None) -> str:
    try:
        host = urllib.parse.urlparse(str(url or "")).netloc.lower()
    except ValueError:
        return ""
    return host.removeprefix("www.")


def parse_market_view_html(html_text: str, market_type: str) -> list[dict]:
    articles = re.findall(r"<article class=\"item\">(.*?)</article>", html_text, flags=re.S | re.I)
    rows: list[dict] = []
    for article in articles:
        title_match = re.search(r"<div class=\"item-title\">(.*?)</div>", article, flags=re.S | re.I)
        index_match = re.search(r"<div class=\"item-index\">(.*?)</div>", article, flags=re.S | re.I)
        meta_match = re.search(r"<div class=\"meta\">(.*?)</div>\s*(?:<div class=\"offers\">|<div class=\"status-note\">)", article, flags=re.S | re.I)
        offers_match = re.search(r"<div class=\"offers\">(.*?)</div>\s*(?:<div class=\"status-note\">|</article>)", article, flags=re.S | re.I)
        status_match = re.search(r"<div class=\"status-note\">(.*?)</div>", article, flags=re.S | re.I)
        kind_match = re.search(r"<span class=\"tag\">(.*?)</span>\s*</div>\s*<div class=\"meta\">", article, flags=re.S | re.I)
        title = strip_html_fragment(title_match.group(1) if title_match else "")
        if not title:
            continue
        try:
            position_index = int(strip_html_fragment(index_match.group(1) if index_match else "0") or 0)
        except ValueError:
            position_index = 0
        meta_tags = [
            strip_html_fragment(chunk)
            for chunk in re.findall(r"<span class=\"tag\">(.*?)</span>", meta_match.group(1) if meta_match else "", flags=re.S | re.I)
        ]
        meta_map: dict[str, str] = {}
        for tag in meta_tags:
            if ":" not in tag:
                continue
            key, value = tag.split(":", 1)
            meta_map[key.strip().lower()] = value.strip()

        offers: list[dict] = []
        offers_html = offers_match.group(1) if offers_match else ""
        for block in re.split(r"<div class=\"offer\">", offers_html, flags=re.I)[1:]:
            link_match = re.search(r"<a href=\"([^\"]+)\"[^>]*>(.*?)</a>", block, flags=re.S | re.I)
            price_match = re.search(r"<div class=\"num\">(.*?)</div>", block, flags=re.S | re.I)
            snippet_match = re.search(r"<div class=\"offer-snippet\">(.*?)</div>", block, flags=re.S | re.I)
            url = html.unescape(link_match.group(1)) if link_match else ""
            title_text = strip_html_fragment(link_match.group(2) if link_match else "")
            price_value = parse_money_value(strip_html_fragment(price_match.group(1) if price_match else ""))
            offers.append(
                {
                    "title": title_text or offer_domain_label(url) or "Источник",
                    "url": url,
                    "domain": offer_domain_label(url),
                    "price": price_value,
                    "snippet": strip_html_fragment(snippet_match.group(1) if snippet_match else ""),
                }
            )

        estimate_unit_price = parse_money_value(meta_map.get("смета за ед.") or meta_map.get("смета за ед"))
        estimate_total = parse_money_value(meta_map.get("смета всего"))
        market_price = parse_money_value(meta_map.get("рынок"))
        if market_price is None:
            offer_prices = [offer["price"] for offer in offers if offer.get("price") is not None]
            market_price = min(offer_prices) if offer_prices else None

        rows.append(
            {
                "positionIndex": position_index or None,
                "title": title,
                "titleKey": normalize_market_title_key(title),
                "marketType": market_type,
                "kindLabel": strip_html_fragment(kind_match.group(1) if kind_match else ""),
                "qtyText": meta_map.get("кол-во", ""),
                "unitText": meta_map.get("ед.", ""),
                "estimateUnitPrice": estimate_unit_price,
                "estimateTotal": estimate_total,
                "marketPrice": market_price,
                "marketPriceText": meta_map.get("рынок", ""),
                "offers": offers,
                "statusNote": strip_html_fragment(status_match.group(1) if status_match else ""),
            }
        )
    return rows


def fetch_autobot_market_rows(estimate_id: str, market_type: str) -> list[dict]:
    url = f"{PMBI_AUTOBOT_BASE_URL}/estimates/{urllib.parse.quote(estimate_id)}/market-view?market_type={urllib.parse.quote(market_type)}"
    request = urllib.request.Request(url, headers={"User-Agent": "PM.bi/1.0", "Accept": "text/html"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            html_text = response.read().decode(charset, errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise AutoBotUnavailableError("autobot_unavailable") from error
    return parse_market_view_html(html_text, market_type)


def build_project_market_analysis(
    con: sqlite3.Connection,
    project_id: int,
    kind: str,
    market_rows: list[dict] | None = None,
) -> dict:
    project = con.execute("SELECT id, contract_no, description FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        raise ValueError("project_not_found")
    estimate_id = extract_estimate_id_from_project(project)
    if not estimate_id:
        raise LookupError("estimate_not_linked")

    analyzed_at = now_ts()
    estimate_version = estimate_source_version(con, project_id)

    market_types = ["work"] if kind == "work" else ["material", "product", "service", "other"]
    if market_rows is None:
        market_rows = []
        for market_type in market_types:
            market_rows.extend(fetch_autobot_market_rows(estimate_id, market_type))

    items = material_summary_rows(con, project_id)
    if kind == "work":
        items = [item for item in items if normalize_estimate_item_kind(item.get("itemKind")) == "work"]
    else:
        items = [item for item in items if normalize_estimate_item_kind(item.get("itemKind")) != "work"]

    market_by_index: dict[int, dict] = {}
    market_by_title: dict[str, dict] = {}
    for row in market_rows:
        if row.get("positionIndex"):
            market_by_index[int(row["positionIndex"])] = row
        market_by_title[row["titleKey"]] = row

    stored_snapshots = latest_market_price_snapshots(con, project_id, kind)
    merged_rows: list[dict] = []
    for item in items:
        position_index = estimate_position_from_notes(str(item.get("notes") or ""), estimate_id)
        title_key = normalize_market_title_key(str(item.get("title") or ""))
        market_row = None
        if kind == "work" and position_index and position_index in market_by_index:
            market_row = market_by_index[position_index]
        if not market_row and title_key and title_key in market_by_title:
            market_row = market_by_title[title_key]
        offers = list((market_row or {}).get("offers") or [])
        fresh_market_price = (market_row or {}).get("marketPrice")
        stored_snapshot = stored_snapshots.get(int(item.get("id") or 0))
        market_price = fresh_market_price
        market_source = market_source_from_offers(offers, fresh_market_price)
        market_analyzed_at = analyzed_at if fresh_market_price is not None else None
        market_estimate_version = estimate_version if fresh_market_price is not None else None
        market_price_is_stale = False
        if market_price is None and stored_snapshot:
            market_price = float(stored_snapshot["price"])
            market_source = {
                "name": str(stored_snapshot.get("source_name") or "AutoBot"),
                "url": str(stored_snapshot.get("source_url") or ""),
            }
            market_analyzed_at = int(stored_snapshot["analyzed_at"])
            market_estimate_version = str(stored_snapshot["estimate_version"] or "")
            market_price_is_stale = True
            try:
                offers = json.loads(stored_snapshot.get("source_payload") or "[]")
            except (TypeError, ValueError):
                offers = []
        estimate_unit_price = float(item.get("plannedPrice") or 0)
        merged_rows.append(
            {
                "estimateItemId": int(item.get("id") or 0),
                "positionIndex": position_index,
                "title": str(item.get("title") or ""),
                "titleKey": title_key,
                "sectionTitle": str(item.get("sectionTitle") or "").strip(),
                "stageTitle": str(item.get("stageTitle") or "").strip(),
                "unit": str(item.get("unit") or "").strip(),
                "plannedQty": float(item.get("plannedQty") or 0),
                "estimateUnitPrice": estimate_unit_price,
                "estimateTotal": round(float(item.get("plannedQty") or 0) * estimate_unit_price, 2),
                "marketPrice": market_price,
                "marketPriceText": (market_row or {}).get("marketPriceText") or "",
                "marketType": (market_row or {}).get("marketType") or "",
                "statusNote": (market_row or {}).get("statusNote") or "",
                "marketSource": market_source,
                "marketAnalyzedAt": market_analyzed_at,
                "marketEstimateVersion": market_estimate_version,
                "marketPriceIsFresh": fresh_market_price is not None,
                "marketPriceIsStale": market_price_is_stale,
                "sources": offers[:3],
                "sourceCount": len(offers),
                "deltaPerUnit": round(market_price - estimate_unit_price, 2) if market_price is not None and estimate_unit_price else None,
                "hasMarketData": market_price is not None,
            }
        )

    merged_rows.sort(
        key=lambda row: (
            str(row.get("sectionTitle") or ""),
            int(row.get("positionIndex") or 10**9),
            str(row.get("title") or ""),
        )
    )
    enrich_market_rows_with_active_offers(con, project_id, merged_rows)
    coverage = sum(1 for row in merged_rows if row["hasMarketData"])
    fresh_coverage = sum(1 for row in merged_rows if row["marketPriceIsFresh"])
    stale_coverage = sum(1 for row in merged_rows if row["marketPriceIsStale"])
    payload = {
        "projectId": project_id,
        "estimateId": estimate_id,
        "estimateVersion": estimate_version,
        "analyzedAt": analyzed_at,
        "kind": kind,
        "rows": merged_rows,
        "summary": {
            "total": len(merged_rows),
            "withMarketData": coverage,
            "withoutMarketData": max(0, len(merged_rows) - coverage),
            "freshMarketData": fresh_coverage,
            "staleMarketData": stale_coverage,
        },
    }
    # Keep the legacy rows payload and expose the stable collection names for
    # clients that already consume the wider market-analysis contract.
    payload["analysis"] = merged_rows
    payload["materials"] = merged_rows if kind == "material" else []
    payload["works"] = merged_rows if kind == "work" else []
    return payload


def market_empty_payload(status: str, error: str = "") -> dict:
    payload = {
        "status": status,
        "analysis": [],
        "materials": [],
        "works": [],
        "rows": [],
    }
    if error:
        payload["error"] = error
    return payload


def restricted_market_analysis_payload(
    con: sqlite3.Connection,
    project_id: int,
    kind: str,
    can_submit_price: bool,
) -> dict:
    items = material_summary_rows(con, project_id)
    if kind == "work":
        items = [item for item in items if normalize_estimate_item_kind(item.get("itemKind")) == "work"]
    else:
        items = [item for item in items if normalize_estimate_item_kind(item.get("itemKind")) != "work"]
    rows = [
        {
            "estimateItemId": int(item.get("id") or 0),
            "title": str(item.get("title") or ""),
        }
        for item in items
    ]
    return {
        "status": "restricted",
        "canViewProcurementPrices": False,
        "canSubmitPrice": bool(can_submit_price),
        "projectId": project_id,
        "kind": kind,
        "rows": rows,
        "analysis": rows,
        "materials": rows if kind == "material" else [],
        "works": rows if kind == "work" else [],
        "summary": {"total": len(rows)},
    }


def refresh_cached_market_commercial_fields(payload: dict, project_id: int, kind: str) -> dict:
    rows = list(payload.get("rows") or [])
    with db() as con:
        enrich_market_rows_with_active_offers(con, project_id, rows)
    payload["rows"] = rows
    payload["analysis"] = rows
    payload["materials"] = rows if kind == "material" else []
    payload["works"] = rows if kind == "work" else []
    return payload


def market_analysis_error_status(error: str) -> int:
    if error == "autobot_unavailable":
        return HTTPStatus.SERVICE_UNAVAILABLE
    if error in {"project_not_found", "estimate_not_linked"}:
        return HTTPStatus.NOT_FOUND
    return HTTPStatus.INTERNAL_SERVER_ERROR


def market_analysis_project_context(project_id: int) -> str:
    with db() as con:
        project = con.execute(
            "SELECT id, contract_no, description FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
    if not project:
        raise LookupError("project_not_found")
    estimate_id = extract_estimate_id_from_project(project)
    if not estimate_id:
        raise LookupError("estimate_not_linked")
    return estimate_id


def save_market_analysis_cache(project_id: int, kind: str, status: str, payload: dict) -> None:
    with db() as con:
        con.execute(
            """
            INSERT INTO market_analysis_cache (project_id, kind, status, payload, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(project_id, kind) DO UPDATE SET
                status = excluded.status,
                payload = excluded.payload,
                updated_at = excluded.updated_at
            """,
            (project_id, kind, status, json.dumps(payload, ensure_ascii=False), now_ts()),
        )
        con.commit()


def market_analysis_worker(project_id: int, kind: str, estimate_id: str) -> None:
    key = (project_id, kind)
    try:
        # The network call intentionally runs without an open SQLite
        # connection. Only the short read and final merge use SQLite.
        market_types = ["work"] if kind == "work" else ["material", "product", "service", "other"]
        market_rows: list[dict] = []
        for market_type in market_types:
            market_rows.extend(fetch_autobot_market_rows(estimate_id, market_type))
        with db() as con:
            payload = build_project_market_analysis(con, project_id, kind, market_rows=market_rows)
            save_market_price_snapshots(con, payload)
            con.commit()
        payload["status"] = "ready"
        save_market_analysis_cache(project_id, kind, "ready", payload)
    except AutoBotUnavailableError:
        save_market_analysis_cache(
            project_id,
            kind,
            "error",
            market_empty_payload("error", "autobot_unavailable"),
        )
    except LookupError as error:
        save_market_analysis_cache(
            project_id,
            kind,
            "error",
            market_empty_payload("error", str(error)),
        )
    except Exception:
        print("Крэш фонового market_analysis:", traceback.format_exc())
        save_market_analysis_cache(
            project_id,
            kind,
            "error",
            market_empty_payload("error", "market_analysis_failed"),
        )
    finally:
        with MARKET_ANALYSIS_JOBS_LOCK:
            MARKET_ANALYSIS_JOBS.discard(key)


def request_market_analysis(project_id: int, kind: str) -> tuple[int, dict]:
    estimate_id = market_analysis_project_context(project_id)
    key = (project_id, kind)
    now = now_ts()
    with db() as con:
        cached = con.execute(
            "SELECT status, payload, updated_at FROM market_analysis_cache WHERE project_id = ? AND kind = ?",
            (project_id, kind),
        ).fetchone()
    if cached:
        try:
            cached_payload = json.loads(cached["payload"] or "{}")
        except (TypeError, ValueError):
            cached_payload = {}
        ttl = MARKET_ANALYSIS_CACHE_TTL if cached["status"] == "ready" else MARKET_ANALYSIS_ERROR_TTL
        if cached["status"] == "ready" and now - int(cached["updated_at"] or 0) < ttl:
            cached_payload["status"] = "ready"
            refresh_cached_market_commercial_fields(cached_payload, project_id, kind)
            return HTTPStatus.OK, cached_payload
        if cached["status"] == "error" and now - int(cached["updated_at"] or 0) < ttl:
            error = str(cached_payload.get("error") or "market_analysis_failed")
            return market_analysis_error_status(error), cached_payload

    with MARKET_ANALYSIS_JOBS_LOCK:
        if key in MARKET_ANALYSIS_JOBS:
            return HTTPStatus.OK, market_empty_payload("pending")
        MARKET_ANALYSIS_JOBS.add(key)
    save_market_analysis_cache(project_id, kind, "pending", market_empty_payload("pending"))
    MARKET_ANALYSIS_EXECUTOR.submit(market_analysis_worker, project_id, kind, estimate_id)
    return HTTPStatus.OK, market_empty_payload("pending")










































class PMBIHandler(BaseHTTPRequestHandler):
    server_version = "PMBIBackend/1.0"

    def log_message(self, fmt: str, *args) -> None:
        try:
            if sys.stdout:
                sys.stdout.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))
        except (AttributeError, OSError):
            pass

    def do_GET(self) -> None:
        path = self.clean_path()
        if path in {"/", "/index.html"}:
            self.redirect(DEFAULT_AUTH_PATH)
            return
        if path.startswith("/api/"):
            self.handle_api("GET", path)
            return
        if path == "/login" or path.startswith("/app"):
            self.serve_app(path)
            return
        if path.startswith("/assets/"):
            self.serve_asset(path)
            return
        self.serve_static(path)

    def do_POST(self) -> None:
        path = self.clean_path()
        if path.startswith("/api/"):
            self.handle_api("POST", path)
            return
        self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def do_DELETE(self) -> None:
        path = self.clean_path()
        if path.startswith("/api/"):
            self.handle_api("DELETE", path)
            return
        self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def clean_path(self) -> str:
        parsed = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(parsed.path)
        if path.endswith("/") and path != "/":
            path = path[:-1]
        return path or "/"

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 1024 * 1024:
            raise ValueError("Payload too large")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def read_multipart(self) -> cgi.FieldStorage:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            raise ValueError("empty_upload")
        if length > MAX_UPLOAD_BYTES:
            raise ValueError("upload_too_large")
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise ValueError("multipart_required")
        return cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": str(length),
            },
            keep_blank_values=True,
        )

    def send_json(self, status: int, payload: dict) -> None:
        if payload_has_procurement_prices(payload):
            payload = redact_procurement_prices(payload, self.current_user())
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file_path: Path, content_type: str, download_name: str, inline: bool = False) -> None:
        body = file_path.read_bytes()
        disposition = "inline" if inline else "attachment"
        quoted_name = urllib.parse.quote(download_name)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header(
            "Content-Disposition",
            f"{disposition}; filename*=UTF-8''{quoted_name}",
        )
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def session_token(self) -> str | None:
        from auth import session_token as auth_session_token
        return auth_session_token(self)

    def bearer_token(self) -> str | None:
        from auth import bearer_token as auth_bearer_token
        return auth_bearer_token(self)

    def clerk_cookie_token(self) -> str | None:
        from auth import clerk_cookie_token as auth_clerk_cookie_token
        return auth_clerk_cookie_token(self)

    def auth_config(self) -> dict[str, object]:
        return auth_core_config()

    def auth_config_script(self) -> str:
        payload = json.dumps(self.auth_config(), ensure_ascii=False)
        return f"<script>window.__PMBI_AUTH__ = {payload};</script>"

    def clerk_sign_in_script(self) -> str:
        return auth_clerk_sign_in_script()

    def current_user_from_clerk(self) -> tuple[dict | None, str | None]:
        return auth_current_user_from_clerk(self)

    def current_user(self) -> dict | None:
        return auth_current_user(self)

    def require_user(self) -> dict | None:
        return auth_require_user(self)

    def require_role(self, roles: set[str]) -> dict | None:
        return auth_require_role(self, roles)

    def set_session_cookie(self, token: str) -> None:
        from auth import set_session_cookie as auth_set_session_cookie
        auth_set_session_cookie(self, token)

    def clear_session_cookie(self) -> None:
        from auth import clear_session_cookie as auth_clear_session_cookie
        auth_clear_session_cookie(self)

    def handle_api(self, method: str, path: str) -> None:
        try:
            if is_agent_market_proxy_route(method, path):
                self.proxy_agent_market_request(method, path)
            elif method == "POST" and path == "/api/auth/login":
                self.api_login()
            elif method == "POST" and path == "/api/auth/request-password-reset":
                auth_api_request_password_reset(self)
            elif method == "POST" and path == "/api/auth/change-password":
                auth_api_change_password(self)
            elif method == "POST" and path == "/api/auth/logout":
                self.api_logout()
            elif method == "GET" and path == "/api/auth/me":
                self.api_me()
            elif method == "POST" and path == "/api/auth/update-profile":
                auth_api_update_profile(self)
            elif method == "GET" and path.startswith("/api/auth/avatar/"):
                auth_api_avatar_file(self, path)
            elif method == "GET" and path == "/api/roles":
                self.api_roles()
            elif method == "POST" and path == "/api/roles":
                self.api_create_role()
            elif method == "POST" and path == "/api/users/manage":
                self.api_users_manage()
            elif method == "DELETE" and path.startswith("/api/users/manage/"):
                self.api_delete_managed_user(path)
            elif method == "POST" and path == "/api/finance/pay-invoice":
                self.api_pay_invoice()
            elif method == "POST" and path == "/api/admin/users":
                self.api_create_user()
            elif method == "GET" and path == "/api/users":
                self.api_users()
            elif method == "GET" and path == "/api/admin/users":
                self.api_users()
            elif method == "GET" and path == "/api/companies":
                self.api_companies()
            elif method == "POST" and path == "/api/companies":
                self.api_create_company()
            elif method == "GET" and path == "/api/projects":
                self.api_projects()
            elif method == "POST" and path == "/api/projects":
                self.api_create_project()
            elif method == "POST" and re.fullmatch(r"/api/projects/\d+/update", path):
                self.api_update_project(path)
            elif method == "POST" and re.fullmatch(r"/api/projects/\d+/delete", path):
                self.api_delete_project(path)
            elif method == "GET" and path == "/api/dashboard":
                self.api_dashboard()
            elif method == "GET" and path == "/api/daily-tasks":
                self.api_daily_tasks()
            elif method == "POST" and path == "/api/daily-tasks":
                self.api_create_daily_task()
            elif method == "GET" and path == "/api/daily-tasks/standup":
                self.api_daily_standup()
            elif method == "POST" and path == "/api/daily-tasks/standup":
                self.api_save_daily_standup()
            elif method == "POST" and path.startswith("/api/daily-tasks/") and path.endswith("/update"):
                self.api_update_daily_task(path)
            elif method == "POST" and path.startswith("/api/daily-tasks/") and path.endswith("/delete"):
                self.api_delete_daily_task(path)
            elif method == "GET" and path in {"/api/warehouse-items", "/api/warehouse"}:
                self.api_warehouse_items()
            elif method == "POST" and path == "/api/warehouse-items/receipt":
                self.api_warehouse_receipt()
            elif method == "POST" and path.startswith("/api/warehouse-items/") and path.endswith("/transfer"):
                self.api_warehouse_transfer(path)
            elif method == "POST" and path.startswith("/api/warehouse/") and path.endswith("/issue"):
                self.api_warehouse_issue(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.count("/") == 3:
                self.api_project_detail(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/assignments"):
                self.api_project_assignments(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/assignments"):
                self.api_create_project_assignment(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/claim-foreman"):
                self.api_claim_project_foreman(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/materials-summary"):
                self.api_materials_summary(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/estimates"):
                self.api_project_estimates(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/estimate-reconciliation"):
                self.api_estimate_reconciliation(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/estimate-reconciliation/snapshots"):
                self.api_capture_estimate_reconciliation_snapshot(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/estimate-reconciliation/review"):
                self.api_review_estimate_reconciliation(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/warehouse-control"):
                self.api_project_warehouse_control(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/warehouse-control/norms"):
                self.api_upsert_work_material_norm(path)
            elif method == "POST" and re.fullmatch(r"/api/projects/\d+/warehouse-control/facts/\d+/reverse", path):
                self.api_reverse_project_work_fact(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/warehouse-control/facts"):
                self.api_create_project_work_fact(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/warehouse-matches"):
                self.api_project_warehouse_matches(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/material-schedule"):
                self.api_material_schedule(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/material-schedule"):
                self.api_save_material_schedule(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/materials"):
                self.api_create_material(path)
            elif method == "POST" and re.fullmatch(r"/api/projects/\d+/estimate-items/\d+/update", path):
                self.api_update_estimate_position(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/bootstrap"):
                self.api_project_bootstrap(path)
            elif method == "POST" and path.startswith("/api/materials/") and path.endswith("/update"):
                self.api_update_material(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/supplier-offers"):
                self.api_project_supplier_offers(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/market-analysis"):
                self.api_project_market_analysis(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/market-counterparty"):
                self.api_create_market_counterparty(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/supplier-offers"):
                self.api_create_supplier_offer(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/supplier-offers/clear-selection"):
                self.api_clear_supplier_selection(path)
            elif method == "POST" and path.startswith("/api/supplier-offers/") and path.endswith("/update"):
                self.api_update_supplier_offer(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/legacy-economics-migration"):
                self.api_project_legacy_economics_migration(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/legacy-economics-migration/scan"):
                self.api_scan_project_legacy_economics(path)
            elif method == "POST" and path.startswith("/api/legacy-economics-migrations/") and path.endswith("/update"):
                self.api_update_project_legacy_economics_review(path)
            elif method == "POST" and path.startswith("/api/legacy-economics-migrations/") and path.endswith("/ignore"):
                self.api_ignore_project_legacy_economics_review(path)
            elif method == "POST" and path.startswith("/api/legacy-economics-migrations/") and path.endswith("/confirm"):
                self.api_confirm_project_legacy_economics_review(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/financial-baselines"):
                self.api_project_financial_baselines(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/financial-baselines"):
                self.api_create_financial_baseline(path)
            elif method == "POST" and path.startswith("/api/financial-baselines/") and path.endswith("/update"):
                self.api_update_financial_baseline(path)
            elif method == "POST" and path.startswith("/api/financial-baselines/") and path.endswith("/successors"):
                self.api_update_financial_baseline_successors(path)
            elif method == "POST" and path.startswith("/api/financial-baselines/") and path.endswith("/submit"):
                self.api_submit_financial_baseline(path)
            elif method == "POST" and path.startswith("/api/financial-baselines/") and path.endswith("/return"):
                self.api_return_financial_baseline(path)
            elif method == "POST" and path.startswith("/api/financial-baselines/") and path.endswith("/approve"):
                self.api_approve_financial_baseline(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/commitments"):
                self.api_project_commitments(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/commitments"):
                self.api_create_commitment(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/commitments/from-offer"):
                self.api_create_commitment_from_offer(path)
            elif method == "POST" and path.startswith("/api/commitments/") and path.endswith("/update"):
                self.api_update_commitment(path)
            elif method == "POST" and path.startswith("/api/commitments/") and path.endswith("/replace-lines"):
                self.api_replace_commitment_lines(path)
            elif method == "POST" and path.startswith("/api/commitments/") and path.endswith("/submit"):
                self.api_submit_commitment(path)
            elif method == "POST" and path.startswith("/api/commitments/") and path.endswith("/return"):
                self.api_return_commitment(path)
            elif method == "POST" and path.startswith("/api/commitments/") and path.endswith("/approve"):
                self.api_approve_commitment(path)
            elif method == "POST" and path.startswith("/api/commitments/") and path.endswith("/cancel"):
                self.api_cancel_commitment(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/actual-costs"):
                self.api_project_actual_costs(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/actual-costs/from-stock-move"):
                self.api_create_actual_cost_from_stock_move(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/actual-costs/from-warehouse-transfer"):
                self.api_create_actual_cost_from_warehouse_transfer(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/actual-costs"):
                self.api_create_actual_cost(path)
            elif method == "POST" and path.startswith("/api/actual-costs/") and path.endswith("/update"):
                self.api_update_actual_cost(path)
            elif method == "POST" and path.startswith("/api/actual-costs/") and path.endswith("/submit"):
                self.api_submit_actual_cost(path)
            elif method == "POST" and path.startswith("/api/actual-costs/") and path.endswith("/return"):
                self.api_return_actual_cost(path)
            elif method == "POST" and path.startswith("/api/actual-costs/") and path.endswith("/approve"):
                self.api_approve_actual_cost(path)
            elif method == "POST" and path.startswith("/api/actual-costs/") and path.endswith("/reverse"):
                self.api_reverse_actual_cost(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/cash-flow"):
                self.api_project_cash_flow(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/payment-allocations"):
                self.api_create_payment_allocation(path)
            elif method == "POST" and path.startswith("/api/payment-allocations/") and path.endswith("/update"):
                self.api_update_payment_allocation(path)
            elif method == "POST" and path.startswith("/api/payment-allocations/") and path.endswith("/submit"):
                self.api_submit_payment_allocation(path)
            elif method == "POST" and path.startswith("/api/payment-allocations/") and path.endswith("/return"):
                self.api_return_payment_allocation(path)
            elif method == "POST" and path.startswith("/api/payment-allocations/") and path.endswith("/approve"):
                self.api_approve_payment_allocation(path)
            elif method == "POST" and path.startswith("/api/payment-allocations/") and path.endswith("/reverse"):
                self.api_reverse_payment_allocation(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/economics"):
                self.api_project_economics(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/forecasts"):
                self.api_project_forecasts(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/forecast-price-sources"):
                self.api_project_forecast_price_sources(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/forecasts/calculate"):
                self.api_calculate_project_forecast(path)
            elif method == "POST" and path.startswith("/api/forecasts/") and path.endswith("/submit"):
                self.api_submit_project_forecast(path)
            elif method == "POST" and path.startswith("/api/forecasts/") and path.endswith("/return"):
                self.api_return_project_forecast(path)
            elif method == "POST" and path.startswith("/api/forecasts/") and path.endswith("/approve"):
                self.api_approve_project_forecast(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/finances"):
                self.api_project_finances(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/finances"):
                self.api_create_finance_entry(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/finances/invoice-upload"):
                self.api_upload_finance_invoice(path)
            elif method == "POST" and path.startswith("/api/finances/") and path.endswith("/update"):
                self.api_update_finance_entry(path)
            elif method == "DELETE" and re.fullmatch(r"/api/finances/\d+", path):
                self.api_delete_finance_entry(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/estimate-import"):
                self.api_import_estimate(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/auto-schedule"):
                self.api_project_auto_schedule(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/section-schedule-forecast"):
                self.api_project_section_schedule_forecast(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/section-schedule-override"):
                schedule_api_update_section_schedule_override(self, path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/production-schedule"):
                schedule_api_production_schedule(self, path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/production-schedule"):
                schedule_api_update_production_schedule(self, path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/progress-item"):
                schedule_api_update_estimate_item_completion(self, path)
            elif method == "POST" and path.startswith("/api/projects/") and "bulk-complete" in path:
                schedule_api_project_section_bulk_complete(self, path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/schedule-status"):
                self.api_project_schedule_status(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/schedule-status"):
                self.api_update_project_schedule_status(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/analysis"):
                self.api_project_analysis(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/stages"):
                self.api_project_stages(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/stages"):
                self.api_create_project_stage(path)
            elif method == "POST" and path.startswith("/api/stages/") and path.endswith("/update"):
                self.api_update_stage(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/tasks"):
                self.api_project_tasks(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/tasks"):
                self.api_create_task(path)
            elif method == "POST" and path.startswith("/api/tasks/") and path.endswith("/update"):
                self.api_update_task(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/notifications"):
                self.api_project_notifications(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/documents"):
                self.api_project_documents(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/documents"):
                self.api_upload_project_document(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/executive-docs"):
                self.api_project_executive_docs(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/executive-docs"):
                self.api_create_project_executive_doc(path)
            elif method == "GET" and path.startswith("/api/documents/") and path.endswith("/download"):
                self.api_document_file(path, inline=False)
            elif method == "GET" and path.startswith("/api/documents/") and path.endswith("/view"):
                self.api_document_file(path, inline=True)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/daily-logs"):
                self.api_project_daily_logs(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/daily-logs"):
                self.api_create_daily_log(path)
            elif method == "POST" and path.startswith("/api/projects/") and "/daily-logs/" in path and path.endswith("/delete"):
                self.api_delete_daily_log(path)
            elif method == "GET" and path.startswith("/api/projects/") and path.endswith("/chats"):
                self.api_project_chats(path)
            elif method == "GET" and path.startswith("/api/chats/") and path.endswith("/messages"):
                self.api_chat_messages(path)
            elif method == "POST" and path.startswith("/api/chats/") and path.endswith("/messages"):
                self.api_create_chat_message(path)
            elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/stock-moves"):
                self.api_create_stock_move(path)
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        except json.JSONDecodeError:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:
            traceback.print_exc()
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "server_error", "message": str(error) or error.__class__.__name__},
            )

    def proxy_agent_market_request(self, method: str, path: str) -> None:
        """Expose only the token-protected Hermes worker API through the public CRM domain."""
        if not PMBI_AUTOBOT_INTERNAL_URL:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "autobot_not_configured"})
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length < 0 or length > 1024 * 1024:
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "payload_too_large"})
            return
        body = self.rfile.read(length) if method == "POST" and length else None
        headers = {
            "Accept": "application/json",
            "Content-Type": self.headers.get("Content-Type", "application/json"),
            "User-Agent": "PM.bi Hermes proxy/1.0",
        }
        for name in ("Authorization", "X-AutoBot-Agent-Token"):
            value = str(self.headers.get(name) or "").strip()
            if value:
                headers[name] = value
        upstream = urllib.request.Request(
            PMBI_AUTOBOT_INTERNAL_URL + path,
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(upstream, timeout=35) as response:
                status = int(response.status)
                response_body = response.read(2 * 1024 * 1024)
                content_type = response.headers.get("Content-Type", "application/json; charset=utf-8")
        except urllib.error.HTTPError as error:
            status = int(error.code)
            response_body = error.read(2 * 1024 * 1024)
            content_type = error.headers.get("Content-Type", "application/json; charset=utf-8")
        except (OSError, urllib.error.URLError, TimeoutError) as error:
            response_body = json.dumps(
                {"ok": False, "message": "AutoBot временно недоступен", "error": error.__class__.__name__},
                ensure_ascii=False,
            ).encode("utf-8")
            status = int(HTTPStatus.SERVICE_UNAVAILABLE)
            content_type = "application/json; charset=utf-8"
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(response_body)))
        self.end_headers()
        self.wfile.write(response_body)

    def api_login(self) -> None:
        auth_api_login(self)

    def api_logout(self) -> None:
        auth_api_logout(self)

    def api_me(self) -> None:
        auth_api_me(self)

    def api_roles(self) -> None:
        user = self.require_user()
        if not user:
            return
        with db() as con:
            rows = con.execute("SELECT id, code, name, description, permissions FROM roles ORDER BY id").fetchall()
        self.send_json(HTTPStatus.OK, {"roles": [
            {
                "id": row["id"],
                "code": normalize_role(row["code"]),
                "name": row["name"],
                "description": row["description"],
                "permissions": normalize_permissions(row["permissions"], row["code"]),
            }
            for row in rows
            if normalize_role(row["code"]) != "admin" or user_is_hidden_admin(user)
        ]})

    def api_create_role(self) -> None:
        user = self.require_user()
        if not user:
            return
        if not user_is_main_admin(user):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden", "message": "Доступ разрешен только Главному Админу"})
            return
        payload = self.read_json()
        name = str(payload.get("name", "")).strip()
        if not name:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "empty_role_name"})
            return
        code_base = str(payload.get("code") or name).strip().lower()
        code_base = unicodedata.normalize("NFKD", code_base).encode("ascii", "ignore").decode("ascii")
        code_base = re.sub(r"[^a-z0-9]+", "_", code_base).strip("_") or "custom_role"
        if code_base in {"admin", "director"}:
            code_base = "custom_" + code_base
        permissions = normalize_permissions(payload.get("permissions") or {}, code_base)
        permissions_json = json.dumps(permissions, ensure_ascii=False)
        with db() as con:
            code = code_base
            suffix = 2
            while con.execute("SELECT 1 FROM roles WHERE code = ?", (code,)).fetchone():
                code = f"{code_base}_{suffix}"
                suffix += 1
            cur = con.execute(
                """
                INSERT INTO roles (code, name, description, permissions)
                VALUES (?, ?, ?, ?)
                """,
                (code, name, str(payload.get("description", "")).strip(), permissions_json),
            )
            con.commit()
        self.send_json(HTTPStatus.CREATED, {
            "role": {
                "id": cur.lastrowid,
                "code": code,
                "name": name,
                "description": str(payload.get("description", "")).strip(),
                "permissions": permissions,
            }
        })

    def api_create_user(self) -> None:
        admin = self.require_user()
        if not admin:
            return
        if not user_is_main_admin(admin):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden", "message": "Доступ разрешен только Главному Админу"})
            return
        payload = self.read_json()
        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", ""))
        requested_roles = payload.get("roles")
        if isinstance(requested_roles, list):
            role_codes = [normalize_role(str(item).strip()) for item in requested_roles if str(item).strip()]
        else:
            role_codes = [normalize_role(str(payload.get("role", "")).strip())]
        role_codes = list(dict.fromkeys(role_codes))
        role = role_codes[0] if role_codes else ""
        raw_name = str(payload.get("name", "")).strip()
        first_name, last_name = split_user_name(raw_name, payload.get("firstName", payload.get("first_name")), payload.get("lastName", payload.get("last_name")))
        name = " ".join(part for part in [first_name, last_name] if part).strip() or raw_name or login
        email = str(payload.get("email", "")).strip().lower() or None
        phone = str(payload.get("phone", "")).strip() or None
        if (
            not login
            or len(password) < 10
            or not role_codes
            or (clerk_enabled() and not email)
        ):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_user_data"})
            return
        if not valid_user_email(email):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_email", "message": "Введите корректный Email"})
            return
        if not valid_user_phone(phone):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_phone", "message": "Введите корректный номер телефона"})
            return
        clerk_user_id = None
        with db() as con:
            existing_roles = {
                normalize_role(row["code"])
                for row in con.execute("SELECT code FROM roles").fetchall()
            }
            if any(role_code not in existing_roles for role_code in role_codes):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_role"})
                return
            release_deleted_user_identity(con, login, email, phone)
            if user_login_conflict(con, login):
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            unique_conflict = user_unique_conflict(con, email, phone)
            if unique_conflict:
                self.send_json(HTTPStatus.CONFLICT, unique_conflict)
                return
            if clerk_enabled() and email:
                existing_email = con.execute(
                    "SELECT id FROM users WHERE lower(email) = ? AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_active, 1) = 1",
                    (email.lower(),),
                ).fetchone()
                if existing_email:
                    self.send_json(HTTPStatus.CONFLICT, {"error": "email_already_used", "message": "Этот Email уже зарегистрирован в системе"})
                    return
        if clerk_enabled():
            first_name, last_name = split_person_name(name)
            clerk_payload = {
                "email_address": [email],
                "password": password,
                "username": login,
                "first_name": first_name,
                "last_name": last_name,
                "skip_password_checks": False,
                "skip_password_requirement": False,
            }
            try:
                clerk_user = clerk_api_request("/users", method="POST", payload=clerk_payload)
                clerk_user_id = str(clerk_user.get("id") or "").strip() or None
            except Exception as error:
                self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "clerk_create_user_failed", "detail": str(error)})
                return
        with db() as con:
            try:
                cur = con.execute(
                    """
                    INSERT INTO users (login, email, phone, clerk_user_id, password_hash, role, first_name, last_name, name, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                    """,
                    (login, email, phone, clerk_user_id, hash_password(password), role, first_name, last_name, name, now_ts(), now_ts()),
                )
            except sqlite3.IntegrityError:
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            for role_code in role_codes:
                role_row = con.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
                if role_row:
                    con.execute(
                        """
                        INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                        VALUES (?, ?, ?)
                        """,
                        (cur.lastrowid, role_row["id"], now_ts()),
                    )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_user', 'user', ?, ?, ?)
                """,
                (admin["id"], cur.lastrowid, json.dumps({"login": login, "roles": role_codes}, ensure_ascii=False), now_ts()),
            )
            con.commit()
        self.send_json(
            HTTPStatus.CREATED,
            {
                "id": cur.lastrowid,
                "login": login,
                "email": email if user_is_hidden_admin(admin) else None,
                "phone": phone if user_is_hidden_admin(admin) else None,
                "clerkUserId": clerk_user_id if user_is_hidden_admin(admin) else None,
                "role": role,
                "roles": role_codes,
                "name": name,
            },
        )

    def api_users(self) -> None:
        viewer = self.require_user()
        if not viewer:
            return
        with db() as con:
            rows = con.execute(
                """
                SELECT id, login, email, phone, clerk_user_id, role, first_name, last_name, name, status, is_active, avatar_url, created_at
                FROM users
                WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0
                ORDER BY id
                """
            ).fetchall()
            role_rows = con.execute(
                """
                SELECT ur.user_id, r.code, r.name, r.permissions
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                ORDER BY r.id
                """
            ).fetchall()
            project_rows = con.execute(
                """
                SELECT oa.user_id, p.id, p.title
                FROM object_assignments oa
                JOIN projects p ON p.id = oa.object_id
                ORDER BY oa.is_primary DESC, oa.assigned_at DESC, oa.id DESC
                """
            ).fetchall()
            daily_rows = con.execute(
                """
                SELECT user_id, status
                FROM daily_tasks
                WHERE status IN ('planned', 'in_progress')
                ORDER BY updated_at DESC, id DESC
                """
            ).fetchall()
            roles_by_user: dict[int, list[dict]] = {}
            for role_row in role_rows:
                roles_by_user.setdefault(int(role_row["user_id"]), []).append({
                    "code": normalize_role(role_row["code"]),
                    "name": ROLE_LABELS.get(normalize_role(role_row["code"]), role_row["name"]),
                    "permissions": normalize_permissions(role_row["permissions"], role_row["code"]),
                })
            projects_by_user: dict[int, list[dict]] = {}
            for project_row in project_rows:
                projects_by_user.setdefault(int(project_row["user_id"]), []).append({
                    "id": project_row["id"],
                    "title": project_row["title"],
                })
            daily_status_by_user: dict[int, str] = {}
            for daily_row in daily_rows:
                daily_status_by_user.setdefault(int(daily_row["user_id"]), daily_row["status"])
            def user_roles_for_row(row: sqlite3.Row) -> list[dict]:
                role = normalize_role(row["role"])
                if str(row["login"] or "").strip().lower() == "admin":
                    return [{"code": "admin", "name": ROLE_LABELS.get("admin", "admin")}]
                return roles_by_user.get(int(row["id"]), [{"code": role, "name": ROLE_LABELS.get(role, role)}])
            def user_permissions_for_row(row: sqlite3.Row) -> dict:
                roles = user_roles_for_row(row)
                if str(row["login"] or "").strip().lower() == "admin":
                    return normalize_permissions({"fullAccess": True}, "admin")
                return normalize_permissions(roles[0].get("permissions") if roles else None, roles[0].get("code") if roles else row["role"])
            def row_is_main_admin_account(row: sqlite3.Row) -> bool:
                return user_is_main_admin_account(row) or any(
                    normalize_role(role.get("code")) == "main_admin"
                    for role in user_roles_for_row(row)
                )
            def viewer_is_same_user(row: sqlite3.Row) -> bool:
                try:
                    return int(viewer.get("id")) == int(row["id"])
                except (TypeError, ValueError):
                    return False
            visible_rows = [
                row
                for row in rows
                if not row_is_main_admin_account(row) or viewer_is_same_user(row)
            ]
            def user_work_status(row: sqlite3.Row) -> tuple[str, str]:
                daily_status = daily_status_by_user.get(int(row["id"]))
                if daily_status == "in_progress":
                    return "В процессе задачи", "green"
                if daily_status == "planned":
                    return "Утренний план", "yellow"
                if projects_by_user.get(int(row["id"])):
                    return "На объекте", "green"
                return "Офис", "muted"
        self.send_json(
            HTTPStatus.OK,
            {
                "users": [
                    {
                        "avatarUrl": row["avatar_url"] if "avatar_url" in row.keys() else None,
                        "id": row["id"],
                        "login": row["login"],
                        "email": row["email"],
                        "phone": row["phone"],
                        "clerkUserId": row["clerk_user_id"] if user_is_hidden_admin(viewer) else None,
                        "role": "admin" if str(row["login"] or "").strip().lower() == "admin" else normalize_role(row["role"]),
                        "roles": user_roles_for_row(row),
                        "roleLabel": user_roles_for_row(row)[0].get("name") if user_roles_for_row(row) else ROLE_LABELS.get(normalize_role(row["role"]), row["role"]),
                        "permissions": user_permissions_for_row(row),
                        "firstName": row["first_name"] or split_user_name(row["name"])[0],
                        "lastName": row["last_name"] or split_user_name(row["name"])[1],
                        "displayName": display_user_name(row["name"], row["first_name"], row["last_name"], row["login"]),
                        "name": display_user_name(row["name"], row["first_name"], row["last_name"], row["login"]),
                        "assignedProjects": projects_by_user.get(int(row["id"]), []),
                        "currentObjectName": (projects_by_user.get(int(row["id"]), [{}])[0].get("title") if projects_by_user.get(int(row["id"])) else ""),
                        "workStatus": user_work_status(row)[0],
                        "workStatusTone": user_work_status(row)[1],
                        "status": row["status"],
                        "isActive": bool(row["is_active"]),
                        "createdAt": row["created_at"],
                    }
                    for row in visible_rows
                ]
            },
        )


    def api_users_manage(self) -> None:
        viewer = self.require_user()
        if not viewer:
            return
        director = viewer
        payload = self.read_json()
        action = str(payload.get("action", "create_foreman")).strip() or "create_foreman"
        can_set_project_access = (
            user_is_main_admin(viewer)
            or user_has_any_role(viewer, {"admin", "director"})
            or user_permissions(viewer).get("fullAccess")
        )
        if (action in {"set_project_foremen", "set_access"} and not can_set_project_access) or (
            action not in {"set_project_foremen", "set_access"} and not user_is_main_admin(viewer)
        ):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "\u0414\u043e\u0441\u0442\u0443\u043f \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0410\u0434\u043c\u0438\u043d\u0443"})
            return

        if action in {"set_project_foremen", "set_access"}:
            try:
                project_id = int(payload.get("project_id", payload.get("projectId")))
                foreman_ids = payload.get("foreman_ids", payload.get("foremanIds", []))
                if not isinstance(foreman_ids, list):
                    raise ValueError("bad_foreman_ids")
                foreman_ids = [int(item) for item in foreman_ids]
            except (TypeError, ValueError):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_access_payload"})
                return
            with db() as con:
                try:
                    assigned = self.set_project_foremen(con, project_id, foreman_ids, int(director["id"]))
                except ValueError as error:
                    status = HTTPStatus.NOT_FOUND if str(error) == "project_not_found" else HTTPStatus.BAD_REQUEST
                    self.send_json(status, {"error": str(error)})
                    return
                create_audit(
                    con,
                    director["id"],
                    "set_project_foremen",
                    "project",
                    project_id,
                    {"foreman_ids": assigned},
                )
                con.commit()
            self.send_json(HTTPStatus.OK, {"ok": True, "projectId": project_id, "assigned_foremen": assigned})
            return

        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", ""))
        raw_name = str(payload.get("name", "")).strip()
        first_name, last_name = split_user_name(raw_name, payload.get("firstName", payload.get("first_name")), payload.get("lastName", payload.get("last_name")))
        name = " ".join(part for part in [first_name, last_name] if part).strip() or raw_name or login
        email = str(payload.get("email", "")).strip().lower() or None
        phone = str(payload.get("phone", "")).strip() or None
        requested_roles = payload.get("roles")
        if isinstance(requested_roles, list):
            role_codes = [normalize_role(str(item).strip()) for item in requested_roles if str(item).strip()]
        else:
            role_codes = [normalize_role(str(payload.get("role", "foreman")).strip() or "foreman")]
        role_codes = list(dict.fromkeys(role_codes))
        primary_role = role_codes[0] if role_codes else "foreman"
        raw_user_id = payload.get("user_id", payload.get("userId", payload.get("id")))
        user_id = None
        if raw_user_id not in (None, ""):
            try:
                user_id = int(raw_user_id)
            except (TypeError, ValueError):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_user_id"})
                return
        project_ids = payload.get("project_ids", payload.get("projectIds", []))
        if project_ids is None:
            project_ids = []
        if not isinstance(project_ids, list):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_ids"})
            return
        try:
            project_ids = list(dict.fromkeys(int(item) for item in project_ids if int(item) > 0))
        except (TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_ids"})
            return
        if not login or ((not user_id) and len(password) < 10) or (clerk_enabled() and not email):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_user_data"})
            return
        if not valid_user_email(email):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_email", "message": "Введите корректный Email"})
            return
        if not valid_user_phone(phone):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_phone", "message": "Введите корректный номер телефона"})
            return

        if user_id:
            with db() as con:
                existing_roles = {
                    normalize_role(row["code"])
                    for row in con.execute("SELECT code FROM roles").fetchall()
                }
                if any(role_code not in existing_roles for role_code in role_codes):
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_role"})
                    return
                release_deleted_user_identity(con, login, email, phone)
                existing = con.execute(
                    "SELECT * FROM users WHERE id = ? AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_active, 1) = 1",
                    (user_id,),
                ).fetchone()
                if not existing:
                    self.send_json(HTTPStatus.NOT_FOUND, {"error": "user_not_found", "message": "Сотрудник не найден"})
                    return
                if not user_is_hidden_admin(director):
                    email = existing["email"]
                    phone = existing["phone"]
                if user_login_conflict(con, login, user_id):
                    self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists", "message": "Этот логин уже используется"})
                    return
                unique_conflict = user_unique_conflict(con, email, phone, user_id)
                if unique_conflict:
                    self.send_json(HTTPStatus.CONFLICT, unique_conflict)
                    return
                if project_ids:
                    placeholders = ",".join("?" for _ in project_ids)
                    existing_project_count = con.execute(
                        f"SELECT COUNT(*) FROM projects WHERE id IN ({placeholders})",
                        project_ids,
                    ).fetchone()[0]
                    if int(existing_project_count or 0) != len(project_ids):
                        self.send_json(HTTPStatus.BAD_REQUEST, {"error": "project_not_found"})
                        return
                con.execute(
                    """
                    UPDATE users
                    SET login = ?, email = ?, phone = ?, role = ?, first_name = ?, last_name = ?, name = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (login, email, phone, primary_role, first_name, last_name, name, now_ts(), user_id),
                )
                con.execute("DELETE FROM user_roles WHERE user_id = ?", (user_id,))
                for role_code in role_codes:
                    role_row = con.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
                    if role_row:
                        con.execute(
                            """
                            INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                            VALUES (?, ?, ?)
                            """,
                            (user_id, role_row["id"], now_ts()),
                        )
                con.execute("DELETE FROM object_assignments WHERE user_id = ? AND role_code = 'foreman'", (user_id,))
                con.execute("DELETE FROM user_project_access WHERE user_id = ?", (user_id,))
                for project_id in project_ids:
                    con.execute(
                        """
                        INSERT OR IGNORE INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
                        VALUES (?, ?, 'foreman', 'Прораб объекта', 0, ?, ?)
                        """,
                        (project_id, user_id, director["id"], now_ts()),
                    )
                    con.execute(
                        "INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)",
                        (user_id, project_id),
                    )
                    con.execute(
                        "UPDATE projects SET foreman_id = COALESCE(foreman_id, ?), updated_at = ? WHERE id = ?",
                        (user_id, now_ts(), project_id),
                    )
                create_audit(
                    con,
                    director["id"],
                    "update_user",
                    "user",
                    user_id,
                    {"login": login, "project_ids": project_ids},
                )
                con.commit()
                refreshed = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            response = {
                "ok": True,
                "id": user_id,
                "login": login,
                "email": email if user_is_hidden_admin(director) else None,
                "phone": phone if user_is_hidden_admin(director) else None,
                "role": normalize_role(refreshed["role"]) if refreshed else primary_role,
                "roles": role_codes,
                "firstName": first_name,
                "lastName": last_name,
                "displayName": display_user_name(name, first_name, last_name, login),
                "name": display_user_name(name, first_name, last_name, login),
                "projectIds": project_ids,
            }
            if int(director.get("id") or 0) == int(user_id) and refreshed:
                response["currentUser"] = user_payload(refreshed)
            self.send_json(HTTPStatus.OK, response)
            return

        clerk_user_id = None
        with db() as con:
            existing_roles = {
                normalize_role(row["code"])
                for row in con.execute("SELECT code FROM roles").fetchall()
            }
            if any(role_code not in existing_roles for role_code in role_codes):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_role"})
                return
            release_deleted_user_identity(con, login, email, phone)
            if user_login_conflict(con, login):
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            unique_conflict = user_unique_conflict(con, email, phone)
            if unique_conflict:
                self.send_json(HTTPStatus.CONFLICT, unique_conflict)
                return
            if clerk_enabled() and email:
                existing_email = con.execute(
                    "SELECT id FROM users WHERE lower(email) = ? AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_active, 1) = 1",
                    (email.lower(),),
                ).fetchone()
                if existing_email:
                    self.send_json(HTTPStatus.CONFLICT, {"error": "email_already_used", "message": "Этот Email уже зарегистрирован в системе"})
                    return
            if project_ids:
                placeholders = ",".join("?" for _ in project_ids)
                existing_project_count = con.execute(
                    f"SELECT COUNT(*) FROM projects WHERE id IN ({placeholders})",
                    project_ids,
                ).fetchone()[0]
                if int(existing_project_count or 0) != len(project_ids):
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "project_not_found"})
                    return

        if clerk_enabled():
            first_name, last_name = split_person_name(name)
            try:
                clerk_user = clerk_api_request(
                    "/users",
                    method="POST",
                    payload={
                        "email_address": [email],
                        "password": password,
                        "username": login,
                        "first_name": first_name,
                        "last_name": last_name,
                        "skip_password_checks": False,
                        "skip_password_requirement": False,
                    },
                )
                clerk_user_id = str(clerk_user.get("id") or "").strip() or None
            except Exception as error:
                self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "clerk_create_user_failed", "detail": str(error)})
                return

        with db() as con:
            try:
                cur = con.execute(
                    """
                    INSERT INTO users (login, email, phone, clerk_user_id, password_hash, role, first_name, last_name, name, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                    """,
                    (login, email, phone, clerk_user_id, hash_password(password), primary_role, first_name, last_name, name, now_ts(), now_ts()),
                )
            except sqlite3.IntegrityError:
                self.send_json(HTTPStatus.CONFLICT, {"error": "login_exists"})
                return
            for role_code in role_codes:
                role_row = con.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
                if role_row:
                    con.execute(
                        """
                        INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
                        VALUES (?, ?, ?)
                        """,
                        (cur.lastrowid, role_row["id"], now_ts()),
                    )
            for project_id in project_ids:
                con.execute(
                    """
                    INSERT OR IGNORE INTO object_assignments (object_id, user_id, role_code, responsibility, is_primary, assigned_by, assigned_at)
                    VALUES (?, ?, 'foreman', 'РџСЂРѕСЂР°Р± РѕР±СЉРµРєС‚Р°', 0, ?, ?)
                    """,
                    (project_id, cur.lastrowid, director["id"], now_ts()),
                )
                con.execute(
                    "INSERT OR IGNORE INTO user_project_access (user_id, project_id) VALUES (?, ?)",
                    (cur.lastrowid, project_id),
                )
                con.execute(
                    "UPDATE projects SET foreman_id = COALESCE(foreman_id, ?), updated_at = ? WHERE id = ?",
                    (cur.lastrowid, now_ts(), project_id),
                )
            create_audit(
                con,
                director["id"],
                "create_foreman",
                "user",
                cur.lastrowid,
                {"login": login, "roles": role_codes, "project_ids": project_ids},
            )
            con.commit()
        self.send_json(
            HTTPStatus.CREATED,
            {
                "id": cur.lastrowid,
                "login": login,
                "email": email if user_is_hidden_admin(director) else None,
                "phone": phone if user_is_hidden_admin(director) else None,
                "clerkUserId": clerk_user_id if user_is_hidden_admin(director) else None,
                "role": primary_role,
                "roles": role_codes,
                "firstName": first_name,
                "lastName": last_name,
                "displayName": display_user_name(name, first_name, last_name, login),
                "name": display_user_name(name, first_name, last_name, login),
                "projectIds": project_ids,
            },
        )


    def api_delete_managed_user(self, path: str) -> None:
        actor = self.require_user()
        if not actor:
            return
        if not user_is_main_admin(actor):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden", "message": "Доступ разрешен только Главному Админу"})
            return
        user_id = parse_path_int(path, 3)
        if not user_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_user_id"})
            return
        if int(actor.get("id") or 0) == int(user_id):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "cannot_delete_self", "message": "\u041d\u0435\u043b\u044c\u0437\u044f \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442"})
            return
        with db() as con:
            user_row = con.execute(
                "SELECT id, login, email, phone, name FROM users WHERE id = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
                (user_id,),
            ).fetchone()
            if not user_row:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "user_not_found", "message": "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d"})
                return
            con.execute("DELETE FROM object_assignments WHERE user_id = ?", (user_id,))
            con.execute("DELETE FROM user_project_access WHERE user_id = ?", (user_id,))
            con.execute("DELETE FROM user_roles WHERE user_id = ?", (user_id,))
            con.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            con.execute(
                "UPDATE projects SET foreman_id = NULL, updated_at = ? WHERE foreman_id = ?",
                (now_ts(), user_id),
            )
            con.execute(
                "UPDATE users SET login = ?, email = NULL, phone = NULL, is_active = 0, is_deleted = 1, status = 'deleted', updated_at = ? WHERE id = ?",
                (f"deleted_user_{user_id}_{now_ts()}", now_ts(), user_id),
            )
            create_audit(
                con,
                actor["id"],
                "delete_user",
                "user",
                user_id,
                {"login": user_row["login"], "name": user_row["name"]},
            )
            con.commit()
        self.send_json(HTTPStatus.OK, {"ok": True, "id": user_id})









    def api_companies(self) -> None:
        warehouse_api_companies(self)

    def api_create_company(self) -> None:
        warehouse_api_create_company(self)

    def api_project_warehouse_matches(self, path: str) -> None:
        warehouse_api_project_warehouse_matches(self, path)

    def api_warehouse_items(self) -> None:
        warehouse_api_warehouse_items(self)

    def api_warehouse_list(self) -> None:
        warehouse_api_warehouse_list(self)

    def api_warehouse_receipt(self) -> None:
        warehouse_api_warehouse_receipt(self)

    def api_warehouse_transfer(self, path: str) -> None:
        warehouse_api_warehouse_transfer(self, path)

    def api_warehouse_issue(self, path: str) -> None:
        warehouse_api_warehouse_issue(self, path)

    def api_project_supplier_offers(self, path: str) -> None:
        warehouse_api_project_supplier_offers(self, path)

    def api_create_market_counterparty(self, path: str) -> None:
        warehouse_api_create_market_counterparty(self, path)

    def api_create_supplier_offer(self, path: str) -> None:
        warehouse_api_create_supplier_offer(self, path)

    def api_clear_supplier_selection(self, path: str) -> None:
        warehouse_api_clear_supplier_selection(self, path)

    def api_update_supplier_offer(self, path: str) -> None:
        warehouse_api_update_supplier_offer(self, path)

    def api_project_legacy_economics_migration(self, path: str) -> None:
        legacy_api_project_legacy_economics_migration(self, path)

    def api_scan_project_legacy_economics(self, path: str) -> None:
        legacy_api_scan_project_legacy_economics(self, path)

    def api_update_project_legacy_economics_review(self, path: str) -> None:
        legacy_api_update_project_legacy_economics_review(self, path)

    def api_ignore_project_legacy_economics_review(self, path: str) -> None:
        legacy_api_ignore_project_legacy_economics_review(self, path)

    def api_confirm_project_legacy_economics_review(self, path: str) -> None:
        legacy_api_confirm_project_legacy_economics_review(self, path)

    def api_project_financial_baselines(self, path: str) -> None:
        economics_api_project_financial_baselines(self, path)

    def api_create_financial_baseline(self, path: str) -> None:
        economics_api_create_financial_baseline(self, path)

    def api_update_financial_baseline(self, path: str) -> None:
        economics_api_update_financial_baseline(self, path)

    def api_update_financial_baseline_successors(self, path: str) -> None:
        economics_api_update_financial_baseline_successors(self, path)

    def api_submit_financial_baseline(self, path: str) -> None:
        economics_api_submit_financial_baseline(self, path)

    def api_return_financial_baseline(self, path: str) -> None:
        economics_api_return_financial_baseline(self, path)

    def api_approve_financial_baseline(self, path: str) -> None:
        economics_api_approve_financial_baseline(self, path)

    def api_project_commitments(self, path: str) -> None:
        economics_api_project_commitments(self, path)

    def api_create_commitment(self, path: str) -> None:
        economics_api_create_commitment(self, path)

    def api_create_commitment_from_offer(self, path: str) -> None:
        economics_api_create_commitment_from_offer(self, path)

    def api_update_commitment(self, path: str) -> None:
        economics_api_update_commitment(self, path)

    def api_replace_commitment_lines(self, path: str) -> None:
        economics_workflow_api_replace_commitment_lines(self, path)

    def api_submit_commitment(self, path: str) -> None:
        economics_api_submit_commitment(self, path)

    def api_return_commitment(self, path: str) -> None:
        economics_workflow_api_return_commitment(self, path)

    def api_approve_commitment(self, path: str) -> None:
        economics_api_approve_commitment(self, path)

    def api_cancel_commitment(self, path: str) -> None:
        economics_api_cancel_commitment(self, path)

    def api_project_actual_costs(self, path: str) -> None:
        economics_api_project_actual_costs(self, path)

    def api_create_actual_cost(self, path: str) -> None:
        economics_api_create_actual_cost(self, path)

    def api_create_actual_cost_from_stock_move(self, path: str) -> None:
        economics_api_create_actual_cost_from_stock_move(self, path)

    def api_create_actual_cost_from_warehouse_transfer(self, path: str) -> None:
        economics_api_create_actual_cost_from_warehouse_transfer(self, path)

    def api_update_actual_cost(self, path: str) -> None:
        economics_api_update_actual_cost(self, path)

    def api_submit_actual_cost(self, path: str) -> None:
        economics_api_submit_actual_cost(self, path)

    def api_return_actual_cost(self, path: str) -> None:
        economics_workflow_api_return_actual_cost(self, path)

    def api_approve_actual_cost(self, path: str) -> None:
        economics_api_approve_actual_cost(self, path)

    def api_reverse_actual_cost(self, path: str) -> None:
        economics_api_reverse_actual_cost(self, path)

    def api_project_cash_flow(self, path: str) -> None:
        economics_api_project_cash_flow(self, path)

    def api_create_payment_allocation(self, path: str) -> None:
        economics_api_create_payment_allocation(self, path)

    def api_update_payment_allocation(self, path: str) -> None:
        economics_api_update_payment_allocation(self, path)

    def api_submit_payment_allocation(self, path: str) -> None:
        economics_api_submit_payment_allocation(self, path)

    def api_return_payment_allocation(self, path: str) -> None:
        economics_workflow_api_return_payment_allocation(self, path)

    def api_approve_payment_allocation(self, path: str) -> None:
        economics_api_approve_payment_allocation(self, path)

    def api_reverse_payment_allocation(self, path: str) -> None:
        economics_api_reverse_payment_allocation(self, path)

    def api_project_economics(self, path: str) -> None:
        economics_api_project_economics(self, path)

    def api_project_forecasts(self, path: str) -> None:
        economics_workflow_api_project_forecasts(self, path)

    def api_project_forecast_price_sources(self, path: str) -> None:
        economics_workflow_api_project_forecast_price_sources(self, path)

    def api_calculate_project_forecast(self, path: str) -> None:
        economics_api_calculate_project_forecast(self, path)

    def api_submit_project_forecast(self, path: str) -> None:
        economics_api_submit_project_forecast(self, path)

    def api_return_project_forecast(self, path: str) -> None:
        economics_workflow_api_return_project_forecast(self, path)

    def api_approve_project_forecast(self, path: str) -> None:
        economics_api_approve_project_forecast(self, path)

    def set_project_foremen(
        self,
        con: sqlite3.Connection,
        project_id: int,
        foreman_ids: list[int],
        assigned_by: int,
    ) -> list[int]:
        return projects_set_project_foremen(con, project_id, foreman_ids, assigned_by)

    def api_projects(self) -> None:
        projects_api_projects(self)

    def api_create_project(self) -> None:
        projects_api_create_project(self)

    def api_update_project(self, path: str) -> None:
        projects_api_update_project(self, path)

    def api_delete_project(self, path: str) -> None:
        projects_api_delete_project(self, path)

    def can_access_project(self, user: dict, project_id: int) -> bool:
        return projects_can_access_project(self, user, project_id)

    def require_project_access(self, project_id: int) -> dict | None:
        return projects_require_project_access(self, project_id)

    def api_project_detail(self, path: str) -> None:
        projects_api_project_detail(self, path)

    def api_project_assignments(self, path: str) -> None:
        projects_api_project_assignments(self, path)

    def api_create_project_assignment(self, path: str) -> None:
        projects_api_create_project_assignment(self, path)

    def api_claim_project_foreman(self, path: str) -> None:
        projects_api_claim_project_foreman(self, path)

    def daily_task_payload(self, row: sqlite3.Row) -> dict:
        creator_role = normalize_role(row["creator_role"]) if "creator_role" in row.keys() and row["creator_role"] else ""
        payload = {
            "id": row["id"],
            "userId": row["user_id"],
            "createdBy": row["created_by"] if "created_by" in row.keys() else None,
            "text": row["text"],
            "status": row["status"],
            "date": row["task_date"],
            "completedAt": row["completed_at"],
            "archivedAt": row["archived_at"] if "archived_at" in row.keys() else None,
            "createdAt": row["created_at"] if "created_at" in row.keys() else None,
            "fromBoss": creator_role in {"admin", "main_admin", "director"},
        }
        if "user_name" in row.keys():
            payload["userName"] = display_user_name(
                row["user_name"],
                row["user_first_name"] if "user_first_name" in row.keys() else "",
                row["user_last_name"] if "user_last_name" in row.keys() else "",
                row["user_login"] if "user_login" in row.keys() else "",
            )
        if "user_avatar_url" in row.keys():
            payload["userAvatarUrl"] = row["user_avatar_url"]
            payload["userAvatar"] = row["user_avatar_url"]
        if "creator_name" in row.keys():
            payload["creatorName"] = display_user_name(
                row["creator_name"],
                row["creator_first_name"] if "creator_first_name" in row.keys() else "",
                row["creator_last_name"] if "creator_last_name" in row.keys() else "",
                row["creator_login"] if "creator_login" in row.keys() else "",
            )
        if "creator_avatar_url" in row.keys():
            payload["creatorAvatarUrl"] = row["creator_avatar_url"]
            payload["creatorAvatar"] = row["creator_avatar_url"]
        if creator_role:
            payload["creatorRole"] = creator_role
        return payload

    def daily_task_manager(self, user: dict) -> bool:
        perms = user.get("permissions") if isinstance(user.get("permissions"), dict) else {}
        return user_has_any_role(user, {"admin", "director"}) or perms.get("dailyTasks") == "all" or perms.get("fullAccess")

    def daily_task_now(self) -> str:
        return datetime.now(APP_TIMEZONE).replace(microsecond=0, tzinfo=None).isoformat()

    def daily_task_users(self, con: sqlite3.Connection, viewer: dict | None = None) -> list[dict]:
        rows = con.execute(
            """
            SELECT id, login, role, first_name, last_name, name, avatar_url
            FROM users
            WHERE is_active = 1
              AND COALESCE(is_deleted, 0) = 0
              AND role NOT IN ('customer', 'client')
            ORDER BY name COLLATE NOCASE, id
            """
        ).fetchall()
        def viewer_is_same_user(row: sqlite3.Row) -> bool:
            if not viewer:
                return False
            try:
                return int(viewer.get("id")) == int(row["id"])
            except (TypeError, ValueError):
                return False
        return [
            {
                "id": row["id"],
                "login": row["login"],
                "role": normalize_role(row["role"]),
                "firstName": row["first_name"] or split_user_name(row["name"])[0],
                "lastName": row["last_name"] or split_user_name(row["name"])[1],
                "name": display_user_name(row["name"], row["first_name"], row["last_name"], row["login"]),
                "displayName": display_user_name(row["name"], row["first_name"], row["last_name"], row["login"]),
                "avatar": row["avatar_url"],
                "avatarUrl": row["avatar_url"],
            }
            for row in rows
            if (not user_is_hidden_admin(row) or user_is_hidden_admin(viewer))
            and (
                not user_is_main_admin_account(row)
                or viewer_is_same_user(row)
            )
        ]

    def daily_task_rows(self, con: sqlite3.Connection, user: dict, archive: bool = False, user_id: int | None = None) -> list[sqlite3.Row]:
        where: list[str] = []
        args: list[object] = []
        if archive:
            where.append("t.status IN ('archived','done')")
        else:
            where.append("t.status IN ('planned','in_progress')")
        if user_id:
            where.append("t.user_id = ?")
            args.append(user_id)
        if user_is_main_admin_account(user):
            where.append("(NOT (lower(COALESCE(u.login, '')) = 'admin' OR u.role = 'main_admin') OR u.id = ?)")
            args.append(int(user["id"]))
        else:
            where.append("NOT (lower(COALESCE(u.login, '')) = 'admin' OR u.role = 'main_admin')")
            if not user_is_hidden_admin(user):
                where.append("NOT (u.role = 'admin')")
        return con.execute(
            """
            SELECT
                t.id,
                t.user_id,
                t.text,
                t.status,
                t.task_date,
                t.completed_at,
                t.archived_at,
                t.created_by,
                t.created_at,
                t.updated_at,
                u.name AS user_name,
                u.login AS user_login,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.avatar_url AS user_avatar_url,
                creator.name AS creator_name,
                creator.login AS creator_login,
                creator.first_name AS creator_first_name,
                creator.last_name AS creator_last_name,
                creator.avatar_url AS creator_avatar_url,
                creator.role AS creator_role
            FROM daily_tasks t
            JOIN users u ON u.id = t.user_id
            LEFT JOIN users creator ON creator.id = t.created_by
            WHERE """ + " AND ".join(where) + """
            ORDER BY COALESCE(t.completed_at, t.archived_at, t.updated_at) DESC, t.id DESC
            """,
            args,
        ).fetchall()

    def api_daily_tasks(self) -> None:
        user = self.require_user()
        if not user:
            return
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        archive = str((query.get("archive") or ["0"])[0]).lower() in {"1", "true", "yes"}
        requested_user_id = None
        raw_user_id = str((query.get("userId") or query.get("user_id") or [""])[0]).strip()
        raw_user_id_key = raw_user_id.lower()
        if raw_user_id and raw_user_id_key != "all":
            if raw_user_id_key == "me":
                requested_user_id = int(user["id"])
            else:
                try:
                    requested_user_id = int(raw_user_id)
                except ValueError:
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_user_id"})
                    return
        with db() as con:
            rows = self.daily_task_rows(con, user, archive=archive, user_id=requested_user_id)
            users = self.daily_task_users(con, user)
        self.send_json(
            HTTPStatus.OK,
            {
                "tasks": [self.daily_task_payload(row) for row in rows],
                "users": users,
                "canSeeAll": True,
                "today": TODAY_ISO,
            },
        )

    def api_create_daily_task(self) -> None:
        user = self.require_user()
        if not user:
            return
        payload = self.read_json()
        raw_items = payload.get("tasks")
        if isinstance(raw_items, list):
            texts = [str(item or "").strip() for item in raw_items]
        else:
            texts = [line.strip() for line in str(payload.get("text", "")).splitlines()]
        texts = [text for text in texts if text]
        if not texts:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "empty_task"})
            return
        target_user_id = int(user["id"])
        if self.daily_task_manager(user):
            raw_target_user_id = payload.get("userId", payload.get("user_id", user["id"]))
            raw_target_user_id = str(raw_target_user_id if raw_target_user_id is not None else "").strip()
            if raw_target_user_id.lower() in {"", "all", "me", "undefined", "null"}:
                target_user_id = int(user["id"])
            else:
                try:
                    target_user_id = int(raw_target_user_id)
                except (TypeError, ValueError):
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_user_id"})
                    return
        task_date = str(payload.get("date") or TODAY_ISO).strip() or TODAY_ISO
        status = str(payload.get("status") or "planned").strip()
        if status not in {"planned", "in_progress", "done", "archived"}:
            status = "planned"
        completed_at = self.daily_task_now() if status == "done" else None
        archived_at = self.daily_task_now() if status == "archived" else None
        with db() as con:
            user_row = con.execute(
                "SELECT id FROM users WHERE id = ? AND is_active = 1 AND COALESCE(is_deleted, 0) = 0",
                (target_user_id,),
            ).fetchone()
            if not user_row:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "user_not_found"})
                return
            for text in texts:
                con.execute(
                    """
                    INSERT INTO daily_tasks (user_id, text, status, task_date, completed_at, archived_at, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (target_user_id, text, status, task_date, completed_at, archived_at, user["id"], now_ts(), now_ts()),
                )
            con.commit()
            rows = self.daily_task_rows(con, user, archive=False)
        self.send_json(HTTPStatus.CREATED, {"tasks": [self.daily_task_payload(row) for row in rows]})

    def api_update_daily_task(self, path: str) -> None:
        user = self.require_user()
        if not user:
            return
        task_id = parse_path_int(path, 2)
        if not task_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_task_id"})
            return
        payload = self.read_json()
        with db() as con:
            row = con.execute("SELECT * FROM daily_tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "task_not_found"})
                return
            is_manager = self.daily_task_manager(user)
            is_assignee = int(row["user_id"]) == int(user["id"])
            if not is_manager and not is_assignee:
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "not_task_owner"})
                return
            status = str(payload.get("status", row["status"]) or row["status"]).strip()
            if status not in {"planned", "in_progress", "done", "archived"}:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_status"})
                return
            if status == "done" and not is_assignee:
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "not_task_assignee"})
                return
            text = str(payload.get("text", row["text"]) or "").strip()
            if not text:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "empty_task"})
                return
            task_date = str(payload.get("date", row["task_date"]) or TODAY_ISO).strip() or TODAY_ISO
            target_user_id = int(row["user_id"])
            raw_target_user_id = payload.get("userId", payload.get("user_id"))
            if raw_target_user_id is not None and str(raw_target_user_id).strip():
                try:
                    requested_user_id = int(raw_target_user_id)
                except (TypeError, ValueError):
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_user_id"})
                    return
                if requested_user_id != target_user_id and not is_manager:
                    self.send_json(HTTPStatus.FORBIDDEN, {"error": "cannot_reassign_task"})
                    return
                target_user_id = requested_user_id
            target_user = con.execute(
                """
                SELECT id
                FROM users
                WHERE id = ?
                  AND is_active = 1
                  AND COALESCE(is_deleted, 0) = 0
                  AND role NOT IN ('customer', 'client')
                """,
                (target_user_id,),
            ).fetchone()
            if not target_user:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "user_not_found"})
                return
            completed_at = row["completed_at"]
            archived_at = row["archived_at"]
            timestamp = self.daily_task_now()
            if status == "done" and row["status"] != "done":
                completed_at = timestamp
            elif status != "done":
                completed_at = None
            if status == "archived" and row["status"] != "archived":
                archived_at = timestamp
            elif status != "archived":
                archived_at = None
            con.execute(
                """
                UPDATE daily_tasks
                SET user_id = ?, text = ?, status = ?, task_date = ?, completed_at = ?, archived_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (target_user_id, text, status, task_date, completed_at, archived_at, now_ts(), task_id),
            )
            con.commit()
            updated = con.execute(
                """
                SELECT
                    t.id,
                    t.user_id,
                    t.text,
                    t.status,
                    t.task_date,
                    t.completed_at,
                    t.archived_at,
                    t.created_by,
                    t.created_at,
                    t.updated_at,
                    u.name AS user_name,
                    u.login AS user_login,
                    u.first_name AS user_first_name,
                    u.last_name AS user_last_name,
                    u.avatar_url AS user_avatar_url,
                    creator.name AS creator_name,
                    creator.login AS creator_login,
                    creator.first_name AS creator_first_name,
                    creator.last_name AS creator_last_name,
                    creator.avatar_url AS creator_avatar_url,
                    creator.role AS creator_role
                FROM daily_tasks t
                JOIN users u ON u.id = t.user_id
                LEFT JOIN users creator ON creator.id = t.created_by
                WHERE t.id = ?
                """,
                (task_id,),
            ).fetchone()
        self.send_json(HTTPStatus.OK, {"task": self.daily_task_payload(updated)})

    def api_delete_daily_task(self, path: str) -> None:
        user = self.require_user()
        if not user:
            return
        task_id = parse_path_int(path, 2)
        if not task_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_task_id"})
            return
        with db() as con:
            row = con.execute("SELECT id, user_id FROM daily_tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                self.send_json(HTTPStatus.OK, {"ok": True, "id": task_id, "alreadyDeleted": True})
                return
            if not self.daily_task_manager(user) and int(row["user_id"]) != int(user["id"]):
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "not_task_owner"})
                return
            con.execute("DELETE FROM daily_tasks WHERE id = ?", (task_id,))
            con.commit()
        self.send_json(HTTPStatus.OK, {"ok": True, "id": task_id})

    def api_daily_standup(self) -> None:
        user = self.require_user()
        if not user:
            return
        if user_has_any_role(user, {"admin", "customer", "client"}):
            self.send_json(HTTPStatus.OK, {"shouldShow": False, "carryover": [], "today": TODAY_ISO})
            return
        with db() as con:
            existing = con.execute(
                "SELECT 1 FROM daily_standups WHERE user_id = ? AND report_date = ?",
                (user["id"], TODAY_ISO),
            ).fetchone()
            rows = con.execute(
                """
                SELECT t.*, u.name AS user_name, u.login AS user_login, u.first_name AS user_first_name, u.last_name AS user_last_name
                FROM daily_tasks t
                JOIN users u ON u.id = t.user_id
                WHERE t.user_id = ? AND t.status IN ('planned','in_progress') AND t.task_date < ?
                ORDER BY t.task_date ASC, t.id ASC
                """,
                (user["id"], TODAY_ISO),
            ).fetchall()
        self.send_json(
            HTTPStatus.OK,
            {
                "shouldShow": not bool(existing),
                "carryover": [self.daily_task_payload(row) for row in rows],
                "today": TODAY_ISO,
            },
        )

    def api_save_daily_standup(self) -> None:
        user = self.require_user()
        if not user:
            return
        if user_has_any_role(user, {"admin", "customer", "client"}):
            self.send_json(HTTPStatus.OK, {"ok": True, "tasks": []})
            return
        payload = self.read_json()
        raw_tasks = payload.get("tasks")
        if isinstance(raw_tasks, list):
            texts = [str(item or "").strip() for item in raw_tasks]
        else:
            texts = [line.strip() for line in str(payload.get("text", "")).splitlines()]
        texts = [text for text in texts if text]
        carryover = payload.get("carryover", [])
        if not isinstance(carryover, list):
            carryover = []
        timestamp = self.daily_task_now()
        with db() as con:
            con.execute("BEGIN IMMEDIATE")
            existing = con.execute(
                "SELECT 1 FROM daily_standups WHERE user_id = ? AND report_date = ?",
                (user["id"], TODAY_ISO),
            ).fetchone()
            if existing:
                rows = self.daily_task_rows(con, user, archive=False)
                self.send_json(HTTPStatus.OK, {"ok": True, "today": TODAY_ISO, "alreadySaved": True, "tasks": [self.daily_task_payload(row) for row in rows]})
                return
            for item in carryover:
                if not isinstance(item, dict):
                    continue
                try:
                    task_id = int(item.get("id"))
                except (TypeError, ValueError):
                    continue
                action = str(item.get("action") or "").strip()
                row = con.execute(
                    "SELECT id FROM daily_tasks WHERE id = ? AND user_id = ? AND status IN ('planned','in_progress')",
                    (task_id, user["id"]),
                ).fetchone()
                if not row:
                    continue
                if action == "transfer":
                    con.execute(
                        """
                        UPDATE daily_tasks
                        SET status = 'planned', task_date = ?, completed_at = NULL, archived_at = NULL, updated_at = ?
                        WHERE id = ?
                        """,
                        (TODAY_ISO, now_ts(), task_id),
                    )
                elif action == "archive":
                    con.execute(
                        """
                        UPDATE daily_tasks
                        SET status = 'archived', archived_at = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (timestamp, now_ts(), task_id),
                    )
            for text in texts:
                con.execute(
                    """
                    INSERT INTO daily_tasks (user_id, text, status, task_date, created_by, created_at, updated_at)
                    VALUES (?, ?, 'planned', ?, ?, ?, ?)
                    """,
                    (user["id"], text, TODAY_ISO, user["id"], now_ts(), now_ts()),
                )
            con.execute(
                """
                INSERT OR IGNORE INTO daily_standups (user_id, report_date, created_at)
                VALUES (?, ?, ?)
                """,
                (user["id"], TODAY_ISO, now_ts()),
            )
            con.commit()
            rows = self.daily_task_rows(con, user, archive=False)
        self.send_json(HTTPStatus.OK, {"ok": True, "today": TODAY_ISO, "tasks": [self.daily_task_payload(row) for row in rows]})

    def api_dashboard(self) -> None:
        user = self.require_user()
        if not user:
            return
        with db() as con:
            if user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"}):
                projects = con.execute(
                    """
                    SELECT id, title, client_id, customer_company_id, own_legal_entity_id,
                           address, city, region, client_name, contract_no, contract_date,
                           director_id, foreman_id, buyer_id, client_user_id, status, progress,
                           budget, paid, spent, started_at, deadline_at,
                           internal_schedule_status, internal_schedule_version,
                           internal_schedule_approved_at, customer_schedule_status,
                           customer_schedule_version, customer_schedule_approved_at,
                           schedule_generated_at, description, created_at, updated_at
                    FROM projects
                    """
                ).fetchall()
            elif user_has_any_role(user, {"foreman"}):
                projects = con.execute(
                    """
                    SELECT DISTINCT p.id, p.title, p.client_id, p.customer_company_id,
                           p.own_legal_entity_id, p.address, p.city, p.region, p.client_name,
                           p.contract_no, p.contract_date, p.director_id, p.foreman_id,
                           p.buyer_id, p.client_user_id, p.status, p.progress, p.budget,
                           p.paid, p.spent, p.started_at, p.deadline_at,
                           p.internal_schedule_status, p.internal_schedule_version,
                           p.internal_schedule_approved_at, p.customer_schedule_status,
                           p.customer_schedule_version, p.customer_schedule_approved_at,
                           p.schedule_generated_at, p.description, p.created_at, p.updated_at
                    FROM projects p
                    JOIN object_assignments oa ON oa.object_id = p.id
                    WHERE oa.user_id = ? AND oa.role_code = 'foreman'
                    ORDER BY p.id DESC
                    """,
                    (user["id"],),
                ).fetchall()
            else:
                projects = con.execute(
                    """
                    SELECT p.id, p.title, p.client_id, p.customer_company_id,
                           p.own_legal_entity_id, p.address, p.city, p.region, p.client_name,
                           p.contract_no, p.contract_date, p.director_id, p.foreman_id,
                           p.buyer_id, p.client_user_id, p.status, p.progress, p.budget,
                           p.paid, p.spent, p.started_at, p.deadline_at,
                           p.internal_schedule_status, p.internal_schedule_version,
                           p.internal_schedule_approved_at, p.customer_schedule_status,
                           p.customer_schedule_version, p.customer_schedule_approved_at,
                           p.schedule_generated_at, p.description, p.created_at, p.updated_at
                    FROM projects p
                    LEFT JOIN user_project_access a ON a.project_id = p.id
                    LEFT JOIN object_assignments oa ON oa.object_id = p.id
                    WHERE a.user_id = ? OR oa.user_id = ?
                    GROUP BY p.id
                    """,
                    (user["id"], user["id"]),
                ).fetchall()
            project_ids = [row["id"] for row in projects]
            total_paid = 0.0
            total_spent = 0.0
            portfolio_economics = None
            if project_ids and user_can_view_project_economics(user):
                placeholders = ",".join("?" for _ in project_ids)
                cash_rows = con.execute(
                    f"""
                    SELECT direction, COALESCE(SUM(amount), 0) AS amount
                    FROM finance_entries
                    WHERE project_id IN ({placeholders})
                      AND status = 'paid'
                      AND paid_date IS NOT NULL AND length(trim(paid_date)) > 0
                    GROUP BY direction
                    """,
                    project_ids,
                ).fetchall()
                for cash_row in cash_rows:
                    if cash_row["direction"] == "income":
                        total_paid = float(cash_row["amount"] or 0)
                    elif cash_row["direction"] == "expense":
                        total_spent = float(cash_row["amount"] or 0)

                baseline_rows = con.execute(
                    f"""
                    SELECT baseline.id, baseline.project_id,
                           COALESCE((
                               SELECT SUM(line.net_amount_kopecks)
                               FROM project_revenue_lines line
                               WHERE line.baseline_id = baseline.id
                           ), 0) AS revenue_net_kopecks,
                           COALESCE((
                               SELECT SUM(line.net_amount_kopecks)
                               FROM project_budget_lines line
                               WHERE line.baseline_id = baseline.id
                           ), 0) AS target_cost_net_kopecks
                    FROM project_financial_baselines baseline
                    WHERE baseline.project_id IN ({placeholders})
                      AND baseline.status = 'approved'
                    """,
                    project_ids,
                ).fetchall()
                configured_ids = {int(row["project_id"]) for row in baseline_rows}
                commitment_total = int(con.execute(
                    f"""
                    SELECT COALESCE(SUM(line.net_amount_kopecks), 0)
                    FROM project_commitment_lines line
                    JOIN project_commitments commitment ON commitment.id = line.commitment_id
                    WHERE commitment.project_id IN ({placeholders})
                      AND commitment.status = 'approved'
                    """,
                    project_ids,
                ).fetchone()[0])
                actual_total = int(con.execute(
                    f"""
                    SELECT COALESCE(SUM(
                        CASE WHEN entry.entry_kind = 'cost'
                             THEN entry.net_amount_kopecks
                             ELSE -entry.net_amount_kopecks END
                    ), 0)
                    FROM project_actual_cost_entries entry
                    WHERE entry.project_id IN ({placeholders})
                      AND entry.status = 'approved'
                    """,
                    project_ids,
                ).fetchone()[0])
                forecast_rows = con.execute(
                    f"""
                    SELECT forecast.project_id, forecast.baseline_id,
                           forecast.source_state_hash, forecast.eac_net_kopecks,
                           forecast.forecast_margin_net_kopecks
                    FROM project_forecasts forecast
                    JOIN project_financial_baselines baseline
                      ON baseline.id = forecast.baseline_id
                     AND baseline.project_id = forecast.project_id
                     AND baseline.status = 'approved'
                    JOIN (
                        SELECT candidate.project_id, MAX(candidate.version_no) AS version_no
                        FROM project_forecasts candidate
                        JOIN project_financial_baselines current_baseline
                          ON current_baseline.id = candidate.baseline_id
                         AND current_baseline.project_id = candidate.project_id
                         AND current_baseline.status = 'approved'
                        WHERE candidate.project_id IN ({placeholders})
                          AND candidate.status = 'approved'
                        GROUP BY candidate.project_id
                    ) latest
                      ON latest.project_id = forecast.project_id
                     AND latest.version_no = forecast.version_no
                    WHERE forecast.status = 'approved'
                    """,
                    project_ids,
                ).fetchall()
                fresh_forecast_rows = []
                stale_forecast_projects = 0
                for forecast_row in forecast_rows:
                    current_source_hash = economics_forecast_source_state_hash(
                        con,
                        int(forecast_row["project_id"]),
                        int(forecast_row["baseline_id"]),
                    )
                    if current_source_hash == str(forecast_row["source_state_hash"]):
                        fresh_forecast_rows.append(forecast_row)
                    else:
                        stale_forecast_projects += 1
                portfolio_economics = {
                    "configuredProjects": len(configured_ids),
                    "unconfiguredProjects": max(len(project_ids) - len(configured_ids), 0),
                    "forecastProjects": len(fresh_forecast_rows),
                    "staleForecastProjects": stale_forecast_projects,
                    "missingForecastProjects": max(
                        len(configured_ids) - len(forecast_rows), 0
                    ),
                    "forecastAttentionProjects": max(
                        len(configured_ids) - len(fresh_forecast_rows), 0
                    ),
                    "contractRevenueNetKopecks": sum(
                        int(row["revenue_net_kopecks"]) for row in baseline_rows
                    ),
                    "targetCostNetKopecks": sum(
                        int(row["target_cost_net_kopecks"]) for row in baseline_rows
                    ),
                    "committedTotalNetKopecks": commitment_total,
                    "actualCostNetKopecks": actual_total,
                    "eacNetKopecks": (
                        sum(int(row["eac_net_kopecks"]) for row in fresh_forecast_rows)
                        if fresh_forecast_rows else None
                    ),
                    "forecastMarginNetKopecks": (
                        sum(int(row["forecast_margin_net_kopecks"]) for row in fresh_forecast_rows)
                        if fresh_forecast_rows else None
                    ),
                }
            active = sum(1 for row in projects if "работ" in str(row["status"]).lower())
            shortages = 0
            critical_items = []
            for project in projects:
                for item in material_summary_rows(con, int(project["id"])):
                    if normalize_estimate_item_kind(item.get("itemKind")) == "work":
                        continue
                    if item["missingQty"] > 0:
                        work_date = item.get("stageStartDate") or item.get("needByDate") or item.get("stageEndDate") or ""
                        parsed_work_date = parse_iso_date(str(work_date or ""))
                        shortages += 1
                        critical_items.append({
                            "projectId": project["id"],
                            "projectTitle": project["title"],
                            "title": item["title"],
                            "missingQty": item["missingQty"],
                            "unit": item["unit"],
                            "sectionTitle": item.get("sectionTitle") or "",
                            "stageTitle": item.get("stageTitle") or "",
                            "needByDate": item.get("needByDate") or "",
                            "workDate": work_date,
                            "daysUntilWork": (parsed_work_date - parse_iso_date(TODAY_ISO)).days if parsed_work_date and parse_iso_date(TODAY_ISO) else None,
                        })
            open_tasks = 0
            if project_ids:
                placeholders = ",".join("?" for _ in project_ids)
                open_tasks = con.execute(
                    f"SELECT COUNT(*) FROM tasks WHERE project_id IN ({placeholders}) AND status != 'done'",
                    project_ids,
                ).fetchone()[0]
                task_rows = con.execute(
                    f"""
                    SELECT t.title, t.status, t.priority, t.due_at, t.created_at, p.title AS project_title
                    FROM tasks t
                    JOIN projects p ON p.id = t.project_id
                    WHERE t.project_id IN ({placeholders})
                    ORDER BY CASE WHEN t.status = 'done' THEN 1 ELSE 0 END, t.due_at IS NULL, t.due_at ASC, t.id DESC
                    LIMIT 6
                    """,
                    project_ids,
                ).fetchall()
                document_rows = con.execute(
                    f"""
                    SELECT d.title, d.doc_type, d.status, d.created_at, p.title AS project_title
                    FROM documents d
                    JOIN projects p ON p.id = d.project_id
                    WHERE d.project_id IN ({placeholders})
                    {"" if user["role"] != "customer" else "AND d.is_client_visible = 1"}
                    ORDER BY d.id DESC
                    LIMIT 5
                    """,
                    project_ids,
                ).fetchall()
                daily_log_rows = con.execute(
                    f"""
                    SELECT l.title, l.report_date, l.work_done, l.created_at, p.title AS project_title
                    FROM daily_logs l
                    JOIN projects p ON p.id = l.project_id
                    WHERE l.project_id IN ({placeholders})
                    {"" if user["role"] != "customer" else "AND l.is_client_visible = 1"}
                    ORDER BY l.report_date DESC, l.id DESC
                    LIMIT 6
                    """,
                    project_ids,
                ).fetchall()
                if user["role"] == "customer":
                    message_rows = con.execute(
                        f"""
                        SELECT m.body, m.created_at, c.title AS chat_title, p.title AS project_title
                        FROM chat_messages m
                        JOIN chats c ON c.id = m.chat_id
                        JOIN projects p ON p.id = c.project_id
                        WHERE c.project_id IN ({placeholders}) AND c.chat_type = 'client'
                        ORDER BY m.id DESC
                        LIMIT 5
                        """,
                        project_ids,
                    ).fetchall()
                    stock_rows = []
                else:
                    message_rows = con.execute(
                        f"""
                        SELECT m.body, m.created_at, c.title AS chat_title, p.title AS project_title
                        FROM chat_messages m
                        JOIN chats c ON c.id = m.chat_id
                        JOIN projects p ON p.id = c.project_id
                        WHERE c.project_id IN ({placeholders})
                        ORDER BY m.id DESC
                        LIMIT 5
                        """,
                        project_ids,
                    ).fetchall()
                    stock_rows = con.execute(
                        f"""
                        SELECT sm.move_type, sm.qty, sm.comment, sm.created_at, e.title AS material_title, e.unit, p.title AS project_title
                        FROM stock_moves sm
                        JOIN estimate_items e ON e.id = sm.estimate_item_id
                        JOIN projects p ON p.id = sm.project_id
                        WHERE sm.project_id IN ({placeholders})
                        ORDER BY sm.id DESC
                        LIMIT 5
                        """,
                        project_ids,
                    ).fetchall()
            else:
                task_rows = []
                document_rows = []
                daily_log_rows = []
                message_rows = []
                stock_rows = []
            recent_activity = []
            for row in task_rows:
                recent_activity.append({
                    "kind": "task",
                    "title": row["title"],
                    "text": f"{row['project_title']} · {row['priority']} · до {row['due_at'] or 'без срока'}",
                    "createdAt": row["created_at"],
                })
            for row in document_rows:
                recent_activity.append({
                    "kind": "document",
                    "title": row["title"],
                    "text": f"{row['project_title']} · {row['status']}",
                    "createdAt": row["created_at"],
                })
            for row in daily_log_rows:
                recent_activity.append({
                    "kind": "log",
                    "title": row["title"],
                    "text": f"{row['project_title']} · {row['report_date']} · {row['work_done'][:80]}",
                    "createdAt": row["created_at"],
                })
            for row in message_rows:
                recent_activity.append({
                    "kind": "message",
                    "title": row["chat_title"],
                    "text": f"{row['project_title']} · {row['body'][:90]}",
                    "createdAt": row["created_at"],
                })
            for row in stock_rows:
                move_label = {
                    "purchase": "Закупка",
                    "receipt": "Поступление",
                    "use": "Использовано",
                    "writeoff": "Списание",
                }.get(row["move_type"], row["move_type"])
                recent_activity.append({
                    "kind": "stock",
                    "title": row["material_title"],
                    "text": f"{row['project_title']} · {move_label} {row['qty']} {row['unit']}",
                    "createdAt": row["created_at"],
                })
            recent_activity = sorted(recent_activity, key=lambda item: item["createdAt"] or 0, reverse=True)[:8]
            today_actions = []
            if critical_items and user["role"] != "customer":
                first = critical_items[0]
                today_actions.append(f"Закрыть нехватку: {first['title']} — нужно ещё {first['missingQty']} {first['unit']}.")
            if open_tasks:
                today_actions.append(f"Разобрать открытые задачи: {open_tasks} шт. по активным объектам.")
            if user_can_view_project_economics(user) and total_paid - total_spent < 0:
                today_actions.append("Проверить кассовый разрыв: расходы сейчас выше оплат.")
            if user["role"] == "purchaser":
                today_actions.append("Обновить поступления и списания на складе, чтобы смета показывала реальные остатки.")
            if user["role"] == "customer":
                today_actions.append("Проверить график работ, видимые документы и сообщения команды по объекту.")
            if not today_actions:
                today_actions.append("Критических блокеров нет — держим график и фиксируем факт каждый день.")
        data = {
            "projectsCount": len(projects),
            "activeProjects": active,
            "avgProgress": round(sum(float(row["progress"] or 0) for row in projects) / len(projects), 1) if projects else 0,
            "shortagesCount": 0 if user["role"] == "customer" else shortages,
            "openTasksCount": open_tasks,
            "criticalItems": [] if user["role"] == "customer" else critical_items[:10],
            "todayActions": today_actions[:6],
            "recentActivity": recent_activity,
            "projects": [serialize_project(row, user) for row in projects[:6]],
        }
        if user_can_view_project_economics(user):
            data.update({
                "portfolioEconomics": portfolio_economics or {
                    "configuredProjects": 0,
                    "unconfiguredProjects": len(projects),
                    "forecastProjects": 0,
                    "missingForecastProjects": 0,
                    "contractRevenueNetKopecks": 0,
                    "targetCostNetKopecks": 0,
                    "committedTotalNetKopecks": 0,
                    "actualCostNetKopecks": 0,
                    "eacNetKopecks": None,
                    "forecastMarginNetKopecks": None,
                },
                "cashBalance": total_paid - total_spent,
            })
        self.send_json(HTTPStatus.OK, data)






    def api_materials_summary(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            items = material_summary_rows(con, project_id)
        self.send_json(
            HTTPStatus.OK,
            {
                "items": items,
                "canViewProcurementPrices": user_can_view_procurement_prices(user),
            },
        )

    def api_estimate_reconciliation(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director", "foreman"})):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        can_manage_snapshots = user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"})
        with db() as con:
            payload = build_reconciliation(con, project_id, user_can_view_procurement_prices(user))
            payload["liveItemCount"] = int(
                con.execute("SELECT COUNT(*) FROM estimate_items WHERE project_id = ?", (project_id,)).fetchone()[0]
            )
        payload.update(
            {
                "canManageSnapshots": can_manage_snapshots,
                "canReview": True,
                "canViewProcurementPrices": user_can_view_procurement_prices(user),
            }
        )
        self.send_json(HTTPStatus.OK, payload)

    def api_capture_estimate_reconciliation_snapshot(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"})):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        source_kind = str(payload.get("sourceKind", payload.get("source_kind", ""))).strip().lower()
        source_label = str(payload.get("sourceLabel", payload.get("source_label", ""))).strip()
        source_reference = str(payload.get("sourceReference", payload.get("source_reference", ""))).strip()
        use_current = bool(payload.get("useCurrent", payload.get("use_current", False)))
        items = payload.get("items")
        if not use_current and not isinstance(items, list):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "snapshot_items_required"})
            return
        try:
            with db() as con:
                if use_current:
                    snapshot, created = capture_live_snapshot(
                        con,
                        project_id,
                        source_kind,
                        user["id"],
                        now_ts(),
                        source_label or ("Текущая смета" if source_kind == "original" else "Текущая выгрузка ИИ"),
                        source_reference,
                    )
                else:
                    snapshot, created = capture_snapshot(
                        con,
                        project_id,
                        source_kind,
                        items,
                        user["id"],
                        now_ts(),
                        source_label,
                        source_reference,
                    )
                create_audit(
                    con,
                    user["id"],
                    "capture_estimate_reconciliation_snapshot",
                    "project",
                    project_id,
                    {
                        "snapshot_id": int(snapshot["id"]),
                        "source_kind": source_kind,
                        "version_no": int(snapshot["version_no"]),
                        "created": created,
                    },
                )
                con.commit()
                result = build_reconciliation(con, project_id, user_can_view_procurement_prices(user))
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        result.update(
            {
                "created": created,
                "canManageSnapshots": True,
                "canReview": True,
                "canViewProcurementPrices": user_can_view_procurement_prices(user),
            }
        )
        self.send_json(HTTPStatus.CREATED if created else HTTPStatus.OK, result)

    def api_review_estimate_reconciliation(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director", "foreman"})):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        try:
            original_snapshot_id = int(payload.get("originalSnapshotId", payload.get("original_snapshot_id", 0)))
            ai_snapshot_id = int(payload.get("aiSnapshotId", payload.get("ai_snapshot_id", 0)))
        except (TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_snapshot_id"})
            return
        row_key = str(payload.get("rowKey", payload.get("row_key", ""))).strip()
        status = str(payload.get("status", "")).strip()
        comment = str(payload.get("comment", "")).strip()
        try:
            with db() as con:
                current = build_reconciliation(con, project_id, False)
                current_original = current.get("originalSnapshot") or {}
                current_ai = current.get("aiSnapshot") or {}
                if (
                    not current.get("ready")
                    or int(current_original.get("id") or 0) != original_snapshot_id
                    or int(current_ai.get("id") or 0) != ai_snapshot_id
                ):
                    self.send_json(HTTPStatus.CONFLICT, {"error": "estimate_reconciliation_version_changed"})
                    return
                if row_key not in {str(row.get("rowKey")) for row in current.get("rows", [])}:
                    self.send_json(HTTPStatus.NOT_FOUND, {"error": "reconciliation_row_not_found"})
                    return
                review = save_estimate_reconciliation_review(
                    con,
                    project_id,
                    original_snapshot_id,
                    ai_snapshot_id,
                    row_key,
                    status,
                    comment,
                    user["id"],
                    now_ts(),
                )
                create_audit(
                    con,
                    user["id"],
                    "review_estimate_reconciliation_row",
                    "estimate_reconciliation_review",
                    int(review["id"]),
                    {
                        "project_id": project_id,
                        "original_snapshot_id": original_snapshot_id,
                        "ai_snapshot_id": ai_snapshot_id,
                        "row_key": row_key,
                        "status": status,
                    },
                )
                con.commit()
                result = build_reconciliation(con, project_id, user_can_view_procurement_prices(user))
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        result.update(
            {
                "canManageSnapshots": user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"}),
                "canReview": True,
                "canViewProcurementPrices": user_can_view_procurement_prices(user),
            }
        )
        self.send_json(HTTPStatus.OK, result)

    def api_project_warehouse_control(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director", "foreman"})):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        with db() as con:
            payload = build_warehouse_control(con, project_id)
        payload.update(
            {
                "canManageNorms": user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"}),
                "canRecordFacts": True,
                "canReverseFacts": user_is_main_admin(user) or user_has_any_role(user, {"admin", "director", "foreman"}),
            }
        )
        self.send_json(HTTPStatus.OK, payload)

    def api_upsert_work_material_norm(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"})):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        try:
            work_item_id = int(payload.get("workItemId", payload.get("work_item_id", 0)))
            material_item_id = int(payload.get("materialItemId", payload.get("material_item_id", 0)))
            qty_per_work_unit = float(payload.get("qtyPerWorkUnit", payload.get("qty_per_work_unit", 0)))
            waste_percent = float(payload.get("wastePercent", payload.get("waste_percent", 0)) or 0)
        except (TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_material_norm"})
            return
        try:
            with db() as con:
                con.execute("BEGIN IMMEDIATE")
                norm, created = upsert_work_material_norm(
                    con,
                    project_id,
                    work_item_id,
                    material_item_id,
                    qty_per_work_unit,
                    waste_percent,
                    bool(payload.get("isActive", payload.get("is_active", True))),
                    user["id"],
                    now_ts(),
                )
                create_audit(
                    con,
                    user["id"],
                    "upsert_work_material_norm",
                    "work_material_norm",
                    int(norm["id"]),
                    {
                        "project_id": project_id,
                        "work_item_id": work_item_id,
                        "material_item_id": material_item_id,
                        "qty_per_work_unit": qty_per_work_unit,
                        "waste_percent": waste_percent,
                        "is_active": bool(norm["is_active"]),
                    },
                )
                con.commit()
                result = build_warehouse_control(con, project_id)
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        result.update({"created": created, "canManageNorms": True, "canRecordFacts": True, "canReverseFacts": True})
        self.send_json(HTTPStatus.CREATED if created else HTTPStatus.OK, result)

    def api_create_project_work_fact(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director", "foreman"})):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        try:
            work_item_id = int(payload.get("workItemId", payload.get("work_item_id", 0)))
            quantity = float(payload.get("quantity", payload.get("qty", 0)))
        except (TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_work_fact"})
            return
        report_date = str(payload.get("reportDate", payload.get("report_date", ""))).strip() or TODAY_ISO
        idempotency_key = str(payload.get("idempotencyKey", payload.get("idempotency_key", ""))).strip() or f"work-fact-{secrets.token_hex(16)}"
        try:
            with db() as con:
                con.execute("BEGIN IMMEDIATE")
                fact, created = create_work_fact(
                    con,
                    project_id,
                    work_item_id,
                    report_date,
                    quantity,
                    str(payload.get("comment", "")).strip(),
                    idempotency_key,
                    user["id"],
                    now_ts(),
                )
                recalc_project_progress(con, project_id)
                create_audit(
                    con,
                    user["id"],
                    "create_project_work_fact",
                    "project_work_fact",
                    int(fact["id"]),
                    {
                        "project_id": project_id,
                        "work_item_id": work_item_id,
                        "quantity": quantity,
                        "report_date": report_date,
                        "created": created,
                    },
                )
                con.commit()
                result = build_warehouse_control(con, project_id)
        except ValueError as error:
            status = HTTPStatus.CONFLICT if str(error) in {
                "work_material_norms_required",
                "work_fact_idempotency_conflict",
            } else HTTPStatus.BAD_REQUEST
            self.send_json(status, {"error": str(error)})
            return
        result.update(
            {
                "created": created,
                "factId": int(fact["id"]),
                "canManageNorms": user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"}),
                "canRecordFacts": True,
                "canReverseFacts": True,
            }
        )
        self.send_json(HTTPStatus.CREATED if created else HTTPStatus.OK, result)

    def api_reverse_project_work_fact(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        fact_id = parse_path_int(path, 5)
        if not project_id or not fact_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_work_fact_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not (user_is_main_admin(user) or user_has_any_role(user, {"admin", "director", "foreman"})):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        idempotency_key = str(payload.get("idempotencyKey", payload.get("idempotency_key", ""))).strip() or f"work-fact-reversal-{secrets.token_hex(16)}"
        try:
            with db() as con:
                con.execute("BEGIN IMMEDIATE")
                reversal, created = reverse_work_fact(
                    con,
                    project_id,
                    fact_id,
                    str(payload.get("reason", payload.get("comment", ""))).strip(),
                    idempotency_key,
                    user["id"],
                    now_ts(),
                )
                recalc_project_progress(con, project_id)
                create_audit(
                    con,
                    user["id"],
                    "reverse_project_work_fact",
                    "project_work_fact",
                    int(reversal["id"]),
                    {"project_id": project_id, "reverses_fact_id": fact_id, "created": created},
                )
                con.commit()
                result = build_warehouse_control(con, project_id)
        except ValueError as error:
            if str(error) == "work_fact_not_found":
                status = HTTPStatus.NOT_FOUND
            elif str(error) == "work_fact_idempotency_conflict":
                status = HTTPStatus.CONFLICT
            else:
                status = HTTPStatus.BAD_REQUEST
            self.send_json(status, {"error": str(error)})
            return
        result.update(
            {
                "created": created,
                "reversalId": int(reversal["id"]),
                "canManageNorms": user_is_main_admin(user) or user_has_any_role(user, {"admin", "director"}),
                "canRecordFacts": True,
                "canReverseFacts": True,
            }
        )
        self.send_json(HTTPStatus.CREATED if created else HTTPStatus.OK, result)

    def api_create_material(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not user_has_any_role(user, {"admin", "director"}):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        unit = str(payload.get("unit", "")).strip() or "шт"
        planned_qty, planned_price = normalize_estimate_item_values(payload, unit)
        if not title or planned_qty <= 0:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "title_and_qty_required"})
            return
        with db() as con:
            existing = con.execute(
                "SELECT id FROM estimate_items WHERE project_id = ? AND lower(title) = lower(?) AND unit = ?",
                (project_id, title, unit),
            ).fetchone()
            if existing:
                self.send_json(HTTPStatus.CONFLICT, {"error": "material_exists"})
                return
            cur = con.execute(
                """
                INSERT INTO estimate_items (project_id, title, unit, planned_qty, planned_price, item_kind)
                VALUES (?, ?, ?, ?, ?, 'material')
                """,
                (project_id, title, unit, planned_qty, planned_price),
            )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'create_material', 'estimate_item', ?, ?, ?)
                """,
                (user["id"], cur.lastrowid, json.dumps({"project_id": project_id, "title": title}, ensure_ascii=False), now_ts()),
            )
            con.commit()
            items = material_summary_rows(con, project_id)
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid, "items": items})

    def api_update_material(self, path: str) -> None:
        material_id = parse_path_int(path, 2)
        if not material_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_material_id"})
            return
        payload = self.read_json()
        with db() as con:
            material = con.execute("SELECT * FROM estimate_items WHERE id = ?", (material_id,)).fetchone()
            if not material:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "material_not_found"})
                return
            user = self.require_project_access(int(material["project_id"]))
            if not user:
                return
            if user["role"] == "customer":
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
                return
            if not user_can_view_procurement_prices(user) and any(
                key in payload for key in ("planned_price", "plannedPrice")
            ):
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "price_fields_forbidden"})
                return
            stage_id = payload.get("stage_id", payload.get("stageId", material["stage_id"]))
            try:
                stage_id = int(stage_id) if stage_id not in (None, "", 0, "0") else None
            except (TypeError, ValueError):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stage_id"})
                return
            if stage_id:
                stage = con.execute(
                    "SELECT id FROM work_stages WHERE id = ? AND project_id = ?",
                    (stage_id, material["project_id"]),
                ).fetchone()
                if not stage:
                    self.send_json(HTTPStatus.BAD_REQUEST, {"error": "stage_not_found"})
                    return
            raw_delivery_days = payload.get("delivery_days", payload.get("deliveryDays", material["delivery_days"]))
            try:
                delivery_days = int(raw_delivery_days) if raw_delivery_days not in (None, "") else None
            except (TypeError, ValueError):
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_delivery_days"})
                return
            if delivery_days is not None:
                delivery_days = max(0, min(delivery_days, 90))
            merged_material = dict(material)
            merged_material.update(payload)
            con.execute(
                """
                UPDATE estimate_items
                SET title = ?, unit = ?, planned_qty = ?, planned_price = ?, stage_id = ?, item_kind = ?, section_title = ?, delivery_days = ?, need_by_date = ?, notes = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    str(payload.get("title", material["title"])).strip() or material["title"],
                    str(payload.get("unit", material["unit"])).strip() or material["unit"],
                    max(0.01, normalize_estimate_planned_qty(
                        payload.get("unit", material["unit"]),
                        payload.get("planned_qty", payload.get("plannedQty", material["planned_qty"])),
                    )),
                    max(0.0, float(payload.get("planned_price", payload.get("plannedPrice", material["planned_price"])) or 0)),
                    stage_id,
                    resolved_estimate_item_kind(merged_material),
                    resolved_estimate_section_title(merged_material),
                    delivery_days,
                    str(payload.get("need_by_date", payload.get("needByDate", material["need_by_date"] or ""))).strip() or None,
                    str(payload.get("notes", material["notes"] or "")).strip() or None,
                    now_ts(),
                    material_id,
                ),
            )
            create_audit(
                con,
                user["id"],
                "update_material",
                "estimate_item",
                material_id,
                {"project_id": material["project_id"], "stage_id": stage_id},
            )
            con.commit()
            items = material_summary_rows(con, int(material["project_id"]))
        self.send_json(HTTPStatus.OK, {"id": material_id, "items": items})

    def api_update_estimate_position(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        item_id = parse_path_int(path, 4)
        if not project_id or not item_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_estimate_item_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not user_can_manage_schedule(user):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return

        payload = self.read_json()
        allowed_fields = {
            "title", "unit", "planned_qty", "plannedQty", "section_title", "sectionTitle",
            "expected_kind", "expectedKind",
        }
        if any(key not in allowed_fields for key in payload):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "estimate_position_fields_forbidden"})
            return

        with db() as con:
            con.execute("BEGIN IMMEDIATE")
            item = con.execute(
                "SELECT * FROM estimate_items WHERE id = ? AND project_id = ?",
                (item_id, project_id),
            ).fetchone()
            if not item:
                con.rollback()
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "estimate_position_not_found"})
                return

            item_kind = resolved_estimate_item_kind(item)
            expected_kind = normalize_estimate_item_kind(
                payload.get("expected_kind", payload.get("expectedKind", item_kind))
            )
            if expected_kind != item_kind:
                con.rollback()
                self.send_json(HTTPStatus.CONFLICT, {"error": "estimate_position_kind_mismatch"})
                return

            title = re.sub(r"\s+", " ", str(payload.get("title", item["title"]) or "").strip())
            unit = re.sub(r"\s+", " ", str(payload.get("unit", item["unit"]) or "").strip())
            section_title = re.sub(
                r"\s+",
                " ",
                str(payload.get("section_title", payload.get("sectionTitle", item["section_title"] or "")) or "").strip(),
            ) or "Без раздела"
            raw_qty = payload.get("planned_qty", payload.get("plannedQty", item["planned_qty"]))
            planned_qty = normalize_estimate_planned_qty(unit, raw_qty)
            if not title or not unit or planned_qty <= 0:
                con.rollback()
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "estimate_position_fields_required"})
                return
            if len(title) > 300 or len(unit) > 40 or len(section_title) > 200:
                con.rollback()
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "estimate_position_fields_too_long"})
                return
            kind_probe = dict(item)
            kind_probe.update({"title": title, "unit": unit, "section_title": section_title})
            if resolved_estimate_item_kind(kind_probe) != item_kind:
                con.rollback()
                self.send_json(HTTPStatus.CONFLICT, {"error": "estimate_position_title_kind_conflict"})
                return

            before = {
                "title": str(item["title"] or ""),
                "unit": str(item["unit"] or ""),
                "planned_qty": float(item["planned_qty"] or 0),
                "section_title": str(item["section_title"] or ""),
                "item_kind": item_kind,
            }
            after = {
                "title": title,
                "unit": unit,
                "planned_qty": planned_qty,
                "section_title": section_title,
                "item_kind": item_kind,
            }
            con.execute(
                """
                UPDATE estimate_items
                SET title = ?, unit = ?, planned_qty = ?, section_title = ?, updated_at = ?
                WHERE id = ? AND project_id = ?
                """,
                (title, unit, planned_qty, section_title, now_ts(), item_id, project_id),
            )
            progress = recalc_project_progress(con, project_id, section_title)
            create_audit(
                con,
                user["id"],
                "update_estimate_position",
                "estimate_item",
                item_id,
                {"project_id": project_id, "before": before, "after": after},
            )
            con.commit()
            items = material_summary_rows(con, project_id)
            updated_item = next((candidate for candidate in items if int(candidate["id"]) == item_id), None)

        self.send_json(
            HTTPStatus.OK,
            {
                "id": item_id,
                "item": updated_item,
                "items": items,
                "itemKind": item_kind,
                "progress": progress,
            },
        )


    def api_project_market_analysis(self, path: str) -> None:
        try:
            project_id = parse_path_int(path, 2)
            if not project_id:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
                return
            user = self.require_project_access(project_id)
            if not user:
                return
            if user["role"] == "customer":
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
                return
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            kind = str((params.get("kind") or ["material"])[0] or "material").strip().lower()
            if kind not in {"material", "work"}:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_kind"})
                return
            if not user_can_view_procurement_prices(user):
                with db() as con:
                    payload = restricted_market_analysis_payload(
                        con,
                        project_id,
                        kind,
                        user_can_submit_procurement_price(user),
                    )
                self.send_json(HTTPStatus.OK, payload)
                return
            status, payload = request_market_analysis(project_id, kind)
            payload["canViewProcurementPrices"] = True
            self.send_json(status, payload)
        except LookupError as error:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": str(error)})
        except Exception as e:
            print("Крэш в market_analysis:", e)
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                market_empty_payload("error", "market_analysis_failed"),
            )





    def api_project_estimates(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            project = con.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not project:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                return
            estimates = list_project_estimates(con, project_id)
        self.send_json(
            HTTPStatus.OK,
            {
                "projectId": project_id,
                "estimates": estimates,
                "summary": {
                    "estimateCount": len(estimates),
                    "itemCount": sum(int(item.get("itemCount") or 0) for item in estimates),
                },
            },
        )

    def api_project_bootstrap(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not user_has_any_role(user, {"admin", "director"}):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        project_payload = payload.get("project") if isinstance(payload.get("project"), dict) else {}
        stages_payload = payload.get("stages") if isinstance(payload.get("stages"), list) else []
        materials_payload = payload.get("materials") if isinstance(payload.get("materials"), list) else []
        tasks_payload = payload.get("tasks") if isinstance(payload.get("tasks"), list) else []
        default_estimate_source = payload.get("estimate_source", payload.get("estimateSource", payload.get("source")))
        if not isinstance(default_estimate_source, dict):
            default_estimate_source = {
                "sourceType": "manual",
                "sourceKey": str(payload.get("sourceReference", payload.get("source_reference", ""))).strip() or f"bootstrap:{project_id}",
                "title": str(payload.get("sourceLabel", payload.get("source_label", "Пакет AutoBot"))).strip() or "Пакет AutoBot",
                "sourceReference": str(payload.get("sourceReference", payload.get("source_reference", ""))).strip(),
            }
        replace_existing = bool(payload.get("replace_existing", payload.get("replaceExisting", True)))
        if not stages_payload and not materials_payload and not tasks_payload and not project_payload:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bootstrap_payload_empty"})
            return
        estimate_value_issues = estimate_import_value_issues(materials_payload)
        if estimate_value_issues:
            self.send_json(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "estimate_values_need_review",
                    "message": "Импорт остановлен: в смете количество × цена не совпадает с итогом позиции на порядок. Исправьте распознавание и повторите загрузку.",
                    "issues": estimate_value_issues,
                },
            )
            return

        with db() as con:
            project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not project:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
                return

            if replace_existing and (
                project_has_immutable_financial_history(con, project_id)
                or project_has_protected_operational_history(con, project_id)
            ):
                self.send_json(
                    HTTPStatus.CONFLICT,
                    {
                        "error": "bootstrap_replace_blocked_by_project_history",
                        "message": "Повторный импорт не выполнен: на объекте уже есть финансовая или операционная история. Сначала сделайте безопасную сверку новой сметы без замены текущих данных.",
                    },
                )
                return

            # Update core project fields from the parsed tender/estimate package.
            if project_payload:
                updates = (
                    str(project_payload.get("title", project["title"])).strip() or project["title"],
                    str(project_payload.get("address", project["address"])).strip() or project["address"],
                    str(project_payload.get("client_name", project_payload.get("clientName", project["client_name"]))).strip() or project["client_name"],
                    str(project_payload.get("contract_no", project_payload.get("contractNo", project["contract_no"] or ""))).strip() or None,
                    str(project_payload.get("contract_date", project_payload.get("contractDate", project["contract_date"] or ""))).strip() or None,
                    str(project_payload.get("city", project["city"] or "")).strip() or None,
                    str(project_payload.get("region", project["region"] or "")).strip() or None,
                    float(project_payload.get("budget", project["budget"] or 0) or 0),
                    str(project_payload.get("started_at", project_payload.get("startedAt", project["started_at"] or ""))).strip() or None,
                    str(project_payload.get("deadline_at", project_payload.get("deadlineAt", project["deadline_at"] or ""))).strip() or None,
                    normalize_project_description(project_payload.get("description", project["description"] or "")),
                    now_ts(),
                    project_id,
                )
                con.execute(
                    """
                    UPDATE projects
                    SET title = ?, address = ?, client_name = ?, contract_no = ?, contract_date = ?,
                        city = ?, region = ?, budget = ?, started_at = ?, deadline_at = ?, description = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    updates,
                )

            if replace_existing:
                con.execute("DELETE FROM work_stages WHERE project_id = ?", (project_id,))
                con.execute("DELETE FROM estimate_items WHERE project_id = ?", (project_id,))
                con.execute("DELETE FROM project_estimates WHERE project_id = ?", (project_id,))
                con.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))

            stage_map: dict[str, int] = {}

            def insert_stage_nodes(nodes: list[dict], parent_id: int | None = None, depth: int = 0) -> None:
                for index, item in enumerate(nodes, start=1):
                    if not isinstance(item, dict):
                        continue
                    title = str(item.get("title", "")).strip()
                    if not title:
                        continue
                    stage_kind = str(item.get("stage_kind", item.get("stageKind", ("section" if depth == 0 else "work")))).strip() or "work"
                    status_code = str(item.get("status_code", item.get("statusCode", "not_started"))).strip() or "not_started"
                    key = str(item.get("key", item.get("code", title))).strip() or title
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
                            int(item.get("position", index) or index),
                            parent_id,
                            stage_kind,
                            status_code,
                            str(item.get("planned_start", item.get("plannedStart", ""))).strip() or None,
                            str(item.get("planned_end", item.get("plannedEnd", ""))).strip() or None,
                            str(item.get("customer_start", item.get("customerStart", ""))).strip() or None,
                            str(item.get("customer_end", item.get("customerEnd", ""))).strip() or None,
                            max(0, min(100, int(item.get("progress", 0) or 0))),
                            str(item.get("responsible", "")).strip() or None,
                            str(item.get("notes", "")).strip() or None,
                            1 if item.get("is_client_visible", item.get("isClientVisible", True)) else 0,
                            1 if item.get("depends_on_materials", item.get("dependsOnMaterials", False)) else 0,
                            now_ts(),
                            now_ts(),
                        ),
                    )
                    stage_id = int(cur.lastrowid)
                    stage_map[key] = stage_id
                    stage_map[title] = stage_id
                    children = item.get("children") if isinstance(item.get("children"), list) else []
                    if children:
                        insert_stage_nodes(children, stage_id, depth + 1)

            insert_stage_nodes(stages_payload)

            imported_estimate_source_ids: set[int] = set()
            for item_index, item in enumerate(materials_payload, start=1):
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                if not title:
                    continue
                stage_ref = str(item.get("stage_key", item.get("stageKey", item.get("stage_title", item.get("stageTitle", ""))))).strip()
                stage_id = stage_map.get(stage_ref) if stage_ref else None
                item_kind = resolved_estimate_item_kind(item)
                section_title = resolved_estimate_section_title(item)
                unit = str(item.get("unit", "шт")).strip() or "шт"
                planned_qty, planned_price = normalize_estimate_item_values(item, unit)
                article = str(item.get("article", item.get("sku", item.get("code", item.get("basis", item.get("basis_code", item.get("basisCode", ""))))))).strip() or None
                try:
                    labor_hours_total = float(item.get("labor_hours_total", item.get("laborHoursTotal")))
                    labor_hours_total = labor_hours_total if labor_hours_total > 0 else None
                except (TypeError, ValueError):
                    labor_hours_total = None
                try:
                    default_crew_size = int(item.get("default_crew_size", item.get("defaultCrewSize", item.get("crew_size", item.get("crewSize")))))
                    default_crew_size = default_crew_size if default_crew_size > 0 else None
                except (TypeError, ValueError):
                    default_crew_size = None
                descriptor = estimate_source_descriptor(
                    default_estimate_source,
                    item,
                    project_id=project_id,
                )
                estimate_source = upsert_project_estimate(con, project_id, descriptor, user["id"])
                estimate_source_id = int(estimate_source["id"])
                imported_estimate_source_ids.add(estimate_source_id)
                item_source_key = source_item_key(item, item_index)
                existing_item = con.execute(
                    """
                    SELECT id FROM estimate_items
                    WHERE project_id = ? AND estimate_source_id = ? AND source_item_key = ?
                    """,
                    (project_id, estimate_source_id, item_source_key),
                ).fetchone()
                item_values = (
                    title,
                    unit,
                    max(0.000001, planned_qty),
                    max(0.0, planned_price),
                    stage_id,
                    item_kind,
                    section_title,
                    article,
                    str(item.get("need_by_date", item.get("needByDate", ""))).strip() or None,
                    str(item.get("notes", "")).strip() or None,
                    labor_hours_total,
                    default_crew_size,
                    now_ts(),
                )
                if existing_item:
                    con.execute(
                        """
                        UPDATE estimate_items
                        SET title = ?, unit = ?, planned_qty = ?, planned_price = ?, stage_id = ?,
                            item_kind = ?, section_title = ?, article = ?, need_by_date = ?, notes = ?,
                            labor_hours_total = ?, default_crew_size = ?, updated_at = ?, is_deleted = 0
                        WHERE id = ?
                        """,
                        (*item_values, existing_item["id"]),
                    )
                else:
                    con.execute(
                        """
                        INSERT INTO estimate_items (
                            project_id, estimate_source_id, source_item_key,
                            title, unit, planned_qty, planned_price, stage_id, item_kind,
                            section_title, article, need_by_date, notes, labor_hours_total,
                            default_crew_size, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (project_id, estimate_source_id, item_source_key, *item_values),
                    )

            ai_snapshot = None
            if materials_payload:
                ai_snapshot, _ = capture_live_snapshot(
                    con,
                    project_id,
                    "ai",
                    user["id"],
                    now_ts(),
                    str(payload.get("sourceLabel", payload.get("source_label", "Пакет AutoBot"))).strip() or "Пакет AutoBot",
                    str(payload.get("sourceReference", payload.get("source_reference", ""))).strip(),
                )

            for item in tasks_payload:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                if not title:
                    continue
                assignee_id = item.get("assignee_id", item.get("assigneeId"))
                try:
                    assignee_id = int(assignee_id) if assignee_id not in (None, "", 0, "0") else None
                except (TypeError, ValueError):
                    assignee_id = None
                con.execute(
                    """
                    INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_at, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        title,
                        str(item.get("description", "")).strip(),
                        str(item.get("status", "open")).strip() or "open",
                        str(item.get("priority", "normal")).strip() or "normal",
                        assignee_id,
                        str(item.get("due_at", item.get("dueAt", ""))).strip() or None,
                        user["id"],
                        now_ts(),
                        now_ts(),
                    ),
                )

            # If parser didn't send tasks, generate minimal startup tasks from imported structure.
            if not tasks_payload:
                generated = []
                if stages_payload:
                    generated.append(("Подтвердить график и структуру этапов", "Проверить импортированные разделы и сроки объекта", "high"))
                if materials_payload:
                    generated.append(("Проверить потребность по материалам", "Сверить импортированные материалы и даты потребности", "high"))
                if project_payload.get("contract_no") or project_payload.get("contract_date"):
                    generated.append(("Проверить договорные условия объекта", "Убедиться, что предстроительные условия и даты старта учтены", "normal"))
                for title, description, priority in generated:
                    con.execute(
                        """
                        INSERT INTO tasks (project_id, title, description, status, priority, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, 'open', ?, ?, ?, ?)
                        """,
                        (project_id, title, description, priority, user["id"], now_ts(), now_ts()),
                    )

            create_audit(
                con,
                user["id"],
                "bootstrap_project",
                "project",
                project_id,
                {
                    "replace_existing": replace_existing,
                    "stages": len(stages_payload),
                    "materials": len(materials_payload),
                    "tasks": len(tasks_payload),
                    "estimate_sources": len(imported_estimate_source_ids),
                    "ai_snapshot_id": int(ai_snapshot["id"]) if ai_snapshot else None,
                },
            )
            mark_project_schedule_draft(con, project_id)
            con.commit()
            project_row = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            stages = con.execute("SELECT COUNT(*) FROM work_stages WHERE project_id = ?", (project_id,)).fetchone()[0]
            materials = con.execute("SELECT COUNT(*) FROM estimate_items WHERE project_id = ?", (project_id,)).fetchone()[0]
            tasks = con.execute("SELECT COUNT(*) FROM tasks WHERE project_id = ?", (project_id,)).fetchone()[0]
            project_estimates = list_project_estimates(con, project_id)

        self.send_json(
            HTTPStatus.OK,
            {
                "project": serialize_project(project_row, user),
                "summary": {
                    "stages": stages,
                    "materials": materials,
                    "tasks": tasks,
                    "estimates": len(imported_estimate_source_ids),
                },
                "estimates": project_estimates,
            },
        )

    def api_import_estimate(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if not user_has_any_role(user, {"admin", "director"}):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return

        payload = self.read_json()
        items = payload.get("items")
        replace = bool(payload.get("replace", False))
        replace_source = bool(payload.get("replace_source", payload.get("replaceSource", False)))
        default_estimate_source = payload.get("estimate_source", payload.get("estimateSource", payload.get("source")))
        if not isinstance(default_estimate_source, dict):
            default_estimate_source = {
                "sourceType": "manual",
                "sourceKey": str(payload.get("sourceReference", payload.get("source_reference", ""))).strip() or f"manual:{project_id}",
                "title": str(payload.get("sourceLabel", payload.get("source_label", "Ручной импорт"))).strip() or "Ручной импорт",
                "sourceReference": str(payload.get("sourceReference", payload.get("source_reference", ""))).strip(),
            }
        if not isinstance(items, list) or not items:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "items_required"})
            return
        estimate_value_issues = estimate_import_value_issues(items)
        if estimate_value_issues:
            self.send_json(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "estimate_values_need_review",
                    "message": "Импорт остановлен: в смете количество × цена не совпадает с итогом позиции на порядок. Исправьте распознавание и повторите загрузку.",
                    "issues": estimate_value_issues,
                },
            )
            return

        normalized = []
        for item_index, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "")).strip()
            unit = str(item.get("unit", "")).strip() or "шт"
            planned_qty, planned_price = normalize_estimate_item_values(item, unit)
            if not title or planned_qty <= 0:
                continue
            item_kind = resolved_estimate_item_kind(item)
            section_title = resolved_estimate_section_title(item)
            article = str(item.get("article", item.get("sku", item.get("code", item.get("basis", item.get("basis_code", item.get("basisCode", ""))))))).strip() or None
            try:
                labor_hours_total = float(item.get("labor_hours_total", item.get("laborHoursTotal")))
                labor_hours_total = labor_hours_total if labor_hours_total > 0 else None
            except (TypeError, ValueError):
                labor_hours_total = None
            try:
                default_crew_size = int(item.get("default_crew_size", item.get("defaultCrewSize", item.get("crew_size", item.get("crewSize")))))
                default_crew_size = default_crew_size if default_crew_size > 0 else None
            except (TypeError, ValueError):
                default_crew_size = None
            normalized.append(
                {
                    "raw": item,
                    "position": item_index,
                    "title": title,
                    "unit": unit,
                    "planned_qty": planned_qty,
                    "planned_price": planned_price,
                    "item_kind": item_kind,
                    "section_title": section_title,
                    "article": article,
                    "labor_hours_total": labor_hours_total,
                    "default_crew_size": default_crew_size,
                }
            )

        if not normalized:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "no_valid_items"})
            return

        with db() as con:
            if replace:
                protected_actions = con.execute(
                    "SELECT COUNT(*) FROM daily_log_actions WHERE project_id = ?",
                    (project_id,),
                ).fetchone()[0]
                if protected_actions:
                    self.send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "estimate_replace_blocked_by_daily_log_actions",
                            "message": "Полная замена сметы недоступна: по её позициям уже применён учёт из дневных отчётов. Загрузите новую версию без удаления истории и выполните сверку.",
                            "actionCount": int(protected_actions),
                        },
                    )
                    return
                con.execute("DELETE FROM estimate_items WHERE project_id = ?", (project_id,))
                con.execute("DELETE FROM project_estimates WHERE project_id = ?", (project_id,))
            imported = 0
            imported_source_ids: set[int] = set()
            seen_source_item_keys: dict[int, set[str]] = {}
            for normalized_item in normalized:
                raw_item = normalized_item["raw"]
                descriptor = estimate_source_descriptor(
                    default_estimate_source,
                    raw_item,
                    project_id=project_id,
                )
                estimate_source = upsert_project_estimate(con, project_id, descriptor, user["id"])
                estimate_source_id = int(estimate_source["id"])
                item_source_key = source_item_key(raw_item, int(normalized_item["position"]))
                imported_source_ids.add(estimate_source_id)
                seen_source_item_keys.setdefault(estimate_source_id, set()).add(item_source_key)
                existing = con.execute(
                    """
                    SELECT id FROM estimate_items
                    WHERE project_id = ? AND estimate_source_id = ? AND source_item_key = ?
                    """,
                    (project_id, estimate_source_id, item_source_key),
                ).fetchone()
                item_values = (
                    normalized_item["title"],
                    normalized_item["unit"],
                    normalized_item["planned_qty"],
                    normalized_item["planned_price"],
                    normalized_item["item_kind"],
                    normalized_item["section_title"],
                    normalized_item["article"],
                    normalized_item["labor_hours_total"],
                    normalized_item["default_crew_size"],
                    str(raw_item.get("need_by_date", raw_item.get("needByDate", ""))).strip() or None,
                    str(raw_item.get("notes", "")).strip() or None,
                    now_ts(),
                )
                if existing:
                    con.execute(
                        """
                        UPDATE estimate_items
                        SET title = ?, unit = ?, planned_qty = ?, planned_price = ?, item_kind = ?,
                            section_title = ?, article = ?, labor_hours_total = ?, default_crew_size = ?,
                            need_by_date = ?, notes = ?, updated_at = ?, is_deleted = 0
                        WHERE id = ?
                        """,
                        (*item_values, existing["id"]),
                    )
                else:
                    con.execute(
                        """
                        INSERT INTO estimate_items (
                            project_id, estimate_source_id, source_item_key,
                            title, unit, planned_qty, planned_price, item_kind, section_title, article,
                            labor_hours_total, default_crew_size, need_by_date, notes, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (project_id, estimate_source_id, item_source_key, *item_values),
                    )
                imported += 1
            if replace_source:
                for estimate_source_id, seen_keys in seen_source_item_keys.items():
                    placeholders = ",".join("?" for _ in seen_keys)
                    con.execute(
                        f"""
                        UPDATE estimate_items
                        SET is_deleted = 1, updated_at = ?
                        WHERE project_id = ? AND estimate_source_id = ?
                          AND source_item_key IS NOT NULL
                          AND source_item_key NOT IN ({placeholders})
                        """,
                        (now_ts(), project_id, estimate_source_id, *sorted(seen_keys)),
                    )
            ai_snapshot, _ = capture_live_snapshot(
                con,
                project_id,
                "ai",
                user["id"],
                now_ts(),
                str(payload.get("sourceLabel", payload.get("source_label", "Импорт AutoBot"))).strip() or "Импорт AutoBot",
                str(payload.get("sourceReference", payload.get("source_reference", ""))).strip(),
            )
            con.execute(
                """
                INSERT INTO audit_log (user_id, action, entity, entity_id, payload, created_at)
                VALUES (?, 'import_estimate', 'project', ?, ?, ?)
                """,
                (
                    user["id"],
                    project_id,
                    json.dumps(
                        {
                            "count": imported,
                            "replace": replace,
                            "replace_source": replace_source,
                            "estimate_sources": len(imported_source_ids),
                            "ai_snapshot_id": int(ai_snapshot["id"]),
                        },
                        ensure_ascii=False,
                    ),
                    now_ts(),
                ),
            )
            con.commit()

            summary = material_summary_rows(con, project_id)
            estimates = list_project_estimates(con, project_id)
        self.send_json(
            HTTPStatus.CREATED,
            {
                "imported": imported,
                "estimateSources": len(imported_source_ids),
                "estimates": estimates,
                "items": summary,
                "aiSnapshotId": int(ai_snapshot["id"]),
            },
        )





    def api_project_analysis(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        with db() as con:
            project = con.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            materials = material_summary_rows(con, project_id)
            open_tasks = con.execute(
                "SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status != 'done'",
                (project_id,),
            ).fetchone()[0]
            stages = con.execute(
                "SELECT * FROM work_stages WHERE project_id = ? ORDER BY position",
                (project_id,),
            ).fetchall()
        if not project:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "project_not_found"})
            return

        shortages = [item for item in materials if item["missingQty"] > 0]
        low_stock = [
            item for item in materials
            if item["stockQty"] <= max(item["plannedQty"] * 0.1, 1) and item["usageProgress"] < 100
        ]
        avg_stage_progress = round(sum(float(stage["progress"]) for stage in stages) / len(stages), 1) if stages else float(project["progress"] or 0)
        material_purchase_progress = round(
            sum(item["purchaseProgress"] for item in materials) / len(materials),
            1,
        ) if materials else 0

        risks = []
        actions = []
        if shortages:
            for item in shortages:
                risks.append({
                    "level": "critical",
                    "title": f"Не хватает: {item['title']}",
                    "text": f"По смете нужно {item['plannedQty']} {item['unit']}, закрыто закупкой/поступлением {max(item['purchasedQty'], item['receivedQty'])}. Не хватает {item['missingQty']} {item['unit']}.",
                })
                actions.append(f"Создать заявку на закупку: {item['title']} — {item['missingQty']} {item['unit']}.")
        if low_stock:
            for item in low_stock:
                risks.append({
                    "level": "warning",
                    "title": f"Малый остаток: {item['title']}",
                    "text": f"Остаток {item['stockQty']} {item['unit']}, использовано {item['usedQty']} из {item['plannedQty']}.",
                })
        if open_tasks:
            actions.append(f"Проверить открытые задачи по объекту: {open_tasks}.")
        if not actions:
            actions.append("Критичных действий сейчас нет. Продолжать контроль списаний и графика.")

        payload = {
            "projectId": project_id,
            "projectProgress": project["progress"],
            "stageProgress": avg_stage_progress,
            "materialPurchaseProgress": material_purchase_progress,
            "shortagesCount": len(shortages),
            "openTasksCount": open_tasks,
            "risks": risks,
            "actions": actions,
        }
        if user["role"] == "customer":
            payload["risks"] = [risk for risk in risks if risk["level"] != "critical"][:2]
            payload["actions"] = ["Команда ведёт контроль материалов и графика. Критичные внутренние действия скрыты."]
        self.send_json(HTTPStatus.OK, payload)








    def api_material_schedule(self, path: str) -> None:
        return schedule_api_material_schedule(self, path)

    def api_save_material_schedule(self, path: str) -> None:
        return schedule_api_save_material_schedule(self, path)

    def api_project_auto_schedule(self, path: str) -> None:
        return schedule_api_project_auto_schedule(self, path)

    def api_project_section_schedule_forecast(self, path: str) -> None:
        return schedule_api_project_section_schedule_forecast(self, path)

    def api_project_schedule_status(self, path: str) -> None:
        return schedule_api_project_schedule_status(self, path)

    def api_update_project_schedule_status(self, path: str) -> None:
        return schedule_api_update_project_schedule_status(self, path)

    def api_project_stages(self, path: str) -> None:
        return schedule_api_project_stages(self, path)

    def api_create_project_stage(self, path: str) -> None:
        return schedule_api_create_project_stage(self, path)

    def api_update_stage(self, path: str) -> None:
        return schedule_api_update_stage(self, path)

    def api_project_tasks(self, path: str) -> None:
        return schedule_api_project_tasks(self, path)

    def api_create_task(self, path: str) -> None:
        return schedule_api_create_task(self, path)

    def api_update_task(self, path: str) -> None:
        return schedule_api_update_task(self, path)









    def recalc_project_finance_totals(self, con: sqlite3.Connection, project_id: int) -> None:
        return finance_recalc_project_finance_totals(self, con, project_id)

    def api_project_finances(self, path: str) -> None:
        return finance_api_project_finances(self, path)

    def api_create_finance_entry(self, path: str) -> None:
        return finance_api_create_finance_entry(self, path)

    def api_upload_finance_invoice(self, path: str) -> None:
        return finance_api_upload_finance_invoice(self, path)

    def api_update_finance_entry(self, path: str) -> None:
        return finance_api_update_finance_entry(self, path)

    def api_delete_finance_entry(self, path: str) -> None:
        return finance_api_delete_finance_entry(self, path)

    def api_pay_invoice(self) -> None:
        return finance_api_pay_invoice(self)














    def api_project_notifications(self, path: str) -> None:
        return comm_api_project_notifications(self, path)

    def api_project_documents(self, path: str) -> None:
        return comm_api_project_documents(self, path)

    def api_project_executive_docs(self, path: str) -> None:
        return comm_api_project_executive_docs(self, path)

    def api_create_project_executive_doc(self, path: str) -> None:
        return comm_api_create_project_executive_doc(self, path)

    def api_upload_project_document(self, path: str) -> None:
        return comm_api_upload_project_document(self, path)

    def api_document_file(self, path: str, inline: bool) -> None:
        return comm_api_document_file(self, path, inline)

    def api_project_daily_logs(self, path: str) -> None:
        return comm_api_project_daily_logs(self, path)

    def api_create_daily_log(self, path: str) -> None:
        return comm_api_create_daily_log(self, path)

    def api_delete_daily_log(self, path: str) -> None:
        return comm_api_delete_daily_log(self, path)

    def api_project_chats(self, path: str) -> None:
        return comm_api_project_chats(self, path)

    def can_access_chat(self, user: dict, chat_id: int) -> bool:
        return comm_can_access_chat(self, user, chat_id)

    def api_chat_messages(self, path: str) -> None:
        return comm_api_chat_messages(self, path)

    def api_create_chat_message(self, path: str) -> None:
        return comm_api_create_chat_message(self, path)

    def api_create_stock_move(self, path: str) -> None:
        project_id = parse_path_int(path, 2)
        if not project_id:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_project_id"})
            return
        user = self.require_project_access(project_id)
        if not user:
            return
        if user["role"] == "customer":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            return
        payload = self.read_json()
        move_type = str(payload.get("move_type", "")).strip()
        if move_type not in {"purchase", "receipt", "use", "writeoff"}:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_move_type"})
            return
        try:
            estimate_item_id = int(payload.get("estimate_item_id", 0) or 0)
            qty = float(payload.get("qty", 0) or 0)
            price = float(payload.get("price", 0) or 0)
        except (TypeError, ValueError, OverflowError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_stock_move_values"})
            return
        if estimate_item_id <= 0:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_estimate_item_id"})
            return
        if qty <= 0:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_qty"})
            return
        if price < 0:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "bad_price"})
            return
        with db() as con:
            estimate_item = con.execute(
                "SELECT id FROM estimate_items WHERE id = ? AND project_id = ?",
                (estimate_item_id, project_id),
            ).fetchone()
            if not estimate_item:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "estimate_item_project_mismatch"})
                return
            cur = con.execute(
                """
                INSERT INTO stock_moves (
                    project_id, estimate_item_id, move_type, qty, price, comment,
                    created_by, created_at, source_type
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')
                """,
                (
                    project_id,
                    estimate_item_id,
                    move_type,
                    qty,
                    price,
                    str(payload.get("comment", "")).strip(),
                    user["id"],
                    now_ts(),
                ),
            )
            con.commit()
        self.send_json(HTTPStatus.CREATED, {"id": cur.lastrowid})

    def render_template(self, template_name: str, variables: dict[str, str]) -> bytes:
        template = (FRONTEND_TEMPLATES / template_name).read_text(encoding="utf-8")
        for key, value in variables.items():
            template = template.replace("{{" + key + "}}", value)
        return template.encode("utf-8")

    def project_cards_fallback_html(self, user: dict) -> str:
        with db() as con:
            if user_has_any_role(user, {"admin", "director", "foreman"}):
                rows = con.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
            else:
                rows = con.execute(
                    """
                    SELECT p.*
                    FROM projects p
                    JOIN user_project_access a ON a.project_id = p.id
                    WHERE a.user_id = ?
                    ORDER BY p.id DESC
                    """,
                    (user["id"],),
                ).fetchall()

        if not rows:
            return '<div class="muted">Объекты пока не найдены.</div>'

        def esc(value: object) -> str:
            return html.escape("" if value is None else str(value), quote=True)

        def project_progress(value: object) -> int:
            try:
                return max(0, min(100, int(round(float(value or 0)))))
            except (TypeError, ValueError):
                return 0

        def is_completed(row: sqlite3.Row) -> bool:
            status = str(row["status"] or "").lower()
            return project_progress(row["progress"]) >= 100 or "сдан" in status or "заверш" in status

        sorted_rows = sorted(rows, key=lambda row: (1 if is_completed(row) else 0, -int(row["id"])))
        cards: list[str] = []
        for row in sorted_rows:
            progress = project_progress(row["progress"])
            completed = is_completed(row)
            financial_meta = '<div><span>Экономика</span><strong>Раздел «Финансы»</strong></div>'
            status_badge = (
                '<span class="badge success">Завершен</span>'
                if completed
                else f'<span class="badge">{esc(row["status"] or "В работе")}</span>'
            )
            cards.append(
                f'<article class="project-card {"project-completed" if completed else ""}" data-project-id="{esc(row["id"])}">'
                '<div class="project-top">'
                f'<div><h3>{esc(row["title"])}</h3><p>{esc(row["address"] or "Адрес не указан")}</p></div>'
                f'<div class="project-card-tools"><div class="project-badges">{status_badge}</div></div>'
                '</div>'
                '<div class="meta-grid">'
                f'<div><span>Заказчик</span><strong>{esc(row["client_name"] or "Не указан")}</strong></div>'
                f'{financial_meta}'
                f'<div><span>Дедлайн</span><strong>{esc(row["deadline_at"] or "—")}</strong></div>'
                '</div>'
                '<div class="progress-strong">'
                f'<div class="progress-strong-head"><span>Готовность объекта</span><strong>{progress}%</strong></div>'
                f'<div class="progress-strong-track"><i style="width:{progress}%"></i></div>'
                '</div>'
                '</article>'
            )
        return "".join(cards)

    def strip_role_content(self, content: str, user: dict) -> str:
        perms = user_permissions(user)
        if not (user_has_any_role(user, {"admin", "director"}) or perms.get("fullAccess") or perms.get("manageUsers") or perms.get("manageRoles")):
            content = DIRECTOR_ACTION_BLOCK_RE.sub("", content)
        return content

    def send_html(self, body: bytes, status: int = HTTPStatus.OK) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def serve_app(self, path: str) -> None:
        if path == "/login":
            self.send_html(
                self.render_template(
                    "login.html",
                    {
                        "auth_config": self.auth_config_script(),
                        "auth_head": self.clerk_sign_in_script(),
                    },
                )
            )
            return

        user = self.current_user()
        if not user:
            self.redirect(f"{LOGIN_PATH}?next={urllib.parse.quote(path, safe='/')}")
            return
        if not user_can_open(user, path):
            self.redirect(DEFAULT_AUTH_PATH + "?restricted=1")
            return

        page_info = APP_PAGES.get(path)
        if not page_info:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        page_name, title = page_info
        content_path = FRONTEND_PAGES / f"{page_name}.html"
        if not content_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Page not found")
            return

        content = self.strip_role_content(content_path.read_text(encoding="utf-8"), user)
        if page_name == "autobot":
            content = content.replace(
                "{{autobot_url}}",
                html.escape(PMBI_AUTOBOT_BASE_URL or "http://127.0.0.1:8765", quote=True),
            )
        if page_name == "projects":
            content = content.replace(
                '<div class="projects-grid" data-projects-list></div>',
                f'<div class="projects-grid" data-projects-list>{self.project_cards_fallback_html(user)}</div>',
            )
        body = self.render_template(
            "base.html",
            {
                "title": title,
                "page": page_name,
                "auth_config": self.auth_config_script(),
                "auth_head": self.clerk_sign_in_script(),
                "content": content,
            },
        )
        self.send_html(body)

    def serve_asset(self, path: str) -> None:
        relative = path.removeprefix("/assets/").lstrip("/")
        candidate = (FRONTEND_ASSETS / relative).resolve()
        try:
            candidate.relative_to(FRONTEND_ASSETS.resolve())
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return
        if not candidate.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        content_type = "image/webp" if candidate.suffix.lower() == ".webp" else (mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
        if candidate.suffix.lower() in {".html", ".js", ".css", ".json", ".txt"}:
            content_type += "; charset=utf-8"
        body = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path: str) -> None:
        user = self.current_user()
        is_page_request = path.endswith(".html") or "." not in Path(path).name
        if path not in PUBLIC_STATIC_PATHS and not user:
            if is_page_request:
                next_path = urllib.parse.quote(path, safe="/")
                self.redirect(f"{LOGIN_PATH}?next={next_path}")
            else:
                self.send_error(HTTPStatus.UNAUTHORIZED, "Authentication required")
            return

        if user and is_page_request and not user_can_open(user, path):
            if path.endswith(".html") or "." not in Path(path).name:
                self.redirect(DEFAULT_AUTH_PATH + "?restricted=1")
            else:
                self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return

        file_path = self.resolve_static_path(path)
        if not file_path:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content_type = "image/webp" if file_path.suffix.lower() == ".webp" else (mimetypes.guess_type(str(file_path))[0] or "application/octet-stream")
        if file_path.suffix.lower() in {".html", ".js", ".css", ".json", ".txt"}:
            content_type += "; charset=utf-8"
        body = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def resolve_static_path(self, path: str) -> Path | None:
        rel = path.lstrip("/") or "index.html"
        candidate = (DEPLOY_ROOT / rel).resolve()
        try:
            candidate.relative_to(DEPLOY_ROOT.resolve())
        except ValueError:
            return None
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.is_file():
            return None
        return candidate


def main() -> None:
    init_db()
    print(f"PM.bi backend: http://{HOST}:{PORT}/")
    print(f"Database: {DB_PATH}")
    if BOOTSTRAP_PATH.exists():
        print(f"Initial admin credentials: {BOOTSTRAP_PATH}")
    print("Press Ctrl+C to stop the server.")
    ThreadingHTTPServer((HOST, PORT), PMBIHandler).serve_forever()


def resolved_estimate_item_kind(item: dict | sqlite3.Row) -> str:
    code_kind = estimate_code_text_kind(" ".join(
        str(payload_get(item, key) or "")
        for key in (
            "article", "sku", "code", "basis", "index", "item_index", "itemIndex",
            "source_label", "sourceLabel", "title", "name", "notes",
        )
    ))
    if code_kind:
        return code_kind
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


if __name__ == "__main__":
    main()
