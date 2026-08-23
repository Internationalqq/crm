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


if __name__ == "__main__":
    unittest.main()
