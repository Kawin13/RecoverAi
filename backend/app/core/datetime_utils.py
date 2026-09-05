"""
RecoverAI Centralized Timezone & Datetime Utilities.
Standardizes on timezone-aware UTC datetime across all backend services,
while providing defensive helpers to prevent naive/aware comparison TypeErrors.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Union

def utcnow() -> datetime:
    """Returns current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

def utcnow_naive() -> datetime:
    """
    Returns current UTC datetime without tzinfo.
    For legacy SQLite or naive datetime column comparisons where offset-aware
    subtractions would raise TypeError.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)

def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures a datetime object is timezone-aware in UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures a datetime object is in UTC but offset-naive."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def iso_utc(dt: Optional[datetime] = None) -> str:
    """Formats datetime as ISO-8601 UTC string with timezone indicator."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat()

def diff_seconds(newer: Optional[datetime], older: Optional[datetime], default: float = 0.0) -> float:
    """
    Safely computes (newer - older).total_seconds() avoiding naive/aware mismatch exceptions.
    """
    if newer is None or older is None:
        return default
    n_utc = to_utc(newer)
    o_utc = to_utc(older)
    if n_utc is None or o_utc is None:
        return default
    return (n_utc - o_utc).total_seconds()
