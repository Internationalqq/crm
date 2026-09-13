"""Current business date shared by long-running request handlers."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone


def today_iso() -> str:
    """Evaluate at request time, in the CRM timezone (Yekaterinburg by default)."""
    offset = int(os.environ.get("PMBI_TZ_OFFSET_HOURS", "5"))
    zone = timezone(timedelta(hours=offset))
    return datetime.now(zone).date().isoformat()
