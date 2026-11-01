import io
from datetime import UTC, datetime

import pytest
from PIL import Image

from app import clock, google


@pytest.fixture(autouse=True)
def fixed_now(monkeypatch):
    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 1, 6, 12, tzinfo=UTC)
    )


class Person:
    def __init__(self, client, monkeypatch, sub, first, public=True):
        self.client = client
        self.monkeypatch = monkeypatch
        self.sub = sub
        self.first = first
        self.public = public
        self.headers = None
        self.id = None

    async def login(self):
        identity = google.GoogleIdentity(
            self.sub, f'{self.sub}@x.com', self.first, 'Test', None
        )
        self.monkeypatch.setattr(
            google, 'verify_google_token', lambda t: identity
        )
        r = await self.client.post(
            '/auth/google',
            json={'id_token': 'x', 'is_public': self.public},
        )
        body = r.json()
        self.headers = {'Authorization': f'Bearer {body["access_token"]}'}
        self.id = body['user']['id']
        return self

    async def post(self, url, **kw):
        return await self.client.post(url, headers=self.headers, **kw)

    async def get(self, url, **kw):
        return await self.client.get(url, headers=self.headers, **kw)

    async def delete(self, url):
        return await self.client.delete(url, headers=self.headers)

    async def train(self, with_photo=False):
        cid = (await self.get('/categories')).json()[0]['id']
        r = await self.post('/entries/workouts', json={'category_id': cid})
        entry = r.json()
        if with_photo:
            img = io.BytesIO()
            Image.new('RGB', (50, 50)).save(img, 'JPEG')
            await self.post(
                f'/workouts/{entry["workouts"][0]["id"]}/photos',
                files={'file': ('a.jpg', img.getvalue(), 'image/jpeg')},
            )
        return entry


@pytest.fixture
async def pub(client, monkeypatch):
    return await Person(client, monkeypatch, 'pub', 'Pawel').login()


@pytest.fixture
async def priv(client, monkeypatch):
    return await Person(
        client, monkeypatch, 'priv', 'Prywatna', public=False
    ).login()


@pytest.fixture
async def viewer(client, monkeypatch):
    return await Person(client, monkeypatch, 'view', 'Wojtek').login()


async def test_search_finds_by_name_and_shows_lock_info(pub, priv, viewer):
    r = await viewer.get('/users/search', params={'q': 'praw'})
    assert r.json() == []

    r = await viewer.get('/users/search', params={'q': 'Prywat'})
    found = r.json()[0]
    assert found['is_public'] is False
    assert found['follow_status'] == 'none'
    assert (await viewer.get('/users/search', params={'q': '%%'})).json() == []


async def test_follow_public_is_instant(pub, viewer):
    r = await viewer.post(f'/users/{pub.id}/follow')

    assert r.json() == {'status': 'accepted'}
    assert (await viewer.post(f'/users/{pub.id}/follow')).json() == {
        'status': 'accepted'
    }


async def test_cannot_follow_self(pub):
    assert (await pub.post(f'/users/{pub.id}/follow')).status_code == 400


async def test_private_follow_needs_acceptance(priv, viewer):
    r = await viewer.post(f'/users/{priv.id}/follow')
    assert r.json() == {'status': 'pending'}

    reqs = (await priv.get('/follow-requests')).json()
    assert [u['id'] for u in reqs] == [viewer.id]

    await priv.post(f'/follow-requests/{viewer.id}/accept')
    profile = (await viewer.get(f'/users/{priv.id}')).json()
    assert profile['follow_status'] == 'accepted'
    assert profile['can_view'] is True


async def test_private_profile_hidden_until_accepted(priv, viewer):
    entry = await priv.train()

    profile = (await viewer.get(f'/users/{priv.id}')).json()
    assert profile['can_view'] is False
    assert profile['stats'] is None
    assert profile['first_name'] == 'Prywatna'
    assert (await viewer.get(f'/users/{priv.id}/entries')).status_code == 403
    assert (await viewer.get(f'/entries/{entry["id"]}')).status_code == 404
    assert (
        await viewer.post(f'/entries/{entry["id"]}/like')
    ).status_code == 404
    assert (
        await viewer.post(
            f'/entries/{entry["id"]}/comments', json={'text': 'hej'}
        )
    ).status_code == 404


async def test_public_profile_visible_to_anyone_without_following(pub, viewer):
    await pub.train(with_photo=True)

    r = await viewer.get(f'/users/{pub.id}/entries')

    assert r.status_code == 200
    photo = r.json()[0]['workouts'][0]['photos'][0]
    assert photo['url'].startswith('https://signed.test/')


async def test_removing_follower_cuts_photo_access_immediately(priv, viewer):
    entry = await priv.train(with_photo=True)
    await viewer.post(f'/users/{priv.id}/follow')
    await priv.post(f'/follow-requests/{viewer.id}/accept')
    assert (await viewer.get(f'/entries/{entry["id"]}')).status_code == 200

    await priv.delete(f'/followers/{viewer.id}')

    assert (await viewer.get(f'/entries/{entry["id"]}')).status_code == 404
    assert (await viewer.get('/feed')).json() == []


async def test_reject_request_and_cancel(priv, viewer):
    await viewer.post(f'/users/{priv.id}/follow')

    await priv.delete(f'/follow-requests/{viewer.id}')

    assert (await priv.get('/follow-requests')).json() == []
    profile = (await viewer.get(f'/users/{priv.id}')).json()
    assert profile['follow_status'] == 'none'


async def test_feed_shows_only_followed_workouts_with_stats(pub, priv, viewer):
    await pub.train()
    await priv.train()
    await viewer.post(f'/users/{pub.id}/follow')

    feed = (await viewer.get('/feed')).json()

    assert [i['user']['id'] for i in feed] == [pub.id]
    assert feed[0]['stats']['streak'] == 1
    assert feed[0]['stats']['week_progress'] == 1


async def test_feed_hides_rest_and_sick(pub, viewer):
    await pub.post('/entries/rest')
    await viewer.post(f'/users/{pub.id}/follow')

    assert (await viewer.get('/feed')).json() == []


async def test_feed_pagination_cursor(pub, viewer, session, monkeypatch):
    from sqlalchemy import update

    from app.models import DayEntry

    days = [5, 6]
    ids = []
    for day in days:
        monkeypatch.setattr(
            clock,
            'utcnow',
            lambda d=day: datetime(2026, 1, d, 12, tzinfo=UTC),
        )
        ids.append((await pub.train())['id'])
    for entry_id, day in zip(ids, days, strict=True):
        await session.execute(
            update(DayEntry)
            .where(DayEntry.id == entry_id)
            .values(created_at=datetime(2026, 1, day, 12, tzinfo=UTC))
        )
    await viewer.post(f'/users/{pub.id}/follow')

    first = (await viewer.get('/feed', params={'limit': 1})).json()
    assert [i['id'] for i in first] == [ids[1]]

    cursor = datetime(2026, 1, 6, 12, tzinfo=UTC).isoformat()
    second = (
        await viewer.get('/feed', params={'limit': 1, 'before': cursor})
    ).json()
    assert [i['id'] for i in second] == [ids[0]]


async def test_like_is_idempotent_and_counted(pub, viewer):
    entry = await pub.train()
    for _ in range(2):
        assert (
            await viewer.post(f'/entries/{entry["id"]}/like')
        ).status_code == 204

    body = (await viewer.get(f'/entries/{entry["id"]}')).json()
    assert body['like_count'] == 1
    assert body['liked_by_me'] is True

    await viewer.delete(f'/entries/{entry["id"]}/like')
    body = (await viewer.get(f'/entries/{entry["id"]}')).json()
    assert body['like_count'] == 0


async def test_comments_flow_and_permissions(pub, viewer, client, monkeypatch):
    entry = await pub.train()
    r = await viewer.post(
        f'/entries/{entry["id"]}/comments', json={'text': '  super  '}
    )
    assert r.status_code == 201
    cid = r.json()['id']
    assert r.json()['text'] == 'super'

    comments = (await pub.get(f'/entries/{entry["id"]}/comments')).json()
    assert [c['text'] for c in comments] == ['super']
    body = (await pub.get(f'/entries/{entry["id"]}')).json()
    assert body['comment_count'] == 1

    stranger = await Person(client, monkeypatch, 'str', 'Obcy').login()
    assert (await stranger.delete(f'/comments/{cid}')).status_code == 403
    # entry owner may delete someone else's comment
    assert (await pub.delete(f'/comments/{cid}')).status_code == 204


async def test_comment_validation(pub, viewer):
    entry = await pub.train()
    url = f'/entries/{entry["id"]}/comments'

    assert (await viewer.post(url, json={'text': ''})).status_code == 422
    assert (await viewer.post(url, json={'text': '   '})).status_code == 422
    assert (
        await viewer.post(url, json={'text': 'x' * 501})
    ).status_code == 422


async def test_blocked_user_hidden_from_search_and_feed(pub, viewer, session):
    from sqlalchemy import update

    from app.models import User

    await pub.train()
    await viewer.post(f'/users/{pub.id}/follow')
    await session.execute(
        update(User).where(User.id == pub.id).values(is_blocked=True)
    )

    assert (await viewer.get('/feed')).json() == []
    assert (
        await viewer.get('/users/search', params={'q': 'Pawel'})
    ).json() == []
    assert (await viewer.get(f'/users/{pub.id}')).status_code == 404


async def test_entries_today_route_not_shadowed(pub):
    assert (await pub.get('/entries/today')).status_code == 200
    assert (await pub.get('/entries/me')).status_code == 200
