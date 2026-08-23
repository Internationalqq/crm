from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from estimate_reconciliation import (  # noqa: E402
    build_reconciliation,
    capture_live_snapshot,
    capture_snapshot,
    ensure_estimate_reconciliation_schema,
    save_review,
)
from auth import redact_procurement_prices  # noqa: E402


class EstimateReconciliationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.con = sqlite3.connect(":memory:")
        self.con.row_factory = sqlite3.Row
        self.con.execute("PRAGMA foreign_keys = ON")
        self.con.executescript(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT,
                first_name TEXT,
                last_name TEXT
            );
            CREATE TABLE projects (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
            CREATE TABLE estimate_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                unit TEXT NOT NULL,
                planned_qty REAL NOT NULL,
                planned_price REAL NOT NULL DEFAULT 0,
                item_kind TEXT NOT NULL DEFAULT 'material',
                section_title TEXT,
                article TEXT
            );
            INSERT INTO users VALUES (1, 'Прораб Петров', 'Пётр', 'Петров');
            INSERT INTO projects VALUES (10, 'Объект');
            """
        )
        ensure_estimate_reconciliation_schema(self.con)

    def tearDown(self) -> None:
        self.con.close()

    def capture_pair(self) -> tuple[int, int]:
        original, _ = capture_snapshot(
            self.con,
            10,
            "original",
            [
                {
                    "title": "Плитка керамическая",
                    "unit": "м²",
                    "plannedQty": 100,
                    "plannedPrice": 900,
                    "itemKind": "material",
                    "article": "M-1",
                    "sectionTitle": "Полы",
                },
                {
                    "title": "Укладка плитки",
                    "unit": "м²",
                    "plannedQty": 100,
                    "plannedPrice": 500,
                    "itemKind": "work",
                    "article": "W-1",
                    "sectionTitle": "Полы",
                },
            ],
            1,
            100,
            "Исходная смета",
        )
        ai, _ = capture_snapshot(
            self.con,
            10,
            "ai",
            [
                {
                    "title": "Плитка керамическая",
                    "unit": "м2",
                    "plannedQty": 95,
                    "plannedPrice": 850,
                    "itemKind": "material",
                    "article": "M-1",
                    "sectionTitle": "Полы",
                },
                {
                    "title": "Укладка плитки",
                    "unit": "м²",
                    "plannedQty": 100,
                    "plannedPrice": 500,
                    "itemKind": "work",
                    "article": "W-1",
                    "sectionTitle": "Полы",
                },
                {
                    "title": "Клей плиточный",
                    "unit": "мешок",
                    "plannedQty": 20,
                    "plannedPrice": 700,
                    "itemKind": "material",
                    "article": "M-2",
                    "sectionTitle": "Полы",
                },
            ],
            1,
            200,
            "AutoBot",
        )
        self.con.commit()
        return int(original["id"]), int(ai["id"])

    def test_foreman_payload_contains_operational_differences_without_prices(self) -> None:
        self.capture_pair()
        payload = build_reconciliation(self.con, 10, False)

        self.assertTrue(payload["ready"])
        self.assertEqual(payload["summary"]["totalRows"], 3)
        self.assertEqual(payload["summary"]["changed"], 1)
        self.assertEqual(payload["summary"]["addedByAi"], 1)
        self.assertNotIn("priceChanged", payload["summary"])
        tile = next(row for row in payload["rows"] if row["original"] and row["original"]["article"] == "M-1")
        self.assertEqual(tile["status"], "changed")
        self.assertEqual(tile["differences"], ["quantity"])
        self.assertNotIn("plannedPrice", tile["original"])
        self.assertNotIn("plannedPrice", tile["ai"])
        self.assertNotIn("priceChanged", tile)
        self.assertNotIn("priceDelta", tile)

    def test_director_payload_exposes_price_difference(self) -> None:
        self.capture_pair()
        payload = build_reconciliation(self.con, 10, True)

        tile = next(row for row in payload["rows"] if row["original"] and row["original"]["article"] == "M-1")
        self.assertEqual(tile["original"]["plannedPrice"], 900)
        self.assertEqual(tile["ai"]["plannedPrice"], 850)
        self.assertTrue(tile["priceChanged"])
        self.assertEqual(tile["priceDelta"], -50)
        self.assertEqual(payload["summary"]["priceChanged"], 1)

    def test_price_only_change_is_not_an_operational_signal_for_foreman(self) -> None:
        capture_snapshot(
            self.con,
            10,
            "original",
            [{"title": "Щебень", "unit": "т", "plannedQty": 5, "plannedPrice": 1000}],
            1,
            100,
        )
        capture_snapshot(
            self.con,
            10,
            "ai",
            [{"title": "Щебень", "unit": "т", "plannedQty": 5, "plannedPrice": 1200}],
            1,
            200,
        )

        foreman = build_reconciliation(self.con, 10, False)
        director = build_reconciliation(self.con, 10, True)

        self.assertEqual(foreman["rows"][0]["status"], "exact")
        self.assertEqual(foreman["rows"][0]["differences"], [])
        self.assertNotIn("priceChanged", foreman["rows"][0])
        self.assertTrue(director["rows"][0]["priceChanged"])

    def test_global_redaction_covers_reconciliation_price_fields(self) -> None:
        redacted = redact_procurement_prices(
            {
                "rows": [
                    {
                        "original": {"title": "Щебень", "plannedPrice": 1000},
                        "ai": {"title": "Щебень", "planned_price": 1200},
                        "priceChanged": True,
                        "priceDelta": 200,
                    }
                ],
                "summary": {"priceChanged": 1, "totalRows": 1},
            },
            {"role": "foreman", "roles": []},
        )

        row = redacted["rows"][0]
        self.assertEqual(row["original"], {"title": "Щебень"})
        self.assertEqual(row["ai"], {"title": "Щебень"})
        self.assertNotIn("priceChanged", row)
        self.assertNotIn("priceDelta", row)
        self.assertEqual(redacted["summary"], {"totalRows": 1})

    def test_review_is_bound_to_snapshot_pair_and_requires_comment(self) -> None:
        original_id, ai_id = self.capture_pair()
        row_key = build_reconciliation(self.con, 10, False)["rows"][0]["rowKey"]

        with self.assertRaisesRegex(ValueError, "reconciliation_comment_required"):
            save_review(self.con, 10, original_id, ai_id, row_key, "needs_correction", "", 1, 300)

        save_review(
            self.con,
            10,
            original_id,
            ai_id,
            row_key,
            "needs_correction",
            "Уточнить объём у сметчика",
            1,
            301,
        )
        payload = build_reconciliation(self.con, 10, False)
        reviewed = next(row for row in payload["rows"] if row["rowKey"] == row_key)
        self.assertEqual(reviewed["review"]["status"], "needs_correction")
        self.assertEqual(reviewed["review"]["reviewedByName"], "Пётр Петров")
        self.assertEqual(payload["summary"]["reviewed"], 1)
        self.assertEqual(payload["summary"]["needsCorrection"], 1)

    def test_snapshots_are_deduplicated_and_snapshot_rows_are_immutable(self) -> None:
        items = [{"title": "Песок", "unit": "т", "plannedQty": 2, "plannedPrice": 300}]
        first, created_first = capture_snapshot(self.con, 10, "original", items, 1, 100)
        second, created_second = capture_snapshot(self.con, 10, "original", items, 1, 200)

        self.assertTrue(created_first)
        self.assertFalse(created_second)
        self.assertEqual(first["id"], second["id"])
        with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable"):
            self.con.execute(
                "UPDATE estimate_reconciliation_snapshot_items SET title = 'Иное' WHERE snapshot_id = ?",
                (first["id"],),
            )

    def test_live_estimate_can_be_captured_as_explicit_original(self) -> None:
        self.con.execute(
            """
            INSERT INTO estimate_items (
                project_id, title, unit, planned_qty, planned_price, item_kind, section_title, article
            ) VALUES (10, 'Бетон', 'м3', 7, 5000, 'material', 'Фундамент', 'B-1')
            """
        )
        snapshot, created = capture_live_snapshot(
            self.con,
            10,
            "original",
            1,
            100,
            "Текущая утверждённая смета",
        )

        self.assertTrue(created)
        self.assertEqual(snapshot["item_count"], 1)
        payload = build_reconciliation(self.con, 10, True)
        self.assertEqual(payload["originalSnapshot"]["sourceLabel"], "Текущая утверждённая смета")
        self.assertFalse(payload["ready"])


if __name__ == "__main__":
    unittest.main()
