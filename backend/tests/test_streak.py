from datetime import date, timedelta

from app.services.streak import compute_streak

MON = date(2026, 1, 5)  # a Monday


def days(**kw):
    return kw


def week(n, *statuses):
    start = MON + timedelta(weeks=n)
    return {start + timedelta(days=i): s for i, s in enumerate(statuses)}


def test_empty_is_zero():
    info = compute_streak({}, MON, 1)
    assert (info.streak, info.week_progress) == (0, 0)


def test_current_week_in_progress_does_not_break():
    s = {**week(0, 'workout'), **week(1)}
    info = compute_streak(s, MON + timedelta(weeks=1, days=2), 1)
    assert info.streak == 1
    assert info.week_progress == 0


def test_consecutive_weeks_and_current_adds():
    s = {**week(0, 'workout'), **week(1, 'workout'), **week(2, 'workout')}
    assert compute_streak(s, MON + timedelta(weeks=2), 1).streak == 3


def test_missed_past_week_breaks():
    s = {**week(0, 'workout'), **week(2, 'workout')}
    assert compute_streak(s, MON + timedelta(weeks=2), 1).streak == 1


def test_two_workouts_same_day_count_once():
    # statuses are per day, so threshold 2 needs two different days
    s = week(0, 'workout')
    assert compute_streak(s, MON + timedelta(weeks=1), 2).streak == 0
    s = week(0, 'workout', 'workout')
    assert compute_streak(s, MON + timedelta(weeks=1), 2).streak == 1


def test_rest_week_is_not_counted_and_breaks_with_threshold():
    s = {**week(0, 'workout'), **week(1, 'rest', 'rest')}
    assert compute_streak(s, MON + timedelta(weeks=2), 1).streak == 0


def test_sick_week_freezes_streak():
    s = {
        **week(0, 'workout'),
        **week(1, 'sick', 'sick'),
        **week(2, 'workout'),
    }
    info = compute_streak(s, MON + timedelta(weeks=2), 1)
    assert info.streak == 2


def test_weeks_before_first_entry_do_not_break():
    s = week(5, 'workout')
    assert compute_streak(s, MON + timedelta(weeks=5), 1).streak == 1
