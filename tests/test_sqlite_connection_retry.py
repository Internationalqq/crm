from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import sqlite_config  # noqa: E402


class SqliteConnectionRetryTests(unittest.TestCase):
    @patch("sqlite_config.time.sleep")
    @patch("sqlite_config.configure_connection")
    @patch("sqlite_config.sqlite3.connect")
    def test_retries_temporary_unable_to_open_error(
        self,
        connect: MagicMock,
        configure: MagicMock,
        sleep: MagicMock,
    ) -> None:
        first_connection = MagicMock()
        second_connection = MagicMock()
        connect.side_effect = [first_connection, second_connection]
        configure.side_effect = [
            sqlite3.OperationalError("unable to open database file"),
            second_connection,
        ]

        result = sqlite_config.connect_database(Path("database.sqlite3"))

        self.assertIs(result, second_connection)
        first_connection.close.assert_called_once_with()
        self.assertEqual(connect.call_count, 2)
        sleep.assert_called_once_with(sqlite_config.SQLITE_OPEN_RETRY_DELAY_SECONDS)

    @patch("sqlite_config.time.sleep")
    @patch("sqlite_config.configure_connection")
    @patch("sqlite_config.sqlite3.connect")
    def test_does_not_retry_unrelated_operational_error(
        self,
        connect: MagicMock,
        configure: MagicMock,
        sleep: MagicMock,
    ) -> None:
        connection = MagicMock()
        connect.return_value = connection
        configure.side_effect = sqlite3.OperationalError("database disk image is malformed")

        with self.assertRaisesRegex(sqlite3.OperationalError, "malformed"):
            sqlite_config.connect_database(Path("database.sqlite3"))

        connection.close.assert_called_once_with()
        self.assertEqual(connect.call_count, 1)
        sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
