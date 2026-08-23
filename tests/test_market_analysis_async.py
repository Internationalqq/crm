from __future__ import annotations

import gc
import tempfile
import unittest
from http import HTTPStatus
from pathlib import Path
from unittest.mock import patch


import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class QueuedExecutor:
    """Deterministic substitute for ThreadPoolExecutor in unit tests."""

    def __init__(self) -> None:
        self.jobs: list[tuple[object, tuple[object, ...]]] = []

    def submit(self, function, *args):
        self.jobs.append((function, args))
        return object()

    def run_next(self) -> None:
        function, args = self.jobs.pop(0)
        function(*args)


class MarketAnalysisAsyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        server.DB_PATH = Path(self.temp_dir.name) / "market-analysis.sqlite3"
        server.init_db()
        server.MARKET_ANALYSIS_JOBS.clear()
        with server.db() as con:
            con.execute(
                """
                INSERT INTO projects (title, address, client_name, status, created_at, contract_no)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                ("Async test project", "Test address", "Test client", "active", server.now_ts(), "ESTIMATE-test"),
            )
            con.commit()

    def tearDown(self) -> None:
        server.MARKET_ANALYSIS_JOBS.clear()
        gc.collect()
        self.temp_dir.cleanup()

    def test_pending_is_deduplicated_then_ready_is_cached(self) -> None:
        executor = QueuedExecutor()
        with patch.object(server, "MARKET_ANALYSIS_EXECUTOR", executor), patch.object(
            server, "fetch_autobot_market_rows", return_value=[]
        ) as fetch_market:
            status, payload = server.request_market_analysis(1, "material")
            self.assertEqual(status, HTTPStatus.OK)
            self.assertEqual(payload["status"], "pending")
            self.assertEqual(len(executor.jobs), 1)

            status, payload = server.request_market_analysis(1, "material")
            self.assertEqual(status, HTTPStatus.OK)
            self.assertEqual(payload["status"], "pending")
            self.assertEqual(len(executor.jobs), 1)

            executor.run_next()
            status, payload = server.request_market_analysis(1, "material")
            self.assertEqual(status, HTTPStatus.OK)
            self.assertEqual(payload["status"], "ready")
            self.assertEqual(payload["rows"], [])
            self.assertEqual(fetch_market.call_count, 4)

            # A fresh ready result is served from SQLite and does not enqueue
            # another AutoBot request within the 15-minute TTL.
            status, payload = server.request_market_analysis(1, "material")
            self.assertEqual(status, HTTPStatus.OK)
            self.assertEqual(payload["status"], "ready")
            self.assertEqual(len(executor.jobs), 0)
            self.assertEqual(fetch_market.call_count, 4)

    def test_autobot_failure_is_returned_as_503_after_pending(self) -> None:
        executor = QueuedExecutor()
        with patch.object(server, "MARKET_ANALYSIS_EXECUTOR", executor), patch.object(
            server,
            "fetch_autobot_market_rows",
            side_effect=server.AutoBotUnavailableError("autobot_unavailable"),
        ):
            status, payload = server.request_market_analysis(1, "work")
            self.assertEqual(status, HTTPStatus.OK)
            self.assertEqual(payload["status"], "pending")
            self.assertEqual(len(executor.jobs), 1)

            executor.run_next()
            status, payload = server.request_market_analysis(1, "work")
            self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
            self.assertEqual(payload["status"], "error")
            self.assertEqual(payload["error"], "autobot_unavailable")
            self.assertEqual(payload["analysis"], [])
            self.assertEqual(payload["materials"], [])
            self.assertEqual(payload["works"], [])


if __name__ == "__main__":
    unittest.main()
