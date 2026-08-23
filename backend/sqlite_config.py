from __future__ import annotations

import sqlite3
import time


SQLITE_BUSY_TIMEOUT_MS = 5000
# Negative values are kibibytes. 20 MiB keeps hot index/table pages in memory
# without making each request connection unbounded.
SQLITE_CACHE_SIZE_KIB = -20_000
SQLITE_OPEN_RETRIES = 5
SQLITE_OPEN_RETRY_DELAY_SECONDS = 0.05


def configure_connection(connection: sqlite3.Connection) -> sqlite3.Connection:
    """Apply the same safe SQLite settings to every application connection."""
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(f"PRAGMA busy_timeout = {SQLITE_BUSY_TIMEOUT_MS}")
    connection.execute(f"PRAGMA cache_size = {SQLITE_CACHE_SIZE_KIB}")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def connect_database(path: object) -> sqlite3.Connection:
    """Open and configure SQLite, retrying short bind-mount interruptions."""
    for attempt in range(SQLITE_OPEN_RETRIES):
        connection: sqlite3.Connection | None = None
        try:
            connection = sqlite3.connect(
                path,
                timeout=SQLITE_BUSY_TIMEOUT_MS / 1000,
            )
            return configure_connection(connection)
        except sqlite3.OperationalError as error:
            if connection is not None:
                connection.close()
            is_temporary_open_error = "unable to open database file" in str(error).lower()
            if not is_temporary_open_error or attempt + 1 >= SQLITE_OPEN_RETRIES:
                raise
            time.sleep(SQLITE_OPEN_RETRY_DELAY_SECONDS * (2**attempt))
    raise sqlite3.OperationalError("unable to open database file")
