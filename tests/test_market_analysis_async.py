from __future__ import annotations

import gc
import json
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


class FailingExecutor:
    def submit(self, _function, *_args):
        raise RuntimeError("executor unavailable")


class MarketAnalysisAsyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_server_paths = {
            "data": server.DATA_DIR,
            "database": server.DB_PATH,
            "documents": server.DOCUMENTS_DIR,
            "bootstrap": server.BOOTSTRAP_PATH,
        }
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.restore_server_paths_and_remove_temp_dir)
        self.test_data_dir = Path(self.temp_dir.name)
        server.DATA_DIR = self.test_data_dir
        server.DB_PATH = self.test_data_dir / "market-analysis.sqlite3"
        server.DOCUMENTS_DIR = self.test_data_dir / "documents"
        server.BOOTSTRAP_PATH = self.test_data_dir / "INITIAL_ADMIN.txt"

        self.init_database_paths: list[Path] = []
        self.init_text_write_paths: list[Path] = []
        original_connect_database = server.connect_database
        original_write_text = Path.write_text

        def tracked_connect_database(path):
            self.init_database_paths.append(Path(path))
            return original_connect_database(path)

        def tracked_write_text(path, *args, **kwargs):
            self.init_text_write_paths.append(Path(path))
            return original_write_text(path, *args, **kwargs)

        with patch.object(server, "connect_database", tracked_connect_database), patch.object(
            Path, "write_text", tracked_write_text
        ):
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

    def restore_server_paths_and_remove_temp_dir(self) -> None:
        server.MARKET_ANALYSIS_JOBS.clear()
        server.DATA_DIR = self.original_server_paths["data"]
        server.DB_PATH = self.original_server_paths["database"]
        server.DOCUMENTS_DIR = self.original_server_paths["documents"]
        server.BOOTSTRAP_PATH = self.original_server_paths["bootstrap"]
        gc.collect()
        self.temp_dir.cleanup()

    def test_fixture_keeps_database_documents_and_bootstrap_inside_temp_dir(self) -> None:
        test_root = self.test_data_dir.resolve()
        active_paths = {
            "data": server.DATA_DIR,
            "database": server.DB_PATH,
            "documents": server.DOCUMENTS_DIR,
            "bootstrap": server.BOOTSTRAP_PATH,
        }
        for label, path in active_paths.items():
            with self.subTest(path=label):
                self.assertTrue(Path(path).resolve().is_relative_to(test_root))
                self.assertNotEqual(
                    Path(path).resolve(),
                    Path(self.original_server_paths[label]).resolve(),
                )

        self.assertEqual(
            [path.resolve() for path in self.init_database_paths],
            [server.DB_PATH.resolve()],
        )
        self.assertEqual(
            [path.resolve() for path in self.init_text_write_paths],
            [server.BOOTSTRAP_PATH.resolve()],
        )
        self.assertTrue(server.DB_PATH.is_file())
        self.assertTrue(server.BOOTSTRAP_PATH.is_file())

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

    def test_executor_failure_releases_deduplication_key_and_persists_error(self) -> None:
        with patch.object(server, "MARKET_ANALYSIS_EXECUTOR", FailingExecutor()):
            with self.assertRaisesRegex(RuntimeError, "executor unavailable"):
                server.request_market_analysis(1, "work")

        self.assertNotIn((1, "work"), server.MARKET_ANALYSIS_JOBS)
        with server.db() as con:
            cached = con.execute(
                "SELECT status, payload FROM market_analysis_cache WHERE project_id = ? AND kind = ?",
                (1, "work"),
            ).fetchone()
        self.assertEqual(cached["status"], "error")
        self.assertEqual(json.loads(cached["payload"])["error"], "market_analysis_failed")


if __name__ == "__main__":
    unittest.main()
