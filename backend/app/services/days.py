from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def entry_date_for(
    now_utc: datetime, tz_name: str, buffer_end_hour: int
) -> date:
    """Calendar day an entry made at ``now_utc`` counts for.

    Between 00:00 and ``buffer_end_hour`` (local) it still counts for
    the previous day; the server clock in the user's timezone decides.
    """
    local = now_utc.astimezone(ZoneInfo(tz_name))
    if local.hour < buffer_end_hour:
        return local.date() - timedelta(days=1)
    return local.date()


def week_start(day: date) -> date:
    """Monday of the week containing ``day``."""
    return day - timedelta(days=day.weekday())
