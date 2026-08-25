from __future__ import annotations

import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class ApiRouteDispatchTests(unittest.TestCase):
    def test_nested_daily_log_delete_never_dispatches_project_delete(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        calls: list[tuple[str, str]] = []
        handler.api_delete_project = lambda path: calls.append(("project", path))
        handler.api_delete_daily_log = lambda path: calls.append(("daily_log", path))

        server.PMBIHandler.handle_api(
            handler, "POST", "/api/projects/42/daily-logs/17/delete"
        )

        self.assertEqual(
            calls, [("daily_log", "/api/projects/42/daily-logs/17/delete")]
        )

    def test_exact_project_delete_still_dispatches_project_delete(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        calls: list[tuple[str, str]] = []
        handler.api_delete_project = lambda path: calls.append(("project", path))
        handler.api_delete_daily_log = lambda path: calls.append(("daily_log", path))

        server.PMBIHandler.handle_api(handler, "POST", "/api/projects/42/delete")

        self.assertEqual(calls, [("project", "/api/projects/42/delete")])

    def test_warehouse_control_routes_dispatch_to_specific_handlers(self) -> None:
        cases = [
            ("GET", "/api/projects/42/warehouse-control", "view"),
            ("POST", "/api/projects/42/warehouse-control/norms", "norm"),
            ("POST", "/api/projects/42/warehouse-control/facts", "fact"),
            ("POST", "/api/projects/42/warehouse-control/facts/17/reverse", "reverse"),
        ]
        for method, path, expected in cases:
            with self.subTest(path=path):
                handler = object.__new__(server.PMBIHandler)
                calls: list[tuple[str, str]] = []
                handler.api_project_warehouse_control = lambda value: calls.append(("view", value))
                handler.api_upsert_work_material_norm = lambda value: calls.append(("norm", value))
                handler.api_create_project_work_fact = lambda value: calls.append(("fact", value))
                handler.api_reverse_project_work_fact = lambda value: calls.append(("reverse", value))

                server.PMBIHandler.handle_api(handler, method, path)

                self.assertEqual(calls, [(expected, path)])

    def test_finance_delete_dispatches_only_for_exact_entry_path(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        calls: list[str] = []
        responses: list[tuple[int, dict]] = []
        handler.api_delete_finance_entry = lambda path: calls.append(path)
        handler.send_json = lambda status, payload: responses.append((status, payload))

        server.PMBIHandler.handle_api(handler, "DELETE", "/api/finances/73")
        server.PMBIHandler.handle_api(handler, "DELETE", "/api/finances/73/update")

        self.assertEqual(calls, ["/api/finances/73"])
        self.assertEqual(responses[-1][1], {"error": "not_found"})

    def test_estimate_position_update_uses_exact_project_scoped_route(self) -> None:
        handler = object.__new__(server.PMBIHandler)
        calls: list[str] = []
        responses: list[tuple[int, dict]] = []
        handler.api_update_estimate_position = lambda path: calls.append(path)
        handler.send_json = lambda status, payload: responses.append((status, payload))

        valid = "/api/projects/42/estimate-items/73/update"
        server.PMBIHandler.handle_api(handler, "POST", valid)
        server.PMBIHandler.handle_api(handler, "POST", valid + "/nested")

        self.assertEqual(calls, [valid])
        self.assertEqual(responses[-1][1], {"error": "not_found"})


if __name__ == "__main__":
    unittest.main()
