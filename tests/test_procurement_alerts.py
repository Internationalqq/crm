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

from schedule_tasks import (  # noqa: E402
    build_procurement_alerts,
    build_procurement_evidence_alerts,
    estimate_material_lead_days,
)
from warehouse import estimate_material_lead_days as warehouse_estimate_material_lead_days  # noqa: E402


def stage_rows(*rows: tuple[int, str, str]) -> list[sqlite3.Row]:
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.execute("CREATE TABLE stages (id INTEGER, title TEXT, planned_start TEXT)")
    con.executemany("INSERT INTO stages VALUES (?, ?, ?)", rows)
    result = con.execute("SELECT id, title, planned_start FROM stages ORDER BY id").fetchall()
    con.close()
    return result


class ProcurementAlertTests(unittest.TestCase):
    def test_warehouse_lead_day_estimator_uses_shared_scope_classifier(self) -> None:
        material = {
            "title": "\u041a\u0430\u0431\u0435\u043b\u044c",
            "notes": "",
            "unit": "m",
            "plannedQty": 100,
            "plannedPrice": 250,
        }

        self.assertEqual(warehouse_estimate_material_lead_days(material), 12)
        self.assertEqual(estimate_material_lead_days(material), 12)

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

    def test_procurement_alerts_are_not_truncated_per_project(self) -> None:
        materials = [
            {
                "id": 200 + index,
                "title": f"Материал {index + 1}",
                "unit": "шт",
                "itemKind": "material",
                "plannedQty": 10,
                "missingQty": 10,
                "purchasedQty": 0,
                "receivedQty": 0,
                "needByDate": "2026-08-27",
                "deliveryDays": 1,
            }
            for index in range(15)
        ]

        procurement = build_procurement_alerts(materials, [], date(2026, 8, 24))

        self.assertEqual(len(procurement["items"]), 15)
        self.assertEqual({item["materialId"] for item in procurement["items"]}, {200 + index for index in range(15)})

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

    def test_evidence_alert_requests_costing_from_quote_deadline(self) -> None:
        material = {
            "id": 301,
            "title": "Щебень",
            "unit": "т",
            "itemKind": "material",
            "plannedQty": 20,
            "missingQty": 20,
            "needByDate": "2026-09-10",
            "deliveryDays": 7,
            "selectedSupplierOffer": False,
            "invoiceAttached": False,
        }

        before_deadline = build_procurement_evidence_alerts(
            [material],
            [],
            date(2026, 8, 28),
            costing_buffer_days=5,
        )
        at_deadline = build_procurement_evidence_alerts(
            [material],
            [],
            date(2026, 8, 29),
            costing_buffer_days=5,
        )

        self.assertEqual(before_deadline["items"], [])
        self.assertEqual(len(at_deadline["items"]), 1)
        alert = at_deadline["items"][0]
        self.assertEqual(alert["evidenceKind"], "missing_costing")
        self.assertEqual(alert["status"], "soon")
        self.assertEqual(alert["quoteByDate"], "2026-08-29")
        self.assertEqual(alert["orderByDate"], "2026-09-03")
        self.assertEqual(alert["needOnSiteDate"], "2026-09-10")
        self.assertEqual(at_deadline["summary"]["missingCosting"], 1)

        material["selectedSupplierOffer"] = True
        material["selectedSupplierOfferHasPrice"] = True
        cleared_by_price = build_procurement_evidence_alerts(
            [material],
            [],
            date(2026, 8, 29),
        )
        self.assertEqual(cleared_by_price["items"], [])

    def test_evidence_alert_requires_invoice_immediately_after_purchase(self) -> None:
        material = {
            "id": 302,
            "title": "Сетка",
            "unit": "м2",
            "itemKind": "material",
            "plannedQty": 100,
            "missingQty": 0,
            "purchasedQty": 100,
            "receivedQty": 100,
            "needByDate": "2026-10-01",
            "selectedSupplierOffer": True,
            "selectedSupplierOfferHasPrice": True,
            "invoiceAttached": False,
        }

        procurement = build_procurement_evidence_alerts(
            [material],
            [],
            date(2026, 8, 24),
        )

        self.assertEqual(len(procurement["items"]), 1)
        alert = procurement["items"][0]
        self.assertEqual(alert["evidenceKind"], "missing_invoice")
        self.assertEqual(alert["status"], "critical")
        self.assertEqual(alert["purchasedQty"], 100)
        self.assertEqual(alert["receivedQty"], 100)
        self.assertEqual(procurement["summary"]["missingInvoice"], 1)

        material["invoiceAttached"] = True
        material["invoiceCount"] = 1
        cleared_by_invoice = build_procurement_evidence_alerts(
            [material],
            [],
            date(2026, 8, 24),
        )
        self.assertEqual(cleared_by_invoice["items"], [])
        self.assertEqual(cleared_by_invoice["summary"]["total"], 0)

    def test_evidence_alert_reports_missing_schedule_but_skips_warehouse_invoice(self) -> None:
        no_schedule = {
            "id": 303,
            "title": "Бетон",
            "itemKind": "material",
            "plannedQty": 10,
            "missingQty": 10,
        }
        warehouse_material = {
            "id": 304,
            "title": "Материал со склада",
            "itemKind": "material",
            "plannedQty": 10,
            "missingQty": 0,
            "purchasedQty": 10,
            "needByDate": "2026-08-25",
            "warehouseSource": "main_warehouse",
        }

        procurement = build_procurement_evidence_alerts(
            [no_schedule, warehouse_material],
            [],
            date(2026, 8, 24),
        )

        self.assertEqual(len(procurement["items"]), 1)
        self.assertEqual(procurement["items"][0]["materialId"], 303)
        self.assertEqual(
            procurement["items"][0]["evidenceKind"],
            "missing_schedule",
        )
        self.assertEqual(procurement["items"][0]["status"], "watch")

    def test_inactive_schedule_only_keeps_existing_purchase_invoice_debt(self) -> None:
        materials = [
            {
                "id": 305,
                "title": "Не заказанный материал",
                "itemKind": "material",
                "plannedQty": 10,
                "missingQty": 10,
            },
            {
                "id": 306,
                "title": "Закупка без счёта",
                "itemKind": "material",
                "plannedQty": 5,
                "missingQty": 0,
                "purchasedQty": 5,
                "invoiceAttached": False,
            },
        ]

        procurement = build_procurement_evidence_alerts(
            materials,
            [],
            date(2026, 8, 24),
            schedule_attention_enabled=False,
        )

        self.assertEqual(len(procurement["items"]), 1)
        self.assertEqual(procurement["items"][0]["materialId"], 306)
        self.assertEqual(procurement["items"][0]["evidenceKind"], "missing_invoice")
        self.assertEqual(procurement["summary"]["missingSchedule"], 0)
        self.assertEqual(procurement["summary"]["missingCosting"], 0)

    def test_completed_unpurchased_material_does_not_create_schedule_noise(self) -> None:
        procurement = build_procurement_evidence_alerts(
            [
                {
                    "id": 307,
                    "title": "Историческая позиция",
                    "itemKind": "material",
                    "plannedQty": 10,
                    "missingQty": 10,
                    "isCompleted": True,
                }
            ],
            [],
            date(2026, 8, 24),
        )

        self.assertEqual(procurement["items"], [])


if __name__ == "__main__":
    unittest.main()
