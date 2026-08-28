from __future__ import annotations

import sqlite3
import sys
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import server  # noqa: E402


class SqliteMaintenanceTests(unittest.TestCase):
    def test_optimize_is_safe_on_supported_sqlite(self) -> None:
        con = sqlite3.connect(":memory:")
        self.addCleanup(con.close)
        con.executescript(
            """
            CREATE TABLE entries (id INTEGER PRIMARY KEY, project_id INTEGER);
            CREATE INDEX idx_entries_project ON entries(project_id);
            INSERT INTO entries(project_id) VALUES (1), (1), (2);
            """
        )

        self.assertTrue(server.optimize_sqlite(con))
        self.assertEqual(con.execute("PRAGMA quick_check").fetchone()[0], "ok")

    def test_old_sqlite_optimize_syntax_is_a_compatible_noop(self) -> None:
        con = mock.Mock()
        con.execute.side_effect = sqlite3.OperationalError(
            'near "optimize": syntax error'
        )

        self.assertFalse(server.optimize_sqlite(con))
        con.execute.assert_called_once_with("PRAGMA optimize")

    def test_optimize_does_not_hide_disk_io_failure(self) -> None:
        con = mock.Mock()
        con.execute.side_effect = sqlite3.OperationalError("disk I/O error")

        with self.assertRaisesRegex(sqlite3.OperationalError, "disk I/O"):
            server.optimize_sqlite(con)

    def test_foreign_key_damage_is_reported_without_mutating_rows(self) -> None:
        con = sqlite3.connect(":memory:")
        self.addCleanup(con.close)
        con.executescript(
            """
            PRAGMA foreign_keys = OFF;
            CREATE TABLE parents (id INTEGER PRIMARY KEY);
            CREATE TABLE children (
                id INTEGER PRIMARY KEY,
                parent_id INTEGER REFERENCES parents(id)
            );
            INSERT INTO children(id, parent_id) VALUES (5, 99);
            """
        )
        stderr = StringIO()

        with redirect_stderr(stderr):
            violations = server.report_sqlite_foreign_key_violations(con)

        self.assertEqual(
            violations,
            [{"table": "children", "rowid": 5, "parent": "parents", "fkid": 0}],
        )
        self.assertIn("no automatic repair was applied", stderr.getvalue())
        self.assertEqual(
            con.execute("SELECT id, parent_id FROM children").fetchall(),
            [(5, 99)],
        )


if __name__ == "__main__":
    unittest.main()
