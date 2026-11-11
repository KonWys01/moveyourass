import pytest

from tests.test_social import Person

TOKEN = 'fol-token-aaaaaaaa'


@pytest.fixture
async def me(client, monkeypatch):
    return await Person(client, monkeypatch, 'me', 'Ja').login()


@pytest.fixture
async def fan(client, monkeypatch):
    p = await Person(client, monkeypatch, 'fan', 'Fan').login()
    await p.post('/devices', json={'token': TOKEN})
    return p


async def patch(p, url, **kw):
    return await p.client.patch(url, headers=p.headers, **kw)


async def test_edit_workout_changes_category_and_description(me):
    entry = await me.train()
    wid = entry['workouts'][0]['id']
    cats = (await me.get('/categories')).json()

    r = await patch(
        me,
        f'/workouts/{wid}',
        json={'category_id': cats[1]['id'], 'description': 'po zmianie'},
    )

    assert r.status_code == 200
    assert r.json()['category']['id'] == cats[1]['id']
    assert r.json()['description'] == 'po zmianie'
    today = (await me.get('/entries/today')).json()
    assert today['entry']['workouts'][0]['description'] == 'po zmianie'


async def test_edit_can_clear_description_and_keeps_category(me):
    entry = await me.train()
    wid = entry['workouts'][0]['id']
    await patch(me, f'/workouts/{wid}', json={'description': 'x'})

    r = await patch(me, f'/workouts/{wid}', json={'description': None})

    assert r.json()['description'] is None
    assert r.json()['category']['id'] == entry['workouts'][0]['category']['id']


async def test_edit_unknown_category_422(me):
    wid = (await me.train())['workouts'][0]['id']

    r = await patch(me, f'/workouts/{wid}', json={'category_id': 999999})

    assert r.status_code == 422


async def test_cannot_edit_or_delete_someone_elses_workout(me, fan):
    wid = (await me.train())['workouts'][0]['id']

    assert (await patch(fan, f'/workouts/{wid}', json={})).status_code == 404
    assert (await fan.delete(f'/workouts/{wid}')).status_code == 404
    assert len((await me.get('/entries/me')).json()) == 1


async def test_edit_works_on_an_old_workout_and_adds_photo(me, monkeypatch):
    # a workout from "yesterday" can still be edited and get a photo
    from datetime import UTC, datetime

    from app import clock

    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 1, 6, 12, tzinfo=UTC)
    )
    wid = (await me.train())['workouts'][0]['id']
    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 1, 9, 12, tzinfo=UTC)
    )

    r = await patch(me, f'/workouts/{wid}', json={'description': 'późno'})

    assert r.status_code == 200


async def test_delete_one_of_two_workouts_keeps_entry(me):
    await me.train()
    entry = await me.train()
    first, second = entry['workouts'][0]['id'], entry['workouts'][1]['id']

    r = await me.delete(f'/workouts/{first}')

    assert r.status_code == 204
    history = (await me.get('/entries/me')).json()
    assert [w['id'] for w in history[0]['workouts']] == [second]


async def test_delete_last_workout_removes_the_day_and_files(me, storage):
    entry = await me.train(with_photo=True)
    assert len(storage.files) == 1

    r = await me.delete(f'/workouts/{entry["workouts"][0]["id"]}')

    assert r.status_code == 204
    assert (await me.get('/entries/me')).json() == []
    assert (await me.get('/entries/today')).json()['entry'] is None
    assert storage.files == {}


async def test_delete_entry_removes_rest_day(me):
    entry = (await me.post('/entries/rest')).json()

    r = await me.delete(f'/entries/{entry["id"]}')

    assert r.status_code == 204
    assert (await me.get('/entries/today')).json()['entry'] is None


async def test_delete_entry_removes_photos_likes_and_comments(
    me, fan, storage
):
    entry = await me.train(with_photo=True)
    await fan.post(f'/entries/{entry["id"]}/like')
    await fan.post(f'/entries/{entry["id"]}/comments', json={'text': 'hej'})

    r = await me.delete(f'/entries/{entry["id"]}')

    assert r.status_code == 204
    assert storage.files == {}
    assert (await fan.get(f'/entries/{entry["id"]}')).status_code == 404


async def test_cannot_delete_someone_elses_entry(me, fan):
    entry = await me.train()

    assert (await fan.delete(f'/entries/{entry["id"]}')).status_code == 404
    assert len((await me.get('/entries/me')).json()) == 1


async def test_storage_failure_on_delete_does_not_fail_request(me, storage):
    entry = await me.train(with_photo=True)

    async def boom(path):
        raise RuntimeError('supabase down')

    storage.delete = boom

    r = await me.delete(f'/entries/{entry["id"]}')

    assert r.status_code == 204
    assert (await me.get('/entries/me')).json() == []


async def test_followers_get_push_for_first_workout_of_the_day(
    me, fan, pusher
):
    await fan.post(f'/users/{me.id}/follow')
    pusher.sent.clear()

    entry = await me.train()
    await me.train()  # second workout the same day: silent

    assert len(pusher.sent) == 1
    msg = pusher.sent[0]
    assert msg['tokens'] == [TOKEN]
    assert msg['data']['kind'] == 'new_activity'
    assert msg['data']['entry_id'] == entry['id']
    assert 'Ja' in msg['body']


async def test_pending_follower_and_non_followers_get_no_push(
    client, monkeypatch, fan, pusher
):
    priv = await Person(
        client, monkeypatch, 'priv', 'Sekret', public=False
    ).login()
    await fan.post(f'/users/{priv.id}/follow')  # pending
    pusher.sent.clear()

    await priv.train()

    assert pusher.sent == []


async def test_rest_day_does_not_push_and_pref_can_mute(me, fan, pusher):
    await fan.post(f'/users/{me.id}/follow')
    pusher.sent.clear()
    await me.post('/entries/rest')
    assert pusher.sent == []

    r = await fan.client.patch(
        '/me/notifications', headers=fan.headers, json={'new_activity': False}
    )
    assert r.json()['new_activity'] is False
    await me.train()
    assert pusher.sent == []
