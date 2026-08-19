from __future__ import annotations

import sqlite3


SQLITE_BUSY_TIMEOUT_MS = 5000
# Negative values are kibibytes. 20 MiB keeps hot index/table pages in memory
# without making each request connection unbounded.
SQLITE_CACHE_SIZE_KIB = -20_000


def configure_connection(connection: sqlite3.Connection) -> sqlite3.Connection:
    """Apply the same safe SQLite settings to every application connection."""
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(f"PRAGMA busy_timeout = {SQLITE_BUSY_TIMEOUT_MS}")
    connection.execute(f"PRAGMA cache_size = {SQLITE_CACHE_SIZE_KIB}")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection
