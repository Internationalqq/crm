from __future__ import annotations

import sqlite3
import sys
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from schedule_tasks import build_procurement_alerts, estimate_material_lead_days  # noqa: E402


def stage_rows(*rows: tuple[int, str, str]) -> list[sqlite3.Row]:
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.execute("CREATE TABLE stages (id INTEGER, title TEXT, planned_start TEXT)")
    con.executemany("INSERT INTO stages VALUES (?, ?, ?)", rows)
    result = con.execute("SELECT id, title, planned_start FROM stages ORDER BY id").fetchall()
    con.close()
    return result


class ProcurementAlertTests(unittest.TestCase):
    def test_need_by_date_is_on_site_deadline_and_uses_explicit_delivery_days(self) -> None:
        procurement = build_procurement_alerts(
            [
                {
                    "id": 101,
                    "title": "Щебень",
                    "unit": "т",
                    "itemKind": "material",
                    "missingQty": 20,
                    "needByDate": "2026-08-29",
                    "deliveryDays": 3,
                }
            ],
            [],
            date(2026, 8, 24),
        )

        self.assertEqual(len(procurement["items"]), 1)
        alert = procurement["items"][0]
        self.assertEqual(alert["needOnSiteDate"], "2026-08-29")
        self.assertEqual(alert["orderByDate"], "2026-08-26")
        self.assertEqual(alert["leadDays"], 3)
        self.assertEqual(alert["daysUntilNeed"], 5)
        self.assertEqual(alert["daysUntilOrder"], 2)
        self.assertEqual(alert["startDate"], "2026-08-29")
        self.assertEqual(alert["daysUntilStart"], 5)
        self.assertEqual(alert["status"], "soon")

    def test_explicit_need_date_overrides_stage_but_start_date_stays_compatible(self) -> None:
        procurement = build_procurement_alerts(
            [
                {
                    "id": 102,
                    "title": "Дверные ручки",
                    "unit": "шт",
                    "itemKind": "material",
                    "missingQty": 12,
                    "stageId": 5,
                    "needByDate": "2026-09-01",
                    "deliveryDays": 4,
                }
            ],
            stage_rows((5, "Установка дверей", "2026-09-10")),
            date(2026, 8, 24),
        )

        alert = procurement["items"][0]
        self.assertEqual(alert["needOnSiteDate"], "2026-09-01")
        self.assertEqual(alert["orderByDate"], "2026-08-28")
        self.assertEqual(alert["daysUntilNeed"], 8)
        self.assertEqual(alert["daysUntilOrder"], 4)
        self.assertEqual(alert["startDate"], "2026-09-10")
        self.assertEqual(alert["daysUntilStart"], 17)

    def test_stage_start_is_fallback_and_missing_delivery_days_are_estimated(self) -> None:
        material = {
            "id": 103,
            "title": "Кабель силовой",
            "unit": "м",
            "itemKind": "material",
            "missingQty": 100,
            "stageId": 7,
            "plannedQty": 100,
            "plannedPrice": 250,
        }
        expected_lead_days = estimate_material_lead_days(material)

        procurement = build_procurement_alerts(
            [material],
            stage_rows((7, "Электромонтаж", "2026-09-05")),
            date(2026, 8, 24),
        )

        alert = procurement["items"][0]
        self.assertEqual(alert["needOnSiteDate"], "2026-09-05")
        self.assertEqual(alert["leadDays"], expected_lead_days)
        self.assertEqual(alert["orderByDate"], "2026-08-24")
        self.assertEqual(alert["daysUntilNeed"], 12)
        self.assertEqual(alert["daysUntilOrder"], 0)

    def test_material_without_need_date_or_stage_is_not_alerted(self) -> None:
        procurement = build_procurement_alerts(
            [
                {
                    "id": 104,
                    "title": "Материал без срока",
                    "itemKind": "material",
                    "missingQty": 1,
                }
            ],
            [],
            date(2026, 8, 24),
        )

        self.assertEqual(procurement["items"], [])
        self.assertEqual(procurement["summary"], {"critical": 0, "soon": 0, "watch": 0})

    def test_ordered_material_stays_in_delivery_control_until_fully_received(self) -> None:
        material = {
            "id": 105,
            "title": "Дверные ручки",
            "unit": "шт",
            "itemKind": "material",
            "plannedQty": 20,
            "missingQty": 0,
            "purchasedQty": 20,
            "receivedQty": 8,
            "needByDate": "2026-08-29",
            "deliveryDays": 3,
        }

        procurement = build_procurement_alerts([material], [], date(2026, 8, 24))

        self.assertEqual(len(procurement["items"]), 1)
        alert = procurement["items"][0]
        self.assertEqual(alert["phase"], "delivery")
        self.assertEqual(alert["toOrderQty"], 0)
        self.assertEqual(alert["toReceiveQty"], 12)
        self.assertEqual(alert["purchasedQty"], 20)
        self.assertEqual(alert["receivedQty"], 8)
        self.assertEqual(alert["urgencyDays"], 5)
        self.assertEqual(alert["status"], "watch")

        material["receivedQty"] = 20
        completed = build_procurement_alerts([material], [], date(2026, 8, 24))
        self.assertEqual(completed["items"], [])

    def test_partial_order_only_counts_the_unreceived_purchase_as_in_transit(self) -> None:
        procurement = build_procurement_alerts(
            [
                {
                    "id": 106,
                    "title": "Щебень",
                    "unit": "т",
                    "itemKind": "material",
                    "plannedQty": 100,
                    "missingQty": 60,
                    "purchasedQty": 40,
                    "receivedQty": 10,
                    "needByDate": "2026-09-03",
                    "deliveryDays": 5,
                }
            ],
            [],
            date(2026, 8, 24),
        )

        alert = procurement["items"][0]
        self.assertEqual(alert["phase"], "order")
        self.assertEqual(alert["toOrderQty"], 60)
        self.assertEqual(alert["toReceiveQty"], 30)

    def test_critical_order_is_sorted_before_delivery_watch(self) -> None:
        procurement = build_procurement_alerts(
            [
                {
                    "id": 107,
                    "title": "Поставка в пути",
                    "itemKind": "material",
                    "plannedQty": 10,
                    "missingQty": 0,
                    "purchasedQty": 10,
                    "receivedQty": 0,
                    "needByDate": "2026-08-27",
                    "deliveryDays": 1,
                },
                {
                    "id": 108,
                    "title": "Нужно заказать",
                    "itemKind": "material",
                    "plannedQty": 10,
                    "missingQty": 10,
                    "purchasedQty": 0,
                    "receivedQty": 0,
                    "needByDate": "2026-08-26",
                    "deliveryDays": 3,
                },
            ],
            [],
            date(2026, 8, 24),
        )

        self.assertEqual([item["status"] for item in procurement["items"]], ["critical", "soon"])
        self.assertEqual([item["materialId"] for item in procurement["items"]], [108, 107])


if __name__ == "__main__":
    unittest.main()
