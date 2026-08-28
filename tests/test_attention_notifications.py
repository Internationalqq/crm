from __future__ import annotations

import json
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from communications_docs import (  # noqa: E402
    build_attention_clock,
    build_schedule_alerts,
    daily_log_entry_kind,
    has_daily_field_report,
    project_allows_schedule_attention,
    project_requires_daily_report,
)


def stage(
    stage_id: int,
    title: str,
    *,
    parent_id: int | None = None,
    stage_kind: str = "work",
    status_code: str = "not_started",
    planned_start: str = "",
    planned_end: str = "",
    progress: int = 0,
) -> dict:
    return {
        "id": stage_id,
        "title": title,
        "parent_id": parent_id,
        "stage_kind": stage_kind,
        "status_code": status_code,
        "planned_start": planned_start,
        "planned_end": planned_end,
        "progress": progress,
        "responsible": "Прораб",
    }


class AttentionClockTests(unittest.TestCase):
    def test_evening_boundary_uses_configured_business_timezone(self) -> None:
        before = build_attention_clock(datetime(2026, 8, 29, 11, 59, tzinfo=timezone.utc), 5)
        at_boundary = build_attention_clock(datetime(2026, 8, 29, 12, 0, tzinfo=timezone.utc), 5)

        self.assertEqual(before["serverNow"], "2026-08-29T16:59:00+05:00")
        self.assertFalse(before["reportReminderActive"])
        self.assertEqual(before["nextAttentionRefreshAt"], "2026-08-29T17:00:00+05:00")
        self.assertEqual(at_boundary["serverNow"], "2026-08-29T17:00:00+05:00")
        self.assertTrue(at_boundary["reportReminderActive"])
        self.assertEqual(at_boundary["nextAttentionRefreshAt"], "2026-08-30T00:00:00+05:00")

    def test_naive_test_clock_is_interpreted_in_business_timezone(self) -> None:
        clock = build_attention_clock(datetime(2026, 8, 29, 16, 59), 5)

        self.assertEqual(clock["today"], "2026-08-29")
        self.assertEqual(clock["serverNow"], "2026-08-29T16:59:00+05:00")
        self.assertFalse(clock["reportReminderActive"])


class ScheduleAlertTests(unittest.TestCase):
    def test_classifies_actionable_leaf_stages_without_parent_duplicates(self) -> None:
        stages = [
            stage(1, "Раздел А", stage_kind="section", planned_start="2026-08-29", planned_end="2026-09-05"),
            stage(2, "Заблокированная работа", parent_id=1, status_code="blocked"),
            stage(3, "Просроченная работа", parent_id=1, planned_start="2026-08-20", planned_end="2026-08-28"),
            stage(4, "Работа в окне", parent_id=1, planned_start="2026-08-28", planned_end="2026-08-30", progress=20),
            stage(5, "Работа через три дня", parent_id=1, planned_start="2026-09-01", planned_end="2026-09-02"),
            stage(6, "Работа через четыре дня", parent_id=1, planned_start="2026-09-02", planned_end="2026-09-03"),
            stage(7, "Завершенная работа", parent_id=1, status_code="completed", planned_start="2026-08-29"),
            stage(8, "Сто процентов", parent_id=1, planned_start="2026-08-29", progress=100),
            stage(9, "Legacy-раздел без детей", stage_kind="section", planned_start="2026-08-29"),
            stage(10, "Завершить сегодня", planned_start="2026-08-27", planned_end="2026-08-29"),
        ]

        alerts = build_schedule_alerts(stages, date(2026, 8, 29))
        by_id = {item["id"]: item for item in alerts}

        self.assertNotIn(1, by_id)
        self.assertEqual(set(by_id), {2, 3, 4, 5, 9, 10})
        self.assertEqual(by_id[2]["timing"], "blocked")
        self.assertEqual(by_id[3]["timing"], "overdue")
        self.assertEqual(by_id[4]["timing"], "today")
        self.assertEqual(by_id[5]["timing"], "soon")
        self.assertEqual(by_id[5]["daysUntilStart"], 3)
        self.assertEqual(by_id[9]["timing"], "starts_today")
        self.assertEqual(by_id[10]["timing"], "due_today")
        self.assertEqual(by_id[2]["sectionTitle"], "Раздел А")
        self.assertEqual([item["timing"] for item in alerts], ["blocked", "overdue", "due_today", "starts_today", "today", "soon"])

    def test_explicit_overdue_and_open_ended_active_stage_are_actionable(self) -> None:
        alerts = build_schedule_alerts(
            [
                stage(11, "Просрочено без даты", status_code="overdue"),
                stage(12, "Продолжается", status_code="in_progress", planned_start="2026-08-20"),
                stage(13, "Будущее завершено", status_code="approved", planned_start="2026-08-30"),
                stage(14, "Начато сегодня", status_code="in_progress", planned_start="2026-08-29", progress=15),
            ],
            date(2026, 8, 29),
        )

        self.assertEqual(
            [(item["id"], item["timing"]) for item in alerts],
            [(11, "overdue"), (12, "today"), (14, "today")],
        )

    def test_actionable_parent_is_kept_when_no_child_is_actionable(self) -> None:
        alerts = build_schedule_alerts(
            [
                stage(20, "Заблокированный раздел", stage_kind="section", status_code="blocked"),
                stage(21, "Будущая работа", parent_id=20, planned_start="2026-09-10"),
            ],
            date(2026, 8, 29),
        )

        self.assertEqual([(item["id"], item["timing"]) for item in alerts], [(20, "blocked")])

    def test_critical_parent_is_not_hidden_by_a_less_urgent_child(self) -> None:
        alerts = build_schedule_alerts(
            [
                stage(22, "Заблокированный раздел", stage_kind="section", status_code="blocked"),
                stage(23, "Работа на сегодня", parent_id=22, planned_start="2026-08-28", planned_end="2026-08-30"),
            ],
            date(2026, 8, 29),
        )

        self.assertEqual([(item["id"], item["timing"]) for item in alerts], [(22, "blocked"), (23, "today")])

    def test_due_parent_is_not_hidden_by_a_later_child(self) -> None:
        alerts = build_schedule_alerts(
            [
                stage(24, "Раздел завершить сегодня", stage_kind="section", planned_start="2026-08-20", planned_end="2026-08-29"),
                stage(25, "Следующая работа", parent_id=24, planned_start="2026-08-31"),
            ],
            date(2026, 8, 29),
        )

        self.assertEqual([(item["id"], item["timing"]) for item in alerts], [(24, "due_today"), (25, "soon")])

    def test_schedule_attention_ignores_paused_closed_and_complete_projects(self) -> None:
        self.assertTrue(project_allows_schedule_attention({"status": "Подготовка", "progress": 0}))
        self.assertTrue(project_allows_schedule_attention({"status": "В работе", "progress": 70}))
        self.assertFalse(project_allows_schedule_attention({"status": "На паузе", "progress": 70}))
        self.assertFalse(project_allows_schedule_attention({"status": "Завершён", "progress": 70}))
        self.assertFalse(project_allows_schedule_attention({"status": "active", "progress": 100}))


class DailyReportAttentionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.auto_progress_log = {
            "title": "Групповое завершение работ",
            "raw_input": json.dumps(
                {
                    "entry_kind": "section_progress",
                    "section_id": "section-a",
                    "item_kind": "work",
                    "completed": True,
                    "items": 4,
                },
                ensure_ascii=False,
            ),
            "_is_authored_report": 0,
        }

    def test_auto_progress_does_not_close_day_but_authored_report_does(self) -> None:
        authored = dict(self.auto_progress_log, _is_authored_report=1)

        self.assertEqual(daily_log_entry_kind(self.auto_progress_log), "section_progress")
        self.assertFalse(has_daily_field_report([self.auto_progress_log]))
        self.assertEqual(daily_log_entry_kind(authored), "field_report")
        self.assertTrue(has_daily_field_report([self.auto_progress_log, authored]))

    def test_regular_legacy_report_is_still_a_field_report(self) -> None:
        report = {"title": "Отчет за день", "raw_input": "Выполнили монтаж", "_is_authored_report": 0}

        self.assertEqual(daily_log_entry_kind(report), "field_report")
        self.assertTrue(has_daily_field_report([report]))

    def test_report_is_required_only_for_started_active_internal_project(self) -> None:
        today = date(2026, 8, 29)
        internal_user = {"role": "foreman"}
        active = {"status": "В работе", "progress": 45, "started_at": "2026-08-20"}

        self.assertTrue(project_requires_daily_report(active, internal_user, today))
        self.assertFalse(project_requires_daily_report(dict(active, started_at="2026-08-30"), internal_user, today))
        self.assertFalse(project_requires_daily_report(dict(active, status="Подготовка"), internal_user, today))
        self.assertFalse(project_requires_daily_report(dict(active, status="На паузе"), internal_user, today))
        self.assertFalse(project_requires_daily_report(dict(active, status="Завершен"), internal_user, today))
        self.assertFalse(project_requires_daily_report(dict(active, progress=100), internal_user, today))
        self.assertFalse(project_requires_daily_report(active, {"role": "customer"}, today))


if __name__ == "__main__":
    unittest.main()
