from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from sqlite_config import (  # noqa: E402
    SQLITE_BUSY_TIMEOUT_MS,
    SQLITE_CACHE_SIZE_KIB,
    configure_connection,
)


class SQLiteConfigTests(unittest.TestCase):
    def test_connection_uses_wal_busy_timeout_and_cache(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            connection = configure_connection(
                sqlite3.connect(Path(temp_dir) / "config.sqlite3")
            )
            try:
                self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "wal")
                self.assertEqual(
                    connection.execute("PRAGMA busy_timeout").fetchone()[0],
                    SQLITE_BUSY_TIMEOUT_MS,
                )
                self.assertEqual(
                    connection.execute("PRAGMA cache_size").fetchone()[0],
                    SQLITE_CACHE_SIZE_KIB,
                )
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
