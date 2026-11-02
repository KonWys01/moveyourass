import pytest

from app import google
from app.config import get_settings


def fake_google(monkeypatch, sub='sub-1', email='a@example.com'):
    identity = google.GoogleIdentity(
        sub=sub,
        email=email,
        first_name='Ala',
        last_name='Kot',
        avatar_url='http://img/a.png',
    )
    monkeypatch.setattr(google, 'verify_google_token', lambda token: identity)


async def login(client, **extra):
    return await client.post('/auth/google', json={'id_token': 'x', **extra})


async def test_first_login_creates_public_user(client, monkeypatch):
    fake_google(monkeypatch)

    response = await login(client)

    assert response.status_code == 200
    body = response.json()
    assert body['is_new_user'] is True
    assert body['user']['first_name'] == 'Ala'
    assert body['user']['is_public'] is True
    assert body['user']['is_admin'] is False


async def test_first_login_can_choose_private_and_timezone(
    client, monkeypatch
):
    fake_google(monkeypatch)

    response = await login(
        client, is_public=False, timezone='America/New_York'
    )

    user = response.json()['user']
    assert user['is_public'] is False
    assert user['timezone'] == 'America/New_York'


async def test_second_login_is_not_new_and_keeps_user(client, monkeypatch):
    fake_google(monkeypatch)
    first = (await login(client)).json()

    second = (await login(client, is_public=False)).json()

    assert second['is_new_user'] is False
    assert second['user']['id'] == first['user']['id']
    assert second['user']['is_public'] is True


async def test_invalid_google_token_is_401(client, monkeypatch):
    def boom(token):
        raise google.InvalidGoogleToken

    monkeypatch.setattr(google, 'verify_google_token', boom)

    assert (await login(client)).status_code == 401


async def test_first_admin_email_gets_admin(client, monkeypatch):
    monkeypatch.setattr(
        get_settings(), 'first_admin_email', 'Boss@Example.com'
    )
    fake_google(monkeypatch, sub='boss', email='boss@example.com')

    user = (await login(client)).json()['user']

    assert user['is_admin'] is True


async def test_invalid_timezone_rejected(client, monkeypatch):
    fake_google(monkeypatch)

    response = await login(client, timezone='Mars/Olympus')

    assert response.status_code == 422


@pytest.fixture
async def auth_headers(client, monkeypatch):
    fake_google(monkeypatch)
    token = (await login(client)).json()['access_token']
    return {'Authorization': f'Bearer {token}'}


async def test_me_requires_token(client):
    assert (await client.get('/me')).status_code == 401
    bad = {'Authorization': 'Bearer nope'}
    assert (await client.get('/me', headers=bad)).status_code == 401


async def test_me_returns_profile(client, auth_headers):
    response = await client.get('/me', headers=auth_headers)

    assert response.status_code == 200
    assert response.json()['email'] == 'a@example.com'


async def test_patch_me_updates_settings(client, auth_headers):
    response = await client.patch(
        '/me',
        headers=auth_headers,
        json={
            'is_public': False,
            'timezone': 'Europe/London',
            'streak_threshold': 3,
        },
    )

    body = response.json()
    assert body['is_public'] is False
    assert body['timezone'] == 'Europe/London'
    assert body['streak_threshold'] == 3


@pytest.mark.parametrize(
    'payload',
    [{'streak_threshold': 0}, {'streak_threshold': 8}, {'timezone': 'x/y'}],
)
async def test_patch_me_validates(client, auth_headers, payload):
    response = await client.patch('/me', headers=auth_headers, json=payload)

    assert response.status_code == 422


async def test_blocked_user_rejected_with_valid_token(
    client, session, auth_headers
):
    from sqlalchemy import update

    from app.models import User

    await session.execute(update(User).values(is_blocked=True))

    assert (await client.get('/me', headers=auth_headers)).status_code == 403
    assert (await login(client)).status_code == 403
