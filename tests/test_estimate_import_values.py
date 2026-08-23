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


if __name__ == "__main__":
    unittest.main()
