from datetime import UTC, date, datetime

import pytest

from app import clock
from app.services.stats import best_week_days, longest_streak, weekly_days
from tests.test_social import Person

W = 'workout'


def d(day: int, month: int = 1) -> date:
    return date(2026, month, day)


def test_longest_streak_counts_best_run_not_current():
    # weeks of Jan 5, 12, 19 completed, Jan 26 empty, Feb 2 completed
    statuses = {d(5): W, d(13): W, d(21): W, d(3, 2): W}

    assert longest_streak(statuses, d(4, 2), 1) == 3


def test_longest_streak_sick_week_freezes_and_current_week_is_safe():
    statuses = {d(5): W, d(13): 'sick', d(21): W}

    # week of Jan 12 is sick (frozen), current week (Jan 19) is done
    assert longest_streak(statuses, d(22), 1) == 2
    # an empty week in progress does not break an earlier run
    assert longest_streak({d(5): W, d(12): W}, d(20), 1) == 2


def test_longest_streak_respects_threshold_and_empty():
    assert longest_streak({}, d(6), 1) == 0
    statuses = {d(5): W, d(6): W, d(12): W}
    assert longest_streak(statuses, d(14), 2) == 1


def test_weekly_days_and_best_week():
    statuses = {d(5): W, d(6): W, d(7): W, d(13): W}

    weeks = weekly_days(statuses, d(14), 3)

    assert weeks == [(date(2025, 12, 29), 0), (d(5), 3), (d(12), 1)]
    assert best_week_days(statuses) == 3


@pytest.fixture(autouse=True)
def fixed_now(monkeypatch):
    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 1, 14, 12, tzinfo=UTC)
    )


@pytest.fixture
async def me(client, monkeypatch):
    return await Person(client, monkeypatch, 'me', 'Ja').login()


async def test_stats_for_new_user_are_zero_with_unearned_badges(me):
    r = await me.get('/me/stats')

    body = r.json()
    assert r.status_code == 200
    assert body['total_workouts'] == 0
    assert body['current_streak'] == 0 and body['longest_streak'] == 0
    assert len(body['weeks']) == 12
    assert body['categories'] == []
    assert body['badges'] and not any(b['earned'] for b in body['badges'])


async def test_stats_counts_workouts_photos_categories_and_badges(me):
    await me.train(with_photo=True)
    await me.train()

    body = (await me.get('/me/stats')).json()

    assert body['total_workouts'] == 2
    assert body['active_days'] == 1
    assert body['total_photos'] == 1
    assert body['this_month'] == {'workouts': 2, 'active_days': 1}
    assert body['current_streak'] == 1 and body['longest_streak'] == 1
    assert body['best_week_days'] == 1
    assert body['weeks'][-1]['days'] == 1
    assert body['categories'][0]['count'] == 2
    first = next(b for b in body['badges'] if b['id'] == 'first')
    assert first['earned'] is True and first['progress'] == 1
    ten = next(b for b in body['badges'] if b['id'] == 'days_10')
    assert ten['earned'] is False and ten['progress'] == 1


async def test_calendar_lists_own_days_of_the_month(me, monkeypatch):
    await me.train(with_photo=True)
    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 1, 15, 12, tzinfo=UTC)
    )
    await me.post('/entries/rest')
    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 2, 3, 12, tzinfo=UTC)
    )
    await me.post('/entries/sick')

    jan = (await me.get('/me/calendar', params={'month': '2026-01'})).json()

    assert jan['month'] == '2026-01'
    assert [(x['date'], x['status']) for x in jan['days']] == [
        ('2026-01-14', 'workout'),
        ('2026-01-15', 'rest'),
    ]
    assert jan['days'][0]['workouts'] == 1 and jan['days'][0]['photos'] == 1
    feb = (await me.get('/me/calendar', params={'month': '2026-02'})).json()
    assert [x['status'] for x in feb['days']] == ['sick']


async def test_calendar_defaults_to_current_month_and_validates(me):
    await me.train()

    assert len((await me.get('/me/calendar')).json()['days']) == 1
    for bad in ('2026-13', '2026-1', 'abc', '1999-01'):
        r = await me.get('/me/calendar', params={'month': bad})
        assert r.status_code == 422


async def test_calendar_is_private(me, client, monkeypatch):
    await me.train()
    other = await Person(client, monkeypatch, 'oth', 'Ola').login()

    assert (await other.get('/me/calendar')).json()['days'] == []


async def test_today_has_like_and_comment_counts(me, client, monkeypatch):
    other = await Person(client, monkeypatch, 'oth', 'Ola').login()
    entry = await me.train()
    await other.post(f'/entries/{entry["id"]}/like')
    await other.post(f'/entries/{entry["id"]}/comments', json={'text': 'hej'})

    today = (await me.get('/entries/today')).json()

    assert today['like_count'] == 1 and today['comment_count'] == 1


async def test_today_counts_are_zero_without_entry(me):
    today = (await me.get('/entries/today')).json()

    assert today['like_count'] == 0 and today['comment_count'] == 0


async def test_likes_list_names_the_likers(me, client, monkeypatch):
    other = await Person(client, monkeypatch, 'oth', 'Ola').login()
    entry = await me.train()
    await other.post(f'/entries/{entry["id"]}/like')

    r = await me.get(f'/entries/{entry["id"]}/likes')

    assert [u['first_name'] for u in r.json()] == ['Ola']
