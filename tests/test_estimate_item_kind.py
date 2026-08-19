from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import server  # noqa: E402
import warehouse  # noqa: E402


class EstimateItemKindTests(unittest.TestCase):
    def test_estimate_codes_override_text_markers(self) -> None:
        fsbc_item = {
            "article": "\u0424\u0421\u0411\u0426-24.3.01.04-0022",
            "title": "\u0420\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0435",
        }
        gesn_item = {
            "article": "\u0413\u042D\u0421\u041D16-04-001-02",
            "title": "\u0410\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435",
            "notes": "\u0422\u0438\u043f: \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b",
        }

        self.assertEqual(server.resolved_estimate_item_kind(fsbc_item), "material")
        self.assertEqual(warehouse.resolved_estimate_item_kind(fsbc_item), "material")
        self.assertEqual(server.resolved_estimate_item_kind(gesn_item), "work")
        self.assertEqual(warehouse.resolved_estimate_item_kind(gesn_item), "work")

    def test_estimate_codes_are_detected_in_raw_kind_text(self) -> None:
        self.assertEqual(server.normalize_estimate_item_kind("\u0413\u042D\u0421\u041D\u044016-01-001-01"), "work")
        self.assertEqual(warehouse.normalize_estimate_item_kind("\u0424\u0421\u0411\u0426 24.3.01.04-0022"), "material")


if __name__ == "__main__":
    unittest.main()
