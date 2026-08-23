from __future__ import annotations

import io
import json
import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import auth  # noqa: E402
import server  # noqa: E402


class FakeJsonResponse:
    def __init__(self, user: dict):
        self.user = user
        self.status = None
        self.headers: dict[str, str] = {}
        self.wfile = io.BytesIO()

    def current_user(self) -> dict:
        return self.user

    def send_response(self, status: int) -> None:
        self.status = status

    def send_header(self, name: str, value: str) -> None:
        self.headers[name] = value

    def end_headers(self) -> None:
        return None


class ProcurementPriceAccessTests(unittest.TestCase):
    def test_only_director_and_admin_roles_can_view_protected_prices(self) -> None:
        self.assertTrue(auth.user_can_view_procurement_prices({"role": "admin", "roles": []}))
        self.assertTrue(auth.user_can_view_procurement_prices({"role": "director", "roles": []}))
        self.assertTrue(auth.user_can_view_procurement_prices({"role": "main_admin", "roles": []}))
        self.assertFalse(auth.user_can_view_procurement_prices({"role": "foreman", "roles": []}))
        self.assertFalse(auth.user_can_view_procurement_prices({"role": "purchaser", "roles": []}))

    def test_secondary_director_role_grants_price_access(self) -> None:
        user = {"role": "foreman", "roles": [{"code": "director"}]}
        self.assertTrue(auth.user_can_view_procurement_prices(user))

    def test_redaction_removes_all_market_and_margin_fields(self) -> None:
        payload = {
            "items": [
                {
                    "id": 7,
                    "title": "Tile",
                    "plannedPrice": 1500,
                    "planned_price": 1500,
                    "marketPrice": 1200,
                    "enteredPrice": 1100,
                    "marginPercent": 26.67,
                    "activeOffer": {"id": 5, "candidateName": "Supplier"},
                    "procurementLimit": {"limitNetKopecks": 100000, "status": "exceeded"},
                    "limitCheck": {"overrunKopecks": 10000},
                    "estimateTotal": 150000,
                    "sources": [{"title": "Supplier"}],
                    "compareToEstimate": {"deltaPerUnit": -400, "deltaTotal": -40000},
                }
            ]
        }

        result = auth.redact_procurement_prices(payload, {"role": "foreman", "roles": []})
        item = result["items"][0]

        self.assertEqual(item["title"], "Tile")
        self.assertNotIn("plannedPrice", item)
        self.assertNotIn("planned_price", item)
        self.assertNotIn("marketPrice", item)
        self.assertNotIn("enteredPrice", item)
        self.assertNotIn("marginPercent", item)
        self.assertNotIn("activeOffer", item)
        self.assertNotIn("procurementLimit", item)
        self.assertNotIn("limitCheck", item)
        self.assertNotIn("estimateTotal", item)
        self.assertNotIn("compareToEstimate", item)
        self.assertNotIn("sources", item)
        self.assertEqual(payload["items"][0]["plannedPrice"], 1500)

    def test_admin_payload_is_not_redacted(self) -> None:
        payload = {"plannedPrice": 1500, "marketPrice": 1200, "enteredPrice": 1100, "marginPercent": 26.67}
        result = auth.redact_procurement_prices(payload, {"role": "admin", "roles": []})
        self.assertIs(result, payload)

    def test_price_payload_matrix_for_every_builtin_role(self) -> None:
        payload = {
            "title": "Tile",
            "estimateUnitPrice": 1500,
            "marketPrice": 1200,
            "enteredPrice": 1100,
            "marginPercent": 26.67,
            "activeOffer": {"id": 5},
            "procurementLimit": {"limitNetKopecks": 100000},
        }
        allowed_roles = {"main_admin", "admin", "director"}

        for role in auth.ROLE_CODES:
            with self.subTest(role=role):
                user = {"role": role, "roles": []}
                result = auth.redact_procurement_prices(payload, user)
                if role in allowed_roles:
                    self.assertIs(result, payload)
                    self.assertEqual(result["marginPercent"], 26.67)
                else:
                    self.assertEqual(result, {"title": "Tile"})

    def test_price_submission_permission_matrix(self) -> None:
        blocked_roles = {"customer", "client"}
        for role in auth.ROLE_CODES:
            with self.subTest(role=role):
                self.assertEqual(
                    auth.user_can_submit_procurement_price({"role": role, "roles": []}),
                    role not in blocked_roles,
                )

    def test_foreman_cannot_open_raw_autobot_module_or_finances(self) -> None:
        user = {
            "role": "foreman",
            "roles": ["foreman"],
            "permissions": {
                "modules": ["projects", "autobot"],
                "projects": "edit",
            },
        }
        self.assertFalse(auth.user_can_open(user, "/app/autobot"))
        self.assertFalse(auth.user_can_view_finances(user))

    def test_json_response_boundary_applies_redaction(self) -> None:
        response = FakeJsonResponse({"role": "foreman", "roles": []})
        server.PMBIHandler.send_json(
            response,
            200,
            {
                "items": [
                    {
                        "title": "Tile",
                        "plannedPrice": 1500,
                        "marketPrice": 1200,
                        "enteredPrice": 1100,
                        "marginPercent": 26.67,
                    }
                ]
            },
        )
        payload = json.loads(response.wfile.getvalue().decode("utf-8"))

        self.assertEqual(response.status, 200)
        self.assertNotIn("plannedPrice", payload["items"][0])
        self.assertNotIn("marketPrice", payload["items"][0])
        self.assertNotIn("enteredPrice", payload["items"][0])
        self.assertNotIn("marginPercent", payload["items"][0])


if __name__ == "__main__":
    unittest.main()
