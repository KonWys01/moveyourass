from datetime import UTC, datetime

import pytest

from app import clock, google


@pytest.fixture
async def headers(client, monkeypatch):
    identity = google.GoogleIdentity('s1', 'a@x.com', 'A', 'B', None)
    monkeypatch.setattr(google, 'verify_google_token', lambda t: identity)
    r = await client.post('/auth/google', json={'id_token': 'x'})
    return {'Authorization': f'Bearer {r.json()["access_token"]}'}


@pytest.fixture
def set_now(monkeypatch):
    def _set(*args):
        monkeypatch.setattr(
            clock, 'utcnow', lambda: datetime(*args, tzinfo=UTC)
        )

    _set(2026, 1, 6, 12, 0)  # Tue 13:00 Warsaw
    return _set


async def category_id(client, headers):
    r = await client.get('/categories', headers=headers)
    return r.json()[0]['id']


async def test_categories_are_seeded(client, headers):
    r = await client.get('/categories', headers=headers)

    names = [c['name'] for c in r.json()]
    assert 'Bieganie' in names and 'Siłownia plenerowa' in names


async def test_add_workout_creates_entry(client, headers, set_now):
    cid = await category_id(client, headers)

    r = await client.post(
        '/entries/workouts',
        headers=headers,
        json={'category_id': cid, 'description': 'rano'},
    )

    assert r.status_code == 201
    body = r.json()
    assert body['date'] == '2026-01-06'
    assert body['status'] == 'workout'
    assert body['workouts'][0]['description'] == 'rano'


async def test_multiple_workouts_same_day_one_entry(client, headers, set_now):
    cid = await category_id(client, headers)
    for _ in range(2):
        r = await client.post(
            '/entries/workouts', headers=headers, json={'category_id': cid}
        )

    assert len(r.json()['workouts']) == 2
    history = (await client.get('/entries/me', headers=headers)).json()
    assert len(history) == 1


async def test_unknown_category_422(client, headers, set_now):
    r = await client.post(
        '/entries/workouts', headers=headers, json={'category_id': 999999}
    )

    assert r.status_code == 422


async def test_workout_beats_rest_in_both_orders(client, headers, set_now):
    cid = await category_id(client, headers)
    await client.post('/entries/rest', headers=headers)
    r = await client.post(
        '/entries/workouts', headers=headers, json={'category_id': cid}
    )
    assert r.json()['status'] == 'workout'

    r = await client.post('/entries/rest', headers=headers)
    assert r.json()['status'] == 'workout'


async def test_midnight_buffer_counts_for_previous_day(
    client, headers, set_now
):
    set_now(2026, 1, 5, 23, 30)  # 00:30 Tue Warsaw
    r = await client.post('/entries/rest', headers=headers)

    assert r.json()['date'] == '2026-01-05'


async def test_today_reports_streak_and_progress(client, headers, set_now):
    cid = await category_id(client, headers)
    await client.post(
        '/entries/workouts', headers=headers, json={'category_id': cid}
    )

    body = (await client.get('/entries/today', headers=headers)).json()

    assert body['streak'] == 1
    assert body['week_progress'] == 1
    assert body['week_threshold'] == 1
    assert body['show_rest_hint'] is False


async def test_rest_hint_after_days_without_workout(client, headers, set_now):
    cid = await category_id(client, headers)
    set_now(2026, 1, 1, 12, 0)
    await client.post(
        '/entries/workouts', headers=headers, json={'category_id': cid}
    )
    set_now(2026, 1, 6, 12, 0)

    body = (await client.get('/entries/today', headers=headers)).json()

    assert body['days_since_workout'] == 5
    assert body['show_rest_hint'] is True


async def test_entries_require_auth(client):
    assert (await client.get('/entries/today')).status_code == 401
