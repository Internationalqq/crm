from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import server  # noqa: E402


class EstimateImportValueTests(unittest.TestCase):
    def test_russian_formatted_quantity_and_price_are_preserved(self) -> None:
        qty, price = server.normalize_estimate_item_values(
            {
                "planned_qty": "0,0316",
                "planned_price": "136 210,13 руб.",
            },
            "100 м2",
        )

        self.assertAlmostEqual(qty, 0.0316)
        self.assertAlmostEqual(price, 136210.13)

    def test_missing_price_is_recovered_from_position_total(self) -> None:
        qty, price = server.normalize_estimate_item_values(
            {
                "qty": 0.0316,
                "unit_price": 0,
                "total": 4304.24,
            },
            "100 м2",
        )

        self.assertAlmostEqual(qty, 0.0316)
        self.assertAlmostEqual(price, 4304.24 / 0.0316)

    def test_autobot_aliases_are_accepted(self) -> None:
        qty, price = server.normalize_estimate_item_values(
            {
                "quantity": 17.1,
                "planned_price": 0,
                "unit_price_rub": 5062.25,
                "price_from_estimate_rub": 86564.48,
            },
            "м2",
        )

        self.assertAlmostEqual(qty, 17.1)
        self.assertAlmostEqual(price, 5062.25)

    def test_order_of_magnitude_mismatch_requires_review(self) -> None:
        issue = server.estimate_item_value_issue(
            {
                "title": "Позиция из сметы Чебаркуля",
                "quantity": 256,
                "unit_price_rub": 202999.3945,
                "price_from_estimate_rub": 519678.45,
            },
            7,
        )

        self.assertIsNotNone(issue)
        self.assertEqual(issue["position"], 7)
        self.assertAlmostEqual(issue["factor"], 100.0, places=4)

    def test_small_rounding_difference_does_not_block_import(self) -> None:
        issue = server.estimate_item_value_issue(
            {
                "quantity": 3,
                "unit_price_rub": 100.01,
                "price_from_estimate_rub": 300.0,
            }
        )

        self.assertIsNone(issue)


if __name__ == "__main__":
    unittest.main()
