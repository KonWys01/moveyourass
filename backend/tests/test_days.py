from datetime import UTC, date, datetime

from app.services.days import entry_date_for, week_start


def utc(*args):
    return datetime(*args, tzinfo=UTC)


def test_after_buffer_counts_for_today():
    # 01:00 Warsaw (CET, UTC+1) on Tue 2026-01-06 = 00:00 UTC
    assert entry_date_for(utc(2026, 1, 6, 0, 0), 'Europe/Warsaw', 1) == (
        date(2026, 1, 6)
    )


def test_inside_buffer_counts_for_yesterday():
    # 00:30 Warsaw on Tue = 23:30 UTC Mon
    assert entry_date_for(utc(2026, 1, 5, 23, 30), 'Europe/Warsaw', 1) == (
        date(2026, 1, 5)
    )


def test_timezone_change_moves_today():
    now = utc(2026, 1, 6, 3, 0)  # 22:00 Mon in New York
    assert entry_date_for(now, 'America/New_York', 1) == date(2026, 1, 5)
    assert entry_date_for(now, 'Europe/Warsaw', 1) == date(2026, 1, 6)


def test_buffer_works_on_dst_spring_forward_night():
    # Warsaw 2026-03-29: 02:00 -> 03:00. 00:30 local is still CET.
    assert entry_date_for(utc(2026, 3, 28, 23, 30), 'Europe/Warsaw', 1) == (
        date(2026, 3, 28)
    )
    # 01:30 local (after buffer) is today
    assert entry_date_for(utc(2026, 3, 29, 0, 30), 'Europe/Warsaw', 1) == (
        date(2026, 3, 29)
    )


def test_buffer_works_on_dst_fall_back_night():
    # Warsaw 2026-10-25: 03:00 -> 02:00; 00:30 local is still CEST.
    assert entry_date_for(utc(2026, 10, 24, 22, 30), 'Europe/Warsaw', 1) == (
        date(2026, 10, 24)
    )


def test_week_starts_monday():
    assert week_start(date(2026, 1, 11)) == date(2026, 1, 5)  # Sunday
    assert week_start(date(2026, 1, 5)) == date(2026, 1, 5)
