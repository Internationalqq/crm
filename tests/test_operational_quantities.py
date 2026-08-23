import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from operational_quantities import operational_quantity_plan


class OperationalQuantityTests(unittest.TestCase):
    def assert_plan(self, quantity, unit, expected_quantity, expected_unit):
        plan = operational_quantity_plan(quantity, unit)
        self.assertAlmostEqual(plan["total_qty"], expected_quantity)
        self.assertEqual(plan["unit"], expected_unit)

    def test_scaled_length_is_converted_to_metres(self):
        self.assert_plan(0.237, "100 м", 23.7, "м")

    def test_scaled_area_is_converted_to_square_metres(self):
        self.assert_plan(0.0316, "100 м2", 3.16, "м2")

    def test_scaled_material_pack_is_converted_to_pieces(self):
        self.assert_plan(0.6, "10 шт", 6, "шт")

    def test_legacy_already_multiplied_quantity_is_not_multiplied_twice(self):
        plan = operational_quantity_plan(100, "100 шт")
        self.assertEqual(plan["total_qty"], 100)
        self.assertTrue(plan["legacy_already_multiplied"])

    def test_plain_unit_stays_unchanged(self):
        self.assert_plan(17.1, "м2", 17.1, "м2")


if __name__ == "__main__":
    unittest.main()
