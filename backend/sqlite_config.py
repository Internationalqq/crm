from __future__ import annotations

import sqlite3
import time


SQLITE_BUSY_TIMEOUT_MS = 5000
# Negative values are kibibytes. 20 MiB keeps hot index/table pages in memory
# without making each request connection unbounded.
SQLITE_CACHE_SIZE_KIB = -20_000
SQLITE_OPEN_RETRIES = 5
SQLITE_OPEN_RETRY_DELAY_SECONDS = 0.05
SQLITE_TRANSIENT_OPEN_ERRORS = (
    "unable to open database file",
    "disk i/o error",
)


class ManagedConnection(sqlite3.Connection):
    """SQLite connection whose context manager also releases file handles."""

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


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
                factory=ManagedConnection,
            )
            return configure_connection(connection)
        except sqlite3.OperationalError as error:
            if connection is not None:
                connection.close()
            normalized_error = str(error).lower()
            is_temporary_open_error = any(
                marker in normalized_error for marker in SQLITE_TRANSIENT_OPEN_ERRORS
            )
            if not is_temporary_open_error or attempt + 1 >= SQLITE_OPEN_RETRIES:
                raise
            time.sleep(SQLITE_OPEN_RETRY_DELAY_SECONDS * (2**attempt))
    raise sqlite3.OperationalError("unable to open database file")
